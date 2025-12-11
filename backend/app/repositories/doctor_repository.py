from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorCollection
from app.models.doctor import DoctorModel
from app.config.database import get_database

class DoctorRepository:
    def __init__(self):
        self.collection_name = "doctors"

    @property
    def collection(self) -> AsyncIOMotorCollection:
        return get_database()[self.collection_name]

    async def create(self, doctor: DoctorModel) -> DoctorModel:
        await self.collection.insert_one(doctor.model_dump())
        return doctor

    async def get_by_id(self, doctor_id: str) -> Optional[DoctorModel]:
        doc = await self.collection.find_one({"doctor_id": doctor_id})
        return DoctorModel(**doc) if doc else None

    async def get_all(self, skip: int = 0, limit: int = 100, active_only: bool = False) -> List[DoctorModel]:
        query = {}
        if active_only:
            query["is_active"] = True
            
        cursor = self.collection.find(query).skip(skip).limit(limit)
        doctors = []
        async for doc in cursor:
            doctors.append(DoctorModel(**doc))
        return doctors

    async def update(self, doctor_id: str, update_data: dict) -> Optional[DoctorModel]:
        result = await self.collection.update_one(
            {"doctor_id": doctor_id},
            {"$set": update_data}
        )
        if result.modified_count > 0:
            return await self.get_by_id(doctor_id)
        return None

    async def delete(self, doctor_id: str) -> bool:
        result = await self.collection.delete_one({"doctor_id": doctor_id})
        return result.deleted_count > 0

    async def count(self) -> int:
        return await self.collection.count_documents({})
