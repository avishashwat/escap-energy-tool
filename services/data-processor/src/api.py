from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import os
import json
import uuid
import tempfile
import shutil
from pathlib import Path
import redis.asyncio as redis
from .database import get_db_pool

def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    
    app = FastAPI(
        title="ESCAP Geospatial Data Processor",
        description="High-performance geospatial data processing for UN ESCAP",
        version="1.0.0"
    )
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Redis connection
    redis_client = None
    
    @app.on_event("startup")
    async def startup_event():
        nonlocal redis_client
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        redis_client = redis.from_url(redis_url)
        
        # Ensure upload directory exists
        upload_dir = Path('/app/data/upload')
        upload_dir.mkdir(parents=True, exist_ok=True)
    
    @app.on_event("shutdown")
    async def shutdown_event():
        if redis_client:
            await redis_client.close()
    
    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        try:
            # Test database connection
            db_pool = await get_db_pool()
            async with db_pool.acquire() as conn:
                await conn.fetchval('SELECT 1')
            
            # Test Redis connection
            await redis_client.ping()
            
            return {
                "status": "healthy",
                "services": {
                    "database": "connected",
                    "redis": "connected"
                }
            }
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")
    
    @app.post("/upload")
    async def upload_file(
        background_tasks: BackgroundTasks,
        file: UploadFile = File(...),
        file_type: str = Form(...),
        metadata: str = Form(...)
    ):
        """Upload and process geospatial file."""
        try:
            # Parse metadata
            metadata_dict = json.loads(metadata)
            
            # Generate unique job ID
            job_id = str(uuid.uuid4())
            
            # Save uploaded file
            upload_dir = Path('/app/data/upload')
            file_path = upload_dir / f"{job_id}_{file.filename}"
            
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Create processing job record
            db_pool = await get_db_pool()
            async with db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO metadata.processing_jobs 
                    (id, job_type, file_name, file_size, status)
                    VALUES ($1, $2, $3, $4, $5)
                """, job_id, file_type, file.filename, file_path.stat().st_size, 'queued')
            
            # Queue for background processing
            job_data = {
                'job_id': job_id,
                'file_path': str(file_path),
                'file_type': file_type,
                'country_code': metadata_dict.get('country', 'unknown'),
                'metadata': metadata_dict
            }
            
            await redis_client.rpush('file_processing', json.dumps(job_data))
            
            return {
                "job_id": job_id,
                "status": "queued",
                "message": "File uploaded and queued for processing"
            }
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    
    @app.get("/jobs/{job_id}")
    async def get_job_status(job_id: str):
        """Get processing job status."""
        try:
            db_pool = await get_db_pool()
            async with db_pool.acquire() as conn:
                job = await conn.fetchrow("""
                    SELECT id, job_type, file_name, status, progress, 
                           error_message, result_data, created_at, completed_at
                    FROM metadata.processing_jobs 
                    WHERE id = $1
                """, job_id)
            
            if not job:
                raise HTTPException(status_code=404, detail="Job not found")
            
            result = dict(job)
            if result['result_data']:
                result['result_data'] = json.loads(result['result_data'])
            
            return result
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get job status: {str(e)}")
    
    @app.get("/datasets/{country}")
    async def get_available_datasets(country: str):
        """Get available datasets for a country."""
        try:
            db_pool = await get_db_pool()
            async with db_pool.acquire() as conn:
                # Get climate datasets
                climate_data = await conn.fetch("""
                    SELECT variable_name, scenario, time_period, season, file_path, min_value, max_value
                    FROM climate.datasets 
                    WHERE country_code = $1
                    ORDER BY variable_name, scenario, time_period, season
                """, country)
                
                # Get energy infrastructure
                energy_data = await conn.fetch("""
                    SELECT infrastructure_type, COUNT(*) as count, 
                           MIN(design_capacity) as min_capacity, 
                           MAX(design_capacity) as max_capacity
                    FROM energy.infrastructure 
                    WHERE country_code = $1
                    GROUP BY infrastructure_type
                """, country)
                
                # Get boundary info
                boundary_data = await conn.fetch("""
                    SELECT admin_level, COUNT(*) as count
                    FROM boundaries.admin_boundaries 
                    WHERE country_code = $1
                    GROUP BY admin_level
                    ORDER BY admin_level
                """, country)
            
            return {
                "country": country,
                "climate": [dict(row) for row in climate_data],
                "energy": [dict(row) for row in energy_data],
                "boundaries": [dict(row) for row in boundary_data]
            }
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get datasets: {str(e)}")
    
    @app.delete("/datasets/{country}/{dataset_type}/{dataset_id}")
    async def delete_dataset(country: str, dataset_type: str, dataset_id: str):
        """Delete a dataset."""
        try:
            db_pool = await get_db_pool()
            async with db_pool.acquire() as conn:
                if dataset_type == "climate":
                    await conn.execute("""
                        DELETE FROM climate.datasets 
                        WHERE id = $1 AND country_code = $2
                    """, int(dataset_id), country)
                elif dataset_type == "energy":
                    await conn.execute("""
                        DELETE FROM energy.infrastructure 
                        WHERE id = $1 AND country_code = $2
                    """, int(dataset_id), country)
                elif dataset_type == "boundary":
                    await conn.execute("""
                        DELETE FROM boundaries.admin_boundaries 
                        WHERE id = $1 AND country_code = $2
                    """, int(dataset_id), country)
                else:
                    raise HTTPException(status_code=400, detail="Invalid dataset type")
            
            return {"message": "Dataset deleted successfully"}
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete dataset: {str(e)}")
    
    return app