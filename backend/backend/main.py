from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
import os
import json
import asyncio
from typing import Optional, Dict, Any, List
import structlog
import logging
from datetime import datetime

# Configure structlog to avoid TimeStamper serialization issues
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        # Remove TimeStamper to avoid serialization issues
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

from database import get_db, engine, Base
from models import ClimateData, GiriData, EnergyData, BoundaryData
from services.file_processor import FileProcessor
from services.geoserver_manager import GeoServerManager
from services.spatial_cache import SpatialCache

# Configure structured logging - temporarily disabled
# structlog.configure(
#     processors=[
#         structlog.stdlib.filter_by_level,
#         structlog.stdlib.add_logger_name,
#         structlog.stdlib.add_log_level,
#         structlog.stdlib.PositionalArgumentsFormatter(),
#         structlog.processors.TimeStamper(fmt="iso"),
#         structlog.processors.StackInfoRenderer(),
#         structlog.processors.format_exc_info,
#         structlog.processors.UnicodeDecoder(),
#         structlog.processors.JSONRenderer()
#     ],
#     context_class=dict,
#     logger_factory=structlog.stdlib.LoggerFactory(),
#     wrapper_class=structlog.stdlib.BoundLogger,
#     cache_logger_on_first_use=True,
# )

import logging
logger = logging.getLogger(__name__)

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ESCAP Climate Risk API",
    description="High-performance geospatial data processing for climate risk visualization",
    version="2.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
file_processor = FileProcessor()
geoserver_manager = GeoServerManager()
spatial_cache = SpatialCache()

@app.on_event("startup")
async def startup_event():
    """Initialize services and connections on startup"""
    logger.info("Starting ESCAP Climate Risk API")
    
    # Initialize spatial cache first (doesn't depend on other services)
    try:
        await spatial_cache.initialize()
        logger.info("Spatial cache initialized successfully")
    except Exception as e:
        logger.warning("Failed to initialize spatial cache", error=str(e))
    
    # Initialize GeoServer workspace (retry logic handled internally)
    # Use asyncio task to prevent blocking startup if GeoServer takes time
    async def init_geoserver_later():
        await asyncio.sleep(5)  # Give GeoServer time to start
        try:
            await geoserver_manager.initialize()
            logger.info("GeoServer initialized successfully")
        except Exception as e:
            logger.error("Failed to initialize GeoServer", error=str(e))
    
    # Start GeoServer initialization in background
    asyncio.create_task(init_geoserver_later())
    
    logger.info("API startup completed")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down ESCAP Climate Risk API")
    await spatial_cache.cleanup()

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ESCAP Climate Risk API",
        "version": "2.0.0",
        "features": [
            "PostGIS spatial database",
            "GeoServer WMS/WFS services", 
            "Automatic COG conversion",
            "Vector tile optimization",
            "Spatial caching"
        ]
    }

@app.get("/api/test")
async def test_endpoint():
    """Test endpoint"""
    return {"test": "ok"}

@app.get("/api/health")
async def health_check():
    """Detailed health check"""
    return {"status": "healthy"}

