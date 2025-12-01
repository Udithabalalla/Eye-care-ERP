from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional

from app.config.database import get_database
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse, StockAdjustment
from app.schemas.responses import ResponseModel, PaginatedResponse
from app.services.product_service import ProductService
from app.api.deps import get_current_user
from app.models.user import UserModel

router = APIRouter()

@router.get("", response_model=PaginatedResponse[ProductResponse])
async def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    category: Optional[str] = None,
    low_stock: bool = False,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """List all products with filters"""
    product_service = ProductService(db)
    return await product_service.list_products(page, page_size, search, category, low_stock)

@router.get("/{product_id}", response_model=ResponseModel[ProductResponse])
async def get_product(
    product_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Get product by ID"""
    product_service = ProductService(db)
    product = await product_service.get_product(product_id)
    return ResponseModel(data=product)

@router.post("", response_model=ResponseModel[ProductResponse])
async def create_product(
    product_data: ProductCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Create a new product"""
    product_service = ProductService(db)
    product = await product_service.create_product(product_data)
    return ResponseModel(
        message="Product created successfully",
        data=product
    )

@router.put("/{product_id}", response_model=ResponseModel[ProductResponse])
async def update_product(
    product_id: str,
    product_data: ProductUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Update product"""
    product_service = ProductService(db)
    product = await product_service.update_product(product_id, product_data)
    return ResponseModel(
        message="Product updated successfully",
        data=product
    )

@router.post("/{product_id}/adjust-stock")
async def adjust_stock(
    product_id: str,
    adjustment: StockAdjustment,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Adjust product stock"""
    product_service = ProductService(db)
    await product_service.adjust_stock(product_id, adjustment)
    return ResponseModel(message="Stock adjusted successfully")

@router.delete("/{product_id}")
async def delete_product(
    product_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Delete a product"""
    product_service = ProductService(db)
    await product_service.delete_product(product_id)
    return ResponseModel(message="Product deleted successfully")

@router.get("/{product_id}/qr")
async def get_product_qr(
    product_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Get product QR code"""
    from fastapi.responses import Response
    from app.services.qr_service import QRService
    
    product_service = ProductService(db)
    product = await product_service.get_product(product_id)
    
    # Generate QR for the SKU
    qr_bytes = QRService.generate_qr_code(product.sku)
    return Response(content=qr_bytes, media_type="image/png")

@router.get("/{product_id}/label")
async def get_product_label(
    product_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Get printable product label"""
    from fastapi.responses import Response
    from app.services.qr_service import QRService
    
    product_service = ProductService(db)
    product = await product_service.get_product(product_id)
    
    # Generate Label
    label_bytes = QRService.generate_product_label(
        product_name=product.name,
        sku=product.sku,
        price=product.selling_price
    )
    return Response(content=label_bytes, media_type="image/png")
