from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Dict, Any
from bson import ObjectId

class BaseRepository:
    """Base repository with common CRUD operations"""
    
    def __init__(self, db: AsyncIOMotorDatabase, collection_name: str):
        self.db = db
        self.collection = db[collection_name]
    
    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new document"""
        result = await self.collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return data
    
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
        sort: Optional[List[tuple]] = None
    ) -> List[Dict[str, Any]]:
        """Get multiple documents"""
        cursor = self.collection.find(filter).skip(skip).limit(limit)
        if sort:
            cursor = cursor.sort(sort)
        
        documents = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            documents.append(doc)
        return documents
    
    async def count(self, filter: Dict[str, Any] = {}) -> int:
        """Count documents matching filter"""
        return await self.collection.count_documents(filter)
    
    async def update(self, filter: Dict[str, Any], update: Dict[str, Any]) -> bool:
        """Update document(s)"""
        result = await self.collection.update_one(filter, {"$set": update})
        return result.modified_count > 0
    
    async def delete(self, filter: Dict[str, Any]) -> bool:
        """Delete document(s)"""
        result = await self.collection.delete_one(filter)
        return result.deleted_count > 0
