from fastapi import APIRouter, Depends, Query, Response
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
from datetime import date

from app.config.database import get_database
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate, InvoiceResponse, PaymentRecord
from app.schemas.responses import ResponseModel, PaginatedResponse
from app.services.invoice_service import InvoiceService
from app.api.deps import get_current_user
from app.models.user import UserModel

router = APIRouter()

@router.get("", response_model=PaginatedResponse[InvoiceResponse])
async def list_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    patient_id: Optional[str] = None,
    payment_status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    search: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """List all invoices with filters"""
    invoice_service = InvoiceService(db)
    return await invoice_service.list_invoices(
        page, page_size, patient_id, payment_status, start_date, end_date, search
    )

@router.get("/{invoice_id}", response_model=ResponseModel[InvoiceResponse])
async def get_invoice(
    invoice_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Get invoice by ID"""
    invoice_service = InvoiceService(db)
    invoice = await invoice_service.get_invoice(invoice_id)
    return ResponseModel(data=invoice)

@router.post("", response_model=ResponseModel[InvoiceResponse])
async def create_invoice(
    invoice_data: InvoiceCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Create a new invoice"""
    invoice_service = InvoiceService(db)
    invoice = await invoice_service.create_invoice(invoice_data, current_user.user_id)
    return ResponseModel(
        message="Invoice created successfully",
        data=invoice
    )

@router.put("/{invoice_id}", response_model=ResponseModel[InvoiceResponse])
async def update_invoice(
    invoice_id: str,
    invoice_data: InvoiceUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Update invoice"""
    invoice_service = InvoiceService(db)
    invoice = await invoice_service.update_invoice(invoice_id, invoice_data)
    return ResponseModel(
        message="Invoice updated successfully",
        data=invoice
    )

@router.post("/{invoice_id}/payment", deprecated=True)
async def record_payment(
    invoice_id: str,
    payment: PaymentRecord,
    response: Response,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Record a payment for an invoice"""
    invoice_service = InvoiceService(db)
    await invoice_service.record_payment(invoice_id, payment, current_user.user_id)
    response.headers["Warning"] = '299 - "Deprecated endpoint. Use POST /payments with reference_type=INVOICE instead."'
    response.headers["X-Deprecated"] = "true"
    response.headers["X-Replacement-Endpoint"] = "/payments"
    return ResponseModel(message="Payment recorded successfully")
