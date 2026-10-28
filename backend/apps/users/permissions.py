"""
Control de Acceso Basado en Roles (RBAC) según Tabla 21 del TFG (HU-001 Criterio 4).
Garantiza código HTTP 403 cuando un rol sin privilegios intenta acceder a un módulo restringido.
"""
from rest_framework.permissions import BasePermission, SAFE_METHODS
from .models import Usuario


class IsAdministrador(BasePermission):
    """Permite acceso únicamente al perfil Administrador (Dueño del Taller)."""

    message = "Acceso denegado (Rol requerido: Administrador del Taller)."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.activo
            and request.user.rol == Usuario.Rol.ADMINISTRADOR
        )


class IsAdministrativoOrAdmin(BasePermission):
    """
    Permite acceso a perfiles Administrador y Administrativo.
    Deniega (HTTP 403) a usuarios con rol Operario (HU-001 Criterio 4).
    """

    message = "Acceso denegado: Su perfil Operario no posee permisos para operar este módulo administrativo."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.activo
            and request.user.rol in (Usuario.Rol.ADMINISTRADOR, Usuario.Rol.ADMINISTRATIVO)
        )


class IsAdminOrAdministrativoWriteOperarioRead(BasePermission):
    """
    Matriz Tabla 21 (Padrones de Vehículos / Clientes):
    - Administrador y Administrativo: Acceso total (ABM).
    - Operario: Solo lectura (GET, HEAD, OPTIONS) para consultar datos técnicos del vehículo.
    """

    message = "Acceso denegado: El perfil Operario solo posee permiso de lectura en este padrón."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated and request.user.activo):
            return False
        if request.user.rol in (Usuario.Rol.ADMINISTRADOR, Usuario.Rol.ADMINISTRATIVO):
            return True
        if request.user.rol == Usuario.Rol.OPERARIO and request.method in SAFE_METHODS:
            return True
        return False
