from django.contrib import admin
from .models import Cliente, CompaniaAseguradora, Vehiculo


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ("id_cliente", "dni", "apellido", "nombre", "telefono", "email", "activo")
    search_fields = ("dni", "apellido", "nombre", "telefono")


@admin.register(Vehiculo)
class VehiculoAdmin(admin.ModelAdmin):
    list_display = ("id_vehiculo", "patente", "marca", "modelo", "anio", "color", "cliente")
    search_fields = ("patente", "marca", "modelo", "cliente__dni", "cliente__apellido")


@admin.register(CompaniaAseguradora)
class CompaniaAseguradoraAdmin(admin.ModelAdmin):
    list_display = ("id_compania", "razon_social", "cuit", "plazo_pago_dias", "telefono", "email_peritos")
    search_fields = ("razon_social", "cuit")
