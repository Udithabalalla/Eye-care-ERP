from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config.database import get_database
from app.schemas.user import LoginRequest, LoginResponse, UserResponse
from app.schemas.responses import ResponseModel
from app.services.auth_service import AuthService
from app.api.deps import get_current_user
from app.models.user import UserModel

router = APIRouter()

@router.post("/login", response_model=LoginResponse)
async def login(
    login_data: LoginRequest,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """User login"""
    auth_service = AuthService(db)
    return await auth_service.login(login_data.email, login_data.password)

@router.post("/logout")
async def logout(current_user: UserModel = Depends(get_current_user)):
    """User logout"""
    return {"message": "Successfully logged out"}

@router.get("/me", response_model=ResponseModel[UserResponse])
async def get_current_user_info(current_user: UserModel = Depends(get_current_user)):
    """Get current user information"""
    return ResponseModel(data=UserResponse(**current_user.dict()))
