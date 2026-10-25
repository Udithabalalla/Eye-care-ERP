from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
import io

from app.config.database import get_database
from app.api.deps import get_current_user
from app.models.user import UserModel
from app.schemas.responses import ResponseModel, PaginatedResponse
from app.schemas.supplier import SupplierCreate, SupplierUpdate, SupplierResponse
from app.schemas.purchase_order import PurchaseOrderCreate, PurchaseOrderResponse, PurchaseOrderSendRequest, ReceiveStockRequest
from app.schemas.supplier_invoice import SupplierInvoiceCreate, SupplierInvoiceUpdate, SupplierInvoiceResponse
from app.schemas.supplier_payment import SupplierPaymentCreate, SupplierInvoicePaymentCreate, SupplierPaymentResponse
from app.services.supplier_service import SupplierService
from app.services.purchase_order_service import PurchaseOrderService
from app.services.supplier_invoice_service import SupplierInvoiceService
from app.services.supplier_payment_service import SupplierPaymentService

router = APIRouter()


@router.get("/suppliers", response_model=PaginatedResponse[SupplierResponse])
async def list_suppliers(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=500),
    search: str | None = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    return await SupplierService(db).list_suppliers(page, page_size, search)


@router.post("/suppliers", response_model=ResponseModel[SupplierResponse])
async def create_supplier(
    supplier_data: SupplierCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    supplier = await SupplierService(db).create_supplier(supplier_data)
    return ResponseModel(message="Supplier created successfully", data=supplier)


@router.get("/suppliers/{supplier_id}", response_model=ResponseModel[SupplierResponse])
async def get_supplier(
    supplier_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    supplier = await SupplierService(db).get_supplier(supplier_id)
    return ResponseModel(data=supplier)


@router.put("/suppliers/{supplier_id}", response_model=ResponseModel[SupplierResponse])
async def update_supplier(
    supplier_id: str,
    supplier_data: SupplierUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    supplier = await SupplierService(db).update_supplier(supplier_id, supplier_data)
    return ResponseModel(message="Supplier updated successfully", data=supplier)


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(
    supplier_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    await SupplierService(db).delete_supplier(supplier_id)
    return ResponseModel(message="Supplier deleted successfully")


@router.get("/purchase-orders", response_model=PaginatedResponse[PurchaseOrderResponse])
async def list_purchase_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=500),
    supplier_id: str | None = None,
    status: str | None = None,
    search: str | None = Query(None, description="PO number, supplier or item"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    return await PurchaseOrderService(db).list_purchase_orders(page, page_size, supplier_id, status, search)


@router.post("/purchase-orders", response_model=ResponseModel[PurchaseOrderResponse])
async def create_purchase_order(
    order_data: PurchaseOrderCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    order = await PurchaseOrderService(db).create_purchase_order(order_data, current_user.user_id)
    return ResponseModel(message="Purchase order created successfully", data=order)


@router.get("/purchase-orders/{order_id}", response_model=ResponseModel[PurchaseOrderResponse])
async def get_purchase_order(
    order_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    order = await PurchaseOrderService(db).get_purchase_order(order_id)
    return ResponseModel(data=order)


@router.put("/purchase-orders/{order_id}", response_model=ResponseModel[PurchaseOrderResponse])
async def update_purchase_order(
    order_id: str,
    order_data: PurchaseOrderCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    """Edit a draft purchase order; approved orders can't change."""
    order = await PurchaseOrderService(db).update_draft(order_id, order_data, current_user.user_id)
    return ResponseModel(message="Purchase order updated successfully", data=order)


@router.patch("/purchase-orders/{order_id}/status", response_model=ResponseModel[PurchaseOrderResponse])
async def update_purchase_order_status(
    order_id: str,
    status: str = Query(..., description="New purchase order status"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    order = await PurchaseOrderService(db).update_status(order_id, status, updated_by=current_user.user_id)
    return ResponseModel(message="Purchase order status updated successfully", data=order)


@router.post("/purchase-orders/{order_id}/receive", response_model=ResponseModel[PurchaseOrderResponse])
async def receive_purchase_order(
    order_id: str,
    receipt: ReceiveStockRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    order = await PurchaseOrderService(db).receive_stock(order_id, receipt, current_user.user_id)
    return ResponseModel(message="Stock received successfully", data=order)


@router.post("/purchase-orders/{order_id}/send", response_model=ResponseModel[PurchaseOrderResponse])
async def send_purchase_order(
    order_id: str,
    request: PurchaseOrderSendRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    """Email the PO to the supplier with the PDF attached; an approved order becomes Ordered."""
    order = await PurchaseOrderService(db).send_to_supplier(order_id, request, current_user.user_id)
    return ResponseModel(message=f"Purchase order sent to {request.to}", data=order)


@router.post("/purchase-orders/{order_id}/advance-payment", response_model=ResponseModel[SupplierPaymentResponse])
async def record_purchase_order_advance(
    order_id: str,
    payment_data: SupplierInvoicePaymentCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    """Pay the supplier ahead of their invoice; it counts against the invoice once that's recorded."""
    payment = await SupplierPaymentService(db).record_advance(order_id, payment_data, current_user.user_id)
    return ResponseModel(message="Advance payment recorded", data=payment)


@router.get("/purchase-orders/{order_id}/pdf")
async def download_purchase_order_pdf(
    order_id: str,
    record: bool = Query(False, description="The full purchase record: order, receipt, supplier invoice and payments"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = PurchaseOrderService(db)
    content, filename = await (service.generate_purchase_record_pdf(order_id) if record else service.generate_purchase_order_pdf(order_id))
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/supplier-invoices", response_model=PaginatedResponse[SupplierInvoiceResponse])
async def list_supplier_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=500),
    supplier_id: str | None = None,
    status: str | None = None,
    search: str | None = Query(None, description="Invoice number, PO number or supplier name"),
    overdue: bool = Query(False, description="Only unpaid invoices past their due date"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    return await SupplierInvoiceService(db).list_supplier_invoices(page, page_size, supplier_id, status, search, overdue)


@router.get("/supplier-invoices/{invoice_id}", response_model=ResponseModel[SupplierInvoiceResponse])
async def get_supplier_invoice(
    invoice_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    invoice = await SupplierInvoiceService(db).get_supplier_invoice(invoice_id)
    return ResponseModel(data=invoice)


@router.post("/supplier-invoices", response_model=ResponseModel[SupplierInvoiceResponse])
async def create_supplier_invoice(
    invoice_data: SupplierInvoiceCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    invoice = await SupplierInvoiceService(db).create_supplier_invoice(invoice_data, created_by=current_user.user_id)
    return ResponseModel(message="Supplier invoice created successfully", data=invoice)


@router.patch("/supplier-invoices/{invoice_id}", response_model=ResponseModel[SupplierInvoiceResponse])
async def update_supplier_invoice(
    invoice_id: str,
    invoice_data: SupplierInvoiceUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    invoice = await SupplierInvoiceService(db).update_supplier_invoice(invoice_id, invoice_data, updated_by=current_user.user_id)
    return ResponseModel(message="Supplier invoice updated successfully", data=invoice)


@router.get("/supplier-payments", response_model=PaginatedResponse[SupplierPaymentResponse])
async def list_supplier_payments(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=500),
    invoice_id: str | None = None,
    purchase_order_id: str | None = Query(None, description="Everything paid on this order — advances and invoice payments"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    return await SupplierPaymentService(db).list_payments(page, page_size, invoice_id, purchase_order_id)


@router.post("/supplier-payments", response_model=ResponseModel[SupplierPaymentResponse])
async def create_supplier_payment(
    payment_data: SupplierPaymentCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    payment = await SupplierPaymentService(db).record_payment(payment_data, current_user.user_id)
    return ResponseModel(message="Supplier payment recorded successfully", data=payment)


@router.post("/supplier-invoices/{invoice_id}/payment", response_model=ResponseModel[SupplierPaymentResponse])
async def record_supplier_invoice_payment(
    invoice_id: str,
    payment_data: SupplierInvoicePaymentCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    payment = await SupplierPaymentService(db).record_invoice_payment(invoice_id, payment_data, current_user.user_id)
    return ResponseModel(message="Supplier payment recorded successfully", data=payment)
