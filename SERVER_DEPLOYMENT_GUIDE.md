# AdStrategist - Live Server Deployment Guide

Complete guide for deploying your AI-powered Google Ads platform on a live Debian/Ubuntu server with Docker, PostgreSQL, SSL, and production-grade configuration.

## 🎯 Overview

This guide will help you deploy AdStrategist on a live server with:
- **Production-ready Docker setup** with PostgreSQL and Redis
- **Nginx reverse proxy** with SSL/TLS certificates
- **Automated backups** and monitoring
- **Security hardening** and firewall configuration
- **High availability** and scaling options

## 📋 Prerequisites

### Server Requirements
- **OS**: Ubuntu 20.04+ or Debian 11+ (fresh installation recommended)
- **RAM**: Minimum 4GB (8GB+ recommended for production)
- **Storage**: 50GB+ SSD storage
- **CPU**: 2+ cores (4+ cores recommended)
- **Network**: Public IP address with ports 80/443 accessible

### Domain & DNS
- **Domain name** pointing to your server's IP address
- **DNS A record** configured (e.g., `adstrategist.yourdomain.com`)
- **Subdomain recommended** for better organization

### API Keys & Credentials
- **Google Ads API** credentials (OAuth + Developer Token)
- **AI Provider API keys** (OpenAI, Anthropic, Perplexity)
- **Strong passwords** for database and sessions

## 🚀 Step-by-Step Deployment

### Step 1: Server Preparation

Connect to your server via SSH:
```bash
ssh root@your-server-ip
# or
ssh your-username@your-server-ip
```

Run the server setup script:
```bash
# Download and run server setup
wget https://raw.githubusercontent.com/your-repo/adstrategist/main/server-deploy.sh
chmod +x server-deploy.sh
./server-deploy.sh
```

**What this script does:**
- Updates system packages
- Installs Docker and Docker Compose
- Configures firewall (UFW)
- Sets up fail2ban for security
- Creates application directories
- Configures basic security

**After completion:**
- Log out and log back in for Docker group changes
- Verify Docker: `docker --version`

### Step 2: Application Deployment

Clone your repository:
```bash
cd /opt/adstrategist
git clone https://github.com/your-username/adstrategist.git .
```

Configure environment variables:
```bash
cp .env.example .env
nano .env
```

**Required .env configuration:**
```env
# Database
DB_PASSWORD=your_very_secure_database_password_here

# Google Ads API (Required)
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_DEVELOPER_TOKEN=your_google_ads_developer_token

# AI Providers (At least one required)
OPENAI_API_KEY=sk-your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
PERPLEXITY_API_KEY=your_perplexity_api_key

# Session Security
SESSION_SECRET=your_super_secure_session_secret_minimum_32_characters

# Redis (Optional but recommended)
REDIS_PASSWORD=your_redis_password
```

Deploy the application:
```bash
chmod +x app-deploy.sh
./app-deploy.sh
```

**What this script does:**
- Validates environment configuration
- Creates data directories
- Builds Docker images
- Starts all services (PostgreSQL, Redis, App)
- Runs database migrations
- Performs health checks

### Step 3: SSL Certificate Setup

Configure SSL with Let's Encrypt:
```bash
chmod +x ssl-setup.sh
./ssl-setup.sh
```

**You'll be prompted for:**
- Your domain name (e.g., `adstrategist.yourdomain.com`)
- Email for certificate notifications

**What this script does:**
- Configures Nginx with your domain
- Obtains SSL certificate from Let's Encrypt
- Sets up automatic certificate renewal
- Configures HTTPS redirects

### Step 4: Verification

Check all services are running:
```bash
# Check containers
docker-compose -f docker-compose.server.yml ps

# Check application health
curl https://your-domain.com/api/health

# Run comprehensive monitoring
./scripts/server-monitor.sh
```

Your AdStrategist platform should now be accessible at:
**https://your-domain.com**

## 🔧 Production Configuration

### Docker Compose Configuration

The `docker-compose.server.yml` includes:

**PostgreSQL Database:**
- Persistent data storage
- Health checks and auto-restart
- Resource limits (2GB RAM, 1 CPU)
- Logging configuration

