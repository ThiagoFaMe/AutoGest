"""Rutas REST del módulo de Presupuestos (HU-005, HU-006, HU-007)."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import PresupuestoViewSet

router = DefaultRouter()
router.register(r"presupuestos", PresupuestoViewSet, basename="presupuesto")

urlpatterns = [
    path("", include(router.urls)),
]
