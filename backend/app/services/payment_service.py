from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
import math
from typing import Optional

from app.repositories.payment_repository import PaymentRepository
from app.schemas.payment import PaymentCreate, PaymentResponse
from app.schemas.responses import PaginatedResponse
from app.schemas.transaction import TransactionCreate
from app.services.transaction_service import TransactionService
from app.utils.constants import LedgerReferenceType, LedgerTransactionType
from app.utils.helpers import generate_id, date_to_datetime


class PaymentService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = PaymentRepository(db)
        self.transaction_service = TransactionService(db)

    async def create_payment(self, data: PaymentCreate, created_by: str) -> PaymentResponse:
        next_number = await self.repo.count({}) + 1
        payment_id = generate_id("PAY", next_number)
        payment_date = date_to_datetime(data.payment_date)
        transaction_type = self._map_transaction_type(data.reference_type)
        transaction = await self.transaction_service.create_transaction(
            TransactionCreate(
                transaction_type=transaction_type,
                reference_type=data.reference_type,
                reference_id=data.reference_id,
                amount=data.amount,
                payment_method=data.payment_method,
            ),
            created_by=created_by,
        )
        payload = {
            "payment_id": payment_id,
            "amount": data.amount,
            "payment_method": data.payment_method,
            "reference_type": data.reference_type,
            "reference_id": data.reference_id,
            "payment_date": payment_date,
            "created_by": created_by,
            "transaction_id": transaction.transaction_id,
        }
        await self.repo.create(payload)
        created = await self.repo.get_by_payment_id(payment_id)
        return PaymentResponse(**created.dict())

    async def list_payments(self, page: int, page_size: int, reference_type: Optional[str] = None, reference_id: Optional[str] = None):
        skip = (page - 1) * page_size
        payments, total = await self.repo.list_payments(skip=skip, limit=page_size, reference_type=reference_type, reference_id=reference_id)
        total_pages = math.ceil(total / page_size)
        return PaginatedResponse(
            data=[PaymentResponse(**item.dict()) for item in payments],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    @staticmethod
    def _map_transaction_type(reference_type: LedgerReferenceType) -> LedgerTransactionType:
        if reference_type in {LedgerReferenceType.INVOICE, LedgerReferenceType.SALES_ORDER}:
            return LedgerTransactionType.SALE
        if reference_type in {LedgerReferenceType.PURCHASE_ORDER, LedgerReferenceType.SUPPLIER_INVOICE}:
            return LedgerTransactionType.SUPPLIER_PAYMENT
        return LedgerTransactionType.CUSTOMER_PAYMENT