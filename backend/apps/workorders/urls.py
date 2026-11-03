"""Rutas REST del módulo de Órdenes de Trabajo y Seguimiento Secuencial (HU-008 y HU-009)."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import ConsultaPublicaSeguimientoAPIView, OrdenDeTrabajoViewSet

router = DefaultRouter()
router.register(r"ordenes", OrdenDeTrabajoViewSet, basename="orden-trabajo")

urlpatterns = [
    path(
        "seguimiento/<str:codigo>/",
        ConsultaPublicaSeguimientoAPIView.as_view(),
        name="seguimiento-publico",
    ),
    path("", include(router.urls)),
]
