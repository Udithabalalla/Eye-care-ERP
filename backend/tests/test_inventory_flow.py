"""Inventory stock flows against an in-memory MongoDB (mongomock-motor).

Covers: GRN pending → commit (once) with movements, GRN/PO receiving through one
path with partial deliveries, quick intake and opening-stock movements,
adjustment reason/user, movement listing, low stock, reorder and labels.
"""
import os

os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")
os.environ.setdefault("SECRET_KEY", "test-secret")

from datetime import datetime, timezone

import pytest
from mongomock_motor import AsyncMongoMockClient

from app.core.exceptions import BadRequestException
from app.schemas.frame_variant import FrameVariantCreate, StockAdjustVariant
from app.schemas.goods_receipt import GoodsReceiptCreate
from app.schemas.inventory import LabelPrintRequest, ReorderRequest
from app.schemas.product import ProductCreate, StockAdjustment
from app.schemas.purchase_order import PurchaseOrderCreate, ReceiveStockRequest
from app.schemas.quick_intake import QuickIntakeCreate
from app.services.frame_master_service import FrameMasterService
from app.services.frame_variant_service import FrameVariantService
from app.services.goods_receipt_service import GoodsReceiptService
from app.services.inventory_movement_service import InventoryMovementService
from app.services.inventory_service import InventoryService
from app.services.product_service import ProductService
from app.services.purchase_order_service import PurchaseOrderService
from app.services.quick_intake_service import QuickIntakeService
from app.utils.constants import PurchaseOrderStatus

USER = "USR-TEST"


def _variant(variant_id, sku, color, stock, reorder_level=2, supplier_id="SUP000001", master_id="FM-000001", **extra):
    return {
        "variant_id": variant_id, "sku": sku, "barcode": sku,
        "frame_master_id": master_id,
        "frame_master_ref": {"brand": "Boss", "model_code": "1602", "frame_name": "Boss 1602"},
        "color": color, "eye_size": 52, "rim_type": "full",
        "cost_price": 1000.0, "selling_price": 4000.0, "mrp": 4500.0,
        "current_stock": stock, "reorder_level": reorder_level,
        "supplier_id": supplier_id, "is_active": True, **extra,
    }


@pytest.fixture
async def db():
    database = AsyncMongoMockClient()["test_inventory"]
    now = datetime.now(timezone.utc)
    await database["suppliers"].insert_many([
        {"id": "SUP000001", "supplier_name": "Acme Optics", "is_active": True, "created_at": now},
        {"id": "SUP000002", "supplier_name": "Lens World", "is_active": True, "created_at": now},
    ])
    await database["frame_masters"].insert_many([
        {"frame_master_id": "FM-000001", "brand": "Boss", "model_code": "1602", "frame_name": "Boss 1602",
         "is_active": True, "supplier_ids": [], "created_at": now},
        {"frame_master_id": "FM-000002", "brand": "Ray", "model_code": "RB1", "frame_name": "Ray RB1",
         "is_active": True, "supplier_ids": ["SUP000002"], "created_at": now},
    ])
    await database["frame_variants"].insert_many([
        _variant("FV-000001", "BOS-1602-BLK-52-F", "Black", stock=1),                 # low: 1 <= 2
        _variant("FV-000002", "BOS-1602-RED-52-F", "Red", stock=5),                   # fine
        _variant("FV-000003", "BOS-1602-BLU-52-F", "Blue", stock=0, reorder_level=3,  # inactive
                 is_active=False),
        _variant("FV-000004", "BOS-1602-GRN-52-F", "Green", stock=0, supplier_id=None),  # low, no supplier
        {**_variant("FV-000005", "RAY-RB1-BLK-50-F", "Black", stock=0, supplier_id=None, master_id="FM-000002"),
         "frame_master_ref": {"brand": "Ray", "model_code": "RB1", "frame_name": "Ray RB1"}},  # master supplier
    ])
    await database["products"].insert_many([
        {"product_id": "PRD000001", "name": "Lens Cleaner", "category": "accessories", "sku": "LC-1",
         "cost_price": 40, "selling_price": 100, "mrp": 100, "current_stock": 2, "min_stock_level": 10,
         "reorder_quantity": 25, "supplier": {"name": "acme optics"}, "is_active": True, "created_at": now},
        {"product_id": "PRD000002", "name": "Case", "category": "accessories", "sku": "CS-1",
         "cost_price": 20, "selling_price": 60, "mrp": 60, "current_stock": 0, "min_stock_level": 4,
         "supplier": {"name": "Whoever", "supplier_id": "SUP000002"}, "is_active": True, "created_at": now},
        {"product_id": "PRD000003", "name": "Solution", "category": "solutions", "sku": "SL-1",
         "cost_price": 300, "selling_price": 500, "mrp": 500, "current_stock": 50, "min_stock_level": 10,
         "is_active": True, "created_at": now},
        {"product_id": "PRD000004", "name": "Chain", "category": "accessories", "sku": "CH-1",
         "cost_price": 10, "selling_price": 30, "mrp": 30, "current_stock": 1, "min_stock_level": 5,
         "supplier": {"name": "Unknown Traders"}, "is_active": True, "created_at": now},
    ])
    return database


