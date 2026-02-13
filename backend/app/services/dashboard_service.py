from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Dict, Any, List
from datetime import datetime, date, timedelta, timezone
from app.repositories.patient_repository import PatientRepository
from app.repositories.appointment_repository import AppointmentRepository
from app.repositories.invoice_repository import InvoiceRepository
from app.repositories.product_repository import ProductRepository
from app.utils.helpers import date_to_datetime
from app.core.cache import cache, CacheTTL

class DashboardService:
    """Dashboard statistics and analytics service with caching"""
    
    # Cache keys
    CACHE_KEY_STATS = "dashboard:stats"
    CACHE_KEY_INVENTORY = "dashboard:inventory"
    CACHE_KEY_TOP_PRODUCTS = "dashboard:top_products"
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.patient_repo = PatientRepository(db)
        self.appointment_repo = AppointmentRepository(db)
        self.invoice_repo = InvoiceRepository(db)
        self.product_repo = ProductRepository(db)
    
    async def get_dashboard_stats(self) -> Dict[str, Any]:
        """Get comprehensive dashboard statistics with caching"""
        # Try cache first
        cached_stats = await cache.get(self.CACHE_KEY_STATS)
        if cached_stats is not None:
            return cached_stats
        
        today = date.today()
        
        # Get counts
        total_patients = await self.db.patients.count_documents({"is_active": True})
        total_appointments = await self.db.appointments.count_documents({})
        today_appointments = await self.db.appointments.count_documents({
            "appointment_date": {
                "$gte": date_to_datetime(today),
                "$lt": date_to_datetime(today + timedelta(days=1))
            }
        })
        
        # Get pending payments
        pending_invoices = await self.db.invoices.aggregate([
            {"$match": {"payment_status": {"$in": ["pending", "partial"]}}},
            {"$group": {"_id": None, "total": {"$sum": "$balance_due"}}}
        ]).to_list(length=1)
        
        pending_payments = pending_invoices[0]["total"] if pending_invoices else 0
        
        # Get low stock items count
        low_stock_items = await self.db.products.count_documents({
            "$expr": {"$lte": ["$current_stock", "$min_stock_level"]},
            "is_active": True
        })
        
        # Get today's revenue
        today_revenue = await self.db.invoices.aggregate([
            {
                "$match": {
                    "invoice_date": {
                        "$gte": date_to_datetime(today),
                        "$lt": date_to_datetime(today + timedelta(days=1))
                    }
                }
            },
            {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
        ]).to_list(length=1)
        
        revenue_today = today_revenue[0]["total"] if today_revenue else 0
        
        # Get month's revenue
        month_start = date(today.year, today.month, 1)
        month_revenue = await self.db.invoices.aggregate([
            {
                "$match": {
                    "invoice_date": {
                        "$gte": date_to_datetime(month_start),
                        "$lt": date_to_datetime(today + timedelta(days=1))
                    }
                }
            },
            {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
        ]).to_list(length=1)
        
        revenue_month = month_revenue[0]["total"] if month_revenue else 0
        
        result = {
            "total_patients": total_patients,
            "total_appointments": total_appointments,
            "today_appointments": today_appointments,
            "pending_payments": round(pending_payments, 2),
            "low_stock_items": low_stock_items,
            "revenue_today": round(revenue_today, 2),
            "revenue_month": round(revenue_month, 2),
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Cache for 60 seconds (dashboard stats change frequently)
        await cache.set(self.CACHE_KEY_STATS, result, CacheTTL.SHORT)
        
        return result
    
    async def get_revenue_data(
        self,
        start_date: date,
        end_date: date
    ) -> Dict[str, Any]:
        """Get revenue data for a date range"""
        # Daily revenue breakdown
        pipeline = [
            {
                "$match": {
                    "invoice_date": {
                        "$gte": date_to_datetime(start_date),
                        "$lte": date_to_datetime(end_date)
                    }
                }
            },
            {
                "$group": {
                    "_id": {
                        "$dateToString": {
                            "format": "%Y-%m-%d",
                            "date": "$invoice_date"
                        }
                    },
                    "total_revenue": {"$sum": "$total_amount"},
                    "total_paid": {"$sum": "$paid_amount"},
                    "invoice_count": {"$sum": 1}
                }
            },
            {"$sort": {"_id": 1}}
        ]
        
        daily_revenue = await self.db.invoices.aggregate(pipeline).to_list(length=None)
        
        # Calculate totals
        total_revenue = sum(day["total_revenue"] for day in daily_revenue)
        total_paid = sum(day["total_paid"] for day in daily_revenue)
        total_invoices = sum(day["invoice_count"] for day in daily_revenue)
        
        # Payment status breakdown
        status_breakdown = await self.db.invoices.aggregate([
            {
                "$match": {
                    "invoice_date": {
                        "$gte": date_to_datetime(start_date),
                        "$lte": date_to_datetime(end_date)
                    }
                }
            },
            {
                "$group": {
                    "_id": "$payment_status",
                    "count": {"$sum": 1},
                    "amount": {"$sum": "$total_amount"}
                }
            }
        ]).to_list(length=None)
        
        return {
            "summary": {
                "total_revenue": round(total_revenue, 2),
                "total_paid": round(total_paid, 2),
                "total_pending": round(total_revenue - total_paid, 2),
                "total_invoices": total_invoices
            },
            "daily_revenue": [
                {
                    "date": day["_id"],
                    "revenue": round(day["total_revenue"], 2),
                    "paid": round(day["total_paid"], 2),
                    "invoices": day["invoice_count"]
                }
                for day in daily_revenue
            ],
            "status_breakdown": [
                {
                    "status": item["_id"],
                    "count": item["count"],
                    "amount": round(item["amount"], 2)
                }
                for item in status_breakdown
            ],
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            }
        }
    
    async def get_appointments_summary(self) -> Dict[str, Any]:
        """Get appointments summary and statistics"""
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)
        
        # Status breakdown
        status_counts = await self.db.appointments.aggregate([
            {
                "$group": {
                    "_id": "$status",
                    "count": {"$sum": 1}
                }
            }
        ]).to_list(length=None)
        
        # Today's appointments
        today_appointments = await self.db.appointments.find({
            "appointment_date": {
                "$gte": date_to_datetime(today),
                "$lt": date_to_datetime(today + timedelta(days=1))
            }
        }).sort("appointment_time", 1).to_list(length=None)
        
        # This week's appointments
        week_appointments = await self.db.appointments.aggregate([
            {
                "$match": {
                    "appointment_date": {
                        "$gte": date_to_datetime(week_start),
                        "$lte": date_to_datetime(week_end)
                    }
                }
            },
            {
                "$group": {
                    "_id": {
                        "$dateToString": {
                            "format": "%Y-%m-%d",
                            "date": "$appointment_date"
                        }
                    },
                    "count": {"$sum": 1}
                }
            },
            {"$sort": {"_id": 1}}
        ]).to_list(length=None)
        
        # Upcoming appointments (next 7 days)
        upcoming = await self.db.appointments.count_documents({
            "appointment_date": {
                "$gte": date_to_datetime(today),
                "$lte": date_to_datetime(today + timedelta(days=7))
            },
            "status": {"$in": ["scheduled", "confirmed"]}
        })
        
        return {
            "status_breakdown": [
                {"status": item["_id"], "count": item["count"]}
                for item in status_counts
            ],
            "today_count": len(today_appointments),
            "today_appointments": [
                {
                    "appointment_id": apt["appointment_id"],
                    "patient_name": apt["patient_name"],
                    "doctor_name": apt["doctor_name"],
                    "time": apt["appointment_time"].strftime("%H:%M") if isinstance(apt["appointment_time"], datetime) else str(apt["appointment_time"]),
                    "status": apt["status"],
                    "type": apt["type"]
                }
                for apt in today_appointments[:10]  # Limit to 10
            ],
            "week_summary": [
                {"date": day["_id"], "count": day["count"]}
                for day in week_appointments
            ],
            "upcoming_count": upcoming,
            "week_period": {
                "start": week_start.isoformat(),
                "end": week_end.isoformat()
            }
        }
    
    async def get_inventory_alerts(self) -> Dict[str, Any]:
        """Get inventory alerts and critical stock levels"""
        # Low stock items
        low_stock = await self.db.products.find({
            "$expr": {"$lte": ["$current_stock", "$min_stock_level"]},
            "is_active": True,
            "current_stock": {"$gt": 0}
        }).to_list(length=None)
        
        # Out of stock items
        out_of_stock = await self.db.products.find({
            "current_stock": 0,
            "is_active": True
        }).to_list(length=None)
        
        # Expiring soon (within 30 days)
        expiry_threshold = date_to_datetime(date.today() + timedelta(days=30))
        expiring_soon = await self.db.products.find({
            "expiry_date": {
                "$lte": expiry_threshold,
                "$gte": date_to_datetime(date.today())
            },
            "is_active": True
        }).to_list(length=None)
        
        # Calculate reorder value
        reorder_value = sum(
            item["reorder_quantity"] * item["cost_price"]
            for item in low_stock
        )
        
        return {
            "summary": {
                "low_stock_count": len(low_stock),
                "out_of_stock_count": len(out_of_stock),
                "expiring_soon_count": len(expiring_soon),
                "reorder_value": round(reorder_value, 2)
            },
            "low_stock_items": [
                {
                    "product_id": item["product_id"],
                    "name": item["name"],
                    "sku": item["sku"],
                    "current_stock": item["current_stock"],
                    "min_stock_level": item["min_stock_level"],
                    "reorder_quantity": item["reorder_quantity"],
                    "cost_price": item["cost_price"]
                }
                for item in low_stock
            ],
            "out_of_stock_items": [
                {
                    "product_id": item["product_id"],
                    "name": item["name"],
                    "sku": item["sku"],
                    "reorder_quantity": item["reorder_quantity"]
                }
                for item in out_of_stock
            ],
            "expiring_soon": [
                {
                    "product_id": item["product_id"],
                    "name": item["name"],
                    "sku": item["sku"],
                    "expiry_date": item["expiry_date"].strftime("%Y-%m-%d") if isinstance(item["expiry_date"], datetime) else str(item["expiry_date"]),
                    "current_stock": item["current_stock"]
                }
                for item in expiring_soon
            ]
        }
    
    async def get_top_products(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get top-selling products"""
        pipeline = [
            {"$unwind": "$items"},
            {
                "$group": {
                    "_id": "$items.product_id",
                    "product_name": {"$first": "$items.product_name"},
                    "total_quantity": {"$sum": "$items.quantity"},
                    "total_revenue": {"$sum": "$items.total"}
                }
            },
            {"$sort": {"total_revenue": -1}},
            {"$limit": limit}
        ]
        
        top_products = await self.db.invoices.aggregate(pipeline).to_list(length=None)
        
        return [
            {
                "product_id": item["_id"],
                "product_name": item["product_name"],
                "quantity_sold": item["total_quantity"],
                "total_revenue": round(item["total_revenue"], 2)
            }
            for item in top_products
        ]
    
    async def get_patient_growth(self, months: int = 6) -> List[Dict[str, Any]]:
        """Get patient growth over time"""
        start_date = date.today() - timedelta(days=months * 30)
        
        pipeline = [
            {
                "$match": {
                    "created_at": {"$gte": date_to_datetime(start_date)}
                }
            },
            {
                "$group": {
                    "_id": {
                        "$dateToString": {
                            "format": "%Y-%m",
                            "date": "$created_at"
                        }
                    },
                    "count": {"$sum": 1}
                }
            },
            {"$sort": {"_id": 1}}
        ]
        
        growth = await self.db.patients.aggregate(pipeline).to_list(length=None)
        
        return [
            {"month": item["_id"], "new_patients": item["count"]}
            for item in growth
        ]
