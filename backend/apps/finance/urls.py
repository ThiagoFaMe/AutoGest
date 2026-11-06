"""Rutas REST del módulo de Cuentas por Cobrar, Flujo de Caja y Dashboard de KPIs (Sprint 5: HU-013 y HU-014)."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    CuentaPorCobrarViewSet,
    DashboardKPIsAPIView,
    MovimientoFinancieroViewSet,
)

router = DefaultRouter()
router.register(r"cuentas", CuentaPorCobrarViewSet, basename="cuenta-por-cobrar")
router.register(
    r"movimientos", MovimientoFinancieroViewSet, basename="movimiento-financiero"
)

urlpatterns = [
    path("kpis/", DashboardKPIsAPIView.as_view(), name="dashboard-kpis"),
    path("", include(router.urls)),
]
