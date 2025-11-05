import asyncio
import aiofiles
import os
import tempfile
import shutil
import zipfile
import json
from pathlib import Path
from typing import Dict, Any, Optional
# import structlog
import logging
import rasterio
import numpy as np
import geopandas as gpd
import fiona
from rasterio.crs import CRS
from rasterio.warp import calculate_default_transform, reproject, Resampling
from osgeo import gdal, osr
import httpx

logger = logging.getLogger(__name__)

class FileProcessor:
    """High-performance geospatial file processing with COG conversion"""
    
    def __init__(self):
        self.upload_dir = Path("/app/uploads")
        self.cog_dir = Path("/app/cog")
        self.processed_dir = Path("/app/processed")
        
        # Create directories
        self.upload_dir.mkdir(exist_ok=True)
        self.cog_dir.mkdir(exist_ok=True)
        self.processed_dir.mkdir(exist_ok=True)
        
        # Configure GDAL for optimal performance
        gdal.SetConfigOption('GDAL_CACHEMAX', '512')
        gdal.SetConfigOption('GDAL_NUM_THREADS', 'ALL_CPUS')
        gdal.SetConfigOption('GDAL_DISABLE_READDIR_ON_OPEN', 'EMPTY_DIR')
        
        # GDAL service configuration
        self.gdal_service_url = "http://gdal-service:8082"
    
    async def process_climate_raster(
        self,
        file,
        country: str,
        variable: str,
        scenario: str,
        year_range: Optional[str] = None,
        season: Optional[str] = None,
        classification: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Process climate raster file with COG conversion"""
        
        logger.info("Processing climate raster", 
                   country=country, variable=variable, scenario=scenario)
        
        # Create unique filename
        season_part = f"_{season}" if season else ""
        year_part = f"_{year_range}" if year_range else ""
        filename = f"{country}_{variable}_{scenario}{year_part}{season_part}.tif"
        
        # Save uploaded file
        temp_path = self.upload_dir / f"temp_{filename}"
        async with aiofiles.open(temp_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        try:
            # Convert to COG
            cog_path = await self._convert_to_cog(temp_path, filename)
            
            # Extract statistics
            statistics = await self._extract_raster_statistics(cog_path)
            
            # Create styled COG if classification provided
            if classification:
                styled_cog_path = await self._create_styled_cog(cog_path, classification)
                cog_path = styled_cog_path
            
            logger.info("Climate raster processed successfully", 
                       file=filename, statistics=statistics)
            
            return {
                "cog_path": str(cog_path),
                "statistics": statistics,
                "classification": classification
            }
            
        finally:
            # Clean up temp file
            if temp_path.exists():
                temp_path.unlink()
    
    async def process_giri_raster(
        self,
        file,
        country: str,
        variable: str,
        scenario: str,
        classification: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Process GIRI hazard raster file"""
        
        logger.info("Processing GIRI raster", 
                   country=country, variable=variable, scenario=scenario)
        
        filename = f"{country}_{variable}_{scenario}_giri.tif"
        
        # Save uploaded file
        temp_path = self.upload_dir / f"temp_{filename}"
        async with aiofiles.open(temp_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        try:
            # Convert to COG
            cog_path = await self._convert_to_cog(temp_path, filename)
            
            # Extract statistics
            statistics = await self._extract_raster_statistics(cog_path)
            
            # Create styled COG if classification provided
            if classification:
                styled_cog_path = await self._create_styled_cog(cog_path, classification)
                cog_path = styled_cog_path
            
            logger.info("GIRI raster processed successfully", 
                       file=filename, statistics=statistics)
            
            return {
                "cog_path": str(cog_path),
                "statistics": statistics,
                "classification": classification
            }
            
        finally:
            # Clean up temp file
            if temp_path.exists():
                temp_path.unlink()
    
    async def process_energy_shapefile(
        self,
        file,
        country: str,
        infrastructure_type: str,
        capacity_attribute: str,
        icon = None
    ) -> Dict[str, Any]:
        """Process energy infrastructure shapefile"""
        
        logger.info("Processing energy shapefile", 
                   country=country, infrastructure_type=infrastructure_type)
        
        filename = f"{country}_{infrastructure_type}_energy"
        
        # Save uploaded zip file
        temp_zip_path = self.upload_dir / f"temp_{filename}.zip"
        async with aiofiles.open(temp_zip_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        try:
            # Extract shapefile
            extract_dir = self.upload_dir / f"temp_{filename}_extract"
            extract_dir.mkdir(exist_ok=True)
            
            with zipfile.ZipFile(temp_zip_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
            
            # Find .shp file
            shp_files = list(extract_dir.glob("*.shp"))
            if not shp_files:
                raise ValueError("No .shp file found in uploaded zip")
            
            shp_path = shp_files[0]
            
            # Convert to GeoJSON
            geojson_path = await self._convert_shapefile_to_geojson(
                shp_path, filename, capacity_attribute
            )
            
            # Process icon if provided
            icon_path = None
            if icon:
                icon_path = await self._save_icon(icon, filename)
            
            # Extract feature information
            gdf = gpd.read_file(shp_path)
            feature_count = len(gdf)
            bounds = gdf.total_bounds.tolist()
            
            logger.info("Energy shapefile processed successfully", 
                       file=filename, feature_count=feature_count)
            
            return {
                "geojson_path": str(geojson_path),
                "feature_count": feature_count,
                "bounds": bounds,
                "icon_path": icon_path
            }
            
        finally:
            # Clean up temp files
            if temp_zip_path.exists():
                temp_zip_path.unlink()
            if 'extract_dir' in locals() and extract_dir.exists():
                shutil.rmtree(extract_dir)
    
    async def process_boundary_shapefile(
        self,
        file,
        country: str,
        hover_attribute: str
    ) -> Dict[str, Any]:
        """Process country boundary shapefile"""
        
        logger.info("Processing boundary shapefile", country=country)
        
        filename = f"{country}_boundary"
        
        # Save uploaded zip file
        temp_zip_path = self.upload_dir / f"temp_{filename}.zip"
        async with aiofiles.open(temp_zip_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        try:
            # Extract shapefile
            extract_dir = self.upload_dir / f"temp_{filename}_extract"
            extract_dir.mkdir(exist_ok=True)
            
            with zipfile.ZipFile(temp_zip_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
            
            # Find .shp file
            shp_files = list(extract_dir.glob("*.shp"))
            if not shp_files:
                raise ValueError("No .shp file found in uploaded zip")
            
            shp_path = shp_files[0]
            
            # Convert to GeoJSON
            geojson_path = await self._convert_boundary_to_geojson(
                shp_path, filename, hover_attribute
            )
            
            # Extract boundary information
            gdf = gpd.read_file(shp_path)
            feature_count = len(gdf)
            bounds = gdf.total_bounds.tolist()
            
            logger.info("Boundary shapefile processed successfully", 
                       file=filename, feature_count=feature_count)
            
            return {
                "geojson_path": str(geojson_path),
                "feature_count": feature_count,
                "bounds": bounds,
                "attributes": list(gdf.columns)
            }
            
        finally:
            # Clean up temp files
            if temp_zip_path.exists():
                temp_zip_path.unlink()
            if 'extract_dir' in locals() and extract_dir.exists():
                shutil.rmtree(extract_dir)
    
    async def _convert_to_cog(self, input_path: Path, filename: str) -> Path:
        """Convert raster to Cloud Optimized GeoTIFF"""
        
        cog_path = self.cog_dir / filename
        
        # Use GDAL to create COG with optimal settings
        translate_options = gdal.TranslateOptions(
            format='COG',
            creationOptions=[
                'COMPRESS=DEFLATE',
                'PREDICTOR=2',
                'ZLEVEL=6',
                'BLOCKSIZE=512',
                'OVERVIEWS=AUTO',
                'OVERVIEW_RESAMPLING=BILINEAR'
            ]
        )
        
        # Run conversion in thread pool to avoid blocking
        await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: gdal.Translate(str(cog_path), str(input_path), options=translate_options)
        )
        
        logger.info("COG conversion completed", input=str(input_path), output=str(cog_path))
        return cog_path
    
    async def _extract_raster_statistics(self, raster_path: Path) -> Dict[str, float]:
        """Extract min, max, mean statistics from raster using enhanced GDAL service"""
        
        try:
            async with httpx.AsyncClient() as client:
                # Use the enhanced GDAL service for proper NoData handling
                with open(raster_path, 'rb') as f:
                    files = {'file': (raster_path.name, f, 'image/tiff')}
                    response = await client.post(
                        f"{self.gdal_service_url}/analyze-raster",
                        files=files,
                        timeout=60.0
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        logger.info(f"GDAL service statistics for {raster_path.name}: {result}")
                        return {
                            "min": result["statistics"]["min"],
                            "max": result["statistics"]["max"], 
                            "mean": result["statistics"]["mean"]
                        }
                    else:
                        logger.error(f"GDAL service error: {response.status_code} - {response.text}")
                        # Fallback to local processing with enhanced NoData handling
                        return await self._extract_raster_statistics_local(raster_path)
                        
        except Exception as e:
            logger.error(f"Error calling GDAL service: {e}")
            # Fallback to local processing with enhanced NoData handling
            return await self._extract_raster_statistics_local(raster_path)
    
    async def _extract_raster_statistics_local(self, raster_path: Path) -> Dict[str, float]:
        """Fallback local statistics extraction with enhanced NoData handling"""
        
        def extract_stats():
            with rasterio.open(raster_path) as src:
                # Use rasterio's masked array for better NoData handling
                masked_array = src.read(1, masked=True)
                
                if masked_array.mask.all():
                    # All values are NoData
                    return {"min": 0.0, "max": 0.0, "mean": 0.0}
                
                # Filter common NoData values that might not be in metadata
                common_nodata_values = [-9999, -32768, -3.4028235e+38, 3.4028235e+38]
                
                valid_data = masked_array.data[~masked_array.mask]
                for nodata_val in common_nodata_values:
                    if len(valid_data) > 0:
                        valid_data = valid_data[np.abs(valid_data - nodata_val) > 1e-6]
                
                if len(valid_data) == 0:
                    return {"min": 0.0, "max": 0.0, "mean": 0.0}
                
                # Remove statistical outliers (beyond 3 standard deviations)
                if len(valid_data) > 10:
                    mean = np.mean(valid_data)
                    std = np.std(valid_data)
                    outlier_mask = np.abs(valid_data - mean) <= 3 * std
                    if np.any(outlier_mask):
                        valid_data = valid_data[outlier_mask]
                
                return {
                    "min": float(np.min(valid_data)),
                    "max": float(np.max(valid_data)),
                    "mean": float(np.mean(valid_data))
                }
        
        # Run in thread pool
        return await asyncio.get_event_loop().run_in_executor(None, extract_stats)
    
    async def _create_styled_cog(self, cog_path: Path, classification: Dict[str, Any]) -> Path:
        """Create styled COG with classification colors"""
        
        styled_path = self.cog_dir / f"styled_{cog_path.name}"
        
        def create_styled():
            # Implementation for creating styled raster based on classification
            # This would involve creating a color map and applying it
            # For now, just copy the original
            shutil.copy2(cog_path, styled_path)
            return styled_path
        
        return await asyncio.get_event_loop().run_in_executor(None, create_styled)
    
    async def _convert_shapefile_to_geojson(
        self, 
        shp_path: Path, 
        filename: str, 
        capacity_attribute: str
    ) -> Path:
        """Convert shapefile to GeoJSON"""
        
        geojson_path = self.processed_dir / f"{filename}.geojson"
        
        def convert():
            gdf = gpd.read_file(shp_path)
            
            # Ensure EPSG:4326
            if gdf.crs != 'EPSG:4326':
                gdf = gdf.to_crs('EPSG:4326')
            
            # Validate capacity attribute exists
            if capacity_attribute not in gdf.columns:
                raise ValueError(f"Capacity attribute '{capacity_attribute}' not found in shapefile")
            
            gdf.to_file(geojson_path, driver='GeoJSON')
            return geojson_path
        
        return await asyncio.get_event_loop().run_in_executor(None, convert)
    
    async def _convert_boundary_to_geojson(
        self, 
        shp_path: Path, 
        filename: str, 
        hover_attribute: str
    ) -> Path:
        """Convert boundary shapefile to GeoJSON"""
        
        geojson_path = self.processed_dir / f"{filename}.geojson"
        
        def convert():
            gdf = gpd.read_file(shp_path)
            
            # Ensure EPSG:4326
            if gdf.crs != 'EPSG:4326':
                gdf = gdf.to_crs('EPSG:4326')
            
            # Validate hover attribute exists
            if hover_attribute not in gdf.columns:
                raise ValueError(f"Hover attribute '{hover_attribute}' not found in shapefile")
            
            gdf.to_file(geojson_path, driver='GeoJSON')
            return geojson_path
        
        return await asyncio.get_event_loop().run_in_executor(None, convert)
    
    async def _save_icon(self, icon_file, filename: str) -> str:
        """Save uploaded icon file"""
        
        icon_dir = self.processed_dir / "icons"
        icon_dir.mkdir(exist_ok=True)
        
        icon_path = icon_dir / f"{filename}_icon.png"
        
        async with aiofiles.open(icon_path, 'wb') as f:
            content = await icon_file.read()
            await f.write(content)
        
        return str(icon_path)