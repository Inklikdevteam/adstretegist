#!/bin/bash

# AdStrategist Server Deployment Script for Debian/Ubuntu
set -e

echo "🚀 AdStrategist Server Deployment Starting..."
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

print_info "Starting system update and dependency installation..."

# Update system packages
sudo apt update && sudo apt upgrade -y
print_status "System packages updated"

# Install required packages
sudo apt install -y \
    curl \
    wget \
    git \
    unzip \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    ufw \
    fail2ban \
    htop \
    nginx \
    certbot \
    python3-certbot-nginx

print_status "Basic packages installed"

# Install Docker
print_info "Installing Docker..."
if ! command -v docker &> /dev/null; then
    # Add Docker's official GPG key
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    
    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
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

print_info "Server setup completed successfully!"
print_warning "Please log out and log back in for Docker group changes to take effect."
print_info "Next steps:"
echo "1. Clone your repository to $APP_DIR"
echo "2. Configure environment variables"
echo "3. Run the application deployment script"
echo "4. Configure SSL certificates"

echo ""
print_status "Server is ready for AdStrategist deployment!"