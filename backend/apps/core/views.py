"""
Vistas REST para la gestión de Clientes (HU-002), Vehículos (HU-003) y Aseguradoras (HU-004).
"""
from django.db.models import Q
from rest_framework import viewsets

from apps.users.permissions import (
    IsAdminOrAdministrativoWriteOperarioRead,
    IsAdministrativoOrAdmin,
)
from .models import Cliente, CompaniaAseguradora, Vehiculo
from .serializers import (
    ClienteSerializer,
    CompaniaAseguradoraSerializer,
    VehiculoSerializer,
)


class ClienteViewSet(viewsets.ModelViewSet):
    """
    HU-002: Gestión de clientes del taller.
    Soporta búsqueda rápida por DNI, apellido, nombre o teléfono.
    """

    queryset = Cliente.objects.prefetch_related("vehiculos").all().order_by("apellido", "nombre")
    serializer_class = ClienteSerializer
    permission_classes = [IsAdminOrAdministrativoWriteOperarioRead]

    def get_queryset(self):
        qs = super().get_queryset()
        solo_activos = self.request.query_params.get("activo")
        if solo_activos in ("true", "1"):
            qs = qs.filter(activo=True)

        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(dni__icontains=search)
                | Q(apellido__icontains=search)
                | Q(nombre__icontains=search)
                | Q(telefono__icontains=search)
            )
        return qs


class VehiculoViewSet(viewsets.ModelViewSet):
    """
    HU-003: Gestión de vehículos asociados a clientes.
    Soporta búsqueda por patente, marca, modelo o DNI/apellido del propietario.
    """

    queryset = Vehiculo.objects.select_related("cliente").all().order_by("patente")
    serializer_class = VehiculoSerializer
    permission_classes = [IsAdminOrAdministrativoWriteOperarioRead]

    def get_queryset(self):
        qs = super().get_queryset()
        id_cliente = self.request.query_params.get("id_cliente")
        if id_cliente:
            qs = qs.filter(cliente_id=id_cliente)

        search = (self.request.query_params.get("search") or "").strip()
        if search:
            cleaned_patente = search.replace(" ", "").replace("-", "")
            qs = qs.filter(
                Q(patente__icontains=cleaned_patente)
                | Q(marca__icontains=search)
                | Q(modelo__icontains=search)
                | Q(cliente__apellido__icontains=search)
                | Q(cliente__dni__icontains=search)
            )
        return qs


class CompaniaAseguradoraViewSet(viewsets.ModelViewSet):
    """
    HU-004: Gestión de compañías aseguradoras y plazos de pago.
    Restringido a perfiles Administrador y Administrativo (HTTP 403 para Operario).
    """

    queryset = CompaniaAseguradora.objects.all().order_by("razon_social")
    serializer_class = CompaniaAseguradoraSerializer
    permission_classes = [IsAdministrativoOrAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(razon_social__icontains=search)
                | Q(cuit__icontains=search)
                | Q(email_peritos__icontains=search)
            )
        return qs
