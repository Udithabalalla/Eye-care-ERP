from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import date, timedelta

from app.config.database import get_database
from app.schemas.responses import ResponseModel
from app.services.dashboard_service import DashboardService
from app.api.deps import get_current_user
from app.models.user import UserModel

router = APIRouter()

@router.get("/stats")
async def get_dashboard_stats(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Get comprehensive dashboard statistics"""
    dashboard_service = DashboardService(db)
    stats = await dashboard_service.get_dashboard_stats()
    return ResponseModel(
        message="Dashboard statistics retrieved successfully",
        data=stats
    )

@router.get("/revenue")
async def get_revenue_data(
    start_date: date = Query(default=None),
    end_date: date = Query(default=None),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Get revenue data for date range"""
    # Default to last 30 days if not provided
    if not start_date:
        start_date = date.today() - timedelta(days=30)
    if not end_date:
        end_date = date.today()
    
    dashboard_service = DashboardService(db)
    revenue_data = await dashboard_service.get_revenue_data(start_date, end_date)
    return ResponseModel(
        message="Revenue data retrieved successfully",
        data=revenue_data
    )

@router.get("/appointments-summary")
async def get_appointments_summary(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Get appointments summary and statistics"""
    dashboard_service = DashboardService(db)
    summary = await dashboard_service.get_appointments_summary()
    return ResponseModel(
        message="Appointments summary retrieved successfully",
        data=summary
    )

@router.get("/inventory-alerts")
async def get_inventory_alerts(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Get inventory alerts and critical stock levels"""
    dashboard_service = DashboardService(db)
    alerts = await dashboard_service.get_inventory_alerts()
    return ResponseModel(
        message="Inventory alerts retrieved successfully",
        data=alerts
    )

@router.get("/top-products")
async def get_top_products(
    limit: int = Query(default=10, ge=1, le=50),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Get top-selling products"""
    dashboard_service = DashboardService(db)
    top_products = await dashboard_service.get_top_products(limit)
    return ResponseModel(
        message="Top products retrieved successfully",
        data=top_products
    )

@router.get("/patient-growth")
async def get_patient_growth(
    months: int = Query(default=6, ge=1, le=12),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Get patient growth over time"""
    dashboard_service = DashboardService(db)
    growth = await dashboard_service.get_patient_growth(months)
    return ResponseModel(
        message="Patient growth data retrieved successfully",
        data=growth
    )


@router.get("/order-types")
async def get_order_types_summary(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Get summary counts for order types (full/partial) across sales orders and invoices"""
    dashboard_service = DashboardService(db)
    summary = await dashboard_service.get_order_type_summary()
    return ResponseModel(
        message="Order type summary retrieved successfully",
        data=summary
    )
