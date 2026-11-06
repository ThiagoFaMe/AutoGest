"""
Serializadores REST para Órdenes de Trabajo y Seguimiento Secuencial de Fases (HU-008 y HU-009).
Incluye:
- Cálculo en tiempo real de duraciones por fase, tiempo de ciclo total y alerta de retraso.
- Restricción de montos financieros cuando consulta el rol Operario (Tabla 21 TFG).
- Serializador público acotado para consulta externa del cliente mediante código de seguimiento.
"""
from rest_framework import serializers

from apps.users.models import Usuario
from .models import FaseReparacion, OrdenDeTrabajo
from .services import calculate_order_timing_metrics, calculate_phase_duration


class FaseReparacionSerializer(serializers.ModelSerializer):
    orden_secuencia = serializers.IntegerField(source="numero_secuencia", read_only=True)
    id_usuario_responsable = serializers.IntegerField(
        source="usuario_responsable_id", read_only=True
    )
    responsable_nombre = serializers.SerializerMethodField(read_only=True)
    duracion_horas = serializers.SerializerMethodField(read_only=True)
    duracion_texto = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = FaseReparacion
        fields = [
            "id_fase",
            "numero_secuencia",
            "orden_secuencia",
            "nombre_fase",
            "estado",
            "fecha_inicio",
            "fecha_fin",
            "duracion_horas",
            "duracion_texto",
            "observaciones",
            "id_usuario_responsable",
            "responsable_nombre",
        ]

    def get_responsable_nombre(self, obj):
        return (
            obj.usuario_responsable.nombre_completo
            if obj.usuario_responsable
            else None
        )

    def get_duracion_horas(self, obj):
        return calculate_phase_duration(obj)["horas"]

    def get_duracion_texto(self, obj):
        return calculate_phase_duration(obj)["texto"]


class OrdenDeTrabajoSerializer(serializers.ModelSerializer):
    id_vehiculo = serializers.IntegerField(source="vehiculo_id", read_only=True)
    id_compania = serializers.IntegerField(source="compania_id", read_only=True)
    id_presupuesto = serializers.IntegerField(source="presupuesto_id", read_only=True)
    presupuesto_tipo = serializers.CharField(source="tipo_cliente", read_only=True)

    vehiculo_patente = serializers.CharField(source="vehiculo.patente", read_only=True)
    vehiculo_marca = serializers.CharField(source="vehiculo.marca", read_only=True)
    vehiculo_modelo = serializers.CharField(source="vehiculo.modelo", read_only=True)
    vehiculo_anio = serializers.IntegerField(source="vehiculo.anio", read_only=True)
    vehiculo_color = serializers.CharField(source="vehiculo.color", read_only=True)
    vehiculo_detalle = serializers.SerializerMethodField(read_only=True)
    vehiculo_descripcion = serializers.SerializerMethodField(read_only=True)

    cliente_nombre = serializers.SerializerMethodField(read_only=True)
    cliente_dni = serializers.CharField(source="vehiculo.cliente.dni", read_only=True)
    cliente_telefono = serializers.CharField(
        source="vehiculo.cliente.telefono", read_only=True
    )

    compania_nombre = serializers.SerializerMethodField(read_only=True)
    aseguradora_nombre = serializers.SerializerMethodField(read_only=True)
    nro_siniestro = serializers.CharField(
        source="presupuesto.nro_siniestro", read_only=True
    )
    nombre_perito = serializers.CharField(
        source="presupuesto.nombre_perito", read_only=True
    )
    presupuesto_fecha_emision = serializers.DateField(
        source="presupuesto.fecha_emision", read_only=True
    )

    en_retraso = serializers.SerializerMethodField(read_only=True)
    dias_retraso = serializers.SerializerMethodField(read_only=True)
    dias_ciclo_total = serializers.SerializerMethodField(read_only=True)
    fases_completadas = serializers.SerializerMethodField(read_only=True)
    total_fases = serializers.SerializerMethodField(read_only=True)
    progreso_porcentaje = serializers.SerializerMethodField(read_only=True)
    costo_materiales_consumidos = serializers.SerializerMethodField(read_only=True)
    cantidad_consumos_registrados = serializers.SerializerMethodField(read_only=True)

    fases = FaseReparacionSerializer(many=True, read_only=True)

    class Meta:
        model = OrdenDeTrabajo
        fields = [
            "id_orden",
            "codigo_seguimiento",
            "fecha_ingreso",
            "fecha_estimada_entrega",
            "fecha_entrega_real",
            "tipo_cliente",
            "presupuesto_tipo",
            "nro_orden_aseguradora",
            "nro_siniestro",
            "nombre_perito",
            "presupuesto_fecha_emision",
            "estado_actual",
            "monto_total",
            "saldo_pendiente",
            "id_vehiculo",
            "vehiculo_patente",
            "vehiculo_marca",
            "vehiculo_modelo",
            "vehiculo_anio",
            "vehiculo_color",
            "vehiculo_detalle",
            "vehiculo_descripcion",
            "cliente_nombre",
            "cliente_dni",
            "cliente_telefono",
            "id_compania",
            "compania_nombre",
            "aseguradora_nombre",
            "id_presupuesto",
            "en_retraso",
            "dias_retraso",
            "dias_ciclo_total",
            "fases_completadas",
            "total_fases",
            "progreso_porcentaje",
            "costo_materiales_consumidos",
            "cantidad_consumos_registrados",
            "fases",
        ]

    def get_vehiculo_detalle(self, obj):
        if obj.vehiculo:
            return f"{obj.vehiculo.marca} {obj.vehiculo.modelo} ({obj.vehiculo.anio}) - {obj.vehiculo.color}"
        return ""

    def get_vehiculo_descripcion(self, obj):
        if obj.vehiculo:
            return f"{obj.vehiculo.marca} {obj.vehiculo.modelo} ({obj.vehiculo.anio})"
        return ""

    def get_cliente_nombre(self, obj):
        if obj.vehiculo and obj.vehiculo.cliente:
            c = obj.vehiculo.cliente
            return f"{c.apellido}, {c.nombre}"
        return ""

    def get_compania_nombre(self, obj):
        return obj.compania.razon_social if obj.compania else None

    def get_aseguradora_nombre(self, obj):
        return obj.compania.razon_social if obj.compania else None

    def get_en_retraso(self, obj):
        return calculate_order_timing_metrics(obj)["en_retraso"]

    def get_dias_retraso(self, obj):
        return calculate_order_timing_metrics(obj)["dias_retraso"]

    def get_dias_ciclo_total(self, obj):
        return calculate_order_timing_metrics(obj)["dias_ciclo_total"]

    def get_fases_completadas(self, obj):
        return sum(
            1
            for f in obj.fases.all()
            if f.estado == FaseReparacion.EstadoFase.COMPLETADA
        )

    def get_total_fases(self, obj):
        return obj.fases.count() or 8

    def get_progreso_porcentaje(self, obj):
        # El proceso completo consta de 10 etapas (2 administrativas ya aprobadas + 8 técnicas)
        completadas_taller = sum(
            1
            for f in obj.fases.all()
            if f.estado == FaseReparacion.EstadoFase.COMPLETADA
        )
        return int(round(((2 + completadas_taller) / 10.0) * 100))

    def get_costo_materiales_consumidos(self, obj):
        from apps.inventory.services import calcular_costo_materiales_orden

        return str(calcular_costo_materiales_orden(obj))

    def get_cantidad_consumos_registrados(self, obj):
        return obj.consumos_stock.count()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        # Tabla 21 TFG: El rol Operario no visualiza montos económicos
        if request and hasattr(request, "user") and request.user.is_authenticated:
            if getattr(request.user, "rol", None) == Usuario.Rol.OPERARIO:
                data["monto_total"] = None
                data["saldo_pendiente"] = None
                data["costo_materiales_consumidos"] = None
        return data


