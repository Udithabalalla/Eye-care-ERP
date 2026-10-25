"""Patient visits come from what happened: confirmed orders, eye tests and completed appointments."""
import os

os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")
os.environ.setdefault("SECRET_KEY", "test-secret")

from datetime import datetime, timedelta, timezone

import pytest
from mongomock_motor import AsyncMongoMockClient

from app.services.patient_service import PatientService


@pytest.fixture
async def db():
    database = AsyncMongoMockClient()["test_patients"]
    now = datetime.now(timezone.utc)
    await database["patients"].insert_many([
        {"patient_id": "PAT000001", "name": "Nimali Perera", "date_of_birth": datetime(1990, 5, 1), "gender": "female",
         "phone": "0771234567", "is_active": True, "created_at": now},
        {"patient_id": "PAT000002", "name": "New Person", "date_of_birth": datetime(2000, 1, 1), "gender": "male",
         "phone": "0770000000", "is_active": True, "created_at": now},
    ])
    await database["sales_orders"].insert_many([
        {"order_id": "SO1", "patient_id": "PAT000001", "status": "delivered", "created_at": now - timedelta(days=40)},
        {"order_id": "SO2", "patient_id": "PAT000001", "status": "draft", "created_at": now - timedelta(days=1)},       # not a visit
        {"order_id": "SO3", "patient_id": "PAT000001", "status": "cancelled", "created_at": now - timedelta(days=2)},   # not a visit
    ])
    await database["prescriptions"].insert_one(
        {"prescription_id": "RX1", "patient_id": "PAT000001", "prescription_date": now - timedelta(days=40)},  # same day as SO1
    )
    await database["appointments"].insert_many([
        {"appointment_id": "A1", "patient_id": "PAT000001", "status": "completed", "appointment_date": now - timedelta(days=10)},
        {"appointment_id": "A2", "patient_id": "PAT000001", "status": "scheduled", "appointment_date": now + timedelta(days=3)},
        {"appointment_id": "A3", "patient_id": "PAT000001", "status": "cancelled", "appointment_date": now + timedelta(days=1)},
    ])
    return database


async def test_visits_last_visit_and_next_appointment_are_worked_out(db):
    listed = {p.patient_id: p for p in (await PatientService(db).list_patients(1, 10)).data}

    nimali = listed["PAT000001"]
    assert nimali.total_visits == 2  # order + eye test on one day, and the completed appointment
    assert (datetime.now(timezone.utc) - nimali.last_visit.replace(tzinfo=timezone.utc)).days == 10
    assert (nimali.next_appointment.replace(tzinfo=timezone.utc) - datetime.now(timezone.utc)).days in (2, 3)

    newcomer = listed["PAT000002"]
    assert (newcomer.total_visits, newcomer.last_visit, newcomer.next_appointment) == (0, None, None)

    single = await PatientService(db).get_patient("PAT000001")
    assert single.total_visits == 2
