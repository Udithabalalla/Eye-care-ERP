from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config.settings import settings
from app.core.exceptions import NotFoundException
from app.models.company_profile import CompanyProfileModel, InvoiceAppearance
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
        return self._response(profile)

    @staticmethod
    def _response(profile: CompanyProfileModel) -> CompanyProfileResponse:
        data = profile.dict()
        data["invoice_appearance"] = data.get("invoice_appearance") or InvoiceAppearance().dict()
        return CompanyProfileResponse(**data)

    async def update_company_profile(self, data: CompanyProfileUpdate) -> CompanyProfileResponse:
        update_dict = data.dict(exclude_unset=True)
        profile = await self.repo.get_profile()
        if "invoice_appearance" in update_dict:
            # Merge into what's saved, so a change to one setting keeps the others
            saved = (profile.invoice_appearance.dict() if profile and profile.invoice_appearance else {})
            update_dict["invoice_appearance"] = InvoiceAppearance(**{**saved, **(update_dict["invoice_appearance"] or {})}).dict()

        if profile:
            await self.repo.update({"id": "company_profile"}, update_dict)
        else:
            # The first save starts from the defaults shown until now, so saving one setting
            # (the invoice appearance, say) doesn't blank the business name
            defaults = {"company_name": settings.APP_NAME, "company_logo": "Logo.png"}
            profile = CompanyProfileModel(id="company_profile", **{**defaults, **update_dict})
            await self.repo.create(profile.dict())

        updated = await self.repo.get_profile()
        if not updated:
            raise NotFoundException("Company profile not found")
        return self._response(updated)