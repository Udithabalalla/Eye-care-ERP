from pydantic import BaseModel, ConfigDict, Field
from typing import Literal, Optional

from app.models.common import TimestampModel


# The brand teal of the Vision Opticals invoice design
DEFAULT_INVOICE_ACCENT = "#1F6378"


class InvoiceAppearance(BaseModel):
    """How customer invoices look, on screen, printed and as a PDF (Settings → Invoice Appearance)"""
    model_config = ConfigDict(extra="ignore")
    layout: Literal["classic", "split", "ledger"] = "classic"
    accent: str = Field(default=DEFAULT_INVOICE_ACCENT, pattern=r"^#[0-9A-Fa-f]{6}$")
    typeface: Literal["sans", "mono"] = "sans"
    spacing: Literal["roomy", "compact"] = "roomy"
    show_logo: bool = True
    # The type, code and "… off" under each item
    show_line_details: bool = True
    # The discount line in the totals; off, the subtotal is shown after the discount
    show_discount: bool = True
    # Your tax number, and a tax line even when no tax is charged (tax charged always shows)
    show_tax: bool = True
    show_notes: bool = True
    # Each payment with its date; off, one "Paid" line
    show_payment_details: bool = True
    # Days a new invoice gives the customer to pay when the order sets no full-payment date (0: on receipt)
    payment_terms_days: Literal[0, 7, 14, 30, 45, 60] = 0


class CompanyProfileModel(TimestampModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default="company_profile")
    company_name: Optional[str] = None
    company_logo: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    tax_number: Optional[str] = None
    default_ship_to_location: Optional[str] = None
    default_delivery_address: Optional[str] = None
    default_receiving_department: Optional[str] = None
    default_delivery_instructions: Optional[str] = None
    # Printed at the foot of every customer invoice
    invoice_terms: Optional[str] = None
    invoice_appearance: Optional[InvoiceAppearance] = None