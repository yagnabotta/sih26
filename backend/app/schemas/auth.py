from typing import Optional, List
from pydantic import BaseModel, Field

def normalize_role(role_raw: Optional[str]) -> str:
    """Normalizes role strings into standard USER, RESPONDER, or ADMIN."""
    if not role_raw:
        return "USER"
    r = role_raw.strip().upper()
    if r in ["ADMIN", "ADMINISTRATOR", "CHIEF_HSE_AUDITOR"]:
        return "ADMIN"
    if r in ["RESPONDER", "RESCUE_UNIT", "OFFICER", "HSE_OFFICER", "FIRE", "MEDIC"]:
        return "RESPONDER"
    return "USER"

def get_role_permissions(role: str) -> List[str]:
    """Returns permission tokens based on normalized role."""
    norm = normalize_role(role)
    if norm == "ADMIN":
        return [
            "ALL",
            "INCIDENT_MANAGE",
            "RESPONDER_ASSIGN",
            "ESCALATE_INCIDENT",
            "VIEW_EOC_MAP",
            "VIEW_ALL_INCIDENTS",
            "VIEW_ANALYTICS",
            "SYSTEM_SETTINGS"
        ]
    elif norm == "RESPONDER":
        return [
            "VIEW_ASSIGNED_INCIDENTS",
            "ACCEPT_DECLINE_ASSIGNMENT",
            "UPDATE_RESPONSE_STATUS",
            "USE_NAVIGATION",
            "RECEIVE_DISPATCH_ALERTS"
        ]
    else:
        return [
            "REPORT_EMERGENCY",
            "VIEW_OWN_INCIDENTS",
            "VIEW_INCIDENT_STATUS",
            "RECEIVE_USER_NOTIFICATIONS",
            "VIEW_INCIDENT_HISTORY"
        ]

class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, description="User email address")
    password: str = Field(..., min_length=4, description="User password")
    org_id: Optional[str] = Field(None, description="Optional organization identifier")

class UserRegisterRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=150, description="Valid user email")
    password: str = Field(..., min_length=6, max_length=100, description="Password (at least 6 characters)")
    full_name: str = Field(..., min_length=2, max_length=100, description="Full name or Citizen name")
    phone: Optional[str] = Field(None, max_length=50, description="Contact phone number")
    role: Optional[str] = Field("USER", description="Requested role (defaults to USER for public registration)")
    organization_id: Optional[str] = Field("org-emergency-01", description="Associated organization or jurisdiction")

class UserResponse(BaseModel):
    id: int
    organization_id: Optional[str] = None
    email: str
    full_name: str
    role: str
    phone: Optional[str] = None
    status: str = "ACTIVE"
    is_admin: bool = False
    is_responder: bool = False
    role_name: str
    permissions: List[str] = []
    organization_name: Optional[str] = None

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class LogoutResponse(BaseModel):
    status: str = "success"
    message: str = "Successfully logged out."
