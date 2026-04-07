from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class BuyerInformation(BaseModel):
    company_name: Optional[str] = None
    company_logo: Optional[str] = None
    company_address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    tax_number: Optional[str] = None


class SupplierInformation(BaseModel):
    supplier_name: Optional[str] = None
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    supplier_id: Optional[str] = None


class ShippingInformation(BaseModel):
    ship_to_location: Optional[str] = None
    delivery_address: Optional[str] = None
    receiving_department: Optional[str] = None
    delivery_instructions: Optional[str] = None


class PaymentTerms(BaseModel):
    payment_terms: Optional[str] = None
    payment_method: Optional[str] = None
    currency: str = "LKR"


class Notes(BaseModel):
    supplier_notes: Optional[str] = None
    internal_notes: Optional[str] = None


class Authorization(BaseModel):
    approved_by: Optional[str] = None
    signature: Optional[str] = None
    approval_date: Optional[datetime] = None


class Footer(BaseModel):
    company_policy_note: Optional[str] = None
    contact_information: Optional[str] = None


class PurchaseOrderSummaryInput(BaseModel):
    tax_rate: float = Field(default=0, ge=0)
    shipping_cost: float = Field(default=0, ge=0)
    discount: float = Field(default=0, ge=0)


class PurchaseOrderSummaryResponse(BaseModel):
    subtotal: float
    line_discount_total: float
    tax_rate: float
    tax_amount: float
    shipping_cost: float
    discount: float
    total_amount: float


class PurchaseOrderItemCreate(BaseModel):
    product_id: str
    quantity: int = Field(..., gt=0)
    unit_cost: float = Field(..., ge=0)
    line_discount_type: Optional[str] = None
    line_discount_value: float = Field(default=0, ge=0)


class PurchaseOrderCreate(BaseModel):
    supplier_id: str
    order_date: datetime
    expected_delivery_date: Optional[datetime] = None
    items: List[PurchaseOrderItemCreate] = Field(..., min_length=1)
    buyer_information: Optional[BuyerInformation] = None
    shipping_information: Optional[ShippingInformation] = None
    summary: Optional[PurchaseOrderSummaryInput] = None
    payment_terms: Optional[PaymentTerms] = None
    notes: Optional[Notes] = None
    authorization: Optional[Authorization] = None
    footer: Optional[Footer] = None


class PurchaseOrderItemResponse(BaseModel):
    id: str
    purchase_order_id: str
    product_id: str
    quantity: int
    unit_cost: float
    line_discount_type: Optional[str] = None
    line_discount_value: float = 0
    line_discount_amount: float = 0
    total_price: float = 0


class PurchaseOrderResponse(BaseModel):
    id: str
    supplier_id: str
    order_date: datetime
    expected_delivery_date: Optional[datetime] = None
    status: str
    total_amount: float
    created_by: str
    is_locked: bool = False
    items: List[PurchaseOrderItemResponse]
    buyer_information: Optional[BuyerInformation] = None
    supplier_information: Optional[SupplierInformation] = None
    shipping_information: Optional[ShippingInformation] = None
    order_summary: Optional[PurchaseOrderSummaryResponse] = None
    payment_terms: Optional[PaymentTerms] = None
    notes: Optional[Notes] = None
    authorization: Optional[Authorization] = None
    footer: Optional[Footer] = None
    created_at: datetime
    updated_at: datetime


class ReceiveStockItem(BaseModel):
    product_id: str
    ordered_quantity: int
    received_quantity: int = Field(..., ge=0)


class ReceiveStockRequest(BaseModel):
    items: List[ReceiveStockItem] = Field(..., min_length=1)
