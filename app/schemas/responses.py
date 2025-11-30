from pydantic import BaseModel
from typing import Generic, TypeVar, Optional, List, Any

T = TypeVar('T')

class ResponseModel(BaseModel, Generic[T]):
    """Standard API response model"""
    success: bool = True
    message: str = "Success"
    data: Optional[T] = None

class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated response model"""
    success: bool = True
    data: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int

class ErrorResponse(BaseModel):
    """Error response model"""
    success: bool = False
    message: str
    errors: Optional[List[str]] = None
