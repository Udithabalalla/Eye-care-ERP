from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class PyObjectId(str):
    """Custom type for MongoDB ObjectId"""
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        from bson import ObjectId
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return str(v)

class TimestampModel(BaseModel):
    """Base model with timestamps"""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Address(BaseModel):
    """Address model"""
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: str = "USA"
