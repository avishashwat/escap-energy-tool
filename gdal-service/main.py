from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import tempfile
import shutil
import subprocess
import json
import psycopg2
import redis
import requests
from typing import Optional, Dict, Any
import rasterio
import numpy as np
from rasterio.enums import Resampling
import geopandas as gpd
from shapely.geometry import box
import zipfile
from pathlib import Path
import aiofiles
import asyncio
from datetime import datetime

app = FastAPI(title="UN ESCAP Geospatial Processing Service")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
GEOSERVER_URL = os.getenv("GEOSERVER_URL", "http://geoserver:8080/geoserver")
GEOSERVER_USER = os.getenv("GEOSERVER_USER", "admin")
GEOSERVER_PASSWORD = os.getenv("GEOSERVER_PASSWORD", "geoserver123")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "postgis")
POSTGRES_DB = os.getenv("POSTGRES_DB", "un_escap_geospatial")
POSTGRES_USER = os.getenv("POSTGRES_USER", "geouser")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "geopass123")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")

# Initialize connections
redis_client = redis.from_url(REDIS_URL)

def get_postgres_connection():
    """Get PostgreSQL connection"""
    return psycopg2.connect(
        host=POSTGRES_HOST,
        database=POSTGRES_DB,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD
    )

async def setup_database():
    """Initialize database tables"""
    try:
        conn = get_postgres_connection()
        cursor = conn.cursor()
        
        # Create metadata table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS spatial_metadata (
                id SERIAL PRIMARY KEY,
                country VARCHAR(50),
                data_type VARCHAR(50),
                layer_name VARCHAR(255),
                file_path TEXT,
                geoserver_layer VARCHAR(255),
                metadata JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Create spatial index
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_spatial_metadata_country 
            ON spatial_metadata(country);
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_spatial_metadata_type 
            ON spatial_metadata(data_type);
        """)
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print("Database initialized successfully")
    except Exception as e:
        print(f"Database initialization error: {e}")

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    await setup_database()
    print("GDAL Processing Service started successfully")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test PostgreSQL connection
        conn = get_postgres_connection()
        conn.close()
        
        # Test Redis connection
        redis_client.ping()
        
        # Test GeoServer connection
        response = requests.get(f"{GEOSERVER_URL}/rest/about/version", 
                              auth=(GEOSERVER_USER, GEOSERVER_PASSWORD), 
                              timeout=5)
        
        return {
            "status": "healthy",
            "postgresql": "connected",
            "redis": "connected", 
            "geoserver": "connected" if response.status_code == 200 else "disconnected",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

def convert_to_cog(input_path: str, output_path: str, compression: str = "DEFLATE") -> bool:
    """Convert raster to Cloud Optimized GeoTIFF"""
    try:
        cmd = [
            "gdal_translate",
            "-of", "COG",
            "-co", f"COMPRESS={compression}",
            "-co", "TILED=YES",
            "-co", "COPY_SRC_OVERVIEWS=YES",
            "-co", "BLOCKSIZE=512",
            input_path,
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"COG conversion failed: {result.stderr}")
            return False
            
        print(f"Successfully converted to COG: {output_path}")
        return True
        
    except Exception as e:
        print(f"COG conversion error: {e}")
        return False

def get_raster_stats(file_path: str) -> Dict[str, Any]:
    """Get raster statistics using rasterio with proper NoData handling"""
    try:
        with rasterio.open(file_path) as src:
            # Read the first band
            band_data = src.read(1)
            
            # Use rasterio's masked array functionality for better NoData handling
            masked_data = src.read(1, masked=True)
            
            print(f"Raster NoData value: {src.nodata}")
            print(f"Masked array type: {type(masked_data)}")
            print(f"Has compressed method: {hasattr(masked_data, 'compressed')}")
            
            # Convert masked array to regular array excluding NoData
            if hasattr(masked_data, 'compressed'):
                # Get only valid (non-masked) data
                valid_data = masked_data.compressed()
                print(f"Valid data extracted via compressed(): {len(valid_data)} pixels")
            else:
                # Fallback: manual NoData filtering
                valid_data = band_data.flatten()
                
                # Common NoData values to exclude
                nodata_values = [
                    src.nodata,
                    -9999, -32768, -3.4028235e+38, 3.4028235e+38,  # Common NoData values
                    np.nan, float('inf'), float('-inf')  # Invalid numeric values
                ]
                
                # Filter out NoData values
                for nodata_val in nodata_values:
                    if nodata_val is not None:
                        if np.isnan(nodata_val):
                            valid_data = valid_data[~np.isnan(valid_data)]
                        else:
                            # Use tolerance for floating point comparison
                            tolerance = abs(nodata_val) * 1e-10 if nodata_val != 0 else 1e-10
                            valid_data = valid_data[np.abs(valid_data - nodata_val) > tolerance]
            
            # Explicit NaN removal (critical for NaN NoData values)
            nan_count_before = np.sum(np.isnan(valid_data))
            valid_data = valid_data[~np.isnan(valid_data)]
            nan_count_after = np.sum(np.isnan(valid_data))
            print(f"NaN filtering: {nan_count_before} NaN values removed, {nan_count_after} remaining")
            
            # Remove infinite values as final cleanup
            inf_count_before = np.sum(~np.isfinite(valid_data))
            valid_data = valid_data[np.isfinite(valid_data)]
            inf_count_after = np.sum(~np.isfinite(valid_data))
            print(f"Infinite filtering: {inf_count_before} infinite values removed, {inf_count_after} remaining")
            
            # Additional filtering for extremely large/small values that might be NoData
            if len(valid_data) > 0:
                # Remove values that are unreasonably extreme (likely NoData)
                q1, q99 = np.percentile(valid_data, [1, 99])
                value_range = q99 - q1
                
                # If we have extreme outliers (>1000x the normal range), filter them
                if value_range > 0:
                    threshold = value_range * 1000
                    median_val = np.median(valid_data)
                    valid_data = valid_data[np.abs(valid_data - median_val) <= threshold]
            
            if len(valid_data) == 0:
                print(f"Warning: No valid pixel values found in {file_path}")
                return {
                    "min_value": 0,
                    "max_value": 100,
                    "mean_value": 50,
                    "nodata_value": src.nodata,
                    "crs": str(src.crs),
                    "bounds": list(src.bounds),
                    "width": src.width,
                    "height": src.height,
                    "valid_pixels": 0,
                    "total_pixels": band_data.size
                }
            
            # Calculate statistics
            min_val = float(np.min(valid_data))
            max_val = float(np.max(valid_data))
            mean_val = float(np.mean(valid_data))
            
            print(f"Raster stats for {file_path}: min={min_val}, max={max_val}, mean={mean_val:.2f}, valid_pixels={len(valid_data)}/{band_data.size}")
            
            return {
                "min_value": min_val,
                "max_value": max_val,
                "mean_value": mean_val,
                "std_value": float(np.std(valid_data)),
                "nodata_value": src.nodata,
                "crs": str(src.crs),
                "bounds": list(src.bounds),
                "width": src.width,
                "height": src.height,
                "valid_pixels": len(valid_data),
                "total_pixels": band_data.size
            }
            
    except Exception as e:
        print(f"Error getting raster stats: {e}")
        return {
            "min_value": 0,
            "max_value": 100,
            "mean_value": 50,
            "error": str(e)
        }

def get_shapefile_info(shp_path: str) -> Dict[str, Any]:
    """Get shapefile information using geopandas"""
    try:
        gdf = gpd.read_file(shp_path)
        
        return {
            "num_features": len(gdf),
            "bounds": list(gdf.total_bounds),
            "crs": str(gdf.crs),
            "attributes": list(gdf.columns),
            "geometry_type": str(gdf.geometry.geom_type.iloc[0]) if len(gdf) > 0 else "Unknown"
        }
        
    except Exception as e:
        print(f"Error getting shapefile info: {e}")
        return {
            "num_features": 0,
            "bounds": [0, 0, 0, 0],
            "attributes": [],
            "error": str(e)
        }

async def publish_to_geoserver(file_path: str, layer_name: str, workspace: str = "un_escap") -> bool:
    """Publish layer to GeoServer"""
    try:
        # Create workspace if it doesn't exist
        workspace_url = f"{GEOSERVER_URL}/rest/workspaces/{workspace}"
        workspace_data = f'<workspace><name>{workspace}</name></workspace>'
        
        requests.post(
            f"{GEOSERVER_URL}/rest/workspaces",
            data=workspace_data,
            headers={"Content-Type": "text/xml"},
            auth=(GEOSERVER_USER, GEOSERVER_PASSWORD)
        )
        
        # Determine if it's a raster or vector
        file_extension = Path(file_path).suffix.lower()
        
        if file_extension in ['.tif', '.tiff']:
            # Publish raster (COG)
            store_name = f"{layer_name}_store"
            
            # Create coverage store
            store_data = f"""
            <coverageStore>
                <name>{store_name}</name>
                <workspace>{workspace}</workspace>
                <enabled>true</enabled>
                <type>GeoTIFF</type>
                <url>file:{file_path}</url>
            </coverageStore>
            """
            
            store_response = requests.post(
                f"{GEOSERVER_URL}/rest/workspaces/{workspace}/coveragestores",
                data=store_data,
                headers={"Content-Type": "text/xml"},
                auth=(GEOSERVER_USER, GEOSERVER_PASSWORD)
            )
            
            if store_response.status_code in [200, 201]:
                # Create coverage
                coverage_data = f"""
                <coverage>
                    <name>{layer_name}</name>
                    <title>{layer_name}</title>
                    <enabled>true</enabled>
                </coverage>
                """
                
                coverage_response = requests.post(
                    f"{GEOSERVER_URL}/rest/workspaces/{workspace}/coveragestores/{store_name}/coverages",
                    data=coverage_data,
                    headers={"Content-Type": "text/xml"},
                    auth=(GEOSERVER_USER, GEOSERVER_PASSWORD)
                )
                
                return coverage_response.status_code in [200, 201]
        
        elif file_extension == '.shp':
            # Publish vector data
            store_name = f"{layer_name}_store"
            
            # Create datastore
            store_data = f"""
            <dataStore>
                <name>{store_name}</name>
                <workspace>{workspace}</workspace>
                <enabled>true</enabled>
                <connectionParameters>
                    <url>file:{file_path}</url>
                </connectionParameters>
            </dataStore>
            """
            
            store_response = requests.post(
                f"{GEOSERVER_URL}/rest/workspaces/{workspace}/datastores",
                data=store_data,
                headers={"Content-Type": "text/xml"},
                auth=(GEOSERVER_USER, GEOSERVER_PASSWORD)
            )
            
            return store_response.status_code in [200, 201]
        
        return False
        
    except Exception as e:
        print(f"GeoServer publishing error: {e}")
        return False

@app.post("/process-raster")
async def process_raster(
    file: UploadFile = File(...),
    country: str = Form(...),
    data_type: str = Form(...),
    layer_name: str = Form(...),
    metadata: str = Form("{}")
):
    """Process and convert raster to COG"""
    temp_dir = None
    try:
        # Create temporary directory
        temp_dir = tempfile.mkdtemp()
        
        # Save uploaded file
        input_path = os.path.join(temp_dir, file.filename)
        async with aiofiles.open(input_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # Get raster statistics
        stats = get_raster_stats(input_path)
        
        # Convert to COG
        cog_filename = f"{layer_name}_cog.tif"
        cog_path = os.path.join("/app/processed", cog_filename)
        
        # Ensure output directory exists
        os.makedirs("/app/processed", exist_ok=True)
        
        success = convert_to_cog(input_path, cog_path)
        
        if not success:
            raise HTTPException(status_code=500, detail="COG conversion failed")
        
        # Publish to GeoServer
        geoserver_success = await publish_to_geoserver(cog_path, layer_name)
        
        # Store metadata in database
        try:
            conn = get_postgres_connection()
            cursor = conn.cursor()
            
            metadata_dict = json.loads(metadata)
            metadata_dict.update(stats)
            
            cursor.execute("""
                INSERT INTO spatial_metadata 
                (country, data_type, layer_name, file_path, geoserver_layer, metadata)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                country, data_type, layer_name, cog_path, 
                f"un_escap:{layer_name}" if geoserver_success else None,
                json.dumps(metadata_dict)
            ))
            
            conn.commit()
            cursor.close()
            conn.close()
            
        except Exception as e:
            print(f"Database error: {e}")
        
        # Cache statistics for quick access
        cache_key = f"raster_stats:{country}:{data_type}:{layer_name}"
        redis_client.setex(cache_key, 3600, json.dumps(stats))
        
        return {
            "success": True,
            "message": "Raster processed successfully",
            "cog_path": cog_path,
            "statistics": stats,
            "geoserver_published": geoserver_success,
            "layer_url": f"{GEOSERVER_URL}/un_escap/wms" if geoserver_success else None
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
    
    finally:
        # Cleanup
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

@app.post("/process-shapefile")
async def process_shapefile(
    file: UploadFile = File(...),
    country: str = Form(...),
    data_type: str = Form(...),
    layer_name: str = Form(...),
    metadata: str = Form("{}")
):
    """Process shapefile and publish to GeoServer"""
    temp_dir = None
    try:
        # Create temporary directory
        temp_dir = tempfile.mkdtemp()
        
        # Save and extract zip file
        zip_path = os.path.join(temp_dir, file.filename)
        async with aiofiles.open(zip_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # Extract zip file
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
        
        # Find .shp file
        shp_files = [f for f in os.listdir(temp_dir) if f.endswith('.shp')]
        if not shp_files:
            raise HTTPException(status_code=400, detail="No .shp file found in upload")
        
        shp_path = os.path.join(temp_dir, shp_files[0])
        
        # Get shapefile info
        info = get_shapefile_info(shp_path)
        
        # Copy to permanent location
        output_dir = f"/app/processed/{country}/{data_type}"
        os.makedirs(output_dir, exist_ok=True)
        
        # Copy all shapefile components
        base_name = Path(shp_files[0]).stem
        for ext in ['.shp', '.shx', '.dbf', '.prj', '.cpg']:
            src_file = os.path.join(temp_dir, f"{base_name}{ext}")
            if os.path.exists(src_file):
                dst_file = os.path.join(output_dir, f"{layer_name}{ext}")
                shutil.copy2(src_file, dst_file)
        
        final_shp_path = os.path.join(output_dir, f"{layer_name}.shp")
        
        # Publish to GeoServer
        geoserver_success = await publish_to_geoserver(final_shp_path, layer_name)
        
        # Store metadata in database
        try:
            conn = get_postgres_connection()
            cursor = conn.cursor()
            
            metadata_dict = json.loads(metadata)
            metadata_dict.update(info)
            
            cursor.execute("""
                INSERT INTO spatial_metadata 
                (country, data_type, layer_name, file_path, geoserver_layer, metadata)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                country, data_type, layer_name, final_shp_path,
                f"un_escap:{layer_name}" if geoserver_success else None,
                json.dumps(metadata_dict)
            ))
            
            conn.commit()
            cursor.close()
            conn.close()
            
        except Exception as e:
            print(f"Database error: {e}")
        
        return {
            "success": True,
            "message": "Shapefile processed successfully",
            "shapefile_path": final_shp_path,
            "info": info,
            "geoserver_published": geoserver_success,
            "layer_url": f"{GEOSERVER_URL}/un_escap/wms" if geoserver_success else None
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
    
    finally:
        # Cleanup
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

@app.post("/analyze-raster")
async def analyze_raster_for_classification(
    file: UploadFile = File(...),
):
    """Analyze raster file specifically for classification purposes with proper NoData handling"""
    temp_dir = None
    try:
        # Create temporary directory
        temp_dir = tempfile.mkdtemp()
        
        # Save uploaded file
        input_path = os.path.join(temp_dir, file.filename)
        async with aiofiles.open(input_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # Get detailed raster statistics with proper NoData handling
        stats = get_raster_stats(input_path)
        
        # Generate classification breaks (equal interval method)
        num_classes = 5
        if stats["min_value"] != stats["max_value"]:
            class_range = stats["max_value"] - stats["min_value"]
            class_size = class_range / num_classes
            
            breaks = []
            for i in range(num_classes):
                if i == 0:
                    # First class starts at minimum
                    min_val = stats["min_value"]
                    max_val = stats["min_value"] + class_size
                elif i == num_classes - 1:
                    # Last class ends at maximum
                    min_val = stats["min_value"] + (class_size * i)
                    max_val = stats["max_value"]
                else:
                    min_val = stats["min_value"] + (class_size * i)
                    max_val = stats["min_value"] + (class_size * (i + 1))
                
                breaks.append({
                    "min": round(min_val, 6),
                    "max": round(max_val, 6),
                    "label": f"{round(min_val, 2)} - {round(max_val, 2)}"
                })
        else:
            # Handle case where min equals max
            breaks = [{
                "min": stats["min_value"],
                "max": stats["max_value"],
                "label": f"{stats['min_value']}"
            }]
        
        return {
            "success": True,
            "filename": file.filename,
            "statistics": stats,
            "classification_breaks": breaks,
            "data_quality": {
                "valid_pixel_percentage": (stats["valid_pixels"] / stats["total_pixels"]) * 100 if stats["total_pixels"] > 0 else 0,
                "has_nodata": stats["nodata_value"] is not None,
                "nodata_value": stats["nodata_value"]
            }
        }
        
    except Exception as e:
        print(f"Raster analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Raster analysis failed: {str(e)}")
    
    finally:
        # Cleanup
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

@app.get("/layers/{country}")
async def get_country_layers(country: str):
    """Get all layers for a specific country"""
    try:
        conn = get_postgres_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT data_type, layer_name, geoserver_layer, metadata, created_at
            FROM spatial_metadata 
            WHERE country = %s 
            ORDER BY created_at DESC
        """, (country,))
        
        results = cursor.fetchall()
        cursor.close()
        conn.close()
        
        layers = []
        for row in results:
            layers.append({
                "data_type": row[0],
                "layer_name": row[1],
                "geoserver_layer": row[2],
                "metadata": row[3],
                "created_at": row[4].isoformat()
            })
        
        return {"country": country, "layers": layers}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get layers: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5001)