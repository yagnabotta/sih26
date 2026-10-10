import hashlib
import secrets
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from ..config import settings

def hash_password(password: str) -> str:
    """
    Hashes a password using PBKDF2-HMAC-SHA256 with a cryptographically secure random salt.
    Format: pbkdf2:sha256:100000$<salt>$<hash>
    """
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return f"pbkdf2:sha256:100000${salt}${key}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain-text password against a stored hash using constant-time comparison.
    Supports backwards compatibility for initial legacy demo passwords.
    """
    if not hashed_password or not plain_password:
        return False
    
    # Backwards compatibility check for legacy demo seeds (e.g. Admin1@123)
    if not hashed_password.startswith("pbkdf2:"):
        return secrets.compare_digest(plain_password, hashed_password)
    
    try:
        parts = hashed_password.split("$")
        if len(parts) != 3:
            return False
        header, salt, expected_key = parts
        iterations = int(header.split(":")[-1])
        calculated_key = hashlib.pbkdf2_hmac(
            'sha256',
            plain_password.encode('utf-8'),
            salt.encode('utf-8'),
            iterations
        ).hex()
        return secrets.compare_digest(calculated_key, expected_key)
    except Exception:
        return False

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Encodes standard JWT claims with configurable expiration.
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": now})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decodes and validates a JWT token. Raises exceptions on signature mismatch or expiration.
    """
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
