from fastapi import APIRouter
from app.api.v1 import auth, patients, appointments, products, invoices, prescriptions, reports, dashboard, doctors, users, suppliers

api_router = APIRouter()

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

# Add other routers as they are implemented
