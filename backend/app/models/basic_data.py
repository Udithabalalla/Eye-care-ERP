from typing import Literal, Optional
from pydantic import BaseModel, Field, ConfigDict

from app.models.common import TimestampModel


class OtherExpenseTypeModel(TimestampModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    name: str
    default_cost: float = Field(default=0, ge=0)
    is_active: bool = True


class LensMasterModel(TimestampModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    lens_type: str
    color: str
    size: str
    price: float = Field(default=0, ge=0)
    lens_code: str
    is_active: bool = True


class ProductCategoryModel(TimestampModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    name: str
    description: Optional[str] = None
    color: Optional[str] = None  # hex color for UI badges
    is_active: bool = True


# Kept for backward-compat with old documents — no new records should be created.
class ComplimentaryItemModel(TimestampModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    name: str
    item_type: Literal["case", "bag"] = "case"
    description: Optional[str] = None
    is_active: bool = True


class CasePriceRuleModel(TimestampModel):
    """Complimentary price rule — maps a frame price range to a product from inventory."""
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    name: str
    min_price: float = Field(default=0, ge=0)
    max_price: Optional[float] = Field(default=None, ge=0)
    product_id: str   # product's custom product_id (e.g. "PRD000001")
    product_name: str  # denormalized
    priority: int = Field(default=0, ge=0)
    is_active: bool = True
