from django.contrib import admin
from .models import FaseReparacion, OrdenDeTrabajo


class FaseReparacionInline(admin.TabularInline):
    model = FaseReparacion
    extra = 0


@admin.register(OrdenDeTrabajo)
class OrdenDeTrabajoAdmin(admin.ModelAdmin):
    list_display = (
        "id_orden",
        "codigo_seguimiento",
        "vehiculo",
        "tipo_cliente",
        "estado_actual",
        "fecha_ingreso",
        "fecha_estimada_entrega",
        "monto_total",
        "saldo_pendiente",
    )
    list_filter = ("tipo_cliente", "estado_actual")
    search_fields = ("codigo_seguimiento", "vehiculo__patente")
    inlines = [FaseReparacionInline]
