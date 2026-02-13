from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Dict, Any
from bson import ObjectId
from datetime import datetime, timezone

class BaseRepository:
    """Base repository with common CRUD operations and optimizations"""
    
    def __init__(self, db: AsyncIOMotorDatabase, collection_name: str):
        self.db = db
        self.collection = db[collection_name]
    
    @staticmethod
    def now_utc() -> datetime:
        """Get current UTC datetime"""
        return datetime.now(timezone.utc)
    
    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new document"""
        data["created_at"] = self.now_utc()
        result = await self.collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return data
    
    async def create_many(self, documents: List[Dict[str, Any]]) -> List[str]:
        """Create multiple documents efficiently"""
        now = self.now_utc()
        for doc in documents:
            doc["created_at"] = now
        result = await self.collection.insert_many(documents)
        return [str(id) for id in result.inserted_ids]
    
    async def get_by_id(self, id: str) -> Optional[Dict[str, Any]]:
        """Get document by _id"""
        if not ObjectId.is_valid(id):
            return None
        document = await self.collection.find_one({"_id": ObjectId(id)})
        if document:
            document["_id"] = str(document["_id"])
        return document
    
    async def get_one(self, filter: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Get one document by filter"""
        document = await self.collection.find_one(filter)
        if document:
            document["_id"] = str(document["_id"])
        return document
    
    async def get_many(
        self,
        filter: Dict[str, Any] = {},
        skip: int = 0,
        limit: int = 10,
        sort: Optional[List[tuple]] = None,
        projection: Optional[Dict[str, int]] = None
    ) -> List[Dict[str, Any]]:
        """Get multiple documents with optional projection for efficiency"""
        cursor = self.collection.find(filter, projection).skip(skip).limit(limit)
        if sort:
            cursor = cursor.sort(sort)
        
        documents = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            documents.append(doc)
        return documents
    
    async def get_many_with_count(
        self,
        filter: Dict[str, Any] = {},
        skip: int = 0,
        limit: int = 10,
        sort: Optional[List[tuple]] = None
    ) -> tuple[List[Dict[str, Any]], int]:
        """Get documents and count in parallel for pagination"""
        import asyncio
        
        # Run both queries concurrently
        docs_task = self.get_many(filter, skip, limit, sort)
        count_task = self.count(filter)
        
        documents, total = await asyncio.gather(docs_task, count_task)
        return documents, total
    
    async def count(self, filter: Dict[str, Any] = {}) -> int:
        """Count documents matching filter"""
        # Use estimated_document_count for empty filters (much faster)
        if not filter:
            return await self.collection.estimated_document_count()
        return await self.collection.count_documents(filter)
    
    async def exists(self, filter: Dict[str, Any]) -> bool:
        """Check if document exists (more efficient than get_one)"""
        doc = await self.collection.find_one(filter, {"_id": 1})
        return doc is not None
    
    async def update(self, filter: Dict[str, Any], update: Dict[str, Any]) -> bool:
        """Update document(s)"""
        update["updated_at"] = self.now_utc()
        result = await self.collection.update_one(filter, {"$set": update})
        return result.modified_count > 0
    
    async def update_many(self, filter: Dict[str, Any], update: Dict[str, Any]) -> int:
        """Update multiple documents"""
        update["updated_at"] = self.now_utc()
        result = await self.collection.update_many(filter, {"$set": update})
        return result.modified_count
    
    async def delete(self, filter: Dict[str, Any]) -> bool:
        """Delete document(s)"""
        result = await self.collection.delete_one(filter)
        return result.deleted_count > 0
    
    async def aggregate(
        self,
        pipeline: List[Dict[str, Any]],
        max_results: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Run aggregation pipeline"""
        cursor = self.collection.aggregate(pipeline)
        return await cursor.to_list(length=max_results)
