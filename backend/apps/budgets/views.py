"""
Vistas REST para confección, emisión, aprobación y rechazo de Presupuestos (HU-005, HU-006, HU-007).
"""
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.users.permissions import IsAdministrativoOrAdmin
from .models import Presupuesto
from .serializers import AprobarPresupuestoSerializer, PresupuestoSerializer
from .services import (
    aprobar_presupuesto_y_crear_ot,
    emitir_presupuesto,
    rechazar_presupuesto,
)


class PresupuestoViewSet(viewsets.ModelViewSet):
    """
    Gestiona el ciclo completo del presupuesto (Borrador -> Emitido -> Aprobado/Rechazado/Vencido).
    Restringido a perfiles Administrador y Administrativo (Tabla 21 TFG: Operarios no ven montos).
    """

    queryset = (
        Presupuesto.objects.select_related("vehiculo", "cliente", "compania", "orden_trabajo")
        .prefetch_related("items")
        .all()
        .order_by("-id_presupuesto")
    )
    serializer_class = PresupuestoSerializer
    permission_classes = [IsAdministrativoOrAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        tipo = (self.request.query_params.get("tipo") or "").strip()
        estado = (self.request.query_params.get("estado") or "").strip()
        search = (self.request.query_params.get("search") or "").strip()

        if tipo:
            qs = qs.filter(tipo=tipo)
        if estado:
            qs = qs.filter(estado=estado)
        if search:
            qs = qs.filter(
                Q(vehiculo__patente__icontains=search)
                | Q(cliente__apellido__icontains=search)
                | Q(cliente__dni__icontains=search)
                | Q(nro_siniestro__icontains=search)
                | Q(compania__razon_social__icontains=search)
            )
        return qs

    @action(detail=True, methods=["post"], url_path="emitir")
    def emitir(self, request, pk=None):
        """
        HU-005 Criterios 2 y 3:
        Cambia estado a 'emitido', asigna fecha_emision = hoy y fecha_vencimiento (+15 días).
        """
        presupuesto = self.get_object()
        presupuesto = emitir_presupuesto(presupuesto)
        return Response(
            {
                "detail": (
                    f"Presupuesto #{presupuesto.id_presupuesto} emitido formalmente. "
                    f"Válido hasta {presupuesto.fecha_vencimiento}."
                ),
                "presupuesto": PresupuestoSerializer(presupuesto).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="aprobar")
    def aprobar(self, request, pk=None):
        """
        HU-007 Criterios 1, 2 y 3:
        Aprueba el presupuesto emitido, genera automáticamente la OrdenDeTrabajo (1:1)
        e inicializa sus 8 fases operativas en FaseReparacion.
        """
        presupuesto = self.get_object()
        req_serializer = AprobarPresupuestoSerializer(data=request.data)
        req_serializer.is_valid(raise_exception=True)

        orden = aprobar_presupuesto_y_crear_ot(
            presupuesto=presupuesto,
            fecha_estimada_entrega=req_serializer.validated_data["fecha_estimada_entrega"],
            fecha_ingreso=req_serializer.validated_data.get("fecha_ingreso"),
            nro_orden_aseguradora=req_serializer.validated_data.get("nro_orden_aseguradora", ""),
        )
        presupuesto.refresh_from_db()
        return Response(
            {
                "detail": (
                    f"Presupuesto aprobado. Se generó automáticamente la Orden de Trabajo "
                    f"{orden.codigo_seguimiento} con sus 8 fases operativas inicializadas."
                ),
                "presupuesto": PresupuestoSerializer(presupuesto).data,
                "id_orden": orden.id_orden,
                "codigo_seguimiento": orden.codigo_seguimiento,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="rechazar")
    def rechazar(self, request, pk=None):
        """HU-007: Registra el rechazo del presupuesto emitido."""
        presupuesto = self.get_object()
        observaciones = request.data.get("observaciones", "")
        presupuesto = rechazar_presupuesto(presupuesto, observaciones=observaciones)
        return Response(
            {
                "detail": f"Presupuesto #{presupuesto.id_presupuesto} marcado como rechazado.",
                "presupuesto": PresupuestoSerializer(presupuesto).data,
            },
            status=status.HTTP_200_OK,
        )
