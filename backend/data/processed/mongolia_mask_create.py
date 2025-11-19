
import geopandas as gpd
from shapely.geometry import Polygon
from shapely.ops import unary_union
import sys
import os
import warnings

# Suppress GDAL warnings about missing plugins
warnings.filterwarnings('ignore', category=UserWarning)
os.environ['CPL_LOG'] = 'OFF'

try:
    # 1. Load the boundary shapefile with encoding handling
    input_shapefile = "H:/Agriculture and Energy Tool/New folder/data/uploads/extracted/mongolia_boundary/BNDA1_MNG_2002-01-01_lastupdate.shp"
    print("Loading shapefile: " + input_shapefile)
    
    # Try to read with UTF-8 encoding first, fallback to latin-1
    try:
        gdf = gpd.read_file(input_shapefile, encoding='utf-8')
    except (UnicodeDecodeError, Exception) as e:
        print("UTF-8 encoding failed, trying latin-1...")
        gdf = gpd.read_file(input_shapefile, encoding='latin-1')
    
    print(f"Loaded {len(gdf)} features")
    print(f"Original CRS: {gdf.crs}")
    
    # Clean any problematic Unicode characters in string columns
    for col in gdf.columns:
        if gdf[col].dtype == 'object':  # String columns
            try:
                gdf[col] = gdf[col].astype(str).str.replace('â', 'a', regex=False)
                gdf[col] = gdf[col].str.replace('ê', 'e', regex=False)
                gdf[col] = gdf[col].str.replace('ô', 'o', regex=False)
                gdf[col] = gdf[col].str.replace('û', 'u', regex=False)
                gdf[col] = gdf[col].str.replace('î', 'i', regex=False)
                gdf[col] = gdf[col].str.replace('ü', 'u', regex=False)
                gdf[col] = gdf[col].str.replace('ä', 'a', regex=False)
                gdf[col] = gdf[col].str.replace('ö', 'o', regex=False)
                # Remove any other non-ASCII characters
                gdf[col] = gdf[col].str.encode('ascii', errors='ignore').str.decode('ascii')
            except Exception as clean_error:
                print(f"Warning: Could not clean column {col}: {clean_error}")
    
    # Ensure we're working in EPSG:4326
    if gdf.crs != 'EPSG:4326':
        print("Converting to EPSG:4326...")
        gdf = gdf.to_crs('EPSG:4326')
    
    # 2. Dissolve to a single geometry
    print("Creating unified geometry...")
    unified_geometry = unary_union(gdf['geometry'])
    print(f"Unified geometry bounds: {unified_geometry.bounds}")
    print(f"Unified geometry is valid: {unified_geometry.is_valid}")
    
    # 3. Define a World Bounding Box in EPSG:4326
    print("Creating world bounding box...")
    world_bounding_box = Polygon([(-180, -90), (-180, 90), (180, 90), (180, -90)])
    
    # 4. Calculate the Inverse (World minus boundaries)
    print("Calculating inverse geometry...")
    inverse_polygon = world_bounding_box.difference(unified_geometry)
    print(f"Inverse geometry bounds: {inverse_polygon.bounds}")
    print(f"Inverse geometry area: {inverse_polygon.area}")
    
    # 5. Save as Shapefile
    output_shapefile = "H:/Agriculture and Energy Tool/New folder/data/processed/mongolia_mask.shp"
    print("Saving inverse mask to: " + output_shapefile)
    
    # Create a new GeoDataFrame for the inverse polygon with explicit EPSG:4326 and clean data
    inverse_gdf = gpd.GeoDataFrame(
        {'id': [1], 'name': ['inverse_mask']}, 
        geometry=[inverse_polygon], 
        crs='EPSG:4326'
    )
    
    # Ensure clean ASCII-only field names and values
    inverse_gdf['name'] = 'inverse_mask'  # Simple ASCII string
    
    # Save with explicit encoding to avoid Unicode issues
    inverse_gdf.to_file(output_shapefile, encoding='utf-8')
    
    print("SUCCESS: Inverse mask saved successfully")
    
except Exception as e:
    print("ERROR: " + str(e), file=sys.stderr)
    sys.exit(1)