async def _stock(db, variant_id=None, product_id=None) -> int:
    if variant_id:
        return (await db["frame_variants"].find_one({"variant_id": variant_id}))["current_stock"]
    return (await db["products"].find_one({"product_id": product_id}))["current_stock"]


async def _movements(db, **query) -> list:
    return [m async for m in db["inventory_movements"].find(query)]


def _grn_line(variant_id, sku, expected, received, damaged=0):
    return {"variant_id": variant_id, "sku": sku, "expected_qty": expected, "received_qty": received,
            "damaged_qty": damaged, "cost_price": 1000.0}


async def _ordered_po(db, lines) -> str:
    """Create a PO for SUP000001 with ``lines`` = [(variant_id, qty)] and move it to Ordered."""
    service = PurchaseOrderService(db)
    po = await service.create_purchase_order(PurchaseOrderCreate(
        supplier_id="SUP000001", order_date=datetime.now(timezone.utc),
        items=[{"frame_variant_id": vid, "quantity": qty, "unit_cost": 1000.0} for vid, qty in lines],
    ), USER)
    await service.update_status(po.id, PurchaseOrderStatus.APPROVED.value, USER)
    await service.update_status(po.id, PurchaseOrderStatus.ORDERED.value, USER)
    return po.id


# ── Goods receipts ────────────────────────────────────────────────────────────

async def test_grn_is_pending_until_committed_and_commits_once(db):
    service = GoodsReceiptService(db)
    grn = await service.create_receipt(GoodsReceiptCreate(
        supplier_id="SUP000001", items=[_grn_line("FV-000002", "BOS-1602-RED-52-F", 5, 5, damaged=1)],
    ), created_by=USER)
    assert grn.status == "pending"
    assert await _stock(db, "FV-000002") == 5

    committed = await service.commit_receipt(grn.grn_number, committed_by=USER)
    assert committed.status == "complete"
    assert committed.committed_by == USER and committed.committed_at
    assert await _stock(db, "FV-000002") == 9  # 5 received − 1 damaged

    moves = await _movements(db, reference_type="GOODS_RECEIPT", reference_id=grn.grn_number)
    assert len(moves) == 1
    assert moves[0]["movement_type"] == "PURCHASE_IN"
    assert moves[0]["quantity"] == 4
    assert moves[0]["product_id"] == "FV-000002"
    assert moves[0]["created_by"] == USER

    with pytest.raises(BadRequestException):
        await service.commit_receipt(grn.grn_number, committed_by=USER)
    assert await _stock(db, "FV-000002") == 9
    assert len(await _movements(db, reference_type="GOODS_RECEIPT")) == 1


