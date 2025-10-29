#!/bin/bash

# AdStrategist Server Monitoring Script
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

echo "🔍 AdStrategist Server Monitor"
echo "=============================="

# System Information
print_info "System Information:"
echo "Hostname: $(hostname)"
echo "Uptime: $(uptime -p)"
echo "Load Average: $(uptime | awk -F'load average:' '{print $2}')"
echo "Date: $(date)"
echo ""

# Docker Status
print_info "Docker Status:"
if systemctl is-active --quiet docker; then
    print_status "Docker service is running"
    echo "Docker version: $(docker --version)"
else
    print_error "Docker service is not running"
fi
echo ""

# Container Status
print_info "Container Status:"
if [ -f "docker-compose.server.yml" ]; then
    docker-compose -f docker-compose.server.yml ps
else
    print_warning "docker-compose.server.yml not found in current directory"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
fi
echo ""

# Health Checks
print_info "Health Checks:"

# Application health
if curl -f -s http://localhost:5000/api/health > /dev/null 2>&1; then
    print_status "Application: Healthy"
    # Get detailed health info
    HEALTH_INFO=$(curl -s http://localhost:5000/api/health 2>/dev/null)
    if command -v jq &> /dev/null; then
        echo "$HEALTH_INFO" | jq '.'
    else
        echo "$HEALTH_INFO"
    fi
else
    print_error "Application: Unhealthy or not responding"
fi

# Database health
if docker-compose -f docker-compose.server.yml exec -T postgres pg_isready -U adstrategist_user > /dev/null 2>&1; then
    print_status "Database: Healthy"
else
    print_error "Database: Unhealthy"
fi

# Redis health (if enabled)
if docker-compose -f docker-compose.server.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
    print_status "Redis: Healthy"
else
    print_warning "Redis: Not responding or not enabled"
fi

# Nginx status
if systemctl is-active --quiet nginx; then
    print_status "Nginx: Running"
else
    print_error "Nginx: Not running"
fi
echo ""

# Resource Usage
print_info "Resource Usage:"
echo "CPU Usage:"
top -bn1 | grep "Cpu(s)" | awk '{print $2 $3}' | sed 's/%us,/ User,/' | sed 's/%sy/ System/'

echo ""
echo "Memory Usage:"
free -h | grep -E "(Mem|Swap)"

echo ""
echo "Disk Usage:"
df -h | grep -E "(Filesystem|/dev/|/opt)"

echo ""
echo "Docker Container Resources:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
echo ""

# Network Status
print_info "Network Status:"
echo "Active connections:"
ss -tuln | grep -E "(80|443|5000|5432|6379)" || echo "No relevant ports listening"
echo ""

# SSL Certificate Status
print_info "SSL Certificate Status:"
if [ -d "/etc/letsencrypt/live" ]; then
    for cert_dir in /etc/letsencrypt/live/*/; do
        if [ -d "$cert_dir" ]; then
            domain=$(basename "$cert_dir")
            if [ "$domain" != "README" ]; then
                expiry=$(openssl x509 -enddate -noout -in "${cert_dir}cert.pem" 2>/dev/null | cut -d= -f2)
                if [ -n "$expiry" ]; then
                    expiry_date=$(date -d "$expiry" +%Y-%m-%d 2>/dev/null || echo "Invalid date")
                    days_left=$(( ($(date -d "$expiry" +%s 2>/dev/null || echo 0) - $(date +%s)) / 86400 ))
                    
                    if [ "$days_left" -gt 30 ]; then
                        print_status "SSL ($domain): Valid until $expiry_date ($days_left days)"
                    elif [ "$days_left" -gt 7 ]; then
                        print_warning "SSL ($domain): Expires $expiry_date ($days_left days) - Renewal recommended"
                    else
                        print_error "SSL ($domain): Expires soon $expiry_date ($days_left days) - Urgent renewal needed"
                    fi
                fi
            fi
        fi
    done
else
    print_warning "No SSL certificates found"
fi
echo ""

# Log Analysis
print_info "Recent Log Analysis:"

# Application errors
APP_ERRORS=$(docker-compose -f docker-compose.server.yml logs --since=1h app 2>&1 | grep -i error | wc -l)
if [ "$APP_ERRORS" -gt 0 ]; then
    print_warning "Found $APP_ERRORS application errors in the last hour"
    echo "Recent errors:"
    docker-compose -f docker-compose.server.yml logs --since=1h app 2>&1 | grep -i error | tail -3
else
    print_status "No application errors in the last hour"
fi

# Database errors
DB_ERRORS=$(docker-compose -f docker-compose.server.yml logs --since=1h postgres 2>&1 | grep -i error | wc -l)
if [ "$DB_ERRORS" -gt 0 ]; then
    print_warning "Found $DB_ERRORS database errors in the last hour"
else
    print_status "No database errors in the last hour"
fi

# Nginx errors
if [ -f "/var/log/nginx/error.log" ]; then
    NGINX_ERRORS=$(tail -100 /var/log/nginx/error.log | grep "$(date '+%Y/%m/%d')" | wc -l)
    if [ "$NGINX_ERRORS" -gt 0 ]; then
        print_warning "Found $NGINX_ERRORS nginx errors today"
    else
        print_status "No nginx errors today"
    fi
fi
echo ""

# Backup Status
print_info "Backup Status:"
BACKUP_DIR="/opt/adstrategist-backups"
if [ -d "$BACKUP_DIR" ]; then
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/adstrategist_backup_*.sql.gz 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        BACKUP_AGE=$(stat -c %Y "$LATEST_BACKUP" 2>/dev/null)
        CURRENT_TIME=$(date +%s)
        AGE_HOURS=$(( (CURRENT_TIME - BACKUP_AGE) / 3600 ))
        
        if [ "$AGE_HOURS" -lt 24 ]; then
            print_status "Latest backup: $(basename "$LATEST_BACKUP") (${AGE_HOURS}h ago)"
        else
            print_warning "Latest backup: $(basename "$LATEST_BACKUP") (${AGE_HOURS}h ago) - Consider running backup"
        fi
    else
        print_warning "No backups found in $BACKUP_DIR"
    fi
else
    print_warning "Backup directory not found: $BACKUP_DIR"
fi
echo ""

# Security Status
print_info "Security Status:"

# Firewall status
if command -v ufw &> /dev/null; then
    UFW_STATUS=$(sudo ufw status | head -1)
    if [[ "$UFW_STATUS" == *"active"* ]]; then
        print_status "Firewall: Active"
    else
        print_warning "Firewall: Inactive"
    fi
fi

# Fail2ban status
if systemctl is-active --quiet fail2ban; then
    print_status "Fail2ban: Active"
    BANNED_IPS=$(sudo fail2ban-client status | grep "Jail list" | cut -d: -f2 | wc -w)
    echo "Active jails: $BANNED_IPS"
else
    print_warning "Fail2ban: Not active"
fi
echo ""

# Performance Recommendations
print_info "Performance Recommendations:"

# Check available memory
AVAILABLE_MEM=$(free | grep Mem | awk '{print ($7/$2) * 100.0}')
if (( $(echo "$AVAILABLE_MEM < 20" | bc -l) )); then
    print_warning "Low available memory (${AVAILABLE_MEM}%) - Consider adding more RAM or optimizing containers"
fi

# Check disk space
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    print_warning "High disk usage (${DISK_USAGE}%) - Consider cleanup or adding storage"
fi

# Check load average
LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
CPU_CORES=$(nproc)
if (( $(echo "$LOAD_AVG > $CPU_CORES" | bc -l) )); then
    print_warning "High load average ($LOAD_AVG) exceeds CPU cores ($CPU_CORES)"
fi

echo ""
print_status "🎯 Monitoring completed at $(date)"
echo ""
print_info "For detailed logs, use:"
echo "  Application: docker-compose -f docker-compose.server.yml logs -f app"
echo "  Database: docker-compose -f docker-compose.server.yml logs -f postgres"
echo "  Nginx: sudo tail -f /var/log/nginx/error.log"
echo "  System: journalctl -f"