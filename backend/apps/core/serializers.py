"""
Serializadores REST para Clientes (HU-002), Vehículos (HU-003) y Aseguradoras (HU-004).
Incluyen detección de duplicados devolviendo la ficha existente para edición rápida.
"""
from rest_framework import serializers
from .models import Cliente, CompaniaAseguradora, Vehiculo
from .validators import (
    normalize_and_validate_patente,
    normalize_dni,
    validate_plazo_pago_dias,
    validate_vehicle_year,
)


class VehiculoResumenSerializer(serializers.ModelSerializer):
    """Resumen compacto de vehículos para anidar dentro de la ficha del cliente."""

    class Meta:
        model = Vehiculo
        fields = ["id_vehiculo", "patente", "marca", "modelo", "anio", "color"]


class ClienteSerializer(serializers.ModelSerializer):
    vehiculos = VehiculoResumenSerializer(many=True, read_only=True)
    dni = serializers.CharField(max_length=15, validators=[])

    class Meta:
        model = Cliente
        fields = [
            "id_cliente",
            "dni",
            "nombre",
            "apellido",
            "telefono",
            "email",
            "direccion",
            "activo",
            "vehiculos",
        ]
        read_only_fields = ["id_cliente", "vehiculos"]

    def validate(self, attrs):
        raw_dni = attrs.get("dni")
        if raw_dni is not None:
            cleaned_dni = normalize_dni(raw_dni)
            attrs["dni"] = cleaned_dni
            qs = Cliente.objects.filter(dni__iexact=cleaned_dni)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            existing = qs.first()
            if existing:
                # HU-002 Criterio 1: Impedir duplicación y exhibir la ficha existente para ofrecer editarla
                raise serializers.ValidationError(
                    {
                        "dni": f"El DNI {cleaned_dni} ya pertenece al cliente registrado {existing.apellido}, {existing.nombre}.",
                        "ficha_existente": {
                            "id_cliente": existing.id_cliente,
                            "dni": existing.dni,
                            "nombre": existing.nombre,
                            "apellido": existing.apellido,
                            "telefono": existing.telefono,
                            "email": existing.email,
                            "direccion": existing.direccion,
                            "activo": existing.activo,
                        },
                    }
                )
        return attrs


class VehiculoSerializer(serializers.ModelSerializer):
    id_cliente = serializers.PrimaryKeyRelatedField(
        queryset=Cliente.objects.all(),
        source="cliente",
    )
    cliente_nombre = serializers.SerializerMethodField(read_only=True)
    cliente_dni = serializers.CharField(source="cliente.dni", read_only=True)
    cliente_telefono = serializers.CharField(source="cliente.telefono", read_only=True)
    patente = serializers.CharField(max_length=10, validators=[])
    historial_ordenes = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Vehiculo
        fields = [
            "id_vehiculo",
            "patente",
            "marca",
            "modelo",
            "anio",
            "color",
            "id_cliente",
            "cliente_nombre",
            "cliente_dni",
            "cliente_telefono",
            "historial_ordenes",
        ]
        read_only_fields = ["id_vehiculo", "cliente_nombre", "cliente_dni", "cliente_telefono", "historial_ordenes"]

    def get_cliente_nombre(self, obj):
        if obj.cliente:
            return f"{obj.cliente.apellido}, {obj.cliente.nombre}"
        return ""

    def get_historial_ordenes(self, obj):
        """
        Devuelve el historial de órdenes del vehículo (HU-003 Criterio 1).
        Se conectará automáticamente con OrdenDeTrabajo en el Sprint 2/3.
        """
        if hasattr(obj, "ordenes_trabajo"):
            return [
                {
                    "id_orden": ot.id_orden,
                    "codigo_seguimiento": ot.codigo_seguimiento,
                    "fecha_ingreso": ot.fecha_ingreso,
                    "estado_actual": ot.estado_actual,
                    "monto_total": str(ot.monto_total),
                }
                for ot in obj.ordenes_trabajo.all().order_by("-fecha_ingreso")
            ]
        return []

    def validate_anio(self, value):
        return validate_vehicle_year(value)

    def validate(self, attrs):
        raw_patente = attrs.get("patente")
        if raw_patente is not None:
            cleaned_patente = normalize_and_validate_patente(raw_patente)
            attrs["patente"] = cleaned_patente
            qs = Vehiculo.objects.select_related("cliente").filter(patente__iexact=cleaned_patente)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            existing = qs.first()
            if existing:
                # HU-003 Criterio 1: Rechazar duplicación y mostrar el vehículo existente con su historial
                raise serializers.ValidationError(
                    {
                        "patente": f"La patente {cleaned_patente} ya se encuentra registrada en el sistema.",
                        "vehiculo_existente": {
                            "id_vehiculo": existing.id_vehiculo,
                            "patente": existing.patente,
                            "marca": existing.marca,
                            "modelo": existing.modelo,
                            "anio": existing.anio,
                            "color": existing.color,
                            "id_cliente": existing.cliente_id,
                            "cliente_nombre": f"{existing.cliente.apellido}, {existing.cliente.nombre}",
                            "cliente_dni": existing.cliente.dni,
                            "historial_ordenes": self.get_historial_ordenes(existing),
                        },
                    }
                )
        return attrs


class CompaniaAseguradoraSerializer(serializers.ModelSerializer):
    cuit = serializers.CharField(max_length=13, validators=[])

    class Meta:
        model = CompaniaAseguradora
        fields = [
            "id_compania",
            "razon_social",
            "cuit",
            "plazo_pago_dias",
            "telefono",
            "email_peritos",
        ]
        read_only_fields = ["id_compania"]

    def validate_cuit(self, value):
        cleaned = (value or "").strip()
        qs = CompaniaAseguradora.objects.filter(cuit__iexact=cleaned)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            # HU-004 Criterio 1: Bloquear alta si el CUIT ya existe
            raise serializers.ValidationError(
                f"El CUIT {cleaned} ya se encuentra registrado en el padrón de aseguradoras."
            )
        return cleaned

    def validate_plazo_pago_dias(self, value):
        # HU-004 Criterio 2: Validar entre 1 y 180 días
        return validate_plazo_pago_dias(value)
