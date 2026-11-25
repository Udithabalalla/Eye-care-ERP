"""Patients and their phone numbers, against an in-memory MongoDB (mongomock-motor)."""
import os

os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")
os.environ.setdefault("SECRET_KEY", "test-secret")

from datetime import date

import pytest
from mongomock_motor import AsyncMongoMockClient

from app.core.exceptions import BadRequestException
from app.schemas.patient import PatientCreate
from app.services.patient_service import PatientService


@pytest.fixture
async def db():
    return AsyncMongoMockClient()["test_eye_care"]


def _patient(name: str, phone: str, **extra) -> PatientCreate:
    return PatientCreate(name=name, date_of_birth=date(1980, 1, 1), phone=phone, **extra)


async def test_same_number_typed_differently_is_caught(db):
    service = PatientService(db)
    await service.create_patient(_patient("S Sarathchandra", "078 2481306"))

    for typed in ("0782481306", "+94 78 248 1306", "078-248-1306"):
        with pytest.raises(BadRequestException, match="already exists"):
            await service.create_patient(_patient("Someone Else", typed))


async def test_a_family_member_on_the_same_number_once_confirmed(db):
    service = PatientService(db)
    first = await service.create_patient(_patient("S Sarathchandra", "078 2481306"))
    second = await service.create_patient(_patient("K Sarathchandra", "0782481306", allow_shared_phone=True))

    assert second.patient_id != first.patient_id
    stored = await db["patients"].find_one({"patient_id": second.patient_id})
    assert "allow_shared_phone" not in stored


async def test_search_finds_a_number_however_it_was_typed(db):
    service = PatientService(db)
    created = await service.create_patient(_patient("S Sarathchandra", "078 2481306"))

    for typed in ("0782481306", "+94782481306", "078 248", "2481306"):
        found = await service.list_patients(1, 10, search=typed)
        assert [p.patient_id for p in found.data] == [created.patient_id], typed

    # A name search is not read as a phone number
    assert (await service.list_patients(1, 10, search="sarath")).total == 1
    assert (await service.list_patients(1, 10, search="0711111111")).total == 0
