"""
Migración 0002 para agregar el modelo TurnoTaller (Calendario de Ingresos y Turnos de Taller Sergio).
"""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0001_initial"),
        ("workorders", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="TurnoTaller",
            fields=[
                (
                    "id_turno",
                    models.AutoField(
                        db_column="id_turno", primary_key=True, serialize=False
                    ),
                ),
                ("fecha_turno", models.DateField(db_column="fecha_turno")),
                (
                    "hora_turno",
                    models.TimeField(db_column="hora_turno", default="08:30"),
                ),
                (
                    "tipo_turno",
                    models.CharField(
                        choices=[
                            (
                                "ingreso_reparacion",
                                "Ingreso de Vehículo a Reparación",
                            ),
                            (
                                "peritaje_seguro",
                                "Inspección / Peritaje de Aseguradora",
                            ),
                            (
                                "cotizacion",
                                "Turno para Presupuesto / Cotización",
                            ),
                            (
                                "entrega_unidad",
                                "Entrega Programada de Unidad",
                            ),
                        ],
                        db_column="tipo_turno",
                        default="ingreso_reparacion",
                        max_length=25,
                    ),
                ),
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("programado", "Programado"),
                            ("ingresado", "Vehículo Recibido en Taller"),
                            ("reprogramado", "Reprogramado"),
                            ("cancelado", "Cancelado"),
                        ],
                        db_column="estado",
                        default="programado",
                        max_length=20,
                    ),
                ),
                (
                    "cliente_nombre_libre",
                    models.CharField(
                        blank=True,
                        db_column="cliente_nombre_libre",
                        default="",
                        max_length=100,
                    ),
                ),
                (
                    "telefono_contacto",
                    models.CharField(
                        blank=True,
                        db_column="telefono_contacto",
                        default="",
                        max_length=40,
                    ),
                ),
                (
                    "patente_referencia",
                    models.CharField(
                        blank=True,
                        db_column="patente_referencia",
                        default="",
                        max_length=15,
                    ),
                ),
                (
                    "vehiculo_referencia",
                    models.CharField(
                        blank=True,
                        db_column="vehiculo_referencia",
                        default="",
                        max_length=100,
                    ),
                ),
                (
                    "motivo_observaciones",
                    models.CharField(
                        blank=True,
                        db_column="motivo_observaciones",
                        default="",
                        max_length=400,
                    ),
                ),
                (
                    "compania",
                    models.ForeignKey(
                        blank=True,
                        db_column="id_compania",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="turnos_programados",
                        to="core.companiaaseguradora",
                    ),
                ),
                (
                    "orden",
                    models.ForeignKey(
                        blank=True,
                        db_column="id_orden",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="turnos_asociados",
                        to="workorders.ordendetrabajo",
                    ),
                ),
                (
                    "vehiculo",
                    models.ForeignKey(
                        blank=True,
                        db_column="id_vehiculo",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="turnos_programados",
                        to="core.vehiculo",
                    ),
                ),
            ],
            options={
                "verbose_name": "Turno de Taller",
                "verbose_name_plural": "Turnos de Taller",
                "db_table": "turno_taller",
                "ordering": ["fecha_turno", "hora_turno", "id_turno"],
            },
        ),
    ]
