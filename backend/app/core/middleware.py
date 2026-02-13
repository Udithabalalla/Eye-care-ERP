"""
Cache control middleware for API responses.
"""
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable


class CacheControlMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add appropriate Cache-Control headers to API responses.
    
    Different endpoints have different caching needs:
    - Static data (doctors, products list): can be cached longer
    - Dynamic data (dashboard stats): should be cached briefly or not at all
    - User-specific data: should not be cached
    """
    
    # Endpoints that can be cached by the client
    CACHEABLE_ENDPOINTS = {
        "/api/v1/doctors": 300,          # 5 minutes
        "/api/v1/products": 120,         # 2 minutes  
        "/api/v1/dashboard/stats": 30,   # 30 seconds
    }
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Only add cache headers for GET requests
        if request.method != "GET":
            response.headers["Cache-Control"] = "no-store"
            return response
        
        path = request.url.path
        
        # Check if this is a cacheable endpoint
        cache_duration = None
        for endpoint, duration in self.CACHEABLE_ENDPOINTS.items():
            if path.startswith(endpoint):
                cache_duration = duration
                break
        
        if cache_duration:
            # Allow browser caching with revalidation
            response.headers["Cache-Control"] = f"private, max-age={cache_duration}, stale-while-revalidate=60"
        else:
            # Default: no caching for API responses
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all responses.
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        return response
