from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.base import BaseRepository
from app.models.company_profile import CompanyProfileModel


class CompanyProfileRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "company_profiles")

    async def get_profile(self) -> Optional[CompanyProfileModel]:
        profile = await self.get_one({"id": "company_profile"})
        return CompanyProfileModel(**profile) if profile else None