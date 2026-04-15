from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from app.schemas.user import UserResponse
from app.utils.constants import UserRole
from app.config.database import get_database
from app.models.user import UserModel
from app.api.v1.auth import get_current_user
from app.services.user_service import UserService
from app.schemas.responses import ResponseModel
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, EmailStr

router = APIRouter()


class UserCreateRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: UserRole
    department: Optional[str] = None
    phone: Optional[str] = None


class UserUpdateRequest(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    role: Optional[UserRole] = None
    department: Optional[str] = None
    phone: Optional[str] = None


class UserPasswordChange(BaseModel):
    old_password: str
    new_password: str


@router.get("", response_model=ResponseModel)
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    role: Optional[UserRole] = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Get list of users, optionally filtered by role"""
    user_service = UserService(db)
    users, total = await user_service.list_users(skip, limit, role)
    return ResponseModel(
        message="Users retrieved successfully",
        data=[u.dict() for u in users],
        total=total
    )


@router.get("/{user_id}", response_model=ResponseModel)
async def get_user(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Get user by ID"""
    user_service = UserService(db)
    user = await user_service.get_user(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return ResponseModel(
        message="User retrieved successfully",
        data=user.dict()
    )


@router.post("", response_model=ResponseModel, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreateRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Create a new user"""
    user_service = UserService(db)
    try:
        new_user = await user_service.create_user(
            email=user_data.email,
            password=user_data.password,
            name=user_data.name,
            role=user_data.role,
            department=user_data.department,
            phone=user_data.phone
        )
        return ResponseModel(
            message="User created successfully",
            data=new_user.dict()
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{user_id}", response_model=ResponseModel)
async def update_user(
    user_id: str,
    user_data: UserUpdateRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Update user"""
    user_service = UserService(db)
    try:
        updated = await user_service.update_user(
            user_id,
            name=user_data.name,
            email=user_data.email,
            role=user_data.role,
            department=user_data.department,
            phone=user_data.phone
        )
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return ResponseModel(
            message="User updated successfully",
            data=updated.dict()
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{user_id}/change-password", response_model=ResponseModel)
async def change_password(
    user_id: str,
    password_change: UserPasswordChange,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Change user password"""
    user_service = UserService(db)
    try:
        await user_service.change_password(user_id, password_change.old_password, password_change.new_password)
        return ResponseModel(message="Password changed successfully")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{user_id}/reset-password", response_model=ResponseModel)
async def reset_password(
    user_id: str,
    new_password: str = Query(..., min_length=8),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Admin reset password"""
    user_service = UserService(db)
    try:
        await user_service.reset_password(user_id, new_password)
        return ResponseModel(message="Password reset successfully")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{user_id}/deactivate", response_model=ResponseModel)
async def deactivate_user(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Deactivate user"""
    user_service = UserService(db)
    deactivated = await user_service.deactivate_user(user_id)
    if not deactivated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return ResponseModel(message="User deactivated successfully")


@router.post("/{user_id}/activate", response_model=ResponseModel)
async def activate_user(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Activate user"""
    user_service = UserService(db)
    activated = await user_service.activate_user(user_id)
    if not activated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return ResponseModel(message="User activated successfully")
