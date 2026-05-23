from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple
from datetime import datetime, timezone
from app.repositories.base import BaseRepository
from app.models.goods_receipt import GoodsReceiptModel


class GoodsReceiptRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "goods_receipts")

    async def get_by_grn_number(self, grn_number: str) -> Optional[GoodsReceiptModel]:
        doc = await self.get_one({"grn_number": grn_number})
        return GoodsReceiptModel(**doc) if doc else None

    async def get_by_id_str(self, id_str: str) -> Optional[GoodsReceiptModel]:
        doc = await self.get_by_id(id_str)
        return GoodsReceiptModel(**doc) if doc else None

    async def list_receipts(
        self,
        skip: int = 0,
        limit: int = 20,
        supplier_id: Optional[str] = None,
        purchase_order_id: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[GoodsReceiptModel], int]:
        query: dict = {}
        if supplier_id:
            query["supplier_id"] = supplier_id
        if purchase_order_id:
            query["purchase_order_id"] = purchase_order_id
        if search:
            query["grn_number"] = {"$regex": search, "$options": "i"}

        docs, total = await self.get_many_with_count(query, skip, limit, sort=[("receipt_date", -1)])
        return [GoodsReceiptModel(**d) for d in docs], total

    async def create_receipt(self, data: GoodsReceiptModel) -> GoodsReceiptModel:
        doc = await self.create(data.dict())
        return GoodsReceiptModel(**doc)

    async def update_receipt(self, grn_number: str, update_data: dict) -> bool:
        update_data["updated_at"] = datetime.now(timezone.utc)
        return await self.update({"grn_number": grn_number}, update_data)

    async def get_next_grn_number(self) -> str:
        year = datetime.now(timezone.utc).year
        count = await self.collection.count_documents({"grn_number": {"$regex": f"^GRN-{year}-"}})
        return f"GRN-{year}-{str(count + 1).zfill(4)}"
