"""
Validadores de seguridad de credenciales para HU-001.
Implementa las 5 reglas obligatorias de complejidad de contraseña detalladas en el TFG.
"""
import re
from rest_framework.exceptions import ValidationError


def validate_password_complexity(password: str) -> str:
    """
    HU-001 Criterio 2:
    Dada una contraseña ingresada durante el alta o cambio de clave, cuando no cumpla con:
    (a) al menos 8 caracteres,
    (b) una letra mayúscula,
    (c) una letra minúscula,
    (d) un número, y
    (e) un carácter especial,
    entonces el sistema bloqueará el guardado y detallará los requisitos de complejidad faltantes.
    """
    if not password:
        raise ValidationError("Debe ingresar una contraseña.")

    missing = []
    if len(password) < 8:
        missing.append("tener al menos 8 caracteres")
    if not re.search(r"[A-Z]", password):
        missing.append("incluir al menos una letra mayúscula")
    if not re.search(r"[a-z]", password):
        missing.append("incluir al menos una letra minúscula")
    if not re.search(r"\d", password):
        missing.append("incluir al menos un número")
    if not re.search(r"[^A-Za-z0-9]", password):
        missing.append("incluir al menos un carácter especial (ej.: @, #, $, %, &, *)")

    if missing:
        raise ValidationError(
            f"La contraseña no cumple con la política de seguridad. Requisitos faltantes: {', '.join(missing)}."
        )
    return password
