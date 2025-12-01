from datetime import datetime, date, time, timezone
from typing import Optional

def generate_id(prefix: str, number: int, length: int = 6) -> str:
    """Generate ID with prefix (e.g., PAT000001)"""
    return f"{prefix}{str(number).zfill(length)}"

def calculate_age(birth_date: datetime) -> int:
    """Calculate age from birth date (accepts datetime)"""
    today = date.today()
    birth_date_only = birth_date.date() if isinstance(birth_date, datetime) else birth_date
    age = today.year - birth_date_only.year - ((today.month, today.day) < (birth_date_only.month, birth_date_only.day))
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

def date_to_datetime(d: date) -> datetime:
    """Convert date to datetime at midnight UTC"""
    return datetime.combine(d, time.min).replace(tzinfo=timezone.utc)

def now_utc() -> datetime:
    """Get current UTC datetime"""
    return datetime.now(timezone.utc)
