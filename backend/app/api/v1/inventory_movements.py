from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional

from app.config.database import get_database
from app.api.deps import get_current_user
from app.models.user import UserModel
from app.schemas.responses import ResponseModel, PaginatedResponse
from app.schemas.inventory_movement import InventoryMovementCreate, InventoryMovementResponse
from app.services.inventory_movement_service import InventoryMovementService

router = APIRouter()


@router.get("", response_model=PaginatedResponse[InventoryMovementResponse])
async def list_inventory_movements(page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100), product_id: Optional[str] = None, reference_type: Optional[str] = None, db: AsyncIOMotorDatabase = Depends(get_database), current_user: UserModel = Depends(get_current_user)):
    return await InventoryMovementService(db).list_movements(page, page_size, product_id, reference_type)


@router.post("", response_model=ResponseModel[InventoryMovementResponse])
async def create_inventory_movement(data: InventoryMovementCreate, db: AsyncIOMotorDatabase = Depends(get_database), current_user: UserModel = Depends(get_current_user)):
    movement = await InventoryMovementService(db).create_movement(data, current_user.user_id)
    return ResponseModel(message="Inventory movement recorded successfully", data=movement)