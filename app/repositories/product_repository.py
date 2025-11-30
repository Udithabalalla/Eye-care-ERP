from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple
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
        from datetime import datetime
        update_data["updated_at"] = datetime.utcnow()
        return await self.update({"product_id": product_id}, update_data)
    
    async def update_stock(self, product_id: str, new_stock: int) -> bool:
        """Update product stock"""
        from datetime import datetime
        return await self.update(
            {"product_id": product_id},
            {"current_stock": new_stock, "updated_at": datetime.utcnow()}
        )
    
    async def get_next_product_number(self) -> int:
        """Get next product number for ID generation"""
        last_product = await self.get_many(
            filter={},
            skip=0,
            limit=1,
            sort=[("created_at", -1)]
        )
        
        if last_product:
            last_id = last_product[0].get("product_id", "PRD000000")
            number = int(last_id.replace("PRD", ""))
            return number + 1
        return 1
