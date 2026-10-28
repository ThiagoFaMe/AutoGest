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

---

## Sprint 2: Presupuestos y Apertura Automática de Orden de Trabajo (`HU-005` a `HU-007`)

### `HU-005`: Confección y emisión de presupuestos para particulares
- **Tablas en PostgreSQL:** `presupuesto` (Tabla 13) e `item_presupuesto` (Tabla 14).
- **Reglas de negocio implementadas (`backend/apps/budgets/`):**
  1. **Recálculo dinámico de subtotales:** En `recalculate_budget_totals` (`services.py`), cada renglón calcula `subtotal = cantidad * precio_unitario`, suma `monto_mano_obra` (`mano_obra_chapa` + `mano_obra_pintura`), suma `monto_repuestos` (`repuesto`) y calcula `monto_total = monto_mano_obra + monto_repuestos`.
  2. **Bloqueo de emisión en cero o sin ítems:** En `emitir_presupuesto` (`services.py`), si el presupuesto no tiene ítems cargados o su `monto_total <= 0`, rechaza el cambio a estado `"emitido"`.
  3. **Validez de 15 días y vista imprimible/PDF:** Al emitirse formalmente, asigna `estado = "emitido"`, `fecha_emision = date.today()`, `fecha_vencimiento = date.today() + timedelta(days=15)` y habilita el comprobante imprimible en `BudgetPrintModal.jsx`.

### `HU-006`: Confección y emisión de presupuestos para aseguradoras
- **Reglas de negocio implementadas (`backend/apps/budgets/services.py`):**
  1. **Campos periciales obligatorios:** En `validate_budget_modality_rules`, cuando `tipo == "aseguradora"` exige seleccionar `compania`, `nro_siniestro` y `nombre_perito`.
  2. **Exclusión de repuestos provistos por el seguro:** En `recalculate_budget_totals`, cuando `tipo == "aseguradora"`, fija `monto_repuestos = 0.00` y computa dentro de `monto_total` únicamente la mano de obra de chapa y pintura, permitiendo listar las piezas como referencia técnica para la recepción.
  3. **Seguimiento de días a la espera del perito:** Propiedad calculada `dias_espera_aprobacion` expuesta en la tabla principal de `BudgetsPage.jsx`.

### `HU-007`: Aprobación o rechazo de presupuestos y generación automática de Orden de Trabajo
- **Tablas en PostgreSQL:** `orden_de_trabajo` (Tabla 15) y `fase_reparacion` (Tabla 16) en `backend/apps/workorders/models.py`.
- **Reglas de negocio implementadas (`aprobar_presupuesto_y_crear_ot` en `backend/apps/budgets/services.py`):**
  1. **Creación transaccional de `OrdenDeTrabajo`:** Al aprobar un presupuesto `"emitido"`, cambia su estado a `"aprobado"`, exige `nro_orden_aseguradora` si es un seguro, crea la `OrdenDeTrabajo` con código correlativo `OT-2026-XXX` y fija `saldo_pendiente = monto_total`.
  2. **Inicialización automática de las 8 fases operativas:** Genera en `FaseReparacion` las 8 etapas secuenciales del 1 al 8 (`1-Recepción`, `2-Desarme`, `3-Chapa`, `4-Preparación`, `5-Pintura`, `6-Armado`, `7-Pulido`, `8-Alistado para entrega`).
  3. **Relación unívoca 1 a 1 (`OneToOneField`):** Bloquea cualquier intento de generar más de una orden sobre el mismo presupuesto o sobre presupuestos rechazados/vencidos.

