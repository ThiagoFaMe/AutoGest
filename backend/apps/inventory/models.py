"""
Modelos de datos para el módulo de Inventario de Pañol y Consumo por Orden de Trabajo:
- InsumoRepuesto (Tabla 17 del Diccionario de Datos - HU-010)
- MovimientoStock (Tabla 18 del Diccionario de Datos - HU-011 y HU-012)
"""
from decimal import Decimal
from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.workorders.models import OrdenDeTrabajo


class InsumoRepuesto(models.Model):
    """
    Entidad InsumoRepuesto según Tabla 17 del Diccionario de Datos:
    - id_insumo: SERIAL (PK)
    - codigo: VARCHAR(30) UNIQUE (ej.: INS-014, REP-104)
    - nombre: VARCHAR(100)
    - categoria: VARCHAR(40) ("Pintura", "Preparación", "Abrasivos", "Autopartes")
    - unidad_medida: VARCHAR(20) ("Litros", "Kilogramos", "Unidades")
    - stock_actual: DECIMAL(10,2)
    - stock_minimo: DECIMAL(10,2)
    - costo_unitario: DECIMAL(12,2)
    """

    class Categoria(models.TextChoices):
        PINTURA = "Pintura", "Pintura"
        PREPARACION = "Preparación", "Preparación"
        ABRASIVOS = "Abrasivos", "Abrasivos"
        AUTOPARTES = "Autopartes", "Autopartes"

    class UnidadMedida(models.TextChoices):
        LITROS = "Litros", "Litros"
        KILOGRAMOS = "Kilogramos", "Kilogramos"
        UNIDADES = "Unidades", "Unidades"

    id_insumo = models.AutoField(primary_key=True, db_column="id_insumo")
    codigo = models.CharField(
        max_length=30, unique=True, db_column="codigo"
    )
    nombre = models.CharField(max_length=100, db_column="nombre")
    categoria = models.CharField(
        max_length=40,
        choices=Categoria.choices,
        default=Categoria.PINTURA,
        db_column="categoria",
    )
    unidad_medida = models.CharField(
        max_length=20,
        choices=UnidadMedida.choices,
        default=UnidadMedida.UNIDADES,
        db_column="unidad_medida",
    )
    stock_actual = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        db_column="stock_actual",
    )
    stock_minimo = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        db_column="stock_minimo",
    )
    costo_unitario = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        db_column="costo_unitario",
    )

    class Meta:
        db_table = "insumo_repuesto"
        verbose_name = "Insumo o Repuesto"
        verbose_name_plural = "Insumos y Repuestos"
        ordering = ["codigo"]

    @property
    def en_alerta_stock(self) -> bool:
        """
        HU-010 Criterio 2 y HU-012 Criterio 3:
        Cuando stock_actual <= stock_minimo, el ítem se encuentra en estado
        'Bajo Stock / Reposición Crítica'.
        """
        return self.stock_actual <= self.stock_minimo

    @property
    def estado_stock(self) -> str:
        if self.en_alerta_stock:
            return "Bajo Stock / Reposición Crítica"
        return "Stock Normal"

    def save(self, *args, **kwargs):
        if self.codigo:
            self.codigo = self.codigo.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.codigo} - {self.nombre} ({self.stock_actual} {self.unidad_medida})"


class MovimientoStock(models.Model):
    """
    Entidad MovimientoStock según Tabla 18 del Diccionario de Datos:
    - id_mov_stock: SERIAL (PK)
    - id_insumo: INTEGER (FK -> InsumoRepuesto)
    - id_orden: INTEGER (FK -> OrdenDeTrabajo, null si es ingreso de compra)
    - id_usuario: INTEGER (FK -> Usuario)
    - fecha_hora: TIMESTAMP
    - tipo_movimiento: VARCHAR(15) ("ingreso" o "egreso_consumo")
    - cantidad: DECIMAL(10,2)
    - costo_unitario: DECIMAL(12,2)
    - remito_comprobante: VARCHAR(60)
    """

    class TipoMovimiento(models.TextChoices):
        INGRESO = "ingreso", "Ingreso (Compra / Remito)"
        EGRESO_CONSUMO = "egreso_consumo", "Egreso por Consumo en OT"

    id_mov_stock = models.AutoField(primary_key=True, db_column="id_mov_stock")
    insumo = models.ForeignKey(
        InsumoRepuesto,
        on_delete=models.PROTECT,
        related_name="movimientos",
        db_column="id_insumo",
    )
    orden = models.ForeignKey(
        OrdenDeTrabajo,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="consumos_stock",
        db_column="id_orden",
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="movimientos_stock_registrados",
        db_column="id_usuario",
    )
    fecha_hora = models.DateTimeField(auto_now_add=True, db_column="fecha_hora")
    tipo_movimiento = models.CharField(
        max_length=15,
        choices=TipoMovimiento.choices,
        db_column="tipo_movimiento",
    )
    cantidad = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        db_column="cantidad",
    )
    costo_unitario = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        db_column="costo_unitario",
    )
    remito_comprobante = models.CharField(
        max_length=60,
        blank=True,
        default="",
        db_column="remito_comprobante",
    )

    class Meta:
        db_table = "movimiento_stock"
        verbose_name = "Movimiento de Stock"
        verbose_name_plural = "Movimientos de Stock"
        ordering = ["-fecha_hora", "-id_mov_stock"]

    @property
    def subtotal_valorizado(self) -> Decimal:
        return (self.cantidad * self.costo_unitario).quantize(Decimal("0.01"))

    def __str__(self):
        return (
            f"{self.tipo_movimiento.upper()} | {self.insumo.codigo} "
            f"x {self.cantidad} ({self.fecha_hora:%d/%m/%Y %H:%M})"
        )
