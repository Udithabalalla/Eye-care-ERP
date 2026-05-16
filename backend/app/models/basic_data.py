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


class ComplimentaryItemModel(TimestampModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    name: str
    item_type: Literal["case", "bag"] = "case"
    description: Optional[str] = None
    is_active: bool = True


class CasePriceRuleModel(TimestampModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    name: str
    min_price: float = Field(default=0, ge=0)
    max_price: Optional[float] = Field(default=None, ge=0)
    item_id: str
    item_name: str
    priority: int = Field(default=0, ge=0)
    is_active: bool = True
