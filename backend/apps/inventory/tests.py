"""
Suite de pruebas automatizadas para el Sprint 4 (Inventario de Pañol y Consumo por OT):
- HU-010: Gestión del catálogo de insumos, repuestos, validación de código único,
          stock_minimo >= 0 y etiquetado automático de 'Bajo Stock / Reposición Crítica'
          cuando stock_actual <= stock_minimo.
- HU-011: Registro atómico de ingresos de stock por compras/remitos, actualización de
          stock_actual y costo_unitario, y desactivación automática de alerta de reposición.
- HU-012: Registro de consumo de insumos por Orden de Trabajo activa, bloqueo estricto
          si no se selecciona OT o si Cantidad > stock_actual (sin stock negativo),
          cálculo del costo acumulado de materiales de la OT y disparo de alerta de stock mínimo.
"""
from datetime import date, timedelta
from decimal import Decimal
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.budgets.models import Presupuesto
from apps.budgets.services import (
    aprobar_presupuesto_y_crear_ot,
    build_items_from_taller_forms,
    emitir_presupuesto,
    recalculate_budget_totals,
)
from apps.core.models import Cliente, Vehiculo
from apps.users.models import Usuario
from .models import InsumoRepuesto


class Sprint4InventarioConsumosTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = Usuario.objects.create_user(
            email="sergio@tallersergio.com",
            nombre_completo="Sergio Martín",
            password="AdminPassword123!",
            rol=Usuario.Rol.ADMINISTRADOR,
        )
        self.operario = Usuario.objects.create_user(
            email="carlos@tallersergio.com",
            nombre_completo="Carlos Chapista",
            password="OperarioPassword123!",
            rol=Usuario.Rol.OPERARIO,
        )

        self.cliente = Cliente.objects.create(
            dni="30987654",
            nombre="Roberto",
            apellido="Almada",
            telefono="351-5432198",
        )
        self.vehiculo = Vehiculo.objects.create(
            patente="AA891BC",
            marca="Ford",
            modelo="Focus III",
            anio=2018,
            color="Blanco Oxford",
            cliente=self.cliente,
        )

        presupuesto = Presupuesto.objects.create(
            tipo=Presupuesto.Tipo.PARTICULAR,
            cliente=self.cliente,
            vehiculo=self.vehiculo,
            detalle_libre="Focus AA891BC - Pintura lateral",
            rubros_importes={"mano_obra": 450000, "total_final": 450000},
        )
        build_items_from_taller_forms(presupuesto)
        recalculate_budget_totals(presupuesto)
        emitir_presupuesto(presupuesto)

        self.orden = aprobar_presupuesto_y_crear_ot(
            presupuesto=presupuesto,
            fecha_estimada_entrega=date.today() + timedelta(days=7),
        )

    def test_hu010_catalogo_unicidad_codigo_y_alerta_stock_minimo(self):
        """
        HU-010 Criterios 1 y 2:
        - Valida código único y stock_minimo >= 0.
        - Etiqueta con 'Bajo Stock / Reposición Crítica' cuando stock_actual <= stock_minimo.
        """
        self.client.force_authenticate(user=self.admin)

        res_alta = self.client.post(
            "/api/inventory/insumos/",
            {
                "codigo": "ins-001",
                "nombre": "Barniz Poliuretánico Alto Sólido 2K",
                "categoria": "Pintura",
                "unidad_medida": "Litros",
                "stock_actual": "2.00",
                "stock_minimo": "4.00",
                "costo_unitario": "32000.00",
            },
            format="json",
        )
        self.assertEqual(res_alta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_alta.data["codigo"], "INS-001")
        self.assertTrue(res_alta.data["en_alerta_stock"])
        self.assertEqual(
            res_alta.data["estado_stock"], "Bajo Stock / Reposición Crítica"
        )

        # Intentar duplicar el mismo código INS-001
        res_dup = self.client.post(
            "/api/inventory/insumos/",
            {
                "codigo": "INS-001",
                "nombre": "Otro Barniz",
                "categoria": "Pintura",
                "unidad_medida": "Litros",
                "stock_actual": "10.00",
                "stock_minimo": "2.00",
                "costo_unitario": "25000.00",
            },
            format="json",
        )
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)

    def test_hu011_ingreso_por_remito_incrementa_stock_y_desactiva_alerta(self):
        """
        HU-011 Criterios 1 y 2:
        - Un ingreso de compra con remito incrementa stock_actual de forma atómica.
        - Si estaba en bajo stock y supera stock_minimo, desactiva automáticamente la alerta.
        - Además verifica que un Operario no pueda registrar compras (HTTP 403).
        """
        insumo = InsumoRepuesto.objects.create(
            codigo="INS-010",
            nombre="Primer Poliuretánico Gris",
            categoria="Preparación",
            unidad_medida="Litros",
            stock_actual=Decimal("1.50"),
            stock_minimo=Decimal("3.00"),
            costo_unitario=Decimal("18500.00"),
        )
        self.assertTrue(insumo.en_alerta_stock)

        # Operario intenta registrar compra -> HTTP 403
        self.client.force_authenticate(user=self.operario)
        res_forbidden = self.client.post(
            "/api/inventory/movimientos/registrar-ingreso/",
            {
                "id_insumo": insumo.id_insumo,
                "cantidad": "5.00",
                "costo_unitario": "19000.00",
                "remito_comprobante": "REM-0004-00129",
            },
            format="json",
        )
        self.assertEqual(res_forbidden.status_code, status.HTTP_403_FORBIDDEN)

        # Administrador registra el ingreso por remito -> HTTP 201
        self.client.force_authenticate(user=self.admin)
        res_ing = self.client.post(
            "/api/inventory/movimientos/registrar-ingreso/",
            {
                "id_insumo": insumo.id_insumo,
                "cantidad": "5.00",
                "costo_unitario": "19500.00",
                "remito_comprobante": "REM-0004-00129 Pinturerías Rex",
            },
            format="json",
        )
        self.assertEqual(res_ing.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res_ing.data["alerta_desactivada"])

        insumo.refresh_from_db()
        self.assertEqual(insumo.stock_actual, Decimal("6.50"))
        self.assertEqual(insumo.costo_unitario, Decimal("19500.00"))
        self.assertFalse(insumo.en_alerta_stock)

    def test_hu012_consumo_por_ot_bloquea_exceso_descuenta_y_acumula_costo_en_ot(self):
        """
        HU-012 Criterios 1, 2 y 3:
        - Bloquea egreso si no se indica OT activa o si Cantidad > stock_actual.
        - Descuenta stock_actual, acumula costo de materiales en la OT y dispara alerta
          si el remanente queda <= stock_minimo.
        """
        insumo = InsumoRepuesto.objects.create(
            codigo="INS-025",
            nombre="Masilla Poliéster Ultraliviana",
            categoria="Preparación",
            unidad_medida="Kilogramos",
            stock_actual=Decimal("4.00"),
            stock_minimo=Decimal("2.00"),
            costo_unitario=Decimal("15000.00"),
        )

        self.client.force_authenticate(user=self.operario)

        # 1. Intento de consumo sin Orden de Trabajo -> bloqueado (HTTP 400)
        res_sin_ot = self.client.post(
            "/api/inventory/movimientos/registrar-consumo/",
            {
                "id_insumo": insumo.id_insumo,
                "id_orden": None,
                "cantidad": "1.00",
            },
            format="json",
        )
        self.assertEqual(res_sin_ot.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Intento de consumo superando stock disponible (6.00 > 4.00) -> bloqueado (HTTP 400)
        res_exceso = self.client.post(
            "/api/inventory/movimientos/registrar-consumo/",
            {
                "id_insumo": insumo.id_insumo,
                "id_orden": self.orden.id_orden,
                "cantidad": "6.00",
            },
            format="json",
        )
        self.assertEqual(res_exceso.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Stock insuficiente", str(res_exceso.data))

        # 3. Consumo válido de 2.50 kg -> deja stock en 1.50 kg (<= 2.00 -> dispara alerta)
        #    y acumula 2.50 * 15000 = $37,500.00 en la Orden de Trabajo.
        res_ok = self.client.post(
            "/api/inventory/movimientos/registrar-consumo/",
            {
                "id_insumo": insumo.id_insumo,
                "id_orden": self.orden.id_orden,
                "cantidad": "2.50",
                "observacion_comprobante": "Masillado guardabarros trasero",
            },
            format="json",
        )
        self.assertEqual(res_ok.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res_ok.data["alerta_stock_minimo"])
        self.assertEqual(res_ok.data["costo_acumulado_ot"], "37500.00")

        insumo.refresh_from_db()
        self.assertEqual(insumo.stock_actual, Decimal("1.50"))
        self.assertTrue(insumo.en_alerta_stock)
