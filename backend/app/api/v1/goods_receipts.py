from fastapi import APIRouter, Depends, Query
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config.database import get_database
from app.schemas.goods_receipt import GoodsReceiptCreate, GoodsReceiptUpdate, GoodsReceiptResponse
from app.schemas.responses import ResponseModel, PaginatedResponse
from app.services.goods_receipt_service import GoodsReceiptService
from app.api.deps import get_current_user
from app.models.user import UserModel

router = APIRouter()


@router.get("", response_model=PaginatedResponse[GoodsReceiptResponse])
async def list_goods_receipts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    supplier_id: Optional[str] = None,
    purchase_order_id: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = GoodsReceiptService(db)
    return await service.list_receipts(page, page_size, supplier_id, purchase_order_id, search)


@router.post("", response_model=ResponseModel[GoodsReceiptResponse])
async def create_goods_receipt(
    data: GoodsReceiptCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = GoodsReceiptService(db)
    result = await service.create_receipt(data, created_by=current_user.user_id)
    return ResponseModel(message="Goods receipt created", data=result)


@router.get("/{grn_number}", response_model=ResponseModel[GoodsReceiptResponse])
async def get_goods_receipt(
    grn_number: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = GoodsReceiptService(db)
    result = await service.get_receipt(grn_number)
    return ResponseModel(data=result)


@router.put("/{grn_number}", response_model=ResponseModel[GoodsReceiptResponse])
async def update_goods_receipt(
    grn_number: str,
    data: GoodsReceiptUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = GoodsReceiptService(db)
    result = await service.update_receipt(grn_number, data)
    return ResponseModel(message="Goods receipt updated", data=result)


@router.post("/{grn_number}/commit", response_model=ResponseModel[GoodsReceiptResponse])
async def commit_goods_receipt(
    grn_number: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    """Commit GRN — applies stock increments atomically for all received items."""
    service = GoodsReceiptService(db)
    result = await service.commit_receipt(grn_number, committed_by=current_user.user_id)
    return ResponseModel(message="Goods receipt committed — stock updated", data=result)