async def test_grn_linked_to_po_with_short_line_leaves_po_partially_received(db):
    po_id = await _ordered_po(db, [("FV-000001", 5), ("FV-000002", 3)])
    grns = GoodsReceiptService(db)

    prefill = await grns.prefill_from_po(po_id)
    assert [(i.variant_id, i.expected_qty) for i in prefill.items] == [("FV-000001", 5), ("FV-000002", 3)]

    grn = await grns.create_receipt(GoodsReceiptCreate(
        supplier_id="SUP000001", purchase_order_id=po_id,
        items=[_grn_line("FV-000001", "BOS-1602-BLK-52-F", 5, 5), _grn_line("FV-000002", "BOS-1602-RED-52-F", 3, 1)],
    ), created_by=USER)
    committed = await grns.commit_receipt(grn.grn_number, committed_by=USER)
    assert committed.status == "partial"

    po_service = PurchaseOrderService(db)
    po = await po_service.get_purchase_order(po_id)
    assert po.status == PurchaseOrderStatus.PARTIALLY_RECEIVED.value
    assert [(i.product_id, i.received_quantity) for i in po.items] == [("FV-000001", 5), ("FV-000002", 1)]
    assert await _stock(db, "FV-000001") == 6
    assert await _stock(db, "FV-000002") == 6
    assert {m["reference_type"] for m in await _movements(db, movement_type="PURCHASE_IN")} == {"GOODS_RECEIPT"}

    # The same delivery cannot be booked again on the PO itself
    with pytest.raises(BadRequestException):
        await po_service.receive_stock(po_id, ReceiveStockRequest(items=[
            {"product_id": "FV-000001", "ordered_quantity": 5, "received_quantity": 1},
        ]), USER)
    assert await _stock(db, "FV-000001") == 6

    # Prefill now only offers what is outstanding
    prefill = await grns.prefill_from_po(po_id)
    assert [(i.variant_id, i.expected_qty) for i in prefill.items] == [("FV-000002", 2)]

    # The rest arrives through the PO receive endpoint → fully received
    po = await po_service.receive_stock(po_id, ReceiveStockRequest(items=[
        {"product_id": "FV-000002", "ordered_quantity": 3, "received_quantity": 2},
    ]), USER)
    assert po.status == PurchaseOrderStatus.RECEIVED.value
    assert await _stock(db, "FV-000002") == 8
    po_moves = await _movements(db, reference_type="PURCHASE_ORDER", reference_id=po_id)
    assert [(m["product_id"], m["quantity"]) for m in po_moves] == [("FV-000002", 2)]

    # A fully received PO takes no further GRNs
    with pytest.raises(BadRequestException):
        await grns.create_receipt(GoodsReceiptCreate(
            supplier_id="SUP000001", purchase_order_id=po_id,
            items=[_grn_line("FV-000002", "BOS-1602-RED-52-F", 1, 1)],
        ), created_by=USER)


async def test_grn_over_po_outstanding_is_refused_and_stays_pending(db):
    po_id = await _ordered_po(db, [("FV-000001", 2)])
    grns = GoodsReceiptService(db)
    with pytest.raises(BadRequestException):
        await grns.create_receipt(GoodsReceiptCreate(
            supplier_id="SUP000001", purchase_order_id=po_id,
            items=[_grn_line("FV-000001", "BOS-1602-BLK-52-F", 2, 3)],
        ), created_by=USER)

    grn = await grns.create_receipt(GoodsReceiptCreate(
        supplier_id="SUP000001", purchase_order_id=po_id,
        items=[_grn_line("FV-000001", "BOS-1602-BLK-52-F", 2, 2)],
    ), created_by=USER)
    # Meanwhile the PO gets received directly
    await PurchaseOrderService(db).receive_stock(po_id, ReceiveStockRequest(items=[
        {"product_id": "FV-000001", "ordered_quantity": 2, "received_quantity": 2},
    ]), USER)
    with pytest.raises(BadRequestException):
        await grns.commit_receipt(grn.grn_number, committed_by=USER)
    assert (await grns.get_receipt(grn.grn_number)).status == "pending"
    assert await _stock(db, "FV-000001") == 3  # only the direct receipt


async def test_po_status_endpoint_cannot_mark_received(db):
    po_id = await _ordered_po(db, [("FV-000001", 2)])
    service = PurchaseOrderService(db)
    for status in (PurchaseOrderStatus.RECEIVED.value, PurchaseOrderStatus.PARTIALLY_RECEIVED.value):
        with pytest.raises(BadRequestException):
            await service.update_status(po_id, status, USER)
    assert (await service.get_purchase_order(po_id)).status == PurchaseOrderStatus.ORDERED.value


async def test_po_receive_all_zero_is_refused(db):
    po_id = await _ordered_po(db, [("FV-000001", 2)])
    with pytest.raises(BadRequestException):
        await PurchaseOrderService(db).receive_stock(po_id, ReceiveStockRequest(items=[
            {"product_id": "FV-000001", "ordered_quantity": 2, "received_quantity": 0},
        ]), USER)


# ── Quick intake / opening stock / adjustments ────────────────────────────────

