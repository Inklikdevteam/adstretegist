#!/bin/bash

# AdStrategist Application Deployment Script
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

echo "🚀 AdStrategist Application Deployment"
echo "======================================"

# Configuration
APP_DIR="/opt/adstrategist"
BACKUP_DIR="/opt/adstrategist-backups"
DATA_DIR="/opt/adstrategist-data"

# Check if running in correct directory
if [ ! -f "docker-compose.server.yml" ]; then
    print_error "docker-compose.server.yml not found. Please run this script from the application directory."
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found. Please create it from .env.example"
    echo "cp .env.example .env"
    echo "# Then edit .env with your configuration"
    exit 1
fi

# Validate required environment variables
print_info "Validating environment configuration..."
source .env

required_vars=("DB_PASSWORD" "GOOGLE_CLIENT_ID" "GOOGLE_CLIENT_SECRET" "GOOGLE_DEVELOPER_TOKEN" "SESSION_SECRET")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

# Check for at least one AI provider
ai_providers=("OPENAI_API_KEY" "ANTHROPIC_API_KEY" "PERPLEXITY_API_KEY")
has_ai_provider=false

for provider in "${ai_providers[@]}"; do
    if [ -n "${!provider}" ]; then
        has_ai_provider=true
        break
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    print_error "Missing required environment variables:"
    printf '   %s\n' "${missing_vars[@]}"
    exit 1
fi

if [ "$has_ai_provider" = false ]; then
    print_error "At least one AI provider API key is required:"
    printf '   %s\n' "${ai_providers[@]}"
    exit 1
fi

print_status "Environment validation passed"

# Create data directories
print_info "Creating data directories..."
sudo mkdir -p $DATA_DIR/postgres $DATA_DIR/redis
sudo chown -R $USER:$USER $DATA_DIR
print_status "Data directories created"

# Stop existing containers if running
print_info "Stopping existing containers..."
docker compose -f docker-compose.server.yml down --remove-orphans || true
print_status "Existing containers stopped"

# Pull latest images and build
print_info "Building application images..."
docker compose -f docker-compose.server.yml build --no-cache --parallel
print_status "Application images built"

# Start services
print_info "Starting services..."
docker compose -f docker-compose.server.yml up -d
print_status "Services started"

# Wait for database to be ready
print_info "Waiting for database to be ready..."
sleep 30

# Check database health
max_attempts=30
attempt=1
while [ $attempt -le $max_attempts ]; do
    if docker compose -f docker-compose.server.yml exec -T postgres pg_isready -U adstrategist_user > /dev/null 2>&1; then
        print_status "Database is ready"
        break
    fi
    
    if [ $attempt -eq $max_attempts ]; then
        print_error "Database failed to start after $max_attempts attempts"
        docker compose -f docker-compose.server.yml logs postgres
        exit 1
    fi
    
    print_info "Waiting for database... (attempt $attempt/$max_attempts)"
    sleep 5
    ((attempt++))
done

# Run database migrations
print_info "Running database migrations..."
docker compose -f docker-compose.server.yml exec -T app npm run db:push
print_status "Database migrations completed"

# Health check
print_info "Performing health checks..."
sleep 10

# Check application health
if curl -f -s http://localhost:5000/api/health > /dev/null; then
    print_status "Application health check passed"
else
    print_warning "Application health check failed, checking logs..."
    docker-compose -f docker-compose.server.yml logs --tail=20 app
fi

# Display service status
print_info "Service status:"
docker compose -f docker-compose.server.yml ps

# Display resource usage
print_info "Resource usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

echo ""
print_status "🎉 Application deployment completed!"
echo ""
print_info "Next steps:"
echo "1. Configure Nginx reverse proxy"
echo "2. Set up SSL certificates"
echo "3. Configure domain DNS"
echo "4. Set up monitoring and backups"
echo ""
print_info "Useful commands:"
echo "  View logs: docker compose -f docker-compose.server.yml logs -f"
echo "  Restart: docker compose -f docker-compose.server.yml restart"
echo "  Stop: docker compose -f docker-compose.server.yml down"
echo "  Monitor: ./scripts/server-monitor.sh"