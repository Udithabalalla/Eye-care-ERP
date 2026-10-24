from fastapi import APIRouter, Depends, Response
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Literal, Optional

from app.config.database import get_database
from app.api.deps import get_current_user, require_permission
from app.models.user import UserModel
from app.schemas.responses import ResponseModel
from app.schemas.inventory import (
    LabelPrintRequest,
    LowStockResponse,
    ReorderRequest,
    ReorderResult,
)
from app.services.inventory_service import InventoryService

# Mounted with require_module_access("inventory")
router = APIRouter()
# Printing labels is a POST that changes nothing, so it only needs inventory.read
labels_router = APIRouter()


@router.get("/low-stock", response_model=LowStockResponse)
async def list_low_stock(
    kind: Optional[Literal["frame", "product"]] = None,
    out_of_stock_only: bool = False,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    """Active frame variants (stock <= reorder_level) and products (stock <= min_stock_level)."""
    rows = await InventoryService(db).list_low_stock(kind, out_of_stock_only)
    return LowStockResponse(data=rows, total=len(rows))


@router.post(
    "/reorder",
    response_model=ResponseModel[ReorderResult],
    dependencies=[Depends(require_permission("purchasing.write"))],
)
async def reorder(
    data: ReorderRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    """Create one draft purchase order per supplier; items without a supplier come back in ``skipped``."""
    result = await InventoryService(db).reorder(data, current_user.user_id)
    count = len(result.purchase_orders)
    message = f"Created {count} draft purchase order{'s' if count != 1 else ''}"
    if result.skipped:
        message += f"; {len(result.skipped)} item(s) skipped"
    return ResponseModel(message=message, data=result)


@labels_router.post("/labels")
async def print_labels(
    data: LabelPrintRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    """One PDF with ``copies`` labels for each frame variant / product."""
    pdf_bytes = await InventoryService(db).build_labels_pdf(data)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=labels.pdf"},
    )
