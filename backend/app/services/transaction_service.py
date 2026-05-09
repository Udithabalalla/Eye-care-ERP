from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
from datetime import datetime, date, timezone, timedelta
import math

from app.repositories.transaction_repository import TransactionRepository
from app.schemas.transaction import TransactionCreate, TransactionResponse
from app.schemas.responses import PaginatedResponse
from app.utils.helpers import generate_id


class TransactionService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = TransactionRepository(db)

    async def create_transaction(self, data: TransactionCreate, created_by: str) -> TransactionResponse:
        next_number = await self.repo.count({}) + 1
        transaction_id = generate_id("TRX", next_number)
        payload = {
            "transaction_id": transaction_id,
            **data.dict(),
            "created_by": created_by,
            "created_at": datetime.now(timezone.utc),
        }
        await self.repo.create(payload)
        created = await self.repo.get_by_transaction_id(transaction_id)
        return TransactionResponse(**created.dict())

    async def list_transactions(self, page: int, page_size: int, transaction_type: Optional[str] = None, payment_method: Optional[str] = None, reference_type: Optional[str] = None, start_date: Optional[date] = None, end_date: Optional[date] = None):
        skip = (page - 1) * page_size
        query = {}
        if transaction_type:
            query["transaction_type"] = transaction_type
        if payment_method:
            query["payment_method"] = payment_method
        if reference_type:
            query["reference_type"] = reference_type
        if start_date or end_date:
            query["created_at"] = {}
            if start_date:
                query["created_at"]["$gte"] = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)
            if end_date:
                query["created_at"]["$lt"] = datetime.combine(end_date + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
        transactions, total = await self.repo.list_transactions(skip=skip, limit=page_size, filters=query)
        total_pages = math.ceil(total / page_size)
        return PaginatedResponse(
            data=[TransactionResponse(**item.dict()) for item in transactions],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )