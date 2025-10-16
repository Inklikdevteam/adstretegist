# AdStrategist - Deployment Guide

## Overview

This guide covers deploying the AdStrategist application to a production server. The application is designed to run on a single port serving both the API and frontend, making deployment straightforward.

## Prerequisites

### Server Requirements
- **Node.js**: Version 18 or higher
- **PostgreSQL**: Database server (or use Neon cloud database)
- **Memory**: Minimum 2GB RAM (4GB+ recommended)
- **Storage**: At least 10GB available space
- **Network**: HTTPS support for Google OAuth

### Required Accounts & API Keys
- **Google Cloud Console**: For Google Ads API and OAuth
- **OpenAI API Key**: For GPT-4o integration
- **Anthropic API Key**: For Claude integration (optional)
- **Perplexity API Key**: For Perplexity integration (optional)
- **Database**: PostgreSQL instance (Neon recommended)

## Deployment Options

### Option 1: VPS/Cloud Server (Recommended)

#### 1. Server Setup

**Ubuntu/Debian Server:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx for reverse proxy
sudo apt install nginx -y

# Install SSL certificate tool
sudo apt install certbot python3-certbot-nginx -y
```

**CentOS/RHEL Server:**
```bash
# Update system
sudo yum update -y

# Install Node.js 18+
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo yum install nginx -y

# Install Certbot
sudo yum install certbot python3-certbot-nginx -y
```

#### 2. Application Deployment

```bash
# Create application directory
sudo mkdir -p /var/www/adstrategist
sudo chown $USER:$USER /var/www/adstrategist
cd /var/www/adstrategist

# Clone your repository
git clone <your-repository-url> .

# Install dependencies
npm install

# Build the application
npm run build
```

#### 3. Environment Configuration

Create production environment file:
```bash
# Create environment file
nano .env.production
```

**Environment Variables (.env.production):**
```env
# Server Configuration
NODE_ENV=production
PORT=5000

# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database

# Google Ads API Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_DEVELOPER_TOKEN=your_google_developer_token

# AI Provider API Keys
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
PERPLEXITY_API_KEY=your_perplexity_api_key

# Session Management
SESSION_SECRET=your_very_secure_random_string_here

# Optional: Logging
LOG_LEVEL=info
```

#### 4. Database Setup

**If using Neon (Recommended):**
1. Create account at [neon.tech](https://neon.tech)
2. Create new database
3. Copy connection string to `DATABASE_URL`

**If using local PostgreSQL:**
```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Create database and user
sudo -u postgres psql
CREATE DATABASE adstrategist;
CREATE USER adstrategist_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE adstrategist TO adstrategist_user;
\q

# Run database migrations
npm run db:push
```

#### 5. Process Management with PM2

Create PM2 ecosystem file:
```bash
nano ecosystem.config.js
```

**ecosystem.config.js:**
```javascript
module.exports = {
  apps: [{
    name: 'adstrategist',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max_old_space_size=1024'
  }]
};
```

Start the application:
```bash
# Create logs directory
mkdir logs

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

#### 6. Nginx Configuration

Create Nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/adstrategist
```

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Configuration (will be added by Certbot)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;

    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static file caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:
```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/adstrategist /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### 7. SSL Certificate Setup

```bash
# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test automatic renewal
sudo certbot renew --dry-run
```

### Option 2: Docker Deployment

#### 1. Create Dockerfile

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY components.json ./
COPY drizzle.config.ts ./

# Install dependencies
RUN npm ci

# Copy source code
COPY client/ ./client/
COPY server/ ./server/
COPY shared/ ./shared/

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 5000

CMD ["node", "dist/index.js"]
```

#### 2. Docker Compose Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - GOOGLE_DEVELOPER_TOKEN=${GOOGLE_DEVELOPER_TOKEN}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - PERPLEXITY_API_KEY=${PERPLEXITY_API_KEY}
      - SESSION_SECRET=${SESSION_SECRET}
    restart: unless-stopped
    depends_on:
      - db
    volumes:
      - ./logs:/app/logs

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=adstrategist
      - POSTGRES_USER=adstrategist_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
```

#### 3. Deploy with Docker

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Option 3: Cloud Platform Deployment

#### Heroku Deployment

1. **Prepare for Heroku:**
```bash
# Install Heroku CLI
npm install -g heroku

# Login to Heroku
heroku login

# Create Heroku app
heroku create your-app-name
```