async def test_quick_intake_commit_writes_movements(db):
    service = QuickIntakeService(db)
    qi = await service.create_intake(QuickIntakeCreate(items=[
        {"variant_id": "FV-000001", "sku": "BOS-1602-BLK-52-F", "qty": 2, "cost_price": 1000},
        {"product_id": "PRD000001", "sku": "LC-1", "qty": 3, "cost_price": 40},
    ]), created_by=USER)
    committed = await service.commit_intake(qi.intake_id, committed_by=USER)
    assert committed.status == "committed"
    assert await _stock(db, "FV-000001") == 3
    assert await _stock(db, product_id="PRD000001") == 5

    moves = await _movements(db, reference_type="QUICK_INTAKE", reference_id=qi.intake_id)
    assert sorted((m["product_id"], m["quantity"], m["movement_type"], m["created_by"]) for m in moves) == [
        ("FV-000001", 2, "PURCHASE_IN", USER),
        ("PRD000001", 3, "PURCHASE_IN", USER),
    ]
    with pytest.raises(BadRequestException):
        await service.commit_intake(qi.intake_id, committed_by=USER)
    assert await _stock(db, "FV-000001") == 3


async def test_opening_stock_writes_movement(db):
    variant = await FrameVariantService(db).create_variant_safe(FrameVariantCreate(
        frame_master_id="FM-000001", color="White", eye_size=54, cost_price=900, selling_price=3500, current_stock=4,
    ), created_by=USER)
    product = await ProductService(db).create_product(ProductCreate(
        name="Spray", category="accessories", sku="SP-1", cost_price=10, selling_price=25, mrp=25, current_stock=7,
    ), created_by=USER)
    no_stock = await ProductService(db).create_product(ProductCreate(
        name="Cloth", category="accessories", sku="CL-1", cost_price=5, selling_price=10, mrp=10,
    ), created_by=USER)

    moves = await _movements(db, reference_type="STOCK_ADJUSTMENT")
    assert sorted((m["product_id"], m["quantity"], m["movement_type"], m["reason"], m["created_by"]) for m in moves) == sorted([
        (variant.variant_id, 4, "ADJUSTMENT", "Opening stock", USER),
        (product.product_id, 7, "ADJUSTMENT", "Opening stock", USER),
    ])
    assert not await _movements(db, product_id=no_stock.product_id)


async def test_adjustments_store_reason_and_user(db):
    await FrameVariantService(db).adjust_stock(
        "FV-000002", StockAdjustVariant(new_stock=3, reason="Damaged", notes="Dropped two"), adjusted_by=USER,
    )
    await ProductService(db).adjust_stock(
        "PRD000003", StockAdjustment(quantity=-5, reason="Stock count"), adjusted_by=USER,
    )
    assert await _stock(db, "FV-000002") == 3
    assert await _stock(db, product_id="PRD000003") == 45

    variant_move = (await _movements(db, product_id="FV-000002"))[0]
    assert (variant_move["quantity"], variant_move["reason"], variant_move["notes"], variant_move["created_by"]) == (
        -2, "Damaged", "Dropped two", USER,
    )
    product_move = (await _movements(db, product_id="PRD000003"))[0]
    assert (product_move["quantity"], product_move["reason"], product_move["created_by"]) == (-5, "Stock count", USER)


async def test_movement_list_filters_by_type_and_names_items(db):
    await FrameVariantService(db).adjust_stock("FV-000002", StockAdjustVariant(new_stock=4, reason="Count"), USER)
    await ProductService(db).adjust_stock("PRD000003", StockAdjustment(quantity=1, reason="Found"), USER)
    qi = await QuickIntakeService(db).create_intake(QuickIntakeCreate(items=[
        {"product_id": "PRD000001", "sku": "LC-1", "qty": 1, "cost_price": 40},
    ]), created_by=USER)
    await QuickIntakeService(db).commit_intake(qi.intake_id, committed_by=USER)

    service = InventoryMovementService(db)
    page = await service.list_movements(1, 50, movement_type="ADJUSTMENT")
    assert page.total == 2
    by_id = {m.product_id: m for m in page.data}
    assert by_id["FV-000002"].item_kind == "frame"
    assert by_id["FV-000002"].sku == "BOS-1602-RED-52-F"
    assert by_id["FV-000002"].item_name == "Boss 1602 / Red / 52"
    assert by_id["PRD000003"].item_name == "Solution" and by_id["PRD000003"].sku == "SL-1"
    assert by_id["PRD000003"].reason == "Found"

    purchases = await service.list_movements(1, 50, movement_type="PURCHASE_IN")
    assert [(m.product_id, m.item_name) for m in purchases.data] == [("PRD000001", "Lens Cleaner")]


# ── Low stock / reorder / labels / search ─────────────────────────────────────

