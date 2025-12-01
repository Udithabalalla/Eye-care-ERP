from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
from datetime import datetime, date
import math

from app.repositories.appointment_repository import AppointmentRepository
from app.repositories.patient_repository import PatientRepository
from app.repositories.user_repository import UserRepository
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate, AppointmentResponse
from app.schemas.responses import PaginatedResponse
from app.models.appointment import AppointmentModel
from app.core.exceptions import NotFoundException, BadRequestException
from app.utils.helpers import generate_id, date_to_datetime
from datetime import datetime, time, timezone

class AppointmentService:
    """Appointment business logic service"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.appointment_repo = AppointmentRepository(db)
        self.patient_repo = PatientRepository(db)
        self.user_repo = UserRepository(db)
    
    async def list_appointments(
        self,
        page: int,
        page_size: int,
        patient_id: Optional[str] = None,
        doctor_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        status: Optional[str] = None
    ) -> PaginatedResponse[AppointmentResponse]:
        """List appointments with filters"""
        skip = (page - 1) * page_size
        
        appointments, total = await self.appointment_repo.list_appointments(
            skip=skip,
            limit=page_size,
            patient_id=patient_id,
            doctor_id=doctor_id,
            start_date=start_date,
            end_date=end_date,
            status=status
        )
        
        total_pages = math.ceil(total / page_size)
        appointment_responses = [AppointmentResponse(**a.dict()) for a in appointments]
        
        return PaginatedResponse(
            data=appointment_responses,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
    
    async def get_appointment(self, appointment_id: str) -> AppointmentResponse:
        """Get appointment by ID"""
        appointment = await self.appointment_repo.get_by_appointment_id(appointment_id)
        
        if not appointment:
            raise NotFoundException(f"Appointment with ID {appointment_id} not found")
        
        return AppointmentResponse(**appointment.dict())
    
    async def create_appointment(
        self,
        appointment_data: AppointmentCreate,
        current_user_id: str
    ) -> AppointmentResponse:
        """Create a new appointment"""
        # Validate patient exists
        patient = await self.patient_repo.get_by_patient_id(appointment_data.patient_id)
        if not patient:
            raise NotFoundException(f"Patient with ID {appointment_data.patient_id} not found")
        
        # Validate doctor exists
        doctor = await self.user_repo.get_by_user_id(appointment_data.doctor_id)
        if not doctor:
            raise NotFoundException(f"Doctor with ID {appointment_data.doctor_id} not found")
        
        # Generate appointment ID
        next_number = await self.appointment_repo.get_next_appointment_number()
        appointment_id = generate_id("APT", next_number)
        
        # Convert date and time to datetime
        appointment_date_dt = date_to_datetime(appointment_data.appointment_date)
        appointment_time_dt = datetime.combine(
            appointment_data.appointment_date,
            appointment_data.appointment_time
        ).replace(tzinfo=timezone.utc)
        
        # Create appointment model
        appointment_model = AppointmentModel(
            appointment_id=appointment_id,
            patient_name=patient.name,
            doctor_name=doctor.name,
            appointment_date=appointment_date_dt,
            appointment_time=appointment_time_dt,
            created_by=current_user_id,
            **appointment_data.dict(exclude={'appointment_date', 'appointment_time'})
        )
        
        # Save to database
        created_appointment = await self.appointment_repo.create_appointment(appointment_model)
        
        return AppointmentResponse(**created_appointment.dict())
    
    async def update_appointment(
        self,
        appointment_id: str,
        appointment_data: AppointmentUpdate
    ) -> AppointmentResponse:
        """Update appointment"""
        existing = await self.appointment_repo.get_by_appointment_id(appointment_id)
        if not existing:
            raise NotFoundException(f"Appointment with ID {appointment_id} not found")
        
        update_dict = appointment_data.dict(exclude_unset=True)
        
        # Convert date and time fields to datetime
        if 'appointment_date' in update_dict and update_dict['appointment_date']:
            update_dict['appointment_date'] = date_to_datetime(update_dict['appointment_date'])
        
        if 'appointment_time' in update_dict and update_dict['appointment_time']:
            # Get the date from existing or updated appointment
            appt_date = update_dict.get('appointment_date', existing.appointment_date)
            if isinstance(appt_date, datetime):
                appt_date = appt_date.date()
            update_dict['appointment_time'] = datetime.combine(
                appt_date,
                update_dict['appointment_time']
            ).replace(tzinfo=timezone.utc)
        
        if update_dict:
            await self.appointment_repo.update_appointment(appointment_id, update_dict)
        
        updated_appointment = await self.appointment_repo.get_by_appointment_id(appointment_id)
        return AppointmentResponse(**updated_appointment.dict())
    
    async def cancel_appointment(self, appointment_id: str, reason: str = "Cancelled by user"):
        """Cancel an appointment"""
        existing = await self.appointment_repo.get_by_appointment_id(appointment_id)
        if not existing:
            raise NotFoundException(f"Appointment with ID {appointment_id} not found")
        
        await self.appointment_repo.update_appointment(
            appointment_id,
            {
                "status": "cancelled",
                "cancelled_at": datetime.utcnow(),
                "cancellation_reason": reason
            }
        )
