#!/usr/bin/env bash
# ==============================================================================
# AutoGest - Script Automatizado de Respaldo 3-2-1 (backup_autogest.sh)
# Documentado en el Capítulo "Seguridad" del Trabajo Final de Grado.
# Ejecuta pg_dump sobre PostgreSQL 16, comprime en .sql.gz y rota copias >14 días
# ==============================================================================

set -euo pipefail

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="${BACKUP_DIR:-./backups/daily}"
EXTERNAL_DRIVE_DIR="${EXTERNAL_DRIVE_DIR:-./backups/external_usb}"
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR" "$EXTERNAL_DRIVE_DIR"

BACKUP_FILE="$BACKUP_DIR/autogest_db_${TIMESTAMP}.sql.gz"

echo "[$(date)] Iniciando respaldo transaccional de PostgreSQL (AutoGest)..."
docker exec autogest_db pg_dump -U "${POSTGRES_USER:-autogest_user}" "${POSTGRES_DB:-autogest_db}" | gzip > "$BACKUP_FILE"

# Copia hacia segundo soporte físico (Regla 3-2-1)
cp "$BACKUP_FILE" "$EXTERNAL_DRIVE_DIR/"

# Rotación automática de copias con antigüedad mayor a 14 días
find "$BACKUP_DIR" -name "autogest_db_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
find "$EXTERNAL_DRIVE_DIR" -name "autogest_db_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Respaldo completado exitosamente: $BACKUP_FILE"
