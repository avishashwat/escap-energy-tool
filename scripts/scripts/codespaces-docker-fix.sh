#!/bin/bash

echo "🔧 Fixing Docker in GitHub Codespaces..."
echo "========================================="

# Stop any existing docker processes
sudo pkill dockerd 2>/dev/null || true
sudo pkill docker-containerd 2>/dev/null || true

# Clean up docker socket
sudo rm -f /var/run/docker.sock

# Start docker service properly for Codespaces
echo "🚀 Starting Docker service..."
sudo service docker start

# Wait for socket to be ready
sleep 3

# Check if docker socket exists and set permissions
if [ -S /var/run/docker.sock ]; then
    sudo chmod 666 /var/run/docker.sock
    echo "✅ Docker socket permissions fixed"
else
    echo "⚠️  Docker socket not found, trying alternative approach..."
    
    # Alternative: Start dockerd manually with proper permissions
    sudo dockerd --host=unix:///var/run/docker.sock --group=docker &
    sleep 5
    
    if [ -S /var/run/docker.sock ]; then
        sudo chmod 666 /var/run/docker.sock
        echo "✅ Docker started manually"
    else
        echo "❌ Failed to start Docker"
        exit 1
    fi
fi

# Test docker
echo "🧪 Testing Docker..."
if docker info > /dev/null 2>&1; then
    echo "✅ Docker is working!"
    docker --version
else
    echo "❌ Docker test failed"
    exit 1
fi

echo ""
echo "✅ Docker setup complete!"
echo "You can now run: ./scripts/deploy.sh"