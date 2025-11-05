#!/bin/bash

# UN ESCAP Infrastructure Health Check Script
echo "🔍 UN ESCAP Infrastructure Health Check"
echo "======================================"
echo ""

# Check Docker
echo "📦 Checking Docker..."
if command -v docker &> /dev/null; then
    echo "✅ Docker is installed: $(docker --version)"
else
    echo "❌ Docker is not installed"
    exit 1
fi

if command -v docker-compose &> /dev/null; then
    echo "✅ Docker Compose is installed: $(docker-compose --version)"
else
    echo "❌ Docker Compose is not installed"
    exit 1
fi

# Check if Docker is running
if docker info &> /dev/null; then
    echo "✅ Docker daemon is running"
else
    echo "❌ Docker daemon is not running. Please start Docker Desktop."
    exit 1
fi

echo ""

# Check services
echo "🚀 Checking Services..."
SERVICES=(
    "escap_postgis:5432:PostGIS Database"
    "escap_geoserver:8080:GeoServer"
    "escap_redis:6379:Redis Cache"
    "escap_backend:8000:Backend API"
    "escap_nginx:80:Frontend/Nginx"
)

for service in "${SERVICES[@]}"; do
    IFS=':' read -r container port description <<< "$service"
    
    if docker ps --format 'table {{.Names}}' | grep -q "$container"; then
        if docker ps --format 'table {{.Names}}\t{{.Status}}' | grep "$container" | grep -q "Up"; then
            echo "✅ $description ($container) - Running"
            
            # Test port connectivity
            if command -v nc &> /dev/null; then
                if nc -z localhost "$port" 2>/dev/null; then
                    echo "   ✅ Port $port is accessible"
                else
                    echo "   ⚠️  Port $port is not accessible"
                fi
            fi
        else
            echo "❌ $description ($container) - Not running"
        fi
    else
        echo "❌ $description ($container) - Container not found"
    fi
done

echo ""

# Check data directories
echo "📁 Checking Data Directories..."
DIRS=("data/uploads" "data/cog" "data/processed")
for dir in "${DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "✅ $dir exists"
    else
        echo "⚠️  $dir does not exist - creating..."
        mkdir -p "$dir"
    fi
done

echo ""

# Service URLs
echo "🌐 Service URLs:"
echo "   Frontend:     http://localhost:80"
echo "   Admin Panel:  http://localhost:80/?admin=true"
echo "   Backend API:  http://localhost:8000/docs"
echo "   GeoServer:    http://localhost:8080/geoserver"
echo "   Database:     localhost:5432 (escap_user/escap_password_2024)"

echo ""

# Quick commands
echo "🛠️  Quick Commands:"
echo "   View logs:       docker-compose logs [service-name]"
echo "   Restart service: docker-compose restart [service-name]"
echo "   Stop all:        docker-compose down"
echo "   Start all:       docker-compose up -d"
echo "   Rebuild:         docker-compose up -d --build"

echo ""
echo "✨ Health check complete!"