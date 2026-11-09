"""
Serializadores REST para el módulo de Cuentas por Cobrar y Movimientos Financieros (HU-013 y HU-014).
"""
from decimal import Decimal
from rest_framework import serializers

from .models import CuentaPorCobrar, MovimientoFinanciero


class CuentaPorCobrarSerializer(serializers.ModelSerializer):
    id_orden = serializers.IntegerField(source="orden_id", read_only=True)
    orden_codigo = serializers.CharField(
        source="orden.codigo_seguimiento", read_only=True
    )
    vehiculo_patente = serializers.CharField(
        source="orden.vehiculo.patente", read_only=True
    )
    vehiculo_descripcion = serializers.SerializerMethodField(read_only=True)
    cliente_nombre = serializers.SerializerMethodField(read_only=True)

    id_compania = serializers.IntegerField(source="compania_id", read_only=True)
    compania_nombre = serializers.SerializerMethodField(read_only=True)
    plazo_pago_dias = serializers.SerializerMethodField(read_only=True)

    dias_mora = serializers.IntegerField(read_only=True)
    en_mora = serializers.BooleanField(read_only=True)

    class Meta:
        model = CuentaPorCobrar
        fields = [
            "id_cuenta",
            "id_orden",
            "orden_codigo",
            "vehiculo_patente",
            "vehiculo_descripcion",
            "cliente_nombre",
            "id_compania",
            "compania_nombre",
            "plazo_pago_dias",
            "nro_factura",
            "fecha_emision",
            "fecha_vencimiento",
            "monto_facturado",
            "monto_cobrado",
            "saldo_pendiente",
            "estado_cobranza",
            "en_mora",
            "dias_mora",
        ]

    def get_vehiculo_descripcion(self, obj):
        if obj.orden and obj.orden.vehiculo:
            v = obj.orden.vehiculo
            return f"{v.marca} {v.modelo} ({v.anio})"
        return ""

    def get_cliente_nombre(self, obj):
        if obj.orden and obj.orden.vehiculo and obj.orden.vehiculo.cliente:
            c = obj.orden.vehiculo.cliente
            return f"{c.apellido}, {c.nombre}"
        return ""

    def get_compania_nombre(self, obj):
        return obj.compania.razon_social if obj.compania else "Cliente Particular"

    def get_plazo_pago_dias(self, obj):
        return obj.compania.plazo_pago_dias if obj.compania else None


class EmitirFacturaInputSerializer(serializers.Serializer):
    id_orden = serializers.IntegerField(required=True)
    nro_factura = serializers.CharField(max_length=40, required=True)
    fecha_emision = serializers.DateField(required=False)
    monto_facturado = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01"), required=False
    )


class MovimientoFinancieroSerializer(serializers.ModelSerializer):
    id_orden = serializers.IntegerField(source="orden_id", read_only=True)
    orden_codigo = serializers.SerializerMethodField(read_only=True)
    id_cuenta = serializers.IntegerField(source="cuenta_id", read_only=True)
    nro_factura = serializers.SerializerMethodField(read_only=True)
    id_usuario = serializers.IntegerField(source="usuario_id", read_only=True)
    usuario_nombre = serializers.CharField(
        source="usuario.nombre_completo", read_only=True
    )

    class Meta:
        model = MovimientoFinanciero
        fields = [
            "id_movimiento",
            "fecha",
            "tipo",
            "categoria",
            "concepto",
            "monto",
            "medio_pago",
            "id_orden",
            "orden_codigo",
            "id_cuenta",
            "nro_factura",
            "id_usuario",
            "usuario_nombre",
        ]

    def get_orden_codigo(self, obj):
        return obj.orden.codigo_seguimiento if obj.orden else None

    def get_nro_factura(self, obj):
        return obj.cuenta.nro_factura if obj.cuenta else None


class RegistrarMovimientoFinancieroInputSerializer(serializers.Serializer):
    fecha = serializers.DateField(required=False)
    tipo = serializers.ChoiceField(
        choices=MovimientoFinanciero.TipoFlujo.choices, required=True
    )
    categoria = serializers.CharField(max_length=30, required=True)
    concepto = serializers.CharField(max_length=120, required=True)
    monto = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01"), required=True
    )
    medio_pago = serializers.ChoiceField(
        choices=MovimientoFinanciero.MedioPago.choices, required=True
    )
    id_orden = serializers.IntegerField(required=False, allow_null=True)
    id_cuenta = serializers.IntegerField(required=False, allow_null=True)
