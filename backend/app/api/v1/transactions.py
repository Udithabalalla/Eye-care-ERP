from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
from datetime import date

from app.config.database import get_database
from app.api.deps import get_current_user
from app.models.user import UserModel
from app.schemas.responses import ResponseModel, PaginatedResponse
from app.schemas.transaction import TransactionCreate, TransactionResponse
from app.services.transaction_service import TransactionService

router = APIRouter()


@router.get("", response_model=PaginatedResponse[TransactionResponse])
async def list_transactions(page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100), transaction_type: Optional[str] = None, payment_method: Optional[str] = None, reference_type: Optional[str] = None, start_date: Optional[date] = None, end_date: Optional[date] = None, db: AsyncIOMotorDatabase = Depends(get_database), current_user: UserModel = Depends(get_current_user)):
    return await TransactionService(db).list_transactions(page, page_size, transaction_type, payment_method, reference_type, start_date, end_date)


@router.post("", response_model=ResponseModel[TransactionResponse])
async def create_transaction(data: TransactionCreate, db: AsyncIOMotorDatabase = Depends(get_database), current_user: UserModel = Depends(get_current_user)):
    transaction = await TransactionService(db).create_transaction(data, current_user.user_id)
    return ResponseModel(message="Transaction recorded successfully", data=transaction)