@app.post("/api/upload/climate")
async def upload_climate_data(
    file: UploadFile = File(...),
    country: str = Form(...),
    variable: str = Form(...),
    scenario: str = Form(...),
    year_range: Optional[str] = Form(None),
    season: Optional[str] = Form(None),
    classification: str = Form(...),
    db: Session = Depends(get_db)
):
    """Upload and process climate raster data with automatic COG conversion"""
    logger.info("Processing climate data upload", 
                country=country, variable=variable, scenario=scenario)
    
    try:
        # Process the file
        result = await file_processor.process_climate_raster(
            file=file,
            country=country,
            variable=variable,
            scenario=scenario,
            year_range=year_range,
            season=season,
            classification=json.loads(classification)
        )
        
        # Store in database
        climate_data = ClimateData(
            country=country,
            variable=variable,
            scenario=scenario,
            year_range=year_range,
            season=season,
            file_path=result["cog_path"],
            min_value=result["statistics"]["min"],
            max_value=result["statistics"]["max"],
            mean_value=result["statistics"]["mean"],
            classification=json.loads(classification)
        )
        
        db.merge(climate_data)
        db.commit()
        
        # Publish to GeoServer
        layer_name = await geoserver_manager.publish_raster(
            name=f"{country}_{variable}_{scenario}",
            file_path=result["cog_path"],
            classification=json.loads(classification)
        )
        
        # Cache the result
        await spatial_cache.cache_layer_info(layer_name, result)
        
        logger.info("Climate data processed successfully", layer_name=layer_name)
        
        return {
            "success": True,
            "layer_name": layer_name,
            "statistics": result["statistics"],
            "message": "Climate data uploaded and processed successfully"
        }
        
    except Exception as e:
        logger.error("Failed to process climate data", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to process climate data: {str(e)}")

@app.post("/api/upload/giri")
async def upload_giri_data(
    file: UploadFile = File(...),
    country: str = Form(...),
    variable: str = Form(...),
    scenario: str = Form(...),
    classification: str = Form(...),
    db: Session = Depends(get_db)
):
    """Upload and process GIRI hazard raster data"""
    logger.info("Processing GIRI data upload", 
                country=country, variable=variable, scenario=scenario)
    
    try:
        # Process the file
        result = await file_processor.process_giri_raster(
            file=file,
            country=country,
            variable=variable,
            scenario=scenario,
            classification=json.loads(classification)
        )
        
        # Store in database
        giri_data = GiriData(
            country=country,
            variable=variable,
            scenario=scenario,
            file_path=result["cog_path"],
            min_value=result["statistics"]["min"],
            max_value=result["statistics"]["max"],
            mean_value=result["statistics"]["mean"],
            classification=json.loads(classification)
        )
        
        db.merge(giri_data)
        db.commit()
        
        # Publish to GeoServer
        layer_name = await geoserver_manager.publish_raster(
            name=f"{country}_{variable}_{scenario}_giri",
            file_path=result["cog_path"],
            classification=json.loads(classification)
        )
        
        # Cache the result
        await spatial_cache.cache_layer_info(layer_name, result)
        
        logger.info("GIRI data processed successfully", layer_name=layer_name)
        
        return {
            "success": True,
            "layer_name": layer_name,
            "statistics": result["statistics"],
            "message": "GIRI data uploaded and processed successfully"
        }
        
    except Exception as e:
        logger.error("Failed to process GIRI data", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to process GIRI data: {str(e)}")

@app.post("/api/upload/energy")
async def upload_energy_data(
    file: UploadFile = File(...),
    country: str = Form(...),
    infrastructure_type: str = Form(...),
    capacity_attribute: str = Form(...),
    icon: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """Upload and process energy infrastructure point data"""
    logger.info("Processing energy data upload", 
                country=country, infrastructure_type=infrastructure_type)
    
    try:
        # Process the file
        result = await file_processor.process_energy_shapefile(
            file=file,
            country=country,
            infrastructure_type=infrastructure_type,
            capacity_attribute=capacity_attribute,
            icon=icon
        )
        
        # Store in database
        energy_data = EnergyData(
            country=country,
            infrastructure_type=infrastructure_type,
            file_path=result["geojson_path"],
            capacity_attribute=capacity_attribute,
            icon_path=result.get("icon_path")
        )
        
        db.merge(energy_data)
        db.commit()
        
        # Publish to GeoServer
        layer_name = await geoserver_manager.publish_vector(
            name=f"{country}_{infrastructure_type}_energy",
            file_path=result["geojson_path"],
            capacity_attribute=capacity_attribute
        )
        
        # Cache the result
        await spatial_cache.cache_layer_info(layer_name, result)
        
        logger.info("Energy data processed successfully", layer_name=layer_name)
        
        return {
            "success": True,
            "layer_name": layer_name,
            "feature_count": result["feature_count"],
            "message": "Energy data uploaded and processed successfully"
        }
        
    except Exception as e:
        logger.error("Failed to process energy data", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to process energy data: {str(e)}")

@app.post("/api/upload/boundary")
async def upload_boundary_data(
    file: UploadFile = File(...),
    country: str = Form(...),
    hover_attribute: str = Form(...),
    db: Session = Depends(get_db)
):
    """Upload and process country boundary data"""
    logger.info("Processing boundary data upload", country=country)
    
    try:
        # Process the file
        result = await file_processor.process_boundary_shapefile(
            file=file,
            country=country,
            hover_attribute=hover_attribute
        )
        
        # Store in database
        boundary_data = BoundaryData(
            country=country,
            file_path=result["geojson_path"],
            hover_attribute=hover_attribute,
            feature_count=result["feature_count"],
            bounds=result["bounds"]
        )
        
        db.merge(boundary_data)
        db.commit()
        
        # Publish to GeoServer
        layer_name = await geoserver_manager.publish_vector(
            name=f"{country}_boundary",
            file_path=result["geojson_path"],
            hover_attribute=hover_attribute
        )
        
        # Cache the result
        await spatial_cache.cache_layer_info(layer_name, result)
        
        logger.info("Boundary data processed successfully", layer_name=layer_name)
        
        return {
            "success": True,
            "layer_name": layer_name,
            "feature_count": result["feature_count"],
            "bounds": result["bounds"],
            "message": "Boundary data uploaded and processed successfully"
        }
        
    except Exception as e:
        logger.error("Failed to process boundary data", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to process boundary data: {str(e)}")

@app.get("/api/layers/{country}")
async def get_country_layers(country: str, db: Session = Depends(get_db)):
    """Get all available layers for a specific country"""
    
    # Check cache first
    cached_result = await spatial_cache.get_country_layers(country)
    if cached_result:
        return cached_result
    
    try:
        # Query all data types for the country
        climate_layers = db.query(ClimateData).filter(ClimateData.country == country).all()
        giri_layers = db.query(GiriData).filter(GiriData.country == country).all()
        energy_layers = db.query(EnergyData).filter(EnergyData.country == country).all()
        boundary_layers = db.query(BoundaryData).filter(BoundaryData.country == country).all()
        
        result = {
            "country": country,
            "climate": [
                {
                    "id": layer.id,
                    "variable": layer.variable,
                    "scenario": layer.scenario,
                    "year_range": layer.year_range,
                    "season": layer.season,
                    "statistics": {
                        "min": layer.min_value,
                        "max": layer.max_value,
                        "mean": layer.mean_value
                    },
                    "classification": layer.classification,
                    "layer_name": f"{country}_{layer.variable}_{layer.scenario}",
                    "wms_url": geoserver_manager.get_wms_url(f"{country}_{layer.variable}_{layer.scenario}")
                }
                for layer in climate_layers
            ],
            "giri": [
                {
                    "id": layer.id,
                    "variable": layer.variable,
                    "scenario": layer.scenario,
                    "statistics": {
                        "min": layer.min_value,
                        "max": layer.max_value,
                        "mean": layer.mean_value
                    },
                    "classification": layer.classification,
                    "layer_name": f"{country}_{layer.variable}_{layer.scenario}_giri",
                    "wms_url": geoserver_manager.get_wms_url(f"{country}_{layer.variable}_{layer.scenario}_giri")
                }
                for layer in giri_layers
            ],
            "energy": [
                {
                    "id": layer.id,
                    "infrastructure_type": layer.infrastructure_type,
                    "capacity_attribute": layer.capacity_attribute,
                    "icon_path": layer.icon_path,
                    "layer_name": f"{country}_{layer.infrastructure_type}_energy",
                    "wfs_url": geoserver_manager.get_wfs_url(f"{country}_{layer.infrastructure_type}_energy")
                }
                for layer in energy_layers
            ],
            "boundaries": [
                {
                    "id": layer.id,
                    "hover_attribute": layer.hover_attribute,
                    "feature_count": layer.feature_count,
                    "bounds": layer.bounds,
                    "layer_name": f"{country}_boundary",
                    "wfs_url": geoserver_manager.get_wfs_url(f"{country}_boundary")
                }
                for layer in boundary_layers
            ]
        }
        
        # Cache the result
        await spatial_cache.cache_country_layers(country, result)
        
        return result
        
    except Exception as e:
        logger.error("Failed to get country layers", country=country, error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get layers: {str(e)}")

@app.get("/api/geoserver/{workspace}/{path:path}")
async def proxy_geoserver(workspace: str, path: str, request: Request):
    """Proxy requests to GeoServer to avoid CORS issues"""
    import httpx
    
    # Construct the GeoServer URL
    geoserver_url = f"http://localhost:8081/geoserver/{workspace}/{path}"
    
    # Get query parameters from the request
    query_params = "?" + str(request.url.query) if request.url.query else ""
    full_url = geoserver_url + query_params
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(full_url)
            return JSONResponse(content=response.json())
    except Exception as e:
        logger.error("Failed to proxy GeoServer request", url=full_url, error=str(e))
        raise HTTPException(status_code=500, detail=f"GeoServer proxy error: {str(e)}")

@app.post("/api/cleanup/layers/{country}")
async def cleanup_country_layers(country: str):
    """Clean up duplicate layers for a specific country, keeping only the latest"""
    try:
        logger.info(f"Starting layer cleanup for country: {country}")
        
        result = await geoserver_manager.cleanup_duplicate_layers(country)
        
        if result["success"]:
            logger.info(f"Layer cleanup completed for {country}", result=result)
            return {
                "success": True,
                "message": f"Successfully cleaned up layers for {country}",
                "details": result
            }
        else:
            logger.error(f"Layer cleanup failed for {country}", error=result.get("error"))
            raise HTTPException(status_code=500, detail=f"Layer cleanup failed: {result.get('error')}")
            
    except Exception as e:
        logger.error(f"Error during layer cleanup for {country}", error=str(e))
        raise HTTPException(status_code=500, detail=f"Layer cleanup error: {str(e)}")

@app.post("/api/cleanup/layers/all")
async def cleanup_all_layers():
    """Clean up duplicate layers for all countries, keeping only the latest for each"""
    try:
        logger.info("Starting full layer cleanup for all countries")
        
        result = await geoserver_manager.cleanup_all_duplicate_layers()
        
        if result["success"]:
            logger.info("Full layer cleanup completed", result=result)
            return {
                "success": True,
                "message": "Successfully cleaned up all duplicate layers",
                "summary": {
                    "countries_processed": result["countries_processed"],
                    "total_deleted": result["total_deleted"],
                    "total_kept": result["total_kept"]
                },
                "details": result["detailed_results"]
            }
        else:
            logger.error("Full layer cleanup failed", error=result.get("error"))
            raise HTTPException(status_code=500, detail=f"Full layer cleanup failed: {result.get('error')}")
            
    except Exception as e:
        logger.error("Error during full layer cleanup", error=str(e))
        raise HTTPException(status_code=500, detail=f"Full layer cleanup error: {str(e)}")

@app.get("/api/layers/list")
async def list_all_layers():
    """Get list of all layers in GeoServer"""
    try:
        layers = await geoserver_manager.get_all_layers()
        return {
            "success": True,
            "layers": layers,
            "count": len(layers)
        }
    except Exception as e:
        logger.error("Error getting layers list", error=str(e))
        raise HTTPException(status_code=500, detail=f"Error getting layers: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)