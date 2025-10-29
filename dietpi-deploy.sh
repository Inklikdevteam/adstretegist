#!/bin/bash

# AdStrategist DietPi Server Deployment Script
set -e

echo "🚀 AdStrategist DietPi Deployment Starting..."
echo "=============================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please don't run this script as root. Use a regular user with sudo privileges."
    exit 1
fi

# Check if sudo is available
if ! command -v sudo &> /dev/null; then
    print_error "sudo is required but not installed. Please install sudo first."
    exit 1
fi

print_info "Detected DietPi system - using optimized installation..."

# Update system packages
print_info "Updating system packages..."
sudo apt update && sudo apt upgrade -y
print_status "System packages updated"

# Install required packages for DietPi
print_info "Installing required packages..."
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
    jq \
    dirmngr

print_status "Basic packages installed"

# Install Docker for DietPi/Debian
print_info "Installing Docker for DietPi..."
if ! command -v docker &> /dev/null; then
    # Add Docker's official GPG key for Debian
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    
    # Get Debian version codename
    DEBIAN_CODENAME=$(lsb_release -cs)
    
    # Add Docker repository for Debian
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $DEBIAN_CODENAME stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    print_status "Docker installed successfully"
else
    print_status "Docker already installed"
fi

# Docker Compose is now included as a plugin
print_info "Verifying Docker Compose plugin..."
if docker compose version &> /dev/null; then
    print_status "Docker Compose plugin available"
else
    print_warning "Docker Compose plugin not available, installing standalone version..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    print_status "Docker Compose standalone installed"
fi

# Configure firewall
print_info "Configuring firewall..."
sudo ufw --force enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
print_status "Firewall configured"

# Configure fail2ban
print_info "Configuring fail2ban..."
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
print_status "Fail2ban configured"

# Create application directory
APP_DIR="/opt/adstrategist"
print_info "Creating application directory at $APP_DIR..."
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR
print_status "Application directory created"

# Create logs directory
sudo mkdir -p /var/log/adstrategist
sudo chown $USER:$USER /var/log/adstrategist
print_status "Logs directory created"

# Create backup directory
sudo mkdir -p /opt/adstrategist-backups
sudo chown $USER:$USER /opt/adstrategist-backups
print_status "Backup directory created"

# Create data directories
sudo mkdir -p /opt/adstrategist-data/postgres /opt/adstrategist-data/redis
sudo chown -R $USER:$USER /opt/adstrategist-data
print_status "Data directories created"

# DietPi specific optimizations
print_info "Applying DietPi optimizations..."

# Optimize memory usage for DietPi
if [ -f /boot/dietpi.txt ]; then
    print_info "Detected DietPi configuration file"
    # Add any DietPi-specific optimizations here
fi

# Set up log rotation for Docker containers
sudo tee /etc/logrotate.d/docker-containers > /dev/null << 'EOF'
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    size=1M
    missingok
    delaycompress
    copytruncate
}
EOF

print_status "Log rotation configured"

print_info "DietPi server setup completed successfully!"
print_warning "Please log out and log back in for Docker group changes to take effect."
print_info "Next steps:"
echo "1. Log out and back in: exit && ssh user@server"
echo "2. Clone your repository to $APP_DIR"
echo "3. Configure environment variables"
echo "4. Run the application deployment script"
echo "5. Configure SSL certificates"

echo ""
print_status "DietPi server is ready for AdStrategist deployment!"

# Display system information
print_info "System Information:"
echo "OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
echo "Kernel: $(uname -r)"
echo "Architecture: $(uname -m)"
echo "Memory: $(free -h | grep Mem | awk '{print $2}')"
echo "Disk: $(df -h / | tail -1 | awk '{print $2}')"
echo "Docker: $(docker --version 2>/dev/null || echo 'Not available yet - please log out and back in')"