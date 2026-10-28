"""
Capa de servicios de negocio para autenticación y gestión de usuarios (HU-001).
Implementa el bloqueo automático tras 5 intentos fallidos consecutivos por 15 minutos.
"""
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Usuario
from .validators import validate_password_complexity

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


def authenticate_user(email: str, password: str) -> dict:
    """
    Autentica un usuario verificando:
    1) Existencia del correo y estado activo.
    2) Si se encuentra dentro de la ventana de bloqueo temporal (`bloqueado_hasta`).
    3) Verificación de hash bcrypt; si falla, incrementa `intentos_fallidos` y bloquea al 5.º intento.
    4) Si tiene éxito, reinicia `intentos_fallidos = 0` y emite tokens JWT con datos del perfil.
    """
    normalized_email = (email or "").strip().lower()
    error_message = None

    with transaction.atomic():
        user = Usuario.objects.select_for_update().filter(email=normalized_email).first()

        if not user:
            error_message = "Credenciales inválidas. Verifique su correo y contraseña."
        elif not user.activo:
            error_message = (
                "Esta cuenta de usuario se encuentra deshabilitada. Contacte al Administrador."
            )
        else:
            now = timezone.now()
            if user.bloqueado_hasta and user.bloqueado_hasta > now:
                remaining_minutes = max(1, int((user.bloqueado_hasta - now).total_seconds() // 60) + 1)
                error_message = (
                    f"Cuenta bloqueada temporalmente por superar los {MAX_FAILED_ATTEMPTS} intentos fallidos. "
                    f"Intente nuevamente en {remaining_minutes} minuto(s) o solicite desbloqueo al Administrador."
                )
            else:
                # Si el bloqueo anterior ya expiró, limpiamos el contador antes de evaluar el nuevo intento
                if user.bloqueado_hasta and user.bloqueado_hasta <= now:
                    user.intentos_fallidos = 0
                    user.bloqueado_hasta = None

                if not user.check_password(password):
                    user.intentos_fallidos += 1
                    if user.intentos_fallidos >= MAX_FAILED_ATTEMPTS:
                        user.bloqueado_hasta = now + timedelta(minutes=LOCKOUT_MINUTES)
                        user.save(update_fields=["intentos_fallidos", "bloqueado_hasta"])
                        error_message = (
                            f"Ha alcanzado {MAX_FAILED_ATTEMPTS} intentos fallidos consecutivos. "
                            f"Por seguridad, su cuenta ha sido bloqueada durante {LOCKOUT_MINUTES} minutos."
                        )
                    else:
                        remaining = MAX_FAILED_ATTEMPTS - user.intentos_fallidos
                        user.save(update_fields=["intentos_fallidos", "bloqueado_hasta"])
                        error_message = (
                            f"Contraseña incorrecta. Le quedan {remaining} intento(s) antes del bloqueo temporal."
                        )
                else:
                    # Inicio de sesión exitoso: reiniciamos contadores de bloqueo
                    if user.intentos_fallidos > 0 or user.bloqueado_hasta is not None:
                        user.intentos_fallidos = 0
                        user.bloqueado_hasta = None
                        user.save(update_fields=["intentos_fallidos", "bloqueado_hasta"])

    if error_message:
        raise AuthenticationFailed(error_message)

    refresh = RefreshToken.for_user(user)
    refresh["rol"] = user.rol
    refresh["nombre_completo"] = user.nombre_completo
    refresh["email"] = user.email

    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": {
            "id_usuario": user.id_usuario,
            "nombre_completo": user.nombre_completo,
            "email": user.email,
            "rol": user.rol,
            "activo": user.activo,
        },
    }


@transaction.atomic
def create_user_account(*, nombre_completo: str, email: str, password: str, rol: str, activo: bool = True) -> Usuario:
    """Crea un usuario validando unicidad de correo y complejidad de contraseña (HU-001)."""
    normalized_email = (email or "").strip().lower()
    if Usuario.objects.filter(email__iexact=normalized_email).exists():
        raise ValidationError({"email": "El correo electrónico ingresado ya se encuentra registrado en el sistema."})

    validate_password_complexity(password)
    return Usuario.objects.create_user(
        email=normalized_email,
        nombre_completo=nombre_completo,
        password=password,
        rol=rol,
        activo=activo,
    )


@transaction.atomic
def unlock_user_account(user: Usuario) -> Usuario:
    """Permite al Administrador desbloquear manualmente una cuenta bloqueada (Tabla 21 TFG)."""
    user.intentos_fallidos = 0
    user.bloqueado_hasta = None
    user.save(update_fields=["intentos_fallidos", "bloqueado_hasta"])
    return user
