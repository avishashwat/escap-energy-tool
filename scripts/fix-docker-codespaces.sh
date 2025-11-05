#!/bin/bash

echo "🔧 Fixing Docker permissions in GitHub Codespaces..."
echo "=================================================="

# Add current user to docker group
sudo usermod -aG docker $USER

# Fix docker socket permissions
sudo chmod 666 /var/run/docker.sock

# Start docker service with proper permissions
sudo dockerd --group=docker --host=unix:///var/run/docker.sock > /dev/null 2>&1 &

# Wait for docker to start
echo "⏳ Waiting for Docker daemon to start..."
sleep 8

# Test docker
if docker info > /dev/null 2>&1; then
    echo "✅ Docker is now working!"
    echo ""
    echo "🚀 Ready to deploy infrastructure. Run:"
    echo "   ./scripts/deploy.sh"
else
    echo "❌ Docker setup failed. Try restarting the codespace."
    echo ""
    echo "Alternative: Run these commands manually:"
    echo "   sudo chmod 666 /var/run/docker.sock"
    echo "   sudo dockerd --group=docker > /dev/null 2>&1 &"
    echo "   sleep 5"
    echo "   docker info"
fi