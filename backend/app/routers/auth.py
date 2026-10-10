from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.organization import Organization
from ..models.user import User
from ..schemas.auth import (
    LoginRequest,
    UserRegisterRequest,
    TokenResponse,
    UserResponse,
    LogoutResponse,
    normalize_role,
    get_role_permissions
)
from ..services.auth_security import hash_password, verify_password, create_access_token
from ..dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
root_auth_router = APIRouter(prefix="/auth", tags=["Authentication (Direct)"])

def build_user_response(user: User) -> UserResponse:
    norm_role = normalize_role(user.role)
    is_admin = norm_role == "ADMIN"
    is_responder = norm_role == "RESPONDER"
    role_names = {
        "ADMIN": "Administrator (EOC Command)",
        "RESPONDER": "Emergency Responder",
        "USER": "Citizen / User"
    }
    return UserResponse(
        id=user.id,
        organization_id=user.organization_id,
        email=user.email,
        full_name=user.full_name,
        role=norm_role,
        phone=getattr(user, "phone", None),
        status=getattr(user, "status", "ACTIVE"),
        is_admin=is_admin,
        is_responder=is_responder,
        role_name=role_names.get(norm_role, "Citizen / User"),
        permissions=get_role_permissions(norm_role),
        organization_name=user.organization.name if user.organization else "Emergency Response Network"
    )

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@root_auth_router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserRegisterRequest, db: Session = Depends(get_db)):
    """
    Registers a new user account.
    Public registration defaults to standard citizen USER role.
    """
    clean_email = payload.email.strip().lower()
    clean_org = (payload.organization_id or "org-emergency-01").strip().lower()

    # Check existing email
    existing_user = db.query(User).filter(User.email == clean_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An account with email '{clean_email}' already exists."
        )

    # Enforce role safety: public registration cannot create unrestricted ADMIN accounts
    requested_role = normalize_role(payload.role)
    if requested_role in ["ADMIN", "RESPONDER"] and not clean_email.endswith("@emergency.com"):
        # Safe default to citizen USER
        requested_role = "USER"

    # Ensure organization exists
    org = db.query(Organization).filter(Organization.id == clean_org).first()
    if not org:
        org = Organization(
            id=clean_org,
            name="Emergency Response & Safety Platform",
            sector="Public Safety & Municipal Services"
        )
        db.add(org)
        db.commit()

    # Hash password securely
    secure_hash = hash_password(payload.password)

    new_user = User(
        organization_id=clean_org,
        email=clean_email,
        password=secure_hash,
        full_name=payload.full_name.strip(),
        role=requested_role,
        phone=payload.phone.strip() if payload.phone else None,
        status="ACTIVE"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    user_resp = build_user_response(new_user)
    token = create_access_token({
        "sub": str(new_user.id),
        "email": new_user.email,
        "role": user_resp.role,
        "is_admin": user_resp.is_admin,
        "org_id": new_user.organization_id
    })

    return TokenResponse(access_token=token, token_type="bearer", user=user_resp)

@router.post("/login", response_model=TokenResponse)
@root_auth_router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates user with email and password.
    Returns JWT bearer token and verified user profile.
    """
    clean_email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()

    if not user or not verify_password(payload.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    # Transparently upgrade legacy plaintext password to secure PBKDF2 hash on successful login
    if not user.password.startswith("pbkdf2:"):
        user.password = hash_password(payload.password)
        db.commit()

    user_resp = build_user_response(user)
    token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "role": user_resp.role,
        "is_admin": user_resp.is_admin,
        "org_id": user.organization_id
    })

    return TokenResponse(access_token=token, token_type="bearer", user=user_resp)

@router.get("/me", response_model=UserResponse)
@root_auth_router.get("/me", response_model=UserResponse)
def get_profile(current_user: User = Depends(get_current_user)):
    """
    Retrieves current authenticated user profile and permissions.
    """
    return build_user_response(current_user)

@router.post("/logout", response_model=LogoutResponse)
@root_auth_router.post("/logout", response_model=LogoutResponse)
def logout():
    """
    Logs out current session. Client should clear local token.
    """
    return LogoutResponse(status="success", message="Logged out successfully.")
