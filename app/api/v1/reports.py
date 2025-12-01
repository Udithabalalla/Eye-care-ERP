from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
from datetime import date
import io

from app.config.database import get_database
from app.schemas.report import ReportExportRequest
from app.schemas.responses import ResponseModel
from app.services.report_service import ReportService
from app.api.deps import get_current_user
from app.models.user import UserModel

router = APIRouter()

@router.get("/sales")
async def get_sales_report(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Generate sales report"""
    report_service = ReportService(db)
    report_data = await report_service.get_sales_report(start_date, end_date)
    return ResponseModel(
        message="Sales report generated successfully",
        data=report_data
    )

@router.get("/inventory")
async def get_inventory_report(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Generate inventory report"""
    report_service = ReportService(db)
    report_data = await report_service.get_inventory_report()
    return ResponseModel(
        message="Inventory report generated successfully",
        data=report_data
    )

@router.get("/patients")
async def get_patient_report(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Generate patient report"""
    report_service = ReportService(db)
    report_data = await report_service.get_patient_report(start_date, end_date)
    return ResponseModel(
        message="Patient report generated successfully",
        data=report_data
    )

@router.post("/export")
async def export_report(
    export_request: ReportExportRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Export report in specified format"""
    report_service = ReportService(db)
    
    # Generate report data based on type
    if export_request.report_type == "sales":
        report = await report_service.get_sales_report(
            export_request.start_date,
            export_request.end_date
        )
        data = report["invoices"]
        summary = report["summary"]
        filename = f"sales_report_{export_request.start_date or 'all'}_{export_request.end_date or 'all'}"
    elif export_request.report_type == "inventory":
        report = await report_service.get_inventory_report()
        data = report["products"]
        summary = report["summary"]
        filename = "inventory_report"
    elif export_request.report_type == "patients":
        report = await report_service.get_patient_report(
            export_request.start_date,
            export_request.end_date
        )
        data = report["patients"]
        summary = report["summary"]
        filename = f"patient_report_{export_request.start_date or 'all'}_{export_request.end_date or 'all'}"
    else:
        return ResponseModel(success=False, message="Invalid report type")
    
    # Clean data for export (remove complex nested objects and convert dates)
    cleaned_data = []
    for item in data:
        cleaned_item = {}
        for key, value in item.items():
            if isinstance(value, (str, int, float, bool, type(None))):
                cleaned_item[key] = value
            elif isinstance(value, (datetime, date)):
                cleaned_item[key] = value.isoformat()
            elif isinstance(value, (dict, list)):
                # Convert nested objects to strings
                cleaned_item[key] = str(value)
            else:
                cleaned_item[key] = str(value)
        cleaned_data.append(cleaned_item)
    
    # Export in requested format
    if export_request.format == "csv":
        content = await report_service.export_to_csv(cleaned_data)
        media_type = "text/csv"
        filename += ".csv"
    elif export_request.format == "excel":
        content = await report_service.export_to_excel(
            cleaned_data,
            sheet_name=export_request.report_type.title()
        )
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename += ".xlsx"
    elif export_request.format == "pdf":
        content = await report_service.export_to_pdf(
            title=f"{export_request.report_type.title()} Report",
            data=cleaned_data,
            summary=summary
        )
        media_type = "application/pdf"
        filename += ".pdf"
    else:
        return ResponseModel(success=False, message="Invalid format")
    
    # Return file as streaming response
    return StreamingResponse(
        io.BytesIO(content),
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )
