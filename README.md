# AutoGest – Sistema de Gestión y Trazabilidad para Talleres de Chapa y Pintura

**Trabajo Final de Grado (Ingeniería en Software)**  
**Autor:** Thiago Mendonça Facchin  
**Caso de Estudio / Implementación:** Taller Sergio (Córdoba Capital, Argentina)

---

## Descripción General
**AutoGest** es una plataforma web cliente-servidor diseñada para digitalizar, estandarizar y dar trazabilidad integral a los procesos operativos, de inventario y económico-financieros en talleres de reparación de carrocería y pintura automotriz.

### Stack Tecnológico
- **Backend & API REST:** Python 3.12 + Django 5 + Django REST Framework + SimpleJWT + Bcrypt
- **Frontend SPA:** React 18 (Vite) + Bootstrap 5 + Axios
- **Base de Datos Relacional:** PostgreSQL 16
- **Infraestructura y Despliegue:** Docker & Docker Compose + Script de respaldo 3-2-1 (`scripts/backup_autogest.sh`)

---

## Estructura del Repositorio

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
└── frontend/                   # Aplicación React 18 + Bootstrap 5
```

---

## Ejecución Rápida con Docker

```bash
docker compose up -d --build
```

- **Aplicación Web (Frontend):** `http://localhost:5173`
- **API REST (Backend):** `http://localhost:8000/api/`
- **Ejecución de pruebas automatizadas:**
  ```bash
  docker exec autogest_backend python manage.py test
  ```
