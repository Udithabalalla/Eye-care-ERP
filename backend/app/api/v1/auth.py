from typing import Optional

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config.database import get_database
from app.core.permissions import effective_permissions, permissions_for
from app.schemas.user import (
    CurrentUserResponse, LoginRequest, LoginResponse, LogoutRequest, PasswordChange, SignupRequest,
)
from app.schemas.user import RefreshRequest, RefreshResponse
from app.schemas.password_reset import PasswordResetConfirmRequest, PasswordResetRequest, PasswordResetResponse
from app.schemas.responses import ResponseModel
from app.services.auth_service import AuthService
from app.services.password_reset_service import PasswordResetService
from app.services.session_service import ClientInfo
from app.api.deps import get_client_info, get_current_session_id, get_current_user
from app.models.user import UserModel
from app.utils.constants import UserRole

router = APIRouter()


def _current_user_response(user: UserModel) -> CurrentUserResponse:
    permissions = permissions_for(user.role) if user.role == UserRole.ADMIN else sorted(effective_permissions(user))
    return CurrentUserResponse(**user.model_dump(), permissions=permissions)

@router.post("/login", response_model=LoginResponse)
async def login(
    login_data: LoginRequest,
    client: ClientInfo = Depends(get_client_info),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """User login"""
    auth_service = AuthService(db)
    return await auth_service.login(login_data.email, login_data.password, client)

@router.post("/register", response_model=LoginResponse)
async def register(
    signup_data: SignupRequest,
    client: ClientInfo = Depends(get_client_info),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Register a new user"""
    auth_service = AuthService(db)
    return await auth_service.register(signup_data, client)

@router.post("/logout")
async def logout(
    payload: Optional[LogoutRequest] = None,
    current_user: UserModel = Depends(get_current_user),
    session_id: Optional[str] = Depends(get_current_session_id),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """User logout: ends this session so its refresh token stops working"""
    await AuthService(db).logout(current_user, session_id, payload.refresh_token if payload else None)
    return {"message": "Successfully logged out"}

@router.get("/me", response_model=ResponseModel[CurrentUserResponse])
async def get_current_user_info(current_user: UserModel = Depends(get_current_user)):
    """Get current user information"""
    return ResponseModel(data=_current_user_response(current_user))


@router.post("/change-password", response_model=ResponseModel[CurrentUserResponse])
async def change_own_password(
    payload: PasswordChange,
    current_user: UserModel = Depends(get_current_user),
    session_id: Optional[str] = Depends(get_current_session_id),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Change your own password; your other signed-in devices are signed out"""
    updated = await AuthService(db).change_own_password(
        current_user, payload.old_password, payload.new_password, session_id
    )
    return ResponseModel(message="Password changed", data=_current_user_response(updated))


@router.post("/password-reset/request", response_model=PasswordResetResponse)
async def request_password_reset(
    payload: PasswordResetRequest,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Send a one-time password to the registered email address"""
    password_reset_service = PasswordResetService(db)
    return await password_reset_service.request_reset(payload.email)


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_token(
    payload: RefreshRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    auth_service = AuthService(db)
    access = await auth_service.refresh_access_token(payload.refresh_token)
    return RefreshResponse(access_token=access)


@router.post("/password-reset/confirm", response_model=PasswordResetResponse)
async def confirm_password_reset(
    payload: PasswordResetConfirmRequest,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Validate the OTP and set a new password"""
    password_reset_service = PasswordResetService(db)
    return await password_reset_service.confirm_reset(payload.email, payload.otp, payload.new_password)
