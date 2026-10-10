from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from ..models.emergency import (
    IncidentTypeEnum,
    SeverityEnum,
    IncidentStatusEnum,
    ResponderTypeEnum,
    ResponderAvailabilityEnum,
    AssignmentStatusEnum,
    NotificationStatusEnum,
    NotificationTypeEnum
)

# ----------------- Incident Location Schemas -----------------
class IncidentLocationCreate(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude between -90 and 90")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude between -180 and 180")
    address: str = Field(..., min_length=2, max_length=500, description="Confirmed street address or sector")
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    landmark: Optional[str] = Field(None, max_length=200)

class IncidentLocationResponse(IncidentLocationCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# ----------------- Responder Schemas -----------------
class ResponderBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    responder_type: ResponderTypeEnum
    contact: str = Field(..., min_length=5, max_length=50)
    current_latitude: float = Field(..., ge=-90.0, le=90.0)
    current_longitude: float = Field(..., ge=-180.0, le=180.0)
    availability_status: ResponderAvailabilityEnum = ResponderAvailabilityEnum.AVAILABLE

class ResponderCreate(ResponderBase):
    pass

class ResponderResponse(ResponderBase):
    id: int
    active_incident_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ResponderNearbyResponse(ResponderResponse):
    distance_km: float = Field(..., description="Great-circle distance from incident location in km")
    estimated_travel_time_mins: int = Field(..., description="Estimated travel time in minutes")

class ResponderAvailabilityUpdate(BaseModel):
    availability_status: ResponderAvailabilityEnum

# ----------------- Incident Status History Schemas -----------------
class IncidentStatusHistoryResponse(BaseModel):
    id: int
    incident_id: int
    old_status: Optional[str] = None
    new_status: str
    changed_by_id: Optional[int] = None
    changed_at: datetime
    notes: Optional[str] = None

    class Config:
        from_attributes = True

# ----------------- Notification Schemas -----------------
class NotificationResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    incident_id: Optional[int] = None
    type: str
    title: str
    message: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

# ----------------- Incident Schemas -----------------
class IncidentCreate(BaseModel):
    incident_type: IncidentTypeEnum = Field(..., description="Category of the emergency")
    severity: SeverityEnum = Field(..., description="Severity level: LOW, MEDIUM, HIGH, CRITICAL")
    description: str = Field(..., min_length=5, max_length=5000, description="Detailed description of the emergency")
    location: IncidentLocationCreate = Field(..., description="Confirmed geographic location of the emergency")

class IncidentStatusUpdate(BaseModel):
    status: IncidentStatusEnum
    notes: Optional[str] = Field(None, max_length=1000, description="Optional log note explaining status change")

class IncidentAssignRequest(BaseModel):
    responder_id: int = Field(..., description="ID of the responder to assign")

class IncidentResponse(BaseModel):
    id: int
    incident_reference: str
    reported_by_id: Optional[int] = None
    incident_type: str
    severity: str
    description: str
    status: str
    incident_location_id: int
    assigned_responder_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    location: IncidentLocationResponse

    class Config:
        from_attributes = True

class IncidentDetailResponse(IncidentResponse):
    assigned_responder: Optional[ResponderResponse] = None
    status_history: List[IncidentStatusHistoryResponse] = []

    class Config:
        from_attributes = True
