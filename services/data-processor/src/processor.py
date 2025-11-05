import asyncio
import logging
import json
import zipfile
import tempfile
import shutil
import os
from pathlib import Path
from typing import Dict, Any, Optional
import rasterio
import fiona
import geopandas as gpd
from rasterio.warp import calculate_default_transform, reproject, Resampling
from rasterio.crs import CRS
from rasterio.enums import Compression
import numpy as np
from shapely.geometry import shape
import redis.asyncio as redis

from .database import get_db_pool
from .geoserver import GeoServerClient

logger = logging.getLogger(__name__)

class DataProcessor:
    """Handles conversion of uploaded files to web-optimized formats."""
    
    def __init__(self):
        self.redis_client = None
        self.db_pool = None
        self.geoserver = GeoServerClient()
        
    async def initialize(self):
        """Initialize connections."""
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        self.redis_client = redis.from_url(redis_url)
        self.db_pool = await get_db_pool()
        
    async def process_uploaded_file(self, job_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process uploaded file based on its type."""
        try:
            file_path = job_data['file_path']
            file_type = job_data['file_type']
            country_code = job_data['country_code']
            metadata = job_data.get('metadata', {})
            
            await self._update_job_status(job_data['job_id'], 'processing', 0)
            
            if file_type == 'raster':
                result = await self._process_raster(file_path, country_code, metadata)
            elif file_type == 'shapefile':
                result = await self._process_shapefile(file_path, country_code, metadata)
            elif file_type == 'boundary':
                result = await self._process_boundary(file_path, country_code, metadata)
            else:
                raise ValueError(f"Unsupported file type: {file_type}")
                
            await self._update_job_status(job_data['job_id'], 'completed', 100, result)
            return result
            
        except Exception as e:
            logger.error(f"Error processing file: {e}")
            await self._update_job_status(job_data['job_id'], 'failed', 0, error=str(e))
            raise
            
    async def _process_raster(self, file_path: str, country_code: str, metadata: Dict) -> Dict[str, Any]:
        """Convert raster to Cloud Optimized GeoTIFF (COG)."""
        try:
            input_path = Path(file_path)
            output_path = input_path.parent / f"{input_path.stem}_cog.tif"
            
            logger.info(f"Converting raster to COG: {input_path}")
            
            # Read original raster and calculate statistics
            with rasterio.open(input_path) as src:
                # Get raster statistics
                data = src.read(1, masked=True)
                min_val = float(np.min(data))
                max_val = float(np.max(data))
                mean_val = float(np.mean(data))
                
                # Get spatial properties
                bounds = src.bounds
                crs = src.crs
                resolution = src.res
                
                # COG creation profile
                profile = src.profile.copy()
                profile.update({
                    'driver': 'GTiff',
                    'interleave': 'pixel',
                    'tiled': True,
                    'blockxsize': 512,
                    'blockysize': 512,
                    'compress': 'DEFLATE',
                    'predictor': 2,
                    'BIGTIFF': 'IF_SAFER'
                })
                
                # Ensure EPSG:4326 projection
                if crs != CRS.from_epsg(4326):
                    logger.info("Reprojecting to EPSG:4326")
                    transform, width, height = calculate_default_transform(
                        crs, CRS.from_epsg(4326), src.width, src.height, *bounds
                    )
                    profile.update({
                        'crs': CRS.from_epsg(4326),
                        'transform': transform,
                        'width': width,
                        'height': height
                    })
                    
                    with rasterio.open(output_path, 'w', **profile) as dst:
                        reproject(
                            source=rasterio.band(src, 1),
                            destination=rasterio.band(dst, 1),
                            src_transform=src.transform,
                            src_crs=src.crs,
                            dst_transform=transform,
                            dst_crs=CRS.from_epsg(4326),
                            resampling=Resampling.bilinear
                        )
                else:
                    # Direct copy with COG optimization
                    with rasterio.open(output_path, 'w', **profile) as dst:
                        dst.write(src.read())
                        
            # Add overviews for faster rendering
            await self._add_overviews(output_path)
            
            # Store in database
            raster_data = {
                'country_code': country_code,
                'variable_name': metadata.get('variable_name'),
                'scenario': metadata.get('scenario'),
                'time_period': metadata.get('time_period'),
                'season': metadata.get('season'),
                'file_path': str(output_path),
                'file_type': 'COG',
                'min_value': min_val,
                'max_value': max_val,
                'mean_value': mean_val,
                'classification': metadata.get('classification'),
                'style_info': metadata.get('style_info'),
                'bbox': f"POLYGON(({bounds.left} {bounds.bottom},{bounds.right} {bounds.bottom},{bounds.right} {bounds.top},{bounds.left} {bounds.top},{bounds.left} {bounds.bottom}))"
            }
            
            await self._store_raster_metadata(raster_data)
            
            # Register with GeoServer
            layer_name = f"{country_code}_{metadata.get('variable_name', 'unknown')}_{metadata.get('scenario', 'default')}"
            await self.geoserver.create_coverage_store(layer_name, str(output_path))
            
            return {
                'type': 'raster',
                'cog_path': str(output_path),
                'statistics': {'min': min_val, 'max': max_val, 'mean': mean_val},
                'geoserver_layer': layer_name
            }
            
        except Exception as e:
            logger.error(f"Error processing raster: {e}")
            raise
            
    async def _process_shapefile(self, file_path: str, country_code: str, metadata: Dict) -> Dict[str, Any]:
        """Process shapefile and convert to optimized formats."""
        try:
            # Extract if it's a zip file
            if file_path.endswith('.zip'):
                extract_dir = await self._extract_shapefile_zip(file_path)
                shp_files = list(Path(extract_dir).glob("*.shp"))
                if not shp_files:
                    raise ValueError("No .shp file found in zip archive")
                shp_path = shp_files[0]
            else:
                shp_path = Path(file_path)
                
            logger.info(f"Processing shapefile: {shp_path}")
            
            # Read shapefile with GeoPandas
            gdf = gpd.read_file(shp_path)
            
            # Ensure EPSG:4326
            if gdf.crs and gdf.crs != 'EPSG:4326':
                logger.info("Reprojecting to EPSG:4326")
                gdf = gdf.to_crs('EPSG:4326')
            
            # Get shapefile statistics
            num_features = len(gdf)
            bounds = gdf.total_bounds
            attribute_names = list(gdf.columns)
            attribute_names.remove('geometry')  # Remove geometry column
            
            # Convert to GeoJSON for web consumption
            geojson_path = shp_path.parent / f"{shp_path.stem}.geojson"
            gdf.to_file(geojson_path, driver='GeoJSON')
            
            # Store in PostGIS
            if metadata.get('infrastructure_type'):
                await self._store_energy_infrastructure(gdf, country_code, metadata)
                
            # Register with GeoServer
            layer_name = f"{country_code}_{metadata.get('infrastructure_type', 'points')}"
            await self.geoserver.create_vector_layer(layer_name, str(geojson_path))
            
            return {
                'type': 'shapefile',
                'geojson_path': str(geojson_path),
                'num_features': num_features,
                'bounds': bounds.tolist(),
                'attributes': attribute_names,
                'geoserver_layer': layer_name
            }
            
        except Exception as e:
            logger.error(f"Error processing shapefile: {e}")
            raise
            
    async def _process_boundary(self, file_path: str, country_code: str, metadata: Dict) -> Dict[str, Any]:
        """Process boundary shapefile with optimizations for fast loading."""
        try:
            # Extract if it's a zip file
            if file_path.endswith('.zip'):
                extract_dir = await self._extract_shapefile_zip(file_path)
                shp_files = list(Path(extract_dir).glob("*.shp"))
                if not shp_files:
                    raise ValueError("No .shp file found in zip archive")
                shp_path = shp_files[0]
            else:
                shp_path = Path(file_path)
                
            logger.info(f"Processing boundary shapefile: {shp_path}")
            
            # Read with GeoPandas
            gdf = gpd.read_file(shp_path)
            
            # Ensure EPSG:4326
            if gdf.crs and gdf.crs != 'EPSG:4326':
                gdf = gdf.to_crs('EPSG:4326')
                
            # Simplify geometries for faster rendering (keep originals too)
            gdf_simplified = gdf.copy()
            gdf_simplified['geometry'] = gdf_simplified['geometry'].simplify(0.001)  # ~100m tolerance
            
            # Store in PostGIS with spatial indexes
            await self._store_boundary_data(gdf, gdf_simplified, country_code, metadata)
            
            # Create vector tiles for ultra-fast loading
            tiles_dir = shp_path.parent / f"{country_code}_tiles"
            await self._create_vector_tiles(gdf_simplified, tiles_dir)
            
            return {
                'type': 'boundary',
                'country_code': country_code,
                'num_features': len(gdf),
                'bounds': gdf.total_bounds.tolist(),
                'attributes': [col for col in gdf.columns if col != 'geometry'],
                'tiles_path': str(tiles_dir)
            }
            
        except Exception as e:
            logger.error(f"Error processing boundary: {e}")
            raise
    
    async def _add_overviews(self, raster_path: str):
        """Add overview pyramids to raster for faster rendering."""
        import subprocess
        try:
            cmd = [
                'gdaladdo',
                '-r', 'average',
                '--config', 'COMPRESS_OVERVIEW', 'DEFLATE',
                '--config', 'BIGTIFF_OVERVIEW', 'IF_SAFER',
                raster_path,
                '2', '4', '8', '16', '32'
            ]
            subprocess.run(cmd, check=True, capture_output=True)
            logger.info(f"Added overviews to {raster_path}")
        except subprocess.CalledProcessError as e:
            logger.warning(f"Failed to add overviews: {e}")
    
    async def _extract_shapefile_zip(self, zip_path: str) -> str:
        """Extract shapefile from zip archive."""
        extract_dir = tempfile.mkdtemp()
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
        return extract_dir
    
    async def _store_raster_metadata(self, raster_data: Dict):
        """Store raster metadata in PostGIS."""
        async with self.db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO climate.datasets 
                (country_code, variable_name, scenario, time_period, season, 
                 file_path, file_type, min_value, max_value, mean_value, 
                 classification, style_info, bbox)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, ST_GeomFromText($13, 4326))
            """, 
                raster_data['country_code'],
                raster_data['variable_name'],
                raster_data['scenario'],
                raster_data['time_period'],
                raster_data['season'],
                raster_data['file_path'],
                raster_data['file_type'],
                raster_data['min_value'],
                raster_data['max_value'],
                raster_data['mean_value'],
                json.dumps(raster_data['classification']),
                json.dumps(raster_data['style_info']),
                raster_data['bbox']
            )
    
    async def _store_energy_infrastructure(self, gdf: gpd.GeoDataFrame, country_code: str, metadata: Dict):
        """Store energy infrastructure in PostGIS."""
        async with self.db_pool.acquire() as conn:
            for _, row in gdf.iterrows():
                geom_wkt = row.geometry.wkt
                await conn.execute("""
                    INSERT INTO energy.infrastructure 
                    (country_code, infrastructure_type, name, design_capacity, 
                     capacity_unit, geom, properties, icon_type)
                    VALUES ($1, $2, $3, $4, $5, ST_GeomFromText($6, 4326), $7, $8)
                """,
                    country_code,
                    metadata.get('infrastructure_type'),
                    row.get(metadata.get('name_field', 'name')),
                    row.get(metadata.get('capacity_field')),
                    metadata.get('capacity_unit', 'MW'),
                    geom_wkt,
                    json.dumps(row.drop('geometry').to_dict()),
                    metadata.get('icon_type', 'circle')
                )
    
    async def _store_boundary_data(self, gdf_full: gpd.GeoDataFrame, gdf_simplified: gpd.GeoDataFrame, 
                                 country_code: str, metadata: Dict):
        """Store boundary data in PostGIS with optimizations."""
        async with self.db_pool.acquire() as conn:
            # Store full resolution boundaries
            for _, row in gdf_full.iterrows():
                geom_wkt = row.geometry.wkt
                bbox_wkt = f"POLYGON(({row.geometry.bounds[0]} {row.geometry.bounds[1]},{row.geometry.bounds[2]} {row.geometry.bounds[1]},{row.geometry.bounds[2]} {row.geometry.bounds[3]},{row.geometry.bounds[0]} {row.geometry.bounds[3]},{row.geometry.bounds[0]} {row.geometry.bounds[1]}))"
                
                await conn.execute("""
                    INSERT INTO boundaries.admin_boundaries 
                    (country_code, admin_level, admin_name, geom, properties, bbox, area_km2)
                    VALUES ($1, $2, $3, ST_GeomFromText($4, 4326), $5, ST_GeomFromText($6, 4326), $7)
                """,
                    country_code,
                    metadata.get('admin_level', 1),
                    row.get(metadata.get('name_field', 'NAME')),
                    geom_wkt,
                    json.dumps(row.drop('geometry').to_dict()),
                    bbox_wkt,
                    row.geometry.area * 111000 * 111000  # Rough conversion to km²
                )
    
    async def _create_vector_tiles(self, gdf: gpd.GeoDataFrame, output_dir: Path):
        """Create vector tiles for ultra-fast boundary loading."""
        # This is a simplified version - in production, use tippecanoe or similar
        output_dir.mkdir(exist_ok=True)
        
        # For now, just save as simplified GeoJSON
        # In production, implement proper vector tile generation
        gdf.to_file(output_dir / "boundaries.geojson", driver='GeoJSON')
        
    async def _update_job_status(self, job_id: str, status: str, progress: int, 
                               result: Optional[Dict] = None, error: Optional[str] = None):
        """Update job status in database and Redis."""
        async with self.db_pool.acquire() as conn:
            if status == 'completed':
                await conn.execute("""
                    UPDATE metadata.processing_jobs 
                    SET status = $1, progress = $2, result_data = $3, completed_at = CURRENT_TIMESTAMP
                    WHERE id = $4
                """, status, progress, json.dumps(result) if result else None, job_id)
            elif status == 'failed':
                await conn.execute("""
                    UPDATE metadata.processing_jobs 
                    SET status = $1, progress = $2, error_message = $3
                    WHERE id = $4
                """, status, progress, error, job_id)
            else:
                await conn.execute("""
                    UPDATE metadata.processing_jobs 
                    SET status = $1, progress = $2, started_at = CURRENT_TIMESTAMP
                    WHERE id = $4
                """, status, progress, job_id)
        
        # Notify via Redis for real-time updates
        await self.redis_client.publish(f"job_updates:{job_id}", json.dumps({
            'job_id': job_id,
            'status': status,
            'progress': progress,
            'result': result,
            'error': error
        }))