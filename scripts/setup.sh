#!/bin/bash
"""
Setup script for data processing tools
"""

echo "Setting up UN ESCAP Climate & Energy Risk Visualization data processing tools..."

# Make Python scripts executable
chmod +x scripts/*.py

echo "✓ Made Python scripts executable"

# Check if GDAL is installed
if command -v gdal-translate &> /dev/null; then
    echo "✓ GDAL is installed"
    gdal-config --version
else
    echo "⚠ GDAL is not installed. Please install GDAL:"
    echo "  Ubuntu/Debian: sudo apt-get install gdal-bin python3-gdal"
    echo "  macOS: brew install gdal"
    echo "  Windows: Download from https://www.lfd.uci.edu/~gohlke/pythonlibs/#gdal"
fi

# Check if Python dependencies are installed
echo "Checking Python dependencies..."

python3 -c "
import sys
missing_packages = []

try:
    import geopandas
    print('✓ geopandas installed')
except ImportError:
    missing_packages.append('geopandas')

try:
    import pandas
    print('✓ pandas installed')
except ImportError:
    missing_packages.append('pandas')

try:
    import openpyxl
    print('✓ openpyxl installed')
except ImportError:
    missing_packages.append('openpyxl')

if missing_packages:
    print(f'⚠ Missing packages: {missing_packages}')
    print('Install with: pip install -r scripts/requirements.txt')
    sys.exit(1)
else:
    print('✓ All Python dependencies are installed')
"

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Setup complete! You can now use the data processing scripts:"
    echo ""
    echo "  # Convert TIF files to COG format:"
    echo "  python scripts/convert_to_cog.py /path/to/input /path/to/output"
    echo ""
    echo "  # Process shapefiles:"
    echo "  python scripts/process_shapefiles.py /path/to/input /path/to/output"
    echo ""
    echo "  # Process Excel classifications:"
    echo "  python scripts/process_classifications.py /path/to/excel_file /path/to/output"
    echo ""
    echo "See src/data-integration-guide.md for detailed instructions."
else
    echo ""
    echo "❌ Setup incomplete. Please install missing dependencies:"
    echo "pip install -r scripts/requirements.txt"
fi