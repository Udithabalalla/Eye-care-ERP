from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config.settings import settings
from app.core.exceptions import NotFoundException
from app.models.company_profile import CompanyProfileModel
from app.repositories.company_profile_repository import CompanyProfileRepository
from app.schemas.company_profile import CompanyProfileUpdate, CompanyProfileResponse


class CompanyProfileService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = CompanyProfileRepository(db)

    async def get_company_profile(self) -> CompanyProfileResponse:
        profile = await self.repo.get_profile()
        if not profile:
            profile = CompanyProfileModel(
                company_name=settings.APP_NAME,
                company_logo="Logo.png",
            )
        return CompanyProfileResponse(**profile.dict())

    async def update_company_profile(self, data: CompanyProfileUpdate) -> CompanyProfileResponse:
        update_dict = data.dict(exclude_unset=True)
        profile = await self.repo.get_profile()

        if profile:
            await self.repo.update({"id": "company_profile"}, update_dict)
        else:
            profile = CompanyProfileModel(id="company_profile", **update_dict)
            await self.repo.create(profile.dict())

        updated = await self.repo.get_profile()
        if not updated:
            raise NotFoundException("Company profile not found")
        return CompanyProfileResponse(**updated.dict())