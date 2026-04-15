from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timedelta
from typing import Optional
from app.config.database import get_database
from app.models.user import UserModel
from app.api.deps import get_current_user
from app.schemas.responses import ResponseModel

router = APIRouter()


@router.get("/summary", response_model=ResponseModel)
async def get_ledger_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Get ledger summary by transaction type"""
    query = {}
    
    # Date filtering
    if start_date or end_date:
        date_query = {}
        if start_date:
            try:
                date_query["$gte"] = datetime.fromisoformat(start_date)
            except:
                pass
        if end_date:
            try:
                date_query["$lte"] = datetime.fromisoformat(end_date)
            except:
                pass
        if date_query:
            query["created_at"] = date_query
    
    # Aggregate transactions by type
    pipeline = [
        {"$match": query},
        {
            "$group": {
                "_id": "$transaction_type",
                "total_amount": {"$sum": "$amount"},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    result = await db.transactions.aggregate(pipeline).to_list(None)
    
    # Format response
    summary = {}
    for item in result:
        summary[item["_id"]] = {
            "total_amount": item["total_amount"],
            "count": item["count"]
        }
    
    # Get totals
    total_amount = sum(item["total_amount"] for item in result)
    total_count = sum(item["count"] for item in result)
    
    return ResponseModel(
        message="Ledger summary retrieved successfully",
        data={
            "by_type": summary,
            "total_amount": total_amount,
            "total_count": total_count,
            "period": {
                "start_date": start_date,
                "end_date": end_date
            }
        }
    )


@router.get("/transactions", response_model=ResponseModel)
async def get_ledger_transactions(
    transaction_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Get ledger transactions with filters"""
    query = {}
    
    if transaction_type:
        query["transaction_type"] = transaction_type
    
    # Date filtering
    if start_date or end_date:
        date_query = {}
        if start_date:
            try:
                date_query["$gte"] = datetime.fromisoformat(start_date)
            except:
                pass
        if end_date:
            try:
                date_query["$lte"] = datetime.fromisoformat(end_date)
            except:
                pass
        if date_query:
            query["created_at"] = date_query
    
    total = await db.transactions.count_documents(query)
    cursor = db.transactions.find(query).skip(skip).limit(limit).sort("created_at", -1)
    transactions = await cursor.to_list(None)
    
    # Convert ObjectId to string
    for tx in transactions:
        if "_id" in tx:
            tx["_id"] = str(tx["_id"])
    
    return ResponseModel(
        message="Ledger transactions retrieved successfully",
        data=transactions,
        total=total
    )


@router.get("/balance", response_model=ResponseModel)
async def get_account_balance(
    account_type: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Get account balance by type (simplified account balance)"""
    # For each reference type, sum up the transactions
    
    pipeline = [
        {
            "$group": {
                "_id": "$reference_type",
                "total_debit": {
                    "$sum": {
                        "$cond": [
                            {"$in": ["$transaction_type", ["SALE", "SUPPLIER_PAYMENT"]]},
                            "$amount",
                            0
                        ]
                    }
                },
                "total_credit": {
                    "$sum": {
                        "$cond": [
                            {"$in": ["$transaction_type", ["PURCHASE", "CUSTOMER_PAYMENT"]]},
                            "$amount",
                            0
                        ]
                    }
                },
            }
        },
        {
            "$project": {
                "_id": 1,
                "total_debit": 1,
                "total_credit": 1,
                "balance": {"$subtract": ["$total_debit", "$total_credit"]}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    if account_type:
        pipeline.insert(0, {"$match": {"reference_type": account_type}})
    
    result = await db.transactions.aggregate(pipeline).to_list(None)
    
    return ResponseModel(
        message="Account balance retrieved successfully",
        data=result
    )


@router.get("/daily-summary", response_model=ResponseModel)
async def get_daily_summary(
    days: int = Query(7, ge=1, le=365),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Get daily transaction summary for last N days"""
    since_date = datetime.utcnow() - timedelta(days=days)
    
    pipeline = [
        {
            "$match": {
                "created_at": {"$gte": since_date}
            }
        },
        {
            "$group": {
                "_id": {
                    "$dateToString": {
                        "format": "%Y-%m-%d",
                        "date": "$created_at"
                    }
                },
                "total_amount": {"$sum": "$amount"},
                "count": {"$sum": 1},
                "by_type": {
                    "$push": {
                        "type": "$transaction_type",
                        "amount": "$amount"
                    }
                }
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    result = await db.transactions.aggregate(pipeline).to_list(None)
    
    return ResponseModel(
        message="Daily ledger summary retrieved successfully",
        data=result
    )
