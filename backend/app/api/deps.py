from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional

from app.config.database import get_database
from app.core.security import decode_token
from app.core.exceptions import UnauthorizedException
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

async def get_current_active_user(
    current_user: UserModel = Depends(get_current_user)
) -> UserModel:
    """Get current active user"""
    if not current_user.is_active:
        raise UnauthorizedException("Inactive user")
    return current_user
