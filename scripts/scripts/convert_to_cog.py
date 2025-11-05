#!/usr/bin/env python3
"""
Convert TIF raster files to Cloud Optimized GeoTIFF (COG) format
for faster web loading and display.
"""

import os
import subprocess
import sys
from pathlib import Path

def convert_tif_to_cog(input_path, output_path, compression='DEFLATE'):
    """Convert a single TIF file to COG format."""
    
    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # GDAL translate command for COG conversion
    cmd = [
        'gdal_translate',
        '-of', 'COG',
        '-co', f'COMPRESS={compression}',
        '-co', 'TILED=YES',
        '-co', 'BLOCKSIZE=512',
        '-co', 'BIGTIFF=IF_SAFER',
        '-co', 'OVERVIEW_RESAMPLING=NEAREST',
        str(input_path),
        str(output_path)
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        print(f"✓ Converted: {input_path.name} -> {output_path.name}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to convert {input_path.name}: {e.stderr}")
        return False

def batch_convert_directory(input_dir, output_dir):
    """Convert all TIF files in a directory structure to COG."""
    
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    
    if not input_path.exists():
        print(f"Error: Input directory {input_dir} does not exist")
        return
    
    # Find all TIF files
    tif_files = list(input_path.rglob('*.tif')) + list(input_path.rglob('*.TIF'))
    
    if not tif_files:
        print("No TIF files found in the input directory")
        return
    
    print(f"Found {len(tif_files)} TIF files to convert...")
    
    success_count = 0
    
    for tif_file in tif_files:
        # Calculate relative path and create output path
        rel_path = tif_file.relative_to(input_path)
        output_file = output_path / rel_path.with_suffix('.cog')
        
        # Skip if output file already exists and is newer
        if output_file.exists() and output_file.stat().st_mtime > tif_file.stat().st_mtime:
            print(f"⏭ Skipping {tif_file.name} (already converted)")
            continue
        
        if convert_tif_to_cog(tif_file, output_file):
            success_count += 1
    
    print(f"\nConversion complete: {success_count}/{len(tif_files)} files converted successfully")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python convert_to_cog.py <input_directory> <output_directory>")
        print("Example: python convert_to_cog.py /data/countries /data/processed")
        sys.exit(1)
    
    input_dir = sys.argv[1]
    output_dir = sys.argv[2]
    
    batch_convert_directory(input_dir, output_dir)