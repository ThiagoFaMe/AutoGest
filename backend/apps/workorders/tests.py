"""
Suite de pruebas automatizadas para el Sprint 3:
- HU-008: Registro y control de avance secuencial de fases de reparación (precedencia n-1, timestamps,
          auto-inicio de fase n+1 y cierre de entrega).
- HU-009: Consulta integral del estado, tiempos, línea de tiempo y alerta de retraso.
- Tabla 21 RBAC: Ocultamiento de importes para el rol Operario y consulta pública por código.
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
from .models import FaseReparacion


class Sprint3SeguimientoSecuencialFasesTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = Usuario.objects.create_user(
            email="sergio@tallersergio.com",
            nombre_completo="Sergio Titular",
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

        # Creamos un presupuesto aprobado para obtener la OrdenDeTrabajo y sus 8 fases
        presupuesto = Presupuesto.objects.create(
            tipo=Presupuesto.Tipo.PARTICULAR,
            cliente=self.cliente,
            vehiculo=self.vehiculo,
            detalle_libre="Amarok AF482KL - Reparación lateral",
            rubros_importes={"mano_obra": 500000, "total_final": 500000},
        )
        build_items_from_taller_forms(presupuesto)
        recalculate_budget_totals(presupuesto)
        emitir_presupuesto(presupuesto)

        self.orden = aprobar_presupuesto_y_crear_ot(
            presupuesto=presupuesto,
            fecha_estimada_entrega=date.today() + timedelta(days=5),
        )

    def test_hu008_criterio_1_bloqueo_estricto_si_fase_previa_no_esta_completada(self):
        """
        HU-008 Criterio 1:
        Si se intenta iniciar o completar una fase posterior (ej. 3-Chapa o 5-Pintura)
        sin que las anteriores estén completadas, el sistema bloquea la transición.
        """
        self.client.force_authenticate(user=self.operario)

        # Intentar saltar directamente a la fase 3 (Chapa) estando la 1 (Recepción) pendiente
        res_salto_iniciar = self.client.post(
            f"/api/workorders/ordenes/{self.orden.id_orden}/iniciar-fase/",
            {"numero_secuencia": 3, "observaciones": "Intento de salto"},
            format="json",
        )
        self.assertEqual(res_salto_iniciar.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Bloqueo de secuencia", str(res_salto_iniciar.data))

        # Intentar completar la fase 4 (Preparación) sin haber completado 1, 2 y 3
        res_salto_completar = self.client.post(
            f"/api/workorders/ordenes/{self.orden.id_orden}/completar-fase/",
            {"numero_secuencia": 4, "observaciones": "Intento de salto a Preparación"},
            format="json",
        )
        self.assertEqual(res_salto_completar.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Bloqueo de secuencia", str(res_salto_completar.data))

    def test_hu008_criterio_2_y_3_avance_secuencial_timestamps_y_entrega_final(self):
        """
        HU-008 Criterios 2 y 3:
        - Al completar la fase n, registra fecha_fin, usuario_responsable e inicia automáticamente la fase n+1.
        - Al completar la fase 8 ('Alistado para entrega'), marca la orden como 'Lista para entrega'.
        - Al registrar el retiro del vehículo, fija fecha_entrega_real y estado 'Entregada'.
        """
        self.client.force_authenticate(user=self.operario)

        # Avanzamos secuencialmente de la fase 1 a la 8
        for seq in range(1, 9):
            res = self.client.post(
                f"/api/workorders/ordenes/{self.orden.id_orden}/completar-fase/",
                {
                    "numero_secuencia": seq,
                    "observaciones": f"Etapa {seq} verificada en galpón.",
                },
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_200_OK)

            fase_db = FaseReparacion.objects.get(orden=self.orden, numero_secuencia=seq)
            self.assertEqual(fase_db.estado, FaseReparacion.EstadoFase.COMPLETADA)
            self.assertIsNotNone(fase_db.fecha_inicio)
            self.assertIsNotNone(fase_db.fecha_fin)
            self.assertEqual(fase_db.usuario_responsable, self.operario)

            if seq < 8:
                fase_sig = FaseReparacion.objects.get(
                    orden=self.orden, numero_secuencia=seq + 1
                )
                self.assertEqual(fase_sig.estado, FaseReparacion.EstadoFase.EN_CURSO)
                self.assertIsNotNone(fase_sig.fecha_inicio)

        self.orden.refresh_from_db()
        self.assertEqual(self.orden.estado_actual, "Lista para entrega")

        # Registrar retiro efectivo por parte de Administración/Dueño (Criterio 3)
        self.client.force_authenticate(user=self.admin)
        res_entrega = self.client.post(
            f"/api/workorders/ordenes/{self.orden.id_orden}/registrar-entrega/",
            {},
            format="json",
        )
        self.assertEqual(res_entrega.status_code, status.HTTP_200_OK)
        self.orden.refresh_from_db()
        self.assertEqual(self.orden.estado_actual, "Entregada")
        self.assertEqual(self.orden.fecha_entrega_real, date.today())

    def test_hu009_alerta_demora_oculta_montos_a_operario_y_consulta_publica(self):
        """
        HU-009 Criterios 1 y 2 + Tabla 21 RBAC:
        - Calcula alerta de demora (en_retraso = True y dias_retraso > 0) si fecha actual > fecha_estimada_entrega.
        - Oculta monto_total y saldo_pendiente cuando consulta un Operario.
        - Permite consulta pública por codigo_seguimiento sin autenticación.
        """
        # Forzamos una fecha estimada vencida hace 3 días para probar el indicador de demora
        self.orden.fecha_ingreso = date.today() - timedelta(days=10)
        self.orden.fecha_estimada_entrega = date.today() - timedelta(days=3)
        self.orden.save(update_fields=["fecha_ingreso", "fecha_estimada_entrega"])

        # Consulta como Operario -> ve alerta de retraso (3 días), pero monto_total es None
        self.client.force_authenticate(user=self.operario)
        res_op = self.client.get(f"/api/workorders/ordenes/{self.orden.id_orden}/")
        self.assertEqual(res_op.status_code, status.HTTP_200_OK)
        self.assertTrue(res_op.data["en_retraso"])
        self.assertEqual(res_op.data["dias_retraso"], 3)
        self.assertIsNone(res_op.data["monto_total"])

        # Consulta pública externa sin autenticación por código de seguimiento
        self.client.logout()
        res_pub = self.client.get(
            f"/api/workorders/seguimiento/{self.orden.codigo_seguimiento}/"
        )
        self.assertEqual(res_pub.status_code, status.HTTP_200_OK)
        self.assertEqual(
            res_pub.data["codigo_seguimiento"], self.orden.codigo_seguimiento
        )
        self.assertEqual(len(res_pub.data["fases"]), 8)
        self.assertNotIn("monto_total", res_pub.data)
