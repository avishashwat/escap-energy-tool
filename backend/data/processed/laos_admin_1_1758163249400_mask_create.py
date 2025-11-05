
import geopandas as gpd
from shapely.geometry import Polygon, MultiPolygon
from shapely.ops import unary_union
import sys
import os

try:
    # 1. Load the MultiPolygon Shapefile
    input_shapefile = "H:/Agriculture and Energy Tool/Tool/spark-template/data/uploads/extracted/laos_admin_1_1758163249400/ADM1_LAO_OCHA.shp"
    print(f"Loading shapefile: {input_shapefile}")
    gdf = gpd.read_file(input_shapefile)
    
    # 2. Dissolve to a single MultiPolygon (if needed)
    unified_multipolygon = unary_union(gdf['geometry'])
    print(f"Unified geometry type: {type(unified_multipolygon)}")
    
    # 3. Define a World Bounding Box
    # Use world extent for proper inverse mask
    world_bounding_box = Polygon([(-180, -90), (-180, 90), (180, 90), (180, -90)])
    
    # 4. Calculate the Inverse (World minus boundaries)
    inverse_polygon = world_bounding_box.difference(unified_multipolygon)
    print(f"Inverse geometry type: {type(inverse_polygon)}")
    
    # 5. Save as Shapefile
    output_shapefile = "H:/Agriculture and Energy Tool/Tool/spark-template/backend/data/processed/laos_admin_1_1758163249400_mask.shp"
    print(f"Saving inverse mask to: {output_shapefile}")
    
    # Create a new GeoDataFrame for the inverse polygon
    inverse_gdf = gpd.GeoDataFrame(geometry=[inverse_polygon], crs=gdf.crs)
    inverse_gdf['id'] = 1
    inverse_gdf['name'] = 'inverse_mask'
    inverse_gdf.to_file(output_shapefile)
    
    print(f"✅ Inverse mask saved successfully to {output_shapefile}")
    
except Exception as e:
    print(f"❌ Error creating inverse mask: {str(e)}", file=sys.stderr)
    sys.exit(1)
