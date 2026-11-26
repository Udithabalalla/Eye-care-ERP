from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TesterCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    title: str | None = Field(default=None, max_length=60)


class TesterUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    title: str | None = Field(default=None, max_length=60)


class TesterStatusUpdate(BaseModel):
    is_active: bool


class TesterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    name: str
    title: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
