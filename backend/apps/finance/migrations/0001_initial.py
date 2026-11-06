"""
Migración inicial para el módulo Financiero, Cuentas por Cobrar y Flujo de Caja (Sprint 5: HU-013 y HU-014):
- CuentaPorCobrar (db_table='cuenta_por_cobrar')
- MovimientoFinanciero (db_table='movimiento_financiero')
"""
from datetime import date
from decimal import Decimal
import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("core", "0001_initial"),
        ("workorders", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CuentaPorCobrar",
            fields=[
                (
                    "id_cuenta",
                    models.AutoField(
                        db_column="id_cuenta", primary_key=True, serialize=False
                    ),
                ),
                (
                    "nro_factura",
                    models.CharField(
                        db_column="nro_factura", max_length=40, unique=True
                    ),
                ),
                ("fecha_emision", models.DateField(db_column="fecha_emision")),
                (
                    "fecha_vencimiento",
                    models.DateField(db_column="fecha_vencimiento"),
                ),
                (
                    "monto_facturado",
                    models.DecimalField(
                        db_column="monto_facturado",
                        decimal_places=2,
                        max_digits=12,
                        validators=[
                            django.core.validators.MinValueValidator(Decimal("0.01"))
                        ],
                    ),
                ),
                (
                    "monto_cobrado",
                    models.DecimalField(
                        db_column="monto_cobrado",
                        decimal_places=2,
                        default=Decimal("0.00"),
                        max_digits=12,
                        validators=[
                            django.core.validators.MinValueValidator(Decimal("0.00"))
                        ],
                    ),
                ),
                (
                    "saldo_pendiente",
                    models.DecimalField(
                        db_column="saldo_pendiente",
                        decimal_places=2,
                        default=Decimal("0.00"),
                        max_digits=12,
                        validators=[
                            django.core.validators.MinValueValidator(Decimal("0.00"))
                        ],
                    ),
                ),
                (
                    "estado_cobranza",
                    models.CharField(
                        choices=[
                            ("pendiente_en_plazo", "Pendiente en plazo"),
                            ("pago_parcial", "Pago parcial"),
                            ("vencida_en_mora", "Vencida / En mora"),
                            ("cancelada", "Cancelada"),
                        ],
                        db_column="estado_cobranza",
                        default="pendiente_en_plazo",
                        max_length=20,
                    ),
                ),
                (
                    "compania",
                    models.ForeignKey(
                        blank=True,
                        db_column="id_compania",
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="cuentas_por_cobrar",
                        to="core.companiaaseguradora",
                    ),
                ),
                (
                    "orden",
                    models.ForeignKey(
                        db_column="id_orden",
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="cuentas_por_cobrar",
                        to="workorders.ordendetrabajo",
                    ),
                ),
            ],
            options={
                "verbose_name": "Cuenta por Cobrar",
                "verbose_name_plural": "Cuentas por Cobrar",
                "db_table": "cuenta_por_cobrar",
                "ordering": ["fecha_vencimiento", "-id_cuenta"],
            },
        ),
        migrations.CreateModel(
            name="MovimientoFinanciero",
            fields=[
                (
                    "id_movimiento",
                    models.AutoField(
                        db_column="id_movimiento",
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("fecha", models.DateField(db_column="fecha", default=date.today)),
                (
                    "tipo",
                    models.CharField(
                        choices=[("ingreso", "Ingreso"), ("egreso", "Egreso")],
                        db_column="tipo",
                        max_length=10,
                    ),
                ),
                (
                    "categoria",
                    models.CharField(db_column="categoria", max_length=30),
                ),
                (
                    "concepto",
                    models.CharField(db_column="concepto", max_length=120),
                ),
                (
                    "monto",
                    models.DecimalField(
                        db_column="monto",
                        decimal_places=2,
                        max_digits=12,
                        validators=[
                            django.core.validators.MinValueValidator(Decimal("0.01"))
                        ],
                    ),
                ),
                (
                    "medio_pago",
                    models.CharField(
                        choices=[
                            ("efectivo", "Efectivo"),
                            ("transferencia", "Transferencia Bancaria"),
                            ("e-cheq", "e-Cheq (Cheque Electrónico)"),
                        ],
                        db_column="medio_pago",
                        default="transferencia",
                        max_length=20,
                    ),
                ),
                (
                    "cuenta",
                    models.ForeignKey(
                        blank=True,
                        db_column="id_cuenta",
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="cobros_imputados",
                        to="finance.cuentaporcobrar",
                    ),
                ),
                (
                    "orden",
                    models.ForeignKey(
                        blank=True,
                        db_column="id_orden",
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="movimientos_financieros",
                        to="workorders.ordendetrabajo",
                    ),
                ),
                (
                    "usuario",
                    models.ForeignKey(
                        db_column="id_usuario",
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="movimientos_financieros_registrados",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Movimiento Financiero",
                "verbose_name_plural": "Movimientos Financieros",
                "db_table": "movimiento_financiero",
                "ordering": ["-fecha", "-id_movimiento"],
            },
        ),
    ]
