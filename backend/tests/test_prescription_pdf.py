"""The prescription PDF, against an in-memory MongoDB (mongomock-motor)."""
import os

os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")
os.environ.setdefault("SECRET_KEY", "test-secret")

import base64
import re
import zlib
from datetime import datetime, timezone

import pytest
from mongomock_motor import AsyncMongoMockClient

from app.core.exceptions import NotFoundException
from app.services.prescription_service import PrescriptionService
from app.utils.constants import Gender


def _page_text(pdf: bytes) -> bytes:
    """The decoded page content, where the PDF's text lives. ReportLab writes streams as
    ASCII85 over Flate; images and other streams that don't decode are skipped."""
    out = []
    for m in re.finditer(rb"stream\r?\n(.*?)endstream", pdf, re.S):
        data = m.group(1).strip()
        try:
            if data.endswith(b"~>"):
                data = base64.a85decode(data[:-2].removeprefix(b"<~"))
            out.append(zlib.decompress(data))
        except (ValueError, zlib.error):
            continue
    return b"".join(out)


@pytest.fixture
async def db():
    database = AsyncMongoMockClient()["test_eye_care"]
    now = datetime.now(timezone.utc)
    await database["patients"].insert_one({
        "patient_id": "PAT000001", "name": "Test Patient", "date_of_birth": datetime(1990, 1, 1),
        "gender": list(Gender)[0].value, "phone": "0770000000", "is_active": True, "created_at": now,
    })
    await database["prescriptions"].insert_one({
        "prescription_id": "PRE000001", "patient_id": "PAT000001", "patient_name": "Test Patient",
        "doctor_id": "DOC000001", "doctor_name": "Dr Test", "prescription_date": now, "valid_until": now,
        "diagnosis": "Myopia", "notes": "Review in a year",
        "eye_prescription": {
            "prescription_type": "single-vision",
            "right_eye": {"sphere": -1.25, "cylinder": -0.5, "axis": 180, "visual_acuity": "6/6", "pupillary_distance": 31},
            "left_eye": {"sphere": -1.0, "cylinder": 0, "visual_acuity": "6/9", "pupillary_distance": 30.5},
        },
        "medications": [{"medication_name": "Eye drops", "dosage": "1 drop", "frequency": "Twice daily", "duration": "7 days", "quantity": 1}],
        "created_at": now,
    })
    return database


async def test_prescription_pdf_carries_the_measurements(db):
    pdf, filename = await PrescriptionService(db).generate_prescription_pdf("PRE000001")
    assert pdf.startswith(b"%PDF") and filename == "prescription-PRE000001.pdf"
    text = _page_text(pdf)
    for expected in (b"PRESCRIPTION", b"PRE000001", b"(6/6)", b"(6/9)", b"-1.25", b"Eye drops", b"Myopia"):
        assert expected in text, expected


async def test_missing_prescription_is_not_found(db):
    with pytest.raises(NotFoundException):
        await PrescriptionService(db).generate_prescription_pdf("PRE999999")
