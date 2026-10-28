from django.contrib import admin
from .models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    list_display = ("id_usuario", "nombre_completo", "email", "rol", "intentos_fallidos", "bloqueado_hasta", "activo")
    list_filter = ("rol", "activo")
    search_fields = ("nombre_completo", "email")
