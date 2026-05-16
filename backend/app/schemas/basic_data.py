from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class OtherExpenseTypeCreate(BaseModel):
    name: str = Field(..., min_length=2)
    default_cost: float = Field(default=0, ge=0)
    is_active: bool = True


class OtherExpenseTypeUpdate(BaseModel):
    name: str | None = None
    default_cost: float | None = Field(default=None, ge=0)
    is_active: bool | None = None


class OtherExpenseTypeStatusUpdate(BaseModel):
    is_active: bool


class OtherExpenseTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    name: str
    default_cost: float
    is_active: bool
    created_at: datetime
    updated_at: datetime


class LensMasterCreate(BaseModel):
    lens_type: str = Field(..., min_length=2)
    color: str = Field(..., min_length=1)
    size: str = Field(..., min_length=1)
    price: float = Field(default=0, ge=0)
    lens_code: str = Field(..., min_length=1)
    is_active: bool = True


class LensMasterUpdate(BaseModel):
    lens_type: str | None = None
    color: str | None = None
    size: str | None = None
    price: float | None = Field(default=None, ge=0)
    lens_code: str | None = None
    is_active: bool | None = None


class LensMasterStatusUpdate(BaseModel):
    is_active: bool


class LensMasterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    lens_type: str
    color: str
    size: str
    price: float
    lens_code: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ComplimentaryItemCreate(BaseModel):
    name: str = Field(..., min_length=2)
    item_type: Literal["case", "bag"] = "case"
    description: Optional[str] = None
    is_active: bool = True


class ComplimentaryItemUpdate(BaseModel):
    name: str | None = None
    item_type: Literal["case", "bag"] | None = None
    description: Optional[str] = None
    is_active: bool | None = None


class ComplimentaryItemStatusUpdate(BaseModel):
    is_active: bool


class ComplimentaryItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    name: str
    item_type: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CasePriceRuleCreate(BaseModel):
    name: str = Field(..., min_length=2)
    min_price: float = Field(default=0, ge=0)
    max_price: Optional[float] = Field(default=None, ge=0)
    item_id: str = Field(..., min_length=1)
    item_name: str = Field(..., min_length=1)
    priority: int = Field(default=0, ge=0)
    is_active: bool = True


class CasePriceRuleUpdate(BaseModel):
    name: str | None = None
    min_price: float | None = Field(default=None, ge=0)
    max_price: Optional[float] = None
    item_id: str | None = None
    item_name: str | None = None
    priority: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class CasePriceRuleStatusUpdate(BaseModel):
    is_active: bool


class CasePriceRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    name: str
    min_price: float
    max_price: Optional[float] = None
    item_id: str
    item_name: str
    priority: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
