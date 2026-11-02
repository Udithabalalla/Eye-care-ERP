from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Any, Dict, Optional

from app.config.database import get_database
from app.core.security import decode_token
from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.permissions import METHOD_ACTIONS, user_has_permission
from app.repositories.user_repository import UserRepository
from app.models.user import UserModel
from app.services.role_service import RoleService
from app.services.session_service import ClientInfo, SessionService
from app.utils.constants import UserRole

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)

# Sent as the 403 detail while a user still has to replace an admin-set password
PASSWORD_CHANGE_REQUIRED = "PASSWORD_CHANGE_REQUIRED"
# The only routes open to such a user
_PASSWORD_CHANGE_ROUTES = ("/auth/me", "/auth/logout", "/auth/change-password")


def get_token_payload(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    payload = decode_token(credentials.credentials)
    if payload is None:
        raise UnauthorizedException("Invalid or expired token")
    return payload


def get_current_session_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
) -> Optional[str]:
    """The session the request was made from (None for tokens issued before sessions)"""
    payload = decode_token(credentials.credentials) if credentials else None
    return payload.get("sid") if payload else None


def get_client_info(request: Request) -> ClientInfo:
    forwarded = request.headers.get("x-forwarded-for", "")
    ip = forwarded.split(",")[0].strip() or (request.client.host if request.client else None)
    return ClientInfo(ip_address=ip, user_agent=request.headers.get("user-agent"))


async def get_current_user(
    request: Request,
    payload: Dict[str, Any] = Depends(get_token_payload),
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> UserModel:
    """Get current authenticated user"""
    user_id = payload.get("sub")
    if user_id is None:
        raise UnauthorizedException("Invalid token payload")

    session_id = payload.get("sid")
    if session_id and not await SessionService(db).check_session(session_id, user_id):
        raise UnauthorizedException("Your session has ended. Please sign in again.")

    user_repo = UserRepository(db)
    user = await user_repo.get_by_user_id(user_id)

    if user is None or not user.is_active:
        raise UnauthorizedException("User not found or inactive")

    await RoleService(db).refresh_permission_cache_if_stale()

    if user.must_change_password and not request.url.path.endswith(_PASSWORD_CHANGE_ROUTES):
        raise ForbiddenException(PASSWORD_CHANGE_REQUIRED)

    return user

def require_permission(code: str):
    """Dependency that allows the request only if the user holds ``code``."""
    async def checker(current_user: UserModel = Depends(get_current_user)) -> UserModel:
        if not user_has_permission(current_user, code):
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
        if not user_has_permission(current_user, f"{module}.{action}"):
            raise ForbiddenException("You do not have permission to perform this action")
        return current_user
    return checker

async def require_admin(current_user: UserModel = Depends(get_current_user)) -> UserModel:
    """Users, roles and sessions are managed by the admin role only; it can't be granted."""
    if current_user.role != UserRole.ADMIN:
        raise ForbiddenException("Only administrators can do this")
    return current_user

async def get_current_active_user(
    current_user: UserModel = Depends(get_current_user)
) -> UserModel:
    """Get current active user"""
    if not current_user.is_active:
        raise UnauthorizedException("Inactive user")
    return current_user
