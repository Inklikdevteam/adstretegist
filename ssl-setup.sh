#!/bin/bash

# SSL Certificate Setup Script for AdStrategist
set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

echo "🔒 SSL Certificate Setup for AdStrategist"
echo "========================================="

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please don't run this script as root. Use a regular user with sudo privileges."
    exit 1
fi

# Get domain name
read -p "Enter your domain name (e.g., adstrategist.yourdomain.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
    print_error "Domain name is required"
    exit 1
fi

# Validate domain format
if [[ ! "$DOMAIN" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$ ]]; then
    print_warning "Domain format might be invalid. Continue anyway? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

print_info "Setting up SSL for domain: $DOMAIN"

# Stop nginx if running
print_info "Stopping nginx..."
sudo systemctl stop nginx || true

# Configure nginx with domain
print_info "Configuring nginx..."
sudo cp nginx-server.conf /etc/nginx/nginx.conf

# Replace domain placeholder
sudo sed -i "s/YOUR_DOMAIN_HERE/$DOMAIN/g" /etc/nginx/nginx.conf

# Test nginx configuration
if ! sudo nginx -t; then
    print_error "Nginx configuration test failed"
    exit 1
fi

print_status "Nginx configuration updated"

# Start nginx
print_info "Starting nginx..."
sudo systemctl start nginx
sudo systemctl enable nginx
print_status "Nginx started"

# Obtain SSL certificate
print_info "Obtaining SSL certificate from Let's Encrypt..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect

if [ $? -eq 0 ]; then
    print_status "SSL certificate obtained successfully"
else
    print_error "Failed to obtain SSL certificate"
    print_info "Common issues:"
    echo "1. Domain DNS not pointing to this server"
    echo "2. Port 80/443 not accessible from internet"
    echo "3. Domain already has certificate"
    exit 1
fi

# Test SSL configuration
print_info "Testing SSL configuration..."
if curl -f -s https://$DOMAIN/api/health > /dev/null; then
    print_status "SSL configuration test passed"
else
    print_warning "SSL test failed, but certificate was installed"
fi

# Set up automatic renewal
print_info "Setting up automatic certificate renewal..."
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
print_status "Automatic renewal configured"

# Display certificate info
print_info "Certificate information:"
sudo certbot certificates

echo ""
print_status "🎉 SSL setup completed!"
echo ""
print_info "Your AdStrategist platform is now available at:"
echo "  https://$DOMAIN"
echo ""
print_info "Certificate will auto-renew. Check renewal with:"
echo "  sudo certbot renew --dry-run"
echo ""
print_info "Nginx configuration:"
echo "  Config: /etc/nginx/nginx.conf"
echo "  Test: sudo nginx -t"
echo "  Reload: sudo systemctl reload nginx"