# AdStrategist - Complete Step-by-Step Server Deployment Guide

This guide will walk you through deploying your AI-powered Google Ads platform on a live Ubuntu/Debian server from start to finish.

## 📋 Prerequisites Checklist

Before starting, ensure you have:

### 1. Server Requirements
- [ ] **Ubuntu 20.04+** or **Debian 11+** server
- [ ] **4GB+ RAM** (8GB recommended)
- [ ] **50GB+ SSD storage**
- [ ] **2+ CPU cores** (4+ recommended)
- [ ] **Public IP address**
- [ ] **Root or sudo access**

### 2. Domain & DNS
- [ ] **Domain name** purchased (e.g., `adstrategist.yourdomain.com`)
- [ ] **DNS A record** pointing to your server's IP address
- [ ] **DNS propagation** verified (use `nslookup your-domain.com`)

### 3. API Keys & Credentials
- [ ] **Google Cloud Console** project created
- [ ] **Google Ads API** enabled
- [ ] **OAuth 2.0 credentials** created
- [ ] **Google Ads Developer Token** obtained
- [ ] **OpenAI API key** (required)
- [ ] **Anthropic API key** (optional)
- [ ] **Perplexity API key** (optional)

---

## 🚀 Step 1: Initial Server Setup

### 1.1 Connect to Your Server

```bash
# Connect via SSH (replace with your server IP)
ssh root@YOUR_SERVER_IP

# Or if using a non-root user:
ssh your-username@YOUR_SERVER_IP
```

### 1.2 Update System Packages

```bash
# Update package lists
sudo apt update

# Upgrade all packages
sudo apt upgrade -y

# Install basic utilities
sudo apt install -y curl wget git unzip nano htop
```

### 1.3 Create Application User (if using root)

```bash
# Create a dedicated user for the application
sudo adduser adstrategist

# Add user to sudo group
sudo usermod -aG sudo adstrategist

# Switch to the new user
su - adstrategist
```

---

## 🔧 Step 2: Server Environment Setup

### 2.1 Download and Run Server Setup Script

```bash
# Download the server setup script
wget https://raw.githubusercontent.com/your-username/your-repo/main/server-deploy.sh

# Make it executable
chmod +x server-deploy.sh

# Run the setup script
./server-deploy.sh
```

**What this script does:**
- Installs Docker and Docker Compose
- Configures firewall (UFW)
- Sets up fail2ban for security
- Installs nginx and certbot
- Creates application directories
- Configures basic security

### 2.2 Verify Installation

```bash
# Check Docker installation
docker --version
docker compose version

# Check firewall status
sudo ufw status

# Verify fail2ban
sudo systemctl status fail2ban
```

### 2.3 Log Out and Back In

```bash
# Log out to apply Docker group changes
exit

# Log back in
ssh your-username@YOUR_SERVER_IP
```

---

## 📦 Step 3: Application Deployment

### 3.1 Clone Your Repository

```bash
# Navigate to application directory
cd /opt/adstrategist

# Clone your repository (replace with your actual repo URL)
git clone https://github.com/your-username/adstrategist.git .

# Verify files are present
ls -la
```

### 3.2 Configure Environment Variables

```bash
# Copy environment template
cp .env.example .env

# Edit environment file
nano .env
```

**Configure the following in `.env`:**

```env
# Database Configuration
DB_PASSWORD=your_very_secure_database_password_here

# Redis Configuration  
REDIS_PASSWORD=your_very_secure_redis_password_here

# Google Ads API Configuration (Required)
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_DEVELOPER_TOKEN=your_google_ads_developer_token

# AI Provider API Keys (At least one required)
OPENAI_API_KEY=sk-your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
PERPLEXITY_API_KEY=your_perplexity_api_key_here

# Session Management (Generate a strong 64-character secret)
SESSION_SECRET=your_super_secure_64_character_session_secret_change_this_in_production

# Server Configuration
NODE_ENV=production
PORT=5000
TZ=UTC
```

**To generate secure passwords:**
```bash
# Generate secure database password
openssl rand -base64 32

# Generate secure session secret
openssl rand -base64 48
```

### 3.3 Deploy the Application

```bash
# Make deployment script executable
chmod +x app-deploy.sh

# Run application deployment
./app-deploy.sh
```

**What this script does:**
- Validates environment configuration
- Creates data directories
- Builds Docker images
- Starts all services (PostgreSQL, Redis, App, Nginx)
- Runs database migrations
- Performs health checks

### 3.4 Verify Application Deployment

```bash
# Check container status
docker compose -f docker-compose.server.yml ps

# Check application health
curl http://localhost:5000/api/health

# View application logs
docker compose -f docker-compose.server.yml logs -f app
```

---

## 🔒 Step 4: SSL Certificate Setup

### 4.1 Configure Domain in Nginx

```bash
# Make SSL setup script executable
chmod +x ssl-setup.sh

# Run SSL setup
./ssl-setup.sh
```

**You'll be prompted for:**
- Your domain name (e.g., `adstrategist.yourdomain.com`)
- Email for certificate notifications

### 4.2 Verify SSL Configuration

```bash
# Test HTTPS access
curl https://your-domain.com/api/health

# Check certificate details
sudo certbot certificates

# Test SSL configuration
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

---

## ✅ Step 5: Final Verification

### 5.1 Run System Monitor

```bash
# Make monitoring script executable
chmod +x scripts/server-monitor.sh

