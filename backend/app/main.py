from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager

from app.config.settings import settings
from app.config.database import connect_to_mongo, close_mongo_connection, get_database
from app.api.v1.router import api_router
from app.core.middleware import CacheControlMiddleware, SecurityHeadersMiddleware
from app.services.role_service import RoleService
from app.services.session_service import SessionService
import os

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongo()
    await prepare_access_control()
    yield
    # Shutdown
    await close_mongo_connection()

async def prepare_access_control():
    """Store the default role permissions on first start, load them, and hash old refresh tokens"""
    database = get_database()
    roles = RoleService(database)
    await roles.ensure_system_roles()
    await roles.refresh_permission_cache()
    hashed = await SessionService(database).hash_plain_tokens()
    if hashed:
        print(f"[OK] Hashed {hashed} refresh token(s) stored in plain text")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Security headers (outermost - applied last)
app.add_middleware(SecurityHeadersMiddleware)

# Cache control headers
app.add_middleware(CacheControlMiddleware)

# GZip compression for responses > 500 bytes
app.add_middleware(GZipMiddleware, minimum_size=500)

# CORS
ENV = os.getenv("ENVIRONMENT", "production").lower()

default_allowed_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://eye-care-erp.vercel.app",
]

if ENV in {"development", "dev", "local"}:
    origins = ["*"]
else:
    configured_origins = settings.cors_origins_list
    origins = list(dict.fromkeys(configured_origins + default_allowed_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION
    }

@app.get("/")
async def root():
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": settings.APP_VERSION,
        "docs": "/api/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.RELOAD
    )
