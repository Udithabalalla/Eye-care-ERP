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


# ── Product Categories ────────────────────────────────────────────────────────

class ProductCategoryCreate(BaseModel):
    name: str = Field(..., min_length=2)
    description: Optional[str] = None
    color: Optional[str] = None
    is_active: bool = True


class ProductCategoryUpdate(BaseModel):
    name: str | None = None
    description: Optional[str] = None
    color: Optional[str] = None
    is_active: bool | None = None


class ProductCategoryStatusUpdate(BaseModel):
    is_active: bool


class ProductCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ── Complimentary Price Rules ─────────────────────────────────────────────────

class CasePriceRuleCreate(BaseModel):
    name: str = Field(..., min_length=2)
    min_price: float = Field(default=0, ge=0)
    max_price: Optional[float] = Field(default=None, ge=0)
    product_id: str = Field(..., min_length=1)   # product's custom product_id
    product_name: str = Field(..., min_length=1)  # denormalized
    priority: int = Field(default=0, ge=0)
    is_active: bool = True


class CasePriceRuleUpdate(BaseModel):
    name: str | None = None
    min_price: float | None = Field(default=None, ge=0)
    max_price: Optional[float] = None
    product_id: str | None = None
    product_name: str | None = None
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
    product_id: str = ""
    product_name: str = ""
    priority: int = 0
    is_active: bool = True
    created_at: datetime
    updated_at: datetime


class ComplimentaryProductSuggestion(BaseModel):
    """Product suggested by a complimentary price rule."""
    rule_id: str
    rule_name: str
    product_id: str       # custom product_id (e.g. "PRD000001")
    product_name: str
    sku: str
    category: str


# Kept for backward-compat — old endpoints still use this
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