# Run comprehensive system check
./scripts/server-monitor.sh
```

### 5.2 Test Application Features

1. **Access your platform:** `https://your-domain.com`
2. **Create admin account:** Register first user (becomes admin)
3. **Test Google Ads OAuth:** Connect Google Ads account
4. **Verify AI providers:** Check AI recommendations work
5. **Test dashboard:** Ensure metrics display correctly

---

## 🔧 Step 6: Production Configuration

### 6.1 Set Up Automated Backups

```bash
# Make backup script executable
chmod +x scripts/server-backup.sh

# Test backup
./scripts/server-backup.sh

# Set up daily backup cron job
crontab -e

# Add this line for daily backup at 2 AM:
0 2 * * * /opt/adstrategist/scripts/server-backup.sh
```

### 6.2 Configure Monitoring

```bash
# Set up hourly monitoring
crontab -e

# Add this line for hourly health checks:
0 * * * * /opt/adstrategist/scripts/server-monitor.sh > /var/log/adstrategist/monitor.log 2>&1
```

### 6.3 Security Hardening

```bash
# Disable root login (if using SSH keys)
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
# Set: PasswordAuthentication no

# Restart SSH service
sudo systemctl restart ssh

# Set up automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

---

## 🎯 Step 7: Testing & Validation

### 7.1 Functional Testing

**Test these features:**
- [ ] User registration and login
- [ ] Google Ads OAuth connection
- [ ] Campaign data synchronization
- [ ] AI recommendation generation
- [ ] Dashboard metrics display
- [ ] Settings configuration

### 7.2 Performance Testing

```bash
# Check resource usage
docker stats

# Monitor response times
curl -w "@curl-format.txt" -o /dev/null -s https://your-domain.com/api/health

# Create curl-format.txt:
cat > curl-format.txt << 'EOF'
     time_namelookup:  %{time_namelookup}\n
        time_connect:  %{time_connect}\n
     time_appconnect:  %{time_appconnect}\n
    time_pretransfer:  %{time_pretransfer}\n
       time_redirect:  %{time_redirect}\n
  time_starttransfer:  %{time_starttransfer}\n
                     ----------\n
          time_total:  %{time_total}\n
EOF
```

### 7.3 Security Testing

```bash
# Check SSL rating
curl -s "https://api.ssllabs.com/api/v3/analyze?host=your-domain.com" | jq '.endpoints[0].grade'

# Verify firewall
sudo ufw status verbose

# Check fail2ban status
sudo fail2ban-client status
```

---

## 📊 Step 8: Monitoring & Maintenance

### 8.1 Log Management

```bash
# View application logs
docker compose -f docker-compose.server.yml logs -f app

# View database logs
docker compose -f docker-compose.server.yml logs -f postgres

# View nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# View system logs
journalctl -f
```

### 8.2 Performance Monitoring

```bash
# Monitor system resources
htop

# Check disk usage
df -h

# Monitor network connections
ss -tuln

# Check memory usage
free -h
```

### 8.3 Regular Maintenance Tasks

**Daily:**
- [ ] Check application health: `curl https://your-domain.com/api/health`
- [ ] Review error logs
- [ ] Verify backup completion

**Weekly:**
- [ ] Run system monitor: `./scripts/server-monitor.sh`
- [ ] Update system packages: `sudo apt update && sudo apt upgrade`
- [ ] Review resource usage

**Monthly:**
- [ ] Review SSL certificate expiration
- [ ] Analyze performance metrics
- [ ] Update Docker images
- [ ] Review security logs

---

## 🚨 Troubleshooting Common Issues

### Issue 1: Application Won't Start

```bash
# Check container logs
docker compose -f docker-compose.server.yml logs app

# Check environment variables
docker compose -f docker-compose.server.yml exec app env | grep -E "(DATABASE|GOOGLE|OPENAI)"

# Restart application
docker compose -f docker-compose.server.yml restart app
```

### Issue 2: Database Connection Failed

```bash
# Check database status
docker compose -f docker-compose.server.yml exec postgres pg_isready -U adstrategist_user

# Check database logs
docker compose -f docker-compose.server.yml logs postgres

# Restart database
docker compose -f docker-compose.server.yml restart postgres
```

### Issue 3: SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew --force-renewal

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### Issue 4: High Resource Usage

```bash
# Check container resources
docker stats

# Scale down if needed
docker compose -f docker-compose.server.yml up -d --scale app=1

# Check for memory leaks
docker compose -f docker-compose.server.yml logs app | grep -i "memory\|leak"
```

---

## 🎉 Deployment Complete!

Your AdStrategist platform is now running in production with:

✅ **Latest Software Versions:**
- Node.js 22, PostgreSQL 17, Redis 7.4, Nginx 1.27

✅ **Production Features:**
- SSL/TLS certificates with auto-renewal
- Load balancing with multiple app instances
- Automated backups and monitoring
- Security hardening and firewall protection

✅ **High Availability:**
- Health checks and auto-restart
- Resource limits and optimization
- Comprehensive logging and monitoring

**Your platform is accessible at:** `https://your-domain.com`

**Key Management Commands:**
```bash
# Monitor system
./scripts/server-monitor.sh

# Backup database
./scripts/server-backup.sh

# View logs
docker compose -f docker-compose.server.yml logs -f app

# Restart services
docker compose -f docker-compose.server.yml restart

# Update application
git pull && docker compose -f docker-compose.server.yml up -d --build
```

**Support Resources:**
- Health Check: `https://your-domain.com/api/health`
- Server Monitor: `./scripts/server-monitor.sh`
- Backup Status: `ls -la /opt/adstrategist-backups/`
- SSL Status: `sudo certbot certificates`

Your AI-powered Google Ads platform is now ready for production use! 🚀