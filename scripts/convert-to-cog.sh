#!/bin/bash

# TIF to COG Conversion Script for UN ESCAP Climate Data
# This script converts regular TIFF files to Cloud Optimized GeoTIFF (COG) format
# for faster web delivery and optimal performance in the mapping application

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if GDAL is installed
check_gdal() {
    if ! command -v gdal_translate &> /dev/null; then
        print_error "GDAL is not installed. Please install GDAL first."
        echo "On Ubuntu/Debian: sudo apt-get install gdal-bin"
        echo "On macOS: brew install gdal"
        echo "On Windows: Download from https://gdal.org/download.html"
        exit 1
    fi
    
    print_success "GDAL is installed: $(gdal_translate --version)"
}

# Function to convert a single TIF to COG
convert_to_cog() {
    local input_file="$1"
    local output_file="$2"
    
    print_status "Converting: $input_file -> $output_file"
    
    # COG conversion with optimization parameters
    gdal_translate \
        -of COG \
        -co COMPRESS=DEFLATE \
        -co PREDICTOR=2 \
        -co BLOCKSIZE=512 \
        -co OVERVIEW_RESAMPLING=NEAREST \
        -co OVERVIEW_COUNT=5 \
        "$input_file" \
        "$output_file"
    
    if [ $? -eq 0 ]; then
        print_success "Converted: $(basename "$output_file")"
        
        # Get file size comparison
        original_size=$(du -h "$input_file" | cut -f1)
        cog_size=$(du -h "$output_file" | cut -f1)
        print_status "Size comparison: $original_size -> $cog_size"
    else
        print_error "Failed to convert: $input_file"
        return 1
    fi
}

# Function to validate COG format
validate_cog() {
    local file="$1"
    
    print_status "Validating COG: $(basename "$file")"
    
    # Check if file is a valid COG using gdalinfo
    if gdalinfo "$file" | grep -q "LAYOUT=COG"; then
        print_success "Valid COG format: $(basename "$file")"
        return 0
    else
        print_warning "File may not be optimally formatted as COG: $(basename "$file")"
        return 1
    fi
}

# Function to process directory recursively
process_directory() {
    local input_dir="$1"
    local output_dir="$2"
    
    print_status "Processing directory: $input_dir"
    
    # Create output directory if it doesn't exist
    mkdir -p "$output_dir"
    
    # Find all TIF/TIFF files
    find "$input_dir" -type f \( -name "*.tif" -o -name "*.tiff" -o -name "*.TIF" -o -name "*.TIFF" \) | while read -r file; do
        # Get relative path
        rel_path=$(realpath --relative-to="$input_dir" "$file")
        
        # Create output path with _cog suffix
        output_file="$output_dir/${rel_path%.*}_cog.tif"
        
        # Create subdirectories if needed
        mkdir -p "$(dirname "$output_file")"
        
        # Convert to COG
        convert_to_cog "$file" "$output_file"
        
        # Validate the conversion
        validate_cog "$output_file"
    done
}

# Function to show usage
show_usage() {
    echo "TIF to COG Conversion Script for UN ESCAP Climate Data"
    echo ""
    echo "Usage:"
    echo "  $0 file <input.tif> <output_cog.tif>     # Convert single file"
    echo "  $0 dir <input_dir> <output_dir>          # Convert directory"
    echo "  $0 check <file.tif>                      # Validate COG format"
    echo ""
    echo "Examples:"
    echo "  $0 file bhutan_temp.tif bhutan_temp_cog.tif"
    echo "  $0 dir ./data/raw ./data/cog"
    echo "  $0 check bhutan_temp_cog.tif"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo ""
    echo "Requirements:"
    echo "  - GDAL tools must be installed"
    echo "  - Input files should be in TIF/TIFF format"
    echo "  - Sufficient disk space for converted files"
}

# Main script logic
main() {
    case "$1" in
        "file")
            if [ $# -ne 3 ]; then
                print_error "File mode requires input and output filenames"
                show_usage
                exit 1
            fi
            
            check_gdal
            convert_to_cog "$2" "$3"
            validate_cog "$3"
            ;;
            
        "dir")
            if [ $# -ne 3 ]; then
                print_error "Directory mode requires input and output directories"
                show_usage
                exit 1
            fi
            
            if [ ! -d "$2" ]; then
                print_error "Input directory does not exist: $2"
                exit 1
            fi
            
            check_gdal
            process_directory "$2" "$3"
            ;;
            
        "check")
            if [ $# -ne 2 ]; then
                print_error "Check mode requires a filename"
                show_usage
                exit 1
            fi
            
            if [ ! -f "$2" ]; then
                print_error "File does not exist: $2"
                exit 1
            fi
            
            check_gdal
            validate_cog "$2"
            ;;
            
        "-h"|"--help"|"help")
            show_usage
            exit 0
            ;;
            
        *)
            print_error "Invalid command: $1"
            show_usage
            exit 1
            ;;
    esac
}

# Check if any arguments provided
if [ $# -eq 0 ]; then
    print_error "No arguments provided"
    show_usage
    exit 1
fi

# Run main function with all arguments
main "$@"

print_success "Script completed successfully!"