async def test_low_stock_lists_both_kinds_with_suggested_qty(db):
    rows = await InventoryService(db).list_low_stock()
    by_id = {r.id: r for r in rows}
    assert set(by_id) == {"FV-000001", "FV-000004", "FV-000005", "PRD000001", "PRD000002", "PRD000004"}

    v = by_id["FV-000001"]
    assert (v.kind, v.name, v.detail, v.sku) == ("frame", "Boss 1602", "Black · 52", "BOS-1602-BLK-52-F")
    assert (v.current_stock, v.reorder_level, v.suggested_qty, v.out_of_stock) == (1, 2, 3, False)
    assert (v.supplier_id, v.supplier_name, v.unit_cost) == ("SUP000001", "Acme Optics", 1000.0)
    assert by_id["FV-000005"].supplier_id == "SUP000002"  # falls back to the frame model's supplier
    assert by_id["FV-000004"].supplier_id is None

    p1, p2 = by_id["PRD000001"], by_id["PRD000002"]
    assert (p1.kind, p1.detail, p1.reorder_level, p1.suggested_qty) == ("product", "accessories", 10, 25)
    assert (p1.supplier_id, p1.supplier_name) == ("SUP000001", "Acme Optics")  # matched by name
    assert (p2.suggested_qty, p2.out_of_stock, p2.supplier_id) == (8, True, "SUP000002")  # 4*2 − 0
    assert (by_id["PRD000004"].supplier_id, by_id["PRD000004"].supplier_name) == (None, "Unknown Traders")

    # Out-of-stock rows come first
    assert all(r.out_of_stock for r in rows[:3]) and not any(r.out_of_stock for r in rows[3:])

    frames = await InventoryService(db).list_low_stock(kind="frame")
    assert {r.kind for r in frames} == {"frame"} and len(frames) == 3
    empty = await InventoryService(db).list_low_stock(out_of_stock_only=True)
    assert {r.id for r in empty} == {"FV-000004", "FV-000005", "PRD000002"}


async def test_reorder_creates_one_draft_po_per_supplier_and_skips_supplierless(db):
    result = await InventoryService(db).reorder(ReorderRequest(items=[
        {"kind": "frame", "id": "FV-000001", "quantity": 4},
        {"kind": "product", "id": "PRD000001"},              # SUP000001 by name, suggested 25
        {"kind": "product", "id": "PRD000002", "quantity": 6},  # SUP000002
        {"kind": "frame", "id": "FV-000004", "quantity": 1},  # no supplier
        {"kind": "product", "id": "PRD000004", "quantity": 1},  # supplier name not in list
        {"kind": "frame", "id": "FV-404", "quantity": 1},
    ]), USER)

    by_supplier = {po.supplier_id: po for po in result.purchase_orders}
    assert set(by_supplier) == {"SUP000001", "SUP000002"}
    acme = by_supplier["SUP000001"]
    assert (acme.status, acme.line_count, acme.total_quantity, acme.supplier_name) == ("Draft", 2, 29, "Acme Optics")
    assert (by_supplier["SUP000002"].line_count, by_supplier["SUP000002"].total_quantity) == (1, 6)

    stored = await PurchaseOrderService(db).get_purchase_order(acme.order_id)
    assert stored.status == "Draft"
    assert sorted((i.product_id, i.quantity, i.unit_cost) for i in stored.items) == [
        ("FV-000001", 4, 1000.0), ("PRD000001", 25, 40.0),
    ]
    assert {(s.id, s.reason) for s in result.skipped} == {
        ("FV-000004", "No supplier set for this item"),
        ("PRD000004", "Supplier 'Unknown Traders' is not in the suppliers list"),
        ("FV-404", "Frame variant not found"),
    }


async def test_labels_pdf_for_frames_and_products(db):
    pdf = await InventoryService(db).build_labels_pdf(LabelPrintRequest(items=[
        {"kind": "frame", "id": "FV-000001", "copies": 3},
        {"kind": "product", "id": "PRD000001", "copies": 2},
    ], label_type="sticker"))
    assert pdf.startswith(b"%PDF")


async def test_frame_master_search_matches_variant_sku(db):
    page = await FrameMasterService(db).list_masters(1, 20, search="RAY-RB1-BLK")
    assert [m.frame_master_id for m in page.data] == ["FM-000002"]
    page = await FrameMasterService(db).list_masters(1, 20, search="boss")
    assert [m.frame_master_id for m in page.data] == ["FM-000001"]
