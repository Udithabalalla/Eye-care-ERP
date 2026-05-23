import re


_COLOR_CODES: dict[str, str] = {
    "black": "BLK", "white": "WHT", "silver": "SLV", "gold": "GLD",
    "gunmetal": "GNM", "rose gold": "RSG", "brown": "BRN", "tortoise": "TRT",
    "havana": "HVN", "blue": "BLU", "navy": "NVY", "green": "GRN",
    "red": "RED", "pink": "PNK", "purple": "PRP", "grey": "GRY",
    "gray": "GRY", "clear": "CLR", "transparent": "CLR", "crystal": "CRY",
    "olive": "OLV", "orange": "ORG", "yellow": "YLW", "copper": "CPR",
    "matte black": "MBK", "gloss black": "GBK", "chrome": "CHR",
    "carbon": "CBN", "burgundy": "BGD", "maroon": "MRN", "nude": "NDE",
}

_RIM_CODES: dict[str, str] = {
    "full": "F",
    "half": "H",
    "rimless": "R",
}


def _slugify(text: str, max_chars: int = 4) -> str:
    """Turn a string into an uppercase alphanumeric slug."""
    cleaned = re.sub(r"[^a-zA-Z0-9]", "", text).upper()
    return cleaned[:max_chars]


def _color_to_code(color: str) -> str:
    lower = color.strip().lower()
    if lower in _COLOR_CODES:
        return _COLOR_CODES[lower]
    # Try prefix match
    for key, code in _COLOR_CODES.items():
        if lower.startswith(key):
            return code
    return _slugify(color, 3)


def generate_sku(brand: str, model_code: str, color: str, eye_size: int, rim_type: str) -> str:
    """
    Generate a deterministic SKU from variant attributes.
    Format: {BRAND3}-{MODEL}-{COLOR3}-{SIZE}-{RIM1}
    Example: BOS-1602-BLK-52-F
    """
    brand_code = _slugify(brand, 3)
    model_slug = _slugify(model_code, 6)
    color_code = _color_to_code(color)
    rim_code = _RIM_CODES.get(rim_type.lower(), _slugify(rim_type, 1))
    return f"{brand_code}-{model_slug}-{color_code}-{eye_size}-{rim_code}"


def generate_sku_unique(
    brand: str,
    model_code: str,
    color: str,
    eye_size: int,
    rim_type: str,
    existing_skus: set[str],
) -> str:
    """Generate SKU and append numeric suffix if collision exists."""
    base = generate_sku(brand, model_code, color, eye_size, rim_type)
    if base not in existing_skus:
        return base
    suffix = 2
    while f"{base}-{suffix}" in existing_skus:
        suffix += 1
    return f"{base}-{suffix}"
