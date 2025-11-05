#!/bin/bash

echo "🔧 Fixing Docker setup in GitHub Codespaces..."
echo "================================================="

# Start Docker daemon if not running
if ! docker info >/dev/null 2>&1; then
    echo "🚀 Starting Docker daemon..."
    
    # Try different methods to start Docker
    if command -v dockerd >/dev/null 2>&1; then
        sudo dockerd > /dev/null 2>&1 &
        sleep 5
    elif command -v systemctl >/dev/null 2>&1; then
        sudo systemctl start docker
        sleep 3
    elif command -v service >/dev/null 2>&1; then
        sudo service docker start
        sleep 3
    else
        echo "❌ Unable to start Docker daemon automatically"
        echo "💡 Try running: sudo dockerd &"
        exit 1
    fi
    
    # Wait for Docker to be ready
    echo "⏳ Waiting for Docker to be ready..."
    timeout=30
    while [ $timeout -gt 0 ] && ! docker info >/dev/null 2>&1; do
        sleep 1
        timeout=$((timeout - 1))
    done
    
    if docker info >/dev/null 2>&1; then
        echo "✅ Docker daemon is now running"
    else
        echo "❌ Docker daemon failed to start"
        echo "💡 Manual start required: sudo dockerd &"
        exit 1
    fi
else
    echo "✅ Docker daemon is already running"
fi

# Check Docker version
echo "📋 Docker version:"
docker --version
docker-compose --version

echo ""
echo "🚀 Now running the deployment script..."
echo "======================================"

# Run the original deploy script
cd /workspaces/spark-template
./scripts/deploy.sh

echo ""
echo "✅ Setup complete! Your infrastructure should now be running."
echo ""
echo "📋 Next steps:"
echo "1. Access your application at: http://localhost:3000"
echo "2. Access admin panel at: http://localhost:3000?admin=true"
echo "3. GeoServer will be at: http://localhost:8080/geoserver"
echo "4. Upload your first raster file through the admin panel"
echo ""
echo "🔍 To check if all services are running:"
echo "docker-compose ps"