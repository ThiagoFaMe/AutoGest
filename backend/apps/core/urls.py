"""Rutas REST del módulo Core (Clientes, Vehículos y Compañías Aseguradoras)."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import ClienteViewSet, CompaniaAseguradoraViewSet, VehiculoViewSet

router = DefaultRouter()
router.register(r"clientes", ClienteViewSet, basename="cliente")
router.register(r"vehiculos", VehiculoViewSet, basename="vehiculo")
router.register(r"aseguradoras", CompaniaAseguradoraViewSet, basename="aseguradora")

urlpatterns = [
    path("", include(router.urls)),
]
