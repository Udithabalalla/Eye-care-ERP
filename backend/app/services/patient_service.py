from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
from collections import defaultdict
from datetime import datetime, timezone
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
        self.db = db
        self.patient_repo = PatientRepository(db)

    @staticmethod
    def _utc(value) -> Optional[datetime]:
        if isinstance(value, str):
            try:
                value = datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                return None
        if not isinstance(value, datetime):
            return None
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

    async def _activity(self, patient_ids: list[str]) -> dict[str, dict]:
        """
        Visits worked out from what actually happened — confirmed orders, eye tests and
        completed appointments (a day with any of them is one visit) — plus the next booking.
        The stored visit fields were never kept up to date, so they can't be relied on.
        """
        ids = [pid for pid in set(patient_ids) if pid]
        if not ids:
            return {}
        days: dict[str, set] = defaultdict(set)
        last: dict[str, datetime] = {}
        upcoming: dict[str, datetime] = {}

        def seen(patient_id: str, when) -> None:
            when = self._utc(when)
            if not when:
                return
            days[patient_id].add(when.date())
            if patient_id not in last or when > last[patient_id]:
                last[patient_id] = when

        orders = self.db["sales_orders"].find(
            {"patient_id": {"$in": ids}, "status": {"$nin": ["draft", "cancelled"]}}, {"patient_id": 1, "created_at": 1}
        )
        async for doc in orders:
            seen(doc["patient_id"], doc.get("created_at"))
        prescriptions = self.db["prescriptions"].find({"patient_id": {"$in": ids}}, {"patient_id": 1, "prescription_date": 1})
        async for doc in prescriptions:
            seen(doc["patient_id"], doc.get("prescription_date"))

        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        appointments = self.db["appointments"].find(
            {"patient_id": {"$in": ids}, "status": {"$in": ["completed", "scheduled", "confirmed"]}},
            {"patient_id": 1, "appointment_date": 1, "status": 1},
        )
        async for doc in appointments:
            when = self._utc(doc.get("appointment_date"))
            if not when:
                continue
            if doc.get("status") == "completed":
                seen(doc["patient_id"], when)
            elif when >= today and (doc["patient_id"] not in upcoming or when < upcoming[doc["patient_id"]]):
                upcoming[doc["patient_id"]] = when

        return {
            pid: {"visits": len(days.get(pid, ())), "last": last.get(pid), "next": upcoming.get(pid)}
            for pid in ids
        }
    
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

        activity = await self._activity([p.patient_id for p in patients])
        patient_responses = [self._to_response(p, activity.get(p.patient_id)) for p in patients]
        
        return PaginatedResponse(
            data=patient_responses,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
    
    def _to_response(self, patient: PatientModel, activity: Optional[dict] = None) -> PatientResponse:
        data = patient.dict()
        data["age"] = calculate_age(patient.date_of_birth)
        if activity:
            stored_last = self._utc(patient.last_visit)
            derived_last = activity.get("last")
            data["last_visit"] = max(filter(None, [stored_last, derived_last]), default=None)
            data["total_visits"] = max(patient.total_visits or 0, activity.get("visits") or 0)
            data["next_appointment"] = activity.get("next") or patient.next_appointment
        return PatientResponse(**data)

    async def get_patient(self, patient_id: str) -> PatientResponse:
        """Get patient by ID"""
        patient = await self.patient_repo.get_by_patient_id(patient_id)

        if not patient:
            raise NotFoundException(f"Patient with ID {patient_id} not found")

        activity = await self._activity([patient.patient_id])
        return self._to_response(patient, activity.get(patient.patient_id))
    
    async def create_patient(self, patient_data: PatientCreate) -> PatientResponse:
        """Create a new patient"""
        # Check if phone already exists
        existing = await self.patient_repo.get_by_phone(patient_data.phone)
        if existing:
            raise BadRequestException("Patient with this phone number already exists")
        
        # Generate patient ID
        next_number = await self.patient_repo.get_next_patient_number()
        patient_id = generate_id("PAT", next_number)
        
        dob_datetime = date_to_datetime(patient_data.date_of_birth)

        patient_model = PatientModel(
            patient_id=patient_id,
            date_of_birth=dob_datetime,
            **patient_data.dict(exclude={'date_of_birth'})
        )

        created_patient = await self.patient_repo.create_patient(patient_model)
        return self._to_response(created_patient)
    
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

            # Propagate denormalized fields to related collections
            denorm: dict = {}
            if "name" in update_dict:
                denorm["patient_name"] = update_dict["name"]
            if "phone" in update_dict:
                denorm["patient_phone"] = update_dict["phone"]
            if "email" in update_dict:
                denorm["patient_email"] = update_dict["email"]

            if denorm:
                match = {"patient_id": patient_id}
                # invoices store patient_name, patient_phone, patient_email
                await self.patient_repo.db["invoices"].update_many(match, {"$set": denorm})
                # appointments, prescriptions, sales_orders only store patient_name
                if "patient_name" in denorm:
                    name_set = {"$set": {"patient_name": denorm["patient_name"]}}
                    await self.patient_repo.db["appointments"].update_many(match, name_set)
                    await self.patient_repo.db["prescriptions"].update_many(match, name_set)
                    await self.patient_repo.db["sales_orders"].update_many(match, name_set)

        # Fetch and return updated patient
        updated_patient = await self.patient_repo.get_by_patient_id(patient_id)
        return self._to_response(updated_patient)
    
    async def delete_patient(self, patient_id: str):
        """Soft delete a patient"""
        # Check if patient exists
        existing = await self.patient_repo.get_by_patient_id(patient_id)
        if not existing:
            raise NotFoundException(f"Patient with ID {patient_id} not found")
        
        # Soft delete (set is_active to False)
        await self.patient_repo.update_patient(patient_id, {"is_active": False})
