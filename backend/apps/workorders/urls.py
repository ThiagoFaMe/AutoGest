"""Rutas REST del módulo de Órdenes de Trabajo."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import OrdenDeTrabajoViewSet

router = DefaultRouter()
router.register(r"ordenes", OrdenDeTrabajoViewSet, basename="orden-trabajo")

urlpatterns = [
    path("", include(router.urls)),
]
