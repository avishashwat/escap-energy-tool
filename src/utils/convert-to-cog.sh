#!/bin/bash

# COG Conversion Utility for UN ESCAP Raster Data
# This script converts TIFF raster files to Cloud Optimized GeoTIFF (COG) format
# for faster loading and better performance in web applications

set -e

# Default values
INPUT_DIR=""
OUTPUT_DIR=""
COMPRESS="DEFLATE"
OVERVIEW_RESAMPLING="AVERAGE"
VERBOSE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Help function
show_help() {
    cat << EOF
UN ESCAP Raster to COG Conversion Utility

USAGE:
    ./convert-to-cog.sh [OPTIONS]

OPTIONS:
    -i, --input DIR         Input directory containing TIFF files
    -o, --output DIR        Output directory for COG files
    -c, --compress METHOD   Compression method (DEFLATE, LZW, JPEG, WEBP)
                           Default: DEFLATE
    -r, --resampling METHOD Overview resampling method (NEAREST, AVERAGE, CUBIC)
                           Default: AVERAGE
    -v, --verbose          Enable verbose output
    -h, --help             Show this help message

EXAMPLES:
    # Convert all TIFFs in input directory to COG format
    ./convert-to-cog.sh -i /path/to/rasters -o /path/to/cog_output

    # Use LZW compression with cubic resampling
    ./convert-to-cog.sh -i input/ -o output/ -c LZW -r CUBIC -v

REQUIREMENTS:
    - GDAL (version 3.1+) with COG support
    - Write permissions to output directory

For more information about COG format:
https://www.cogeo.org/
EOF
}

# Check if GDAL is installed
check_gdal() {
    if ! command -v gdalinfo &> /dev/null; then
        echo -e "${RED}Error: GDAL is not installed or not in PATH${NC}"
        echo "Please install GDAL (version 3.1+) to use this script"
        echo ""
        echo "Installation commands:"
        echo "  Ubuntu/Debian: sudo apt-get install gdal-bin"
        echo "  macOS: brew install gdal"
        echo "  Windows: Download from https://gdal.org/download.html"
        exit 1
    fi

    # Check GDAL version for COG support
    GDAL_VERSION=$(gdalinfo --version | grep -oP 'GDAL \K[0-9]+\.[0-9]+')
    if [[ $(echo "$GDAL_VERSION >= 3.1" | bc -l) -eq 0 ]]; then
        echo -e "${YELLOW}Warning: GDAL version $GDAL_VERSION detected. COG support requires 3.1+${NC}"
    fi
}

# Convert single TIFF to COG
convert_file() {
    local input_file="$1"
    local output_file="$2"
    
    echo -e "${BLUE}Converting: $(basename "$input_file")${NC}"
    
    # Build gdal_translate command
    local cmd="gdal_translate"
    cmd="$cmd -of COG"
    cmd="$cmd -co COMPRESS=$COMPRESS"
    cmd="$cmd -co OVERVIEW_RESAMPLING=$OVERVIEW_RESAMPLING"
    cmd="$cmd -co BLOCKSIZE=512"
    cmd="$cmd -co OVERVIEW_COUNT=5"
    cmd="$cmd -co BIGTIFF=IF_SAFER"
    
    if [[ "$VERBOSE" == true ]]; then
        cmd="$cmd -co VERBOSE=YES"
    fi
    
    cmd="$cmd '$input_file' '$output_file'"
    
    if [[ "$VERBOSE" == true ]]; then
        echo "Command: $cmd"
    fi
    
    # Execute conversion
    if eval "$cmd"; then
        echo -e "${GREEN}✓ Converted: $(basename "$output_file")${NC}"
        
        # Validate COG
        if gdalinfo "$output_file" | grep -q "Cloud Optimized"; then
            echo -e "${GREEN}✓ Validated as COG${NC}"
        else
            echo -e "${YELLOW}⚠ Warning: File may not be properly optimized${NC}"
        fi
    else
        echo -e "${RED}✗ Failed to convert: $(basename "$input_file")${NC}"
        return 1
    fi
    echo ""
}

# Main conversion function
convert_directory() {
    local input_dir="$1"
    local output_dir="$2"
    
    # Create output directory if it doesn't exist
    mkdir -p "$output_dir"
    
    # Find all TIFF files
    local tiff_files
    mapfile -t tiff_files < <(find "$input_dir" -type f \( -iname "*.tif" -o -iname "*.tiff" \) | sort)
    
    if [[ ${#tiff_files[@]} -eq 0 ]]; then
        echo -e "${YELLOW}No TIFF files found in $input_dir${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}Found ${#tiff_files[@]} TIFF file(s) to convert${NC}"
    echo ""
    
    local converted=0
    local failed=0
    
    for tiff_file in "${tiff_files[@]}"; do
        # Generate output filename
        local basename=$(basename "$tiff_file")
        local filename="${basename%.*}"
        local output_file="$output_dir/${filename}_cog.tif"
        
        # Skip if output already exists
        if [[ -f "$output_file" ]]; then
            echo -e "${YELLOW}Skipping: $output_file already exists${NC}"
            continue
        fi
        
        if convert_file "$tiff_file" "$output_file"; then
            ((converted++))
        else
            ((failed++))
        fi
    done
    
    echo -e "${GREEN}Conversion complete!${NC}"
    echo -e "Successfully converted: $converted files"
    echo -e "Failed conversions: $failed files"
    
    if [[ $failed -gt 0 ]]; then
        echo -e "${YELLOW}Some files failed to convert. Check the output above for details.${NC}"
        exit 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--input)
            INPUT_DIR="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -c|--compress)
            COMPRESS="$2"
            shift 2
            ;;
        -r|--resampling)
            OVERVIEW_RESAMPLING="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Validate required arguments
if [[ -z "$INPUT_DIR" ]]; then
    echo -e "${RED}Error: Input directory is required${NC}"
    echo "Use --help for usage information"
    exit 1
fi

if [[ -z "$OUTPUT_DIR" ]]; then
    echo -e "${RED}Error: Output directory is required${NC}"
    echo "Use --help for usage information"
    exit 1
fi

# Validate input directory exists
if [[ ! -d "$INPUT_DIR" ]]; then
    echo -e "${RED}Error: Input directory does not exist: $INPUT_DIR${NC}"
    exit 1
fi

# Validate compression method
case $COMPRESS in
    DEFLATE|LZW|JPEG|WEBP|NONE)
        ;;
    *)
        echo -e "${RED}Error: Invalid compression method: $COMPRESS${NC}"
        echo "Valid options: DEFLATE, LZW, JPEG, WEBP, NONE"
        exit 1
        ;;
esac

# Validate resampling method
case $OVERVIEW_RESAMPLING in
    NEAREST|AVERAGE|CUBIC|CUBIC_SPLINE|LANCZOS|MODE)
        ;;
    *)
        echo -e "${RED}Error: Invalid resampling method: $OVERVIEW_RESAMPLING${NC}"
        echo "Valid options: NEAREST, AVERAGE, CUBIC, CUBIC_SPLINE, LANCZOS, MODE"
        exit 1
        ;;
esac

# Check dependencies
check_gdal

# Print configuration
echo -e "${BLUE}=== UN ESCAP COG Conversion Utility ===${NC}"
echo -e "Input directory: $INPUT_DIR"
echo -e "Output directory: $OUTPUT_DIR"
echo -e "Compression: $COMPRESS"
echo -e "Overview resampling: $OVERVIEW_RESAMPLING"
echo -e "Verbose mode: $VERBOSE"
echo ""

# Start conversion
convert_directory "$INPUT_DIR" "$OUTPUT_DIR"