"""
Seed script: Create suppliers, frame masters/variants, and POs from PDF stock ledger.

Run from backend/:
    python -m scripts.seed_stock_pdf

What it does:
1. Creates suppliers: Nilan (N), SI Optics (SI), Neat Optics (Neat) — skips if already exists
2. Groups PDF rows into unique SKUs (brand+model_code+color+eye_size+rim_type)
3. Creates FrameMasters and FrameVariants with full stock counts
4. Creates one PO per supplier (status=Received) listing all frames from that supplier
   — stock is set directly on the variants (no SO, no inventory movement journal needed
     since this is legacy opening stock)

Cost price = round(selling_price / 6, 2)
"""

import asyncio, os
from collections import Counter, defaultdict
from datetime import datetime, timezone
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME   = os.getenv("MONGODB_DB_NAME", "eyecare_erp")

# ─── PDF data ──────────────────────────────────────────────────────────────────
# (supplier_code, institute_stock_no, brand, model_code, temple, color, rim, eye_size, selling_price, sold_location)
ROWS = [
    ("N",    1247, "2 Star",         "2236",  138, "Brown",   "full", 51, 4000,  "institute"),
    ("N",    1248, "2 Star",         "2236",  138, "Brown",   "full", 51, 4000,  None),
    ("N",    1249, "2 Star",         "2236",  138, "Brown",   "full", 51, 4000,  "clinic"),
    ("N",    1250, "2 Star",         "2236",  138, "Brown",   "full", 51, 4000,  "clinic"),
    ("N",    1251, "2 Star",         "2236",  138, "Brown",   "full", 51, 4000,  None),
    ("N",    1252, "2 Star",         "2236",  138, "Brown",   "full", 51, 4000,  "institute"),
    ("SI",   1253, "Dior",           "9525",  142, "Black",   "full", 52, 10000, None),
    ("SI",   1254, "Dior",           "9525",  142, "Merun",   "full", 52, 10000, "institute"),
    ("SI",   1255, "Ray Ban",        "9880",  143, "Black",   "full", 52, 10000, None),
    ("SI",   1256, "Police",         "28354", 140, "Black",   "full", 50, 6500,  "institute"),
    ("SI",   1257, "Ray Ban",        "9731",  138, "Black",   "full", 52, 8500,  None),
    ("SI",   1258, "Gucci",          "9987",  142, "Blue",    "full", 48, 10000, None),
    ("SI",   1259, "Cartier",        "9732",  139, "Black",   "full", 53, 10000, None),
    ("SI",   1260, "Police",         "28354", 140, "Black",   "full", 50, 6500,  "institute"),
    ("SI",   1261, "Porsche Design", "9721",  142, "Brown",   "full", 52, 15000, None),
    ("SI",   1262, "Dior",           "9525",  142, "Brown",   "full", 52, 10000, None),
    ("SI",   1263, "Prada",          "9913",  144, "Blue",    "full", 54, 10000, None),
    ("SI",   1264, "Gucci",          "8388",  145, "Black",   "full", 53, 7500,  None),
    ("SI",   1265, "Gucci",          "8333",  142, "Blue",    "full", 52, 7500,  "institute"),
    ("SI",   1266, "Ray Ban",        "81020", 145, "Silver",  "full", 50, 8500,  None),
    ("SI",   1267, "Gucci",          "8401",  146, "Black",   "full", 51, 7500,  None),
    ("SI",   1268, "Ray Ban",        "35060", 141, "Silver",  "full", 51, 8500,  None),
    ("SI",   1269, "Lico",           "C9009", 136, "Black",   "full", 46, 6500,  None),
    ("SI",   1270, "Gucci",          "8431",  146, "Black",   "full", 52, 7500,  None),
    ("SI",   1271, "Boss",           "80001", 138, "Blue",    "full", 49, 7500,  "institute"),
    ("SI",   1272, "Police",         "28333", 145, "Merun",   "full", 49, 6500,  None),
    ("SI",   1273, "Prada",          "T5018", 140, "Black",   "full", 53, 8500,  None),
    ("SI",   1274, "Gucci",          "5377",  129, "Blue",    "full", 47, 7500,  None),
    ("SI",   1275, "Prada",          "9913",  144, "Black",   "full", 54, 10000, None),
    ("SI",   1276, "Boss",           "1806",  138, "Black",   "full", 52, 12000, None),
    ("SI",   1277, "Gucci",          "9987",  142, "Brown",   "full", 48, 10000, None),
    ("SI",   1278, "Police",         "28301", 140, "Ash",     "full", 51, 6500,  "institute"),
    ("SI",   1279, "Charmant",       "8807",  142, "Brown",   "full", 53, 6000,  None),
    ("SI",   1280, "Charmant",       "2813",  145, "Black",   "full", 51, 6000,  None),
    ("SI",   1281, "Cartier",        "9322",  142, "Blue",    "full", 53, 10000, None),
    ("SI",   1282, "Charmant",       "68162", 132, "Black",   "full", 48, 6000,  None),
    ("SI",   1283, "Boss",           "6131",  138, "Brown",   "half", 52, 6500,  None),
    ("SI",   1284, "Nike",           "8253",  136, "Black",   "half", 49, 6500,  "institute"),
    ("SI",   1285, "Charmant",       "68162", 132, "Purple",  "full", 48, 6000,  None),
    ("SI",   1286, "Charmant",       "2813",  145, "Pink",    "full", 51, 6000,  "institute"),
    ("SI",   1287, "Charmant",       "2806",  142, "Ash",     "full", 52, 6000,  None),
    ("SI",   1288, "Dior",           "9525",  142, "Dior",    "full", 52, 10000, None),
    ("SI",   1289, "Mont Blanc",     "91128", 145, "Brown",   "full", 54, 10000, None),
    ("SI",   1290, "Puroq",          "9762",  142, "Black",   "full", 51, 10000, None),
    ("SI",   1291, "Cartier",        "8180",  136, "Gun",     "full", 50, 6500,  "institute"),
    ("SI",   1292, "Emporio Armani", "8237",  136, "Merun",   "full", 49, 6500,  "institute"),
    ("SI",   1293, "Gucci",          "8230",  136, "Brown",   "half", 48, 6500,  None),
    ("SI",   1294, "Nike",           "8223",  136, "Merun",   "half", 50, 6500,  None),
    ("SI",   1295, "Okey",           "8233",  136, "Gun",     "full", 50, 6500,  "institute"),
    ("SI",   1296, "Charmant",       "2826",  145, "Black",   "full", 50, 6000,  None),
    ("SI",   1297, "Police",         "1530",  145, "Blue",    "full", 53, 15000, None),
    ("SI",   1298, "Charmant",       "68170", 143, "Brown",   "full", 52, 6000,  None),
    ("SI",   1299, "Boss",           "6131",  138, "Gun",     "half", 52, 6500,  "institute"),
    ("SI",   1300, "Nike",           "8253",  136, "Merun",   "half", 49, 6500,  "institute"),
    ("SI",   1301, "Cartier",        "8180",  136, "Gun",     "full", 50, 6500,  "institute"),
    ("SI",   1302, "Gucci",          "8230",  136, "Gun",     "half", 48, 6500,  "institute"),
    ("SI",   1303, "Boss",           "8226",  136, "Black",   "half", 49, 6500,  None),
    ("SI",   1304, "Gucci",          "8230",  136, "Brown",   "half", 48, 6500,  "institute"),
    ("SI",   1305, "Police",         "8634",  140, "Blue",    "full", 49, 15000, None),
    ("Neat", 1306, "No-1 Sport",     "90397", 138, "Purple",  "full", 52, 8500,  "clinic"),
    ("Neat", 1307, "No-1 Sport",     "90405", 135, "Black",   "full", 50, 8500,  "clinic"),
    ("Neat", 1308, "Porsche Design", "8188",  138, "Black",   "full", 52, 6500,  "clinic"),
    ("Neat", 1309, "No-1 Sport",     "90405", 135, "Black",   "full", 50, 8500,  "institute"),
    ("Neat", 1310, "No-1 Sport",     "9485",  145, "Black",   "full", 53, 8500,  None),
    ("Neat", 1311, "No-1 Sport",     "9677",  140, "Black",   "full", 53, 8500,  None),
    ("Neat", 1312, "No-1 Sport",     "9677",  140, "Black",   "full", 53, 8500,  None),
    ("Neat", 1313, "No-1 Sport",     "9677",  140, "Black",   "full", 53, 8500,  None),
    ("Neat", 1314, "No-1 Sport",     "90397", 138, "Purple",  "full", 52, 8500,  None),
    ("Neat", 1315, "No-1 Sport",     "90397", 138, "Purple",  "full", 52, 8500,  None),
    ("Neat", 1316, "No-1 Sport",     "90405", 135, "Blue",    "full", 50, 8500,  None),
    ("Neat", 1317, "No-1 Sport",     "90405", 135, "Blue",    "full", 50, 8500,  None),
    ("Neat", 1318, "No-1 Sport",     "90405", 135, "Maroon",  "full", 50, 8500,  None),
    ("Neat", 1319, "No-1 Sport",     "90405", 135, "Maroon",  "full", 50, 8500,  None),
    ("Neat", 1320, "No-1 Sport",     "90405", 135, "Brown",   "full", 50, 8500,  None),
    ("Neat", 1321, "No-1 Sport",     "90405", 135, "Brown",   "full", 50, 8500,  None),
    ("Neat", 1322, "No-1 Sport",     "90397", 135, "Brown",   "full", 52, 8500,  None),
    ("Neat", 1323, "No-1 Sport",     "90397", 135, "Brown",   "full", 52, 8500,  None),
]

