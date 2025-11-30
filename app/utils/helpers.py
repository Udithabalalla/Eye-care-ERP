from datetime import datetime, date
from typing import Optional

def generate_id(prefix: str, number: int, length: int = 6) -> str:
    """Generate ID with prefix (e.g., PAT000001)"""
    return f"{prefix}{str(number).zfill(length)}"

def calculate_age(birth_date: date) -> int:
    """Calculate age from birth date"""
    today = date.today()
    age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
    return age

def format_phone(phone: str) -> str:
    """Format phone number"""
    # Remove all non-numeric characters
    digits = ''.join(filter(str.isdigit, phone))
    return digits

def serialize_datetime(dt: Optional[datetime]) -> Optional[str]:
    """Serialize datetime to ISO format string"""
    if dt:
        return dt.isoformat()
    return None

def serialize_date(d: Optional[date]) -> Optional[str]:
    """Serialize date to ISO format string"""
    if d:
        return d.isoformat()
    return None
