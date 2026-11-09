"""
Capa de servicios y reglas de negocio para Presupuestos y Apertura de OT (HU-005, HU-006, HU-007).
Soporta:
- Anexo 1 (Talonario de texto libre para Terceros / Particulares)
- Anexo 2 (Planilla de casillas [X] C/R/P por sección y rubros para Compañías Aseguradoras)
- Carga estructurada de ítems por API
"""
from datetime import date, timedelta
from decimal import Decimal
from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.core.models import Cliente, Vehiculo
from apps.workorders.models import FASES_TALLER_DEFINICION, FaseReparacion, OrdenDeTrabajo
from .models import ItemPresupuesto, Presupuesto

VALIDEZ_PRESUPUESTO_DIAS = 15


def sincronizar_presupuestos_vencidos() -> int:
    """
    Si un presupuesto tiene fecha_vencimiento anterior al día de hoy y no fue aprobado,
    pasa automáticamente a estado 'rechazado' (cancelado por vencimiento sin borrarse).
    """
    hoy = date.today()
    return Presupuesto.objects.filter(
        fecha_vencimiento__lt=hoy,
        estado__in=[
            Presupuesto.Estado.BORRADOR,
            Presupuesto.Estado.EMITIDO,
            Presupuesto.Estado.VENCIDO,
        ],
    ).update(estado=Presupuesto.Estado.RECHAZADO)


def _to_decimal(val) -> Decimal:
    try:
        if val in (None, ""):
            return Decimal("0.00")
        return Decimal(str(val))
    except Exception:
        return Decimal("0.00")


def validate_budget_modality_rules(
    *, tipo: str, compania, nro_siniestro: str = "", nombre_perito: str = ""
):
    """
    HU-006:
    Si el tipo es "aseguradora", exige seleccionar la compañía aseguradora.
    El número de siniestro y el nombre del perito liquidador son opcionales al confeccionar
    el presupuesto (ya que el cliente suele solicitar el presupuesto antes de tener asignado
    siniestro o perito por parte de la compañía).
    """
    if tipo == Presupuesto.Tipo.ASEGURADORA:
        if not compania:
            raise ValidationError(
                {
                    "modalidad_aseguradora": (
                        "Para presupuestos de Compañía Aseguradora es obligatorio seleccionar la compañía aseguradora."
                    )
                }
            )


def build_items_from_taller_forms(presupuesto: Presupuesto):
    """
    Genera automáticamente los registros de ItemPresupuesto cuando el usuario utiliza:
    - El formato libre de Terceros/Particulares (Anexo 1: detalle_libre + rubros_importes), o
    - La planilla de casillas [X] C/R/P de Aseguradoras (Anexo 2: planilla_marcaciones + rubros_importes).
    """
    rubros = presupuesto.rubros_importes or {}
    marcaciones = presupuesto.planilla_marcaciones or {}
    detalle = (presupuesto.detalle_libre or "").strip()

    if not rubros and not marcaciones and not detalle:
        return

    presupuesto.items.all().delete()

    if presupuesto.tipo == Presupuesto.Tipo.PARTICULAR:
        mo_val = _to_decimal(rubros.get("mano_obra", 0))
        rep_val = _to_decimal(rubros.get("repuestos", 0))
        resumen_linea = detalle.splitlines()[0][:180] if detalle else "Trabajo de chapa y pintura según detalle"

        if mo_val > Decimal("0.00"):
            ItemPresupuesto.objects.create(
                presupuesto=presupuesto,
                descripcion=resumen_linea,
                tipo_item=ItemPresupuesto.TipoItem.MANO_OBRA_CHAPA,
                cantidad=1,
                precio_unitario=mo_val,
            )
        if rep_val > Decimal("0.00"):
            ItemPresupuesto.objects.create(
                presupuesto=presupuesto,
                descripcion="Repuestos y materiales incluidos en cotización particular",
                tipo_item=ItemPresupuesto.TipoItem.REPUESTO,
                cantidad=1,
                precio_unitario=rep_val,
            )
    else:
        # Planilla de Aseguradora: cada casilla marcada con X (C, R, P) se registra para trazabilidad
        for key, flags in marcaciones.items():
            if not isinstance(flags, dict):
                continue
            acciones = []
            if flags.get("C"):
                acciones.append("Cambiar [X]")
            if flags.get("R"):
                acciones.append("Reparar [X]")
            if flags.get("P"):
                acciones.append("Pintar [X]")
            nota = (flags.get("nota") or "").strip()
            if acciones or nota:
                pieza_label = key.replace("__", " - ")
                acc_str = ", ".join(acciones)
                desc = f"{pieza_label}: {acc_str}" + (f" ({nota})" if nota else "")
                tipo_it = (
                    ItemPresupuesto.TipoItem.MANO_OBRA_PINTURA
                    if flags.get("P") and not (flags.get("C") or flags.get("R"))
                    else ItemPresupuesto.TipoItem.MANO_OBRA_CHAPA
                )
                ItemPresupuesto.objects.create(
                    presupuesto=presupuesto,
                    descripcion=desc[:200],
                    tipo_item=tipo_it,
                    cantidad=1,
                    precio_unitario=Decimal("0.00"),
                )

        # Además registramos los montos globales del pie de planilla
        mo_total_planilla = (
            _to_decimal(rubros.get("mano_obra", 0))
            + _to_decimal(rubros.get("pintura", 0))
            + _to_decimal(rubros.get("mecanica", 0))
            + _to_decimal(rubros.get("electricidad", 0))
            + _to_decimal(rubros.get("tapiceria", 0))
            + _to_decimal(rubros.get("iva", 0))
        )
        rep_planilla = _to_decimal(rubros.get("repuestos", 0))

        if mo_total_planilla > Decimal("0.00"):
            ItemPresupuesto.objects.create(
                presupuesto=presupuesto,
                descripcion="Total Mano de Obra / Pintura / Varios según Planilla de Aseguradora",
                tipo_item=ItemPresupuesto.TipoItem.MANO_OBRA_CHAPA,
                cantidad=1,
                precio_unitario=mo_total_planilla,
            )
        if rep_planilla > Decimal("0.00"):
            ItemPresupuesto.objects.create(
                presupuesto=presupuesto,
                descripcion="Total Repuestos consignados en Planilla de Aseguradora",
                tipo_item=ItemPresupuesto.TipoItem.REPUESTO,
                cantidad=1,
                precio_unitario=rep_planilla,
            )


@transaction.atomic
def recalculate_budget_totals(presupuesto: Presupuesto) -> Presupuesto:
    """
    HU-005 Criterio 1 y HU-006 Criterio 2:
    Calcula monto_mano_obra, monto_repuestos y monto_total.
    Si el presupuesto utiliza rubros_importes de las planillas reales del taller, respeta esos importes;
    si utiliza ítems individuales por API, suma los ítems.
    """
    items = list(presupuesto.items.all())
    mano_obra = Decimal("0.00")
    repuestos = Decimal("0.00")

    for item in items:
        expected_sub = Decimal(int(item.cantidad)) * Decimal(str(item.precio_unitario))
        if item.subtotal != expected_sub:
            item.subtotal = expected_sub
            item.save(update_fields=["subtotal"])

        if item.tipo_item in (
            ItemPresupuesto.TipoItem.MANO_OBRA_CHAPA,
            ItemPresupuesto.TipoItem.MANO_OBRA_PINTURA,
        ):
            mano_obra += item.subtotal
        elif item.tipo_item == ItemPresupuesto.TipoItem.REPUESTO:
            repuestos += item.subtotal

    rubros = presupuesto.rubros_importes or {}
    incluir_repuestos_en_total = bool(rubros.get("incluir_repuestos_en_total", False))

    if presupuesto.tipo == Presupuesto.Tipo.PARTICULAR and rubros.get("total_final") is not None:
        # En talonario particular puede aplicarse descuento en efectivo (ej.: -10% En Efectivo)
        presupuesto.monto_mano_obra = _to_decimal(rubros.get("mano_obra", mano_obra))
        presupuesto.monto_repuestos = _to_decimal(rubros.get("repuestos", repuestos))
        presupuesto.monto_total = _to_decimal(rubros.get("total_final"))
    elif presupuesto.tipo == Presupuesto.Tipo.ASEGURADORA:
        presupuesto.monto_mano_obra = mano_obra
        if incluir_repuestos_en_total:
            presupuesto.monto_repuestos = repuestos
            presupuesto.monto_total = mano_obra + repuestos
        else:
            # HU-006 Criterio 2 por defecto: repuestos provistos por la aseguradora = 0 a facturar por mano de obra
            presupuesto.monto_repuestos = Decimal("0.00")
            presupuesto.monto_total = mano_obra
    else:
        presupuesto.monto_mano_obra = mano_obra
        presupuesto.monto_repuestos = repuestos
        presupuesto.monto_total = mano_obra + repuestos

    presupuesto.save(
        update_fields=["monto_mano_obra", "monto_repuestos", "monto_total"]
    )

    if hasattr(presupuesto, "orden_trabajo"):
        ot = presupuesto.orden_trabajo
        diff = presupuesto.monto_total - ot.monto_total
        ot.monto_total = presupuesto.monto_total
        ot.saldo_pendiente = max(Decimal("0.00"), ot.saldo_pendiente + diff)
        ot.save(update_fields=["monto_total", "saldo_pendiente"])

    return presupuesto


