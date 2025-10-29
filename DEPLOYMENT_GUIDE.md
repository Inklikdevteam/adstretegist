# AdStrategist Docker Deployment Guide

This guide will help you deploy the AI-powered Google Ads platform using Docker and PostgreSQL.

## Prerequisites

### System Requirements
- **Docker** 20.10+ and **Docker Compose** 2.0+
- **Minimum 2GB RAM** (4GB+ recommended)
- **10GB+ disk space**
- **Linux/macOS/Windows** with Docker Desktop

### Required API Keys & Credentials

#### 1. Google Ads API Setup
1. **Google Cloud Console**: Create a project at https://console.cloud.google.com
2. **Enable Google Ads API**: In APIs & Services > Library
3. **Create OAuth 2.0 Credentials**:
   - Go to APIs & Services > Credentials
   - Create OAuth 2.0 Client ID (Web application)
   - Add authorized redirect URI: `http://your-domain:5000/auth/google/callback`
4. **Get Developer Token**: Apply at https://developers.google.com/google-ads/api/docs/first-call/dev-token

#### 2. AI Provider API Keys (At least one required)
- **OpenAI**: https://platform.openai.com/api-keys (Recommended)
- **Anthropic**: https://console.anthropic.com/ (Optional)
- **Perplexity**: https://www.perplexity.ai/settings/api (Optional)

## Quick Start Deployment

### 1. Clone and Setup
```bash
# Clone your repository
git clone <your-repo-url>
cd adstrategist

# Copy environment template
cp .env.example .env
```

### 2. Configure Environment Variables
Edit `.env` file with your credentials:

```env
# Database
DB_PASSWORD=your_secure_database_password

# Google Ads API (Required)
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_DEVELOPER_TOKEN=your_google_ads_developer_token

# AI Providers (At least one required)
OPENAI_API_KEY=sk-your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
PERPLEXITY_API_KEY=your_perplexity_api_key

# Session Security
SESSION_SECRET=your_super_secure_session_secret_change_this
```

### 3. Deploy with One Command
```bash
# Make deployment script executable
chmod +x deploy.sh

# Deploy everything
./deploy.sh
```

Your platform will be available at **http://localhost:5000**

## Manual Deployment Steps

If you prefer manual control:

### 1. Build and Start Services
```bash
# Start PostgreSQL and app
docker-compose up -d --build

# Check status
docker-compose ps
```

### 2. Initialize Database
```bash
# Wait for database to be ready
sleep 10

# Run database migrations
docker-compose exec app npm run db:push
```

### 3. Verify Deployment
```bash
# Check logs
docker-compose logs -f app

# Test the application
curl http://localhost:5000/api/health
```

## Production Deployment

For production environments:

### 1. Use Production Script
```bash
chmod +x production-deploy.sh
./production-deploy.sh
```

### 2. Production Considerations

#### Security
- **Change default passwords** in `.env`
- **Use strong SESSION_SECRET** (32+ characters)
- **Enable HTTPS** with reverse proxy (nginx/traefik)
- **Firewall configuration** to restrict database access

#### Performance
- **Resource allocation**:
  ```yaml
  # Add to docker-compose.yml services
  app:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
  postgres:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
  ```

#### Monitoring
- **Health checks**: Built-in health endpoint at `/api/health`
- **Logs**: `docker-compose logs -f`
- **Database monitoring**: Connect with any PostgreSQL client

## Database Management

### Connection Details
- **Host**: localhost (or your server IP)
- **Port**: 5432
- **Database**: adstrategist
- **Username**: adstrategist_user
- **Password**: (from your .env DB_PASSWORD)

### Common Database Operations
```bash
# Connect to database
docker-compose exec postgres psql -U adstrategist_user -d adstrategist

# Backup database
docker-compose exec postgres pg_dump -U adstrategist_user adstrategist > backup.sql

# Restore database
docker-compose exec -T postgres psql -U adstrategist_user -d adstrategist < backup.sql

# View database logs
docker-compose logs postgres
```

## Application Management

### Service Control
```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart specific service
docker-compose restart app

# View logs
docker-compose logs -f app

# Scale application (multiple instances)
docker-compose up -d --scale app=2
```

### Updates and Maintenance
```bash
# Update application
git pull
docker-compose build --no-cache
docker-compose up -d

# Database migrations after updates
docker-compose exec app npm run db:push
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Restart database
docker-compose restart postgres
```

#### 2. Application Won't Start
```bash
# Check application logs
docker-compose logs app

# Verify environment variables
docker-compose exec app env | grep -E "(DATABASE_URL|GOOGLE_|OPENAI_)"

# Restart application
docker-compose restart app
```

#### 3. Google Ads API Issues
- Verify OAuth redirect URI matches your domain
- Check if Google Ads API is enabled in Google Cloud Console
- Ensure developer token is approved (may take 24-48 hours)

#### 4. AI Provider Errors
- Verify API keys are correct and active
- Check API quotas and billing
- Ensure at least one AI provider is configured

### Health Checks
```bash
# Application health
curl http://localhost:5000/api/health

# Database health
docker-compose exec postgres pg_isready -U adstrategist_user

# Check all services
docker-compose ps
```

### Performance Monitoring
```bash
# Resource usage
docker stats

# Application metrics
docker-compose exec app npm run check

# Database performance
docker-compose exec postgres psql -U adstrategist_user -d adstrategist -c "SELECT * FROM pg_stat_activity;"
```

## Backup and Recovery

### Automated Backup Script
Create `backup.sh`:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec postgres pg_dump -U adstrategist_user adstrategist > "backup_${DATE}.sql"
echo "Backup created: backup_${DATE}.sql"
```

### Recovery Process
```bash
# Stop application
docker-compose stop app

# Restore database
docker-compose exec -T postgres psql -U adstrategist_user -d adstrategist < backup_file.sql

# Start application
docker-compose start app
```

## Scaling and Load Balancing

### Horizontal Scaling
```bash
# Run multiple app instances
docker-compose up -d --scale app=3

# Use nginx for load balancing
# Create nginx.conf and add nginx service to docker-compose.yml
```

### Vertical Scaling
```yaml
# Increase resources in docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '2.0'
```

## Security Best Practices

1. **Environment Variables**: Never commit `.env` to version control
2. **Database Security**: Use strong passwords and limit network access
3. **API Keys**: Rotate API keys regularly
4. **Updates**: Keep Docker images and dependencies updated
5. **Monitoring**: Set up alerts for failed deployments and errors
6. **Backups**: Implement automated backup strategy
7. **HTTPS**: Use reverse proxy with SSL certificates in production

## Support and Maintenance

### Regular Maintenance Tasks
- **Weekly**: Check logs and performance metrics
- **Monthly**: Update dependencies and Docker images  
- **Quarterly**: Review and rotate API keys
- **As needed**: Database optimization and cleanup

### Getting Help
- Check application logs: `docker-compose logs -f app`
- Review database logs: `docker-compose logs postgres`
- Monitor resource usage: `docker stats`
- Test API endpoints: Use curl or Postman

---

Your AdStrategist platform is now ready for production use with Docker and PostgreSQL! 🚀