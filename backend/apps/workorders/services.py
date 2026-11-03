"""
Capa de servicios y motor de validación secuencial de fases de reparación (HU-008 y HU-009).
Implementa:
- Regla de precedencia estricta (bloqueo de fase n si la fase n-1 no está 'completada').
- Registro automático de fecha_inicio, fecha_fin e id_usuario_responsable.
- Auto-inicio de la fase siguiente (n + 1) al completar la fase en curso (n).
- Cierre en fase 8 ('Lista para entrega') y registro de retiro efectivo ('Entregada').
- Cálculo de duraciones por etapa, tiempo total de ciclo y alerta de demora operativa.
"""
from datetime import date
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import FaseReparacion, OrdenDeTrabajo


def calculate_phase_duration(fase: FaseReparacion) -> dict:
    """
    HU-008 Criterio 2 y HU-009 Criterio 1:
    Calcula la duración en horas y formato legible de una fase completada o en curso.
    """
    if not fase.fecha_inicio:
        return {"horas": 0.0, "texto": "Sin iniciar"}

    fin = fase.fecha_fin if fase.estado == FaseReparacion.EstadoFase.COMPLETADA and fase.fecha_fin else timezone.now()
    delta = max(0.0, (fin - fase.fecha_inicio).total_seconds())
    horas_totales = round(delta / 3600.0, 2)
    horas_enteras = int(delta // 3600)
    minutos = int((delta % 3600) // 60)

    if horas_enteras >= 24:
        dias = horas_enteras // 24
        horas_rest = horas_enteras % 24
        texto = f"{dias}d {horas_rest}h {minutos}m"
    elif horas_enteras > 0:
        texto = f"{horas_enteras}h {minutos}m"
    else:
        texto = f"{max(1, minutos)} min"

    if fase.estado == FaseReparacion.EstadoFase.EN_CURSO:
        texto = f"En curso ({texto})"

    return {"horas": horas_totales, "texto": texto}


def calculate_order_timing_metrics(orden: OrdenDeTrabajo) -> dict:
    """
    HU-008 Criterio 3 y HU-009 Criterio 2:
    Calcula si la orden presenta retraso respecto de fecha_estimada_entrega,
    los días de demora y el tiempo total del ciclo de reparación.
    """
    hoy = date.today()
    entregada = bool(orden.fecha_entrega_real) or orden.estado_actual == "Entregada"

    if not entregada and orden.fecha_estimada_entrega and hoy > orden.fecha_estimada_entrega:
        en_retraso = True
        dias_retraso = (hoy - orden.fecha_estimada_entrega).days
    else:
        en_retraso = False
        dias_retraso = 0

    fecha_cierre = orden.fecha_entrega_real or hoy
    dias_ciclo_total = max(0, (fecha_cierre - orden.fecha_ingreso).days) if orden.fecha_ingreso else 0

    return {
        "en_retraso": en_retraso,
        "dias_retraso": dias_retraso,
        "dias_ciclo_total": dias_ciclo_total,
    }


@transaction.atomic
def iniciar_fase_reparacion(
    *,
    orden: OrdenDeTrabajo,
    numero_secuencia: int,
    usuario,
    observaciones: str = "",
) -> FaseReparacion:
    """
    HU-008 Criterio 1:
    Inicia una fase técnica verificando estrictamente que:
    - Si numero_secuencia > 1, la fase inmediata anterior (n - 1) esté en estado 'completada'.
    - No exista otra fase anterior aún pendiente o en curso.
    """
    orden = OrdenDeTrabajo.objects.select_for_update().get(pk=orden.pk)
    fases = list(orden.fases.select_for_update().order_by("numero_secuencia"))

    target_fase = next((f for f in fases if f.numero_secuencia == int(numero_secuencia)), None)
    if not target_fase:
        raise ValidationError(f"No existe la fase con secuencia {numero_secuencia} en esta orden.")

    if target_fase.estado == FaseReparacion.EstadoFase.COMPLETADA:
        raise ValidationError(
            f"La fase '{target_fase.numero_secuencia}-{target_fase.nombre_fase}' ya fue completada anteriormente."
        )

    if target_fase.estado == FaseReparacion.EstadoFase.EN_CURSO:
        return target_fase

    # Validación de precedencia obligatoria (n - 1 completada)
    if target_fase.numero_secuencia > 1:
        fase_previa = next(
            (f for f in fases if f.numero_secuencia == target_fase.numero_secuencia - 1),
            None,
        )
        if not fase_previa or fase_previa.estado != FaseReparacion.EstadoFase.COMPLETADA:
            # Buscamos cuál es la etapa que corresponde trabajar ahora
            primera_incompleta = next(
                (f for f in fases if f.estado != FaseReparacion.EstadoFase.COMPLETADA),
                fase_previa,
            )
            raise ValidationError(
                f"Bloqueo de secuencia (HU-008): No se puede iniciar la fase "
                f"'{target_fase.numero_secuencia}-{target_fase.nombre_fase}' porque la etapa previa "
                f"'{primera_incompleta.numero_secuencia}-{primera_incompleta.nombre_fase}' "
                f"aún no se encuentra completada."
            )

    now = timezone.now()
    target_fase.estado = FaseReparacion.EstadoFase.EN_CURSO
    target_fase.fecha_inicio = now
    target_fase.usuario_responsable = usuario
    if observaciones:
        target_fase.observaciones = observaciones.strip()
    target_fase.save()

    orden.estado_actual = target_fase.nombre_fase[:30]
    orden.save(update_fields=["estado_actual"])
    return target_fase


@transaction.atomic
def completar_fase_reparacion(
    *,
    orden: OrdenDeTrabajo,
    numero_secuencia: int,
    usuario,
    observaciones: str = "",
) -> dict:
    """
    HU-008 Criterios 1, 2 y 3:
    1. Valida que todas las fases previas (< n) estén en estado 'completada'.
    2. Registra fecha_fin = now, id_usuario_responsable y observaciones, pasando la fase n a 'completada'.
    3. Si existe la fase siguiente (n + 1), la habilita e inicia automáticamente ('en_curso', fecha_inicio = now)
       y actualiza orden.estado_actual.
    4. Si n == 8 ('Alistado para entrega'), cambia orden.estado_actual = 'Lista para entrega'.
    """
    orden = OrdenDeTrabajo.objects.select_for_update().get(pk=orden.pk)
    fases = list(orden.fases.select_for_update().order_by("numero_secuencia"))

    target_fase = next((f for f in fases if f.numero_secuencia == int(numero_secuencia)), None)
    if not target_fase:
        raise ValidationError(f"No existe la fase con secuencia {numero_secuencia} en esta orden.")

    if target_fase.estado == FaseReparacion.EstadoFase.COMPLETADA:
        raise ValidationError(
            f"La fase '{target_fase.numero_secuencia}-{target_fase.nombre_fase}' ya se encuentra completada."
        )

    # Verificar que ninguna fase anterior (1 .. n-1) esté sin completar
    fases_previas_incompletas = [
        f
        for f in fases
        if f.numero_secuencia < target_fase.numero_secuencia
        and f.estado != FaseReparacion.EstadoFase.COMPLETADA
    ]
    if fases_previas_incompletas:
        primera = fases_previas_incompletas[0]
        raise ValidationError(
            f"Bloqueo de secuencia (HU-008): No se puede completar la fase "
            f"'{target_fase.numero_secuencia}-{target_fase.nombre_fase}' sin haber finalizado primero "
            f"la etapa '{primera.numero_secuencia}-{primera.nombre_fase}'."
        )

    now = timezone.now()
    if not target_fase.fecha_inicio:
        target_fase.fecha_inicio = now

    target_fase.fecha_fin = now
    target_fase.estado = FaseReparacion.EstadoFase.COMPLETADA
    target_fase.usuario_responsable = usuario
    if observaciones is not None and observaciones.strip():
        target_fase.observaciones = observaciones.strip()
    target_fase.save()

    # Verificar si hay fase inmediata siguiente (n + 1)
    fase_siguiente = next(
        (f for f in fases if f.numero_secuencia == target_fase.numero_secuencia + 1),
        None,
    )
    if fase_siguiente:
        # HU-008 Criterio 2: Habilitar e iniciar automáticamente la fase inmediata siguiente (n + 1)
        fase_siguiente.estado = FaseReparacion.EstadoFase.EN_CURSO
        fase_siguiente.fecha_inicio = now
        fase_siguiente.save(update_fields=["estado", "fecha_inicio"])
        orden.estado_actual = fase_siguiente.nombre_fase[:30]
        orden.save(update_fields=["estado_actual"])
        mensaje = (
            f"Fase '{target_fase.numero_secuencia}-{target_fase.nombre_fase}' completada. "
            f"Se inició automáticamente la fase '{fase_siguiente.numero_secuencia}-{fase_siguiente.nombre_fase}'."
        )
    else:
        # HU-008 Criterio 3: Finalizada la fase 8 (Alistado para entrega) -> Lista para entrega
        orden.estado_actual = "Lista para entrega"
        orden.save(update_fields=["estado_actual"])
        mensaje = (
            "Fase final '8-Alistado para entrega' completada. "
            "La unidad se encuentra 'Lista para entrega' al cliente."
        )

    return {
        "orden": orden,
        "fase_completada": target_fase,
        "fase_siguiente": fase_siguiente,
        "detail": mensaje,
    }


@transaction.atomic
def registrar_entrega_vehiculo(
    *,
    orden: OrdenDeTrabajo,
    fecha_entrega_real: date = None,
) -> OrdenDeTrabajo:
    """
    HU-008 Criterio 3:
    Registra el retiro efectivo del vehículo por parte del cliente bajo firma de conformidad,
    exigiendo que las 8 fases técnicas del taller estén completadas.
    """
    orden = OrdenDeTrabajo.objects.select_for_update().get(pk=orden.pk)
    fases_incompletas = orden.fases.exclude(
        estado=FaseReparacion.EstadoFase.COMPLETADA
    ).count()

    if fases_incompletas > 0:
        raise ValidationError(
            "No se puede registrar la entrega del vehículo porque aún existen fases técnicas sin completar."
        )

    orden.fecha_entrega_real = fecha_entrega_real or date.today()
    orden.estado_actual = "Entregada"
    orden.save(update_fields=["fecha_entrega_real", "estado_actual"])
    return orden
