# AutoGest – Sistema de Gestión y Trazabilidad para Talleres de Chapa y Pintura

**Trabajo Final de Grado – Ingeniería en Software (Universidad Siglo 21)**  
**Título:** AutoGest: Gestión y trazabilidad de los procesos operativos en talleres de chapa y pintura  
**Autor:** Facchin Mendonca, Thiago (Legajo: SOF02294)  
**Tutora:** Castro, Fabiana  
**Caso de Estudio:** Taller Sergio (Córdoba Capital, Argentina)

---

## 1. Descripción General del Prototipo

**AutoGest** es una plataforma web cliente-servidor diseñada para digitalizar, estandarizar y dar trazabilidad integral a los procesos operativos, de control de inventario y económico-financieros en talleres de reparación de carrocería y pintura automotriz.

### Funcionalidades Principales Implementadas
1. **Autenticación Segura y Permisos por Rol (RBAC):** Acceso diferenciado para **Administrador (Dueño)**, **Administrativo (Recepción/Oficina)** y **Operario (Chapa/Pintura)** mediante tokens JWT, contraseñas encriptadas con `bcrypt` y bloqueo automático tras 5 intentos fallidos.
2. **Padrón Maestro de Clientes, Vehículos y Compañías Aseguradoras:** Validación de unicidad por DNI, CUIT y patente normalizada, con configuración de plazos de pago diferidos (30/60 días) por aseguradora.
3. **Presupuestación Diferenciada y Apertura Automática de Orden de Trabajo:**
   - **Modalidad Particular:** Cotización de ítems de mano de obra (chapa/pintura) y repuestos.
   - **Modalidad Compañía Aseguradora:** Registro de número de siniestro, perito liquidador y cómputo de mano de obra homologada (repuestos provistos por la compañía).
   - Generación transaccional unívoca (1:1) de la **Orden de Trabajo (OT)** al aprobar el presupuesto.
4. **Control Secuencial de Fases de Reparación (Máquina de Estados):**
   - Seguimiento de las 10 etapas del ciclo (Armado y Aprobación de Presupuesto certificadas en origen + 8 fases operativas en taller: *1-Recepción, 2-Desarme, 3-Chapa, 4-Preparación, 5-Pintura, 6-Armado, 7-Pulido y 8-Alistado para entrega*).
   - Validación estricta de precedencia (bloqueo de avance a la fase $n+1$ si la fase $n$ no se encuentra completada), registro automático de marcas temporales (`fecha_inicio`, `fecha_fin`), operario responsable y cálculo de duración por etapa.
   - **Portal Público de Seguimiento para Clientes:** Consulta en tiempo real mediante código único de seguimiento (ej. `OT-2026-001`) y patente, con estimación inteligente de entrega.
5. **Gestión de Inventario de Insumos y Repuestos:**
   - Catálogo categorizado (*Pintura, Preparación, Abrasivos, Autopartes*) con umbral de `stock_minimo`.
   - Registro de **Ingresos por Remito de Compra** y **Egresos por Consumo vinculados a cada Orden de Trabajo**, validando existencias disponibles (`stock_actual >= cantidad`) y disparando alertas visuales de reposición crítica (`stock_actual <= stock_minimo`).
6. **Cuentas por Cobrar, Control de Mora y Flujo de Caja:**
   - **Clientes Particulares:** Facturación con cobro inmediato en el día de retiro del vehículo (`sin plazo pactado diferido`, `fecha_vencimiento = fecha_emision`).
   - **Compañías Aseguradoras:** Cálculo automático de vencimiento según el plazo pactado de la compañía (`fecha_vencimiento = fecha_emision + plazo_pago_dias`), actualización de `saldo_pendiente` ante cobros parciales o totales y detección automática de facturas **Vencidas en Mora** con cómputo de días de atraso.
   - Registro centralizado de ingresos y egresos operativos con balance neto de caja.
7. **Dashboard de Indicadores Clave de Rendimiento (KPIs):** Visualización en tiempo real de vehículos activos en taller, distribución por fase (cuellos de botella), tasa de conversión de presupuestos, tiempo promedio de ciclo, alertas de stock crítico, cartera pendiente/en mora y flujo de caja mensual.

