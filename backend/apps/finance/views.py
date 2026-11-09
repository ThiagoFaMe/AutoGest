"""
Vistas y endpoints REST para el módulo Financiero, Cuentas por Cobrar y Dashboard de KPIs (HU-013 y HU-014).
Restringido exclusivamente a roles Administrador y Administrativo (HU-001 Criterio 4 - HTTP 403 a Operario).
"""
from django.db.models import Case, IntegerField, Q, Value, When
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsAdministrativoOrAdmin
from apps.workorders.models import OrdenDeTrabajo
from .models import CuentaPorCobrar, MovimientoFinanciero
from .serializers import (
    CuentaPorCobrarSerializer,
    EmitirFacturaInputSerializer,
    MovimientoFinancieroSerializer,
    RegistrarMovimientoFinancieroInputSerializer,
)
from .services import (
    actualizar_movimiento_financiero,
    calcular_kpis_dashboard,
    eliminar_movimiento_financiero,
    emitir_factura_cuenta_por_cobrar,
    registrar_movimiento_financiero,
    sincronizar_estados_mora_cuentas,
)


class CuentaPorCobrarViewSet(viewsets.ReadOnlyModelViewSet):
    """
    HU-013: Seguimiento de cuentas por cobrar a aseguradoras, vencimientos y cálculo de mora.
    - Al consultarse, sincroniza automáticamente el estado 'vencida_en_mora' y ubica
      al tope del listado las facturas vencidas en mora (Criterio 2).
    - Acción POST /api/finance/cuentas/emitir-factura/ para facturar una OT y calcular
      fecha_vencimiento = fecha_emision + plazo_pago_dias.
    """

    serializer_class = CuentaPorCobrarSerializer
    permission_classes = [IsAdministrativoOrAdmin]

    def get_queryset(self):
        sincronizar_estados_mora_cuentas()
        qs = (
            CuentaPorCobrar.objects.select_related(
                "orden__vehiculo__cliente", "compania"
            )
            .annotate(
                prioridad_mora=Case(
                    When(
                        estado_cobranza=CuentaPorCobrar.EstadoCobranza.VENCIDA_EN_MORA,
                        then=Value(0),
                    ),
                    When(
                        estado_cobranza=CuentaPorCobrar.EstadoCobranza.PAGO_PARCIAL,
                        then=Value(1),
                    ),
                    When(
                        estado_cobranza=CuentaPorCobrar.EstadoCobranza.PENDIENTE_EN_PLAZO,
                        then=Value(2),
                    ),
                    default=Value(3),
                    output_field=IntegerField(),
                )
            )
            .order_by("prioridad_mora", "fecha_vencimiento", "-id_cuenta")
        )

        estado = (self.request.query_params.get("estado_cobranza") or "").strip()
        id_compania = self.request.query_params.get("id_compania")
        search = (self.request.query_params.get("search") or "").strip()

        if estado:
            qs = qs.filter(estado_cobranza=estado)
        if id_compania:
            qs = qs.filter(compania_id=id_compania)
        if search:
            qs = qs.filter(
                Q(nro_factura__icontains=search)
                | Q(orden__codigo_seguimiento__icontains=search)
                | Q(orden__vehiculo__patente__icontains=search)
                | Q(compania__razon_social__icontains=search)
            )
        return qs

    @action(detail=False, methods=["post"], url_path="emitir-factura")
    def emitir_factura(self, request):
        serializer = EmitirFacturaInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        orden = get_object_or_404(OrdenDeTrabajo, pk=data["id_orden"])
        cuenta = emitir_factura_cuenta_por_cobrar(
            orden=orden,
            nro_factura=data["nro_factura"],
            fecha_emision=data.get("fecha_emision"),
            monto_facturado=data.get("monto_facturado"),
        )
        if cuenta.compania:
            detail_msg = (
                f"Factura {cuenta.nro_factura} emitida. "
                f"Vencimiento calculado: {cuenta.fecha_vencimiento:%d/%m/%Y} "
                f"(Plazo: {cuenta.compania.plazo_pago_dias} días)."
            )
        else:
            detail_msg = (
                f"Factura {cuenta.nro_factura} emitida para cliente particular. "
                f"Vencimiento en el día: {cuenta.fecha_vencimiento:%d/%m/%Y}."
            )
        return Response(
            {
                "detail": detail_msg,
                "cuenta": CuentaPorCobrarSerializer(cuenta).data,
            },
            status=status.HTTP_201_CREATED,
        )


