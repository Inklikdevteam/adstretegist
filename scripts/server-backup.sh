#!/bin/bash

# AdStrategist Server Backup Script
set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

# Configuration
BACKUP_DIR="/opt/adstrategist-backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30
MAX_BACKUPS=50

echo "🗄️  AdStrategist Server Backup"
echo "=============================="

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

print_info "Starting backup process..."
print_info "Backup directory: $BACKUP_DIR"
print_info "Timestamp: $DATE"

# Database backup
print_info "Creating database backup..."
DB_BACKUP_FILE="adstrategist_db_${DATE}.sql"

if docker-compose -f docker-compose.server.yml exec -T postgres pg_dump -U adstrategist_user -d adstrategist > "$BACKUP_DIR/$DB_BACKUP_FILE"; then
    print_status "Database backup created: $DB_BACKUP_FILE"
else
    print_error "Database backup failed"
    exit 1
fi

# Compress database backup
print_info "Compressing database backup..."
gzip "$BACKUP_DIR/$DB_BACKUP_FILE"
DB_BACKUP_FILE="${DB_BACKUP_FILE}.gz"
print_status "Database backup compressed: $DB_BACKUP_FILE"

# Application configuration backup
print_info "Creating configuration backup..."
CONFIG_BACKUP_FILE="adstrategist_config_${DATE}.tar.gz"

# Create temporary directory for config files
TEMP_CONFIG_DIR="/tmp/adstrategist_config_$DATE"
mkdir -p "$TEMP_CONFIG_DIR"

# Copy configuration files (excluding sensitive data)
cp docker-compose.server.yml "$TEMP_CONFIG_DIR/" 2>/dev/null || true
cp nginx-server.conf "$TEMP_CONFIG_DIR/" 2>/dev/null || true
cp .env.example "$TEMP_CONFIG_DIR/" 2>/dev/null || true

# Copy nginx configuration if it exists
if [ -f "/etc/nginx/nginx.conf" ]; then
    cp /etc/nginx/nginx.conf "$TEMP_CONFIG_DIR/nginx.conf" 2>/dev/null || true
fi

# Create config backup archive
tar -czf "$BACKUP_DIR/$CONFIG_BACKUP_FILE" -C "$TEMP_CONFIG_DIR" . 2>/dev/null || true
rm -rf "$TEMP_CONFIG_DIR"

if [ -f "$BACKUP_DIR/$CONFIG_BACKUP_FILE" ]; then
    print_status "Configuration backup created: $CONFIG_BACKUP_FILE"
else
    print_warning "Configuration backup failed or no config files found"
fi

# Docker volumes backup (optional - can be large)
if [ "$1" = "--include-volumes" ]; then
    print_info "Creating Docker volumes backup..."
    VOLUMES_BACKUP_FILE="adstrategist_volumes_${DATE}.tar.gz"
    
    # Stop containers temporarily for consistent backup
    print_info "Stopping containers for volume backup..."
    docker-compose -f docker-compose.server.yml stop
    
    # Backup data directories
    if [ -d "/opt/adstrategist-data" ]; then
        tar -czf "$BACKUP_DIR/$VOLUMES_BACKUP_FILE" -C /opt adstrategist-data 2>/dev/null || true
        print_status "Volumes backup created: $VOLUMES_BACKUP_FILE"
    else
        print_warning "Data directory not found, skipping volumes backup"
    fi
    
    # Restart containers
    print_info "Restarting containers..."
    docker-compose -f docker-compose.server.yml start
    print_status "Containers restarted"
fi

# SSL certificates backup
if [ -d "/etc/letsencrypt" ]; then
    print_info "Creating SSL certificates backup..."
    SSL_BACKUP_FILE="adstrategist_ssl_${DATE}.tar.gz"
    
    sudo tar -czf "$BACKUP_DIR/$SSL_BACKUP_FILE" -C /etc letsencrypt 2>/dev/null || true
    sudo chown $USER:$USER "$BACKUP_DIR/$SSL_BACKUP_FILE" 2>/dev/null || true
    
    if [ -f "$BACKUP_DIR/$SSL_BACKUP_FILE" ]; then
        print_status "SSL certificates backup created: $SSL_BACKUP_FILE"
    else
        print_warning "SSL certificates backup failed"
    fi
