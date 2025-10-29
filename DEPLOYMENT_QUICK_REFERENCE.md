# AdStrategist - Deployment Quick Reference

## 🚀 5-Minute Deployment Summary

### Prerequisites
- Ubuntu/Debian server with 4GB+ RAM
- Domain pointing to server IP
- Google Ads API credentials
- At least one AI provider API key

### Deployment Commands

```bash
# 1. Server Setup (5 minutes)
wget https://raw.githubusercontent.com/your-repo/server-deploy.sh
chmod +x server-deploy.sh && ./server-deploy.sh

# 2. Application Setup (10 minutes)
cd /opt/adstrategist
git clone your-repo .
cp .env.example .env
# Edit .env with your credentials
chmod +x app-deploy.sh && ./app-deploy.sh

# 3. SSL Setup (5 minutes)
chmod +x ssl-setup.sh && ./ssl-setup.sh
# Enter your domain when prompted
```

**Total Time: ~20 minutes**

---

## 📋 Environment Variables Checklist

```env
# Required - Database & Redis
DB_PASSWORD=secure_password_123
REDIS_PASSWORD=redis_secure_password

# Required - Google Ads API
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_DEVELOPER_TOKEN=your_dev_token

# Required - At least one AI provider
OPENAI_API_KEY=sk-your_key
ANTHROPIC_API_KEY=your_key  # Optional
PERPLEXITY_API_KEY=your_key # Optional

# Required - Session Security
SESSION_SECRET=64_character_secure_secret
```

---

## 🔧 Essential Commands

### Service Management
```bash
# Check status
docker compose -f docker-compose.server.yml ps

# View logs
docker compose -f docker-compose.server.yml logs -f app

# Restart services
docker compose -f docker-compose.server.yml restart

# Stop all services
docker compose -f docker-compose.server.yml down

# Start all services
docker compose -f docker-compose.server.yml up -d
```

### Monitoring & Maintenance
```bash
# System health check
./scripts/server-monitor.sh

# Create backup
./scripts/server-backup.sh

# Check application health
curl https://your-domain.com/api/health

# Check SSL certificate
sudo certbot certificates
```

### Troubleshooting
```bash
# Check container resources
docker stats

# Database health
docker compose -f docker-compose.server.yml exec postgres pg_isready -U adstrategist_user

# Application environment
docker compose -f docker-compose.server.yml exec app env | grep -E "(DATABASE|GOOGLE|OPENAI)"

# Nginx configuration test
sudo nginx -t
```

---

## 🚨 Emergency Procedures

### Complete System Restart
```bash
docker compose -f docker-compose.server.yml down
sudo systemctl restart docker
docker compose -f docker-compose.server.yml up -d
```

### Database Recovery
```bash
./scripts/server-restore.sh
# Follow prompts to select backup
```

### SSL Certificate Renewal
```bash
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

### Application Update
```bash
git pull origin main
docker compose -f docker-compose.server.yml down
docker compose -f docker-compose.server.yml build --no-cache
docker compose -f docker-compose.server.yml up -d
```

---

## 📊 Health Check URLs

- **Application Health:** `https://your-domain.com/api/health`
- **Admin Panel:** `https://your-domain.com/admin`
- **Main Application:** `https://your-domain.com`

---

## 🔐 Security Checklist

- [ ] Strong passwords in `.env`
- [ ] SSL certificate active
- [ ] Firewall configured (ports 22, 80, 443 only)
- [ ] Fail2ban active
- [ ] Automated backups scheduled
- [ ] SSH key authentication (disable password auth)
- [ ] Regular security updates enabled

---

## 📈 Performance Optimization

### Resource Monitoring
```bash
# CPU and Memory usage
htop

# Disk usage
df -h

# Container resources
docker stats

# Network connections
ss -tuln | grep -E "(80|443|5000|5432|6379)"
```

### Scaling Options
```bash
# Scale application instances
docker compose -f docker-compose.server.yml up -d --scale app=4

# Increase container resources (edit docker-compose.server.yml)
# Then restart: docker compose -f docker-compose.server.yml up -d
```

---

## 📞 Support Information

### Log Locations
- **Application:** `docker compose -f docker-compose.server.yml logs app`
- **Database:** `docker compose -f docker-compose.server.yml logs postgres`
- **Nginx:** `/var/log/nginx/error.log`
- **System:** `journalctl -f`

### Backup Locations
- **Database Backups:** `/opt/adstrategist-backups/`
- **Configuration:** Included in backup files
- **SSL Certificates:** `/etc/letsencrypt/`

### Key File Locations
- **Application:** `/opt/adstrategist/`
- **Data:** `/opt/adstrategist-data/`
- **Logs:** `/var/log/adstrategist/`
- **Nginx Config:** `/etc/nginx/nginx.conf`

---

## 🎯 Success Indicators

✅ **All containers running:** `docker compose -f docker-compose.server.yml ps`  
✅ **Health check passes:** `curl https://your-domain.com/api/health`  
✅ **SSL certificate valid:** `sudo certbot certificates`  
✅ **Application accessible:** Browse to `https://your-domain.com`  
✅ **Backups working:** Check `/opt/adstrategist-backups/`  
✅ **Monitoring active:** `./scripts/server-monitor.sh` shows green status  

**Your AdStrategist platform is production-ready! 🚀**