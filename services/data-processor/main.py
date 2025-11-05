import asyncio
import os
import sys
import logging
from pathlib import Path

# Add the project root to Python path
sys.path.append(str(Path(__file__).parent))

from src.api import create_app
from src.worker import start_worker
from src.database import init_database

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/app/logs/processor.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

async def main():
    """Main entry point for the data processor service."""
    try:
        # Initialize database connection
        await init_database()
        logger.info("Database connection initialized")
        
        # Start background worker for processing jobs
        worker_task = asyncio.create_task(start_worker())
        logger.info("Background worker started")
        
        # Create and start FastAPI app
        app = create_app()
        
        import uvicorn
        config = uvicorn.Config(
            app=app,
            host="0.0.0.0",
            port=8000,
            log_level="info",
            access_log=True
        )
        server = uvicorn.Server(config)
        
        logger.info("Starting FastAPI server on port 8000")
        await server.serve()
        
    except Exception as e:
        logger.error(f"Failed to start data processor service: {e}")
        raise
    finally:
        # Cleanup
        if 'worker_task' in locals():
            worker_task.cancel()
            try:
                await worker_task
            except asyncio.CancelledError:
                pass

if __name__ == "__main__":
    asyncio.run(main())