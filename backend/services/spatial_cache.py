import asyncio
import json
import redis.asyncio as redis
from typing import Dict, Any, Optional, List
# import structlog
import os
import logging

logger = logging.getLogger(__name__)

class SpatialCache:
    """High-performance caching system for spatial data using Redis"""
    
    def __init__(self):
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.redis_client = None
        
        # Cache TTL settings (in seconds)
        self.layer_info_ttl = 3600  # 1 hour
        self.country_layers_ttl = 1800  # 30 minutes
        self.boundary_cache_ttl = 7200  # 2 hours
        self.statistics_ttl = 3600  # 1 hour
    
    async def initialize(self):
        """Initialize Redis connection"""
        try:
            self.redis_client = redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
                max_connections=20,
                retry_on_timeout=True,
                socket_keepalive=True,
                socket_keepalive_options={}
            )
            
            # Test connection
            await self.redis_client.ping()
            logger.info("Redis cache initialized successfully")
            
        except Exception as e:
            logger.error("Failed to initialize Redis cache", error=str(e))
            raise
    
    async def cleanup(self):
        """Cleanup Redis connection"""
        if self.redis_client:
            await self.redis_client.close()
    
    async def health_check(self) -> bool:
        """Check if Redis is healthy"""
        try:
            if not self.redis_client:
                return False
            await self.redis_client.ping()
            return True
        except Exception:
            return False
    
    async def cache_layer_info(self, layer_name: str, layer_data: Dict[str, Any]):
        """Cache layer information"""
        try:
            cache_key = f"layer:{layer_name}"
            await self.redis_client.setex(
                cache_key,
                self.layer_info_ttl,
                json.dumps(layer_data)
            )
            logger.debug("Layer info cached", layer_name=layer_name)
        except Exception as e:
            logger.warning("Failed to cache layer info", layer_name=layer_name, error=str(e))
    
    async def get_layer_info(self, layer_name: str) -> Optional[Dict[str, Any]]:
        """Get cached layer information"""
        try:
            cache_key = f"layer:{layer_name}"
            cached_data = await self.redis_client.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            logger.warning("Failed to get cached layer info", layer_name=layer_name, error=str(e))
        return None
    
    async def cache_country_layers(self, country: str, layers_data: Dict[str, Any]):
        """Cache all layers for a country"""
        try:
            cache_key = f"country_layers:{country}"
            await self.redis_client.setex(
                cache_key,
                self.country_layers_ttl,
                json.dumps(layers_data)
            )
            logger.debug("Country layers cached", country=country)
        except Exception as e:
            logger.warning("Failed to cache country layers", country=country, error=str(e))
    
    async def get_country_layers(self, country: str) -> Optional[Dict[str, Any]]:
        """Get cached country layers"""
        try:
            cache_key = f"country_layers:{country}"
            cached_data = await self.redis_client.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            logger.warning("Failed to get cached country layers", country=country, error=str(e))
        return None
    
    async def cache_boundary_data(self, country: str, boundary_data: Dict[str, Any]):
        """Cache boundary data for faster loading"""
        try:
            cache_key = f"boundary:{country}"
            await self.redis_client.setex(
                cache_key,
                self.boundary_cache_ttl,
                json.dumps(boundary_data)
            )
            logger.debug("Boundary data cached", country=country)
        except Exception as e:
            logger.warning("Failed to cache boundary data", country=country, error=str(e))
    
    async def get_boundary_data(self, country: str) -> Optional[Dict[str, Any]]:
        """Get cached boundary data"""
        try:
            cache_key = f"boundary:{country}"
            cached_data = await self.redis_client.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            logger.warning("Failed to get cached boundary data", country=country, error=str(e))
        return None
    
    async def cache_raster_statistics(self, file_path: str, statistics: Dict[str, float]):
        """Cache raster statistics"""
        try:
            cache_key = f"stats:{file_path}"
            await self.redis_client.setex(
                cache_key,
                self.statistics_ttl,
                json.dumps(statistics)
            )
            logger.debug("Raster statistics cached", file_path=file_path)
        except Exception as e:
            logger.warning("Failed to cache raster statistics", file_path=file_path, error=str(e))
    
    async def get_raster_statistics(self, file_path: str) -> Optional[Dict[str, float]]:
        """Get cached raster statistics"""
        try:
            cache_key = f"stats:{file_path}"
            cached_data = await self.redis_client.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            logger.warning("Failed to get cached raster statistics", file_path=file_path, error=str(e))
        return None
    
    async def invalidate_country_cache(self, country: str):
        """Invalidate all cached data for a country"""
        try:
            # Get all keys related to the country
            patterns = [
                f"layer:{country}_*",
                f"country_layers:{country}",
                f"boundary:{country}",
                f"stats:*{country}*"
            ]
            
            for pattern in patterns:
                keys = await self.redis_client.keys(pattern)
                if keys:
                    await self.redis_client.delete(*keys)
            
            logger.info("Country cache invalidated", country=country)
            
        except Exception as e:
            logger.warning("Failed to invalidate country cache", country=country, error=str(e))
    
    async def invalidate_layer_cache(self, layer_name: str):
        """Invalidate cache for a specific layer"""
        try:
            cache_key = f"layer:{layer_name}"
            await self.redis_client.delete(cache_key)
            logger.debug("Layer cache invalidated", layer_name=layer_name)
        except Exception as e:
            logger.warning("Failed to invalidate layer cache", layer_name=layer_name, error=str(e))
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache usage statistics"""
        try:
            info = await self.redis_client.info()
            
            # Get key counts by pattern
            layer_keys = len(await self.redis_client.keys("layer:*"))
            country_keys = len(await self.redis_client.keys("country_layers:*"))
            boundary_keys = len(await self.redis_client.keys("boundary:*"))
            stats_keys = len(await self.redis_client.keys("stats:*"))
            
            return {
                "redis_info": {
                    "used_memory": info.get("used_memory_human", "Unknown"),
                    "connected_clients": info.get("connected_clients", 0),
                    "total_commands_processed": info.get("total_commands_processed", 0),
                    "keyspace_hits": info.get("keyspace_hits", 0),
                    "keyspace_misses": info.get("keyspace_misses", 0)
                },
                "cache_keys": {
                    "layers": layer_keys,
                    "country_layers": country_keys,
                    "boundaries": boundary_keys,
                    "statistics": stats_keys,
                    "total": layer_keys + country_keys + boundary_keys + stats_keys
                },
                "hit_ratio": self._calculate_hit_ratio(
                    info.get("keyspace_hits", 0),
                    info.get("keyspace_misses", 0)
                )
            }
        except Exception as e:
            logger.error("Failed to get cache stats", error=str(e))
            return {"error": str(e)}
    
    def _calculate_hit_ratio(self, hits: int, misses: int) -> float:
        """Calculate cache hit ratio"""
        total = hits + misses
        if total == 0:
            return 0.0
        return round((hits / total) * 100, 2)
    
    async def preload_country_data(self, country: str):
        """Preload all data for a country into cache"""
        try:
            logger.info("Preloading country data", country=country)
            
            # This would typically load all layers for the country
            # and store them in cache for faster access
            
            # For now, we'll create a placeholder
            preload_data = {
                "country": country,
                "preloaded_at": asyncio.get_event_loop().time(),
                "status": "preloaded"
            }
            
            await self.cache_country_layers(country, preload_data)
            
            logger.info("Country data preloaded successfully", country=country)
            
        except Exception as e:
            logger.error("Failed to preload country data", country=country, error=str(e))
    
    async def bulk_invalidate(self, patterns: List[str]):
        """Bulk invalidate cache entries matching patterns"""
        try:
            all_keys = []
            for pattern in patterns:
                keys = await self.redis_client.keys(pattern)
                all_keys.extend(keys)
            
            if all_keys:
                await self.redis_client.delete(*all_keys)
                logger.info("Bulk cache invalidation completed", 
                           keys_deleted=len(all_keys), patterns=patterns)
        except Exception as e:
            logger.warning("Failed to bulk invalidate cache", patterns=patterns, error=str(e))