#!/bin/bash

# AdStrategist Server Restore Script
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

echo "🔄 AdStrategist Server Restore"
echo "=============================="

BACKUP_DIR="/opt/adstrategist-backups"

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    print_error "Backup directory not found: $BACKUP_DIR"
    exit 1
fi

# List available backups
print_info "Available database backups:"
BACKUPS=($(ls -1t "$BACKUP_DIR"/adstrategist_db_*.sql.gz 2>/dev/null))

if [ ${#BACKUPS[@]} -eq 0 ]; then
    print_error "No database backups found in $BACKUP_DIR"
    exit 1
fi

# Display backups with numbers
for i in "${!BACKUPS[@]}"; do
    BACKUP_FILE=$(basename "${BACKUPS[$i]}")
    BACKUP_DATE=$(echo "$BACKUP_FILE" | sed 's/adstrategist_db_\(.*\)\.sql\.gz/\1/')
    BACKUP_SIZE=$(du -h "${BACKUPS[$i]}" | cut -f1)
    BACKUP_AGE=$(stat -c %Y "${BACKUPS[$i]}")
    CURRENT_TIME=$(date +%s)
    AGE_HOURS=$(( (CURRENT_TIME - BACKUP_AGE) / 3600 ))
    
    echo "$((i+1)). $BACKUP_FILE ($BACKUP_SIZE, ${AGE_HOURS}h ago)"
done

echo ""
read -p "Select backup to restore (1-${#BACKUPS[@]}): " SELECTION

# Validate selection
if ! [[ "$SELECTION" =~ ^[0-9]+$ ]] || [ "$SELECTION" -lt 1 ] || [ "$SELECTION" -gt ${#BACKUPS[@]} ]; then
    print_error "Invalid selection"
    exit 1
fi

SELECTED_BACKUP="${BACKUPS[$((SELECTION-1))]}"
BACKUP_FILE=$(basename "$SELECTED_BACKUP")

print_info "Selected backup: $BACKUP_FILE"

# Confirm restore
print_warning "This will replace the current database with the selected backup."
print_warning "Current data will be lost unless you have a recent backup."
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    print_info "Restore cancelled"
    exit 0
fi

# Create a backup of current state before restore
print_info "Creating backup of current state before restore..."
CURRENT_BACKUP_FILE="adstrategist_db_pre_restore_$(date +%Y%m%d_%H%M%S).sql"

if docker-compose -f docker-compose.server.yml exec -T postgres pg_dump -U adstrategist_user -d adstrategist > "$BACKUP_DIR/$CURRENT_BACKUP_FILE"; then
    gzip "$BACKUP_DIR/$CURRENT_BACKUP_FILE"
    print_status "Current state backed up: ${CURRENT_BACKUP_FILE}.gz"
else
    print_warning "Failed to backup current state, continuing with restore..."
fi

# Stop application containers
print_info "Stopping application containers..."
docker-compose -f docker-compose.server.yml stop app
print_status "Application containers stopped"

# Verify backup file integrity
print_info "Verifying backup file integrity..."
if ! gzip -t "$SELECTED_BACKUP"; then
    print_error "Backup file is corrupted: $BACKUP_FILE"
    print_info "Starting application containers..."
    docker-compose -f docker-compose.server.yml start app
    exit 1
fi
print_status "Backup file integrity verified"

# Check database connection
print_info "Checking database connection..."
if ! docker-compose -f docker-compose.server.yml exec -T postgres pg_isready -U adstrategist_user > /dev/null; then
    print_error "Database is not ready"
    exit 1
fi
print_status "Database connection verified"

# Drop existing database and recreate
print_info "Preparing database for restore..."
docker-compose -f docker-compose.server.yml exec -T postgres psql -U adstrategist_user -d postgres -c "DROP DATABASE IF EXISTS adstrategist;"
docker-compose -f docker-compose.server.yml exec -T postgres psql -U adstrategist_user -d postgres -c "CREATE DATABASE adstrategist;"
print_status "Database prepared"

# Restore database
print_info "Restoring database from backup..."
if gunzip -c "$SELECTED_BACKUP" | docker-compose -f docker-compose.server.yml exec -T postgres psql -U adstrategist_user -d adstrategist > /dev/null; then
    print_status "Database restored successfully"
else
    print_error "Database restore failed"
    
    # Try to restore from pre-restore backup if it exists
    PRE_RESTORE_BACKUP="$BACKUP_DIR/${CURRENT_BACKUP_FILE}.gz"
    if [ -f "$PRE_RESTORE_BACKUP" ]; then
        print_info "Attempting to restore from pre-restore backup..."
        docker-compose -f docker-compose.server.yml exec -T postgres psql -U adstrategist_user -d postgres -c "DROP DATABASE IF EXISTS adstrategist;"
        docker-compose -f docker-compose.server.yml exec -T postgres psql -U adstrategist_user -d postgres -c "CREATE DATABASE adstrategist;"
        
        if gunzip -c "$PRE_RESTORE_BACKUP" | docker-compose -f docker-compose.server.yml exec -T postgres psql -U adstrategist_user -d adstrategist > /dev/null; then
            print_status "Restored from pre-restore backup"
        else
            print_error "Failed to restore from pre-restore backup"
        fi
    fi
    
    exit 1
fi

# Start application containers
print_info "Starting application containers..."
docker-compose -f docker-compose.server.yml start app
print_status "Application containers started"

# Wait for application to be ready
print_info "Waiting for application to be ready..."
sleep 30

# Health check
MAX_ATTEMPTS=12
ATTEMPT=1
while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    if curl -f -s http://localhost:5000/api/health > /dev/null; then
        print_status "Application health check passed"
        break
    fi
    
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        print_warning "Application health check failed after $MAX_ATTEMPTS attempts"
        print_info "Check application logs: docker-compose -f docker-compose.server.yml logs app"
        break
    fi
    
    print_info "Waiting for application... (attempt $ATTEMPT/$MAX_ATTEMPTS)"
    sleep 10
    ((ATTEMPT++))
done

# Display restore summary
echo ""
print_status "🎉 Database restore completed!"
echo ""
print_info "Restore Summary:"
echo "  Restored from: $BACKUP_FILE"
echo "  Restore time: $(date)"
echo "  Pre-restore backup: ${CURRENT_BACKUP_FILE}.gz (if created)"
echo ""

# Display application status
print_info "Application Status:"
docker-compose -f docker-compose.server.yml ps

echo ""
print_info "Next steps:"
echo "1. Verify application functionality"
echo "2. Check logs for any issues: docker-compose -f docker-compose.server.yml logs -f"
echo "3. Test critical features"
echo "4. Monitor system performance"

echo ""
print_info "If you encounter issues:"
echo "1. Check application logs"
echo "2. Verify database connectivity"
echo "3. Consider restoring from pre-restore backup if available"
echo "4. Contact support if problems persist"

# Show recent logs
print_info "Recent application logs:"
docker-compose -f docker-compose.server.yml logs --tail=10 app