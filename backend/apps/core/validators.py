"""
Validadores de reglas de negocio para Clientes, Vehículos y Aseguradoras (HU-002, HU-003, HU-004).
"""
import re
from datetime import date
from rest_framework.exceptions import ValidationError

PATENTE_MERCOSUR_REGEX = re.compile(r"^[A-Z]{2}\d{3}[A-Z]{2}$")
PATENTE_ANTIGUA_REGEX = re.compile(r"^[A-Z]{3}\d{3}$")


def normalize_dni(dni: str) -> str:
    """Limpia puntos y espacios del DNI o CUIT del cliente."""
    cleaned = re.sub(r"[\s\.]", "", (dni or "").strip())
    if not cleaned or len(cleaned) < 7 or len(cleaned) > 15:
        raise ValidationError("Ingrese un número de DNI o CUIT válido (entre 7 y 15 caracteres).")
    return cleaned


def normalize_and_validate_patente(patente: str) -> str:
    """
    HU-003 Criterios 1 y 2:
    Normaliza la patente en mayúsculas sin espacios ni guiones y valida que corresponda
    a formato Mercosur (AA123BB) o formato tradicional argentino (ABC123).
    """
    cleaned = re.sub(r"[\s\-]", "", (patente or "").upper())
    if not (PATENTE_MERCOSUR_REGEX.match(cleaned) or PATENTE_ANTIGUA_REGEX.match(cleaned)):
        raise ValidationError(
            "Formato de patente inválido. Ingrese formato Mercosur (ej.: AA123BB) o tradicional (ej.: ABC123)."
        )
    return cleaned


def validate_vehicle_year(anio: int) -> int:
    """Valida que el año del vehículo sea razonable."""
    max_year = date.today().year + 1
    if anio < 1950 or anio > max_year:
        raise ValidationError(f"El año de fabricación debe estar comprendido entre 1950 y {max_year}.")
    return anio


def validate_plazo_pago_dias(dias: int) -> int:
    """
    HU-004 Criterio 2:
    Dada la configuración del campo plazo_pago_dias de una aseguradora, cuando se ingrese
    un valor menor a 1 o superior a 180 días, el sistema rechazará el valor exigiendo un plazo comercial válido.
    """
    if dias is None or dias < 1 or dias > 180:
        raise ValidationError(
            "El plazo de pago comercial debe estar comprendido entre 1 y 180 días corridos (ej.: 30, 45 o 60 días)."
        )
    return dias
