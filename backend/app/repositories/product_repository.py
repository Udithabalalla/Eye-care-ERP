from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple
from datetime import datetime, timezone
from pymongo import ReturnDocument
from app.repositories.base import BaseRepository
from app.models.product import ProductModel

class ProductRepository(BaseRepository):
    """Product repository"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "products")
    
    async def get_by_product_id(self, product_id: str) -> Optional[ProductModel]:
        """Get product by product_id"""
        product_dict = await self.get_one({"product_id": product_id})
        if product_dict:
            return ProductModel(**product_dict)
        return None
    
    async def get_by_sku(self, sku: str) -> Optional[ProductModel]:
        """Get product by SKU"""
        product_dict = await self.get_one({"sku": sku})
        if product_dict:
            return ProductModel(**product_dict)
        return None

    async def get_by_barcode(self, barcode: str) -> Optional[ProductModel]:
        """Get product by barcode"""
        product_dict = await self.get_one({"barcode": barcode})
        if product_dict:
            return ProductModel(**product_dict)
        return None

    async def get_by_scan_code(self, code: str) -> Optional[ProductModel]:
        """Lookup product by barcode first, then SKU, then product ID."""
        code = code.strip()
        if not code:
            return None

        product = await self.get_by_barcode(code)
        if product:
            return product

        product = await self.get_by_sku(code)
        if product:
            return product

        return await self.get_by_product_id(code)
    
    async def list_products(
        self,
        skip: int = 0,
        limit: int = 10,
        search: Optional[str] = None,
        category: Optional[str] = None,
        low_stock: bool = False
    ) -> Tuple[List[ProductModel], int]:
        """List products with filters"""
        filter_query = {"is_active": True}
        
        if search:
            filter_query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"product_id": {"$regex": search, "$options": "i"}},
                {"sku": {"$regex": search, "$options": "i"}},
                {"barcode": {"$regex": search, "$options": "i"}}
            ]
        
        if category:
            filter_query["category"] = category
        
        if low_stock:
            filter_query["$expr"] = {"$lte": ["$current_stock", "$min_stock_level"]}
        
        products_dict = await self.get_many(
            filter=filter_query,
            skip=skip,
            limit=limit,
            sort=[("name", 1)]
        )
        
        total = await self.count(filter_query)
        products = [ProductModel(**p) for p in products_dict]
        
        return products, total
    
    async def create_product(self, product_data: ProductModel) -> ProductModel:
        """Create a new product"""
        product_dict = product_data.dict()
        created = await self.create(product_dict)
        return ProductModel(**created)
    
    async def update_product(self, product_id: str, update_data: dict) -> bool:
        """Update product"""
        update_data["updated_at"] = datetime.now(timezone.utc)
        return await self.update({"product_id": product_id}, update_data)
    
    async def update_stock(self, product_id: str, new_stock: int) -> bool:
        """Update product stock"""
        return await self.update(
            {"product_id": product_id},
            {"current_stock": new_stock, "updated_at": datetime.now(timezone.utc)}
        )

    async def decrement_stock_atomic(self, product_id: str, quantity: int) -> bool:
        """Atomically decrease stock only if enough stock exists."""
        if quantity <= 0:
            return False

        updated_doc = await self.collection.find_one_and_update(
            {
                "product_id": product_id,
                "is_active": True,
                "current_stock": {"$gte": quantity}
            },
            {
                "$inc": {"current_stock": -quantity},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            },
            return_document=ReturnDocument.AFTER,
        )
        return updated_doc is not None

    async def increment_stock_atomic(self, product_id: str, quantity: int) -> bool:
        """Atomically increase stock (used for rollback/reversal)."""
        if quantity <= 0:
            return False

        updated_doc = await self.collection.find_one_and_update(
            {
                "product_id": product_id,
                "is_active": True,
            },
            {
                "$inc": {"current_stock": quantity},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            },
            return_document=ReturnDocument.AFTER,
        )
        return updated_doc is not None
    
    async def get_next_product_number(self) -> int:
        """Get next product number for ID generation"""
        # Find the product with the highest number
        pipeline = [
            {
                "$project": {
                    "product_id": 1,
                    "number": {
                        "$toInt": {
                            "$substr": ["$product_id", 3, -1]  # Extract number after "PRD"
                        }
                    }
                }
            },
            {"$sort": {"number": -1}},
            {"$limit": 1}
        ]
        
        result = await self.collection.aggregate(pipeline).to_list(length=1)
        
        if result:
            return result[0]["number"] + 1
        return 1
