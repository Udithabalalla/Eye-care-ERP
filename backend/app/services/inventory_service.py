"""Cross-catalogue inventory tools: low-stock list, reorder to draft POs, label sheets.

Works over both frame variants ("frame") and products ("product").
"""
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.exceptions import NotFoundException
from app.models.frame_master import FrameMasterModel
from app.models.frame_variant import FrameVariantModel
from app.models.product import ProductModel
from app.repositories.frame_master_repository import FrameMasterRepository
from app.repositories.frame_variant_repository import FrameVariantRepository
from app.repositories.product_repository import ProductRepository
from app.repositories.supplier_repository import SupplierRepository
from app.schemas.inventory import (
    LabelPrintRequest,
    LowStockItem,
    ReorderPurchaseOrder,
    ReorderRequest,
    ReorderResult,
    ReorderSkippedItem,
)
from app.schemas.purchase_order import PurchaseOrderCreate, PurchaseOrderItemCreate
from app.services.barcode_service import generate_label_pdf
from app.services.purchase_order_service import PurchaseOrderService


def suggested_variant_qty(v: FrameVariantModel) -> int:
    return max(v.reorder_level * 2 - v.current_stock, 1)


def suggested_product_qty(p: ProductModel) -> int:
    # reorder_quantity counts as "set" only if it is stored on the product and positive
    if "reorder_quantity" in p.model_fields_set and p.reorder_quantity > 0:
        return p.reorder_quantity
    return max(p.min_stock_level * 2 - p.current_stock, 1)


