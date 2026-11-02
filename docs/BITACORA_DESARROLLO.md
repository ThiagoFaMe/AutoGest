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

### `HU-005`: Confección y emisión de presupuestos para particulares (Anexo 1 – Talonario Libre)
- **Tablas en PostgreSQL:** `presupuesto` (Tabla 13, incluyendo `detalle_libre` y `rubros_importes`) e `item_presupuesto` (Tabla 14).
- **Formato Real de Taller Sergio (`ParticularSheetEditor.jsx`):**
  1. **Editor estilo Talonario / Hoja de Word con renglones:** Replica el talonario físico de *SERGIO Carrocería y Pintura* (`Boedo 1627 esq. Agustín Garzón - B° 1° de Mayo - Córdoba`, `Tel.: (0351) 455 9798 - Cel.: (0351) 152 165277`) permitiendo redactar libremente las tareas (ej.: `Corsa AA 467 SL / Puerta Del/Izq Pintar y Colocar / M/O = $ 600.000 / -10% En Efectivo (Billete) $ 540.000`).
  2. **Cálculo de Mano de Obra, Repuestos y Descuento Efectivo:** Sincroniza el importe acordado con la base de datos para generar la `OrdenDeTrabajo` y la validez de $+15\text{ días}$.

### `HU-006`: Confección y emisión de presupuestos para aseguradoras (Anexo 2 – Planilla de Casillas `[X]`)
- **Formato Real de Taller Sergio (`AseguradoraGridEditor.jsx` y `aseguradoraPlanillaCatalog.js`):**
  1. **Grilla oficial de 3 columnas y 9 secciones con casillas `[X]`:** Incluye las 9 secciones exactas del formulario físico (*Parte Delantera*, *Parte Trasera*, *Motor*, *Lado Izquierdo*, *Lado Derecho*, *Chasis*, *Tren Delantero*, *Interior* y *Tren Trasero*), donde cada pieza tiene cuadraditos clicables para marcar con una **`X`** en **`C` (Cambiar)**, **`R` (Reparar)** y **`P` (Pintar)**.
  2. **Recuadro oficial de importes al pie de Columna 3:** Permite cargar `MANO DE OBRA $`, `PINTURA $`, `MECÁNICA $`, `ELECTRICIDAD $`, `TAPICERÍA $`, `REPUESTOS $` e `I.V.A. $`, calculando automáticamente el `TOTAL $` e imprimiendo la planilla completa con el sello de *Taller Sergio – Pablo Martín*.
  3. **Campos periciales obligatorios:** Exige seleccionar `compania`, `nro_siniestro` y `nombre_perito`, y calcula `dias_espera_aprobacion`.

### `HU-007`: Aprobación o rechazo de presupuestos y generación automática de Orden de Trabajo
- **Tablas en PostgreSQL:** `orden_de_trabajo` (Tabla 15) y `fase_reparacion` (Tabla 16) en `backend/apps/workorders/models.py`.
- **Reglas de negocio implementadas (`aprobar_presupuesto_y_crear_ot` en `backend/apps/budgets/services.py`):**
  1. **Creación transaccional de `OrdenDeTrabajo`:** Al aprobar un presupuesto `"emitido"`, cambia su estado a `"aprobado"`, exige `nro_orden_aseguradora` si es un seguro, crea la `OrdenDeTrabajo` con código correlativo `OT-2026-XXX` y fija `saldo_pendiente = monto_total`.
  2. **Inicialización automática de las 8 fases operativas:** Genera en `FaseReparacion` las 8 etapas secuenciales del 1 al 8 (`1-Recepción`, `2-Desarme`, `3-Chapa`, `4-Preparación`, `5-Pintura`, `6-Armado`, `7-Pulido`, `8-Alistado para entrega`).
  3. **Relación unívoca 1 a 1 (`OneToOneField`):** Bloquea cualquier intento de generar más de una orden sobre el mismo presupuesto o sobre presupuestos rechazados/vencidos.

