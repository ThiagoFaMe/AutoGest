"""
Suite de pruebas automatizadas para HU-002 (Clientes), HU-003 (Vehículos) y HU-004 (Aseguradoras).
"""
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import Usuario
from .models import Cliente, CompaniaAseguradora, Vehiculo


class Sprint1PadronesMaestrosTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.administrativo = Usuario.objects.create_user(
            email="laura@tallersergio.com",
            nombre_completo="Laura Administración",
            password="AdminPassword123!",
            rol=Usuario.Rol.ADMINISTRATIVO,
        )
        self.client.force_authenticate(user=self.administrativo)

        self.cliente_existente = Cliente.objects.create(
            dni="32458910",
            nombre="Mariano",
            apellido="Ferreira",
            telefono="351-6124890",
            email="mferreira@gmail.com",
            direccion="Av. Colón 2450",
        )
        self.vehiculo_existente = Vehiculo.objects.create(
            patente="AF482KL",
            marca="Volkswagen",
            modelo="Amarok V6",
            anio=2022,
            color="Gris Indium",
            cliente=self.cliente_existente,
        )

    def test_hu002_dni_duplicado_devuelve_ficha_existente(self):
        """HU-002 Criterio 1: Impide duplicar DNI y devuelve la ficha existente para edición."""
        res = self.client.post(
            "/api/core/clientes/",
            {
                "dni": "32.458.910",
                "nombre": "Otro",
                "apellido": "Intento",
                "telefono": "351-0000000",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ficha_existente", res.data)
        self.assertEqual(int(res.data["ficha_existente"]["id_cliente"]), self.cliente_existente.id_cliente)

    def test_hu003_patente_normalizacion_y_duplicado_devuelve_vehiculo(self):
        """HU-003 Criterios 1 y 2: Normaliza patente Mercosur/antigua y rechaza duplicados devolviendo el vehículo."""
        # Alta válida con espacios y minúsculas -> se normaliza a ABC123
        res_ok = self.client.post(
            "/api/core/vehiculos/",
            {
                "patente": "abc 123",
                "marca": "Ford",
                "modelo": "Fiesta Kinetic",
                "anio": 2015,
                "color": "Blanco Oxford",
                "id_cliente": self.cliente_existente.id_cliente,
            },
            format="json",
        )
        self.assertEqual(res_ok.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_ok.data["patente"], "ABC123")

        # Intento duplicado sobre AF482KL
        res_dup = self.client.post(
            "/api/core/vehiculos/",
            {
                "patente": "af-482-kl",
                "marca": "Volkswagen",
                "modelo": "Amarok",
                "anio": 2022,
                "color": "Gris",
                "id_cliente": self.cliente_existente.id_cliente,
            },
            format="json",
        )
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("vehiculo_existente", res_dup.data)

    def test_hu004_aseguradora_cuit_unico_y_rango_plazo_pago(self):
        """HU-004 Criterios 1 y 2: Valida CUIT único y plazo_pago_dias entre 1 y 180 días."""
        res_invalido = self.client.post(
            "/api/core/aseguradoras/",
            {
                "razon_social": "Seguros Inválidos SA",
                "cuit": "30-71000000-1",
                "plazo_pago_dias": 240,
            },
            format="json",
        )
        self.assertEqual(res_invalido.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("plazo_pago_dias", res_invalido.data)

        res_ok = self.client.post(
            "/api/core/aseguradoras/",
            {
                "razon_social": "Sancor Seguros",
                "cuit": "30-50004946-0",
                "plazo_pago_dias": 30,
                "telefono": "0800-444-2850",
                "email_peritos": "peritos@sancor.com",
            },
            format="json",
        )
        self.assertEqual(res_ok.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CompaniaAseguradora.objects.count(), 1)
