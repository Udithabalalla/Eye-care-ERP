from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config.database import get_database
from app.api.deps import get_current_user
from app.models.user import UserModel
from app.schemas.responses import ResponseModel
from app.schemas.company_profile import CompanyProfileResponse, CompanyProfileUpdate
from app.services.company_profile_service import CompanyProfileService


router = APIRouter()


@router.get("/company-profile", response_model=ResponseModel[CompanyProfileResponse])
async def get_company_profile(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    profile = await CompanyProfileService(db).get_company_profile()
    return ResponseModel(data=profile)


@router.put("/company-profile", response_model=ResponseModel[CompanyProfileResponse])
async def update_company_profile(
    profile_data: CompanyProfileUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    profile = await CompanyProfileService(db).update_company_profile(profile_data)
    return ResponseModel(message="Company profile updated successfully", data=profile)