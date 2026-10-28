"""Vistas REST de Órdenes de Trabajo (HU-007; se amplía en Sprint 3 con HU-008/HU-009)."""
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import OrdenDeTrabajo
from .serializers import OrdenDeTrabajoSerializer


class OrdenDeTrabajoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Permite consultar las Órdenes de Trabajo generadas automáticamente al aprobar presupuestos
    junto con sus 8 fases secuenciales inicializadas en FaseReparacion.
    """

    queryset = (
        OrdenDeTrabajo.objects.select_related("vehiculo__cliente", "compania", "presupuesto")
        .prefetch_related("fases__usuario_responsable")
        .all()
        .order_by("-id_orden")
    )
    serializer_class = OrdenDeTrabajoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(codigo_seguimiento__icontains=search)
                | Q(vehiculo__patente__icontains=search)
                | Q(vehiculo__cliente__apellido__icontains=search)
                | Q(nro_orden_aseguradora__icontains=search)
            )
        return qs
