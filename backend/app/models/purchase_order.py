from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime
from app.models.common import TimestampModel


class BuyerInformationModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    company_name: Optional[str] = None
    company_logo: Optional[str] = None
    company_address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    tax_number: Optional[str] = None


class SupplierInformationModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    supplier_name: Optional[str] = None
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    supplier_id: Optional[str] = None


class ShippingInformationModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    ship_to_location: Optional[str] = None
    delivery_address: Optional[str] = None
    receiving_department: Optional[str] = None
    delivery_instructions: Optional[str] = None


class PaymentTermsModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    payment_terms: Optional[str] = None
    payment_method: Optional[str] = None
    currency: str = "LKR"


class NotesModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    supplier_notes: Optional[str] = None
    internal_notes: Optional[str] = None


class AuthorizationModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    approved_by: Optional[str] = None
    signature: Optional[str] = None
    approval_date: Optional[datetime] = None


class FooterModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    company_policy_note: Optional[str] = None
    contact_information: Optional[str] = None


class OrderSummaryModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    subtotal: float = Field(default=0, ge=0)
    line_discount_total: float = Field(default=0, ge=0)
    tax_rate: float = Field(default=0, ge=0)
    tax_amount: float = Field(default=0, ge=0)
    shipping_cost: float = Field(default=0, ge=0)
    discount: float = Field(default=0, ge=0)
    total_amount: float = Field(default=0, ge=0)


class PurchaseOrderItemModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    purchase_order_id: str
    product_id: str
    quantity: int = Field(..., gt=0)
    unit_cost: float = Field(..., ge=0)
    line_discount_type: Optional[str] = None
    line_discount_value: float = Field(default=0, ge=0)
    line_discount_amount: float = Field(default=0, ge=0)
    total_price: float = Field(default=0, ge=0)


class PurchaseOrderModel(TimestampModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    supplier_id: str
    order_date: datetime
    expected_delivery_date: Optional[datetime] = None
    status: str = Field(default="Draft")
    total_amount: float = Field(default=0, ge=0)
    created_by: str
    is_locked: bool = False
    items: List[PurchaseOrderItemModel] = Field(default_factory=list)
    buyer_information: Optional[BuyerInformationModel] = None
    supplier_information: Optional[SupplierInformationModel] = None
    shipping_information: Optional[ShippingInformationModel] = None
    order_summary: Optional[OrderSummaryModel] = None
    payment_terms: Optional[PaymentTermsModel] = None
    notes: Optional[NotesModel] = None
    authorization: Optional[AuthorizationModel] = None
    footer: Optional[FooterModel] = None
    receipt_summary: Optional[dict] = None