class MovimientoFinancieroViewSet(viewsets.ModelViewSet):
    """
    HU-014: Registro, consulta, edición y eliminación de movimientos financieros (ingresos por cobros y egresos).
    """

    queryset = (
        MovimientoFinanciero.objects.select_related("orden", "cuenta", "usuario")
        .all()
        .order_by("-fecha", "-id_movimiento")
    )
    serializer_class = MovimientoFinancieroSerializer
    permission_classes = [IsAdministrativoOrAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        tipo = (self.request.query_params.get("tipo") or "").strip()
        id_orden = self.request.query_params.get("id_orden")
        id_cuenta = self.request.query_params.get("id_cuenta")

        if tipo:
            qs = qs.filter(tipo=tipo)
        if id_orden:
            qs = qs.filter(orden_id=id_orden)
        if id_cuenta:
            qs = qs.filter(cuenta_id=id_cuenta)
        return qs

    @action(detail=False, methods=["post"], url_path="registrar")
    def registrar(self, request):
        serializer = RegistrarMovimientoFinancieroInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        orden = None
        if data.get("id_orden"):
            orden = get_object_or_404(OrdenDeTrabajo, pk=data["id_orden"])

        cuenta = None
        if data.get("id_cuenta"):
            cuenta = get_object_or_404(CuentaPorCobrar, pk=data["id_cuenta"])

        resultado = registrar_movimiento_financiero(
            tipo=data["tipo"],
            categoria=data["categoria"],
            concepto=data["concepto"],
            monto=data["monto"],
            medio_pago=data["medio_pago"],
            usuario=request.user,
            fecha=data.get("fecha"),
            orden=orden,
            cuenta=cuenta,
        )

        return Response(
            {
                "detail": resultado["detail"],
                "movimiento": MovimientoFinancieroSerializer(
                    resultado["movimiento"]
                ).data,
                "cuenta": (
                    CuentaPorCobrarSerializer(resultado["cuenta"]).data
                    if resultado["cuenta"]
                    else None
                ),
            },
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        return self._handle_update(request)

    def partial_update(self, request, *args, **kwargs):
        return self._handle_update(request)

    def _handle_update(self, request):
        movimiento = self.get_object()
        serializer = RegistrarMovimientoFinancieroInputSerializer(
            data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        resultado = actualizar_movimiento_financiero(
            movimiento=movimiento,
            tipo=data.get("tipo"),
            categoria=data.get("categoria"),
            concepto=data.get("concepto"),
            monto=data.get("monto"),
            medio_pago=data.get("medio_pago"),
            fecha=data.get("fecha"),
        )
        return Response(
            {
                "detail": resultado["detail"],
                "movimiento": MovimientoFinancieroSerializer(
                    resultado["movimiento"]
                ).data,
                "cuenta": (
                    CuentaPorCobrarSerializer(resultado["cuenta"]).data
                    if resultado["cuenta"]
                    else None
                ),
            },
            status=status.HTTP_200_OK,
        )

    def destroy(self, request, *args, **kwargs):
        movimiento = self.get_object()
        resultado = eliminar_movimiento_financiero(movimiento=movimiento)
        return Response(resultado, status=status.HTTP_200_OK)


class DashboardKPIsAPIView(APIView):
    """
    HU-014 Criterio 3 (Prototipo 1):
    Endpoint consolidado de indicadores clave (KPIs) en tiempo real.
    """

    permission_classes = [IsAdministrativoOrAdmin]

    def get(self, request):
        kpis = calcular_kpis_dashboard()
        return Response(kpis, status=status.HTTP_200_OK)
