"""
Capa de servicios y reglas de negocio para Presupuestos y Apertura de OT (HU-005, HU-006, HU-007).
"""
from datetime import date, timedelta
from decimal import Decimal
from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.workorders.models import FASES_TALLER_DEFINICION, FaseReparacion, OrdenDeTrabajo
from .models import ItemPresupuesto, Presupuesto

VALIDEZ_PRESUPUESTO_DIAS = 15


def validate_budget_modality_rules(
    *, tipo: str, compania, nro_siniestro: str, nombre_perito: str
):
    """
    HU-006 Criterio 1:
    Si el tipo es "aseguradora", exige obligatoriamente seleccionar la compañía aseguradora,
    ingresar el número de siniestro y el nombre del perito liquidador.
    """
    if tipo == Presupuesto.Tipo.ASEGURADORA:
        missing = []
        if not compania:
            missing.append("compañía aseguradora")
        if not (nro_siniestro or "").strip():
            missing.append("número de siniestro")
        if not (nombre_perito or "").strip():
            missing.append("nombre del perito liquidador")
        if missing:
            raise ValidationError(
                {
                    "modalidad_aseguradora": (
                        f"Para presupuestos de Compañía Aseguradora es obligatorio indicar: {', '.join(missing)}."
                    )
                }
            )


@transaction.atomic
def recalculate_budget_totals(presupuesto: Presupuesto) -> Presupuesto:
    """
    HU-005 Criterio 1 y HU-006 Criterio 2:
    - Recalcula el subtotal de cada línea (Cantidad * Precio Unitario).
    - Calcula monto_mano_obra (suma de mano_obra_chapa + mano_obra_pintura).
    - Si es Particular: suma monto_repuestos y calcula monto_total = monto_mano_obra + monto_repuestos.
    - Si es Aseguradora: computa dentro de monto_total únicamente la mano de obra (monto_repuestos = 0
      a cargo de la aseguradora), permitiendo listar piezas de repuesto como referencia técnica.
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

    presupuesto.monto_mano_obra = mano_obra
    if presupuesto.tipo == Presupuesto.Tipo.ASEGURADORA:
        presupuesto.monto_repuestos = Decimal("0.00")
        presupuesto.monto_total = mano_obra
    else:
        presupuesto.monto_repuestos = repuestos
        presupuesto.monto_total = mano_obra + repuestos

    presupuesto.save(
        update_fields=["monto_mano_obra", "monto_repuestos", "monto_total"]
    )
    return presupuesto


@transaction.atomic
def sync_budget_items(presupuesto: Presupuesto, items_data: list) -> Presupuesto:
    """Reemplaza la lista de ítems de un presupuesto en borrador y recalcula totales."""
    if presupuesto.estado not in (Presupuesto.Estado.BORRADOR, Presupuesto.Estado.EMITIDO):
        raise ValidationError(
            "Solo se pueden modificar los ítems de un presupuesto en estado Borrador o Emitido."
        )

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
    - Asigna estado "emitido", registra fecha_emision = hoy y calcula fecha_vencimiento (+15 días).
    """
    presupuesto = recalculate_budget_totals(presupuesto)

    if presupuesto.estado not in (Presupuesto.Estado.BORRADOR, Presupuesto.Estado.EMITIDO):
        raise ValidationError(
            f"No se puede emitir un presupuesto que ya se encuentra en estado '{presupuesto.estado}'."
        )

    validate_budget_modality_rules(
        tipo=presupuesto.tipo,
        compania=presupuesto.compania,
        nro_siniestro=presupuesto.nro_siniestro,
        nombre_perito=presupuesto.nombre_perito,
    )

    if presupuesto.items.count() == 0 or presupuesto.monto_total <= Decimal("0.00"):
        raise ValidationError(
            "No se puede emitir un presupuesto sin ítems o con importe total en cero. "
            "Incorpore al menos un ítem valorizado."
        )

    hoy = date.today()
    presupuesto.estado = Presupuesto.Estado.EMITIDO
    presupuesto.fecha_emision = hoy
    presupuesto.fecha_vencimiento = hoy + timedelta(days=VALIDEZ_PRESUPUESTO_DIAS)
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
    fecha_ingreso: date = None,
) -> OrdenDeTrabajo:
    """
    HU-007 Criterios 1, 2 y 3:
    1. Valida relación 1:1 (bloquea si ya tiene OT o si está Rechazado/Vencido).
    2. Exige que el presupuesto esté en estado "emitido" (si estaba en borrador con ítems válidos, requiere emisión previa).
    3. Cambia estado del presupuesto a "aprobado".
    4. Crea automáticamente la OrdenDeTrabajo con saldo_pendiente = monto_total.
    5. Inicializa en FaseReparacion las 8 fases operativas del taller ordenadas secuencialmente del 1 al 8.
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

    if presupuesto.tipo == Presupuesto.Tipo.ASEGURADORA and not (nro_orden_aseguradora or "").strip():
        raise ValidationError(
            {"nro_orden_aseguradora": "Para aprobar un presupuesto de aseguradora debe ingresar el número de orden de reparación pericial."}
        )

    ingreso = fecha_ingreso or date.today()
    if fecha_estimada_entrega < ingreso:
        raise ValidationError(
            {"fecha_estimada_entrega": "La fecha estimada de entrega no puede ser anterior a la fecha de ingreso."}
        )

    presupuesto.estado = Presupuesto.Estado.APROBADO
    presupuesto.save(update_fields=["estado"])

    orden = OrdenDeTrabajo.objects.create(
        codigo_seguimiento=_generate_next_ot_code(),
        fecha_ingreso=ingreso,
        fecha_estimada_entrega=fecha_estimada_entrega,
        tipo_cliente=presupuesto.tipo,
        nro_orden_aseguradora=(nro_orden_aseguradora or "").strip(),
        estado_actual="1-Recepción (Lista para iniciar)",
        monto_total=presupuesto.monto_total,
        saldo_pendiente=presupuesto.monto_total,
        vehiculo=presupuesto.vehiculo,
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
