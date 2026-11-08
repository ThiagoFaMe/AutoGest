"""
Serializadores REST para Presupuestos e Ítems de Presupuesto (HU-005, HU-006, HU-007).
Incluye soporte completo para:
- Talonario libre de Terceros/Particulares (detalle_libre + rubros_importes)
- Planilla de casillas [X] C/R/P de Compañías Aseguradoras (planilla_marcaciones + rubros_importes)
- Emisión de presupuestos sin exigir empadronamiento previo de Cliente/Vehículo (se registran al aprobar el presupuesto).
"""
import re
from django.db import transaction
from rest_framework import serializers

from apps.core.models import Cliente, CompaniaAseguradora, Vehiculo
from .models import ItemPresupuesto, Presupuesto
from .services import (
    build_items_from_taller_forms,
    recalculate_budget_totals,
    sync_budget_items,
    validate_budget_modality_rules,
)

PATENTE_REGEX = re.compile(
    r"\b([A-Za-z]{2}\s*\d{3}\s*[A-Za-z]{2}|[A-Za-z]{3}\s*\d{3})\b"
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
        queryset=Vehiculo.objects.all(),
        source="vehiculo",
        required=False,
        allow_null=True,
    )
    id_cliente = serializers.PrimaryKeyRelatedField(
        queryset=Cliente.objects.all(),
        source="cliente",
        required=False,
        allow_null=True,
    )
    id_compania = serializers.PrimaryKeyRelatedField(
        queryset=CompaniaAseguradora.objects.all(),
        source="compania",
        required=False,
        allow_null=True,
    )
    items = ItemPresupuestoSerializer(many=True, required=False)

    # Campos enriquecidos de lectura para el listado y vistas reales de impresión
    vehiculo_patente = serializers.SerializerMethodField(read_only=True)
    vehiculo_marca = serializers.SerializerMethodField(read_only=True)
    vehiculo_modelo = serializers.SerializerMethodField(read_only=True)
    vehiculo_anio = serializers.SerializerMethodField(read_only=True)
    vehiculo_color = serializers.SerializerMethodField(read_only=True)
    vehiculo_detalle = serializers.SerializerMethodField(read_only=True)
    cliente_nombre = serializers.SerializerMethodField(read_only=True)
    cliente_dni = serializers.SerializerMethodField(read_only=True)
    cliente_telefono = serializers.SerializerMethodField(read_only=True)
    cliente_direccion = serializers.SerializerMethodField(read_only=True)
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
            "vehiculo_marca",
            "vehiculo_modelo",
            "vehiculo_anio",
            "vehiculo_color",
            "vehiculo_detalle",
            "id_cliente",
            "cliente_nombre",
            "cliente_dni",
            "cliente_telefono",
            "cliente_direccion",
            "id_compania",
            "compania_nombre",
            "observaciones",
            "detalle_libre",
            "planilla_marcaciones",
            "rubros_importes",
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

    def _get_cabecera(self, obj) -> dict:
        rubros = obj.rubros_importes or {}
        cab = rubros.get("cabecera_planilla")
        return cab if isinstance(cab, dict) else {}

    def get_vehiculo_patente(self, obj):
        if obj.vehiculo:
            return obj.vehiculo.patente
        cab = self._get_cabecera(obj)
        if (cab.get("dominio_patente") or "").strip():
            return cab["dominio_patente"].strip().upper()
        detalle = (obj.detalle_libre or "").strip()
        if detalle:
            match = PATENTE_REGEX.search(detalle)
            if match:
                return match.group(1).upper().replace(" ", "")
        return "S/PATENTE"

    def get_vehiculo_marca(self, obj):
        if obj.vehiculo:
            return obj.vehiculo.marca
        cab = self._get_cabecera(obj)
        return (cab.get("vehiculo_texto") or "").strip()

    def get_vehiculo_modelo(self, obj):
        if obj.vehiculo:
            return obj.vehiculo.modelo
        return ""

    def get_vehiculo_anio(self, obj):
        if obj.vehiculo:
            return obj.vehiculo.anio
        cab = self._get_cabecera(obj)
        return (cab.get("modelo_anio") or "").strip() or None

    def get_vehiculo_color(self, obj):
        if obj.vehiculo:
            return obj.vehiculo.color
        cab = self._get_cabecera(obj)
        return (cab.get("color_texto") or "").strip()

    def get_vehiculo_detalle(self, obj):
        if obj.vehiculo:
            return f"{obj.vehiculo.marca} {obj.vehiculo.modelo} ({obj.vehiculo.anio}) - {obj.vehiculo.color}"
        cab = self._get_cabecera(obj)
        if (cab.get("vehiculo_texto") or "").strip():
            partes = [cab.get("vehiculo_texto", "").strip()]
            if (cab.get("modelo_anio") or "").strip():
                partes.append(f"({cab.get('modelo_anio').strip()})")
            if (cab.get("color_texto") or "").strip():
                partes.append(f"- {cab.get('color_texto').strip()}")
            return " ".join(partes)
        detalle = (obj.detalle_libre or "").strip()
        if detalle:
            primera_linea = detalle.splitlines()[0].strip()
            return primera_linea[:90]
        return "Vehículo aún no registrado en padrón"

    def get_cliente_nombre(self, obj):
        if obj.cliente:
            return f"{obj.cliente.apellido}, {obj.cliente.nombre}"
        cab = self._get_cabecera(obj)
        if (cab.get("apellido_nombre") or "").strip():
            return cab["apellido_nombre"].strip()
        return "Prospecto (Registrar al aprobar)"

    def get_cliente_dni(self, obj):
        return obj.cliente.dni if obj.cliente else ""

    def get_cliente_telefono(self, obj):
        if obj.cliente:
            return obj.cliente.telefono
        cab = self._get_cabecera(obj)
        return (cab.get("telefono_1") or "").strip()

    def get_cliente_direccion(self, obj):
        if obj.cliente:
            return obj.cliente.direccion
        cab = self._get_cabecera(obj)
        return (cab.get("domicilio") or "").strip()

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
        items_data = validated_data.pop("items", None)
        presupuesto = Presupuesto.objects.create(**validated_data)
        if items_data is not None and len(items_data) > 0:
            sync_budget_items(presupuesto, items_data)
        else:
            build_items_from_taller_forms(presupuesto)
            recalculate_budget_totals(presupuesto)
        return presupuesto

    @transaction.atomic
    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()

        if items_data is not None and len(items_data) > 0:
            sync_budget_items(instance, items_data)
        elif (
            "detalle_libre" in validated_data
            or "planilla_marcaciones" in validated_data
            or "rubros_importes" in validated_data
        ):
            build_items_from_taller_forms(instance)
            recalculate_budget_totals(instance)
        elif items_data is not None:
            sync_budget_items(instance, items_data)
        else:
            recalculate_budget_totals(instance)
        return instance