@transaction.atomic
def sync_budget_items(presupuesto: Presupuesto, items_data: list) -> Presupuesto:
    """Reemplaza la lista de ítems de un presupuesto y recalcula totales."""
    presupuesto.items.all().delete()
    for idx_data in items_data:
        cantidad = int(idx_data.get("cantidad", 1))
        if cantidad < 1:
            raise ValidationError("La cantidad de cada ítem debe ser al menos 1.")
        precio_unitario = Decimal(str(idx_data.get("precio_unitario", "0.00")))
        if precio_unitario < Decimal("0.00"):
            raise ValidationError("El precio unitario no puede ser negativo.")

        ItemPresupuesto.objects.create(
            presupuesto=presupuesto,
            descripcion=(idx_data.get("descripcion") or "").strip(),
            tipo_item=idx_data.get("tipo_item", ItemPresupuesto.TipoItem.MANO_OBRA_CHAPA),
            cantidad=cantidad,
            precio_unitario=precio_unitario,
        )

    return recalculate_budget_totals(presupuesto)


@transaction.atomic
def emitir_presupuesto(presupuesto: Presupuesto) -> Presupuesto:
    """
    HU-005 Criterios 2 y 3:
    - Bloquea la emisión si no posee ítems cargados o si el monto total es <= 0.
    - Asigna estado "emitido" (salvo que ya tenga OT aprobada), registra fecha_emision = hoy y calcula fecha_vencimiento (+15 días).
    """
    presupuesto = recalculate_budget_totals(presupuesto)

    validate_budget_modality_rules(
        tipo=presupuesto.tipo,
        compania=presupuesto.compania,
        nro_siniestro=presupuesto.nro_siniestro,
        nombre_perito=presupuesto.nombre_perito,
    )

    if presupuesto.items.count() == 0 or presupuesto.monto_total <= Decimal("0.00"):
        raise ValidationError(
            "No se puede emitir un presupuesto sin detalle o con importe total en cero. "
            "Ingrese el detalle e importe de la cotización."
        )

    if presupuesto.estado == Presupuesto.Estado.APROBADO:
        return presupuesto

    fecha_base = presupuesto.fecha_emision or date.today()
    fecha_venc = fecha_base + timedelta(days=VALIDEZ_PRESUPUESTO_DIAS)
    presupuesto.fecha_emision = fecha_base
    presupuesto.fecha_vencimiento = fecha_venc
    if fecha_venc < date.today():
        presupuesto.estado = Presupuesto.Estado.RECHAZADO
    else:
        presupuesto.estado = Presupuesto.Estado.EMITIDO
    presupuesto.save(update_fields=["estado", "fecha_emision", "fecha_vencimiento"])
    return presupuesto


def _generate_next_ot_code() -> str:
    """Genera un código único correlativo del tipo OT-2026-001."""
    year = date.today().year
    last_ot = OrdenDeTrabajo.objects.order_by("-id_orden").first()
    next_num = (last_ot.id_orden + 1) if last_ot else 1
    return f"OT-{year}-{next_num:03d}"


