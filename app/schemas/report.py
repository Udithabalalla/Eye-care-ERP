from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import date

class ReportExportRequest(BaseModel):
    """Schema for report export request"""
    report_type: Literal["sales", "inventory", "patients"]
    format: Literal["csv", "excel", "pdf"]
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "report_type": "sales",
                "format": "excel",
                "start_date": "2024-01-01",
                "end_date": "2024-01-31"
            }
        }
