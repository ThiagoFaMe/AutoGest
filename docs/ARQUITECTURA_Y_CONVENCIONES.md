# Arquitectura y Convenciones de Ingeniería – AutoGest

Este documento establece las normas de diseño y organización del código de **AutoGest**. Su objetivo es doble:
1. **Mantenibilidad real para Taller Sergio:** Que cualquier cambio futuro (por ejemplo, agregar una nueva fase al taller, cambiar una fórmula de mora o modificar un formulario) se haga en un único archivo pequeño y localizado, sin romper el resto del sistema.
2. **Defensa académica del TFG:** Que cada regla de negocio documentada en la tesis (`HU-001` a `HU-014`) tenga una correspondencia directa, limpia y fácil de mostrar ante el tribunal evaluador.

---

## 1. Regla de Oro contra el "Código Espagueti"
* **Ningún archivo debe superar las ~250 líneas de código.** Si un archivo crece más allá de eso, se divide por responsabilidad.
* **Separación estricta de capas (Backend Django):**
  * `models.py`: **Solo estructura de datos**, nombres de columnas exactos al Diccionario de Datos del TFG, claves foráneas y restricciones de integridad (`UNIQUE`, índices).
  * `validators.py`: Funciones puras de validación (complejidad de contraseña por Regex, formato de patente Mercosur/antigua, rango de días de pago de aseguradoras).
  * `services.py`: **Aquí vive la lógica de negocio y las transacciones (`@transaction.atomic`)**. Por ejemplo: bloqueo tras 5 intentos fallidos, creación automática de `OrdenDeTrabajo` y sus 8 fases al aprobar un presupuesto, validación secuencial de fase $n-1$, descuento de stock y cálculo de mora.
  * `serializers.py`: Transformación de datos (JSON $\leftrightarrow$ Modelo) y formateo de respuestas de error claras para el usuario.
  * `views.py`: Controladores delgados (*thin views*) que reciben la petición HTTP, verifican el permiso del rol (`permissions.py`), delegan el trabajo a `services.py` y devuelven la respuesta HTTP.
  * `tests.py`: Pruebas automatizadas que verifican cada criterio de aceptación (*Dado / Cuando / Entonces*) de las Historias de Usuario.

* **Separación estricta de capas (Frontend React):**
  * `src/api/`: Un archivo por módulo (`authApi.js`, `clientsApi.js`, `vehiclesApi.js`, `insurersApi.js`, etc.). Ningún componente de interfaz hace llamadas `fetch`/`axios` directas; siempre usa la capa `src/api/`.
  * `src/context/`: Estado global de sesión (`AuthContext.jsx`) con decodificación de rol (`administrador`, `administrativo`, `operario`).
  * `src/layouts/`: Separación visual entre el entorno de **Oficina** (`MainLayout.jsx`) y el entorno táctil del **Galpón** (`WorkshopLayout.jsx`).
  * `src/components/common/`: Componentes reutilizables pequeños (alertas, modales de confirmación, badges de estado, buscadores).
  * `src/pages/`: Una carpeta por módulo de negocio (`users/`, `clients/`, `vehicles/`, `insurers/`, `budgets/`, `workorders/`, `inventory/`, `finance/`).

---

## 2. Mapa de Módulos vs. Historias de Usuario (TFG)

| Módulo Backend | Módulo Frontend | Entidades del DER (PostgreSQL) | Historias de Usuario | Sprint |
| :--- | :--- | :--- | :--- | :---: |
| `apps/users` | `src/pages/users` | `Usuario` | `HU-001` | Sprint 1 |
| `apps/core` | `src/pages/clients`<br>`src/pages/vehicles`<br>`src/pages/insurers` | `Cliente`, `Vehiculo`, `CompaniaAseguradora` | `HU-002`, `HU-003`, `HU-004` | Sprint 1 |
| `apps/budgets` | `src/pages/budgets` | `Presupuesto`, `ItemPresupuesto` | `HU-005`, `HU-006`, `HU-007` | Sprint 2 |
| `apps/workorders` | `src/pages/workorders` | `OrdenDeTrabajo`, `FaseReparacion` | `HU-008`, `HU-009` | Sprint 3 |
| `apps/inventory` | `src/pages/inventory` | `InsumoRepuesto`, `MovimientoStock` | `HU-010`, `HU-011`, `HU-012` | Sprint 4 |
| `apps/finance` | `src/pages/finance`<br>`src/pages/dashboard` | `CuentaPorCobrar`, `MovimientoFinanciero` | `HU-013`, `HU-014` | Sprint 5 |

---

## 3. ¿Cómo hacer cambios frecuentes en el futuro?

* **¿Cambió un requisito de contraseña o el tiempo de bloqueo de 15 minutos?**
  $\rightarrow$ Editar las constantes `MAX_FAILED_ATTEMPTS = 5` y `LOCKOUT_MINUTES = 15` en `backend/apps/users/services.py`.
* **¿Taller Sergio quiere cambiar los plazos permitidos de aseguradoras?**
  $\rightarrow$ Editar `validate_plazo_pago_dias` en `backend/apps/core/validators.py`.
* **¿Querés agregar un campo nuevo a Clientes?**
  1. Agregar el campo en `backend/apps/core/models.py` (`Cliente`).
  2. Ejecutar `docker compose exec backend python manage.py makemigrations && docker compose exec backend python manage.py migrate`.
  3. Agregar el input en `frontend/src/pages/clients/ClientFormModal.jsx`.
