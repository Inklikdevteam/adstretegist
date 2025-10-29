#!/bin/bash

# Quick fix for Docker Compose deployment issues
set -e

echo "🔧 Fixing Docker Compose configuration..."

# Pull latest fixes
git pull origin main

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker compose -f docker-compose.server.yml down --remove-orphans --volumes || true

# Remove any conflicting volumes
echo "🗑️  Removing conflicting volumes..."
docker volume prune -f || true

# Build with no cache to ensure clean build
echo "🏗️  Building application with clean cache..."
docker compose -f docker-compose.server.yml build --no-cache --parallel

# Start services
echo "🚀 Starting services..."
docker compose -f docker-compose.server.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Check database health
echo "🔍 Checking database health..."
max_attempts=30
attempt=1
while [ $attempt -le $max_attempts ]; do
    if docker compose -f docker-compose.server.yml exec -T postgres pg_isready -U adstrategist_user > /dev/null 2>&1; then
        echo "✅ Database is ready"
        break
    fi
    
    if [ $attempt -eq $max_attempts ]; then
        echo "❌ Database failed to start after $max_attempts attempts"
        docker compose -f docker-compose.server.yml logs postgres
        exit 1
    fi
    
    echo "⏳ Waiting for database... (attempt $attempt/$max_attempts)"
    sleep 5
    ((attempt++))
done

# Run database migrations
echo "🗄️  Running database migrations..."
docker compose -f docker-compose.server.yml exec -T app npm run db:push

# Check application health
echo "🏥 Checking application health..."
sleep 10

if curl -f -s http://localhost:5000/api/health > /dev/null; then
    echo "✅ Application health check passed"
else
    echo "⚠️  Application health check failed, checking logs..."
    docker compose -f docker-compose.server.yml logs --tail=20 app
fi

# Display service status
echo "📊 Service status:"
docker compose -f docker-compose.server.yml ps

echo ""
echo "🎉 Deployment fix completed!"
echo ""
echo "🌐 Your application should be accessible at:"
echo "   http://localhost:5000"
echo ""
echo "📝 Check logs with:"
echo "   docker compose -f docker-compose.server.yml logs -f app"