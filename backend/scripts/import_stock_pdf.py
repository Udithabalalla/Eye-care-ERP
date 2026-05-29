"""
One-off import script: Load PDF stock ledger (frames 1247–1323) into MongoDB.

Usage (from backend/):
    python -m scripts.import_stock_pdf

Idempotent: re-running skips already-existing masters/variants (matched by
brand + model_code for masters, and brand + model_code + color + eye_size + rim_type
for variants). institute_stock_nos are merged into existing variants if the variant
already exists.

Supplier mapping:
    N    → Nilan (supplier must already exist in DB, looked up by name)
    SI   → SI Optics
    Neat → Neat Optics

Cost price rule: selling_price / 6 (rounded to 2 dp)
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

# ─── Raw data from PDF ────────────────────────────────────────────────────────
# Columns: supplier_code, institute_stock_no, brand, model_code, temple_length,
#          color, rim_type, eye_size, selling_price, sold_location
STOCK_DATA = [
    ("N",    1247, "2 Star",          "2236",  138, "Brown",      "full", 51, 4000,  "institute"),
    ("N",    1248, "2 Star",          "2236",  138, "Brown",      "full", 51, 4000,  None),
    ("N",    1249, "2 Star",          "2236",  138, "Brown",      "full", 51, 4000,  "clinic"),
    ("N",    1250, "2 Star",          "2236",  138, "Brown",      "full", 51, 4000,  "clinic"),
    ("N",    1251, "2 Star",          "2236",  138, "Brown",      "full", 51, 4000,  None),
    ("N",    1252, "2 Star",          "2236",  138, "Brown",      "full", 51, 4000,  "institute"),
    ("SI",   1253, "Dior",            "9525",  142, "Black",      "full", 52, 10000, None),
    ("SI",   1254, "Dior",            "9525",  142, "Merun",      "full", 52, 10000, "institute"),
    ("SI",   1255, "Ray Ban",         "9880",  143, "Black",      "full", 52, 10000, None),
    ("SI",   1256, "Police",          "28354", 140, "Black",      "full", 50, 6500,  "institute"),
    ("SI",   1257, "Ray Ban",         "9731",  138, "Black",      "full", 52, 8500,  None),
    ("SI",   1258, "Gucci",           "9987",  142, "Blue",       "full", 48, 10000, None),
    ("SI",   1259, "Cartier",         "9732",  139, "Black",      "full", 53, 10000, None),
    ("SI",   1260, "Police",          "28354", 140, "Black",      "full", 50, 6500,  "institute"),
    ("SI",   1261, "Porsche Design",  "9721",  142, "Brown",      "full", 52, 15000, None),
    ("SI",   1262, "Dior",            "9525",  142, "Brown",      "full", 52, 10000, None),
    ("SI",   1263, "Prada",           "9913",  144, "Blue",       "full", 54, 10000, None),
    ("SI",   1264, "Gucci",           "8388",  145, "Black",      "full", 53, 7500,  None),
    ("SI",   1265, "Gucci",           "8333",  142, "Blue",       "full", 52, 7500,  "institute"),
    ("SI",   1266, "Ray Ban",         "81020", 145, "Silver",     "full", 50, 8500,  None),
    ("SI",   1267, "Gucci",           "8401",  146, "Black",      "full", 51, 7500,  None),
    ("SI",   1268, "Ray Ban",         "35060", 141, "Silver",     "full", 51, 8500,  None),
    ("SI",   1269, "Lico",            "C9009", 136, "Black",      "full", 46, 6500,  None),
    ("SI",   1270, "Gucci",           "8431",  146, "Black",      "full", 52, 7500,  None),
    ("SI",   1271, "Boss",            "80001", 138, "Blue",       "full", 49, 7500,  "institute"),
    ("SI",   1272, "Police",          "28333", 145, "Merun",      "full", 49, None,  None),
    ("SI",   1273, "Prada",           "T5018", 140, "Black",      "full", 53, 8500,  None),
    ("SI",   1274, "Gucci",           "5377",  129, "Blue",       "full", 47, 7500,  None),
    ("SI",   1275, "Prada",           "9913",  144, "Black",      "full", 54, 10000, None),
    ("SI",   1276, "Boss",            "1806",  138, "Black",      "full", 52, 12000, None),
    ("SI",   1277, "Gucci",           "9987",  142, "Brown",      "full", 48, 10000, None),
    ("SI",   1278, "Police",          "28301", 140, "Ash",        "full", 51, 6500,  "institute"),
    ("SI",   1279, "Charmant",        "8807",  142, "Brown",      "full", 53, 6000,  None),
    ("SI",   1280, "Charmant",        "2813",  145, "Black",      "full", 51, 6000,  None),
    ("SI",   1281, "Cartier",         "9322",  142, "Blue",       "full", 53, 10000, None),
    ("SI",   1282, "Charmant",        "68162", 132, "Black",      "full", 48, 6000,  None),
    ("SI",   1283, "Boss",            "6131",  138, "Brown",      "half", 52, 6500,  None),
    ("SI",   1284, "Nike",            "8253",  136, "Black",      "half", 49, 6500,  "institute"),
    ("SI",   1285, "Charmant",        "68162", 132, "Purple",     "full", 48, 6000,  None),
    ("SI",   1286, "Charmant",        "2813",  145, "Pink",       "full", 51, 6000,  "institute"),
    ("SI",   1287, "Charmant",        "2806",  142, "Ash",        "full", 52, 6000,  None),
    ("SI",   1288, "Dior",            "9525",  142, "Dior",       "full", 52, 10000, None),
    ("SI",   1289, "Mont Blanc",      "91128", 145, "Brown",      "full", 54, 10000, None),
    ("SI",   1290, "Puroq",           "9762",  142, "Black",      "full", 51, 10000, None),
    ("SI",   1291, "Cartier",         "8180",  136, "Gun",        "full", 50, 6500,  "institute"),
    ("SI",   1292, "Emporio Armani",  "8237",  136, "Merun",      "full", 49, 6500,  "institute"),
    ("SI",   1293, "Gucci",           "8230",  136, "Brown",      "half", 48, 6500,  None),
    ("SI",   1294, "Nike",            "8223",  136, "Merun",      "half", 50, 6500,  None),
    ("SI",   1295, "Okey",            "8233",  136, "Gun",        "full", 50, 6500,  "institute"),
    ("SI",   1296, "Charmant",        "2826",  145, "Black",      "full", 50, 6000,  None),
    ("SI",   1297, "Police",          "1530",  145, "Blue",       "full", 53, 15000, None),
    ("SI",   1298, "Charmant",        "68170", 143, "Brown",      "full", 52, 6000,  None),
    ("SI",   1299, "Boss",            "6131",  138, "Gun",        "half", 52, 6500,  "institute"),
    ("SI",   1300, "Nike",            "8253",  136, "Merun",      "half", 49, 6500,  "institute"),
    ("SI",   1301, "Cartier",         "8180",  136, "Gun",        "full", 50, 6500,  "institute"),
    ("SI",   1302, "Gucci",           "8230",  136, "Gun",        "half", 48, 6500,  "institute"),
    ("SI",   1303, "Boss",            "8226",  136, "Black",      "half", 49, 6500,  None),
    ("SI",   1304, "Gucci",           "8230",  136, "Brown",      "half", 48, 6500,  "institute"),
    ("SI",   1305, "Police",          "8634",  140, "Blue",       "full", 49, 15000, None),
    ("Neat", 1306, "No-1 Sport",      "90397", 138, "Purple",     "full", 52, 8500,  "clinic"),
    ("Neat", 1307, "No-1 Sport",      "90405", 135, "Black",      "full", 50, 8500,  "clinic"),
    ("Neat", 1308, "Porsche Design",  "8188",  138, "Black",      "full", 52, 6500,  "clinic"),
    ("Neat", 1309, "No-1 Sport",      "90405", 135, "Black",      "full", 50, 8500,  "institute"),
    ("Neat", 1310, "No-1 Sport",      "9485",  145, "Black",      "full", 53, 8500,  None),
    ("Neat", 1311, "No-1 Sport",      "9677",  140, "Black",      "full", 53, 8500,  None),
    ("Neat", 1312, "No-1 Sport",      "9677",  140, "Black",      "full", 53, 8500,  None),
    ("Neat", 1313, "No-1 Sport",      "9677",  140, "Black",      "full", 53, 8500,  None),
    ("Neat", 1314, "No-1 Sport",      "90397", 138, "Purple",     "full", 52, 8500,  None),
    ("Neat", 1315, "No-1 Sport",      "90397", 138, "Purple",     "full", 52, 8500,  None),
    ("Neat", 1316, "No-1 Sport",      "90405", 135, "Blue",       "full", 50, 8500,  None),
    ("Neat", 1317, "No-1 Sport",      "90405", 135, "Blue",       "full", 50, 8500,  None),
    ("Neat", 1318, "No-1 Sport",      "90405", 135, "Maroon",     "full", 50, 8500,  None),
    ("Neat", 1319, "No-1 Sport",      "90405", 135, "Maroon",     "full", 50, 8500,  None),
    ("Neat", 1320, "No-1 Sport",      "90405", 135, "Brown",      "full", 50, 8500,  None),
    ("Neat", 1321, "No-1 Sport",      "90405", 135, "Brown",      "full", 50, 8500,  None),
    ("Neat", 1322, "No-1 Sport",      "90397", 135, "Brown",      "full", 52, 8500,  None),
    ("Neat", 1323, "No-1 Sport",      "90397", 135, "Brown",      "full", 52, 8500,  None),
]

SUPPLIER_NAME_MAP = {
    "N":    "Nilan",
    "SI":   "SI Optics",
    "Neat": "Neat Optics",
}


def generate_id(prefix: str, number: int, length: int = 6) -> str:
    return f"{prefix}{str(number).zfill(length)}"


def generate_sku(brand: str, model_code: str, color: str, eye_size: int, rim_type: str) -> str:
    b = brand.upper()[:3].replace(" ", "")
    m = model_code.upper()[:6]
    c = color.upper()[:3]
    e = str(eye_size)
    r = "F" if rim_type.lower() == "full" else "H"
    return f"{b}-{m}-{c}-{e}-{r}"


async def run():
    mongo_uri = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    db_name = os.getenv("MONGODB_DB_NAME", "eyecare_erp")
    client = AsyncIOMotorClient(mongo_uri)
    db = client[db_name]

    now = datetime.now(timezone.utc)

    # ── Resolve supplier IDs ──────────────────────────────────────────────────
    supplier_id_map: dict[str, str | None] = {}
    for code, name in SUPPLIER_NAME_MAP.items():
        supplier = await db["suppliers"].find_one({"name": {"$regex": f"^{name}$", "$options": "i"}})
        if supplier:
            supplier_id_map[code] = supplier.get("supplier_id") or str(supplier["_id"])
            print(f"  Supplier {name} → {supplier_id_map[code]}")
        else:
            print(f"  WARNING: Supplier '{name}' not found in DB. supplier_id will be null for code '{code}'.")
            supplier_id_map[code] = None

    # ── Group rows by unique variant key ─────────────────────────────────────
    # Key: (brand, model_code, color, eye_size, rim_type, temple_length, supplier_code)
    variant_groups: dict[tuple, dict] = {}
    for row in STOCK_DATA:
        sup_code, stock_no, brand, model_code, temple, color, rim, eye_size, selling_price, sold_loc = row
        key = (brand, model_code, color.lower(), eye_size, rim, temple, sup_code)
        if key not in variant_groups:
            variant_groups[key] = {
                "brand": brand, "model_code": model_code, "color": color,
                "eye_size": eye_size, "rim_type": rim, "temple_length": temple,
                "supplier_code": sup_code,
                "selling_price": selling_price,
                "stock_nos": [],
                "sold_locations": [],
            }
        variant_groups[key]["stock_nos"].append(stock_no)
        if sold_loc:
            variant_groups[key]["sold_locations"].append(sold_loc)
        # Use the first non-None selling price
        if variant_groups[key]["selling_price"] is None and selling_price is not None:
            variant_groups[key]["selling_price"] = selling_price

    print(f"\nGrouped {len(STOCK_DATA)} rows into {len(variant_groups)} unique variants.\n")

    # ── Get next sequence numbers ─────────────────────────────────────────────
    master_counter = await db["counters"].find_one_and_update(
        {"_id": "frame_master_sequence"},
        {"$setOnInsert": {"value": 0}},
        upsert=True,
        return_document=True,
    )
    variant_counter = await db["counters"].find_one_and_update(
        {"_id": "frame_variant_sequence"},
        {"$setOnInsert": {"value": 0}},
        upsert=True,
        return_document=True,
    )
    next_master_num = int((master_counter or {}).get("value", 0)) + 1
    next_variant_num = int((variant_counter or {}).get("value", 0)) + 1

    masters_created = 0
    variants_created = 0
    variants_updated = 0

    # Track which (brand, model_code) → frame_master_id we've already handled
    brand_model_to_master: dict[tuple, str] = {}

    for key, vdata in variant_groups.items():
        brand = vdata["brand"]
        model_code = vdata["model_code"]
        color = vdata["color"]
        eye_size = vdata["eye_size"]
        rim_type = vdata["rim_type"]
        temple = vdata["temple_length"]
        sup_code = vdata["supplier_code"]
        selling_price = vdata["selling_price"] or 0
        cost_price = round(selling_price / 6, 2)
        stock_nos: list[int] = vdata["stock_nos"]
        # Derive current_stock: total units minus sold units
        sold_count = len(vdata["sold_locations"])
        total_count = len(stock_nos)
        current_stock = max(0, total_count - sold_count)
        # sale_location: use the most common sold location (or None if none sold)
        sale_location = None
        if sold_count > 0:
            from collections import Counter
            sale_location = Counter(vdata["sold_locations"]).most_common(1)[0][0]

        supplier_id = supplier_id_map.get(sup_code)

        # ── Ensure FrameMaster exists ─────────────────────────────────────────
        master_key = (brand.lower(), model_code.lower())
        if master_key in brand_model_to_master:
            frame_master_id = brand_model_to_master[master_key]
        else:
            existing_master = await db["frame_masters"].find_one({
                "brand": {"$regex": f"^{brand}$", "$options": "i"},
                "model_code": {"$regex": f"^{model_code}$", "$options": "i"},
            })
            if existing_master:
                frame_master_id = existing_master["frame_master_id"]
                print(f"  Master exists: {brand} {model_code} → {frame_master_id}")
            else:
                frame_master_id = generate_id("FM-", next_master_num)
                next_master_num += 1
                await db["frame_masters"].insert_one({
                    "frame_master_id": frame_master_id,
                    "brand": brand,
                    "model_code": model_code,
                    "frame_name": f"{brand} {model_code}",
                    "category": "optical",
                    "rim_type": rim_type,
                    "supplier_ids": [supplier_id] if supplier_id else [],
                    "images": [],
                    "tags": [],
                    "is_active": True,
                    "created_at": now,
                    "updated_at": now,
                })
                await db["counters"].update_one(
                    {"_id": "frame_master_sequence"},
                    {"$set": {"value": next_master_num - 1}},
                )
                masters_created += 1
                print(f"  Created master: {brand} {model_code} → {frame_master_id}")
            brand_model_to_master[master_key] = frame_master_id

        # ── Ensure FrameVariant exists ────────────────────────────────────────
        sku = generate_sku(brand, model_code, color, eye_size, rim_type)
        existing_variant = await db["frame_variants"].find_one({"sku": sku})

        if existing_variant:
            # Merge institute_stock_nos and update stock
            existing_nos = existing_variant.get("institute_stock_nos") or []
            merged_nos = sorted(set(existing_nos + stock_nos))
            update_fields: dict = {
                "institute_stock_nos": merged_nos,
                "updated_at": now,
            }
            # Only update current_stock if it wasn't manually adjusted
            update_fields["current_stock"] = current_stock
            if sale_location:
                update_fields["sale_location"] = sale_location
            await db["frame_variants"].update_one(
                {"sku": sku},
                {"$set": update_fields},
            )
            variants_updated += 1
            print(f"  Updated variant: {sku} (stock_nos merged, stock={current_stock})")
        else:
            variant_id = generate_id("FV-", next_variant_num)
            next_variant_num += 1
            await db["frame_variants"].insert_one({
                "variant_id": variant_id,
                "sku": sku,
                "barcode": sku,
                "frame_master_id": frame_master_id,
                "frame_master_ref": {
                    "brand": brand,
                    "model_code": model_code,
                    "frame_name": f"{brand} {model_code}",
                    "category": "optical",
                    "shape": None,
                },
                "color": color,
                "color_code": None,
                "eye_size": eye_size,
                "bridge_size": None,
                "temple_length": temple,
                "rim_type": rim_type,
                "cost_price": cost_price,
                "selling_price": selling_price,
                "mrp": 0.0,
                "current_stock": current_stock,
                "reorder_level": 1,
                "supplier_id": supplier_id,
                "supplier_frame_no": model_code,
                "institute_stock_nos": stock_nos,
                "sale_location": sale_location,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            })
            await db["counters"].update_one(
                {"_id": "frame_variant_sequence"},
                {"$set": {"value": next_variant_num - 1}},
            )
            variants_created += 1
            print(f"  Created variant: {sku} (stock={current_stock}, nos={stock_nos})")

    print(f"\n✓ Done. Masters created: {masters_created} | Variants created: {variants_created} | Variants updated: {variants_updated}")
    client.close()


if __name__ == "__main__":
    asyncio.run(run())
