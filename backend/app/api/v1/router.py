from fastapi import APIRouter, Depends

from app.api.deps import require_module_access, require_permission
from app.api.v1 import (
    auth, patients, appointments, products, invoices, prescriptions,
    reports, dashboard, doctors, users, suppliers, company_profile,
    sales_orders, payments, transactions, inventory_movements,
    audit_logs, roles, ledger, basic_data,
    frame_masters, frame_variants, goods_receipts, quick_intakes, inventory,
)

api_router = APIRouter()

# Every router except auth/users is guarded by a permission from
# app/core/permissions.py (users applies per-route checks itself).

# ── Existing routes ───────────────────────────────────────────────────────────
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(patients.router, prefix="/patients", tags=["Patients"], dependencies=[Depends(require_module_access("patients"))])
api_router.include_router(appointments.router, prefix="/appointments", tags=["Appointments"], dependencies=[Depends(require_module_access("appointments"))])
api_router.include_router(products.router, prefix="/products", tags=["Products"], dependencies=[Depends(require_module_access("inventory"))])
api_router.include_router(invoices.router, prefix="/invoices", tags=["Invoices"], dependencies=[Depends(require_module_access("sales"))])
api_router.include_router(prescriptions.router, prefix="/prescriptions", tags=["Prescriptions"], dependencies=[Depends(require_module_access("prescriptions"))])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"], dependencies=[Depends(require_permission("reports.read"))])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"], dependencies=[Depends(require_permission("dashboard.read"))])
api_router.include_router(doctors.router, prefix="/doctors", tags=["Doctors"], dependencies=[Depends(require_module_access("doctors"))])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(suppliers.router, tags=["Suppliers"], dependencies=[Depends(require_module_access("purchasing"))])
api_router.include_router(basic_data.router, prefix="/basic-data", tags=["Basic Data"], dependencies=[Depends(require_module_access("catalog"))])
api_router.include_router(sales_orders.router, prefix="/sales-orders", tags=["Sales Orders"], dependencies=[Depends(require_module_access("sales"))])
api_router.include_router(payments.router, prefix="/payments", tags=["Payments"], dependencies=[Depends(require_module_access("sales"))])
api_router.include_router(transactions.router, prefix="/transactions", tags=["Transactions"], dependencies=[Depends(require_module_access("finance"))])
api_router.include_router(inventory_movements.router, prefix="/inventory-movements", tags=["Inventory Movements"], dependencies=[Depends(require_module_access("inventory"))])
api_router.include_router(audit_logs.router, prefix="/audit-logs", tags=["Activity Logs"], dependencies=[Depends(require_permission("audit.read"))])
api_router.include_router(company_profile.router, prefix="/settings", tags=["Settings"], dependencies=[Depends(require_module_access("settings"))])
api_router.include_router(roles.router, prefix="/roles", tags=["Roles & Permissions"], dependencies=[Depends(require_permission("roles.manage"))])
api_router.include_router(ledger.router, prefix="/ledger", tags=["Ledger"], dependencies=[Depends(require_permission("finance.read"))])

# ── Optical ERP routes ────────────────────────────────────────────────────────
api_router.include_router(frame_masters.router, prefix="/frame-masters", tags=["Frame Masters"], dependencies=[Depends(require_module_access("inventory"))])
api_router.include_router(frame_variants.router, prefix="/frame-variants", tags=["Frame Variants"], dependencies=[Depends(require_module_access("inventory"))])
api_router.include_router(goods_receipts.router, prefix="/goods-receipts", tags=["Goods Receipts"], dependencies=[Depends(require_module_access("inventory"))])
api_router.include_router(quick_intakes.router, prefix="/quick-intakes", tags=["Quick Intake"], dependencies=[Depends(require_module_access("inventory"))])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory"], dependencies=[Depends(require_module_access("inventory"))])
# Label printing is a POST that only reads data
api_router.include_router(inventory.labels_router, prefix="/inventory", tags=["Inventory"], dependencies=[Depends(require_permission("inventory.read"))])
