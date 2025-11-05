#!/bin/bash

echo "🔄 Converting TIFFs to Cloud Optimized GeoTIFF (COG) format..."

# Check if gdal is available
if ! command -v gdal_translate &> /dev/null; then
    echo "❌ GDAL is not installed. Installing..."
    # Add installation commands based on your system
    # For Ubuntu/Debian: apt-get install gdal-bin
    # For macOS: brew install gdal
    # For CentOS/RHEL: yum install gdal
fi

# Function to convert single file to COG
convert_to_cog() {
    local input_file="$1"
    local output_file="$2"
    
    echo "   Converting: $(basename "$input_file")"
    
    gdal_translate \
        -of COG \
        -co COMPRESS=DEFLATE \
        -co PREDICTOR=2 \
        -co ZLEVEL=6 \
        -co BLOCKSIZE=512 \
        -co OVERVIEWS=AUTO \
        -co OVERVIEW_RESAMPLING=BILINEAR \
        "$input_file" "$output_file"
    
    if [ $? -eq 0 ]; then
        echo "   ✅ Converted: $(basename "$output_file")"
    else
        echo "   ❌ Failed: $(basename "$input_file")"
    fi
}

# Convert all TIFFs in a directory
if [ "$#" -eq 0 ]; then
    echo "Usage: $0 <input_directory> [output_directory]"
    echo "Example: $0 ./raw_tiffs ./cog_output"
    exit 1
fi

input_dir="$1"
output_dir="${2:-${input_dir}_cog}"

# Create output directory
mkdir -p "$output_dir"

# Find and convert all TIFF files
find "$input_dir" -name "*.tif" -o -name "*.tiff" | while read -r tiff_file; do
    # Get relative path and create same structure in output
    relative_path="${tiff_file#$input_dir/}"
    output_file="$output_dir/${relative_path}"
    
    # Create subdirectories if needed
    mkdir -p "$(dirname "$output_file")"
    
    # Convert to COG
    convert_to_cog "$tiff_file" "$output_file"
done

echo ""
echo "🎉 COG conversion completed!"
echo "📁 Output directory: $output_dir"
echo ""
echo "💡 Benefits of COG format:"
echo "   • 50-100x faster web serving"
echo "   • Efficient cloud storage"
echo "   • Progressive loading"
echo "   • Better compression"