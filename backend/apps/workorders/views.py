"""
Vistas y endpoints REST para el módulo de Órdenes de Trabajo y Fases de Reparación (HU-008 y HU-009).
"""
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsAdministrativoOrAdmin
from .models import OrdenDeTrabajo
from .serializers import (
    ConsultaPublicaOrdenSerializer,
    FaseAccionInputSerializer,
    OrdenDeTrabajoSerializer,
    RegistrarEntregaInputSerializer,
)
from .services import (
    completar_fase_reparacion,
    iniciar_fase_reparacion,
    registrar_entrega_vehiculo,
)


class OrdenDeTrabajoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    HU-008 y HU-009:
    - Consulta de Órdenes de Trabajo, línea de tiempo de fases, duraciones y alertas de demora.
    - Acciones transaccionales para iniciar fase, completar fase (bajo regla estricta n-1)
      y registrar entrega efectiva del vehículo al cliente.
    """

    queryset = (
        OrdenDeTrabajo.objects.select_related(
            "vehiculo__cliente", "compania", "presupuesto"
        )
        .prefetch_related("fases__usuario_responsable")
        .all()
        .order_by("-id_orden")
    )
    serializer_class = OrdenDeTrabajoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        search = (self.request.query_params.get("search") or "").strip()
        tipo_cliente = (self.request.query_params.get("tipo_cliente") or "").strip()
        estado_actual = (self.request.query_params.get("estado_actual") or "").strip()

        if tipo_cliente:
            qs = qs.filter(tipo_cliente=tipo_cliente)
        if estado_actual:
            qs = qs.filter(estado_actual__icontains=estado_actual)
        if search:
            qs = qs.filter(
                Q(codigo_seguimiento__icontains=search)
                | Q(vehiculo__patente__icontains=search)
                | Q(vehiculo__marca__icontains=search)
                | Q(vehiculo__modelo__icontains=search)
                | Q(vehiculo__cliente__apellido__icontains=search)
                | Q(vehiculo__cliente__dni__icontains=search)
                | Q(nro_orden_aseguradora__icontains=search)
                | Q(compania__razon_social__icontains=search)
            )
        return qs

    @action(detail=True, methods=["post"], url_path="iniciar-fase")
    def iniciar_fase(self, request, pk=None):
        """
        HU-008 Criterio 1:
        Inicia una fase validando que la fase inmediata anterior (n - 1) esté completada.
        """
        orden = self.get_object()
        serializer = FaseAccionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        fase = iniciar_fase_reparacion(
            orden=orden,
            numero_secuencia=serializer.validated_data["numero_secuencia"],
            usuario=request.user,
            observaciones=serializer.validated_data.get("observaciones", ""),
        )
        orden.refresh_from_db()
        return Response(
            {
                "detail": (
                    f"Fase '{fase.numero_secuencia}-{fase.nombre_fase}' iniciada correctamente "
                    f"por {request.user.nombre_completo}."
                ),
                "orden": OrdenDeTrabajoSerializer(
                    orden, context={"request": request}
                ).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="completar-fase")
    def completar_fase(self, request, pk=None):
        """
        HU-008 Criterios 1, 2 y 3:
        Completa la fase indicada (validando secuencia estricta n-1), registra fecha_fin e
        id_usuario_responsable, e inicia automáticamente la fase siguiente (n + 1).
        """
        orden = self.get_object()
        serializer = FaseAccionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        resultado = completar_fase_reparacion(
            orden=orden,
            numero_secuencia=serializer.validated_data["numero_secuencia"],
            usuario=request.user,
            observaciones=serializer.validated_data.get("observaciones", ""),
        )
        orden_actualizada = resultado["orden"]
        return Response(
            {
                "detail": resultado["detail"],
                "orden": OrdenDeTrabajoSerializer(
                    orden_actualizada, context={"request": request}
                ).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="registrar-entrega",
        permission_classes=[IsAdministrativoOrAdmin],
    )
    def registrar_entrega(self, request, pk=None):
        """
        HU-008 Criterio 3:
        Registra el retiro efectivo del vehículo por el cliente una vez completada la Fase 8.
        """
        orden = self.get_object()
        serializer = RegistrarEntregaInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        orden = registrar_entrega_vehiculo(
            orden=orden,
            fecha_entrega_real=serializer.validated_data.get("fecha_entrega_real"),
        )
        return Response(
            {
                "detail": (
                    f"Se registró la entrega efectiva del vehículo {orden.vehiculo.patente} "
                    f"(Orden {orden.codigo_seguimiento}). Ciclo técnico finalizado."
                ),
                "orden": OrdenDeTrabajoSerializer(
                    orden, context={"request": request}
                ).data,
            },
            status=status.HTTP_200_OK,
        )


class ConsultaPublicaSeguimientoAPIView(APIView):
    """
    Endpoint público de solo lectura (Tabla 21 del TFG: 'Consulta Externa - Cliente con Código').
    Permite consultar la fase actual de una unidad mediante su codigo_seguimiento (ej.: OT-2026-001)
    o su patente sin exponer información financiera ni de otros clientes.
    """

    permission_classes = [AllowAny]

    def get(self, request, codigo):
        clean_code = (codigo or "").strip().upper()
        orden = (
            OrdenDeTrabajo.objects.select_related("vehiculo")
            .prefetch_related("fases")
            .filter(
                Q(codigo_seguimiento__iexact=clean_code)
                | Q(vehiculo__patente__iexact=clean_code)
            )
            .order_by("-id_orden")
            .first()
        )
        if not orden:
            return Response(
                {
                    "detail": (
                        f"No se encontró ninguna Orden de Trabajo activa con el código o dominio '{clean_code}'."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(
            ConsultaPublicaOrdenSerializer(orden).data,
            status=status.HTTP_200_OK,
        )
