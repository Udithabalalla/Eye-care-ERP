from datetime import datetime
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
