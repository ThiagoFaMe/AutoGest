"""
Modelos de datos para las entidades maestras del taller (Sprint 1):
- Cliente (Tabla 9 del Diccionario de Datos - HU-002)
- Vehiculo (Tabla 10 del Diccionario de Datos - HU-003)
- CompaniaAseguradora (Tabla 11 del Diccionario de Datos - HU-004)
"""
from django.db import models


class Cliente(models.Model):
    """
    Entidad Cliente según Tabla 9 del Diccionario de Datos:
    - id_cliente: SERIAL (PK)
    - dni: VARCHAR(15) UNIQUE
    - nombre: VARCHAR(60)
    - apellido: VARCHAR(60)
    - telefono: VARCHAR(25)
    - email: VARCHAR(100) (opcional)
    - direccion: VARCHAR(150) (opcional)
    - activo: BOOLEAN
    """

    id_cliente = models.AutoField(primary_key=True, db_column="id_cliente")
    dni = models.CharField(max_length=15, unique=True, db_column="dni")
    nombre = models.CharField(max_length=60, db_column="nombre")
    apellido = models.CharField(max_length=60, db_column="apellido")
    telefono = models.CharField(max_length=25, db_column="telefono")
    email = models.EmailField(max_length=100, blank=True, default="", db_column="email")
    direccion = models.CharField(max_length=150, blank=True, default="", db_column="direccion")
    activo = models.BooleanField(default=True, db_column="activo")

    class Meta:
        db_table = "cliente"
        verbose_name = "Cliente"
        verbose_name_plural = "Clientes"
        ordering = ["apellido", "nombre"]

    def __str__(self):
        return f"{self.apellido}, {self.nombre} (DNI: {self.dni})"


class Vehiculo(models.Model):
    """
    Entidad Vehiculo según Tabla 10 del Diccionario de Datos:
    - id_vehiculo: SERIAL (PK)
    - patente: VARCHAR(10) UNIQUE
    - marca: VARCHAR(40)
    - modelo: VARCHAR(50)
    - anio: INTEGER
    - color: VARCHAR(30)
    - id_cliente: INTEGER (FK -> Cliente)
    """

    id_vehiculo = models.AutoField(primary_key=True, db_column="id_vehiculo")
    patente = models.CharField(max_length=10, unique=True, db_column="patente")
    marca = models.CharField(max_length=40, db_column="marca")
    modelo = models.CharField(max_length=50, db_column="modelo")
    anio = models.IntegerField(db_column="anio")
    color = models.CharField(max_length=30, db_column="color")
    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.PROTECT,
        related_name="vehiculos",
        db_column="id_cliente",
    )

    class Meta:
        db_table = "vehiculo"
        verbose_name = "Vehículo"
        verbose_name_plural = "Vehículos"
        ordering = ["patente"]

    def save(self, *args, **kwargs):
        if self.patente:
            self.patente = self.patente.upper().replace(" ", "").replace("-", "")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.patente} - {self.marca} {self.modelo} ({self.anio})"


class CompaniaAseguradora(models.Model):
    """
    Entidad CompaniaAseguradora según Tabla 11 del Diccionario de Datos:
    - id_compania: SERIAL (PK)
    - razon_social: VARCHAR(100)
    - cuit: VARCHAR(13) UNIQUE
    - plazo_pago_dias: INTEGER (1..180, ej.: 30, 45, 60)
    - telefono: VARCHAR(25)
    - email_peritos: VARCHAR(100)
    """

    id_compania = models.AutoField(primary_key=True, db_column="id_compania")
    razon_social = models.CharField(max_length=100, db_column="razon_social")
    cuit = models.CharField(max_length=13, unique=True, db_column="cuit")
    plazo_pago_dias = models.IntegerField(default=30, db_column="plazo_pago_dias")
    telefono = models.CharField(max_length=25, blank=True, default="", db_column="telefono")
    email_peritos = models.EmailField(max_length=100, blank=True, default="", db_column="email_peritos")

    class Meta:
        db_table = "compania_aseguradora"
        verbose_name = "Compañía Aseguradora"
        verbose_name_plural = "Compañías Aseguradoras"
        ordering = ["razon_social"]

    def __str__(self):
        return f"{self.razon_social} (CUIT: {self.cuit} - Plazo: {self.plazo_pago_dias} días)"
