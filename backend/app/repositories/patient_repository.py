from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple
from datetime import datetime, timezone
from app.repositories.base import BaseRepository
from app.models.patient import PatientModel

class PatientRepository(BaseRepository):
    """Patient repository"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "patients")
    
    async def get_by_patient_id(self, patient_id: str) -> Optional[PatientModel]:
        """Get patient by patient_id"""
        patient_dict = await self.get_one({"patient_id": patient_id})
        if patient_dict:
            return PatientModel(**patient_dict)
        return None
    
    async def get_by_phone(self, phone: str) -> Optional[PatientModel]:
        """Get patient by phone number"""
        patient_dict = await self.get_one({"phone": phone})
        if patient_dict:
            return PatientModel(**patient_dict)
        return None
    
    async def list_patients(
        self,
        skip: int = 0,
        limit: int = 10,
        search: Optional[str] = None
    ) -> Tuple[List[PatientModel], int]:
        """List patients with pagination and optional search"""
        filter_query = {"is_active": True}
        
        if search:
            filter_query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"patient_id": {"$regex": search, "$options": "i"}},
                {"phone": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}}
            ]
        
        patients_dict = await self.get_many(
            filter=filter_query,
            skip=skip,
            limit=limit,
            sort=[("created_at", -1)]
        )
        
        total = await self.count(filter_query)
        patients = [PatientModel(**p) for p in patients_dict]
        
        return patients, total
    
    async def create_patient(self, patient_data: PatientModel) -> PatientModel:
        """Create a new patient"""
        patient_dict = patient_data.dict()
        created = await self.create(patient_dict)
        return PatientModel(**created)
    
    async def update_patient(self, patient_id: str, update_data: dict) -> bool:
        """Update patient"""
        update_data["updated_at"] = datetime.now(timezone.utc)
        return await self.update({"patient_id": patient_id}, update_data)
    
    async def get_next_patient_number(self) -> int:
        """Get next patient number for ID generation"""
        # Find the patient with the highest number
        pipeline = [
            {
                "$project": {
                    "patient_id": 1,
                    "number": {
                        "$toInt": {
                            "$substr": ["$patient_id", 3, -1]  # Extract number after "PAT"
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