SUPPLIER_DEFS = {
    "N":    {"supplier_name": "Nilan",      "company_name": "Nilan Opticals"},
    "SI":   {"supplier_name": "SI Optics",  "company_name": "SI Optics"},
    "Neat": {"supplier_name": "Neat Optics","company_name": "Neat Optics"},
}


def _sku(brand, model_code, color, eye_size, rim_type):
    b = brand.upper()[:3].replace(" ", "").replace("-", "")
    m = model_code.upper()[:6]
    c = color.upper()[:3]
    e = str(eye_size)
    r = "F" if rim_type.lower() == "full" else "H"
    return f"{b}-{m}-{c}-{e}-{r}"


def _pad(prefix, n, w=6):
    return f"{prefix}{str(n).zfill(w)}"


async def run():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    now = datetime.now(timezone.utc)
    SYSTEM = "system-import"

    # ── 1. Determine next sequence numbers ────────────────────────────────────
    existing_fms = await db["frame_masters"].find({}, {"frame_master_id": 1}).to_list(1000)
    existing_fvs = await db["frame_variants"].find({}, {"variant_id": 1}).to_list(1000)
    existing_sups = await db["suppliers"].find({}, {"id": 1}).to_list(1000)
    existing_pos  = await db["purchase_orders"].find({}, {"id": 1}).to_list(1000)

    def _max_seq(docs, field, prefix):
        nums = []
        for d in docs:
            val = d.get(field, "")
            if val and val.startswith(prefix):
                try:
                    nums.append(int(val[len(prefix):]))
                except ValueError:
                    pass
        return max(nums, default=0)

    next_fm  = _max_seq(existing_fms, "frame_master_id", "FM-") + 1
    next_fv  = _max_seq(existing_fvs, "variant_id", "FV-") + 1
    next_sup = _max_seq(existing_sups, "id", "SUP") + 1
    next_po  = _max_seq(existing_pos,  "id", "PO") + 1

    print(f"Starting sequences: FM={next_fm}, FV={next_fv}, SUP={next_sup}, PO={next_po}\n")

    # ── 2. Create suppliers ───────────────────────────────────────────────────
    sup_id_map: dict[str, str] = {}
    for code, sdef in SUPPLIER_DEFS.items():
        existing = await db["suppliers"].find_one(
            {"supplier_name": {"$regex": f"^{sdef['supplier_name']}$", "$options": "i"}}
        )
        if existing:
            sup_id_map[code] = existing["id"]
            print(f"  Supplier exists: {sdef['supplier_name']} -> {existing['id']}")
        else:
            sid = _pad("SUP", next_sup, 6)
            next_sup += 1
            await db["suppliers"].insert_one({
                "id": sid,
                "supplier_name": sdef["supplier_name"],
                "company_name": sdef["company_name"],
                "contact_person": None,
                "phone": None,
                "email": None,
                "address": None,
                "payment_terms": None,
                "notes": "",
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            })
            sup_id_map[code] = sid
            print(f"  Created supplier: {sdef['supplier_name']} -> {sid}")

    # ── 3. Group rows into unique variants ────────────────────────────────────
    # key: (sup_code, brand, model_code, color_lower, eye_size, rim_type, temple)
    variant_map: dict[tuple, dict] = {}
    for row in ROWS:
        sup_code, stock_no, brand, model_code, temple, color, rim, eye_size, selling_price, sold_loc = row
        key = (sup_code, brand.lower(), model_code.lower(), color.lower(), eye_size, rim, temple)
        if key not in variant_map:
            variant_map[key] = {
                "sup_code": sup_code, "brand": brand, "model_code": model_code,
                "color": color, "eye_size": eye_size, "rim_type": rim,
                "temple_length": temple, "selling_price": selling_price or 0,
                "stock_nos": [], "sold_locs": [],
            }
        variant_map[key]["stock_nos"].append(stock_no)
        if sold_loc:
            variant_map[key]["sold_locs"].append(sold_loc)
        if variant_map[key]["selling_price"] == 0 and selling_price:
            variant_map[key]["selling_price"] = selling_price

    print(f"\nGrouped {len(ROWS)} rows -> {len(variant_map)} unique variants\n")

    # ── 4. Create frame masters + variants ────────────────────────────────────
    # (brand, model_code) -> frame_master_id
    master_cache: dict[tuple, str] = {}
    # pre-load existing masters
    for fm in existing_fms:
        mk = (fm.get("brand","").lower(), fm.get("model_code","").lower())
        master_cache[mk] = fm["frame_master_id"]

    # variant_id lookup: sku -> variant_id (for PO item references)
    sku_to_variant_id: dict[str, str] = {}
    # pre-load existing variants
    for fv in existing_fvs:
        sku_to_variant_id[fv.get("sku", "")] = fv.get("variant_id", "")

    # Group variants by supplier for PO creation
    # sup_code -> list of variant docs
    supplier_variants: dict[str, list] = defaultdict(list)

    masters_created = variants_created = variants_updated = 0

    for key, vd in variant_map.items():
        brand       = vd["brand"]
        model_code  = vd["model_code"]
        color       = vd["color"]
        eye_size    = vd["eye_size"]
        rim_type    = vd["rim_type"]
        temple      = vd["temple_length"]
        selling     = vd["selling_price"]
        cost        = round(selling / 6, 2)
        stock_nos   = vd["stock_nos"]
        sold_locs   = vd["sold_locs"]
        sold_count  = len(sold_locs)
        total_units = len(stock_nos)
        in_stock    = max(0, total_units - sold_count)
        sale_loc    = Counter(sold_locs).most_common(1)[0][0] if sold_locs else None
        sup_code    = vd["sup_code"]
        sup_id      = sup_id_map[sup_code]
        sku         = _sku(brand, model_code, color, eye_size, rim_type)

        # ── Frame master ──────────────────────────────────────────────────────
        mk = (brand.lower(), model_code.lower())
        if mk not in master_cache:
            fm_id = _pad("FM-", next_fm)
            next_fm += 1
            await db["frame_masters"].insert_one({
                "frame_master_id": fm_id,
                "brand": brand,
                "model_code": model_code,
                "frame_name": f"{brand} {model_code}",
                "category": "optical",
                "rim_type": rim_type,
                "supplier_ids": [sup_id],
                "images": [], "tags": [],
                "is_active": True,
                "created_at": now, "updated_at": now,
            })
            master_cache[mk] = fm_id
            masters_created += 1
            print(f"  [FM] Created {fm_id}: {brand} {model_code}")
        fm_id = master_cache[mk]

        # ── Frame variant ─────────────────────────────────────────────────────
        existing_fv = await db["frame_variants"].find_one({"sku": sku})
        if existing_fv:
            existing_nos = existing_fv.get("institute_stock_nos") or []
            merged_nos   = sorted(set(existing_nos + stock_nos))
            update: dict = {
                "institute_stock_nos": merged_nos,
                "current_stock": in_stock,
                "updated_at": now,
            }
            if sale_loc:
                update["sale_location"] = sale_loc
            await db["frame_variants"].update_one({"sku": sku}, {"$set": update})
            fv_id = existing_fv["variant_id"]
            variants_updated += 1
            print(f"  [FV] Updated {fv_id} ({sku}): stock={in_stock}")
        else:
            fv_id = _pad("FV-", next_fv)
            next_fv += 1
            await db["frame_variants"].insert_one({
                "variant_id": fv_id, "sku": sku, "barcode": sku,
                "frame_master_id": fm_id,
                "frame_master_ref": {
                    "brand": brand, "model_code": model_code,
                    "frame_name": f"{brand} {model_code}",
                    "category": "optical", "shape": None,
                },
                "color": color, "color_code": None,
                "eye_size": eye_size, "bridge_size": None,
                "temple_length": temple, "rim_type": rim_type,
                "cost_price": cost, "selling_price": selling, "mrp": 0.0,
                "current_stock": in_stock, "reorder_level": 1,
                "supplier_id": sup_id,
                "supplier_frame_no": model_code,
                "institute_stock_nos": stock_nos,
                "sale_location": sale_loc,
                "is_active": True,
                "created_at": now, "updated_at": now,
            })
            variants_created += 1
            print(f"  [FV] Created {fv_id} ({sku}): stock={in_stock}, nos={stock_nos}")

        sku_to_variant_id[sku] = fv_id
        supplier_variants[sup_code].append({
            "sku": sku, "fv_id": fv_id, "brand": brand, "model_code": model_code,
            "color": color, "eye_size": eye_size, "rim_type": rim_type,
            "cost": cost, "selling": selling, "qty": total_units,
        })

    print(f"\nMasters created: {masters_created} | Variants created: {variants_created} | Updated: {variants_updated}\n")

    # ── 5. Create one PO per supplier ─────────────────────────────────────────
    for sup_code, variants in supplier_variants.items():
        sup_id   = sup_id_map[sup_code]
        sup_name = SUPPLIER_DEFS[sup_code]["supplier_name"]
        po_id    = _pad("PO", next_po, 6)
        next_po += 1

        items = []
        total = 0.0
        for idx, v in enumerate(variants, start=1):
            line_total = round(v["cost"] * v["qty"], 2)
            total += line_total
            items.append({
                "id": f"{po_id}-{idx:03d}",
                "purchase_order_id": po_id,
                "product_id": v["fv_id"],
                "frame_variant_id": v["fv_id"],
                "quantity": v["qty"],
                "unit_cost": v["cost"],
                "line_discount_type": None,
                "line_discount_value": 0.0,
                "line_discount_amount": 0.0,
                "total_price": line_total,
            })
        total = round(total, 2)

        await db["purchase_orders"].insert_one({
            "id": po_id,
            "supplier_id": sup_id,
            "order_date": now,
            "expected_delivery_date": now,
            "status": "Received",
            "total_amount": total,
            "created_by": SYSTEM,
            "is_locked": True,
            "items": items,
            "buyer_information": None,
            "supplier_information": {
                "supplier_id": sup_id,
                "supplier_name": sup_name,
                "company_name": SUPPLIER_DEFS[sup_code]["company_name"],
                "contact_person": None,
                "phone": None,
                "email": None,
                "address": None,
            },
            "shipping_information": None,
            "order_summary": {
                "subtotal": total,
                "line_discount_total": 0.0,
                "tax_rate": 0.0,
                "tax_amount": 0.0,
                "shipping_cost": 0.0,
                "discount": 0.0,
                "total_amount": total,
            },
            "payment_terms": None,
            "notes": {"internal_notes": "Opening stock import from PDF ledger (frames 1247-1323)"},
            "authorization": None,
            "footer": None,
            "receipt_summary": None,
            "status_history": [
                {"status": "Draft",    "updated_at": now, "updated_by": SYSTEM},
                {"status": "Received", "updated_at": now, "updated_by": SYSTEM},
            ],
            "created_at": now,
            "updated_at": now,
        })
        print(f"  [PO] Created {po_id} for {sup_name}: {len(items)} line(s), total={total:,.2f}")

    print("\n✓ Seed complete.")
    client.close()


if __name__ == "__main__":
    asyncio.run(run())
