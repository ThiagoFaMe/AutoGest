"""
Modelos de datos para Órdenes de Trabajo y Fases de Reparación:
- OrdenDeTrabajo (Tabla 15 del Diccionario de Datos - HU-007, HU-008, HU-009)
- FaseReparacion (Tabla 16 del Diccionario de Datos - HU-007, HU-008, HU-009)
"""
from django.conf import settings
from django.db import models

from apps.core.models import CompaniaAseguradora, Vehiculo

# Las 8 fases operativas secuenciales de taller (las 2 previas son Armado y Aprobación de presupuesto)
FASES_TALLER_DEFINICION = [
    (1, "Recepción"),
    (2, "Desarme"),
    (3, "Chapa"),
    (4, "Preparación"),
    (5, "Pintura"),
    (6, "Armado"),
    (7, "Pulido"),
    (8, "Alistado para entrega"),
]


class OrdenDeTrabajo(models.Model):
    """
    Entidad OrdenDeTrabajo según Tabla 15 del Diccionario de Datos:
    - id_orden: SERIAL (PK)
    - codigo_seguimiento: VARCHAR(20) UNIQUE (ej.: OT-2026-048)
    - fecha_ingreso: DATE
    - fecha_estimada_entrega: DATE
    - fecha_entrega_real: DATE (null)
    - tipo_cliente: VARCHAR(20) ("particular" o "aseguradora")
    - nro_orden_aseguradora: VARCHAR(40)
    - estado_actual: VARCHAR(30)
    - monto_total: DECIMAL(12,2)
    - saldo_pendiente: DECIMAL(12,2)
    - id_vehiculo: INTEGER (FK -> Vehiculo)
    - id_compania: INTEGER (FK -> CompaniaAseguradora, null)
    - id_presupuesto: INTEGER (FK UNIQUE 1:1 -> Presupuesto)
    """

    id_orden = models.AutoField(primary_key=True, db_column="id_orden")
    codigo_seguimiento = models.CharField(
        max_length=20, unique=True, db_column="codigo_seguimiento"
    )
    fecha_ingreso = models.DateField(db_column="fecha_ingreso")
    fecha_estimada_entrega = models.DateField(db_column="fecha_estimada_entrega")
    fecha_entrega_real = models.DateField(
        null=True, blank=True, db_column="fecha_entrega_real"
    )
    tipo_cliente = models.CharField(max_length=20, db_column="tipo_cliente")
    nro_orden_aseguradora = models.CharField(
        max_length=40, blank=True, default="", db_column="nro_orden_aseguradora"
    )
    estado_actual = models.CharField(
        max_length=30, default="Pendiente de Recepción", db_column="estado_actual"
    )
    monto_total = models.DecimalField(
        max_digits=12, decimal_places=2, db_column="monto_total"
    )
    saldo_pendiente = models.DecimalField(
        max_digits=12, decimal_places=2, db_column="saldo_pendiente"
    )
    vehiculo = models.ForeignKey(
        Vehiculo,
        on_delete=models.PROTECT,
        related_name="ordenes_trabajo",
        db_column="id_vehiculo",
    )
    compania = models.ForeignKey(
        CompaniaAseguradora,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ordenes_trabajo",
        db_column="id_compania",
    )
    presupuesto = models.OneToOneField(
        "budgets.Presupuesto",
        on_delete=models.PROTECT,
        related_name="orden_trabajo",
        db_column="id_presupuesto",
    )

    class Meta:
        db_table = "orden_de_trabajo"
        verbose_name = "Orden de Trabajo"
        verbose_name_plural = "Órdenes de Trabajo"
        ordering = ["-id_orden"]

    def __str__(self):
        return f"{self.codigo_seguimiento} ({self.vehiculo.patente} - {self.estado_actual})"


class FaseReparacion(models.Model):
    """
    Entidad FaseReparacion según Tabla 16 del Diccionario de Datos:
    - id_fase: SERIAL (PK)
    - id_orden: INTEGER (FK -> OrdenDeTrabajo)
    - numero_secuencia: INTEGER (1..8)
    - nombre_fase: VARCHAR(30)
    - estado: VARCHAR(15) ("pendiente", "en_curso", "completada")
    - fecha_inicio: TIMESTAMP (null)
    - fecha_fin: TIMESTAMP (null)
    - observaciones: VARCHAR(500)
    - id_usuario_responsable: INTEGER (FK -> Usuario, null)
    """

    class EstadoFase(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        EN_CURSO = "en_curso", "En curso"
        COMPLETADA = "completada", "Completada"

    id_fase = models.AutoField(primary_key=True, db_column="id_fase")
    orden = models.ForeignKey(
        OrdenDeTrabajo,
        on_delete=models.CASCADE,
        related_name="fases",
        db_column="id_orden",
    )
    numero_secuencia = models.IntegerField(db_column="numero_secuencia")
    nombre_fase = models.CharField(max_length=30, db_column="nombre_fase")
    estado = models.CharField(
        max_length=15,
        choices=EstadoFase.choices,
        default=EstadoFase.PENDIENTE,
        db_column="estado",
    )
    fecha_inicio = models.DateTimeField(null=True, blank=True, db_column="fecha_inicio")
    fecha_fin = models.DateTimeField(null=True, blank=True, db_column="fecha_fin")
    observaciones = models.CharField(
        max_length=500, blank=True, default="", db_column="observaciones"
    )
    usuario_responsable = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fases_certificadas",
        db_column="id_usuario_responsable",
    )

    class Meta:
        db_table = "fase_reparacion"
        verbose_name = "Fase de Reparación"
        verbose_name_plural = "Fases de Reparación"
        ordering = ["orden", "numero_secuencia"]
        constraints = [
            models.UniqueConstraint(
                fields=["orden", "numero_secuencia"],
                name="uniq_orden_secuencia_fase",
            )
        ]

    def __str__(self):
        return f"{self.orden.codigo_seguimiento} | Fase {self.numero_secuencia}: {self.nombre_fase} ({self.estado})"