@transaction.atomic
def aprobar_presupuesto_y_crear_ot(
    *,
    presupuesto: Presupuesto,
    fecha_estimada_entrega: date,
    nro_orden_aseguradora: str = "",
    nro_siniestro: str = "",
    nombre_perito: str = "",
    fecha_ingreso: date = None,
    id_cliente: int | None = None,
    id_vehiculo: int | None = None,
    nuevo_cliente: dict | None = None,
    nuevo_vehiculo: dict | None = None,
) -> OrdenDeTrabajo:
    """
    HU-007 Criterios 1, 2 y 3:
    1. Valida relación 1:1 (bloquea si ya tiene OT o si está Rechazado/Vencido).
    2. Exige que el presupuesto esté en estado "emitido".
    3. Si el presupuesto fue emitido sin empadronar Cliente/Vehículo, permite crearlos
       o vincularlos en el mismo acto de aprobación.
    4. Cambia estado del presupuesto a "aprobado".
    5. Crea automáticamente la OrdenDeTrabajo con saldo_pendiente = monto_total.
    6. Inicializa en FaseReparacion las 8 fases operativas del taller ordenadas secuencialmente del 1 al 8.
    """
    presupuesto = Presupuesto.objects.select_for_update().get(pk=presupuesto.pk)

    if hasattr(presupuesto, "orden_trabajo"):
        raise ValidationError(
            f"Este presupuesto ya posee la Orden de Trabajo asociada {presupuesto.orden_trabajo.codigo_seguimiento} (relación 1 a 1)."
        )

    if presupuesto.estado in (Presupuesto.Estado.RECHAZADO, Presupuesto.Estado.VENCIDO):
        raise ValidationError(
            f"No es posible aprobar ni generar una Orden de Trabajo sobre un presupuesto en estado '{presupuesto.estado}'."
        )

    if presupuesto.estado != Presupuesto.Estado.EMITIDO:
        raise ValidationError(
            "El presupuesto debe encontrarse en estado 'Emitido' antes de poder registrarse su aprobación."
        )

    ingreso = fecha_ingreso or date.today()
    if fecha_estimada_entrega < ingreso:
        raise ValidationError(
            {"fecha_estimada_entrega": "La fecha estimada de entrega no puede ser anterior a la fecha de ingreso."}
        )

    # Resolución / alta en el acto del Cliente si el presupuesto aún no tenía cliente vinculado
    cliente_obj = presupuesto.cliente
    if id_cliente:
        cliente_obj = Cliente.objects.filter(pk=id_cliente).first()
        if not cliente_obj:
            raise ValidationError({"id_cliente": "El cliente seleccionado no existe."})
    elif nuevo_cliente:
        dni_clean = (nuevo_cliente.get("dni") or "").strip()
        if not dni_clean:
            raise ValidationError({"nuevo_cliente": "El DNI del cliente es obligatorio para darlo de alta."})
        cliente_obj, created = Cliente.objects.get_or_create(
            dni=dni_clean,
            defaults={
                "nombre": (nuevo_cliente.get("nombre") or "").strip(),
                "apellido": (nuevo_cliente.get("apellido") or "").strip(),
                "telefono": (nuevo_cliente.get("telefono") or "").strip(),
                "email": (nuevo_cliente.get("email") or "").strip(),
                "direccion": (nuevo_cliente.get("direccion") or "").strip(),
                "activo": True,
            },
        )
        if not created:
            cliente_obj.nombre = (nuevo_cliente.get("nombre") or cliente_obj.nombre).strip()
            cliente_obj.apellido = (nuevo_cliente.get("apellido") or cliente_obj.apellido).strip()
            cliente_obj.telefono = (nuevo_cliente.get("telefono") or cliente_obj.telefono).strip()
            if nuevo_cliente.get("direccion"):
                cliente_obj.direccion = nuevo_cliente["direccion"].strip()
            if nuevo_cliente.get("email"):
                cliente_obj.email = nuevo_cliente["email"].strip()
            cliente_obj.activo = True
            cliente_obj.save()

    # Resolución / alta en el acto del Vehículo si el presupuesto aún no tenía vehículo vinculado
    vehiculo_obj = presupuesto.vehiculo
    if id_vehiculo:
        vehiculo_obj = Vehiculo.objects.filter(pk=id_vehiculo).first()
        if not vehiculo_obj:
            raise ValidationError({"id_vehiculo": "El vehículo seleccionado no existe."})
        if not cliente_obj:
            cliente_obj = vehiculo_obj.cliente
    elif nuevo_vehiculo:
        if not cliente_obj:
            raise ValidationError(
                {"cliente": "Para registrar el vehículo nuevo al aprobar el presupuesto debe indicar o crear su cliente titular."}
            )
        pat_clean = (nuevo_vehiculo.get("patente") or "").upper().replace(" ", "").replace("-", "")
        if not pat_clean:
            raise ValidationError({"nuevo_vehiculo": "La patente del vehículo es obligatoria."})
        vehiculo_obj, created = Vehiculo.objects.get_or_create(
            patente=pat_clean,
            defaults={
                "marca": (nuevo_vehiculo.get("marca") or "").strip(),
                "modelo": (nuevo_vehiculo.get("modelo") or "").strip(),
                "anio": int(nuevo_vehiculo.get("anio") or date.today().year),
                "color": (nuevo_vehiculo.get("color") or "").strip(),
                "cliente": cliente_obj,
            },
        )
        if not created:
            vehiculo_obj.marca = (nuevo_vehiculo.get("marca") or vehiculo_obj.marca).strip()
            vehiculo_obj.modelo = (nuevo_vehiculo.get("modelo") or vehiculo_obj.modelo).strip()
            if nuevo_vehiculo.get("anio"):
                vehiculo_obj.anio = int(nuevo_vehiculo["anio"])
            if nuevo_vehiculo.get("color"):
                vehiculo_obj.color = nuevo_vehiculo["color"].strip()
            vehiculo_obj.cliente = cliente_obj
            vehiculo_obj.save()

    if not cliente_obj or not vehiculo_obj:
        raise ValidationError(
            {
                "detail": (
                    "Como el presupuesto fue aceptado, es necesario completar los datos del Cliente "
                    "y del Vehículo para crearlos y abrir la Orden de Trabajo."
                )
            }
        )

    presupuesto.cliente = cliente_obj
    presupuesto.vehiculo = vehiculo_obj
    if (nro_siniestro or "").strip():
        presupuesto.nro_siniestro = nro_siniestro.strip()
    if (nombre_perito or "").strip():
        presupuesto.nombre_perito = nombre_perito.strip()
    presupuesto.estado = Presupuesto.Estado.APROBADO
    presupuesto.save(update_fields=["cliente", "vehiculo", "nro_siniestro", "nombre_perito", "estado"])

    orden = OrdenDeTrabajo.objects.create(
        codigo_seguimiento=_generate_next_ot_code(),
        fecha_ingreso=ingreso,
        fecha_estimada_entrega=fecha_estimada_entrega,
        tipo_cliente=presupuesto.tipo,
        nro_orden_aseguradora=(nro_orden_aseguradora or "").strip(),
        estado_actual="Recepción",
        monto_total=presupuesto.monto_total,
        saldo_pendiente=presupuesto.monto_total,
        vehiculo=vehiculo_obj,
        compania=presupuesto.compania if presupuesto.tipo == Presupuesto.Tipo.ASEGURADORA else None,
        presupuesto=presupuesto,
    )

    fases_a_crear = [
        FaseReparacion(
            orden=orden,
            numero_secuencia=num_sec,
            nombre_fase=nombre_fase,
            estado=FaseReparacion.EstadoFase.PENDIENTE,
        )
        for num_sec, nombre_fase in FASES_TALLER_DEFINICION
    ]
    FaseReparacion.objects.bulk_create(fases_a_crear)

    return orden


