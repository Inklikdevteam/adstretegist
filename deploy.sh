#!/bin/bash

# AdStrategist Deployment Script
set -e

echo "🚀 Starting AdStrategist deployment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please copy .env.example to .env and configure your environment variables."
    echo "   cp .env.example .env"
    echo "   # Then edit .env with your actual API keys and configuration"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "📦 Building and starting containers..."
docker-compose up -d --build

echo "⏳ Waiting for database to be ready..."
sleep 10

echo "🗄️  Running database migrations..."
docker-compose exec app npm run db:push

echo "✅ Deployment complete!"
echo ""
echo "🌐 Your AdStrategist platform is now running at:"
echo "   http://localhost:5000"
echo ""
echo "📊 Database is accessible at:"
echo "   Host: localhost"
echo "   Port: 5432"
echo "   Database: adstrategist"
echo "   Username: adstrategist_user"
echo ""
echo "🔧 Useful commands:"
echo "   View logs: docker-compose logs -f"
echo "   Stop services: docker-compose down"
echo "   Restart: docker-compose restart"
echo "   Database shell: docker-compose exec postgres psql -U adstrategist_user -d adstrategist"