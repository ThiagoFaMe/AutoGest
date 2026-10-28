"""
Serializadores REST para Presupuestos e Ítems de Presupuesto (HU-005, HU-006, HU-007).
"""
from django.db import transaction
from rest_framework import serializers

from apps.core.models import Cliente, CompaniaAseguradora, Vehiculo
from .models import ItemPresupuesto, Presupuesto
from .services import (
    recalculate_budget_totals,
    sync_budget_items,
    validate_budget_modality_rules,
)


class ItemPresupuestoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemPresupuesto
        fields = [
            "id_item",
            "descripcion",
            "tipo_item",
            "cantidad",
            "precio_unitario",
            "subtotal",
        ]
        read_only_fields = ["id_item", "subtotal"]


class PresupuestoSerializer(serializers.ModelSerializer):
    id_vehiculo = serializers.PrimaryKeyRelatedField(
        queryset=Vehiculo.objects.all(), source="vehiculo"
    )
    id_cliente = serializers.PrimaryKeyRelatedField(
        queryset=Cliente.objects.all(), source="cliente"
    )
    id_compania = serializers.PrimaryKeyRelatedField(
        queryset=CompaniaAseguradora.objects.all(),
        source="compania",
        required=False,
        allow_null=True,
    )
    items = ItemPresupuestoSerializer(many=True, required=False)

    # Campos enriquecidos de lectura para el listado y vista imprimible (PDF)
    vehiculo_patente = serializers.CharField(source="vehiculo.patente", read_only=True)
    vehiculo_detalle = serializers.SerializerMethodField(read_only=True)
    cliente_nombre = serializers.SerializerMethodField(read_only=True)
    cliente_dni = serializers.CharField(source="cliente.dni", read_only=True)
    cliente_telefono = serializers.CharField(source="cliente.telefono", read_only=True)
    compania_nombre = serializers.SerializerMethodField(read_only=True)
    dias_espera_aprobacion = serializers.IntegerField(read_only=True)
    orden_trabajo_resumen = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Presupuesto
        fields = [
            "id_presupuesto",
            "fecha_emision",
            "fecha_vencimiento",
            "tipo",
            "estado",
            "nro_siniestro",
            "nombre_perito",
            "monto_mano_obra",
            "monto_repuestos",
            "monto_total",
            "id_vehiculo",
            "vehiculo_patente",
            "vehiculo_detalle",
            "id_cliente",
            "cliente_nombre",
            "cliente_dni",
            "cliente_telefono",
            "id_compania",
            "compania_nombre",
            "observaciones",
            "dias_espera_aprobacion",
            "orden_trabajo_resumen",
            "items",
        ]
        read_only_fields = [
            "id_presupuesto",
            "fecha_emision",
            "fecha_vencimiento",
            "estado",
            "monto_mano_obra",
            "monto_repuestos",
            "monto_total",
            "dias_espera_aprobacion",
            "orden_trabajo_resumen",
        ]

    def get_vehiculo_detalle(self, obj):
        if obj.vehiculo:
            return f"{obj.vehiculo.marca} {obj.vehiculo.modelo} ({obj.vehiculo.anio}) - {obj.vehiculo.color}"
        return ""

    def get_cliente_nombre(self, obj):
        if obj.cliente:
            return f"{obj.cliente.apellido}, {obj.cliente.nombre}"
        return ""

    def get_compania_nombre(self, obj):
        return obj.compania.razon_social if obj.compania else None

    def get_orden_trabajo_resumen(self, obj):
        if hasattr(obj, "orden_trabajo"):
            ot = obj.orden_trabajo
            return {
                "id_orden": ot.id_orden,
                "codigo_seguimiento": ot.codigo_seguimiento,
                "estado_actual": ot.estado_actual,
                "fecha_ingreso": ot.fecha_ingreso,
                "fecha_estimada_entrega": ot.fecha_estimada_entrega,
            }
        return None

    def validate(self, attrs):
        tipo = attrs.get("tipo", getattr(self.instance, "tipo", Presupuesto.Tipo.PARTICULAR))
        compania = attrs.get("compania", getattr(self.instance, "compania", None))
        nro_siniestro = attrs.get("nro_siniestro", getattr(self.instance, "nro_siniestro", ""))
        nombre_perito = attrs.get("nombre_perito", getattr(self.instance, "nombre_perito", ""))

        validate_budget_modality_rules(
            tipo=tipo,
            compania=compania,
            nro_siniestro=nro_siniestro,
            nombre_perito=nombre_perito,
        )

        if tipo == Presupuesto.Tipo.PARTICULAR:
            attrs["compania"] = None
            attrs["nro_siniestro"] = ""
            attrs["nombre_perito"] = ""

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        presupuesto = Presupuesto.objects.create(**validated_data)
        if items_data:
            sync_budget_items(presupuesto, items_data)
        else:
            recalculate_budget_totals(presupuesto)
        return presupuesto

    @transaction.atomic
    def update(self, instance, validated_data):
        if instance.estado not in (Presupuesto.Estado.BORRADOR, Presupuesto.Estado.EMITIDO):
            raise serializers.ValidationError(
                f"No se puede editar un presupuesto en estado '{instance.estado}'."
            )
        items_data = validated_data.pop("items", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()

        if items_data is not None:
            sync_budget_items(instance, items_data)
        else:
            recalculate_budget_totals(instance)
        return instance


class AprobarPresupuestoSerializer(serializers.Serializer):
    fecha_estimada_entrega = serializers.DateField(required=True)
    fecha_ingreso = serializers.DateField(required=False)
    nro_orden_aseguradora = serializers.CharField(
        max_length=40, required=False, allow_blank=True, default=""
    )
