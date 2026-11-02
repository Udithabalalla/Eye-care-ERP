from typing import Any, Dict, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.base import BaseRepository


class SignupRequestRepository(BaseRepository):
    """Sign-ups waiting for their email code; one per address"""

    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "signup_requests")

    async def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        return await self.collection.find_one({"email": email})

    async def replace(self, data: Dict[str, Any]) -> None:
        await self.collection.delete_many({"email": data["email"]})
        await self.collection.insert_one(data)

    async def set_attempts(self, email: str, attempts: int) -> None:
        await self.collection.update_one({"email": email}, {"$set": {"attempts": attempts}})

    async def delete_for_email(self, email: str) -> None:
        await self.collection.delete_many({"email": email})
