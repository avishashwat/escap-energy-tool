
import geopandas as gpd
from shapely.geometry import Polygon
from shapely.ops import unary_union
import sys
import os

try:
    # 1. Load the boundary shapefile
    input_shapefile = "H:/Agriculture and Energy Tool/Tool/spark-template/data/uploads/extracted/laos_admin_1_1758182825568/ADM1_LAO_OCHA.shp"
    print("Loading shapefile: " + input_shapefile)
    gdf = gpd.read_file(input_shapefile)
    print(f"Loaded {len(gdf)} features")
    print(f"Original CRS: {gdf.crs}")
    
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
    output_shapefile = "H:/Agriculture and Energy Tool/Tool/spark-template/data/processed/laos_admin_1_1758182825568_mask.shp"
    print("Saving inverse mask to: " + output_shapefile)
    
    # Create a new GeoDataFrame for the inverse polygon with explicit EPSG:4326
    inverse_gdf = gpd.GeoDataFrame(
        {'id': [1], 'name': ['inverse_mask']}, 
        geometry=[inverse_polygon], 
        crs='EPSG:4326'
    )
    inverse_gdf.to_file(output_shapefile)
    
    print("SUCCESS: Inverse mask saved successfully")
    
except Exception as e:
    print("ERROR: " + str(e), file=sys.stderr)
    sys.exit(1)