class NuevoClienteAprobacionSerializer(serializers.Serializer):
    dni = serializers.CharField(max_length=15, required=True)
    nombre = serializers.CharField(max_length=60, required=True)
    apellido = serializers.CharField(max_length=60, required=True)
    telefono = serializers.CharField(max_length=25, required=True)
    email = serializers.EmailField(max_length=100, required=False, allow_blank=True, default="")
    direccion = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")


class NuevoVehiculoAprobacionSerializer(serializers.Serializer):
    patente = serializers.CharField(max_length=10, required=True)
    marca = serializers.CharField(max_length=40, required=True)
    modelo = serializers.CharField(max_length=50, required=True)
    anio = serializers.IntegerField(required=True)
    color = serializers.CharField(max_length=30, required=True)


class AprobarPresupuestoSerializer(serializers.Serializer):
    fecha_estimada_entrega = serializers.DateField(required=True)
    fecha_ingreso = serializers.DateField(required=False)
    nro_orden_aseguradora = serializers.CharField(
        max_length=40, required=False, allow_blank=True, default=""
    )
    nro_siniestro = serializers.CharField(
        max_length=40, required=False, allow_blank=True, default=""
    )
    nombre_perito = serializers.CharField(
        max_length=100, required=False, allow_blank=True, default=""
    )
    id_cliente = serializers.IntegerField(required=False, allow_null=True)
    id_vehiculo = serializers.IntegerField(required=False, allow_null=True)
    nuevo_cliente = NuevoClienteAprobacionSerializer(required=False, allow_null=True)
    nuevo_vehiculo = NuevoVehiculoAprobacionSerializer(required=False, allow_null=True)
