import asyncio
import logging
import json
import os
from typing import Dict, Any
import redis.asyncio as redis
from .processor import DataProcessor

logger = logging.getLogger(__name__)

class Worker:
    """Background worker for processing uploaded files."""
    
    def __init__(self):
        self.redis_client = None
        self.processor = DataProcessor()
        self.running = False
        
    async def initialize(self):
        """Initialize worker connections."""
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        self.redis_client = redis.from_url(redis_url)
        await self.processor.initialize()
        
    async def start(self):
        """Start the worker to process jobs."""
        await self.initialize()
        self.running = True
        
        logger.info("Worker started, waiting for jobs...")
        
        while self.running:
            try:
                # Blocking pop from Redis queue
                result = await self.redis_client.blpop('file_processing', timeout=10)
                
                if result:
                    queue_name, job_data_str = result
                    job_data = json.loads(job_data_str)
                    
                    logger.info(f"Processing job: {job_data.get('job_id')}")
                    
                    try:
                        # Process the file
                        result = await self.processor.process_uploaded_file(job_data)
                        logger.info(f"Job completed successfully: {job_data.get('job_id')}")
                        
                    except Exception as e:
                        logger.error(f"Job failed: {job_data.get('job_id')} - {str(e)}")
                        
            except asyncio.CancelledError:
                logger.info("Worker cancelled")
                break
            except Exception as e:
                logger.error(f"Worker error: {e}")
                await asyncio.sleep(5)  # Wait before retrying
                
        logger.info("Worker stopped")
    
    async def stop(self):
        """Stop the worker."""
        self.running = False
        if self.redis_client:
            await self.redis_client.close()

async def start_worker():
    """Start the background worker."""
    worker = Worker()
    try:
        await worker.start()
    except Exception as e:
        logger.error(f"Worker failed: {e}")
        raise
    finally:
        await worker.stop()