class InventoryService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.variant_repo = FrameVariantRepository(db)
        self.product_repo = ProductRepository(db)
        self.master_repo = FrameMasterRepository(db)
        self.supplier_repo = SupplierRepository(db)

    # ── Supplier resolution ───────────────────────────────────────────────────

    async def _supplier_index(self) -> Tuple[Dict[str, dict], Dict[str, dict]]:
        """All suppliers by id, and active suppliers by lower-cased supplier/company name (one query)."""
        docs = await self.supplier_repo.get_many({}, limit=0)
        by_id = {d["id"]: d for d in docs if d.get("id")}
        by_name: Dict[str, dict] = {}
        for d in docs:
            if d.get("is_active") is False:
                continue
            for key in ("supplier_name", "company_name"):
                name = (d.get(key) or "").strip().lower()
                if name:
                    by_name.setdefault(name, d)
        return by_id, by_name

    async def _masters_for(self, variants: List[FrameVariantModel]) -> Dict[str, FrameMasterModel]:
        masters = await self.master_repo.get_many_by_master_ids([v.frame_master_id for v in variants])
        return {m.frame_master_id: m for m in masters}

    @staticmethod
    def _variant_supplier_id(v: FrameVariantModel, masters: Dict[str, FrameMasterModel]) -> Optional[str]:
        """The variant's supplier, else the frame model's first (primary) supplier."""
        if v.supplier_id:
            return v.supplier_id
        master = masters.get(v.frame_master_id)
        return master.supplier_ids[0] if master and master.supplier_ids else None

    @staticmethod
    def _product_supplier(
        p: ProductModel, by_id: Dict[str, dict], by_name: Dict[str, dict]
    ) -> Tuple[Optional[str], Optional[str]]:
        """(supplier_id, supplier_name). Products store supplier details inline, so match by name if no id."""
        sup = p.supplier
        if not sup:
            return None, None
        if sup.supplier_id and sup.supplier_id in by_id:
            return sup.supplier_id, by_id[sup.supplier_id].get("supplier_name")
        match = by_name.get((sup.name or "").strip().lower())
        if match:
            return match["id"], match.get("supplier_name")
        return None, sup.name or None

    # ── Low stock ─────────────────────────────────────────────────────────────

    async def list_low_stock(self, kind: Optional[str] = None, out_of_stock_only: bool = False) -> List[LowStockItem]:
        by_id, by_name = await self._supplier_index()
        rows: List[LowStockItem] = []

        if kind in (None, "frame"):
            variants = await self.variant_repo.list_low_stock(out_of_stock_only)
            masters = await self._masters_for(variants)
            for v in variants:
                supplier_id = self._variant_supplier_id(v, masters)
                ref = v.frame_master_ref
                rows.append(LowStockItem(
                    kind="frame",
                    id=v.variant_id,
                    name=f"{ref.brand} {ref.model_code}",
                    detail=f"{v.color} · {v.eye_size}",
                    sku=v.sku,
                    current_stock=v.current_stock,
                    reorder_level=v.reorder_level,
                    suggested_qty=suggested_variant_qty(v),
                    supplier_id=supplier_id,
                    supplier_name=(by_id.get(supplier_id) or {}).get("supplier_name") if supplier_id else None,
                    unit_cost=v.cost_price,
                    out_of_stock=v.current_stock <= 0,
                    frame_master_id=v.frame_master_id,
                ))

        if kind in (None, "product"):
            for p in await self.product_repo.list_low_stock(out_of_stock_only):
                supplier_id, supplier_name = self._product_supplier(p, by_id, by_name)
                rows.append(LowStockItem(
                    kind="product",
                    id=p.product_id,
                    name=p.name,
                    detail=p.category,
                    sku=p.sku,
                    current_stock=p.current_stock,
                    reorder_level=p.min_stock_level,
                    suggested_qty=suggested_product_qty(p),
                    supplier_id=supplier_id,
                    supplier_name=supplier_name,
                    unit_cost=p.cost_price,
                    out_of_stock=p.current_stock <= 0,
                ))

        rows.sort(key=lambda r: (not r.out_of_stock, r.name.lower(), r.detail or ""))
        return rows

    # ── Reorder ───────────────────────────────────────────────────────────────

    async def reorder(self, data: ReorderRequest, created_by: str) -> ReorderResult:
        """One draft purchase order per supplier; items without a usable supplier are skipped."""
        by_id, by_name = await self._supplier_index()
        variants = {
            v.variant_id: v
            for v in await self.variant_repo.get_many_by_variant_ids([i.id for i in data.items if i.kind == "frame"])
        }
        products = {
            p.product_id: p
            for p in await self.product_repo.get_many_by_product_ids([i.id for i in data.items if i.kind == "product"])
        }
        masters = await self._masters_for(list(variants.values()))

        result = ReorderResult()
        # supplier_id -> {(kind, id): {"qty", "unit_cost", "name", "supplier_sku"}}, in request order
        groups: Dict[str, Dict[Tuple[str, str], dict]] = {}

        def skip(kind: str, item_id: str, reason: str, name: Optional[str] = None):
            result.skipped.append(ReorderSkippedItem(kind=kind, id=item_id, name=name, reason=reason))

        for req in data.items:
            if req.kind == "frame":
                v = variants.get(req.id)
                if not v:
                    skip(req.kind, req.id, "Frame variant not found")
                    continue
                name = f"{v.frame_master_ref.brand} {v.frame_master_ref.model_code} / {v.color} / {v.eye_size}"
                is_active, supplier_id = v.is_active, self._variant_supplier_id(v, masters)
                qty, unit_cost, supplier_sku = req.quantity or suggested_variant_qty(v), v.cost_price, v.supplier_frame_no
                unresolved_name = None
            else:
                p = products.get(req.id)
                if not p:
                    skip(req.kind, req.id, "Product not found")
                    continue
                name = p.name
                is_active = p.is_active
                supplier_id, unresolved_name = self._product_supplier(p, by_id, by_name)
                qty, unit_cost, supplier_sku = req.quantity or suggested_product_qty(p), p.cost_price, None

            if not is_active:
                skip(req.kind, req.id, "Item is inactive", name)
                continue
            if not supplier_id:
                reason = (
                    f"Supplier '{unresolved_name}' is not in the suppliers list"
                    if unresolved_name else "No supplier set for this item"
                )
                skip(req.kind, req.id, reason, name)
                continue
            supplier = by_id.get(supplier_id)
            if not supplier:
                skip(req.kind, req.id, f"Supplier {supplier_id} not found", name)
                continue
            if supplier.get("is_active") is False:
                skip(req.kind, req.id, f"Supplier {supplier.get('supplier_name') or supplier_id} is inactive", name)
                continue

            lines = groups.setdefault(supplier_id, {})
            line = lines.setdefault((req.kind, req.id), {
                "qty": 0, "unit_cost": unit_cost or 0.0, "name": name, "supplier_sku": supplier_sku,
            })
            line["qty"] += qty

        po_service = PurchaseOrderService(self.db)
        for supplier_id, lines in groups.items():
            items = [
                PurchaseOrderItemCreate(
                    frame_variant_id=item_id if kind == "frame" else None,
                    product_id=item_id if kind == "product" else None,
                    supplier_sku=line["supplier_sku"],
                    quantity=line["qty"],
                    unit_cost=line["unit_cost"],
                )
                for (kind, item_id), line in lines.items()
            ]
            try:
                po = await po_service.create_purchase_order(
                    PurchaseOrderCreate(supplier_id=supplier_id, order_date=datetime.now(timezone.utc), items=items),
                    created_by,
                )
            except HTTPException as exc:
                for (kind, item_id), line in lines.items():
                    skip(kind, item_id, f"Purchase order not created: {exc.detail}", line["name"])
                continue
            result.purchase_orders.append(ReorderPurchaseOrder(
                order_id=po.id,
                status=po.status,
                supplier_id=supplier_id,
                supplier_name=by_id[supplier_id].get("supplier_name"),
                line_count=len(po.items),
                total_quantity=sum(i.quantity for i in po.items),
                total_amount=po.total_amount,
            ))
        return result

    # ── Labels ────────────────────────────────────────────────────────────────

    async def build_labels_pdf(self, data: LabelPrintRequest) -> bytes:
        """One PDF sheet with ``copies`` labels per item, frames and products mixed."""
        variants = {
            v.variant_id: v
            for v in await self.variant_repo.get_many_by_variant_ids([i.id for i in data.items if i.kind == "frame"])
        }
        products = {
            p.product_id: p
            for p in await self.product_repo.get_many_by_product_ids([i.id for i in data.items if i.kind == "product"])
        }
        labels: List[dict] = []
        for item in data.items:
            if item.kind == "frame":
                v = variants.get(item.id)
                if not v:
                    raise NotFoundException(f"Frame variant {item.id} not found")
                labels.append({
                    "brand": v.frame_master_ref.brand,
                    "model_code": v.frame_master_ref.model_code,
                    "color": v.color,
                    "eye_size": v.eye_size,
                    "rim_type": v.rim_type,
                    "selling_price": v.selling_price,
                    "sku": v.sku,
                    "quantity": item.copies,
                })
            else:
                p = products.get(item.id)
                if not p:
                    raise NotFoundException(f"Product {item.id} not found")
                labels.append({
                    "title": p.name,
                    "detail": p.brand or p.category or "",
                    "selling_price": p.selling_price,
                    "sku": p.sku,
                    "barcode": p.barcode or p.sku,
                    "quantity": item.copies,
                })
        return generate_label_pdf(labels, data.label_type)
