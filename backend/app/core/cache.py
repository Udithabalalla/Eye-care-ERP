"""
Simple in-memory cache with TTL support for optimizing expensive queries.
"""
from typing import Any, Optional, Dict
from datetime import datetime, timedelta
from functools import wraps
import asyncio
import hashlib
import json


class CacheEntry:
    """Cache entry with expiration tracking"""
    
    def __init__(self, value: Any, ttl_seconds: int):
        self.value = value
        self.expires_at = datetime.utcnow() + timedelta(seconds=ttl_seconds)
    
    def is_expired(self) -> bool:
        return datetime.utcnow() > self.expires_at


class InMemoryCache:
    """
    Thread-safe in-memory cache with TTL support.
    Suitable for single-instance deployments.
    For multi-instance deployments, consider using Redis.
    """
    
    def __init__(self):
        self._cache: Dict[str, CacheEntry] = {}
        self._lock = asyncio.Lock()
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache if exists and not expired"""
        async with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                return None
            if entry.is_expired():
                del self._cache[key]
                return None
            return entry.value
    
    async def set(self, key: str, value: Any, ttl_seconds: int = 300) -> None:
        """Set value in cache with TTL (default 5 minutes)"""
        async with self._lock:
            self._cache[key] = CacheEntry(value, ttl_seconds)
    
    async def delete(self, key: str) -> bool:
        """Delete key from cache"""
        async with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False
    
    async def clear(self) -> None:
        """Clear all cache entries"""
        async with self._lock:
            self._cache.clear()
    
    async def clear_pattern(self, pattern: str) -> int:
        """Clear all keys matching pattern (simple prefix match)"""
        async with self._lock:
            keys_to_delete = [k for k in self._cache.keys() if k.startswith(pattern)]
            for key in keys_to_delete:
                del self._cache[key]
            return len(keys_to_delete)
    
    async def cleanup_expired(self) -> int:
        """Remove all expired entries"""
        async with self._lock:
            expired_keys = [k for k, v in self._cache.items() if v.is_expired()]
            for key in expired_keys:
                del self._cache[key]
            return len(expired_keys)


# Global cache instance
cache = InMemoryCache()


def make_cache_key(*args, **kwargs) -> str:
    """Generate a cache key from arguments"""
    key_data = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True, default=str)
    return hashlib.md5(key_data.encode()).hexdigest()


def cached(prefix: str, ttl_seconds: int = 300):
    """
    Decorator for caching async function results.
    
    Usage:
        @cached("dashboard_stats", ttl_seconds=60)
        async def get_dashboard_stats():
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Skip 'self' argument for methods
            cache_args = args[1:] if args and hasattr(args[0], '__class__') else args
            key = f"{prefix}:{make_cache_key(*cache_args, **kwargs)}"
            
            # Try to get from cache
            cached_value = await cache.get(key)
            if cached_value is not None:
                return cached_value
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            await cache.set(key, result, ttl_seconds)
            return result
        
        # Add method to invalidate this function's cache
        wrapper.invalidate_cache = lambda: cache.clear_pattern(f"{prefix}:")
        return wrapper
    
    return decorator


# Cache TTL constants (in seconds)
class CacheTTL:
    """Standard TTL values for different data types"""
    SHORT = 30      # 30 seconds - for frequently changing data
    MEDIUM = 300    # 5 minutes - for moderately changing data
    LONG = 1800     # 30 minutes - for slowly changing data
    STATIC = 3600   # 1 hour - for rarely changing data
