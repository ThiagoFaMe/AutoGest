"""
Migración inicial para el módulo de Inventario de Pañol y Consumo por Orden de Trabajo (Sprint 4: HU-010 a HU-012):
- InsumoRepuesto (db_table='insumo_repuesto')
- MovimientoStock (db_table='movimiento_stock')
"""
from decimal import Decimal
import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("workorders", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="InsumoRepuesto",
            fields=[
                (
                    "id_insumo",
                    models.AutoField(
                        db_column="id_insumo", primary_key=True, serialize=False
                    ),
                ),
                (
                    "codigo",
                    models.CharField(
                        db_column="codigo", max_length=30, unique=True
                    ),
                ),
                ("nombre", models.CharField(db_column="nombre", max_length=100)),
                (
                    "categoria",
                    models.CharField(
                        choices=[
                            ("Pintura", "Pintura"),
                            ("Preparación", "Preparación"),
                            ("Abrasivos", "Abrasivos"),
                            ("Autopartes", "Autopartes"),
                        ],
                        db_column="categoria",
                        default="Pintura",
                        max_length=40,
                    ),
                ),
                (
                    "unidad_medida",
                    models.CharField(
                        choices=[
                            ("Litros", "Litros"),
                            ("Kilogramos", "Kilogramos"),
                            ("Unidades", "Unidades"),
                        ],
                        db_column="unidad_medida",
                        default="Unidades",
                        max_length=20,
                    ),
                ),
                (
                    "stock_actual",
                    models.DecimalField(
                        db_column="stock_actual",
                        decimal_places=2,
                        default=Decimal("0.00"),
                        max_digits=10,
                        validators=[
                            django.core.validators.MinValueValidator(Decimal("0.00"))
                        ],
                    ),
                ),
                (
                    "stock_minimo",
                    models.DecimalField(
                        db_column="stock_minimo",
                        decimal_places=2,
                        default=Decimal("0.00"),
                        max_digits=10,
                        validators=[
                            django.core.validators.MinValueValidator(Decimal("0.00"))
                        ],
                    ),
                ),
                (
                    "costo_unitario",
                    models.DecimalField(
                        db_column="costo_unitario",
                        decimal_places=2,
                        default=Decimal("0.00"),
                        max_digits=12,
                        validators=[
                            django.core.validators.MinValueValidator(Decimal("0.00"))
                        ],
                    ),
                ),
            ],
            options={
                "verbose_name": "Insumo o Repuesto",
                "verbose_name_plural": "Insumos y Repuestos",
                "db_table": "insumo_repuesto",
                "ordering": ["codigo"],
            },
        ),
        migrations.CreateModel(
            name="MovimientoStock",
            fields=[
                (
                    "id_mov_stock",
                    models.AutoField(
                        db_column="id_mov_stock", primary_key=True, serialize=False
                    ),
                ),
                (
                    "fecha_hora",
                    models.DateTimeField(
                        auto_now_add=True, db_column="fecha_hora"
                    ),
                ),
                (
                    "tipo_movimiento",
                    models.CharField(
                        choices=[
                            ("ingreso", "Ingreso (Compra / Remito)"),
                            ("egreso_consumo", "Egreso por Consumo en OT"),
                        ],
                        db_column="tipo_movimiento",
                        max_length=15,
                    ),
                ),
                (
                    "cantidad",
                    models.DecimalField(
                        db_column="cantidad",
                        decimal_places=2,
                        max_digits=10,
                        validators=[
                            django.core.validators.MinValueValidator(Decimal("0.01"))
                        ],
                    ),
                ),
                (
                    "costo_unitario",
                    models.DecimalField(
                        db_column="costo_unitario",
                        decimal_places=2,
                        default=Decimal("0.00"),
                        max_digits=12,
                        validators=[
                            django.core.validators.MinValueValidator(Decimal("0.00"))
                        ],
                    ),
                ),
                (
                    "remito_comprobante",
                    models.CharField(
                        blank=True,
                        db_column="remito_comprobante",
                        default="",
                        max_length=60,
                    ),
                ),
                (
                    "insumo",
                    models.ForeignKey(
                        db_column="id_insumo",
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="movimientos",
                        to="inventory.insumorepuesto",
                    ),
                ),
                (
                    "orden",
                    models.ForeignKey(
                        blank=True,
                        db_column="id_orden",
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="consumos_stock",
                        to="workorders.ordendetrabajo",
                    ),
                ),
                (
                    "usuario",
                    models.ForeignKey(
                        db_column="id_usuario",
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="movimientos_stock_registrados",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Movimiento de Stock",
                "verbose_name_plural": "Movimientos de Stock",
                "db_table": "movimiento_stock",
                "ordering": ["-fecha_hora", "-id_mov_stock"],
            },
        ),
    ]
