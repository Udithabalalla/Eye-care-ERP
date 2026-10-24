from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional

from app.config.database import get_database
from app.core.security import decode_token
from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.permissions import METHOD_ACTIONS, has_permission
from app.repositories.user_repository import UserRepository
from app.models.user import UserModel

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> UserModel:
    """Get current authenticated user"""
    token = credentials.credentials
    payload = decode_token(token)
    
    if payload is None:
        raise UnauthorizedException("Invalid or expired token")
    
    user_id = payload.get("sub")
    if user_id is None:
        raise UnauthorizedException("Invalid token payload")
    
    user_repo = UserRepository(db)
    user = await user_repo.get_by_user_id(user_id)
    
    if user is None or not user.is_active:
        raise UnauthorizedException("User not found or inactive")
    
    return user

def require_permission(code: str):
    """Dependency that allows the request only if the user holds ``code``."""
    async def checker(current_user: UserModel = Depends(get_current_user)) -> UserModel:
        if not has_permission(current_user.role, code):
            raise ForbiddenException("You do not have permission to perform this action")
        return current_user
    return checker

def require_module_access(module: str):
    """Router-level guard: maps the HTTP method to ``<module>.read|write|delete``."""
    async def checker(
        request: Request,
        current_user: UserModel = Depends(get_current_user)
    ) -> UserModel:
        action = METHOD_ACTIONS.get(request.method, "write")
        if not has_permission(current_user.role, f"{module}.{action}"):
            raise ForbiddenException("You do not have permission to perform this action")
        return current_user
    return checker

async def get_current_active_user(
    current_user: UserModel = Depends(get_current_user)
) -> UserModel:
    """Get current active user"""
    if not current_user.is_active:
        raise UnauthorizedException("Inactive user")
    return current_user
