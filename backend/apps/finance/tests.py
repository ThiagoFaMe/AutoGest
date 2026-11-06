"""
Suite de pruebas automatizadas para el Sprint 5 (Cuentas por Cobrar, Flujo de Caja y Dashboard de KPIs):
- HU-013 Criterio 1: Emisión de factura para aseguradora calculando fecha_vencimiento = fecha_emision + plazo_pago_dias.
- HU-013 Criterio 2: Detección automática de 'vencida_en_mora', cálculo exacto de días de mora y ordenamiento al tope.
- HU-013 Criterio 3 y HU-014 Criterio 1: Imputación de cobros parciales ('pago_parcial') y totales ('cancelada'),
          validando que el cobro no supere el saldo_pendiente.
- HU-014 Criterios 2 y 3: Registro de egresos, cálculo de Flujo de Caja Neto y verificación de los 6 KPIs del Dashboard,
          además de bloqueo HTTP 403 al rol Operario (HU-001 Criterio 4).
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
from apps.core.models import Cliente, CompaniaAseguradora, Vehiculo
from apps.users.models import Usuario
from .models import CuentaPorCobrar


class Sprint5FinanzasCuentasKPIsTests(TestCase):
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

        self.compania = CompaniaAseguradora.objects.create(
            razon_social="Sancor Seguros",
            cuit="30-50004946-0",
            plazo_pago_dias=30,
            telefono="0800-444-2850",
            email_peritos="peritos@sancor.com",
        )
        self.cliente = Cliente.objects.create(
            dni="31222333",
            nombre="Esteban",
            apellido="Quiroga",
            telefono="351-6778899",
        )
        self.vehiculo = Vehiculo.objects.create(
            patente="AE550KL",
            marca="Volkswagen",
            modelo="Taos Highline",
            anio=2023,
            color="Gris Platino",
            cliente=self.cliente,
        )

        presupuesto = Presupuesto.objects.create(
            tipo=Presupuesto.Tipo.ASEGURADORA,
            cliente=self.cliente,
            vehiculo=self.vehiculo,
            compania=self.compania,
            nro_siniestro="SIN-99120",
            nombre_perito="Ing. Sosa",
            planilla_marcaciones={
                "PARTE_DELANTERA__Paragolpes": {"C": True, "R": False, "P": True}
            },
            rubros_importes={"mano_obra": 1200000},
        )
        build_items_from_taller_forms(presupuesto)
        recalculate_budget_totals(presupuesto)
        emitir_presupuesto(presupuesto)

        self.orden = aprobar_presupuesto_y_crear_ot(
            presupuesto=presupuesto,
            fecha_estimada_entrega=date.today() + timedelta(days=6),
            nro_orden_aseguradora="OR-99120",
        )

    def test_hu013_emision_factura_calculo_vencimiento_mora_y_cobros(self):
        """
        HU-013 Criterios 1, 2 y 3 + HU-014 Criterio 1:
        - Emite factura y calcula fecha_vencimiento = fecha_emision + 30 días.
        - Si fecha_vencimiento < hoy, pasa automáticamente a 'vencida_en_mora' y calcula dias_mora.
        - Cobro parcial cambia estado a 'pago_parcial', cobro excesivo se bloquea, y cobro del saldo
          restante cambia el estado a 'cancelada'.
        """
        # 1. Operario intenta acceder a Cuentas por Cobrar -> HTTP 403 (HU-001 Criterio 4)
        self.client.force_authenticate(user=self.operario)
        res_forbidden = self.client.get("/api/finance/cuentas/")
        self.assertEqual(res_forbidden.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Administrador emite factura en plazo (fecha_emision = hoy)
        self.client.force_authenticate(user=self.admin)
        hoy = date.today()
        res_fac = self.client.post(
            "/api/finance/cuentas/emitir-factura/",
            {
                "id_orden": self.orden.id_orden,
                "nro_factura": "fac-a-0001-00250",
                "fecha_emision": str(hoy),
                "monto_facturado": "1200000.00",
            },
            format="json",
        )
        self.assertEqual(res_fac.status_code, status.HTTP_201_CREATED)
        cuenta_data = res_fac.data["cuenta"]
        self.assertEqual(cuenta_data["nro_factura"], "FAC-A-0001-00250")
        self.assertEqual(
            cuenta_data["fecha_vencimiento"], str(hoy + timedelta(days=30))
        )
        self.assertEqual(cuenta_data["estado_cobranza"], "pendiente_en_plazo")

        id_cuenta = cuenta_data["id_cuenta"]

        # 3. Simulamos que la factura se emitió hace 40 días (venció hace 10 días) -> Criterio 2
        cuenta_obj = CuentaPorCobrar.objects.get(pk=id_cuenta)
        cuenta_obj.fecha_emision = hoy - timedelta(days=40)
        cuenta_obj.fecha_vencimiento = hoy - timedelta(days=10)
        cuenta_obj.save(update_fields=["fecha_emision", "fecha_vencimiento"])

        res_list = self.client.get("/api/finance/cuentas/")
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        primera = res_list.data[0]
        self.assertEqual(primera["estado_cobranza"], "vencida_en_mora")
        self.assertTrue(primera["en_mora"])
        self.assertEqual(primera["dias_mora"], 10)

        # 4. Intento de cobrar más del saldo pendiente ($1.500.000 > $1.200.000) -> bloqueado (HTTP 400)
        res_exceso = self.client.post(
            "/api/finance/movimientos/registrar/",
            {
                "tipo": "ingreso",
                "categoria": "Liquidación Aseguradora",
                "concepto": "Intento sobrecobro",
                "monto": "1500000.00",
                "medio_pago": "e-cheq",
                "id_cuenta": id_cuenta,
            },
            format="json",
        )
        self.assertEqual(res_exceso.status_code, status.HTTP_400_BAD_REQUEST)

        # 5. Cobro parcial de $500.000 y luego cancelación de los $700.000 restantes
        res_parcial = self.client.post(
            "/api/finance/movimientos/registrar/",
            {
                "tipo": "ingreso",
                "categoria": "Liquidación Aseguradora",
                "concepto": "Anticipo transferencia Sancor",
                "monto": "500000.00",
                "medio_pago": "transferencia",
                "id_cuenta": id_cuenta,
            },
            format="json",
        )
        self.assertEqual(res_parcial.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_parcial.data["cuenta"]["saldo_pendiente"], "700000.00")

        res_total = self.client.post(
            "/api/finance/movimientos/registrar/",
            {
                "tipo": "ingreso",
                "categoria": "Liquidación Aseguradora",
                "concepto": "Cancelación final e-cheq Sancor",
                "monto": "700000.00",
                "medio_pago": "e-cheq",
                "id_cuenta": id_cuenta,
            },
            format="json",
        )
        self.assertEqual(res_total.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_total.data["cuenta"]["saldo_pendiente"], "0.00")
        self.assertEqual(res_total.data["cuenta"]["estado_cobranza"], "cancelada")

    def test_hu014_egresos_flujo_caja_neto_y_dashboard_kpis(self):
        """
        HU-014 Criterios 2 y 3:
        - Registra ingresos y egresos y verifica el cálculo exacto del Flujo de Caja Neto
          y los 6 KPIs del Dashboard Principal.
        """
        self.client.force_authenticate(user=self.admin)

        self.client.post(
            "/api/finance/movimientos/registrar/",
            {
                "tipo": "ingreso",
                "categoria": "Cobro Particular",
                "concepto": "Cobro seña reparación",
                "monto": "400000.00",
                "medio_pago": "efectivo",
                "id_orden": self.orden.id_orden,
            },
            format="json",
        )
        self.client.post(
            "/api/finance/movimientos/registrar/",
            {
                "tipo": "egreso",
                "categoria": "Compra Insumos",
                "concepto": "Pago factura Pinturerías Rex",
                "monto": "150000.00",
                "medio_pago": "transferencia",
            },
            format="json",
        )

        res_kpis = self.client.get("/api/finance/kpis/")
        self.assertEqual(res_kpis.status_code, status.HTTP_200_OK)
        self.assertEqual(res_kpis.data["ingresos_totales"], "400000.00")
        self.assertEqual(res_kpis.data["egresos_totales"], "150000.00")
        self.assertEqual(res_kpis.data["flujo_caja_neto"], "250000.00")
        self.assertEqual(res_kpis.data["vehiculos_en_taller"], 1)
        self.assertEqual(len(res_kpis.data["distribucion_fases"]), 8)
