#!/bin/bash

# Production Deployment Script for AdStrategist
set -e

echo "🏭 Starting AdStrategist PRODUCTION deployment..."

# Ensure we're in production mode
export NODE_ENV=production

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please copy .env.example to .env and configure your environment variables."
    exit 1
fi

# Validate required environment variables
source .env

required_vars=("GOOGLE_CLIENT_ID" "GOOGLE_CLIENT_SECRET" "GOOGLE_DEVELOPER_TOKEN" "SESSION_SECRET")
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
    echo "❌ Missing required environment variables:"
    printf '   %s\n' "${missing_vars[@]}"
    exit 1
fi

if [ "$has_ai_provider" = false ]; then
    echo "❌ At least one AI provider API key is required:"
    printf '   %s\n' "${ai_providers[@]}"
    exit 1
fi

echo "✅ Environment validation passed"

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Pull latest images and build
echo "📦 Building production images..."
docker-compose build --no-cache

# Start services
echo "🚀 Starting production services..."
docker-compose up -d

# Wait for database
echo "⏳ Waiting for database to be ready..."
sleep 15

# Run database migrations
echo "🗄️  Running database migrations..."
docker-compose exec app npm run db:push

# Health check
echo "🏥 Performing health check..."
sleep 5

if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "✅ Health check passed"
else
    echo "⚠️  Health check failed, but services may still be starting..."
fi

echo ""
echo "🎉 PRODUCTION deployment complete!"
echo ""
echo "🌐 AdStrategist is running at: http://localhost:5000"
echo "📊 Database: localhost:5432"
echo ""
echo "🔧 Production management commands:"
echo "   View logs: docker-compose logs -f app"
echo "   Monitor: docker-compose ps"
echo "   Backup DB: docker-compose exec postgres pg_dump -U adstrategist_user adstrategist > backup.sql"
echo "   Scale app: docker-compose up -d --scale app=2"