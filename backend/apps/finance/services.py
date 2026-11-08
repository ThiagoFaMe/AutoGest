"""
Servicios de dominio transaccionales para el módulo Financiero, Cuentas por Cobrar y Dashboard de KPIs:
- HU-013 Criterio 1: Emisión de factura y creación automática de CuentaPorCobrar calculando
                     fecha_vencimiento = fecha_emision + plazo_pago_dias.
- HU-013 Criterio 2: Evaluación dinámica y actualización automática a 'vencida_en_mora' cuando
                     saldo_pendiente > 0 y Fecha Actual > fecha_vencimiento, calculando días de mora.
- HU-013 Criterio 3 y HU-014 Criterio 1: Registro de cobros (efectivo, transferencia, e-cheq)
                     validando que monto <= saldo_pendiente y recalculando estados ('pago_parcial', 'cancelada').
- HU-014 Criterio 2: Registro de egresos operativos y pagos a proveedores.
- HU-014 Criterio 3: Cálculo en tiempo real de los 6 KPIs del Dashboard Principal (Prototipo 1).
"""
from datetime import date, timedelta
from decimal import Decimal
from django.db import transaction
from django.db.models import Count, F, Sum
from django.db.models.functions import Coalesce
from rest_framework.exceptions import ValidationError

from apps.budgets.models import Presupuesto
from apps.inventory.models import InsumoRepuesto
from apps.workorders.models import FASES_TALLER_DEFINICION, FaseReparacion, OrdenDeTrabajo
from .models import CuentaPorCobrar, MovimientoFinanciero


def sincronizar_estados_mora_cuentas() -> int:
    """
    HU-013 Criterio 2:
    Revisa todas las cuentas con saldo_pendiente > 0 cuya fecha_vencimiento sea anterior
    a hoy (Fecha Actual > Fecha de Vencimiento) y actualiza su estado a 'vencida_en_mora'.
    """
    hoy = date.today()
    actualizadas = (
        CuentaPorCobrar.objects.filter(
            saldo_pendiente__gt=Decimal("0.00"),
            fecha_vencimiento__lt=hoy,
        )
        .exclude(estado_cobranza=CuentaPorCobrar.EstadoCobranza.VENCIDA_EN_MORA)
        .update(estado_cobranza=CuentaPorCobrar.EstadoCobranza.VENCIDA_EN_MORA)
    )
    return actualizadas


@transaction.atomic
def emitir_factura_cuenta_por_cobrar(
    *,
    orden: OrdenDeTrabajo,
    nro_factura: str,
    fecha_emision: date | None = None,
    monto_facturado: Decimal | None = None,
) -> CuentaPorCobrar:
    """
    HU-013 Criterio 1 y HU-004 Criterio 3:
    Crea un registro en CuentaPorCobrar para una Orden de Trabajo, tomando automáticamente
    el plazo_pago_dias de la compañía aseguradora (o 30 días por defecto si es particular)
    para calcular:
      fecha_vencimiento = fecha_emision + timedelta(days=plazo_pago_dias)
      saldo_pendiente = monto_facturado
    """
    nro_clean = (nro_factura or "").strip().upper()
    if not nro_clean:
        raise ValidationError({"nro_factura": "El número de factura es obligatorio."})

    if CuentaPorCobrar.objects.filter(nro_factura__iexact=nro_clean).exists():
        raise ValidationError(
            {
                "nro_factura": f"Ya existe una factura registrada con el comprobante '{nro_clean}'."
            }
        )

    fecha_emi = fecha_emision or date.today()
    monto_fac = (
        Decimal(str(monto_facturado)).quantize(Decimal("0.01"))
        if monto_facturado is not None
        else orden.monto_total
    )

    if monto_fac <= Decimal("0.00"):
        raise ValidationError(
            {"monto_facturado": "El monto facturado debe ser mayor a cero."}
        )

    plazo_dias = 30
    if orden.compania and orden.compania.plazo_pago_dias:
        plazo_dias = int(orden.compania.plazo_pago_dias)

    fecha_venc = fecha_emi + timedelta(days=plazo_dias)

    estado_inicial = CuentaPorCobrar.EstadoCobranza.PENDIENTE_EN_PLAZO
    if date.today() > fecha_venc:
        estado_inicial = CuentaPorCobrar.EstadoCobranza.VENCIDA_EN_MORA

    cuenta = CuentaPorCobrar.objects.create(
        orden=orden,
        compania=orden.compania,
        nro_factura=nro_clean,
        fecha_emision=fecha_emi,
        fecha_vencimiento=fecha_venc,
        monto_facturado=monto_fac,
        monto_cobrado=Decimal("0.00"),
        saldo_pendiente=monto_fac,
        estado_cobranza=estado_inicial,
    )
    return cuenta


