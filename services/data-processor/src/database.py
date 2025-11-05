import asyncpg
import os
from typing import Optional

_db_pool: Optional[asyncpg.Pool] = None

async def init_database():
    """Initialize database connection pool."""
    global _db_pool
    
    database_url = os.getenv('DATABASE_URL', 'postgresql://geouser:geopass123@localhost:5432/escap_geospatial')
    
    _db_pool = await asyncpg.create_pool(
        database_url,
        min_size=5,
        max_size=20,
        command_timeout=60
    )
    
    return _db_pool

async def get_db_pool() -> asyncpg.Pool:
    """Get database connection pool."""
    global _db_pool
    
    if _db_pool is None:
        _db_pool = await init_database()
    
    return _db_pool

async def close_database():
    """Close database connection pool."""
    global _db_pool
    
    if _db_pool:
        await _db_pool.close()
        _db_pool = None