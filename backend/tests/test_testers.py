"""The "Tested by" list, against an in-memory MongoDB (mongomock-motor)."""
import os

os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")
os.environ.setdefault("SECRET_KEY", "test-secret")

import pytest
from mongomock_motor import AsyncMongoMockClient

from app.core.exceptions import ConflictException, NotFoundException
# Imported by module: pytest would try to collect classes named Test… / Tester… here
from app.schemas import tester as schemas
from app.services import tester_service

ADMIN = "USR-ADMIN"


@pytest.fixture
async def service():
    return tester_service.TesterService(AsyncMongoMockClient()["test_eye_care"])


async def test_add_update_remove_and_restore(service):
    nimal = await service.create_tester(schemas.TesterCreate(name="  Nimal Perera ", title="Optometrist"), ADMIN)
    await service.create_tester(schemas.TesterCreate(name="Amara Silva"), ADMIN)
    assert nimal.name == "Nimal Perera" and nimal.is_active

    # The picker lists active names, A to Z
    assert [t.name for t in await service.list_testers(True)] == ["Amara Silva", "Nimal Perera"]

    updated = await service.update_tester(nimal.id, schemas.TesterUpdate(name="Dr Nimal Perera", title=" "), ADMIN)
    assert updated.name == "Dr Nimal Perera" and updated.title is None

    # Removed: off the picker, but still there for past orders
    await service.set_status(nimal.id, False, ADMIN)
    assert [t.name for t in await service.list_testers(True)] == ["Amara Silva"]
    assert {t.name for t in await service.list_testers()} == {"Amara Silva", "Dr Nimal Perera"}

    restored = await service.set_status(nimal.id, True, ADMIN)
    assert restored.is_active


async def test_names_are_not_listed_twice(service):
    first = await service.create_tester(schemas.TesterCreate(name="Amara Silva"), ADMIN)
    with pytest.raises(ConflictException):
        await service.create_tester(schemas.TesterCreate(name="amara silva"), ADMIN)

    other = await service.create_tester(schemas.TesterCreate(name="Kamal Fernando"), ADMIN)
    with pytest.raises(ConflictException):
        await service.update_tester(other.id, schemas.TesterUpdate(name="AMARA SILVA"), ADMIN)

    # Renaming to its own name (a different case) is fine
    assert (await service.update_tester(first.id, schemas.TesterUpdate(name="Amara SILVA"), ADMIN)).name == "Amara SILVA"

    # A removed name is offered back rather than added again
    await service.set_status(other.id, False, ADMIN)
    with pytest.raises(ConflictException, match="restore"):
        await service.create_tester(schemas.TesterCreate(name="Kamal Fernando"), ADMIN)


async def test_unknown_tester(service):
    with pytest.raises(NotFoundException):
        await service.set_status("not-an-id", False, ADMIN)
