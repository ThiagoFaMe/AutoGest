"""
Serializadores de lectura para Órdenes de Trabajo y sus 8 Fases Secuenciales (HU-007).
Se ampliarán en el Sprint 3 con las acciones de transición secuencial (HU-008 y HU-009).
"""
from rest_framework import serializers
from .models import FaseReparacion, OrdenDeTrabajo


class FaseReparacionSerializer(serializers.ModelSerializer):
    responsable_nombre = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = FaseReparacion
        fields = [
            "id_fase",
            "numero_secuencia",
            "nombre_fase",
            "estado",
            "fecha_inicio",
            "fecha_fin",
            "observaciones",
            "id_usuario_responsable",
            "responsable_nombre",
        ]

    def get_responsable_nombre(self, obj):
        return obj.usuario_responsable.nombre_completo if obj.usuario_responsable else None


class OrdenDeTrabajoSerializer(serializers.ModelSerializer):
    vehiculo_patente = serializers.CharField(source="vehiculo.patente", read_only=True)
    vehiculo_detalle = serializers.SerializerMethodField(read_only=True)
    cliente_nombre = serializers.SerializerMethodField(read_only=True)
    compania_nombre = serializers.SerializerMethodField(read_only=True)
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
            "nro_orden_aseguradora",
            "estado_actual",
            "monto_total",
            "saldo_pendiente",
            "id_vehiculo",
            "vehiculo_patente",
            "vehiculo_detalle",
            "cliente_nombre",
            "id_compania",
            "compania_nombre",
            "id_presupuesto",
            "fases",
        ]

    def get_vehiculo_detalle(self, obj):
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
