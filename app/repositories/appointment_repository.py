from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple
from datetime import date, datetime, timezone
from app.repositories.base import BaseRepository
from app.models.appointment import AppointmentModel

class AppointmentRepository(BaseRepository):
    """Appointment repository"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "appointments")
    
    async def get_by_appointment_id(self, appointment_id: str) -> Optional[AppointmentModel]:
        """Get appointment by appointment_id"""
        appt_dict = await self.get_one({"appointment_id": appointment_id})
        if appt_dict:
            return AppointmentModel(**appt_dict)
        return None
    
    async def list_appointments(
        self,
        skip: int = 0,
        limit: int = 10,
        patient_id: Optional[str] = None,
        doctor_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        status: Optional[str] = None
    ) -> Tuple[List[AppointmentModel], int]:
        """List appointments with filters"""
        from app.utils.helpers import date_to_datetime
        
        filter_query = {}
        
        if patient_id:
            filter_query["patient_id"] = patient_id
        if doctor_id:
            filter_query["doctor_id"] = doctor_id
        if status:
            filter_query["status"] = status
        if start_date and end_date:
            filter_query["appointment_date"] = {
                "$gte": date_to_datetime(start_date),
                "$lte": date_to_datetime(end_date)
            }
        elif start_date:
            filter_query["appointment_date"] = {"$gte": date_to_datetime(start_date)}
        elif end_date:
            filter_query["appointment_date"] = {"$lte": date_to_datetime(end_date)}
        
        appointments_dict = await self.get_many(
            filter=filter_query,
            skip=skip,
            limit=limit,
            sort=[("appointment_date", -1), ("appointment_time", -1)]
        )
        
        total = await self.count(filter_query)
        appointments = [AppointmentModel(**a) for a in appointments_dict]
        
        return appointments, total
    
    async def create_appointment(self, appointment_data: AppointmentModel) -> AppointmentModel:
        """Create a new appointment"""
        appt_dict = appointment_data.dict()
        created = await self.create(appt_dict)
        return AppointmentModel(**created)
    
    async def update_appointment(self, appointment_id: str, update_data: dict) -> bool:
        """Update appointment"""
        update_data["updated_at"] = datetime.now(timezone.utc)
        return await self.update({"appointment_id": appointment_id}, update_data)
    
    async def get_next_appointment_number(self) -> int:
        """Get next appointment number for ID generation"""
        # Find the appointment with the highest number
        pipeline = [
            {
                "$project": {
                    "appointment_id": 1,
                    "number": {
                        "$toInt": {
                            "$substr": ["$appointment_id", 3, -1]  # Extract number after "APT"
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
