from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
import math

from app.repositories.product_repository import ProductRepository
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse, StockAdjustment
from app.schemas.responses import PaginatedResponse
from app.models.product import ProductModel
from app.core.exceptions import NotFoundException, BadRequestException, ConflictException
from app.utils.helpers import generate_id

class ProductService:
    """Product business logic service"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.product_repo = ProductRepository(db)
    
    async def list_products(
        self,
        page: int,
        page_size: int,
        search: Optional[str] = None,
        category: Optional[str] = None,
        low_stock: bool = False
    ) -> PaginatedResponse[ProductResponse]:
        """List products with filters"""
        skip = (page - 1) * page_size
        
        products, total = await self.product_repo.list_products(
            skip=skip,
            limit=page_size,
            search=search,
            category=category,
            low_stock=low_stock
        )
        
        total_pages = math.ceil(total / page_size)
        product_responses = [ProductResponse(**p.dict()) for p in products]
        
        return PaginatedResponse(
            data=product_responses,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
    
    async def get_product(self, product_id: str) -> ProductResponse:
        """Get product by ID"""
        product = await self.product_repo.get_by_product_id(product_id)
        
        if not product:
            raise NotFoundException(f"Product with ID {product_id} not found")
        
        return ProductResponse(**product.dict())
    
    async def create_product(self, product_data: ProductCreate) -> ProductResponse:
        """Create a new product"""
        # Check if SKU already exists
        existing = await self.product_repo.get_by_sku(product_data.sku)
        if existing:
            raise ConflictException("Product with this SKU already exists")
        
        # Generate product ID
        next_number = await self.product_repo.get_next_product_number()
        product_id = generate_id("PRD", next_number)
        
        # Create product model
        product_model = ProductModel(
            product_id=product_id,
            **product_data.dict()
        )
        
        # Save to database
        created_product = await self.product_repo.create_product(product_model)
        
        return ProductResponse(**created_product.dict())
    
    async def update_product(
        self,
        product_id: str,
        product_data: ProductUpdate
    ) -> ProductResponse:
        """Update product"""
        existing = await self.product_repo.get_by_product_id(product_id)
        if not existing:
            raise NotFoundException(f"Product with ID {product_id} not found")
        
        update_dict = product_data.dict(exclude_unset=True)
        
        if update_dict:
            await self.product_repo.update_product(product_id, update_dict)
        
        updated_product = await self.product_repo.get_by_product_id(product_id)
        return ProductResponse(**updated_product.dict())
    
    async def adjust_stock(
        self,
        product_id: str,
        adjustment: StockAdjustment
    ):
        """Adjust product stock"""
        product = await self.product_repo.get_by_product_id(product_id)
        if not product:
            raise NotFoundException(f"Product with ID {product_id} not found")
        
        new_stock = product.current_stock + adjustment.quantity
        
        if new_stock < 0:
            raise BadRequestException("Stock cannot be negative")
        
        await self.product_repo.update_stock(product_id, new_stock)
    
    async def delete_product(self, product_id: str):
        """Soft delete a product"""
        existing = await self.product_repo.get_by_product_id(product_id)
        if not existing:
            raise NotFoundException(f"Product with ID {product_id} not found")
        
        await self.product_repo.update_product(product_id, {"is_active": False})