fi

# Create backup manifest
print_info "Creating backup manifest..."
MANIFEST_FILE="adstrategist_manifest_${DATE}.txt"
cat > "$BACKUP_DIR/$MANIFEST_FILE" << EOF
AdStrategist Backup Manifest
============================
Date: $(date)
Hostname: $(hostname)
Backup Directory: $BACKUP_DIR

Files in this backup:
EOF

# List backup files
ls -la "$BACKUP_DIR"/*_${DATE}.* >> "$BACKUP_DIR/$MANIFEST_FILE" 2>/dev/null || true

# Add system information
cat >> "$BACKUP_DIR/$MANIFEST_FILE" << EOF

System Information:
- OS: $(lsb_release -d 2>/dev/null | cut -f2 || uname -a)
- Docker Version: $(docker --version)
- Docker Compose Version: $(docker-compose --version)
- Uptime: $(uptime)

Container Status at Backup Time:
EOF

docker-compose -f docker-compose.server.yml ps >> "$BACKUP_DIR/$MANIFEST_FILE" 2>/dev/null || true

print_status "Backup manifest created: $MANIFEST_FILE"

# Calculate backup sizes
print_info "Backup Summary:"
TOTAL_SIZE=0
for file in "$BACKUP_DIR"/*_${DATE}.*; do
    if [ -f "$file" ]; then
        SIZE=$(du -h "$file" | cut -f1)
        SIZE_BYTES=$(du -b "$file" | cut -f1)
        TOTAL_SIZE=$((TOTAL_SIZE + SIZE_BYTES))
        echo "  $(basename "$file"): $SIZE"
    fi
done

TOTAL_SIZE_HUMAN=$(echo $TOTAL_SIZE | awk '{
    if ($1 > 1073741824) printf "%.2f GB", $1/1073741824
    else if ($1 > 1048576) printf "%.2f MB", $1/1048576
    else if ($1 > 1024) printf "%.2f KB", $1/1024
    else printf "%d B", $1
}')

print_status "Total backup size: $TOTAL_SIZE_HUMAN"

# Cleanup old backups
print_info "Cleaning up old backups..."

# Remove backups older than retention period
find "$BACKUP_DIR" -name "adstrategist_*_*.sql.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "adstrategist_*_*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "adstrategist_*_*.txt" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

# Keep only the most recent backups if we exceed max count
DB_BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/adstrategist_db_*.sql.gz 2>/dev/null | wc -l)
if [ "$DB_BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    EXCESS=$((DB_BACKUP_COUNT - MAX_BACKUPS))
    ls -1t "$BACKUP_DIR"/adstrategist_db_*.sql.gz | tail -$EXCESS | xargs rm -f
    print_info "Removed $EXCESS old database backups"
fi

print_status "Cleanup completed"

# Verify backup integrity
print_info "Verifying backup integrity..."
if gzip -t "$BACKUP_DIR/$DB_BACKUP_FILE" 2>/dev/null; then
    print_status "Database backup integrity verified"
else
    print_error "Database backup integrity check failed"
fi

# Display final status
echo ""
print_status "🎉 Backup completed successfully!"
echo ""
print_info "Backup files created:"
ls -la "$BACKUP_DIR"/*_${DATE}.* 2>/dev/null || echo "No backup files found"

echo ""
print_info "Available backups:"
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/adstrategist_db_*.sql.gz 2>/dev/null | wc -l)
echo "Total database backups: $BACKUP_COUNT"
echo "Retention period: $RETENTION_DAYS days"
echo "Max backups kept: $MAX_BACKUPS"

echo ""
print_info "To restore from this backup:"
echo "1. Stop the application: docker-compose -f docker-compose.server.yml stop app"
echo "2. Restore database: gunzip -c $BACKUP_DIR/$DB_BACKUP_FILE | docker-compose -f docker-compose.server.yml exec -T postgres psql -U adstrategist_user -d adstrategist"
echo "3. Start the application: docker-compose -f docker-compose.server.yml start app"

echo ""
print_info "Backup location: $BACKUP_DIR"
print_info "Next backup recommendation: $(date -d '+1 day' '+%Y-%m-%d %H:%M')"