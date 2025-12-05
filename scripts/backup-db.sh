#!/bin/bash

# Script de backup de base de datos PostgreSQL
# Uso: ./scripts/backup-db.sh

# Configuración
DB_NAME="baudex"
DB_USER="postgres"
DB_PASSWORD="123456"
BACKUP_DIR="./backups"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/baudex_backup_$DATE.sql"

# Crear directorio de backups si no existe
mkdir -p "$BACKUP_DIR"

# Realizar backup
echo "🔄 Creando backup de la base de datos..."
PGPASSWORD=$DB_PASSWORD pg_dump -U $DB_USER -h localhost $DB_NAME > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup creado exitosamente: $BACKUP_FILE"

    # Comprimir el backup
    gzip "$BACKUP_FILE"
    echo "✅ Backup comprimido: ${BACKUP_FILE}.gz"

    # Mantener solo los últimos 10 backups
    echo "🧹 Limpiando backups antiguos..."
    ls -t $BACKUP_DIR/baudex_backup_*.sql.gz | tail -n +11 | xargs -r rm
    echo "✅ Limpieza completada"
else
    echo "❌ Error al crear el backup"
    exit 1
fi
