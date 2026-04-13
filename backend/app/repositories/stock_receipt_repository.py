from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List

from app.repositories.base import BaseRepository
from app.models.stock_receipt import StockReceiptModel


class StockReceiptRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "stock_receipts")

    async def get_by_receipt_id(self, receipt_id: str) -> Optional[StockReceiptModel]:
        receipt = await self.get_one({"id": receipt_id})
        return StockReceiptModel(**receipt) if receipt else None

    async def get_latest_by_purchase_order_id(self, purchase_order_id: str) -> Optional[StockReceiptModel]:
        receipts = await self.get_many({"purchase_order_id": purchase_order_id}, limit=1, sort=[("received_at", -1), ("created_at", -1)])
        if not receipts:
            return None
        return StockReceiptModel(**receipts[0])

    async def list_by_purchase_order_id(self, purchase_order_id: str) -> List[StockReceiptModel]:
        docs = await self.get_many({"purchase_order_id": purchase_order_id}, sort=[("received_at", -1), ("created_at", -1)])
        return [StockReceiptModel(**doc) for doc in docs]