---

## 2. Stack Tecnológico

- **Backend & API REST:** Python 3.12 + Django 5 + Django REST Framework + SimpleJWT + Bcrypt
- **Frontend SPA:** React 18 (Vite) + Bootstrap 5 + Axios
- **Base de Datos Relacional:** PostgreSQL 16 (con soporte SQLite para ejecución local rápida de evaluación)
- **Infraestructura y Despliegue:** Docker & Docker Compose + Nginx + Script de respaldo 3-2-1 (`scripts/backup_autogest.sh`)

---

## 3. Estructura del Repositorio

```text
autogest/
├── docker-compose.yml          # Orquestación PostgreSQL 16 + Backend Django + Frontend React
├── .env.example                # Plantilla de variables de entorno
├── scripts/
│   └── backup_autogest.sh      # Script automatizado de backup pg_dump y rotación (Regla 3-2-1)
├── docs/
│   ├── ARQUITECTURA_Y_CONVENCIONES.md
│   └── BITACORA_DESARROLLO.md
├── backend/                    # API REST modular por dominio (users, core, budgets, workorders, inventory, finance)
└── frontend/                   # Aplicación Web SPA en React 18 + Bootstrap 5
```

---

## 4. Instructivo de Instalación y Ejecución

El prototipo puede ejecutarse de dos maneras: **Opción A (Con Docker Compose)** o **Opción B (Ejecución local directa con Python y Node.js)**.

### Opción A: Ejecución Rápida con Docker (Recomendada)

1. Clonar el repositorio y ubicarse en la carpeta raíz:
   ```bash
   git clone https://github.com/ThiagoFaMe/AutoGest.git
   cd AutoGest
   ```
2. Levantar los contenedores de base de datos, backend y frontend:
   ```bash
   docker compose up -d --build
   ```
3. Cargar los usuarios y el lote de datos de demostración de Taller Sergio:
   ```bash
   docker exec autogest_backend python manage.py seed_sprint1 --demo
   ```
4. Abrir en el navegador web:
   - **Aplicación Web (Frontend):** `http://localhost:5173`
   - **API REST (Backend):** `http://localhost:8000/api/`

---

### Opción B: Ejecución Local sin Docker (Python + Node.js)

#### Paso 1: Levantar el Backend (Django REST Framework)
```bash
cd backend
python -m venv venv
# En Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# En Linux / macOS:
# source venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py seed_sprint1 --demo
python manage.py runserver 8000
```

#### Paso 2: Levantar el Frontend (React + Vite)
En una nueva terminal:
```bash
cd frontend
npm install
npm run dev
```
Acceder desde el navegador a **`http://localhost:5173`**.

---

## 5. Credenciales de Acceso para Prueba y Evaluación

Al ejecutar el comando `python manage.py seed_sprint1 --demo`, el sistema crea automáticamente los perfiles de usuario de Taller Sergio con distintos niveles de permisos (RBAC):

| Perfil / Rol | Usuario (Email) | Contraseña | Permisos Habilitados |
| :--- | :--- | :--- | :--- |
| **Administrador (Dueño)** | `sergio@tallersergio.com.ar` | `AdminSergio2026!` | Acceso total (Usuarios, Clientes, Presupuestos, Órdenes, Stock, Finanzas y KPIs) |
| **Administrativo (Recepción)** | `administracion@tallersergio.com.ar` | `AdminLaura2026!` | Gestión operativa, presupuestos, stock, facturación, cobranzas y dashboard |
| **Operario (Sector Chapa)** | `chapa@tallersergio.com.ar` | `TallerChapa2026!` | Vista táctil de órdenes en taller, avance secuencial de fases y consumo de insumos |
| **Operario (Sector Pintura)** | `pintura@tallersergio.com.ar` | `TallerPintura2026!` | Vista táctil de órdenes en taller, avance secuencial de fases y consumo de insumos |

---

## 6. Ejecución de Pruebas Automatizadas

Para ejecutar la suite de pruebas integrales que valida las reglas de negocio (unicidad, presupuestos, precedencia de fases, descuento de stock y cálculo de vencimientos/mora):

```bash
cd backend
python manage.py test
```
