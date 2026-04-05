from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple

from app.repositories.base import BaseRepository
from app.models.purchase_order import PurchaseOrderModel


class PurchaseOrderRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "purchase_orders")

    async def get_by_order_id(self, order_id: str) -> Optional[PurchaseOrderModel]:
        order = await self.get_one({"id": order_id})
        return PurchaseOrderModel(**order) if order else None

    async def list_purchase_orders(self, skip: int = 0, limit: int = 10, supplier_id: Optional[str] = None, status: Optional[str] = None) -> Tuple[List[PurchaseOrderModel], int]:
        filter_query = {}
        if supplier_id:
            filter_query["supplier_id"] = supplier_id
        if status:
            filter_query["status"] = status
        docs = await self.get_many(filter_query, skip=skip, limit=limit, sort=[("created_at", -1)])
        total = await self.count(filter_query)
        return [PurchaseOrderModel(**doc) for doc in docs], total
