from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional

from app.config.database import get_database
from app.api.deps import get_current_user
from app.models.user import UserModel
from app.schemas.responses import ResponseModel, PaginatedResponse
from app.schemas.sales_order import SalesOrderCreate, SalesOrderUpdate, SalesOrderResponse
from app.services.sales_order_service import SalesOrderService

router = APIRouter()


@router.get("", response_model=PaginatedResponse[SalesOrderResponse])
async def list_sales_orders(page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100), patient_id: Optional[str] = None, status: Optional[str] = None, db: AsyncIOMotorDatabase = Depends(get_database), current_user: UserModel = Depends(get_current_user)):
    return await SalesOrderService(db).list_sales_orders(page, page_size, patient_id, status)


@router.get("/{order_id}", response_model=ResponseModel[SalesOrderResponse])
async def get_sales_order(order_id: str, db: AsyncIOMotorDatabase = Depends(get_database), current_user: UserModel = Depends(get_current_user)):
    order = await SalesOrderService(db).get_sales_order(order_id)
    return ResponseModel(data=order)


@router.post("", response_model=ResponseModel[SalesOrderResponse])
async def create_sales_order(data: SalesOrderCreate, db: AsyncIOMotorDatabase = Depends(get_database), current_user: UserModel = Depends(get_current_user)):
    order = await SalesOrderService(db).create_sales_order(data, current_user.user_id)
    return ResponseModel(message="Sales order created successfully", data=order)


@router.put("/{order_id}", response_model=ResponseModel[SalesOrderResponse])
async def update_sales_order(order_id: str, data: SalesOrderUpdate, db: AsyncIOMotorDatabase = Depends(get_database), current_user: UserModel = Depends(get_current_user)):
    order = await SalesOrderService(db).update_sales_order(order_id, data, current_user.user_id)
    return ResponseModel(message="Sales order updated successfully", data=order)