2. **Configure Environment:**
```bash
# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set DATABASE_URL=your_database_url
heroku config:set GOOGLE_CLIENT_ID=your_client_id
heroku config:set GOOGLE_CLIENT_SECRET=your_client_secret
heroku config:set GOOGLE_DEVELOPER_TOKEN=your_developer_token
heroku config:set OPENAI_API_KEY=your_openai_key
heroku config:set SESSION_SECRET=your_session_secret

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:mini
```

3. **Deploy:**
```bash
# Deploy to Heroku
git push heroku main

# Run database migrations
heroku run npm run db:push
```

#### Railway Deployment

1. **Connect Repository:**
   - Visit [railway.app](https://railway.app)
   - Connect your GitHub repository
   - Select the AdStrategist project

2. **Configure Environment Variables:**
   - Add all required environment variables in Railway dashboard
   - Add PostgreSQL database service

3. **Deploy:**
   - Railway automatically deploys on git push
   - Monitor deployment in Railway dashboard

## Post-Deployment Configuration

### 1. Google OAuth Setup

1. **Google Cloud Console:**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create new project or select existing
   - Enable Google Ads API
   - Create OAuth 2.0 credentials

2. **Configure OAuth:**
   - **Authorized JavaScript origins:** `https://your-domain.com`
   - **Authorized redirect URIs:** `https://your-domain.com/auth/google/callback`

### 2. Database Initialization

```bash
# Run database migrations
npm run db:push

# Create admin user (if needed)
# This should be done through the application UI after deployment
```

### 3. Health Checks

Create health check endpoints monitoring:
```bash
# Check application health
curl https://your-domain.com/api/health

# Check database connectivity
curl https://your-domain.com/api/health/db

# Monitor logs
pm2 logs adstrategist
```

## Monitoring & Maintenance

### 1. Application Monitoring

**PM2 Monitoring:**
```bash
# Monitor processes
pm2 monit

# View logs
pm2 logs

# Restart application
pm2 restart adstrategist

# Update application
git pull
npm run build
pm2 restart adstrategist
```

### 2. Database Backups

**Automated Backup Script:**
```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/adstrategist"
DB_NAME="adstrategist"

mkdir -p $BACKUP_DIR

# Create database backup
pg_dump $DATABASE_URL > $BACKUP_DIR/backup_$DATE.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete

echo "Backup completed: backup_$DATE.sql"
```

**Setup Cron Job:**
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /path/to/backup.sh
```

### 3. SSL Certificate Renewal

```bash
# Auto-renewal is typically set up by certbot
# Verify auto-renewal
sudo systemctl status certbot.timer

# Manual renewal if needed
sudo certbot renew
```

### 4. Performance Monitoring

**Setup monitoring tools:**
- **Application Performance:** New Relic, DataDog, or Sentry
- **Server Monitoring:** Prometheus + Grafana
- **Uptime Monitoring:** Pingdom, UptimeRobot

## Security Checklist

- [ ] SSL certificate installed and configured
- [ ] Environment variables secured (not in code)
- [ ] Database access restricted
- [ ] Firewall configured (only ports 80, 443, 22 open)
- [ ] Regular security updates applied
- [ ] Backup strategy implemented
- [ ] Monitoring and alerting configured
- [ ] Google OAuth properly configured
- [ ] Session security configured

## Troubleshooting

### Common Issues

1. **Application won't start:**
   ```bash
   # Check logs
   pm2 logs adstrategist
   
   # Check environment variables
   pm2 show adstrategist
   ```

2. **Database connection issues:**
   ```bash
   # Test database connection
   psql $DATABASE_URL
   
   # Check database migrations
   npm run db:push
   ```

3. **Google OAuth errors:**
   - Verify redirect URIs in Google Console
   - Check HTTPS configuration
   - Validate client ID and secret

4. **Performance issues:**
   ```bash
   # Monitor resource usage
   pm2 monit
   
   # Check server resources
   htop
   df -h
   ```

### Log Locations

- **Application logs:** `/var/www/adstrategist/logs/`
- **Nginx logs:** `/var/log/nginx/`
- **System logs:** `/var/log/syslog`
- **PM2 logs:** `~/.pm2/logs/`

## Scaling Considerations

### Horizontal Scaling
- Use load balancer (Nginx, HAProxy)
- Multiple application instances
- Shared session storage (Redis)
- Database read replicas

### Vertical Scaling
- Increase server resources
- Optimize database queries
- Implement caching strategies
- CDN for static assets

---

This deployment guide provides comprehensive instructions for deploying AdStrategist in various environments. Choose the option that best fits your infrastructure and requirements.