"""
Suite de pruebas automatizadas para HU-001: Autenticación y control de acceso por roles (RBAC).
Verifica cada escenario Dado/Cuando/Entonces especificado en el TFG.
"""
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from .models import Usuario


class HU001AutenticacionYRolesTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = Usuario.objects.create_user(
            email="admin@tallersergio.com",
            nombre_completo="Sergio Admin",
            password="AdminPassword123!",
            rol=Usuario.Rol.ADMINISTRADOR,
        )
        self.operario = Usuario.objects.create_user(
            email="operario@tallersergio.com",
            nombre_completo="Operario Chapa",
            password="OperarioPassword123!",
            rol=Usuario.Rol.OPERARIO,
        )

    def test_criterio_1_unicidad_correo_usuario(self):
        """HU-001 Criterio 1: Rechaza el alta de un usuario con un correo ya registrado."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/users/usuarios/",
            {
                "nombre_completo": "Duplicado",
                "email": "ADMIN@tallersergio.com",
                "password": "ValidPassword123!",
                "rol": "administrativo",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_criterio_2_complejidad_contrasena_detalla_requisitos(self):
        """HU-001 Criterio 2: Bloquea contraseñas débiles detallando los requisitos faltantes."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/users/usuarios/",
            {
                "nombre_completo": "Nuevo Usuario",
                "email": "nuevo@tallersergio.com",
                "password": "debil",
                "rol": "administrativo",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        error_msg = str(response.data["password"])
        self.assertIn("al menos 8 caracteres", error_msg)
        self.assertIn("mayúscula", error_msg)
        self.assertIn("número", error_msg)
        self.assertIn("carácter especial", error_msg)

    def test_criterio_3_bloqueo_automatico_tras_5_intentos_fallidos(self):
        """HU-001 Criterio 3: Al 5.º intento fallido consecutivo bloquea la cuenta por 15 minutos."""
        for attempt in range(1, 5):
            res = self.client.post(
                "/api/users/login/",
                {"email": "operario@tallersergio.com", "password": "WrongPassword!1"},
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
            self.operario.refresh_from_db()
            self.assertEqual(self.operario.intentos_fallidos, attempt)
            self.assertIsNone(self.operario.bloqueado_hasta)

        # 5.º intento fallido dispara el bloqueo temporal
        res_5 = self.client.post(
            "/api/users/login/",
            {"email": "operario@tallersergio.com", "password": "WrongPassword!1"},
            format="json",
        )
        self.assertEqual(res_5.status_code, status.HTTP_401_UNAUTHORIZED)
        self.operario.refresh_from_db()
        self.assertEqual(self.operario.intentos_fallidos, 5)
        self.assertIsNotNone(self.operario.bloqueado_hasta)
        self.assertTrue(self.operario.esta_bloqueado)

        # Incluso con la clave correcta, no puede ingresar mientras esté bloqueado
        res_blocked = self.client.post(
            "/api/users/login/",
            {"email": "operario@tallersergio.com", "password": "OperarioPassword123!"},
            format="json",
        )
        self.assertEqual(res_blocked.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("bloqueada temporalmente", str(res_blocked.data))

    def test_criterio_4_restriccion_rbac_operario_recibe_403(self):
        """HU-001 Criterio 4: Un usuario con rol Operario recibe HTTP 403 al intentar acceder a Gestión de Usuarios."""
        self.client.force_authenticate(user=self.operario)
        res = self.client.get("/api/users/usuarios/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
