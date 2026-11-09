"""
Servicios de dominio transaccionales para el módulo de Inventario de Pañol y Consumo por OT:
- HU-011: Registro atómico de ingresos de stock por compras y remitos de proveedores,
          actualización de stock_actual y costo_unitario, y desactivación automática de alerta.
- HU-012: Registro atómico de consumo de insumos vinculado a OrdenDeTrabajo activa,
          bloqueo estricto de stock negativo (Cantidad > stock_actual), cálculo del costo
          acumulado de materiales de la orden y disparo de alerta de Stock Mínimo Alcanzado.
"""
from decimal import Decimal
from django.db import transaction
from django.db.models import DecimalField, ExpressionWrapper, F, Sum
from django.db.models.functions import Coalesce
from rest_framework.exceptions import ValidationError

from apps.workorders.models import OrdenDeTrabajo
from .models import InsumoRepuesto, MovimientoStock


@transaction.atomic
def registrar_ingreso_stock(
    *,
    insumo: InsumoRepuesto,
    cantidad: Decimal,
    costo_unitario: Decimal,
    remito_comprobante: str,
    usuario,
) -> dict:
    """
    HU-011 Criterios 1 y 2:
    - Valida cantidad > 0 y número de remito/comprobante obligatorio.
    - Crea el registro en MovimientoStock (tipo='ingreso').
    - Actualiza de forma atómica stock_actual = stock_actual + cantidad y costo_unitario.
    - Si el insumo estaba en alerta por bajo stock y ahora supera stock_minimo,
      desactiva automáticamente la alerta de reposición.
    """
    insumo_locked = InsumoRepuesto.objects.select_for_update().get(
        pk=insumo.pk
    )

    if cantidad is None or Decimal(str(cantidad)) <= Decimal("0"):
        raise ValidationError(
            {"cantidad": "La cantidad ingresada debe ser mayor a cero (> 0)."}
        )

    if costo_unitario is None or Decimal(str(costo_unitario)) < Decimal("0"):
        raise ValidationError(
            {"costo_unitario": "El costo unitario de compra no puede ser negativo."}
        )

    remito_clean = (remito_comprobante or "").strip()
    if not remito_clean:
        raise ValidationError(
            {
                "remito_comprobante": (
                    "Debe indicar el número de remito, factura del proveedor o envío de aseguradora."
                )
            }
        )

    estaba_en_alerta = insumo_locked.en_alerta_stock
    cant_dec = Decimal(str(cantidad)).quantize(Decimal("0.01"))
    costo_dec = Decimal(str(costo_unitario)).quantize(Decimal("0.01"))

    movimiento = MovimientoStock.objects.create(
        insumo=insumo_locked,
        orden=None,
        usuario=usuario,
        tipo_movimiento=MovimientoStock.TipoMovimiento.INGRESO,
        cantidad=cant_dec,
        costo_unitario=costo_dec,
        remito_comprobante=remito_clean,
    )

    insumo_locked.stock_actual = (insumo_locked.stock_actual + cant_dec).quantize(
        Decimal("0.01")
    )
    if costo_dec > Decimal("0.00"):
        insumo_locked.costo_unitario = costo_dec
    insumo_locked.save(update_fields=["stock_actual", "costo_unitario"])

    alerta_desactivada = estaba_en_alerta and not insumo_locked.en_alerta_stock

    detail_msg = (
        f"Ingreso registrado ({remito_clean}): +{cant_dec} {insumo_locked.unidad_medida} "
        f"de '{insumo_locked.nombre}'. Nuevo stock disponible: "
        f"{insumo_locked.stock_actual} {insumo_locked.unidad_medida}."
    )
    if alerta_desactivada:
        detail_msg += " Se desactivó automáticamente la alerta de reposición crítica."

    return {
        "detail": detail_msg,
        "movimiento": movimiento,
        "insumo": insumo_locked,
        "alerta_desactivada": alerta_desactivada,
    }