@transaction.atomic
def rechazar_presupuesto(presupuesto: Presupuesto, observaciones: str = "") -> Presupuesto:
    """HU-007: Permite registrar el rechazo de un presupuesto emitido."""
    if hasattr(presupuesto, "orden_trabajo"):
        raise ValidationError("No se puede rechazar un presupuesto que ya tiene una Orden de Trabajo generada.")
    if presupuesto.estado != Presupuesto.Estado.EMITIDO:
        raise ValidationError("Solo se pueden marcar como rechazados los presupuestos en estado 'Emitido'.")

    presupuesto.estado = Presupuesto.Estado.RECHAZADO
    if observaciones:
        presupuesto.observaciones = observaciones.strip()
    presupuesto.save(update_fields=["estado", "observaciones"])
    return presupuesto


@transaction.atomic
def eliminar_presupuesto(presupuesto: Presupuesto) -> dict:
    """
    Elimina un Presupuesto de forma segura. Si tenía una Orden de Trabajo asociada,
    limpia primero sus registros dependientes para evitar bloqueos por clave foránea.
    """
    pres_id = presupuesto.id_presupuesto
    if hasattr(presupuesto, "orden_trabajo"):
        ot = presupuesto.orden_trabajo
        ot.movimientos_financieros.all().delete()
        ot.cuentas_por_cobrar.all().delete()
        ot.movimientos_stock.all().delete()
        ot.turnos.all().delete()
        ot.delete()
    presupuesto.delete()
    return {"detail": f"Presupuesto #{pres_id:04d} eliminado correctamente."}
