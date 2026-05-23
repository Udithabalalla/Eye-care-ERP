from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.quick_intake import QuickIntakeItem


class QuickIntakeCreate(BaseModel):
    supplier_id: Optional[str] = None
    intake_date: Optional[datetime] = None
    items: List[QuickIntakeItem] = Field(default_factory=list)
    notes: Optional[str] = None


class QuickIntakeUpdate(BaseModel):
    supplier_id: Optional[str] = None
    items: Optional[List[QuickIntakeItem]] = None
    notes: Optional[str] = None


class QuickIntakeResponse(BaseModel):
    id: Optional[str] = None
    intake_id: str
    supplier_id: Optional[str]
    intake_date: datetime
    items: List[QuickIntakeItem]
    status: str
    notes: Optional[str]
    committed_at: Optional[datetime]
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime
    total_cost: Optional[float] = 0.0
    total_qty: Optional[int] = 0
