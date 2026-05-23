from fastapi import APIRouter
from app.api.v1 import (
    auth, patients, appointments, products, invoices, prescriptions,
    reports, dashboard, doctors, users, suppliers, company_profile,
    sales_orders, payments, transactions, inventory_movements,
    audit_logs, roles, ledger, basic_data,
    frame_masters, frame_variants, goods_receipts, quick_intakes,
)

api_router = APIRouter()

# ── Existing routes ───────────────────────────────────────────────────────────
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(patients.router, prefix="/patients", tags=["Patients"])
api_router.include_router(appointments.router, prefix="/appointments", tags=["Appointments"])
api_router.include_router(products.router, prefix="/products", tags=["Products"])
api_router.include_router(invoices.router, prefix="/invoices", tags=["Invoices"])
api_router.include_router(prescriptions.router, prefix="/prescriptions", tags=["Prescriptions"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(doctors.router, prefix="/doctors", tags=["Doctors"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(suppliers.router, tags=["Suppliers"])
api_router.include_router(basic_data.router, prefix="/basic-data", tags=["Basic Data"])
api_router.include_router(sales_orders.router, prefix="/sales-orders", tags=["Sales Orders"])
api_router.include_router(payments.router, prefix="/payments", tags=["Payments"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["Transactions"])
api_router.include_router(inventory_movements.router, prefix="/inventory-movements", tags=["Inventory Movements"])
api_router.include_router(audit_logs.router, prefix="/audit-logs", tags=["Activity Logs"])
api_router.include_router(company_profile.router, prefix="/settings", tags=["Settings"])
api_router.include_router(roles.router, prefix="/roles", tags=["Roles & Permissions"])
api_router.include_router(ledger.router, prefix="/ledger", tags=["Ledger"])

# ── Optical ERP routes ────────────────────────────────────────────────────────
api_router.include_router(frame_masters.router, prefix="/frame-masters", tags=["Frame Masters"])
api_router.include_router(frame_variants.router, prefix="/frame-variants", tags=["Frame Variants"])
api_router.include_router(goods_receipts.router, prefix="/goods-receipts", tags=["Goods Receipts"])
api_router.include_router(quick_intakes.router, prefix="/quick-intakes", tags=["Quick Intake"])
