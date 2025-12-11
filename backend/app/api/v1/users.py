from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from app.schemas.user import UserResponse
from app.utils.constants import UserRole
from app.config.database import get_database
from app.models.user import UserModel
from app.api.v1.auth import get_current_user

router = APIRouter()

@router.get("", response_model=List[UserResponse])
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    role: Optional[UserRole] = None,
    current_user = Depends(get_current_user)
):
    """Get list of users, optionally filtered by role"""
    db = get_database()
    query = {}
    if role:
        query["role"] = role
        
    cursor = db.users.find(query).skip(skip).limit(limit)
    users = []
    async for doc in cursor:
        users.append(UserModel(**doc))
    return users
