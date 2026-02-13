from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.config.settings import settings

# Use bcrypt with optimized rounds (12 is a good balance of security/performance)
# Lower rounds = faster but less secure, higher = slower but more secure
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12  # ~300ms per hash on modern hardware
)

# Token cache for recently validated tokens (performance optimization)
_token_cache: Dict[str, tuple[datetime, Dict[str, Any]]] = {}
_TOKEN_CACHE_TTL = timedelta(minutes=5)
_MAX_CACHE_SIZE = 1000


def _cleanup_token_cache():
    """Remove expired tokens from cache"""
    global _token_cache
    now = datetime.utcnow()
    expired = [k for k, v in _token_cache.items() if now > v[0]]
    for key in expired:
        del _token_cache[key]
    # Prevent cache from growing too large
    if len(_token_cache) > _MAX_CACHE_SIZE:
        _token_cache.clear()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    # Truncate password to 72 bytes for bcrypt compatibility
    plain_password_bytes = plain_password.encode('utf-8')[:72]
    plain_password_truncated = plain_password_bytes.decode('utf-8', errors='ignore')
    return pwd_context.verify(plain_password_truncated, hashed_password)

def get_password_hash(password: str) -> str:
    """Generate password hash"""
    # Truncate password to 72 bytes for bcrypt compatibility
    password_bytes = password.encode('utf-8')[:72]
    password_truncated = password_bytes.decode('utf-8', errors='ignore')
    return pwd_context.hash(password_truncated)

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode JWT token with caching for performance"""
    global _token_cache
    
    # Check cache first
    if token in _token_cache:
        expiry, payload = _token_cache[token]
        if datetime.utcnow() < expiry:
            return payload
        else:
            del _token_cache[token]
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        
        # Cache valid token
        _cleanup_token_cache()
        cache_expiry = datetime.utcnow() + _TOKEN_CACHE_TTL
        _token_cache[token] = (cache_expiry, payload)
        
        return payload
    except JWTError:
        return None
