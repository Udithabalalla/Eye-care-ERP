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
