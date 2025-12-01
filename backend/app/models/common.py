from pydantic import BaseModel, Field
from datetime import datetime, timezone
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

def now_utc():
    """Get current UTC datetime"""
    return datetime.now(timezone.utc)

class TimestampModel(BaseModel):
    """Base model with timestamps"""
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)

class Address(BaseModel):
    """Address model"""
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: str = "USA"
