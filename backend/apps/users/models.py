"""
Modelo de datos para la entidad Usuario (Tabla 12 del Diccionario de Datos del TFG).
Soporta HU-001: Autenticación de usuarios, encriptación bcrypt, bloqueo tras 5 fallos y RBAC.
"""
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UsuarioManager(BaseUserManager):
    """Manager personalizado donde el email es el identificador único de login."""

    def create_user(self, email, nombre_completo, password=None, rol="operario", **extra_fields):
        if not email:
            raise ValueError("El correo electrónico es obligatorio para registrar un usuario.")
        email = self.normalize_email(email).lower().strip()
        user = self.model(
            email=email,
            nombre_completo=nombre_completo.strip(),
            rol=rol,
            **extra_fields,
        )
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, nombre_completo, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("activo", True)
        return self.create_user(
            email=email,
            nombre_completo=nombre_completo,
            password=password,
            rol=Usuario.Rol.ADMINISTRADOR,
            **extra_fields,
        )


class Usuario(AbstractBaseUser, PermissionsMixin):
    """
    Entidad Usuario según Tabla 12 del Diccionario de Datos:
    - id_usuario: SERIAL (PK)
    - nombre_completo: VARCHAR(100)
    - email: VARCHAR(100) UNIQUE
    - password_hash: VARCHAR(255) (mapeado al campo password de AbstractBaseUser con Bcrypt)
    - rol: VARCHAR(20) ('administrador', 'administrativo', 'operario')
    - intentos_fallidos: INTEGER
    - bloqueado_hasta: TIMESTAMP (null)
    - activo: BOOLEAN
    """

    class Rol(models.TextChoices):
        ADMINISTRADOR = "administrador", "Administrador (Dueño del Taller)"
        ADMINISTRATIVO = "administrativo", "Administrativo (Oficina / Recepción)"
        OPERARIO = "operario", "Operario (Chapa / Pintura)"

    id_usuario = models.AutoField(primary_key=True, db_column="id_usuario")
    nombre_completo = models.CharField(max_length=100, db_column="nombre_completo")
    email = models.EmailField(max_length=100, unique=True, db_column="email")
    password = models.CharField(max_length=255, db_column="password_hash")
    rol = models.CharField(
        max_length=20,
        choices=Rol.choices,
        default=Rol.OPERARIO,
        db_column="rol",
    )
    intentos_fallidos = models.IntegerField(default=0, db_column="intentos_fallidos")
    bloqueado_hasta = models.DateTimeField(null=True, blank=True, db_column="bloqueado_hasta")
    activo = models.BooleanField(default=True, db_column="activo")

    # Campos internos de compatibilidad con el admin de Django
    is_staff = models.BooleanField(default=False)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    objects = UsuarioManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nombre_completo"]

    class Meta:
        db_table = "usuario"
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"
        ordering = ["nombre_completo"]

    def __str__(self):
        return f"{self.nombre_completo} ({self.email} - {self.rol})"

    @property
    def is_active(self):
        return self.activo

    @property
    def esta_bloqueado(self) -> bool:
        """Indica si la cuenta permanece bloqueada temporalmente por intentos fallidos."""
        if self.bloqueado_hasta and self.bloqueado_hasta > timezone.now():
            return True
        return False
