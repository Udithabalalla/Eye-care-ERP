from fastapi import APIRouter, Depends, Query, Response
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config.database import get_database
from app.schemas.frame_variant import (
    FrameVariantCreate, FrameVariantBulkCreate, FrameVariantUpdate,
    StockAdjustVariant, FrameVariantResponse,
)
from app.schemas.responses import ResponseModel, PaginatedResponse
from app.services.frame_variant_service import FrameVariantService
from app.services.barcode_service import generate_barcode_png, generate_barcode_base64
from app.api.deps import get_current_user
from app.models.user import UserModel

router = APIRouter()


@router.get("", response_model=PaginatedResponse[FrameVariantResponse])
async def list_frame_variants(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    frame_master_id: Optional[str] = None,
    brand: Optional[str] = None,
    color: Optional[str] = None,
    rim_type: Optional[str] = None,
    supplier_id: Optional[str] = None,
    low_stock: bool = False,
    out_of_stock: bool = False,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = FrameVariantService(db)
    return await service.list_variants(
        page, page_size, search, frame_master_id, brand, color,
        rim_type, supplier_id, low_stock, out_of_stock,
    )


@router.post("", response_model=ResponseModel[FrameVariantResponse])
async def create_frame_variant(
    data: FrameVariantCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = FrameVariantService(db)
    result = await service.create_variant_safe(data)
    return ResponseModel(message="Variant created", data=result)


@router.post("/bulk", response_model=ResponseModel[List[FrameVariantResponse]])
async def bulk_create_variants(
    data: FrameVariantBulkCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = FrameVariantService(db)
    results = await service.bulk_create(data)
    return ResponseModel(message=f"{len(results)} variants created", data=results)


@router.get("/colors", response_model=ResponseModel[List[str]])
async def get_distinct_colors(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = FrameVariantService(db)
    return ResponseModel(data=await service.get_distinct_colors())


@router.get("/scan/{code}", response_model=ResponseModel[FrameVariantResponse])
async def lookup_by_scan_code(
    code: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    """Lookup variant by barcode, SKU, or variant_id — for scanner input."""
    service = FrameVariantService(db)
    result = await service.get_by_barcode(code)
    return ResponseModel(data=result)


@router.get("/master/{frame_master_id}", response_model=ResponseModel[List[FrameVariantResponse]])
async def list_variants_for_master(
    frame_master_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = FrameVariantService(db)
    variants = await service.list_for_master(frame_master_id)
    return ResponseModel(data=variants)


@router.get("/{variant_id}", response_model=ResponseModel[FrameVariantResponse])
async def get_frame_variant(
    variant_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = FrameVariantService(db)
    result = await service.get_variant(variant_id)
    return ResponseModel(data=result)


@router.put("/{variant_id}", response_model=ResponseModel[FrameVariantResponse])
async def update_frame_variant(
    variant_id: str,
    data: FrameVariantUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = FrameVariantService(db)
    result = await service.update_variant(variant_id, data)
    return ResponseModel(message="Variant updated", data=result)


@router.post("/{variant_id}/adjust-stock", response_model=ResponseModel[FrameVariantResponse])
async def adjust_stock(
    variant_id: str,
    data: StockAdjustVariant,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = FrameVariantService(db)
    result = await service.adjust_stock(variant_id, data)
    return ResponseModel(message="Stock adjusted", data=result)


@router.delete("/{variant_id}")
async def delete_frame_variant(
    variant_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = FrameVariantService(db)
    await service.delete_variant(variant_id)
    return ResponseModel(message="Variant deleted")


@router.get("/{variant_id}/barcode")
async def get_variant_barcode_png(
    variant_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Return Code128 barcode as PNG image."""
    service = FrameVariantService(db)
    variant = await service.get_variant(variant_id)
    png_bytes = generate_barcode_png(variant.sku)
    return Response(content=png_bytes, media_type="image/png")


@router.get("/{variant_id}/label")
async def get_variant_label_pdf(
    variant_id: str,
    label_type: str = Query("frame_tag", pattern="^(frame_tag|shelf_label|sticker)$"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    """Return a single-label PDF for printing."""
    from app.services.barcode_service import generate_label_pdf
    service = FrameVariantService(db)
    v = await service.get_variant(variant_id)
    pdf_bytes = generate_label_pdf([{
        "brand": v.frame_master_ref.brand,
        "model_code": v.frame_master_ref.model_code,
        "color": v.color,
        "eye_size": v.eye_size,
        "rim_type": v.rim_type,
        "selling_price": v.selling_price,
        "sku": v.sku,
        "quantity": 1,
    }], label_type)
    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": f"inline; filename={v.sku}.pdf"})
