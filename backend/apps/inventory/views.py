"""
Vistas y endpoints REST para el módulo de Inventario de Pañol y Consumo por Orden de Trabajo:
- InsumoRepuestoViewSet (HU-010): ABM del catálogo de insumos/repuestos y alertas de stock_minimo.
- MovimientoStockViewSet (HU-011 y HU-012): Historial transaccional, acción de ingreso por remito
  (exclusiva para Administrativo/Administrador) y acción de egreso por consumo en OT (habilitada
  también para Operarios de taller según Tabla 21 del TFG).
"""
from django.db.models import F, Q
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.users.permissions import (
    IsAdminOrAdministrativoWriteOperarioRead,
    IsAdministrativoOrAdmin,
)
from apps.workorders.models import OrdenDeTrabajo
from .models import InsumoRepuesto, MovimientoStock
from .serializers import (
    ConsumoOTInputSerializer,
    IngresoStockInputSerializer,
    InsumoRepuestoSerializer,
    MovimientoStockSerializer,
)
from .services import registrar_consumo_ot, registrar_ingreso_stock


class InsumoRepuestoViewSet(viewsets.ModelViewSet):
    """
    HU-010: Gestión del catálogo de insumos químicos y repuestos con stock_minimo.
    - Administrador y Administrativo: Alta, edición y configuración de umbrales.
    - Operario: Lectura del catálogo para seleccionar materiales consumidos en OT.
    """

    queryset = InsumoRepuesto.objects.all().order_by("codigo")
    serializer_class = InsumoRepuestoSerializer
    permission_classes = [IsAdminOrAdministrativoWriteOperarioRead]

    def get_queryset(self):
        qs = super().get_queryset()
        search = (self.request.query_params.get("search") or "").strip()
        categoria = (self.request.query_params.get("categoria") or "").strip()
        solo_alerta = (self.request.query_params.get("solo_alerta") or "").lower()

        if categoria:
            qs = qs.filter(categoria=categoria)
        if solo_alerta in ("true", "1", "yes"):
            qs = qs.filter(stock_actual__lte=F("stock_minimo"))
        if search:
            qs = qs.filter(
                Q(codigo__icontains=search)
                | Q(nombre__icontains=search)
                | Q(categoria__icontains=search)
            )
        return qs


class MovimientoStockViewSet(viewsets.ReadOnlyModelViewSet):
    """
    HU-011 y HU-012:
    - Listado de movimientos de stock filtrables por insumo, orden de trabajo o tipo.
    - POST /api/inventory/movimientos/registrar-ingreso/ (Administrativo/Admin - HU-011).
    - POST /api/inventory/movimientos/registrar-consumo/ (Operario/Administrativo/Admin - HU-012).
    """

    queryset = (
        MovimientoStock.objects.select_related(
            "insumo", "orden__vehiculo", "usuario"
        )
        .all()
        .order_by("-fecha_hora", "-id_mov_stock")
    )
    serializer_class = MovimientoStockSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        id_insumo = self.request.query_params.get("id_insumo")
        id_orden = self.request.query_params.get("id_orden")
        tipo_movimiento = (
            self.request.query_params.get("tipo_movimiento") or ""
        ).strip()

        if id_insumo:
            qs = qs.filter(insumo_id=id_insumo)
        if id_orden:
            qs = qs.filter(orden_id=id_orden)
        if tipo_movimiento:
            qs = qs.filter(tipo_movimiento=tipo_movimiento)
        return qs

    @action(
        detail=False,
        methods=["post"],
        url_path="registrar-ingreso",
        permission_classes=[IsAdministrativoOrAdmin],
    )
    def registrar_ingreso(self, request):
        """
        HU-011: Registro de ingresos de stock por compras y remitos de proveedores.
        """
        serializer = IngresoStockInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        insumo = get_object_or_404(InsumoRepuesto, pk=data["id_insumo"])
        resultado = registrar_ingreso_stock(
            insumo=insumo,
            cantidad=data["cantidad"],
            costo_unitario=data["costo_unitario"],
            remito_comprobante=data["remito_comprobante"],
            usuario=request.user,
        )

        return Response(
            {
                "detail": resultado["detail"],
                "alerta_desactivada": resultado["alerta_desactivada"],
                "movimiento": MovimientoStockSerializer(
                    resultado["movimiento"], context={"request": request}
                ).data,
                "insumo": InsumoRepuestoSerializer(
                    resultado["insumo"], context={"request": request}
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="registrar-consumo",
        permission_classes=[IsAuthenticated],
    )
    def registrar_consumo(self, request):
        """
        HU-012: Registro de consumo de insumos vinculado a Orden de Trabajo activa.
        Accesible tanto para Operario de Taller como para Administrativo y Administrador.
        """
        serializer = ConsumoOTInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        insumo = get_object_or_404(InsumoRepuesto, pk=data["id_insumo"])
        orden = None
        if data.get("id_orden"):
            orden = get_object_or_404(OrdenDeTrabajo, pk=data["id_orden"])

        resultado = registrar_consumo_ot(
            insumo=insumo,
            orden=orden,
            cantidad=data["cantidad"],
            usuario=request.user,
            observacion_comprobante=data.get("observacion_comprobante", ""),
        )

        return Response(
            {
                "detail": resultado["detail"],
                "alerta_stock_minimo": resultado["alerta_stock_minimo"],
                "costo_acumulado_ot": str(resultado["costo_acumulado_ot"]),
                "movimiento": MovimientoStockSerializer(
                    resultado["movimiento"], context={"request": request}
                ).data,
                "insumo": InsumoRepuestoSerializer(
                    resultado["insumo"], context={"request": request}
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )
