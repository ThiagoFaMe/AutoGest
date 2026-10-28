"""
Suite de pruebas automatizadas para el Sprint 2:
- HU-005: Confección y emisión de presupuestos para particulares
- HU-006: Confección y emisión de presupuestos para aseguradoras
- HU-007: Aprobación/rechazo y generación automática 1:1 de Orden de Trabajo con sus 8 fases
"""
from datetime import date, timedelta
from decimal import Decimal
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.core.models import Cliente, CompaniaAseguradora, Vehiculo
from apps.users.models import Usuario
from apps.workorders.models import FaseReparacion, OrdenDeTrabajo
from .models import Presupuesto


class Sprint2PresupuestosYOrdenTrabajoTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.administrativo = Usuario.objects.create_user(
            email="laura@tallersergio.com",
            nombre_completo="Laura Administración",
            password="AdminPassword123!",
            rol=Usuario.Rol.ADMINISTRATIVO,
        )
        self.client.force_authenticate(user=self.administrativo)

        self.cliente = Cliente.objects.create(
            dni="32458910",
            nombre="Mariano",
            apellido="Ferreira",
            telefono="351-6124890",
        )
        self.vehiculo = Vehiculo.objects.create(
            patente="AF482KL",
            marca="Volkswagen",
            modelo="Amarok V6",
            anio=2022,
            color="Gris Indium",
            cliente=self.cliente,
        )
        self.aseguradora = CompaniaAseguradora.objects.create(
            razon_social="Sancor Seguros",
            cuit="30-50004946-0",
            plazo_pago_dias=30,
        )

    def test_hu005_presupuesto_particular_calculo_y_emision_15_dias(self):
        """
        HU-005 Criterios 1, 2 y 3:
        - Recalcula subtotales de mano de obra + repuestos y monto total.
        - Bloquea emisión si no tiene ítems.
        - Al emitir asigna fecha_emision = hoy y fecha_vencimiento = hoy + 15 días.
        """
        # 1) Crear borrador vacío e intentar emitir -> debe fallar (Criterio 2)
        res_vacio = self.client.post(
            "/api/budgets/presupuestos/",
            {
                "tipo": "particular",
                "id_cliente": self.cliente.id_cliente,
                "id_vehiculo": self.vehiculo.id_vehiculo,
                "items": [],
            },
            format="json",
        )
        self.assertEqual(res_vacio.status_code, status.HTTP_201_CREATED)
        pres_id = res_vacio.data["id_presupuesto"]

        res_emitir_fail = self.client.post(f"/api/budgets/presupuestos/{pres_id}/emitir/")
        self.assertEqual(res_emitir_fail.status_code, status.HTTP_400_BAD_REQUEST)

        # 2) Cargar ítems de mano de obra chapa, pintura y repuesto (Criterio 1)
        res_update = self.client.patch(
            f"/api/budgets/presupuestos/{pres_id}/",
            {
                "items": [
                    {
                        "descripcion": "Desabolladura puerta delantera derecha",
                        "tipo_item": "mano_obra_chapa",
                        "cantidad": 1,
                        "precio_unitario": "120000.00",
                    },
                    {
                        "descripcion": "Pintura bicapa y barniz alto sólido (2 paños)",
                        "tipo_item": "mano_obra_pintura",
                        "cantidad": 2,
                        "precio_unitario": "95000.00",
                    },
                    {
                        "descripcion": "Moldura lateral original Amarok",
                        "tipo_item": "repuesto",
                        "cantidad": 1,
                        "precio_unitario": "85000.00",
                    },
                ]
            },
            format="json",
        )
        self.assertEqual(res_update.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(res_update.data["monto_mano_obra"]), Decimal("310000.00"))
        self.assertEqual(Decimal(res_update.data["monto_repuestos"]), Decimal("85000.00"))
        self.assertEqual(Decimal(res_update.data["monto_total"]), Decimal("395000.00"))

        # 3) Emitir presupuesto (Criterio 3)
        res_emitir_ok = self.client.post(f"/api/budgets/presupuestos/{pres_id}/emitir/")
        self.assertEqual(res_emitir_ok.status_code, status.HTTP_200_OK)
        pres_data = res_emitir_ok.data["presupuesto"]
        self.assertEqual(pres_data["estado"], "emitido")
        self.assertEqual(pres_data["fecha_emision"], str(date.today()))
        self.assertEqual(
            pres_data["fecha_vencimiento"], str(date.today() + timedelta(days=15))
        )

    def test_hu006_presupuesto_aseguradora_exige_siniestro_perito_y_excluye_repuestos(self):
        """
        HU-006 Criterios 1 y 2:
        - Exige compañía, nro_siniestro y nombre_perito.
        - Computa en monto_total solo mano de obra (monto_repuestos = 0 a cargo del seguro).
        """
        # Sin siniestro ni perito -> falla validación (Criterio 1)
        res_incompleto = self.client.post(
            "/api/budgets/presupuestos/",
            {
                "tipo": "aseguradora",
                "id_cliente": self.cliente.id_cliente,
                "id_vehiculo": self.vehiculo.id_vehiculo,
                "id_compania": self.aseguradora.id_compania,
                "nro_siniestro": "",
                "nombre_perito": "",
            },
            format="json",
        )
        self.assertEqual(res_incompleto.status_code, status.HTTP_400_BAD_REQUEST)

        # Con siniestro y perito + repuestos listados como referencia técnica (Criterio 2)
        res_ok = self.client.post(
            "/api/budgets/presupuestos/",
            {
                "tipo": "aseguradora",
                "id_cliente": self.cliente.id_cliente,
                "id_vehiculo": self.vehiculo.id_vehiculo,
                "id_compania": self.aseguradora.id_compania,
                "nro_siniestro": "SIN-2026-88412",
                "nombre_perito": "Ing. Roberto Sosa",
                "items": [
                    {
                        "descripcion": "Reemplazo y escuadrado de paragolpes delantero",
                        "tipo_item": "mano_obra_chapa",
                        "cantidad": 1,
                        "precio_unitario": "150000.00",
                    },
                    {
                        "descripcion": "Pintura paragolpes y capot en cabina",
                        "tipo_item": "mano_obra_pintura",
                        "cantidad": 2,
                        "precio_unitario": "110000.00",
                    },
                    {
                        "descripcion": "Paragolpes delantero provisto por Sancor Seguros",
                        "tipo_item": "repuesto",
                        "cantidad": 1,
                        "precio_unitario": "320000.00",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(res_ok.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(res_ok.data["monto_mano_obra"]), Decimal("370000.00"))
        self.assertEqual(Decimal(res_ok.data["monto_repuestos"]), Decimal("0.00"))
        self.assertEqual(Decimal(res_ok.data["monto_total"]), Decimal("370000.00"))

    def test_hu007_aprobacion_crea_ot_1a1_e_inicializa_8_fases(self):
        """
        HU-007 Criterios 1, 2 y 3:
        - Al aprobar un presupuesto emitido se crea automáticamente la OrdenDeTrabajo (1:1)
          con saldo_pendiente = monto_total.
        - Se inicializan las 8 fases en FaseReparacion del 1 al 8.
        - Se bloquea cualquier intento de duplicar la OT sobre el mismo presupuesto.
        """
        res_create = self.client.post(
            "/api/budgets/presupuestos/",
            {
                "tipo": "aseguradora",
                "id_cliente": self.cliente.id_cliente,
                "id_vehiculo": self.vehiculo.id_vehiculo,
                "id_compania": self.aseguradora.id_compania,
                "nro_siniestro": "SIN-2026-99100",
                "nombre_perito": "Perito Marcos Díaz",
                "items": [
                    {
                        "descripcion": "Reparación y pintura guardabarros trasero",
                        "tipo_item": "mano_obra_pintura",
                        "cantidad": 1,
                        "precio_unitario": "240000.00",
                    }
                ],
            },
            format="json",
        )
        pres_id = res_create.data["id_presupuesto"]
        self.client.post(f"/api/budgets/presupuestos/{pres_id}/emitir/")

        fecha_entrega = date.today() + timedelta(days=7)
        res_aprobar = self.client.post(
            f"/api/budgets/presupuestos/{pres_id}/aprobar/",
            {
                "fecha_estimada_entrega": str(fecha_entrega),
                "nro_orden_aseguradora": "OR-SANCOR-5512",
            },
            format="json",
        )
        self.assertEqual(res_aprobar.status_code, status.HTTP_201_CREATED)

        ot = OrdenDeTrabajo.objects.get(presupuesto_id=pres_id)
        self.assertEqual(ot.monto_total, Decimal("240000.00"))
        self.assertEqual(ot.saldo_pendiente, Decimal("240000.00"))
        self.assertEqual(ot.nro_orden_aseguradora, "OR-SANCOR-5512")

        # Verificar las 8 fases operativas creadas en orden secuencial 1..8 (Criterio 2)
        fases = list(FaseReparacion.objects.filter(orden=ot).order_by("numero_secuencia"))
        self.assertEqual(len(fases), 8)
        self.assertEqual(fases[0].numero_secuencia, 1)
        self.assertEqual(fases[0].nombre_fase, "Recepción")
        self.assertEqual(fases[7].numero_secuencia, 8)
        self.assertEqual(fases[7].nombre_fase, "Alistado para entrega")

        # Criterio 3: Intentar aprobar nuevamente el mismo presupuesto -> bloqueado (1 a 1)
        res_dup = self.client.post(
            f"/api/budgets/presupuestos/{pres_id}/aprobar/",
            {
                "fecha_estimada_entrega": str(fecha_entrega),
                "nro_orden_aseguradora": "OR-SANCOR-5512",
            },
            format="json",
        )
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)
