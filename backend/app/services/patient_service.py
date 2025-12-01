from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
from datetime import datetime
import math

from app.repositories.patient_repository import PatientRepository
from app.schemas.patient import PatientCreate, PatientUpdate, PatientResponse
from app.schemas.responses import PaginatedResponse
from app.models.patient import PatientModel
from app.core.exceptions import NotFoundException, BadRequestException
from app.utils.helpers import generate_id, calculate_age, date_to_datetime

class PatientService:
    """Patient business logic service"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.patient_repo = PatientRepository(db)
    
    async def list_patients(
        self,
        page: int,
        page_size: int,
        search: Optional[str] = None
    ) -> PaginatedResponse[PatientResponse]:
        """List patients with pagination"""
        skip = (page - 1) * page_size
        
        patients, total = await self.patient_repo.list_patients(
            skip=skip,
            limit=page_size,
            search=search
        )
        
        total_pages = math.ceil(total / page_size)
        
        patient_responses = [PatientResponse(**p.dict()) for p in patients]
        
        return PaginatedResponse(
            data=patient_responses,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
    
    async def get_patient(self, patient_id: str) -> PatientResponse:
        """Get patient by ID"""
        patient = await self.patient_repo.get_by_patient_id(patient_id)
        
        if not patient:
            raise NotFoundException(f"Patient with ID {patient_id} not found")
        
        return PatientResponse(**patient.dict())
    
    async def create_patient(self, patient_data: PatientCreate) -> PatientResponse:
        """Create a new patient"""
        # Check if phone already exists
        existing = await self.patient_repo.get_by_phone(patient_data.phone)
        if existing:
            raise BadRequestException("Patient with this phone number already exists")
        
        # Generate patient ID
        next_number = await self.patient_repo.get_next_patient_number()
        patient_id = generate_id("PAT", next_number)
        
        # Convert date to datetime
        dob_datetime = date_to_datetime(patient_data.date_of_birth)
        
        # Calculate age
        age = calculate_age(dob_datetime)
        
        # Create patient model
        patient_model = PatientModel(
            patient_id=patient_id,
            date_of_birth=dob_datetime,  # Use datetime
            age=age,
            **patient_data.dict(exclude={'date_of_birth'})
        )
        
        # Save to database
        created_patient = await self.patient_repo.create_patient(patient_model)
        
        return PatientResponse(**created_patient.dict())
    
    async def update_patient(
        self,
        patient_id: str,
        patient_data: PatientUpdate
    ) -> PatientResponse:
        """Update patient information"""
        # Check if patient exists
        existing = await self.patient_repo.get_by_patient_id(patient_id)
        if not existing:
            raise NotFoundException(f"Patient with ID {patient_id} not found")
        
        # Prepare update data (exclude None values)
        update_dict = patient_data.dict(exclude_unset=True)
        
        if update_dict:
            # Update in database
            await self.patient_repo.update_patient(patient_id, update_dict)
        
        # Fetch and return updated patient
        updated_patient = await self.patient_repo.get_by_patient_id(patient_id)
        return PatientResponse(**updated_patient.dict())
    
    async def delete_patient(self, patient_id: str):
        """Soft delete a patient"""
        # Check if patient exists
        existing = await self.patient_repo.get_by_patient_id(patient_id)
        if not existing:
            raise NotFoundException(f"Patient with ID {patient_id} not found")
        
        # Soft delete (set is_active to False)
        await self.patient_repo.update_patient(patient_id, {"is_active": False})