**Application Containers:**
- 2 replicas for high availability
- Resource limits (3GB RAM, 2 CPU each)
- Health checks every 30 seconds
- Automatic restart on failure

**Redis Cache:**
- Session storage and caching
- Password protection
- Persistent data storage

**Nginx Reverse Proxy:**
- SSL/TLS termination
- Load balancing between app instances
- Rate limiting and security headers
- Static file caching
- Gzip compression

### Security Features

**Firewall Configuration:**
- Only ports 22 (SSH), 80 (HTTP), 443 (HTTPS) open
- All other ports blocked by default
- UFW (Uncomplicated Firewall) enabled

**Fail2ban Protection:**
- Automatic IP banning for failed login attempts
- SSH brute force protection
- HTTP flood protection

**SSL/TLS Security:**
- TLS 1.2 and 1.3 only
- Strong cipher suites
- HSTS headers
- Perfect Forward Secrecy

**Application Security:**
- Rate limiting on API endpoints
- Security headers (XSS, CSRF protection)
- Content Security Policy
- Session security with Redis

## 📊 Monitoring & Maintenance

### System Monitoring

Run the monitoring script:
```bash
./scripts/server-monitor.sh
```

**Monitors:**
- Container health and status
- Resource usage (CPU, memory, disk)
- Application health endpoints
- SSL certificate expiration
- Recent errors and logs
- Database connections
- Backup status

### Automated Backups

Set up daily backups:
```bash
# Make backup script executable
chmod +x scripts/server-backup.sh

# Run manual backup
./scripts/server-backup.sh

# For full backup including volumes
./scripts/server-backup.sh --include-volumes

# Set up daily cron job
crontab -e
# Add this line for daily backup at 2 AM:
0 2 * * * /opt/adstrategist/scripts/server-backup.sh
```

**Backup includes:**
- PostgreSQL database dump
- Application configuration
- SSL certificates
- Docker volumes (optional)
- System manifest

### Log Management

**View logs:**
```bash
# Application logs
docker-compose -f docker-compose.server.yml logs -f app

# Database logs
docker-compose -f docker-compose.server.yml logs -f postgres

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# System logs
journalctl -f
```

**Log rotation** is automatically configured for Docker containers.

## 🔄 Updates & Maintenance

### Application Updates

```bash
# Navigate to application directory
cd /opt/adstrategist

# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.server.yml down
docker-compose -f docker-compose.server.yml build --no-cache
docker-compose -f docker-compose.server.yml up -d

# Run any new migrations
docker-compose -f docker-compose.server.yml exec app npm run db:push
```

### System Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose -f docker-compose.server.yml pull
docker-compose -f docker-compose.server.yml up -d

# Clean up old images
docker system prune -f
```

### SSL Certificate Renewal

Certificates auto-renew, but you can test renewal:
```bash
# Test renewal
sudo certbot renew --dry-run

# Force renewal if needed
sudo certbot renew --force-renewal
```

## 📈 Scaling & Performance

### Horizontal Scaling

Scale application instances:
```bash
# Scale to 4 app instances
docker-compose -f docker-compose.server.yml up -d --scale app=4

# Nginx automatically load balances between instances
```

### Vertical Scaling

Edit `docker-compose.server.yml` to increase resources:
```yaml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 6G
          cpus: '4.0'
```

### Database Optimization

**PostgreSQL tuning** for production:
```bash
# Connect to database
docker-compose -f docker-compose.server.yml exec postgres psql -U adstrategist_user -d adstrategist

# Check database size
SELECT pg_size_pretty(pg_database_size('adstrategist'));

# Analyze query performance
EXPLAIN ANALYZE SELECT * FROM campaigns WHERE user_id = 'user_id';
```

### Performance Monitoring

**Key metrics to monitor:**
- Response times (< 500ms for API calls)
- Memory usage (< 80% of available)
- CPU usage (< 70% average)
- Disk usage (< 80% of available)
- Database connections (< 80% of max)

## 🚨 Troubleshooting

### Common Issues

**1. Application won't start:**
```bash
# Check logs
docker-compose -f docker-compose.server.yml logs app