class FaseAccionInputSerializer(serializers.Serializer):
    numero_secuencia = serializers.IntegerField(min_value=1, max_value=8, required=True)
    observaciones = serializers.CharField(
        max_length=500, required=False, allow_blank=True, default=""
    )


class RegistrarEntregaInputSerializer(serializers.Serializer):
    fecha_entrega_real = serializers.DateField(required=False)


class ConsultaPublicaOrdenSerializer(serializers.ModelSerializer):
    """
    Serializador público acotado para que el cliente consulte la fase en que se encuentra
    su vehículo mediante codigo_seguimiento sin exponer datos internos (Tabla 21 TFG).
    """

    vehiculo_patente = serializers.CharField(source="vehiculo.patente", read_only=True)
    vehiculo_color = serializers.CharField(source="vehiculo.color", read_only=True)
    vehiculo_detalle = serializers.SerializerMethodField(read_only=True)
    vehiculo_descripcion = serializers.SerializerMethodField(read_only=True)
    progreso_porcentaje = serializers.SerializerMethodField(read_only=True)
    fases = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = OrdenDeTrabajo
        fields = [
            "codigo_seguimiento",
            "vehiculo_patente",
            "vehiculo_color",
            "vehiculo_detalle",
            "vehiculo_descripcion",
            "fecha_ingreso",
            "fecha_estimada_entrega",
            "fecha_entrega_real",
            "estado_actual",
            "progreso_porcentaje",
            "fases",
        ]

    def get_vehiculo_detalle(self, obj):
        return f"{obj.vehiculo.marca} {obj.vehiculo.modelo} ({obj.vehiculo.color})"

    def get_vehiculo_descripcion(self, obj):
        return f"{obj.vehiculo.marca} {obj.vehiculo.modelo} ({obj.vehiculo.anio})"

    def get_progreso_porcentaje(self, obj):
        completadas = sum(
            1
            for f in obj.fases.all()
            if f.estado == FaseReparacion.EstadoFase.COMPLETADA
        )
        return int(round(((2 + completadas) / 10.0) * 100))

    def get_fases(self, obj):
        return [
            {
                "numero_secuencia": f.numero_secuencia,
                "orden_secuencia": f.numero_secuencia,
                "nombre_fase": f.nombre_fase,
                "estado": f.estado,
                "fecha_inicio": f.fecha_inicio,
                "fecha_fin": f.fecha_fin,
            }
            for f in obj.fases.all().order_by("numero_secuencia")
        ]
