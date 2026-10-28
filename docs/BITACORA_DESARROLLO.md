# Bitácora de Desarrollo y Trazabilidad – AutoGest

Este documento registra paso a paso todo lo construido en cada Sprint, vinculando cada Historia de Usuario (`HU`) con los archivos exactos del código fuente, la base de datos y las pruebas. Sirve como **guía rápida de estudio para la defensa del TFG** y como manual técnico del sistema.

---

## Fase 0: Infraestructura Docker y Esqueleto Modular
- **Archivos creados:**
  - `docker-compose.yml`: Orquestación de 3 servicios en red local (`db` con PostgreSQL 16 Alpine, `backend` con Python 3.12 + Django 5 + DRF + Bcrypt + JWT, `frontend` con React 18 + Vite + Bootstrap 5).
  - `backend/config/`: Configuración central de Django, conexión a PostgreSQL, configuración de `BCryptPasswordHasher` como algoritmo primario de hashing (cumpliendo la sección *Seguridad* del TFG) y JWT con vigencia de 8 horas (jornada laboral).
  - `scripts/backup_autogest.sh`: Script automatizado de respaldo (`pg_dump` comprimido + rotación de 14 días) alineado con la regla 3-2-1 documentada en el TFG.

---

## Sprint 1: Seguridad RBAC y Padrones Maestros (`HU-001` a `HU-004`)

### `HU-001`: Autenticación de usuarios y control de acceso por roles
- **Tabla en PostgreSQL:** `usuario` (`id_usuario`, `nombre_completo`, `email`, `password_hash`, `rol`, `intentos_fallidos`, `bloqueado_hasta`, `activo`).
- **Reglas de negocio implementadas:**
  1. **Unicidad de correo (`email`):** Validada en base de datos (`UNIQUE`) y en `backend/apps/users/serializers.py`.
  2. **Complejidad de contraseña (5 reglas):** Validada en `backend/apps/users/validators.py` (mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial, detallando qué requisito falta).
  3. **Encriptación Bcrypt:** Configurada en `PASSWORD_HASHERS` y almacenada en la columna `password_hash`.
  4. **Bloqueo automático tras 5 intentos fallidos:** En `backend/apps/users/services.py` (`authenticate_user`), cada fallo incrementa `intentos_fallidos`. Al llegar a 5, fija `bloqueado_hasta = timezone.now() + timedelta(minutes=15)`. Un login exitoso reinicia el contador a 0.
  5. **Control de acceso por roles (RBAC):** Implementado en `backend/apps/users/permissions.py` (`IsAdministrador`, `IsAdministrativoOrAdmin`, `IsOperarioOrAbove`). Si un `operario` intenta acceder a módulos administrativos/financieros o gestión de usuarios, recibe `HTTP 403 Forbidden`.

### `HU-002`: Gestión de clientes del taller
- **Tabla en PostgreSQL:** `cliente` (`id_cliente`, `dni`, `nombre`, `apellido`, `telefono`, `email`, `direccion`, `activo`).
- **Reglas de negocio implementadas (`backend/apps/core/`):**
  1. **Prevención de duplicados por DNI con recuperación de ficha:** Si se intenta registrar un `dni` ya existente, el backend rechaza la duplicación (`HTTP 409 Conflict` / `400`) y devuelve en la respuesta el objeto `existing_client` para que la interfaz muestre la ficha existente y permita editarla de inmediato.
  2. **Campos obligatorios:** Validación estricta de `dni`, `nombre`, `apellido` y `telefono`.
  3. **Búsqueda rápida indexada:** Endpoint `GET /api/core/clientes/?search=xxx` que filtra en tiempo real por `dni`, `apellido`, `nombre` o `telefono`.

### `HU-003`: Gestión de vehículos asociados a clientes
- **Tabla en PostgreSQL:** `vehiculo` (`id_vehiculo`, `patente`, `marca`, `modelo`, `anio`, `color`, `id_cliente`).
- **Reglas de negocio implementadas (`backend/apps/core/`):**
  1. **Normalización y validación de dominio (patente):** En `validators.py` y `models.py`, la patente se convierte automáticamente a mayúsculas sin espacios ni guiones y se valida contra los patrones oficiales argentinos: Mercosur (`AA123BB`) o formato anterior (`ABC123`).
  2. **Unicidad con devolución de vehículo e historial:** Si la patente ya existe, el sistema bloquea el alta duplicada y devuelve los datos del vehículo registrado junto con su cliente titular e historial de órdenes.

### `HU-004`: Gestión de compañías aseguradoras y plazos de pago
- **Tabla en PostgreSQL:** `compania_aseguradora` (`id_compania`, `razon_social`, `cuit`, `plazo_pago_dias`, `telefono`, `email_peritos`).
- **Reglas de negocio implementadas (`backend/apps/core/`):**
  1. **Unicidad de CUIT:** Restricción `UNIQUE` en `cuit` con mensaje claro ante duplicidad.
  2. **Validación comercial de `plazo_pago_dias`:** Restringido estrictamente al rango `1 <= plazo_pago_dias <= 180` días (ej. 30, 45, 60 días), listo para el cálculo automático de vencimientos en el Sprint 5.