@transaction.atomic
def registrar_consumo_ot(
    *,
    insumo: InsumoRepuesto,
    orden: OrdenDeTrabajo | None,
    cantidad: Decimal,
    usuario,
    observacion_comprobante: str = "",
) -> dict:
    """
    HU-012 Criterios 1, 2 y 3:
    1. Permite asociar opcionalmente una OrdenDeTrabajo activa (ej. para autopartes o pinturas específicas)
       o registrar un consumo general de taller (ej. cintas, lijas) y bloquea la operación si
       cantidad > stock_actual (impidiendo existencias negativas).
    2. Descuenta automáticamente stock_actual = stock_actual - cantidad, registra
       el MovimientoStock y calcula el costo_unitario vigente.
    3. Si luego del descuento stock_actual <= stock_minimo, dispara alerta inmediata
       de 'Stock Mínimo Alcanzado'.
    """
    if orden is not None and (
        orden.fecha_entrega_real is not None or orden.estado_actual == "Entregada"
    ):
        raise ValidationError(
            {
                "id_orden": (
                    f"La Orden de Trabajo {orden.codigo_seguimiento} ya figura como Entregada "
                    "y no admite nuevos consumos de materiales."
                )
            }
        )

    insumo_locked = InsumoRepuesto.objects.select_for_update().get(
        pk=insumo.pk
    )

    if cantidad is None or Decimal(str(cantidad)) <= Decimal("0"):
        raise ValidationError(
            {"cantidad": "La cantidad a consumir debe ser mayor a cero (> 0)."}
        )

    cant_dec = Decimal(str(cantidad)).quantize(Decimal("0.01"))

    if cant_dec > insumo_locked.stock_actual:
        raise ValidationError(
            {
                "detail": (
                    f"Stock insuficiente para '{insumo_locked.codigo} - {insumo_locked.nombre}'. "
                    f"Solicitado: {cant_dec} {insumo_locked.unidad_medida} | "
                    f"Disponible en pañol: {insumo_locked.stock_actual} {insumo_locked.unidad_medida}."
                )
            }
        )

    costo_vigente = insumo_locked.costo_unitario
    if orden is not None:
        patente_str = orden.vehiculo.patente if orden.vehiculo else "S/P"
        default_ref = f"Consumo en {orden.codigo_seguimiento} ({patente_str})"
    else:
        default_ref = "Consumo general de taller / pañol"

    ref_texto = observacion_comprobante.strip() or default_ref

    movimiento = MovimientoStock.objects.create(
        insumo=insumo_locked,
        orden=orden,
        usuario=usuario,
        tipo_movimiento=MovimientoStock.TipoMovimiento.EGRESO_CONSUMO,
        cantidad=cant_dec,
        costo_unitario=costo_vigente,
        remito_comprobante=ref_texto[:60],
    )

    insumo_locked.stock_actual = (insumo_locked.stock_actual - cant_dec).quantize(
        Decimal("0.01")
    )
    insumo_locked.save(update_fields=["stock_actual"])

    alerta_disparada = insumo_locked.en_alerta_stock

    if orden is not None:
        detail_msg = (
            f"Consumo imputado a {orden.codigo_seguimiento}: -{cant_dec} "
            f"{insumo_locked.unidad_medida} de '{insumo_locked.nombre}'. "
            f"Stock remanente: {insumo_locked.stock_actual} {insumo_locked.unidad_medida}."
        )
    else:
        detail_msg = (
            f"Consumo general de pañol registrado: -{cant_dec} "
            f"{insumo_locked.unidad_medida} de '{insumo_locked.nombre}'. "
            f"Stock remanente: {insumo_locked.stock_actual} {insumo_locked.unidad_medida}."
        )

    if alerta_disparada:
        detail_msg += (
            f" ¡ALERTA DE REPOSICIÓN! Stock Mínimo Alcanzado "
            f"(actual: {insumo_locked.stock_actual} <= mínimo: {insumo_locked.stock_minimo})."
        )

    return {
        "detail": detail_msg,
        "movimiento": movimiento,
        "insumo": insumo_locked,
        "alerta_stock_minimo": alerta_disparada,
        "costo_acumulado_ot": (
            calcular_costo_materiales_orden(orden)
            if orden is not None
            else Decimal("0.00")
        ),
    }


def calcular_costo_materiales_orden(orden: OrdenDeTrabajo) -> Decimal:
    """
    HU-012 Criterio 2:
    Calcula la sumatoria de (cantidad * costo_unitario) de todos los egresos por consumo
    imputados a una OrdenDeTrabajo.
    """
    agg = MovimientoStock.objects.filter(
        orden=orden,
        tipo_movimiento=MovimientoStock.TipoMovimiento.EGRESO_CONSUMO,
    ).aggregate(
        total=Coalesce(
            Sum(
                ExpressionWrapper(
                    F("cantidad") * F("costo_unitario"),
                    output_field=DecimalField(max_digits=14, decimal_places=2),
                )
            ),
            Decimal("0.00"),
        )
    )
    return Decimal(str(agg["total"] or "0.00")).quantize(Decimal("0.01"))
