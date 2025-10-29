#!/bin/bash

# AdStrategist Monitoring Script
set -e

echo "🔍 AdStrategist System Monitor"
echo "=============================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running!"
    exit 1
fi

echo "✅ Docker is running"

# Check container status
echo ""
echo "📦 Container Status:"
docker-compose ps

# Check health status
echo ""
echo "🏥 Health Checks:"

# Application health
if curl -f -s http://localhost:5000/api/health > /dev/null; then
    echo "✅ Application: Healthy"
    # Get detailed health info
    curl -s http://localhost:5000/api/health | jq '.' 2>/dev/null || echo "Health endpoint responded"
else
    echo "❌ Application: Unhealthy"
fi

# Database health
if docker-compose exec postgres pg_isready -U adstrategist_user > /dev/null 2>&1; then
    echo "✅ Database: Healthy"
else
    echo "❌ Database: Unhealthy"
fi

# Resource usage
echo ""
echo "📊 Resource Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

# Disk usage
echo ""
echo "💾 Disk Usage:"
df -h | grep -E "(Filesystem|/dev/)"

# Recent logs (last 10 lines)
echo ""
echo "📝 Recent Application Logs:"
docker-compose logs --tail=10 app

# Check for errors in logs
echo ""
echo "🚨 Recent Errors:"
ERROR_COUNT=$(docker-compose logs --since=1h app 2>&1 | grep -i error | wc -l)
if [ "$ERROR_COUNT" -gt 0 ]; then
    echo "Found $ERROR_COUNT errors in the last hour:"
    docker-compose logs --since=1h app 2>&1 | grep -i error | tail -5
else
    echo "No errors found in the last hour ✅"
fi

# Database connections
echo ""
echo "🔗 Database Connections:"
DB_CONNECTIONS=$(docker-compose exec postgres psql -U adstrategist_user -d adstrategist -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname='adstrategist';" 2>/dev/null | xargs)
echo "Active connections: $DB_CONNECTIONS"

# Backup status
echo ""
echo "💾 Backup Status:"
if [ -d "./backups" ]; then
    LATEST_BACKUP=$(ls -t ./backups/adstrategist_backup_*.sql.gz 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        BACKUP_AGE=$(stat -c %Y "$LATEST_BACKUP" 2>/dev/null || stat -f %m "$LATEST_BACKUP" 2>/dev/null)
        CURRENT_TIME=$(date +%s)
        AGE_HOURS=$(( (CURRENT_TIME - BACKUP_AGE) / 3600 ))
        echo "Latest backup: $(basename "$LATEST_BACKUP") (${AGE_HOURS}h ago)"
        
        if [ "$AGE_HOURS" -gt 24 ]; then
            echo "⚠️  Backup is older than 24 hours!"
        else
            echo "✅ Backup is recent"
        fi
    else
        echo "❌ No backups found"
    fi
else
    echo "❌ Backup directory not found"
fi

echo ""
echo "🎯 Monitoring completed at $(date)"