@transaction.atomic
def registrar_movimiento_financiero(
    *,
    tipo: str,
    categoria: str,
    concepto: str,
    monto: Decimal,
    medio_pago: str,
    usuario,
    fecha: date | None = None,
    orden: OrdenDeTrabajo | None = None,
    cuenta: CuentaPorCobrar | None = None,
) -> dict:
    """
    HU-013 Criterio 3 y HU-014 Criterios 1 y 2:
    - Si es 'ingreso' vinculado a una CuentaPorCobrar u OrdenDeTrabajo:
      valida que monto <= saldo_pendiente (impidiendo sobrecobros), actualiza
      monto_cobrado, saldo_pendiente y estado_cobranza ('pago_parcial', 'vencida_en_mora' o 'cancelada'),
      y descuenta también el saldo_pendiente de la OrdenDeTrabajo asociada.
    - Si es 'egreso', registra el movimiento de salida impactando en el Flujo de Caja Neto.
    """
    monto_dec = Decimal(str(monto or "0")).quantize(Decimal("0.01"))
    if monto_dec <= Decimal("0.00"):
        raise ValidationError(
            {"monto": "El importe del movimiento financiero debe ser mayor a cero."}
        )

    concepto_clean = (concepto or "").strip()
    if not concepto_clean:
        raise ValidationError(
            {"concepto": "El concepto o descripción del movimiento es obligatorio."}
        )

    fecha_mov = fecha or date.today()
    cuenta_actualizada = None
    orden_actualizada = orden

    if tipo == MovimientoFinanciero.TipoFlujo.INGRESO:
        if cuenta is not None:
            cuenta_locked = CuentaPorCobrar.objects.select_for_update().get(
                pk=cuenta.pk
            )
            if monto_dec > cuenta_locked.saldo_pendiente:
                raise ValidationError(
                    {
                        "detail": (
                            f"El importe a cobrar (${monto_dec}) supera el saldo pendiente de la "
                            f"Factura {cuenta_locked.nro_factura} (${cuenta_locked.saldo_pendiente})."
                        )
                    }
                )

            cuenta_locked.monto_cobrado = (
                cuenta_locked.monto_cobrado + monto_dec
            ).quantize(Decimal("0.01"))
            cuenta_locked.saldo_pendiente = (
                cuenta_locked.monto_facturado - cuenta_locked.monto_cobrado
            ).quantize(Decimal("0.01"))

            if cuenta_locked.saldo_pendiente == Decimal("0.00"):
                cuenta_locked.estado_cobranza = (
                    CuentaPorCobrar.EstadoCobranza.CANCELADA
                )
            elif date.today() > cuenta_locked.fecha_vencimiento:
                cuenta_locked.estado_cobranza = (
                    CuentaPorCobrar.EstadoCobranza.VENCIDA_EN_MORA
                )
            else:
                cuenta_locked.estado_cobranza = (
                    CuentaPorCobrar.EstadoCobranza.PAGO_PARCIAL
                )
            cuenta_locked.save(
                update_fields=[
                    "monto_cobrado",
                    "saldo_pendiente",
                    "estado_cobranza",
                ]
            )
            cuenta_actualizada = cuenta_locked

            # Sincronizamos también el saldo pendiente de la OrdenDeTrabajo asociada
            orden_actualizada = OrdenDeTrabajo.objects.select_for_update().get(
                pk=cuenta_locked.orden_id
            )
            nuevo_saldo_ot = max(
                Decimal("0.00"), orden_actualizada.saldo_pendiente - monto_dec
            ).quantize(Decimal("0.01"))
            orden_actualizada.saldo_pendiente = nuevo_saldo_ot
            orden_actualizada.save(update_fields=["saldo_pendiente"])

        elif orden is not None:
            orden_locked = OrdenDeTrabajo.objects.select_for_update().get(
                pk=orden.pk
            )
            if monto_dec > orden_locked.saldo_pendiente:
                raise ValidationError(
                    {
                        "detail": (
                            f"El importe a cobrar (${monto_dec}) supera el saldo pendiente de la "
                            f"Orden {orden_locked.codigo_seguimiento} (${orden_locked.saldo_pendiente})."
                        )
                    }
                )
            orden_locked.saldo_pendiente = (
                orden_locked.saldo_pendiente - monto_dec
            ).quantize(Decimal("0.01"))
            orden_locked.save(update_fields=["saldo_pendiente"])
            orden_actualizada = orden_locked

    movimiento = MovimientoFinanciero.objects.create(
        fecha=fecha_mov,
        tipo=tipo,
        categoria=categoria,
        concepto=concepto_clean[:120],
        monto=monto_dec,
        medio_pago=medio_pago,
        orden=orden_actualizada,
        cuenta=cuenta_actualizada,
        usuario=usuario,
    )

    return {
        "detail": (
            f"Movimiento financiero ({tipo.upper()}) por ${monto_dec} "
            f"registrado exitosamente mediante {medio_pago}."
        ),
        "movimiento": movimiento,
        "cuenta": cuenta_actualizada,
        "orden": orden_actualizada,
    }