# Check environment variables
docker-compose -f docker-compose.server.yml exec app env | grep -E "(DATABASE|GOOGLE|OPENAI)"

# Restart services
docker-compose -f docker-compose.server.yml restart
```

**2. Database connection issues:**
```bash
# Check database status
docker-compose -f docker-compose.server.yml exec postgres pg_isready -U adstrategist_user

# Check database logs
docker-compose -f docker-compose.server.yml logs postgres

# Restart database
docker-compose -f docker-compose.server.yml restart postgres
```

**3. SSL certificate issues:**
```bash
# Check certificate status
sudo certbot certificates

# Test SSL configuration
openssl s_client -connect your-domain.com:443

# Renew certificate
sudo certbot renew
```

**4. High resource usage:**
```bash
# Check container resources
docker stats

# Scale down if needed
docker-compose -f docker-compose.server.yml up -d --scale app=1

# Check for memory leaks
docker-compose -f docker-compose.server.yml logs app | grep -i "memory\|leak"
```

### Emergency Procedures

**Complete system restart:**
```bash
# Stop all services
docker-compose -f docker-compose.server.yml down

# Restart Docker daemon
sudo systemctl restart docker

# Start services
docker-compose -f docker-compose.server.yml up -d
```

**Database recovery:**
```bash
# Use restore script
./scripts/server-restore.sh

# Follow prompts to select backup
```

**Rollback deployment:**
```bash
# Revert to previous git commit
git log --oneline -10
git checkout <previous-commit-hash>

# Rebuild and restart
docker-compose -f docker-compose.server.yml down
docker-compose -f docker-compose.server.yml build --no-cache
docker-compose -f docker-compose.server.yml up -d
```

## 🔐 Security Best Practices

### Server Hardening

**1. SSH Security:**
```bash
# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
# Set: PasswordAuthentication no (use SSH keys)
sudo systemctl restart ssh
```

**2. Automatic Updates:**
```bash
# Install unattended upgrades
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

**3. Monitoring & Alerts:**
```bash
# Set up log monitoring
sudo apt install logwatch
sudo nano /etc/cron.daily/00logwatch
```

### Application Security

**1. Environment Variables:**
- Never commit `.env` to version control
- Use strong, unique passwords
- Rotate API keys regularly

**2. Database Security:**
- Regular backups
- Strong passwords
- Network isolation (Docker networks)

**3. SSL/TLS:**
- Keep certificates updated
- Use strong cipher suites
- Enable HSTS

## 📞 Support & Maintenance

### Health Checks

**Automated monitoring:**
```bash
# Add to crontab for hourly health checks
0 * * * * /opt/adstrategist/scripts/server-monitor.sh > /var/log/adstrategist/monitor.log 2>&1
```

### Backup Strategy

**Recommended backup schedule:**
- **Daily**: Database backups (automated)
- **Weekly**: Full system backup including volumes
- **Monthly**: Configuration and SSL certificate backup
- **Before updates**: Always backup before major changes

### Performance Optimization

**Regular maintenance tasks:**
- **Weekly**: Review logs and performance metrics
- **Monthly**: Update system packages and Docker images
- **Quarterly**: Review and optimize database queries
- **Annually**: Review and rotate API keys and certificates

---

## 🎉 Deployment Complete!

Your AdStrategist platform is now running in production with:

✅ **High Availability**: Multiple app instances with load balancing  
✅ **Security**: SSL certificates, firewall, and fail2ban protection  
✅ **Monitoring**: Comprehensive health checks and logging  
✅ **Backups**: Automated daily backups with retention  
✅ **Scalability**: Easy horizontal and vertical scaling  
✅ **Maintenance**: Automated updates and monitoring scripts  

**Your platform is accessible at:** `https://your-domain.com`

**Key management commands:**
- Monitor: `./scripts/server-monitor.sh`
- Backup: `./scripts/server-backup.sh`
- Restore: `./scripts/server-restore.sh`
- Logs: `docker-compose -f docker-compose.server.yml logs -f`

For ongoing support, monitor the health endpoint and review logs regularly. Your AI-powered Google Ads platform is now ready for production use! 🚀