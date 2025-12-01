from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
import math

from app.repositories.prescription_repository import PrescriptionRepository
from app.repositories.patient_repository import PatientRepository
from app.repositories.user_repository import UserRepository
from app.schemas.prescription import PrescriptionCreate, PrescriptionUpdate, PrescriptionResponse
from app.schemas.responses import PaginatedResponse
from app.models.prescription import PrescriptionModel
from app.core.exceptions import NotFoundException
from app.utils.helpers import generate_id, date_to_datetime

class PrescriptionService:
    """Prescription business logic service"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.prescription_repo = PrescriptionRepository(db)
        self.patient_repo = PatientRepository(db)
        self.user_repo = UserRepository(db)
    
    async def list_prescriptions(
        self,
        page: int,
        page_size: int,
        patient_id: Optional[str] = None,
        doctor_id: Optional[str] = None
    ) -> PaginatedResponse[PrescriptionResponse]:
        """List prescriptions with filters"""
        skip = (page - 1) * page_size
        
        prescriptions, total = await self.prescription_repo.list_prescriptions(
            skip=skip,
            limit=page_size,
            patient_id=patient_id,
            doctor_id=doctor_id
        )
        
        total_pages = math.ceil(total / page_size)
        prescription_responses = [PrescriptionResponse(**p.dict()) for p in prescriptions]
        
        return PaginatedResponse(
            data=prescription_responses,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
    
    async def get_prescription(self, prescription_id: str) -> PrescriptionResponse:
        """Get prescription by ID"""
        prescription = await self.prescription_repo.get_by_prescription_id(prescription_id)
        
        if not prescription:
            raise NotFoundException(f"Prescription with ID {prescription_id} not found")
        
        return PrescriptionResponse(**prescription.dict())
    
    async def create_prescription(
        self,
        prescription_data: PrescriptionCreate
    ) -> PrescriptionResponse:
        """Create a new prescription"""
        # Validate patient exists
        patient = await self.patient_repo.get_by_patient_id(prescription_data.patient_id)
        if not patient:
            raise NotFoundException(f"Patient with ID {prescription_data.patient_id} not found")
        
        # Validate doctor exists
        doctor = await self.user_repo.get_by_user_id(prescription_data.doctor_id)
        if not doctor:
            raise NotFoundException(f"Doctor with ID {prescription_data.doctor_id} not found")
        
        # Generate prescription ID
        next_number = await self.prescription_repo.get_next_prescription_number()
        prescription_id = generate_id("PRE", next_number)
        
        # Convert dates to datetime
        prescription_date_dt = date_to_datetime(prescription_data.prescription_date)
        valid_until_dt = date_to_datetime(prescription_data.valid_until)
        
        # Create prescription model
        prescription_model = PrescriptionModel(
            prescription_id=prescription_id,
            patient_name=patient.name,
            doctor_name=doctor.name,
            prescription_date=prescription_date_dt,
            valid_until=valid_until_dt,
            **prescription_data.dict(exclude={'prescription_date', 'valid_until'})
        )
        
        # Save to database
        created_prescription = await self.prescription_repo.create_prescription(prescription_model)
        
        return PrescriptionResponse(**created_prescription.dict())
    
    async def update_prescription(
        self,
        prescription_id: str,
        prescription_data: PrescriptionUpdate
    ) -> PrescriptionResponse:
        """Update prescription"""
        existing = await self.prescription_repo.get_by_prescription_id(prescription_id)
        if not existing:
            raise NotFoundException(f"Prescription with ID {prescription_id} not found")
        
        update_dict = prescription_data.dict(exclude_unset=True)
        
        if update_dict:
            await self.prescription_repo.update_prescription(prescription_id, update_dict)
        
        updated_prescription = await self.prescription_repo.get_by_prescription_id(prescription_id)
        return PrescriptionResponse(**updated_prescription.dict())
