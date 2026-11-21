from datetime import datetime, date, time, timezone
from functools import lru_cache
from typing import Optional
from zoneinfo import ZoneInfo

from app.config.settings import settings


@lru_cache(maxsize=1)
def business_tz() -> ZoneInfo:
    """The shop's timezone (settings.BUSINESS_TIMEZONE)"""
    return ZoneInfo(settings.BUSINESS_TIMEZONE)

def business_now() -> datetime:
    """Current time in the shop's timezone"""
    return datetime.now(business_tz())

def business_today() -> date:
    """Today's date at the shop. date.today() is the server's (UTC) date, which is still
    yesterday in Sri Lanka until 05:30."""
    return business_now().date()

def generate_id(prefix: str, number: int, length: int = 6) -> str:
    """Generate ID with prefix (e.g., PAT000001)"""
    return f"{prefix}{str(number).zfill(length)}"

def calculate_age(birth_date: datetime) -> int:
    """Calculate age from birth date (accepts datetime)"""
    today = business_today()
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

def is_prescription_valid(valid_until: datetime) -> bool:
    """Return True if the prescription has not yet expired."""
    expiry = valid_until if valid_until.tzinfo else valid_until.replace(tzinfo=timezone.utc)
    return expiry >= datetime.now(timezone.utc)
