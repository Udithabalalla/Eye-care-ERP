from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple
from datetime import datetime
from app.repositories.base import BaseRepository
from app.models.purchase_order import PurchaseOrderModel


class PurchaseOrderRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "purchase_orders")

    async def get_by_order_id(self, order_id: str) -> Optional[PurchaseOrderModel]:
        doc = await self.get_one({"id": order_id})
        if doc:
            return PurchaseOrderModel(**doc)
        return None

    async def list_purchase_orders(self, skip: int = 0, limit: int = 10, supplier_id: Optional[str] = None, status: Optional[str] = None) -> Tuple[List[PurchaseOrderModel], int]:
        filter_query = {}
        if supplier_id:
            filter_query["supplier_id"] = supplier_id
        if status:
            filter_query["status"] = status

        docs, total = await self.get_many_with_count(filter_query, skip, limit, sort=[("created_at", -1)])
        orders = [PurchaseOrderModel(**d) for d in docs]
        return orders, total

    async def push_status_history(self, order_id: str, entry: dict) -> None:
        await self.collection.update_one(
            {"id": order_id},
            {"$push": {"status_history": entry}},
        )
