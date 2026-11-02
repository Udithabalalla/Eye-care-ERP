import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config.settings import settings
from app.core.exceptions import NotFoundException, UnauthorizedException
from app.models.user import UserModel
from app.repositories.session_repository import SessionRepository, as_utc
from app.repositories.user_repository import UserRepository
from app.schemas.session import SessionResponse
from app.services.audit_service import AuditService

# Last activity is written at most this often per session, not on every request
TOUCH_INTERVAL = timedelta(seconds=60)


@dataclass
class ClientInfo:
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


def hash_token(token: str) -> str:
    """Refresh tokens are stored as SHA-256 hashes, never as the token itself"""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class SessionService:
    """Sign-in sessions backed by the ``refresh_tokens`` collection.

    A session lives until its refresh token expires or is revoked. Access tokens
    carry the session id (``sid``), so revoking a session stops both its refresh
    token and any access token issued for it.
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.repo = SessionRepository(db)
        self.user_repo = UserRepository(db)

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    async def start_session(self, user_id: str, client: Optional[ClientInfo] = None) -> tuple[str, str]:
        """Store a new session; returns ``(refresh_token, session_id)``"""
        client = client or ClientInfo()
        now = self._now()
        refresh_token = secrets.token_urlsafe(32)
        session_id = await self.repo.create_session({
            "token_hash": hash_token(refresh_token),
            "user_id": user_id,
            "created_at": now,
            "last_seen_at": now,
            "expires_at": now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            "ip_address": client.ip_address,
            "user_agent": (client.user_agent or "")[:300] or None,
            "revoked_at": None,
        })
        return refresh_token, session_id

    async def use_refresh_token(self, refresh_token: str) -> tuple[UserModel, str]:
        """Check a refresh token; returns its user and session id"""
        doc = await self.repo.get_by_token_hash(hash_token(refresh_token))
        if not doc:
            raise UnauthorizedException("Invalid refresh token")
        if doc.get("revoked_at"):
            raise UnauthorizedException("This session has been signed out")
        expires_at = as_utc(doc.get("expires_at"))
        if not expires_at or self._now() > expires_at:
            raise UnauthorizedException("Refresh token expired")
        user = await self.user_repo.get_by_user_id(doc.get("user_id"))
        if not user:
            raise UnauthorizedException("User not found for refresh token")
        if not user.is_active:
            raise UnauthorizedException("Account is deactivated")
        session_id = str(doc["_id"])
        await self.repo.touch(session_id, self._now())
        return user, session_id

    async def check_session(self, session_id: str, user_id: str) -> bool:
        """True if the session is live and belongs to ``user_id``; records activity"""
        doc = await self.repo.get_session(session_id)
        if not doc or doc.get("user_id") != user_id or doc.get("revoked_at"):
            return False
        now = self._now()
        expires_at = as_utc(doc.get("expires_at"))
        if not expires_at or now > expires_at:
            return False
        last_seen = as_utc(doc.get("last_seen_at"))
        if last_seen is None or now - last_seen > TOUCH_INTERVAL:
            await self.repo.touch(session_id, now)
        return True

    async def end_session(self, session_id: str, actor_id: str) -> dict:
        """Revoke one session; returns the revoked session document"""
        doc = await self.repo.revoke(session_id, self._now(), actor_id)
        if not doc:
            raise NotFoundException("Session not found or already signed out")
        return doc

    async def end_user_sessions(
        self, user_id: str, actor_id: str, keep_session_id: Optional[str] = None
    ) -> int:
        return await self.repo.revoke_for_user(user_id, self._now(), actor_id, keep_session_id)

    async def admin_end_session(self, session_id: str, actor_id: str) -> None:
        doc = await self.end_session(session_id, actor_id)
        await AuditService(self.db).log(actor_id, "revoke_session", "session", session_id,
                                        new_value={"user_id": doc.get("user_id")})

    async def admin_end_user_sessions(self, user_id: str, actor_id: str) -> int:
        if not await self.user_repo.get_by_user_id(user_id):
            raise NotFoundException("User not found")
        revoked = await self.end_user_sessions(user_id, actor_id)
        await AuditService(self.db).log(actor_id, "revoke_all_sessions", "user", user_id,
                                        new_value={"revoked": revoked})
        return revoked

    async def list_active(
        self, user_id: Optional[str] = None, current_session_id: Optional[str] = None
    ) -> List[SessionResponse]:
        docs = await self.repo.list_active(self._now(), user_id)
        user_ids = list({doc["user_id"] for doc in docs})
        users = {}
        if user_ids:
            async for u in self.db["users"].find(
                {"user_id": {"$in": user_ids}},
                {"user_id": 1, "name": 1, "email": 1, "role": 1, "is_active": 1},
            ):
                users[u["user_id"]] = u

        sessions = []
        for doc in docs:
            session_id = str(doc["_id"])
            user = users.get(doc["user_id"], {})
            # Sessions stored before sign-in times were recorded fall back to the id's timestamp
            signed_in_at = as_utc(doc.get("created_at")) or doc["_id"].generation_time
            sessions.append(SessionResponse(
                session_id=session_id,
                user_id=doc["user_id"],
                user_name=user.get("name"),
                user_email=user.get("email"),
                user_role=user.get("role"),
                user_is_active=user.get("is_active", True),
                signed_in_at=signed_in_at,
                last_seen_at=as_utc(doc.get("last_seen_at")),
                expires_at=as_utc(doc["expires_at"]),
                ip_address=doc.get("ip_address"),
                user_agent=doc.get("user_agent"),
                is_current=session_id == current_session_id,
            ))
        return sessions

    async def count_active_by_user(self) -> dict[str, int]:
        return await self.repo.count_active_by_user(self._now())

    async def hash_plain_tokens(self) -> int:
        """Replace refresh tokens stored in plain text with their hashes"""
        docs = await self.repo.plain_token_sessions()
        for doc in docs:
            await self.repo.replace_plain_token(doc["_id"], hash_token(doc["token"]))
        return len(docs)
