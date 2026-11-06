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

---

## Sprint 3: Seguimiento Secuencial de Taller y Línea de Tiempo (`HU-008` y `HU-009`)

### `HU-008`: Registro y control de avance secuencial de fases de reparación
- **Tablas en PostgreSQL:** `orden_de_trabajo` (Tabla 15) y `fase_reparacion` (Tabla 16).
- **Reglas de negocio implementadas (`backend/apps/workorders/services.py`):**
  1. **Precedencia secuencial estricta ($n - 1$):** Tanto en `iniciar_fase_reparacion` como en `completar_fase_reparacion`, el sistema verifica que todas las fases con `numero_secuencia < n` estén en estado `"completada"`. Si un operario intenta saltar una etapa (ej.: iniciar `3-Chapa` o `5-Pintura` sin que las previas estén cerradas), el backend rechaza la petición con `HTTP 400 Bad Request` indicando exactamente qué fase previa falta finalizar.
  2. **Trazabilidad automática de marcas de tiempo y responsable:** Al completar la fase $n$, se registra `fecha_fin = timezone.now()`, `id_usuario_responsable = request.user` y se inicia automáticamente la fase $n + 1$ (`estado = "en_curso"`, `fecha_inicio = timezone.now()`), actualizando `OrdenDeTrabajo.estado_actual`.
  3. **Cierre técnico y entrega efectiva:** Al completarse la fase 8 (`Alistado para entrega`), `OrdenDeTrabajo.estado_actual` pasa a `"Lista para entrega"`. Cuando Administración o el Dueño registra el retiro (`registrar_entrega_vehiculo`), se fija `fecha_entrega_real` y el estado pasa a `"Entregada"`.

### `HU-009`: Consulta integral del estado, tiempos y línea de tiempo de reparación
- **Archivos de Backend y Frontend:**
  - `backend/apps/workorders/services.py` (`calculate_phase_duration`, `calculate_order_timing_metrics`) y `serializers.py` (`OrdenDeTrabajoSerializer`, `ConsultaPublicaOrdenSerializer`).
  - `frontend/src/pages/workorders/WorkOrdersPage.jsx`, `WorkOrderDetailModal.jsx` (Prototipo 2 del TFG) y `PublicTrackingPage.jsx`.
- **Reglas de negocio implementadas:**
  1. **Línea de tiempo de 10 etapas (Prototipo 2):** Muestra las 2 fases administrativas previas certificadas (*Armado de presupuesto* y *Aprobación de presupuesto*) seguidas de las 8 fases operativas de taller con sus fechas/horas de inicio y fin, tiempo empleado en horas/minutos (`duracion_texto`) y nombre del operario que certificó.
  2. **Detección automática de retraso:** Si la orden sigue abierta (`fecha_entrega_real is None`) y `date.today() > fecha_estimada_entrega`, calcula `en_retraso = True` y `dias_retraso`, resaltando la tarjeta en rojo en el tablero de planta.
  3. **Seguridad RBAC (Tabla 21):** Cuando consulta un usuario con rol `operario`, el serializador enmascara `monto_total` y `saldo_pendiente` (`None`). Además, expone el portal público `/seguimiento` (`GET /api/workorders/seguimiento/<codigo>/`) para consulta externa por código (`OT-2026-001`) o patente sin exponer datos sensibles.

---

## Sprint 4: Inventario de Pañol y Consumo por Orden de Trabajo (`HU-010` a `HU-012`)

### `HU-010`: Gestión del catálogo de insumos, repuestos y configuración de stock mínimo
- **Tabla en PostgreSQL:** `insumo_repuesto` (Tabla 17) en `backend/apps/inventory/models.py`.
- **Reglas de negocio implementadas:**
  1. **Unicidad de código interno (`codigo`):** Normaliza en mayúsculas (`INS-001`, `REP-101`) y valida unicidad estricta en `InsumoRepuestoSerializer`.
  2. **Umbral de reposición (`stock_minimo >= 0`) y alerta automática:** La propiedad `en_alerta_stock` (`stock_actual <= stock_minimo`) etiqueta automáticamente el ítem con `"Bajo Stock / Reposición Crítica"` y lo resalta en rojo en la interfaz (`InventoryPage.jsx` - Prototipo 4).

### `HU-011`: Registro de ingresos de stock por compras y remitos de proveedores
- **Tabla en PostgreSQL:** `movimiento_stock` (Tabla 18, `tipo_movimiento = "ingreso"`).
- **Reglas de negocio implementadas (`registrar_ingreso_stock` en `backend/apps/inventory/services.py`):**
  1. **Actualización atómica con bloqueo de fila (`select_for_update`):** Verifica `cantidad > 0` y `remito_comprobante` obligatorio, asienta el movimiento con el usuario responsable, suma `stock_actual = stock_actual + cantidad` y actualiza `costo_unitario`.
  2. **Desactivación automática de alerta:** Si el insumo se encontraba en alerta (`stock_actual <= stock_minimo`) y tras el ingreso supera el umbral, el sistema desactiva automáticamente la alerta de reposición e informa el cambio.
  3. **Seguridad RBAC:** Solo los perfiles `administrador` y `administrativo` pueden registrar ingresos por compra (`IsAdministrativoOrAdmin`).

