from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple
from datetime import datetime, timezone
from pymongo import ReturnDocument
from app.repositories.base import BaseRepository
from app.models.frame_variant import FrameVariantModel


class FrameVariantRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "frame_variants")

    async def get_by_variant_id(self, variant_id: str) -> Optional[FrameVariantModel]:
        doc = await self.get_one({"variant_id": variant_id})
        return FrameVariantModel(**doc) if doc else None

    async def get_by_sku(self, sku: str) -> Optional[FrameVariantModel]:
        doc = await self.get_one({"sku": sku})
        return FrameVariantModel(**doc) if doc else None

    async def get_by_barcode(self, barcode: str) -> Optional[FrameVariantModel]:
        doc = await self.get_one({"barcode": barcode})
        return FrameVariantModel(**doc) if doc else None

    async def get_by_scan_code(self, code: str) -> Optional[FrameVariantModel]:
        """Lookup by barcode → SKU → variant_id."""
        code = code.strip()
        return (
            await self.get_by_barcode(code)
            or await self.get_by_sku(code)
            or await self.get_by_variant_id(code)
        )

    async def list_variants(
        self,
        skip: int = 0,
        limit: int = 50,
        search: Optional[str] = None,
        frame_master_id: Optional[str] = None,
        brand: Optional[str] = None,
        color: Optional[str] = None,
        rim_type: Optional[str] = None,
        supplier_id: Optional[str] = None,
        low_stock: bool = False,
        out_of_stock: bool = False,
        is_active: Optional[bool] = True,
    ) -> Tuple[List[FrameVariantModel], int]:
        query: dict = {}
        if is_active is not None:
            query["is_active"] = is_active
        if search:
            query["$or"] = [
                {"sku": {"$regex": search, "$options": "i"}},
                {"barcode": {"$regex": search, "$options": "i"}},
                {"color": {"$regex": search, "$options": "i"}},
                {"frame_master_ref.brand": {"$regex": search, "$options": "i"}},
                {"frame_master_ref.model_code": {"$regex": search, "$options": "i"}},
                {"frame_master_ref.frame_name": {"$regex": search, "$options": "i"}},
            ]
        if frame_master_id:
            query["frame_master_id"] = frame_master_id
        if brand:
            query["frame_master_ref.brand"] = {"$regex": f"^{brand}$", "$options": "i"}
        if color:
            query["color"] = {"$regex": color, "$options": "i"}
        if rim_type:
            query["rim_type"] = rim_type
        if supplier_id:
            query["supplier_id"] = supplier_id
        if out_of_stock:
            query["current_stock"] = 0
        elif low_stock:
            query["$expr"] = {"$lte": ["$current_stock", "$reorder_level"]}

        docs, total = await self.get_many_with_count(
            query, skip, limit,
            sort=[("frame_master_ref.brand", 1), ("frame_master_ref.model_code", 1), ("color", 1), ("eye_size", 1)]
        )
        return [FrameVariantModel(**d) for d in docs], total

    async def list_for_master(self, frame_master_id: str) -> List[FrameVariantModel]:
        docs = await self.get_many({"frame_master_id": frame_master_id, "is_active": True}, limit=0)
        return [FrameVariantModel(**d) for d in docs]

    async def create_variant(self, data: FrameVariantModel) -> FrameVariantModel:
        doc = await self.create(data.dict())
        return FrameVariantModel(**doc)

    async def create_variants_bulk(self, variants: List[FrameVariantModel]) -> List[str]:
        docs = [v.dict() for v in variants]
        return await self.create_many(docs)

    async def update_variant(self, variant_id: str, update_data: dict) -> bool:
        update_data["updated_at"] = datetime.now(timezone.utc)
        return await self.update({"variant_id": variant_id}, update_data)

    async def increment_stock_atomic(self, variant_id: str, qty: int) -> Optional[FrameVariantModel]:
        doc = await self.collection.find_one_and_update(
            {"variant_id": variant_id, "is_active": True},
            {"$inc": {"current_stock": qty}, "$set": {"updated_at": datetime.now(timezone.utc)}},
            return_document=ReturnDocument.AFTER,
        )
        if doc:
            doc["_id"] = str(doc["_id"])
            return FrameVariantModel(**doc)
        return None

    async def decrement_stock_atomic(self, variant_id: str, qty: int) -> Optional[FrameVariantModel]:
        doc = await self.collection.find_one_and_update(
            {"variant_id": variant_id, "is_active": True, "current_stock": {"$gte": qty}},
            {"$inc": {"current_stock": -qty}, "$set": {"updated_at": datetime.now(timezone.utc)}},
            return_document=ReturnDocument.AFTER,
        )
        if doc:
            doc["_id"] = str(doc["_id"])
            return FrameVariantModel(**doc)
        return None

    async def set_stock_atomic(self, variant_id: str, new_stock: int) -> bool:
        return await self.update({"variant_id": variant_id}, {"current_stock": new_stock})

    async def get_next_variant_number(self) -> int:
        pipeline = [
            {"$project": {"num": {"$toInt": {"$substr": ["$variant_id", 3, -1]}}}},
            {"$sort": {"num": -1}},
            {"$limit": 1},
        ]
        result = await self.collection.aggregate(pipeline).to_list(length=1)
        return (result[0]["num"] + 1) if result else 1

    async def sku_exists(self, sku: str) -> bool:
        return await self.exists({"sku": sku})

    async def get_stock_summary_for_master(self, frame_master_id: str) -> dict:
        pipeline = [
            {"$match": {"frame_master_id": frame_master_id, "is_active": True}},
            {"$group": {
                "_id": None,
                "total_stock": {"$sum": "$current_stock"},
                "variant_count": {"$sum": 1},
                "low_stock_count": {"$sum": {"$cond": [{"$lte": ["$current_stock", "$reorder_level"]}, 1, 0]}}
            }}
        ]
        result = await self.collection.aggregate(pipeline).to_list(length=1)
        if result:
            return {"total_stock": result[0]["total_stock"], "variant_count": result[0]["variant_count"], "low_stock_count": result[0]["low_stock_count"]}
        return {"total_stock": 0, "variant_count": 0, "low_stock_count": 0}

    async def get_distinct_colors(self) -> List[str]:
        colors = await self.collection.distinct("color", {"is_active": True})
        return sorted(colors)
