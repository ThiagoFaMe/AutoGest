"""
Modelos de datos para el módulo Financiero, Cuentas por Cobrar y Flujo de Caja:
- CuentaPorCobrar (Tabla 19 del Diccionario de Datos - HU-013)
- MovimientoFinanciero (Tabla 20 del Diccionario de Datos - HU-014)
"""
from datetime import date
from decimal import Decimal
from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.core.models import CompaniaAseguradora
from apps.workorders.models import OrdenDeTrabajo


class CuentaPorCobrar(models.Model):
    """
    Entidad CuentaPorCobrar según Tabla 19 del Diccionario de Datos (HU-013):
    - id_cuenta: SERIAL (PK)
    - id_orden: INTEGER (FK -> OrdenDeTrabajo)
    - id_compania: INTEGER (FK -> CompaniaAseguradora, null si saldo particular)
    - nro_factura: VARCHAR(40)
    - fecha_emision: DATE
    - fecha_vencimiento: DATE (fecha_emision + plazo_pago_dias)
    - monto_facturado: DECIMAL(12,2)
    - monto_cobrado: DECIMAL(12,2)
    - saldo_pendiente: DECIMAL(12,2)
    - estado_cobranza: VARCHAR(20) ("pendiente_en_plazo", "pago_parcial", "vencida_en_mora", "cancelada")
    """

    class EstadoCobranza(models.TextChoices):
        PENDIENTE_EN_PLAZO = "pendiente_en_plazo", "Pendiente en plazo"
        PAGO_PARCIAL = "pago_parcial", "Pago parcial"
        VENCIDA_EN_MORA = "vencida_en_mora", "Vencida / En mora"
        CANCELADA = "cancelada", "Cancelada"

    id_cuenta = models.AutoField(primary_key=True, db_column="id_cuenta")
    orden = models.ForeignKey(
        OrdenDeTrabajo,
        on_delete=models.PROTECT,
        related_name="cuentas_por_cobrar",
        db_column="id_orden",
    )
    compania = models.ForeignKey(
        CompaniaAseguradora,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="cuentas_por_cobrar",
        db_column="id_compania",
    )
    nro_factura = models.CharField(
        max_length=40, unique=True, db_column="nro_factura"
    )
    fecha_emision = models.DateField(db_column="fecha_emision")
    fecha_vencimiento = models.DateField(db_column="fecha_vencimiento")
    monto_facturado = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        db_column="monto_facturado",
    )
    monto_cobrado = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        db_column="monto_cobrado",
    )
    saldo_pendiente = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        db_column="saldo_pendiente",
    )
    estado_cobranza = models.CharField(
        max_length=20,
        choices=EstadoCobranza.choices,
        default=EstadoCobranza.PENDIENTE_EN_PLAZO,
        db_column="estado_cobranza",
    )

    class Meta:
        db_table = "cuenta_por_cobrar"
        verbose_name = "Cuenta por Cobrar"
        verbose_name_plural = "Cuentas por Cobrar"
        ordering = ["fecha_vencimiento", "-id_cuenta"]

    @property
    def dias_mora(self) -> int:
        """
        HU-013 Criterio 2:
        Si saldo_pendiente > 0 y Fecha Actual > Fecha de Vencimiento,
        calcula Días de Mora = Fecha Actual - Fecha de Vencimiento.
        """
        if self.saldo_pendiente > Decimal("0.00") and date.today() > self.fecha_vencimiento:
            return (date.today() - self.fecha_vencimiento).days
        return 0

    @property
    def en_mora(self) -> bool:
        return self.dias_mora > 0

    def __str__(self):
        return (
            f"Factura {self.nro_factura} ({self.orden.codigo_seguimiento}) - "
            f"Saldo: ${self.saldo_pendiente} [{self.estado_cobranza}]"
        )


class MovimientoFinanciero(models.Model):
    """
    Entidad MovimientoFinanciero según Tabla 20 del Diccionario de Datos (HU-014):
    - id_movimiento: SERIAL (PK)
    - fecha: DATE
    - tipo: VARCHAR(10) ("ingreso" o "egreso")
    - categoria: VARCHAR(30)
    - concepto: VARCHAR(120)
    - monto: DECIMAL(12,2)
    - medio_pago: VARCHAR(20) ("efectivo", "transferencia", "e-cheq")
    - id_orden: INTEGER (FK -> OrdenDeTrabajo, null)
    - id_cuenta: INTEGER (FK -> CuentaPorCobrar, null)
    - id_usuario: INTEGER (FK -> Usuario)
    """

    class TipoFlujo(models.TextChoices):
        INGRESO = "ingreso", "Ingreso"
        EGRESO = "egreso", "Egreso"

    class MedioPago(models.TextChoices):
        EFECTIVO = "efectivo", "Efectivo"
        TRANSFERENCIA = "transferencia", "Transferencia Bancaria"
        ECHEQ = "e-cheq", "e-Cheq (Cheque Electrónico)"

    id_movimiento = models.AutoField(primary_key=True, db_column="id_movimiento")
    fecha = models.DateField(default=date.today, db_column="fecha")
    tipo = models.CharField(
        max_length=10, choices=TipoFlujo.choices, db_column="tipo"
    )
    categoria = models.CharField(max_length=30, db_column="categoria")
    concepto = models.CharField(max_length=120, db_column="concepto")
    monto = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        db_column="monto",
    )
    medio_pago = models.CharField(
        max_length=20,
        choices=MedioPago.choices,
        default=MedioPago.TRANSFERENCIA,
        db_column="medio_pago",
    )
    orden = models.ForeignKey(
        OrdenDeTrabajo,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="movimientos_financieros",
        db_column="id_orden",
    )
    cuenta = models.ForeignKey(
        CuentaPorCobrar,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="cobros_imputados",
        db_column="id_cuenta",
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="movimientos_financieros_registrados",
        db_column="id_usuario",
    )

    class Meta:
        db_table = "movimiento_financiero"
        verbose_name = "Movimiento Financiero"
        verbose_name_plural = "Movimientos Financieros"
        ordering = ["-fecha", "-id_movimiento"]

    def __str__(self):
        return f"{self.tipo.upper()} | {self.categoria}: ${self.monto} ({self.fecha})"
