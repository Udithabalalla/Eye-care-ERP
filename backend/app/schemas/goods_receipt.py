from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.goods_receipt import GoodsReceiptItem


class GoodsReceiptCreate(BaseModel):
    purchase_order_id: Optional[str] = None
    supplier_id: str
    receipt_date: Optional[datetime] = None
    items: List[GoodsReceiptItem]
    notes: Optional[str] = None


class GoodsReceiptUpdate(BaseModel):
    items: Optional[List[GoodsReceiptItem]] = None
    notes: Optional[str] = None


class GoodsReceiptResponse(BaseModel):
    id: Optional[str] = None
    grn_number: str
    purchase_order_id: Optional[str]
    supplier_id: str
    receipt_date: datetime
    items: List[GoodsReceiptItem]
    status: str
    notes: Optional[str]
    created_by: Optional[str]
    committed_at: Optional[datetime] = None
    committed_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class GoodsReceiptPrefill(BaseModel):
    """Outstanding frame lines of a purchase order, ready to count into a GRN."""
    supplier_id: str
    purchase_order_id: str
    items: List[GoodsReceiptItem]
