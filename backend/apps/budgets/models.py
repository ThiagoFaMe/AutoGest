"""
Modelos de datos para el módulo de Presupuestos (Sprint 2):
- Presupuesto (Tabla 13 del Diccionario de Datos - HU-005, HU-006, HU-007)
- ItemPresupuesto (Tabla 14 del Diccionario de Datos - HU-005, HU-006)
"""
from datetime import date
from decimal import Decimal
from django.db import models

from apps.core.models import Cliente, CompaniaAseguradora, Vehiculo


class Presupuesto(models.Model):
    """
    Entidad Presupuesto según Tabla 13 del Diccionario de Datos:
    - id_presupuesto: SERIAL (PK)
    - fecha_emision: DATE (null mientras está en borrador)
    - fecha_vencimiento: DATE (+15 días al emitir)
    - tipo: VARCHAR(20) ("particular" o "aseguradora")
    - estado: VARCHAR(20) ("borrador", "emitido", "aprobado", "rechazado", "vencido")
    - nro_siniestro: VARCHAR(40) (obligatorio si es aseguradora)
    - nombre_perito: VARCHAR(100) (obligatorio si es aseguradora - HU-006 Criterio 1)
    - monto_mano_obra: DECIMAL(12,2)
    - monto_repuestos: DECIMAL(12,2) (0 si los provee la aseguradora - HU-006 Criterio 2)
    - monto_total: DECIMAL(12,2)
    - id_vehiculo: INTEGER (FK -> Vehiculo)
    - id_cliente: INTEGER (FK -> Cliente)
    - id_compania: INTEGER (FK -> CompaniaAseguradora, null si es particular)
    """

    class Tipo(models.TextChoices):
        PARTICULAR = "particular", "Particular"
        ASEGURADORA = "aseguradora", "Compañía Aseguradora"

    class Estado(models.TextChoices):
        BORRADOR = "borrador", "Borrador"
        EMITIDO = "emitido", "Emitido"
        APROBADO = "aprobado", "Aprobado"
        RECHAZADO = "rechazado", "Rechazado"
        VENCIDO = "vencido", "Vencido"

    id_presupuesto = models.AutoField(primary_key=True, db_column="id_presupuesto")
    fecha_emision = models.DateField(null=True, blank=True, db_column="fecha_emision")
    fecha_vencimiento = models.DateField(
        null=True, blank=True, db_column="fecha_vencimiento"
    )
    tipo = models.CharField(
        max_length=20,
        choices=Tipo.choices,
        default=Tipo.PARTICULAR,
        db_column="tipo",
    )
    estado = models.CharField(
        max_length=20,
        choices=Estado.choices,
        default=Estado.BORRADOR,
        db_column="estado",
    )
    nro_siniestro = models.CharField(
        max_length=40, blank=True, default="", db_column="nro_siniestro"
    )
    nombre_perito = models.CharField(
        max_length=100, blank=True, default="", db_column="nombre_perito"
    )
    monto_mano_obra = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        db_column="monto_mano_obra",
    )
    monto_repuestos = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        db_column="monto_repuestos",
    )
    monto_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        db_column="monto_total",
    )
    vehiculo = models.ForeignKey(
        Vehiculo,
        on_delete=models.PROTECT,
        related_name="presupuestos",
        db_column="id_vehiculo",
    )
    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.PROTECT,
        related_name="presupuestos",
        db_column="id_cliente",
    )
    compania = models.ForeignKey(
        CompaniaAseguradora,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="presupuestos",
        db_column="id_compania",
    )
    observaciones = models.CharField(
        max_length=500, blank=True, default="", db_column="observaciones"
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "presupuesto"
        verbose_name = "Presupuesto"
        verbose_name_plural = "Presupuestos"
        ordering = ["-id_presupuesto"]

    def __str__(self):
        return f"PRES-{self.id_presupuesto:04d} ({self.vehiculo.patente} - {self.estado})"

    @property
    def dias_espera_aprobacion(self) -> int:
        """
        HU-006 Criterio 3:
        Calcula los días transcurridos desde la emisión mientras el presupuesto espera aprobación.
        """
        if self.estado == self.Estado.EMITIDO and self.fecha_emision:
            return max(0, (date.today() - self.fecha_emision).days)
        return 0


class ItemPresupuesto(models.Model):
    """
    Entidad ItemPresupuesto según Tabla 14 del Diccionario de Datos:
    - id_item: SERIAL (PK)
    - id_presupuesto: INTEGER (FK -> Presupuesto)
    - descripcion: VARCHAR(200)
    - tipo_item: VARCHAR(25) ("mano_obra_chapa", "mano_obra_pintura", "repuesto")
    - cantidad: INTEGER
    - precio_unitario: DECIMAL(12,2)
    - subtotal: DECIMAL(12,2)
    """

    class TipoItem(models.TextChoices):
        MANO_OBRA_CHAPA = "mano_obra_chapa", "Mano de Obra Chapa"
        MANO_OBRA_PINTURA = "mano_obra_pintura", "Mano de Obra Pintura"
        REPUESTO = "repuesto", "Repuesto / Autoparte"

    id_item = models.AutoField(primary_key=True, db_column="id_item")
    presupuesto = models.ForeignKey(
        Presupuesto,
        on_delete=models.CASCADE,
        related_name="items",
        db_column="id_presupuesto",
    )
    descripcion = models.CharField(max_length=200, db_column="descripcion")
    tipo_item = models.CharField(
        max_length=25,
        choices=TipoItem.choices,
        default=TipoItem.MANO_OBRA_CHAPA,
        db_column="tipo_item",
    )
    cantidad = models.IntegerField(default=1, db_column="cantidad")
    precio_unitario = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        db_column="precio_unitario",
    )
    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        db_column="subtotal",
    )

    class Meta:
        db_table = "item_presupuesto"
        verbose_name = "Ítem de Presupuesto"
        verbose_name_plural = "Ítems de Presupuesto"
        ordering = ["id_item"]

    def save(self, *args, **kwargs):
        self.subtotal = Decimal(int(self.cantidad)) * Decimal(str(self.precio_unitario))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.descripcion} ({self.tipo_item}) x{self.cantidad} = ${self.subtotal}"
