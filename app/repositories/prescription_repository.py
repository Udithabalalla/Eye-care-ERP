from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple
from datetime import datetime, timezone
from app.repositories.base import BaseRepository
from app.models.prescription import PrescriptionModel

class PrescriptionRepository(BaseRepository):
    """Prescription repository"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "prescriptions")
    
    async def get_by_prescription_id(self, prescription_id: str) -> Optional[PrescriptionModel]:
        """Get prescription by prescription_id"""
        prescription_dict = await self.get_one({"prescription_id": prescription_id})
        if prescription_dict:
            return PrescriptionModel(**prescription_dict)
        return None
    
    async def list_prescriptions(
        self,
        skip: int = 0,
        limit: int = 10,
        patient_id: Optional[str] = None,
        doctor_id: Optional[str] = None
    ) -> Tuple[List[PrescriptionModel], int]:
        """List prescriptions with filters"""
        filter_query = {}
        
        if patient_id:
            filter_query["patient_id"] = patient_id
        if doctor_id:
            filter_query["doctor_id"] = doctor_id
        
        prescriptions_dict = await self.get_many(
            filter=filter_query,
            skip=skip,
            limit=limit,
            sort=[("prescription_date", -1)]
        )
        
        total = await self.count(filter_query)
        prescriptions = [PrescriptionModel(**p) for p in prescriptions_dict]
        
        return prescriptions, total
    
    async def create_prescription(self, prescription_data: PrescriptionModel) -> PrescriptionModel:
        """Create a new prescription"""
        prescription_dict = prescription_data.dict()
        created = await self.create(prescription_dict)
        return PrescriptionModel(**created)
    
    async def update_prescription(self, prescription_id: str, update_data: dict) -> bool:
        """Update prescription"""
        update_data["updated_at"] = datetime.now(timezone.utc)
        return await self.update({"prescription_id": prescription_id}, update_data)
    
    async def get_next_prescription_number(self) -> int:
        """Get next prescription number for ID generation"""
        pipeline = [
            {
                "$project": {
                    "prescription_id": 1,
                    "number": {
                        "$toInt": {
                            "$substr": ["$prescription_id", 3, -1]
                        }
                    }
                }
            },
            {"$sort": {"number": -1}},
            {"$limit": 1}
        ]
        
        result = await self.collection.aggregate(pipeline).to_list(length=1)
        
        if result:
            return result[0]["number"] + 1
        return 1
