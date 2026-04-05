from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config.database import get_database
from app.api.deps import get_current_user
from app.models.user import UserModel
from app.schemas.responses import ResponseModel, PaginatedResponse
from app.schemas.supplier import SupplierCreate, SupplierUpdate, SupplierResponse
from app.schemas.purchase_order import PurchaseOrderCreate, PurchaseOrderResponse, ReceiveStockRequest
from app.schemas.supplier_invoice import SupplierInvoiceCreate, SupplierInvoiceUpdate, SupplierInvoiceResponse
from app.schemas.supplier_payment import SupplierPaymentCreate, SupplierPaymentResponse
from app.services.supplier_service import SupplierService
from app.services.purchase_order_service import PurchaseOrderService
from app.services.supplier_invoice_service import SupplierInvoiceService
from app.services.supplier_payment_service import SupplierPaymentService

router = APIRouter()


@router.get("/suppliers", response_model=PaginatedResponse[SupplierResponse])
async def list_suppliers(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
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
    page_size: int = Query(10, ge=1, le=100),
    supplier_id: str | None = None,
    status: str | None = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    return await PurchaseOrderService(db).list_purchase_orders(page, page_size, supplier_id, status)


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


@router.patch("/purchase-orders/{order_id}/status", response_model=ResponseModel[PurchaseOrderResponse])
async def update_purchase_order_status(
    order_id: str,
    status: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    order = await PurchaseOrderService(db).update_status(order_id, status)
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


@router.get("/supplier-invoices", response_model=PaginatedResponse[SupplierInvoiceResponse])
async def list_supplier_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    supplier_id: str | None = None,
    status: str | None = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    return await SupplierInvoiceService(db).list_supplier_invoices(page, page_size, supplier_id, status)


@router.post("/supplier-invoices", response_model=ResponseModel[SupplierInvoiceResponse])
async def create_supplier_invoice(
    invoice_data: SupplierInvoiceCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    invoice = await SupplierInvoiceService(db).create_supplier_invoice(invoice_data)
    return ResponseModel(message="Supplier invoice created successfully", data=invoice)


@router.patch("/supplier-invoices/{invoice_id}", response_model=ResponseModel[SupplierInvoiceResponse])
async def update_supplier_invoice(
    invoice_id: str,
    invoice_data: SupplierInvoiceUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    invoice = await SupplierInvoiceService(db).update_supplier_invoice(invoice_id, invoice_data)
    return ResponseModel(message="Supplier invoice updated successfully", data=invoice)


@router.get("/supplier-payments", response_model=PaginatedResponse[SupplierPaymentResponse])
async def list_supplier_payments(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    invoice_id: str | None = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    return await SupplierPaymentService(db).list_payments(page, page_size, invoice_id)


@router.post("/supplier-payments", response_model=ResponseModel[SupplierPaymentResponse])
async def create_supplier_payment(
    payment_data: SupplierPaymentCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    payment = await SupplierPaymentService(db).record_payment(payment_data)
    return ResponseModel(message="Supplier payment recorded successfully", data=payment)
