#!/bin/bash

# Configuration
NGINX_CONF_PATH="/etc/nginx/sites-available/atms"
APK_DIR="/var/www/html/apk"
SOURCE_CONF="./nginx_atms_updated.conf"

echo "🚀 Starting Hosting Setup..."

# 1. Create APK directory
echo "Creating APK directory at $APK_DIR..."
sudo mkdir -p "$APK_DIR"
sudo chown -R $USER:$USER "$APK_DIR"

# 2. Update Nginx configuration
if [ -f "$SOURCE_CONF" ]; then
    echo "Updating Nginx configuration..."
    sudo cp "$SOURCE_CONF" "$NGINX_CONF_PATH"
    
    echo "Testing Nginx configuration..."
    sudo nginx -t
    
    if [ $? -eq 0 ]; then
        echo "Reloading Nginx..."
        sudo systemctl reload nginx
        echo "✅ Nginx updated and reloaded successfully!"
    else
        echo "❌ Nginx configuration test failed! Please check the config."
        exit 1
    fi
else
    echo "❌ Source Nginx config file not found: $SOURCE_CONF"
    exit 1
fi

echo ""
echo "🎉 Setup complete!"
echo "You can now place your APK file in: $APK_DIR"
echo "It will be available at: http://117.251.19.107:8090/apk/your-app.apk"
