from django.contrib import admin
from .models import ItemPresupuesto, Presupuesto


class ItemPresupuestoInline(admin.TabularInline):
    model = ItemPresupuesto
    extra = 0


@admin.register(Presupuesto)
class PresupuestoAdmin(admin.ModelAdmin):
    list_display = (
        "id_presupuesto",
        "vehiculo",
        "cliente",
        "tipo",
        "estado",
        "monto_mano_obra",
        "monto_repuestos",
        "monto_total",
        "fecha_emision",
        "fecha_vencimiento",
    )
    list_filter = ("tipo", "estado")
    search_fields = ("vehiculo__patente", "cliente__apellido", "nro_siniestro")
    inlines = [ItemPresupuestoInline]
