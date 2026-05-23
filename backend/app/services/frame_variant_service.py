import math
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.frame_variant_repository import FrameVariantRepository
from app.repositories.frame_master_repository import FrameMasterRepository
from app.schemas.frame_variant import (
    FrameVariantCreate, FrameVariantBulkCreate, FrameVariantUpdate,
    StockAdjustVariant, FrameVariantResponse,
)
from app.schemas.responses import PaginatedResponse
from app.models.frame_variant import FrameVariantModel, FrameMasterRef
from app.core.exceptions import NotFoundException, ConflictException, BadRequestException
from app.services.sku_generator_service import generate_sku_unique
from app.services.inventory_movement_service import InventoryMovementService
from app.schemas.inventory_movement import InventoryMovementCreate
from app.utils.constants import InventoryMovementType, LedgerReferenceType
from app.utils.helpers import generate_id


def _to_response(v: FrameVariantModel) -> FrameVariantResponse:
    return FrameVariantResponse(**v.dict())


class FrameVariantService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = FrameVariantRepository(db)
        self.master_repo = FrameMasterRepository(db)
        self.inv_service = InventoryMovementService(db)

    async def _build_variant(
        self, data: FrameVariantCreate, next_num: int, existing_skus: set
    ) -> FrameVariantModel:
        master = await self.master_repo.get_by_master_id(data.frame_master_id)
        if not master:
            raise NotFoundException(f"Frame master {data.frame_master_id} not found")

        sku = generate_sku_unique(
            master.brand, master.model_code, data.color,
            data.eye_size, data.rim_type, existing_skus,
        )
        variant_id = generate_id("FV-", next_num, 6)
        return FrameVariantModel(
            variant_id=variant_id,
            sku=sku,
            barcode=sku,
            frame_master_ref=FrameMasterRef(
                brand=master.brand,
                model_code=master.model_code,
                frame_name=master.frame_name,
                category=master.category,
                shape=master.shape,
            ),
            **data.dict(),
        )

    async def create_variant(self, data: FrameVariantCreate) -> FrameVariantResponse:
        next_num = await self.repo.get_next_variant_number()
        sku_candidate = generate_sku_unique(
            (await self.master_repo.get_by_master_id(data.frame_master_id) or (_ for _ in ()).throw(
                NotFoundException(f"Frame master {data.frame_master_id} not found")
            )).brand if False else "",
            "", data.color, data.eye_size, data.rim_type, set()
        )
        variant = await self._build_variant(data, next_num, set())
        if await self.repo.sku_exists(variant.sku):
            raise ConflictException(f"Variant with SKU {variant.sku} already exists")
        created = await self.repo.create_variant(variant)
        return _to_response(created)

    async def create_variant_safe(self, data: FrameVariantCreate) -> FrameVariantResponse:
        """Create a single variant, deriving the SKU properly."""
        master = await self.master_repo.get_by_master_id(data.frame_master_id)
        if not master:
            raise NotFoundException(f"Frame master {data.frame_master_id} not found")

        existing_skus: set = set()
        sku = generate_sku_unique(master.brand, master.model_code, data.color, data.eye_size, data.rim_type, existing_skus)
        if await self.repo.sku_exists(sku):
            raise ConflictException(f"Variant {sku} already exists")

        next_num = await self.repo.get_next_variant_number()
        variant_id = generate_id("FV-", next_num, 6)
        variant = FrameVariantModel(
            variant_id=variant_id,
            sku=sku,
            barcode=sku,
            frame_master_ref=FrameMasterRef(
                brand=master.brand, model_code=master.model_code,
                frame_name=master.frame_name, category=master.category, shape=master.shape,
            ),
            **data.dict(),
        )
        created = await self.repo.create_variant(variant)
        return _to_response(created)

    async def bulk_create(self, data: FrameVariantBulkCreate) -> List[FrameVariantResponse]:
        master = await self.master_repo.get_by_master_id(data.frame_master_id)
        if not master:
            raise NotFoundException(f"Frame master {data.frame_master_id} not found")

        existing_skus: set = set()
        variants_to_create: List[FrameVariantModel] = []
        next_num = await self.repo.get_next_variant_number()

        for color in data.colors:
            for eye_size in data.eye_sizes:
                sku = generate_sku_unique(master.brand, master.model_code, color, eye_size, data.rim_type, existing_skus)
                if await self.repo.sku_exists(sku):
                    existing_skus.add(sku)
                    continue
                existing_skus.add(sku)
                variant_id = generate_id("FV-", next_num, 6)
                next_num += 1
                variants_to_create.append(FrameVariantModel(
                    variant_id=variant_id,
                    sku=sku,
                    barcode=sku,
                    frame_master_id=data.frame_master_id,
                    frame_master_ref=FrameMasterRef(
                        brand=master.brand, model_code=master.model_code,
                        frame_name=master.frame_name, category=master.category, shape=master.shape,
                    ),
                    color=color,
                    eye_size=eye_size,
                    bridge_size=data.bridge_size,
                    temple_length=data.temple_length,
                    rim_type=data.rim_type,
                    cost_price=data.cost_price,
                    selling_price=data.selling_price,
                    mrp=data.mrp,
                    reorder_level=data.reorder_level,
                    supplier_id=data.supplier_id,
                ))

        if variants_to_create:
            await self.repo.create_variants_bulk(variants_to_create)

        return [_to_response(v) for v in variants_to_create]

    async def list_variants(
        self,
        page: int,
        page_size: int,
        search: Optional[str] = None,
        frame_master_id: Optional[str] = None,
        brand: Optional[str] = None,
        color: Optional[str] = None,
        rim_type: Optional[str] = None,
        supplier_id: Optional[str] = None,
        low_stock: bool = False,
        out_of_stock: bool = False,
    ) -> PaginatedResponse[FrameVariantResponse]:
        skip = (page - 1) * page_size
        variants, total = await self.repo.list_variants(
            skip, page_size, search, frame_master_id, brand, color,
            rim_type, supplier_id, low_stock, out_of_stock,
        )
        return PaginatedResponse(
            data=[_to_response(v) for v in variants],
            total=total, page=page, page_size=page_size,
            total_pages=math.ceil(total / page_size) if total else 1,
        )

    async def get_variant(self, variant_id: str) -> FrameVariantResponse:
        v = await self.repo.get_by_variant_id(variant_id)
        if not v:
            raise NotFoundException(f"Frame variant {variant_id} not found")
        return _to_response(v)

    async def get_by_sku(self, sku: str) -> FrameVariantResponse:
        v = await self.repo.get_by_sku(sku)
        if not v:
            raise NotFoundException(f"Variant with SKU {sku} not found")
        return _to_response(v)

    async def get_by_barcode(self, barcode: str) -> FrameVariantResponse:
        v = await self.repo.get_by_scan_code(barcode)
        if not v:
            raise NotFoundException(f"Variant with barcode {barcode} not found")
        return _to_response(v)

    async def update_variant(self, variant_id: str, data: FrameVariantUpdate) -> FrameVariantResponse:
        existing = await self.repo.get_by_variant_id(variant_id)
        if not existing:
            raise NotFoundException(f"Frame variant {variant_id} not found")
        update_dict = data.dict(exclude_unset=True)
        if update_dict:
            await self.repo.update_variant(variant_id, update_dict)
        return await self.get_variant(variant_id)

    async def adjust_stock(self, variant_id: str, data: StockAdjustVariant) -> FrameVariantResponse:
        existing = await self.repo.get_by_variant_id(variant_id)
        if not existing:
            raise NotFoundException(f"Frame variant {variant_id} not found")
        delta = data.new_stock - existing.current_stock
        await self.repo.set_stock_atomic(variant_id, data.new_stock)
        await self.inv_service.create_movement(
            InventoryMovementCreate(
                product_id=variant_id,
                movement_type=InventoryMovementType.ADJUSTMENT,
                quantity=delta,
                reference_type=LedgerReferenceType.STOCK_ADJUSTMENT,
                reference_id=variant_id,
            ),
            "system",
            apply_stock_change=False,
        )
        return await self.get_variant(variant_id)

    async def delete_variant(self, variant_id: str):
        existing = await self.repo.get_by_variant_id(variant_id)
        if not existing:
            raise NotFoundException(f"Frame variant {variant_id} not found")
        await self.repo.update_variant(variant_id, {"is_active": False})

    async def get_distinct_colors(self) -> List[str]:
        return await self.repo.get_distinct_colors()

    async def list_for_master(self, frame_master_id: str) -> List[FrameVariantResponse]:
        variants = await self.repo.list_for_master(frame_master_id)
        return [_to_response(v) for v in variants]