def _recalcular_estado_cuenta(cuenta_locked: CuentaPorCobrar):
    if cuenta_locked.saldo_pendiente <= Decimal("0.00"):
        cuenta_locked.saldo_pendiente = Decimal("0.00")
        cuenta_locked.estado_cobranza = CuentaPorCobrar.EstadoCobranza.CANCELADA
    elif date.today() > cuenta_locked.fecha_vencimiento:
        cuenta_locked.estado_cobranza = CuentaPorCobrar.EstadoCobranza.VENCIDA_EN_MORA
    elif cuenta_locked.monto_cobrado > Decimal("0.00"):
        cuenta_locked.estado_cobranza = CuentaPorCobrar.EstadoCobranza.PAGO_PARCIAL
    else:
        cuenta_locked.estado_cobranza = CuentaPorCobrar.EstadoCobranza.PENDIENTE_EN_PLAZO


@transaction.atomic
def actualizar_movimiento_financiero(
    *,
    movimiento: MovimientoFinanciero,
    tipo: str | None = None,
    categoria: str | None = None,
    concepto: str | None = None,
    monto: Decimal | None = None,
    medio_pago: str | None = None,
    fecha: date | None = None,
) -> dict:
    """
    Actualiza un MovimientoFinanciero existente (ingreso o egreso).
    Si el movimiento estaba vinculado a una CuentaPorCobrar u OrdenDeTrabajo,
    revierte el importe anterior y aplica el nuevo importe recalculando saldos y estados.
    """
    mov = MovimientoFinanciero.objects.select_for_update().get(pk=movimiento.pk)
    old_tipo = mov.tipo
    old_monto = mov.monto

    new_tipo = tipo if tipo is not None else mov.tipo
    new_categoria = (categoria if categoria is not None else mov.categoria).strip()
    new_concepto = (concepto if concepto is not None else mov.concepto).strip()
    new_medio_pago = medio_pago if medio_pago is not None else mov.medio_pago
    new_fecha = fecha if fecha is not None else mov.fecha
    new_monto = (
        Decimal(str(monto)).quantize(Decimal("0.01"))
        if monto is not None
        else mov.monto
    )

    if new_monto <= Decimal("0.00"):
        raise ValidationError({"monto": "El importe del movimiento financiero debe ser mayor a cero."})
    if not new_concepto:
        raise ValidationError({"concepto": "El concepto o descripción del movimiento es obligatorio."})

    cuenta_locked = None
    orden_locked = None

    if mov.cuenta_id:
        cuenta_locked = CuentaPorCobrar.objects.select_for_update().get(pk=mov.cuenta_id)
        orden_locked = OrdenDeTrabajo.objects.select_for_update().get(pk=cuenta_locked.orden_id)
    elif mov.orden_id:
        orden_locked = OrdenDeTrabajo.objects.select_for_update().get(pk=mov.orden_id)

    # 1) Si antes era un INGRESO vinculado, revertimos su impacto previo antes de aplicar el nuevo
    if old_tipo == MovimientoFinanciero.TipoFlujo.INGRESO:
        if cuenta_locked is not None:
            cuenta_locked.monto_cobrado = max(
                Decimal("0.00"), cuenta_locked.monto_cobrado - old_monto
            ).quantize(Decimal("0.01"))
            cuenta_locked.saldo_pendiente = (
                cuenta_locked.monto_facturado - cuenta_locked.monto_cobrado
            ).quantize(Decimal("0.01"))
        if orden_locked is not None:
            orden_locked.saldo_pendiente = min(
                orden_locked.monto_total, orden_locked.saldo_pendiente + old_monto
            ).quantize(Decimal("0.01"))

    # 2) Si el nuevo estado es INGRESO vinculado, aplicamos el nuevo importe validando tope
    if new_tipo == MovimientoFinanciero.TipoFlujo.INGRESO:
        if cuenta_locked is not None:
            if new_monto > cuenta_locked.saldo_pendiente:
                raise ValidationError(
                    {
                        "detail": (
                            f"El nuevo importe (${new_monto}) supera el saldo disponible de la "
                            f"Factura {cuenta_locked.nro_factura} (${cuenta_locked.saldo_pendiente})."
                        )
                    }
                )
            cuenta_locked.monto_cobrado = (
                cuenta_locked.monto_cobrado + new_monto
            ).quantize(Decimal("0.01"))
            cuenta_locked.saldo_pendiente = (
                cuenta_locked.monto_facturado - cuenta_locked.monto_cobrado
            ).quantize(Decimal("0.01"))
            _recalcular_estado_cuenta(cuenta_locked)
            cuenta_locked.save(
                update_fields=["monto_cobrado", "saldo_pendiente", "estado_cobranza"]
            )
            if orden_locked is not None:
                orden_locked.saldo_pendiente = max(
                    Decimal("0.00"), orden_locked.saldo_pendiente - new_monto
                ).quantize(Decimal("0.01"))
                orden_locked.save(update_fields=["saldo_pendiente"])
        elif orden_locked is not None:
            if new_monto > orden_locked.saldo_pendiente:
                raise ValidationError(
                    {
                        "detail": (
                            f"El nuevo importe (${new_monto}) supera el saldo disponible de la "
                            f"Orden {orden_locked.codigo_seguimiento} (${orden_locked.saldo_pendiente})."
                        )
                    }
                )
            orden_locked.saldo_pendiente = (
                orden_locked.saldo_pendiente - new_monto
            ).quantize(Decimal("0.01"))
            orden_locked.save(update_fields=["saldo_pendiente"])
    else:
        # Si pasó de ingreso a egreso y tenía cuenta/orden, guardamos la reversión
        if cuenta_locked is not None:
            _recalcular_estado_cuenta(cuenta_locked)
            cuenta_locked.save(
                update_fields=["monto_cobrado", "saldo_pendiente", "estado_cobranza"]
            )
        if orden_locked is not None:
            orden_locked.save(update_fields=["saldo_pendiente"])

    mov.tipo = new_tipo
    mov.categoria = new_categoria[:30]
    mov.concepto = new_concepto[:120]
    mov.monto = new_monto
    mov.medio_pago = new_medio_pago
    mov.fecha = new_fecha
    mov.save()

    return {
        "detail": f"Movimiento financiero #{mov.id_movimiento} actualizado correctamente (${new_monto}).",
        "movimiento": mov,
        "cuenta": cuenta_locked,
    }


