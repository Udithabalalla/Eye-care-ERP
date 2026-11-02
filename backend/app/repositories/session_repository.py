from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.base import BaseRepository

# Each sign-in stores one refresh token here; the document is the session.
# Its ``_id`` is the session id carried in access tokens as ``sid``.
SESSION_COLLECTION = "refresh_tokens"


def as_utc(value: Optional[datetime]) -> Optional[datetime]:
    """MongoDB hands back naive UTC datetimes; make them timezone-aware"""
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


class SessionRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, SESSION_COLLECTION)

    @staticmethod
    def _oid(session_id: str) -> Optional[ObjectId]:
        return ObjectId(session_id) if ObjectId.is_valid(session_id) else None

    @staticmethod
    def _active_filter(now: datetime) -> Dict[str, Any]:
        return {"revoked_at": None, "expires_at": {"$gt": now}}

    async def create_session(self, data: Dict[str, Any]) -> str:
        result = await self.collection.insert_one(data)
        return str(result.inserted_id)

    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        oid = self._oid(session_id)
        return await self.collection.find_one({"_id": oid}) if oid else None

    async def get_by_token_hash(self, token_hash: str) -> Optional[Dict[str, Any]]:
        return await self.collection.find_one({"token_hash": token_hash})

    async def touch(self, session_id: str, now: datetime) -> None:
        oid = self._oid(session_id)
        if oid:
            await self.collection.update_one({"_id": oid}, {"$set": {"last_seen_at": now}})

    async def revoke(self, session_id: str, now: datetime, revoked_by: str) -> Optional[Dict[str, Any]]:
        """Revoke one live session; returns it, or None if there was nothing to revoke"""
        oid = self._oid(session_id)
        if not oid:
            return None
        return await self.collection.find_one_and_update(
            {"_id": oid, "revoked_at": None},
            {"$set": {"revoked_at": now, "revoked_by": revoked_by}},
        )

    async def revoke_for_user(
        self, user_id: str, now: datetime, revoked_by: str, keep_session_id: Optional[str] = None
    ) -> int:
        query: Dict[str, Any] = {"user_id": user_id, "revoked_at": None}
        keep = self._oid(keep_session_id) if keep_session_id else None
        if keep:
            query["_id"] = {"$ne": keep}
        result = await self.collection.update_many(
            query, {"$set": {"revoked_at": now, "revoked_by": revoked_by}}
        )
        return result.modified_count

    async def list_active(self, now: datetime, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        query = self._active_filter(now)
        if user_id:
            query["user_id"] = user_id
        cursor = self.collection.find(query, {"token": 0, "token_hash": 0}).sort("_id", -1)
        return await cursor.to_list(None)

    async def count_active_by_user(self, now: datetime) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        async for doc in self.collection.find(self._active_filter(now), {"user_id": 1}):
            counts[doc["user_id"]] = counts.get(doc["user_id"], 0) + 1
        return counts

    async def plain_token_sessions(self) -> List[Dict[str, Any]]:
        """Sessions stored before tokens were hashed"""
        return await self.collection.find({"token": {"$exists": True}}, {"token": 1}).to_list(None)

    async def replace_plain_token(self, oid: ObjectId, token_hash: str) -> None:
        await self.collection.update_one(
            {"_id": oid}, {"$set": {"token_hash": token_hash}, "$unset": {"token": ""}}
        )
