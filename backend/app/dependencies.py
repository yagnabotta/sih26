import jwt
from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .database import get_db
from .models.user import User
from .services.auth_security import decode_access_token
from .schemas.auth import normalize_role

security = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Validates JWT bearer token and extracts authenticated User entity.
    Verifies user exists and is active.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
        user_id_raw = payload.get("sub")
        if user_id_raw is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token: missing user subject.",
            )
        user_id = int(user_id_raw)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired. Please login again.",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {str(e)}",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account associated with this token no longer exists.",
        )
    
    if hasattr(user, "status") and user.status and user.status.upper() == "INACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive. Please contact support.",
        )

    return user

def require_role(allowed_roles: List[str]):
    """
    Factory creating a FastAPI dependency that checks if the authenticated user
    holds one of the specified allowed roles (USER, RESPONDER, ADMIN).
    """
    normalized_allowed = [normalize_role(r) for r in allowed_roles]

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_norm_role = normalize_role(current_user.role)
        if user_norm_role not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: '{user_norm_role}' role is not authorized. Required: {', '.join(normalized_allowed)}"
            )
        return current_user

    return role_checker

# Predefined role dependencies
require_admin = require_role(["ADMIN"])
require_responder = require_role(["RESPONDER", "ADMIN"])
require_user = require_role(["USER", "RESPONDER", "ADMIN"])
