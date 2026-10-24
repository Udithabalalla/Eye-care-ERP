from pydantic import BaseModel, Field
from typing import Optional, List, Literal

from app.schemas.responses import ResponseModel

ItemKind = Literal["frame", "product"]


# ── Low stock ─────────────────────────────────────────────────────────────────

class LowStockItem(BaseModel):
    kind: ItemKind
    id: str  # variant_id or product_id
    name: str
    detail: Optional[str] = None
    sku: Optional[str] = None
    current_stock: int
    reorder_level: int  # the threshold: variant reorder_level / product min_stock_level
    suggested_qty: int
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = None
    unit_cost: Optional[float] = None
    out_of_stock: bool
    # Frames only: the model the variant belongs to, so lists can flag models that need attention
    frame_master_id: Optional[str] = None


class LowStockResponse(ResponseModel[List[LowStockItem]]):
    total: int = 0


# ── Reorder ───────────────────────────────────────────────────────────────────

class ReorderItem(BaseModel):
    kind: ItemKind
    id: str
    # Omit to order the low-stock suggested quantity
    quantity: Optional[int] = Field(None, gt=0)


class ReorderRequest(BaseModel):
    items: List[ReorderItem] = Field(..., min_length=1)


class ReorderPurchaseOrder(BaseModel):
    order_id: str  # also the PO number shown to users, e.g. PO000012
    status: str
    supplier_id: str
    supplier_name: Optional[str] = None
    line_count: int
    total_quantity: int
    total_amount: float


class ReorderSkippedItem(BaseModel):
    kind: ItemKind
    id: str
    name: Optional[str] = None
    reason: str


class ReorderResult(BaseModel):
    purchase_orders: List[ReorderPurchaseOrder] = Field(default_factory=list)
    skipped: List[ReorderSkippedItem] = Field(default_factory=list)


# ── Labels ────────────────────────────────────────────────────────────────────

class LabelItem(BaseModel):
    kind: ItemKind
    id: str
    copies: int = Field(1, ge=1, le=100)


class LabelPrintRequest(BaseModel):
    items: List[LabelItem] = Field(..., min_length=1, max_length=500)
    label_type: Literal["frame_tag", "shelf_label", "sticker"] = "frame_tag"
