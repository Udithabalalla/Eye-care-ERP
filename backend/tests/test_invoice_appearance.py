"""Invoice appearance on the company profile, the invoice PDF and new invoices' due dates (mongomock-motor)."""
import os

os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")
os.environ.setdefault("SECRET_KEY", "test-secret")

from datetime import datetime
from types import SimpleNamespace as NS

import pytest
from mongomock_motor import AsyncMongoMockClient
from pydantic import ValidationError

from app.models.company_profile import InvoiceAppearance
from app.schemas.company_profile import CompanyProfileUpdate
from app.services.company_profile_service import CompanyProfileService
from app.services.invoice_service import InvoiceService


@pytest.fixture
def db():
    return AsyncMongoMockClient()["test_invoice_appearance"]


async def test_defaults_until_the_shop_changes_them(db):
    profile = await CompanyProfileService(db).get_company_profile()
    assert profile.invoice_appearance == InvoiceAppearance()
    assert profile.invoice_appearance.layout == "classic" and profile.invoice_appearance.payment_terms_days == 0


async def test_first_save_keeps_the_default_business_name(db):
    service = CompanyProfileService(db)
    before = await service.get_company_profile()
    saved = await service.update_company_profile(CompanyProfileUpdate(invoice_appearance={"layout": "ledger"}))
    assert saved.company_name == before.company_name and saved.company_logo == before.company_logo
    assert saved.invoice_appearance.layout == "ledger"


async def test_saving_one_setting_keeps_the_others(db):
    service = CompanyProfileService(db)
    await service.update_company_profile(CompanyProfileUpdate(invoice_appearance={"accent": "#7C3AED", "show_tax": False}))
    saved = await service.update_company_profile(CompanyProfileUpdate(invoice_appearance={"layout": "split"}))
    assert (saved.invoice_appearance.layout, saved.invoice_appearance.accent, saved.invoice_appearance.show_tax) == ("split", "#7C3AED", False)
    # The rest of the profile is untouched by an appearance change, and vice versa
    saved = await service.update_company_profile(CompanyProfileUpdate(phone="081 222 3344"))
    assert saved.invoice_appearance.layout == "split" and saved.phone == "081 222 3344"


def test_rejects_unknown_values():
    with pytest.raises(ValidationError):
        InvoiceAppearance(accent="teal")
    with pytest.raises(ValidationError):
        InvoiceAppearance(payment_terms_days=10)
    with pytest.raises(ValidationError):
        InvoiceAppearance(layout="fancy")


def _invoice():
    item = lambda name, kind, total, disc=0: NS(product_name=name, line_type=kind, sku="SKU-1", quantity=1,
                                                unit_price=total + disc, discount=disc, total=total)
    return NS(
        invoice_number="INV-2026-000001", invoice_date=datetime(2026, 11, 20), due_date=datetime(2026, 12, 20),
        patient_name="Nimali", patient_phone="0771", patient_email=None,
        items=[item("Lens cleaner", "product", 900, disc=100)],
        subtotal=900, total_tax=0, total_discount=100, total_amount=800, paid_amount=300, balance_due=500,
        notes="Collect after 5 pm", sales_order_id="SO000001",
    )


def _pdf_text(appearance: dict) -> str:
    """The text drawn on the page (reportlab writes it uncompressed when asked)"""
    from reportlab import rl_config
    previous = rl_config.pageCompression
    rl_config.pageCompression = 0
    try:
        profile = NS(address="Kandy", phone="081", email="a@b.lk", tax_number="TIN-9", invoice_terms=None,
                     invoice_appearance=InvoiceAppearance(**appearance))
        payments = [NS(payment_date=datetime(2026, 11, 20, 4, 30), amount=300)]
        data = InvoiceService.__new__(InvoiceService)._build_invoice_pdf(_invoice(), None, profile, payments=payments)
    finally:
        rl_config.pageCompression = previous
    assert data.startswith(b"%PDF")
    return data.decode("latin-1")


@pytest.mark.parametrize("layout", ["classic", "split", "ledger"])
@pytest.mark.parametrize("typeface", ["sans", "mono"])
@pytest.mark.parametrize("spacing", ["roomy", "compact"])
def test_every_layout_builds(layout, typeface, spacing):
    text = _pdf_text({"layout": layout, "typeface": typeface, "spacing": spacing, "accent": "#EA580C"})
    assert "Grand Total" in text and "Balance Due" in text
    if typeface == "mono":
        assert "/Courier" in text


def test_hidden_parts_leave_the_invoice_and_its_figures_add_up():
    shown = _pdf_text({})
    assert "Discount :" in shown and "Tax no. TIN-9" in shown and "Collect after 5 pm" in shown and "Advance payment" in shown
    hidden = _pdf_text({"show_discount": False, "show_tax": False, "show_notes": False, "show_payment_details": False,
                        "show_line_details": False})
    assert "Discount :" not in hidden and "off)" not in hidden and "Tax no." not in hidden
    assert "Collect after 5 pm" not in hidden and "Advance payment" not in hidden and "Paid :" in hidden
    # The discount is folded into the subtotal, so the subtotal reads the total
    assert "LKR 800.00" in hidden.split("SUBTOTAL")[1][:200]


def test_split_and_ledger_show_the_due_date():
    assert "Due December 20, 2026" in _pdf_text({"layout": "split"})
    assert "December 20, 2026" in _pdf_text({"layout": "ledger"})
    assert "Due" not in _pdf_text({}).split("Balance")[0]  # classic keeps its look: no due line


async def test_new_invoices_follow_the_payment_terms(db):
    from datetime import timedelta, timezone

    from app.schemas.sales_order import SalesOrderCreate
    from app.services.sales_order_service import SalesOrderService
    from app.utils.constants import Gender, SalesOrderStatus
    from app.utils.helpers import business_today

    now = datetime.now(timezone.utc)
    await db["patients"].insert_one({
        "patient_id": "PAT000001", "name": "Test Patient", "date_of_birth": datetime(1990, 1, 1),
        "gender": list(Gender)[0].value, "phone": "0770000000", "is_active": True, "created_at": now,
    })
    service = SalesOrderService(db)
    order = lambda: SalesOrderCreate(patient_id="PAT000001", status=SalesOrderStatus.CREATED, items=[
        {"product_id": "EXP-1", "product_name": "Fitting", "quantity": 1, "unit_price": 50, "line_type": "expense", "track_stock": False},
    ])

    # On receipt by default, as before
    first = await service.create_sales_order(order(), "U")
    invoice = await service.generate_invoice(first.order_id, "U")
    assert invoice.due_date.date() == business_today()

    await CompanyProfileService(db).update_company_profile(CompanyProfileUpdate(invoice_appearance={"payment_terms_days": 14}))
    second = await service.create_sales_order(order(), "U")
    invoice = await service.generate_invoice(second.order_id, "U")
    assert invoice.due_date.date() == business_today() + timedelta(days=14)

    # An order's own full-payment date still wins
    third = await service.create_sales_order(order(), "U")
    await db["sales_orders"].update_one({"order_id": third.order_id}, {"$set": {"date_of_full_payment": datetime(2027, 1, 5)}})
    invoice = await service.generate_invoice(third.order_id, "U")
    assert invoice.due_date.date() == datetime(2027, 1, 5).date()
