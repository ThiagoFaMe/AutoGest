"""Serializadores REST para autenticación y administración de Usuarios (HU-001)."""
from rest_framework import serializers
from .models import Usuario
from .validators import validate_password_complexity


class LoginRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True, trim_whitespace=False)


class UsuarioSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=False,
        trim_whitespace=False,
        help_text="Contraseña en texto plano; se valida y almacena con hash Bcrypt.",
    )
    esta_bloqueado = serializers.BooleanField(read_only=True)

    class Meta:
        model = Usuario
        fields = [
            "id_usuario",
            "nombre_completo",
            "email",
            "password",
            "rol",
            "intentos_fallidos",
            "bloqueado_hasta",
            "esta_bloqueado",
            "activo",
        ]
        read_only_fields = ["id_usuario", "intentos_fallidos", "bloqueado_hasta", "esta_bloqueado"]

    def validate_email(self, value):
        normalized = value.strip().lower()
        qs = Usuario.objects.filter(email__iexact=normalized)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "El correo electrónico ingresado ya se encuentra registrado en el sistema."
            )
        return normalized

    def validate_password(self, value):
        return validate_password_complexity(value)

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        if not password:
            raise serializers.ValidationError({"password": "Debe ingresar una contraseña para el nuevo usuario."})
        return Usuario.objects.create_user(password=password, **validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        if password:
            instance.set_password(password)
        instance.save()
        return instance
