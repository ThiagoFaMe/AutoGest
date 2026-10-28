"""
Comando idempotente para poblar datos iniciales de Taller Sergio (Córdoba Capital) para el Sprint 1.
Crea los 3 perfiles de usuario (Administrador, Administrativo, Operario), clientes, vehículos y aseguradoras.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.core.models import Cliente, CompaniaAseguradora, Vehiculo
from apps.users.models import Usuario


class Command(BaseCommand):
    help = "Inicializa datos maestros realistas de Taller Sergio para demostración del Sprint 1."

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write("Verificando y cargando datos iniciales de Taller Sergio (Sprint 1)...")

        usuarios_demo = [
            {
                "email": "sergio@tallersergio.com.ar",
                "nombre_completo": "Sergio (Titular / Dirección General)",
                "rol": Usuario.Rol.ADMINISTRADOR,
                "password": "AdminSergio2026!",
                "is_staff": True,
                "is_superuser": True,
            },
            {
                "email": "administracion@tallersergio.com.ar",
                "nombre_completo": "Laura Gómez (Administración y Recepción)",
                "rol": Usuario.Rol.ADMINISTRATIVO,
                "password": "AdminLaura2026!",
                "is_staff": False,
                "is_superuser": False,
            },
            {
                "email": "chapa@tallersergio.com.ar",
                "nombre_completo": "Carlos Domínguez (Oficial Chapista)",
                "rol": Usuario.Rol.OPERARIO,
                "password": "TallerChapa2026!",
                "is_staff": False,
                "is_superuser": False,
            },
            {
                "email": "pintura@tallersergio.com.ar",
                "nombre_completo": "Martín Pereyra (Oficial Pintor)",
                "rol": Usuario.Rol.OPERARIO,
                "password": "TallerPintura2026!",
                "is_staff": False,
                "is_superuser": False,
            },
        ]

        for u_data in usuarios_demo:
            pwd = u_data.pop("password")
            user, created = Usuario.objects.get_or_create(
                email=u_data["email"],
                defaults=u_data,
            )
            if created:
                user.set_password(pwd)
                user.save()

        aseguradoras_demo = [
            {
                "razon_social": "Sancor Cooperativa de Seguros Ltda.",
                "cuit": "30-50004946-0",
                "plazo_pago_dias": 30,
                "telefono": "0800-444-2850",
                "email_peritos": "siniestros.cordoba@sancorseguros.com",
            },
            {
                "razon_social": "Federación Patronal Seguros S.A.",
                "cuit": "30-50003196-0",
                "plazo_pago_dias": 45,
                "telefono": "0810-222-3337",
                "email_peritos": "peritajes.cba@fedpat.com.ar",
            },
            {
                "razon_social": "La Segunda Cooperativa Ltda. de Seguros",
                "cuit": "30-50001770-4",
                "plazo_pago_dias": 30,
                "telefono": "0351-421-8800",
                "email_peritos": "inspecciones.cordoba@lasegunda.com.ar",
            },
            {
                "razon_social": "San Cristóbal SMSG",
                "cuit": "30-50004533-3",
                "plazo_pago_dias": 60,
                "telefono": "0810-222-8887",
                "email_peritos": "liquidaciones.cba@sancristobal.com.ar",
            },
        ]

        for aseg in aseguradoras_demo:
            CompaniaAseguradora.objects.get_or_create(
                cuit=aseg["cuit"],
                defaults=aseg,
            )

        clientes_vehiculos_demo = [
            {
                "cliente": {
                    "dni": "32458910",
                    "nombre": "Mariano",
                    "apellido": "Ferreira",
                    "telefono": "351-6124890",
                    "email": "mferreira.cba@gmail.com",
                    "direccion": "Av. Colón 2450, Alberdi, Córdoba",
                },
                "vehiculos": [
                    {
                        "patente": "AF482KL",
                        "marca": "Volkswagen",
                        "modelo": "Amarok V6 Highline",
                        "anio": 2022,
                        "color": "Gris Indium (LR7H)",
                    }
                ],
            },
            {
                "cliente": {
                    "dni": "28910344",
                    "nombre": "Valeria",
                    "apellido": "Ledesma",
                    "telefono": "351-5489012",
                    "email": "valeria.ledesma@hotmail.com",
                    "direccion": "Bv. San Juan 850, Nueva Córdoba",
                },
                "vehiculos": [
                    {
                        "patente": "AE719MP",
                        "marca": "Toyota",
                        "modelo": "Corolla XEI 2.0",
                        "anio": 2021,
                        "color": "Blanco Perlado (070)",
                    }
                ],
            },
            {
                "cliente": {
                    "dni": "38120955",
                    "nombre": "Lucas",
                    "apellido": "Bustos",
                    "telefono": "351-3901122",
                    "email": "lucas.bustos@yahoo.com.ar",
                    "direccion": "Recta Martinolli 6120, Argüello, Córdoba",
                },
                "vehiculos": [
                    {
                        "patente": "NQP842",
                        "marca": "Ford",
                        "modelo": "Focus III SE Plus",
                        "anio": 2014,
                        "color": "Rojo Bari (M7283)",
                    },
                    {
                        "patente": "AD309TR",
                        "marca": "Peugeot",
                        "modelo": "208 Feline 1.6",
                        "anio": 2019,
                        "color": "Azul Quasar (KHK)",
                    },
                ],
            },
        ]

        for item in clientes_vehiculos_demo:
            c_data = item["cliente"]
            cliente, _ = Cliente.objects.get_or_create(
                dni=c_data["dni"],
                defaults=c_data,
            )
            for v_data in item["vehiculos"]:
                Vehiculo.objects.get_or_create(
                    patente=v_data["patente"],
                    defaults={**v_data, "cliente": cliente},
                )

        self.stdout.write(self.style.SUCCESS("Semilla del Sprint 1 aplicada exitosamente."))