@transaction.atomic
def eliminar_movimiento_financiero(*, movimiento: MovimientoFinanciero) -> dict:
    """
    Elimina un MovimientoFinanciero y revierte su impacto en CuentaPorCobrar / OrdenDeTrabajo si correspondía.
    """
    mov = MovimientoFinanciero.objects.select_for_update().get(pk=movimiento.pk)
    if mov.tipo == MovimientoFinanciero.TipoFlujo.INGRESO:
        if mov.cuenta_id:
            cuenta_locked = CuentaPorCobrar.objects.select_for_update().get(pk=mov.cuenta_id)
            cuenta_locked.monto_cobrado = max(
                Decimal("0.00"), cuenta_locked.monto_cobrado - mov.monto
            ).quantize(Decimal("0.01"))
            cuenta_locked.saldo_pendiente = (
                cuenta_locked.monto_facturado - cuenta_locked.monto_cobrado
            ).quantize(Decimal("0.01"))
            _recalcular_estado_cuenta(cuenta_locked)
            cuenta_locked.save(
                update_fields=["monto_cobrado", "saldo_pendiente", "estado_cobranza"]
            )
            orden_locked = OrdenDeTrabajo.objects.select_for_update().get(pk=cuenta_locked.orden_id)
            orden_locked.saldo_pendiente = min(
                orden_locked.monto_total, orden_locked.saldo_pendiente + mov.monto
            ).quantize(Decimal("0.01"))
            orden_locked.save(update_fields=["saldo_pendiente"])
        elif mov.orden_id:
            orden_locked = OrdenDeTrabajo.objects.select_for_update().get(pk=mov.orden_id)
            orden_locked.saldo_pendiente = min(
                orden_locked.monto_total, orden_locked.saldo_pendiente + mov.monto
            ).quantize(Decimal("0.01"))
            orden_locked.save(update_fields=["saldo_pendiente"])

    mov_id = mov.id_movimiento
    mov.delete()
    return {"detail": f"Movimiento financiero #{mov_id} eliminado correctamente."}


