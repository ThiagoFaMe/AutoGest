"""
Serializadores REST para el módulo de Inventario de Pañol y Consumo por Orden de Trabajo:
- InsumoRepuestoSerializer (HU-010)
- MovimientoStockSerializer (HU-011 y HU-012)
- IngresoStockInputSerializer (HU-011)
- ConsumoOTInputSerializer (HU-012)
"""
from decimal import Decimal
from rest_framework import serializers

from apps.users.models import Usuario
from .models import InsumoRepuesto, MovimientoStock


class InsumoRepuestoSerializer(serializers.ModelSerializer):
    en_alerta_stock = serializers.BooleanField(read_only=True)
    estado_stock = serializers.CharField(read_only=True)
    valor_inventario = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = InsumoRepuesto
        fields = [
            "id_insumo",
            "codigo",
            "nombre",
            "categoria",
            "unidad_medida",
            "stock_actual",
            "stock_minimo",
            "costo_unitario",
            "en_alerta_stock",
            "estado_stock",
            "valor_inventario",
        ]

    def validate_codigo(self, value):
        clean_code = (value or "").strip().upper()
        if not clean_code:
            raise serializers.ValidationError("El código del insumo/repuesto es obligatorio.")
        qs = InsumoRepuesto.objects.filter(codigo__iexact=clean_code)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                f"Ya existe un insumo o repuesto registrado con el código '{clean_code}'."
            )
        return clean_code

    def validate_stock_minimo(self, value):
        if value is None or Decimal(str(value)) < Decimal("0"):
            raise serializers.ValidationError(
                "El umbral de stock mínimo debe ser un valor numérico mayor o igual a cero (>= 0)."
            )
        return value

    def get_valor_inventario(self, obj):
        return str((obj.stock_actual * obj.costo_unitario).quantize(Decimal("0.01")))

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        # Tabla 21 TFG: El rol Operario puede ver stock físico pero no costos financieros si se desea resguardar,
        # aunque en catálogo de pañol dejamos visible unidad y stock.
        if request and hasattr(request, "user") and request.user.is_authenticated:
            if getattr(request.user, "rol", None) == Usuario.Rol.OPERARIO:
                data["valor_inventario"] = None
        return data


class MovimientoStockSerializer(serializers.ModelSerializer):
    id_insumo = serializers.IntegerField(source="insumo_id", read_only=True)
    insumo_codigo = serializers.CharField(source="insumo.codigo", read_only=True)
    insumo_nombre = serializers.CharField(source="insumo.nombre", read_only=True)
    insumo_categoria = serializers.CharField(source="insumo.categoria", read_only=True)
    insumo_unidad = serializers.CharField(source="insumo.unidad_medida", read_only=True)

    id_orden = serializers.IntegerField(source="orden_id", read_only=True)
    orden_codigo = serializers.SerializerMethodField(read_only=True)
    vehiculo_patente = serializers.SerializerMethodField(read_only=True)

    id_usuario = serializers.IntegerField(source="usuario_id", read_only=True)
    usuario_nombre = serializers.CharField(
        source="usuario.nombre_completo", read_only=True
    )
    subtotal_valorizado = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = MovimientoStock
        fields = [
            "id_mov_stock",
            "id_insumo",
            "insumo_codigo",
            "insumo_nombre",
            "insumo_categoria",
            "insumo_unidad",
            "id_orden",
            "orden_codigo",
            "vehiculo_patente",
            "id_usuario",
            "usuario_nombre",
            "fecha_hora",
            "tipo_movimiento",
            "cantidad",
            "costo_unitario",
            "subtotal_valorizado",
            "remito_comprobante",
        ]

    def get_orden_codigo(self, obj):
        return obj.orden.codigo_seguimiento if obj.orden else None

    def get_vehiculo_patente(self, obj):
        return obj.orden.vehiculo.patente if obj.orden and obj.orden.vehiculo else None

    def get_subtotal_valorizado(self, obj):
        return str(obj.subtotal_valorizado)


class IngresoStockInputSerializer(serializers.Serializer):
    id_insumo = serializers.IntegerField(required=True)
    cantidad = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=Decimal("0.01"), required=True
    )
    costo_unitario = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.00"), required=True
    )
    remito_comprobante = serializers.CharField(max_length=60, required=True)


class ConsumoOTInputSerializer(serializers.Serializer):
    id_insumo = serializers.IntegerField(required=True)
    id_orden = serializers.IntegerField(required=False, allow_null=True)
    cantidad = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=Decimal("0.01"), required=True
    )
    observacion_comprobante = serializers.CharField(
        max_length=60, required=False, allow_blank=True, default=""
    )
