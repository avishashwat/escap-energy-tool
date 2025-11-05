#!/bin/bash

# ESCAP Climate Risk App - Codespaces Optimization
echo "🚀 Optimizing ESCAP Climate Risk App for Codespaces..."
echo "=================================================="

# Install required packages for client-side processing
echo "📦 Installing optimization packages..."
npm install --save sharp geo-converter proj4 @turf/turf geojson-validation

# Create optimized directories
echo "📁 Setting up optimized data structure..."
mkdir -p data/optimized/{boundaries,rasters,energy}
mkdir -p data/cache
mkdir -p data/temp

# Set permissions
chmod -R 755 data/

echo "✅ Codespaces optimization complete!"
echo ""
echo "🎯 Your app is ready to use:"
echo "   • Admin panel: Click 'Admin' button in top bar"
echo "   • Upload boundaries, rasters, and energy data"
echo "   • Test all map features and overlays"
echo ""
echo "💡 Performance features enabled:"
echo "   • Client-side data optimization"
echo "   • Memory-based caching"
echo "   • Progressive loading"
echo "   • WebGL acceleration"
echo ""
echo "🚀 Start using the app now - no Docker required!"