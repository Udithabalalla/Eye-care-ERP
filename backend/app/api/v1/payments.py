from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional

from app.config.database import get_database
from app.api.deps import get_current_user
from app.models.user import UserModel
from app.schemas.responses import ResponseModel, PaginatedResponse
from app.schemas.payment import PaymentCreate, PaymentResponse
from app.services.payment_service import PaymentService

router = APIRouter()


@router.get("", response_model=PaginatedResponse[PaymentResponse])
async def list_payments(page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100), reference_type: Optional[str] = None, reference_id: Optional[str] = None, db: AsyncIOMotorDatabase = Depends(get_database), current_user: UserModel = Depends(get_current_user)):
    return await PaymentService(db).list_payments(page, page_size, reference_type, reference_id)


@router.post("", response_model=ResponseModel[PaymentResponse])
async def create_payment(data: PaymentCreate, db: AsyncIOMotorDatabase = Depends(get_database), current_user: UserModel = Depends(get_current_user)):
    payment = await PaymentService(db).create_payment(data, current_user.user_id)
    return ResponseModel(message="Payment recorded successfully", data=payment)