#!/bin/bash

# AdStrategist Backup Script
set -e

# Configuration
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="adstrategist_backup_${DATE}.sql"
RETENTION_DAYS=7

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "🗄️  Starting database backup..."

# Create database backup
docker-compose exec -T postgres pg_dump -U adstrategist_user -d adstrategist > "$BACKUP_DIR/$BACKUP_FILE"

# Compress the backup
gzip "$BACKUP_DIR/$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

echo "✅ Backup created: $BACKUP_DIR/$BACKUP_FILE"

# Clean up old backups (keep only last 7 days)
echo "🧹 Cleaning up old backups..."
find "$BACKUP_DIR" -name "adstrategist_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Show backup size
BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
echo "📊 Backup size: $BACKUP_SIZE"

# List all backups
echo "📋 Available backups:"
ls -lh "$BACKUP_DIR"/adstrategist_backup_*.sql.gz 2>/dev/null || echo "No backups found"

echo "✅ Backup process completed!"