### `HU-012`: Registro de consumo de insumos por Orden de Trabajo y alertas de reposición
- **Reglas de negocio implementadas (`registrar_consumo_ot` y `calcular_costo_materiales_orden` en `backend/apps/inventory/services.py`):**
  1. **Vínculo obligatorio a OT activa y bloqueo de stock negativo:** Si no se selecciona una `OrdenDeTrabajo` activa o si `cantidad > stock_actual`, el backend rechaza la transacción (`HTTP 400 Bad Request`) informando el stock disponible exacto.
  2. **Descuento atómico y costo acumulado por vehículo:** Resta `stock_actual = stock_actual - cantidad`, guarda el `MovimientoStock` (`tipo_movimiento = "egreso_consumo"`) con el costo unitario vigente y recalcula el `costo_materiales_consumidos` de esa `OrdenDeTrabajo` (visible también dentro del modal de detalle de la orden en `WorkOrderDetailModal.jsx`).
  3. **Disparo inmediato de alerta de Stock Mínimo Alcanzado:** Si el remanente queda `<= stock_minimo`, devuelve `alerta_stock_minimo = True` y despliega un aviso preventivo inmediato en pantalla.

---

## Sprint 5: Cuentas por Cobrar, Flujo de Caja y Dashboard de KPIs (`HU-013` y `HU-014`)

### `HU-013`: Seguimiento de cuentas por cobrar a aseguradoras, vencimientos y cálculo de mora
- **Tabla en PostgreSQL:** `cuenta_por_cobrar` (Tabla 19) en `backend/apps/finance/models.py`.
- **Reglas de negocio implementadas (`backend/apps/finance/services.py`):**
  1. **Cálculo automático de vencimiento (`emitir_factura_cuenta_por_cobrar`):** Toma el parámetro `plazo_pago_dias` de la `CompaniaAseguradora` vinculada a la orden (30, 45 o 60 días) y calcula `fecha_vencimiento = fecha_emision + timedelta(days=plazo_pago_dias)`, iniciando con `saldo_pendiente = monto_facturado` y estado `"pendiente_en_plazo"`.
  2. **Detección automática de mora y priorización de reclamos (`sincronizar_estados_mora_cuentas`):** En cada consulta, toda cuenta con `saldo_pendiente > 0` y `date.today() > fecha_vencimiento` pasa automáticamente a `"vencida_en_mora"`, calcula `dias_mora = (date.today() - fecha_vencimiento).days` y se ordena al tope del panel de reclamos (`CuentaPorCobrarViewSet`).
  3. **Conciliación de cobros parciales y totales:** Al imputar un cobro, recalcula `saldo_pendiente = monto_facturado - monto_cobrado`, asignando `"pago_parcial"` si resta saldo o `"cancelada"` cuando llega a `$0.00` (sincronizando también el `saldo_pendiente` de la `OrdenDeTrabajo`).

### `HU-014`: Registro de movimientos financieros, conciliación de cobros y Dashboard de KPIs
- **Tabla en PostgreSQL:** `movimiento_financiero` (Tabla 20) en `backend/apps/finance/models.py`.
- **Reglas de negocio implementadas (`registrar_movimiento_financiero` y `calcular_kpis_dashboard` en `backend/apps/finance/services.py`):**
  1. **Control de ingresos y bloqueo de sobrecobro:** Valida que ningún ingreso supere el `saldo_pendiente` de la factura u orden y registra el medio de pago (`efectivo`, `transferencia` o `e-cheq`).
  2. **Registro de egresos y Flujo de Caja Neto:** Registra compras de insumos/repuestos y gastos operativos, calculando en tiempo real `flujo_caja_neto = ingresos_totales - egresos_totales`.
  3. **Dashboard Principal de 6 KPIs en tiempo real (`DashboardPage.jsx` - Prototipo 1):**
     - **(a)** Vehículos activos en taller y gráfico de barras de distribución por las 8 fases secuenciales.
     - **(b)** Tiempo promedio del ciclo de reparación (días) y tiempo promedio por fase (horas).
     - **(c)** Tasa de conversión de presupuestos (`Aprobados / Emitidos × 100`).
     - **(d)** Flujo de caja neto (Ingresos cobrados vs. Egresos).
     - **(e)** Deuda pendiente de aseguradoras discriminando cartera en plazo y cartera vencida en mora.
     - **(f)** Cantidad de insumos en alerta de stock mínimo.




