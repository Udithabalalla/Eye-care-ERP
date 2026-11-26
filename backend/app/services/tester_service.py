from typing import List

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.exceptions import ConflictException, NotFoundException
from app.models.tester import TesterModel
from app.repositories.tester_repository import TesterRepository
from app.schemas.tester import TesterCreate, TesterResponse, TesterUpdate
from app.services.audit_service import AuditService


class TesterService:
    """The "Tested by" list on sales orders, kept by the admin in Settings"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = TesterRepository(db)
        self.audit_service = AuditService(db)

    @staticmethod
    def _clean_title(title: str | None) -> str | None:
        return (title or "").strip() or None

    async def list_testers(self, is_active: bool | None = None) -> List[TesterResponse]:
        return [TesterResponse(**t.model_dump()) for t in await self.repo.list_testers(is_active)]

    async def _get(self, tester_id: str) -> TesterModel:
        tester = await self.repo.get_by_id(tester_id)
        if not tester:
            raise NotFoundException(f"Tester {tester_id} not found")
        return tester

    async def _check_name_free(self, name: str, own_id: str | None = None) -> None:
        clash = await self.repo.get_by_name(name)
        if clash and clash.id != own_id:
            hint = "" if clash.is_active else " (it was removed; restore it instead)"
            raise ConflictException(f"{clash.name} is already on the list{hint}")

    async def create_tester(self, data: TesterCreate, created_by: str) -> TesterResponse:
        name = data.name.strip()
        await self._check_name_free(name)
        created = await self.repo.create_tester(TesterModel(name=name, title=self._clean_title(data.title)))
        await self.audit_service.log(created_by, "tester_created", "Tester", created.id, new_value={"name": name})
        return TesterResponse(**created.model_dump())

    async def update_tester(self, tester_id: str, data: TesterUpdate, updated_by: str) -> TesterResponse:
        existing = await self._get(tester_id)
        changes = data.model_dump(exclude_unset=True)
        if "name" in changes:
            changes["name"] = (changes["name"] or "").strip() or existing.name
            await self._check_name_free(changes["name"], tester_id)
        if "title" in changes:
            changes["title"] = self._clean_title(changes["title"])
        if changes:
            await self.repo.update_by_id(tester_id, changes)
            await self.audit_service.log(
                updated_by, "tester_updated", "Tester", tester_id,
                old_value={k: getattr(existing, k) for k in changes}, new_value=changes,
            )
        return TesterResponse(**(await self._get(tester_id)).model_dump())

    async def set_status(self, tester_id: str, is_active: bool, updated_by: str) -> TesterResponse:
        """Removing hides the name from the picker; past orders keep showing it"""
        await self._get(tester_id)
        await self.repo.update_by_id(tester_id, {"is_active": is_active})
        await self.audit_service.log(
            updated_by, "tester_restored" if is_active else "tester_removed", "Tester", tester_id,
            new_value={"is_active": is_active},
        )
        return TesterResponse(**(await self._get(tester_id)).model_dump())