def calcular_kpis_dashboard() -> dict:
    """
    HU-014 Criterio 3 (Prototipo 1 – Dashboard Principal):
    Calcula en tiempo real los 6 indicadores clave sobre PostgreSQL:
    (a) Vehículos actualmente en taller y distribución por cada una de las 8 fases operativas.
    (b) Tiempo promedio real de ciclo de reparación y tiempo promedio por fase.
    (c) Tasa de conversión de presupuestos (Presupuestos Aprobados / Presupuestos Emitidos_Totales * 100).
    (d) Ingresos cobrados vs. egresos del período (Flujo de Caja Neto).
    (e) Monto total de deuda pendiente de aseguradoras discriminando cartera en plazo y cartera vencida en mora.
    (f) Cantidad de insumos en alerta de stock mínimo.
    """
    sincronizar_estados_mora_cuentas()

    # (a) Vehículos en taller y distribución por fase
    ordenes_activas_qs = OrdenDeTrabajo.objects.filter(
        fecha_entrega_real__isnull=True
    )
    vehiculos_en_taller = ordenes_activas_qs.count()
    vehiculos_en_retraso = ordenes_activas_qs.filter(
        fecha_estimada_entrega__lt=date.today()
    ).count()

    distribucion_fases = []
    for seq, nombre_fase in FASES_TALLER_DEFINICION:
        cant = ordenes_activas_qs.filter(
            estado_actual__iexact=nombre_fase
        ).count()
        distribucion_fases.append(
            {
                "numero_secuencia": seq,
                "nombre_fase": nombre_fase,
                "cantidad_vehiculos": cant,
            }
        )

    # (b) Tiempo promedio de ciclo de reparación (órdenes entregadas y ciclo activo)
    ordenes_entregadas = list(
        OrdenDeTrabajo.objects.filter(fecha_entrega_real__isnull=False)
    )
    if ordenes_entregadas:
        dias_lista = [
            max(1, (o.fecha_entrega_real - o.fecha_ingreso).days)
            for o in ordenes_entregadas
        ]
        tiempo_promedio_ciclo_dias = round(sum(dias_lista) / len(dias_lista), 1)
    else:
        activas_lista = list(ordenes_activas_qs)
        if activas_lista:
            dias_act = [
                max(1, (date.today() - o.fecha_ingreso).days)
                for o in activas_lista
            ]
            tiempo_promedio_ciclo_dias = round(sum(dias_act) / len(dias_act), 1)
        else:
            tiempo_promedio_ciclo_dias = 0.0

    fases_completadas_qs = FaseReparacion.objects.filter(
        estado=FaseReparacion.EstadoFase.COMPLETADA,
        fecha_inicio__isnull=False,
        fecha_fin__isnull=False,
    )
    horas_fases = [
        max(0.1, (f.fecha_fin - f.fecha_inicio).total_seconds() / 3600.0)
        for f in fases_completadas_qs
    ]
    tiempo_promedio_fase_horas = (
        round(sum(horas_fases) / len(horas_fases), 1) if horas_fases else 0.0
    )

    # (c) Tasa de conversión de presupuestos
    presupuestos_no_borrador = Presupuesto.objects.exclude(
        estado=Presupuesto.Estado.BORRADOR
    ).count()
    presupuestos_aprobados = Presupuesto.objects.filter(
        estado=Presupuesto.Estado.APROBADO
    ).count()
    presupuestos_pendientes = Presupuesto.objects.filter(
        estado=Presupuesto.Estado.EMITIDO
    ).count()
    tasa_conversion_presupuestos = (
        round((presupuestos_aprobados / presupuestos_no_borrador) * 100.0, 1)
        if presupuestos_no_borrador > 0
        else 0.0
    )

    # (d) Flujo de Caja: Ingresos vs Egresos y Balance Neto
    ingresos_totales = MovimientoFinanciero.objects.filter(
        tipo=MovimientoFinanciero.TipoFlujo.INGRESO
    ).aggregate(total=Coalesce(Sum("monto"), Decimal("0.00")))["total"]

    egresos_totales = MovimientoFinanciero.objects.filter(
        tipo=MovimientoFinanciero.TipoFlujo.EGRESO
    ).aggregate(total=Coalesce(Sum("monto"), Decimal("0.00")))["total"]

    flujo_caja_neto = (ingresos_totales - egresos_totales).quantize(
        Decimal("0.01")
    )

    # (e) Cartera de Cuentas por Cobrar a Aseguradoras (en plazo vs vencida en mora)
    cuentas_activas = CuentaPorCobrar.objects.filter(
        saldo_pendiente__gt=Decimal("0.00")
    )
    hoy = date.today()
    deuda_en_mora = cuentas_activas.filter(fecha_vencimiento__lt=hoy).aggregate(
        total=Coalesce(Sum("saldo_pendiente"), Decimal("0.00"))
    )["total"]
    deuda_en_plazo = cuentas_activas.filter(
        fecha_vencimiento__gte=hoy
    ).aggregate(total=Coalesce(Sum("saldo_pendiente"), Decimal("0.00")))[
        "total"
    ]
    deuda_total_aseguradoras = (deuda_en_mora + deuda_en_plazo).quantize(
        Decimal("0.01")
    )
    facturas_en_mora_count = cuentas_activas.filter(
        fecha_vencimiento__lt=hoy
    ).count()

    # (f) Insumos en alerta de stock mínimo
    insumos_en_alerta_count = InsumoRepuesto.objects.filter(
        stock_actual__lte=F("stock_minimo")
    ).count()

    return {
        "vehiculos_en_taller": vehiculos_en_taller,
        "vehiculos_en_retraso": vehiculos_en_retraso,
        "distribucion_fases": distribucion_fases,
        "tiempo_promedio_ciclo_dias": tiempo_promedio_ciclo_dias,
        "tiempo_promedio_fase_horas": tiempo_promedio_fase_horas,
        "presupuestos_emitidos_totales": presupuestos_no_borrador,
        "presupuestos_aprobados": presupuestos_aprobados,
        "presupuestos_pendientes": presupuestos_pendientes,
        "tasa_conversion_presupuestos": tasa_conversion_presupuestos,
        "ingresos_totales": str(ingresos_totales.quantize(Decimal("0.01"))),
        "egresos_totales": str(egresos_totales.quantize(Decimal("0.01"))),
        "flujo_caja_neto": str(flujo_caja_neto),
        "deuda_total_aseguradoras": str(deuda_total_aseguradoras),
        "deuda_en_plazo": str(deuda_en_plazo.quantize(Decimal("0.01"))),
        "deuda_en_mora": str(deuda_en_mora.quantize(Decimal("0.01"))),
        "facturas_en_mora_count": facturas_en_mora_count,
        "insumos_en_alerta_count": insumos_en_alerta_count,
    }
