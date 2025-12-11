from typing import List, Optional
from fastapi import HTTPException, status
from app.models.doctor import DoctorModel
from app.schemas.doctor import DoctorCreate, DoctorUpdate
from app.repositories.doctor_repository import DoctorRepository
from app.utils.helpers import generate_id
from datetime import datetime

class DoctorService:
    def __init__(self):
        self.repository = DoctorRepository()

    async def create_doctor(self, doctor_data: DoctorCreate) -> DoctorModel:
        # Check if email already exists
        # Note: In a real app, we should add a get_by_email method to repository
        
        count = await self.repository.count()
        doctor_id = generate_id("DOC", count + 1)
        
        doctor = DoctorModel(
            doctor_id=doctor_id,
            **doctor_data.model_dump(),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        return await self.repository.create(doctor)

    async def get_doctor(self, doctor_id: str) -> DoctorModel:
        doctor = await self.repository.get_by_id(doctor_id)
        if not doctor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Doctor not found"
            )
        return doctor

    async def get_doctors(self, skip: int = 0, limit: int = 100, active_only: bool = False) -> List[DoctorModel]:
        return await self.repository.get_all(skip, limit, active_only)

    async def update_doctor(self, doctor_id: str, doctor_data: DoctorUpdate) -> DoctorModel:
        # Check if doctor exists
        await self.get_doctor(doctor_id)
        
        update_dict = doctor_data.model_dump(exclude_unset=True)
        if not update_dict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )
            
        update_dict["updated_at"] = datetime.utcnow()
        
        updated_doctor = await self.repository.update(doctor_id, update_dict)
        return updated_doctor

    async def delete_doctor(self, doctor_id: str) -> bool:
        # Check if doctor exists
        await self.get_doctor(doctor_id)
        return await self.repository.delete(doctor_id)
