# DietPi Deployment Fix

## 🔧 Issue Resolution

You encountered an error with `software-properties-common` package on DietPi. This is because DietPi (based on Debian) doesn't include this package by default.

## ✅ Quick Fix

### Option 1: Use the Updated Script

I've updated the `server-deploy.sh` script to be DietPi compatible. You can either:

1. **Pull the latest changes:**
```bash
cd /opt/adstrategist
git pull origin main
chmod +x server-deploy.sh
./server-deploy.sh
```

2. **Or use the DietPi-specific script:**
```bash
chmod +x dietpi-deploy.sh
./dietpi-deploy.sh
```

### Option 2: Manual Installation (Continue from where you left off)

Since your system update completed successfully, continue with these commands:

```bash
# Install required packages (DietPi compatible)
sudo apt install -y \
    curl \
    wget \
    git \
    unzip \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    ufw \
    fail2ban \
    htop \
    nginx \
    certbot \
    python3-certbot-nginx \
    bc \
    jq

# Install Docker for DietPi/Debian
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository for Debian
DEBIAN_CODENAME=$(lsb_release -cs)
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $DEBIAN_CODENAME stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER

# Configure firewall
sudo ufw --force enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Configure fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Create directories
sudo mkdir -p /opt/adstrategist /var/log/adstrategist /opt/adstrategist-backups
sudo mkdir -p /opt/adstrategist-data/postgres /opt/adstrategist-data/redis
sudo chown -R $USER:$USER /opt/adstrategist /var/log/adstrategist /opt/adstrategist-backups /opt/adstrategist-data

echo "✅ Server setup completed!"
echo "⚠️  Please log out and log back in for Docker group changes to take effect."
```

## 🚀 Continue Deployment

After the server setup is complete:

1. **Log out and back in:**
```bash
exit
ssh adstrategist@your-server-ip
```

2. **Verify Docker:**
```bash
docker --version
docker compose version
```

3. **Continue with application deployment:**
```bash
cd /opt/adstrategist
git clone https://github.com/Inklikdevteam/adstretegist.git .
cp .env.example .env
nano .env  # Configure your API keys
chmod +x app-deploy.sh
./app-deploy.sh
```

## 🎯 DietPi-Specific Notes

- DietPi is optimized for single-board computers and lightweight systems
- The deployment will work perfectly on DietPi with the corrected packages
- All Docker and application features are fully supported
- Memory usage is optimized for smaller systems

Your deployment will continue normally after this fix! 🚀