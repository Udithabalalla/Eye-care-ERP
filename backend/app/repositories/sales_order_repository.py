from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple

from app.repositories.base import BaseRepository
from app.models.sales_order import SalesOrderModel


class SalesOrderRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "sales_orders")

    async def get_by_order_id(self, order_id: str) -> Optional[SalesOrderModel]:
        order = await self.get_one({"order_id": order_id})
        return SalesOrderModel(**order) if order else None

    async def get_by_order_number(self, order_number: str) -> Optional[SalesOrderModel]:
        order = await self.get_one({"order_number": order_number})
        return SalesOrderModel(**order) if order else None

    async def list_sales_orders(self, skip: int = 0, limit: int = 10, patient_id: Optional[str] = None, status: Optional[str] = None) -> Tuple[List[SalesOrderModel], int]:
        query = {}
        if patient_id:
            query["patient_id"] = patient_id
        if status:
            query["status"] = status
        orders = await self.get_many(filter=query, skip=skip, limit=limit, sort=[("created_at", -1)])
        total = await self.count(query)
        return [SalesOrderModel(**order) for order in orders], total