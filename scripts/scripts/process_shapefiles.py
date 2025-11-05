#!/usr/bin/env python3
"""
Process shapefiles to extract boundaries and prepare for web use.
"""

import geopandas as gpd
import json
from pathlib import Path
import sys

def process_boundary_shapefile(shapefile_path, output_dir):
    """Process boundary shapefile to extract bounds and GeoJSON."""
    
    try:
        # Read shapefile
        gdf = gpd.read_file(shapefile_path)
        
        # Ensure it's in WGS84 (EPSG:4326)
        if gdf.crs != 'EPSG:4326':
            gdf = gdf.to_crs('EPSG:4326')
        
        # Calculate bounds
        bounds = gdf.total_bounds  # [minx, miny, maxx, maxy]
        
        # Calculate center
        center_x = (bounds[0] + bounds[2]) / 2
        center_y = (bounds[1] + bounds[3]) / 2
        
        # Calculate appropriate zoom level based on bounds
        lat_diff = bounds[3] - bounds[1]
        lon_diff = bounds[2] - bounds[0]
        max_diff = max(lat_diff, lon_diff)
        
        # Rough zoom calculation (adjust as needed)
        if max_diff > 20:
            zoom = 3
        elif max_diff > 10:
            zoom = 4
        elif max_diff > 5:
            zoom = 5
        elif max_diff > 2:
            zoom = 6
        elif max_diff > 1:
            zoom = 7
        else:
            zoom = 8
        
        # Create output directory
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Save as GeoJSON for web use
        country_name = shapefile_path.stem.split('_')[0]
        geojson_path = output_path / f"{country_name}_boundaries.geojson"
        gdf.to_file(geojson_path, driver='GeoJSON')
        
        # Save bounds and zoom info
        bounds_info = {
            "country": country_name,
            "bounds": bounds.tolist(),
            "center": [center_x, center_y],
            "zoom": zoom,
            "extent": {
                "minx": bounds[0],
                "miny": bounds[1], 
                "maxx": bounds[2],
                "maxy": bounds[3]
            }
        }
        
        bounds_path = output_path / f"{country_name}_bounds.json"
        with open(bounds_path, 'w') as f:
            json.dump(bounds_info, f, indent=2)
        
        print(f"✓ Processed {country_name} boundaries:")
        print(f"  - Bounds: {bounds}")
        print(f"  - Center: [{center_x:.6f}, {center_y:.6f}]")
        print(f"  - Zoom: {zoom}")
        print(f"  - GeoJSON: {geojson_path}")
        print(f"  - Bounds info: {bounds_path}")
        
        return bounds_info
        
    except Exception as e:
        print(f"✗ Error processing {shapefile_path}: {e}")
        return None

def process_energy_shapefile(shapefile_path, output_dir):
    """Process energy infrastructure shapefile."""
    
    try:
        # Read shapefile
        gdf = gpd.read_file(shapefile_path)
        
        # Ensure it's in WGS84 (EPSG:4326)
        if gdf.crs != 'EPSG:4326':
            gdf = gdf.to_crs('EPSG:4326')
        
        # Check for required designCapacity field
        if 'designCapacity' not in gdf.columns:
            print(f"⚠ Warning: 'designCapacity' field not found in {shapefile_path.name}")
            # Add a default capacity field
            gdf['designCapacity'] = 1.0
        
        # Create output directory
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Save as GeoJSON
        filename = shapefile_path.stem
        geojson_path = output_path / f"{filename}.geojson"
        gdf.to_file(geojson_path, driver='GeoJSON')
        
        # Generate capacity statistics for legend
        capacity_stats = {
            "min": float(gdf['designCapacity'].min()),
            "max": float(gdf['designCapacity'].max()),
            "mean": float(gdf['designCapacity'].mean()),
            "count": len(gdf)
        }
        
        stats_path = output_path / f"{filename}_stats.json"
        with open(stats_path, 'w') as f:
            json.dump(capacity_stats, f, indent=2)
        
        print(f"✓ Processed {filename}:")
        print(f"  - Points: {len(gdf)}")
        print(f"  - Capacity range: {capacity_stats['min']:.1f} - {capacity_stats['max']:.1f}")
        print(f"  - GeoJSON: {geojson_path}")
        
        return capacity_stats
        
    except Exception as e:
        print(f"✗ Error processing {shapefile_path}: {e}")
        return None

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python process_shapefiles.py <input_directory> <output_directory>")
        print("Example: python process_shapefiles.py /data/countries /data/processed")
        sys.exit(1)
    
    input_dir = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    
    # Process all shapefiles
    shapefiles = list(input_dir.rglob('*.shp'))
    
    for shapefile in shapefiles:
        if 'boundaries' in str(shapefile) or 'adm1' in shapefile.name:
            process_boundary_shapefile(shapefile, output_dir / 'boundaries')
        elif 'energy' in str(shapefile) or any(energy_type in shapefile.name for energy_type in ['hydro', 'solar', 'wind']):
            process_energy_shapefile(shapefile, output_dir / 'energy')