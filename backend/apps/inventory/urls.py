"""Rutas REST del módulo de Inventario de Pañol y Consumo por Orden de Trabajo (Sprint 4: HU-010 a HU-012)."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import InsumoRepuestoViewSet, MovimientoStockViewSet

router = DefaultRouter()
router.register(r"insumos", InsumoRepuestoViewSet, basename="insumo-repuesto")
router.register(r"movimientos", MovimientoStockViewSet, basename="movimiento-stock")

urlpatterns = [
    path("", include(router.urls)),
]
