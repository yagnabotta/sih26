from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..dependencies import get_current_user, require_admin, require_responder, require_user
from ..schemas.emergency import (
    IncidentCreate,
    IncidentResponse,
    IncidentDetailResponse,
    IncidentStatusUpdate,
    IncidentAssignRequest,
    IncidentStatusHistoryResponse,
    ResponderCreate,
    ResponderResponse,
    ResponderNearbyResponse,
    NotificationResponse
)
from ..services import emergency_service

api_router = APIRouter(prefix="/api", tags=["Emergency Response"])
root_router = APIRouter(tags=["Emergency Response (Direct)"])

@api_router.post("/incidents", response_model=IncidentDetailResponse, status_code=status.HTTP_201_CREATED)
@root_router.post("/incidents", response_model=IncidentDetailResponse, status_code=status.HTTP_201_CREATED)
def create_incident(
    payload: IncidentCreate,
    db: Session = Depends(get_db)
):
    """Reports a new emergency incident with confirmed location."""
    return emergency_service.create_incident(db, payload)

@api_router.get("/incidents", response_model=List[IncidentResponse])
@root_router.get("/incidents", response_model=List[IncidentResponse])
def list_incidents(
    status: Optional[str] = Query(None, description="Filter by status (e.g. REPORTED, ASSIGNED)"),
    severity: Optional[str] = Query(None, description="Filter by severity (e.g. HIGH, CRITICAL)"),
    incident_type: Optional[str] = Query(None, description="Filter by incident type"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Lists incidents with optional filters."""
    return emergency_service.get_incidents(db, status, severity, incident_type, limit, offset)

@api_router.get("/incidents/{incident_id}", response_model=IncidentDetailResponse)
@root_router.get("/incidents/{incident_id}", response_model=IncidentDetailResponse)
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    """Retrieves incident details with location, assigned responder, and timeline."""
    incident = emergency_service.get_incident_by_id(db, incident_id)
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID {incident_id} not found."
        )
    return incident

@api_router.put("/incidents/{incident_id}/status", response_model=IncidentDetailResponse)
@root_router.put("/incidents/{incident_id}/status", response_model=IncidentDetailResponse)
def update_incident_status(
    incident_id: int,
    payload: IncidentStatusUpdate,
    current_user: User = Depends(require_responder),
    db: Session = Depends(get_db)
):
    """
    Updates incident status and logs history entry.
    Restricted to RESPONDER or ADMIN roles.
    """
    incident = emergency_service.get_incident_by_id(db, incident_id)
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID {incident_id} not found."
        )
    return emergency_service.update_incident_status(
        db,
        incident,
        payload.status.value,
        changed_by_id=current_user.id,
        notes=payload.notes
    )

@api_router.get("/incidents/{incident_id}/history", response_model=List[IncidentStatusHistoryResponse])
@root_router.get("/incidents/{incident_id}/history", response_model=List[IncidentStatusHistoryResponse])
def get_incident_history(incident_id: int, db: Session = Depends(get_db)):
    """Retrieves audit status history for an incident."""
    incident = emergency_service.get_incident_by_id(db, incident_id)
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID {incident_id} not found."
        )
    return emergency_service.get_incident_history(db, incident_id)

@api_router.post("/incidents/{incident_id}/assign", response_model=IncidentDetailResponse)
@root_router.post("/incidents/{incident_id}/assign", response_model=IncidentDetailResponse)
def assign_responder(
    incident_id: int,
    payload: IncidentAssignRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Assigns an emergency responder to an incident.
    Restricted to ADMIN role.
    """
    incident = emergency_service.get_incident_by_id(db, incident_id)
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID {incident_id} not found."
        )
    responder = emergency_service.get_responder_by_id(db, payload.responder_id)
    if not responder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Responder with ID {payload.responder_id} not found."
        )
    return emergency_service.assign_responder_to_incident(db, incident, responder)

@api_router.get("/responders", response_model=List[ResponderResponse])
@root_router.get("/responders", response_model=List[ResponderResponse])
def list_responders(
    availability: Optional[str] = Query(None, description="Filter by availability status (AVAILABLE, BUSY, OFFLINE)"),
    responder_type: Optional[str] = Query(None, description="Filter by responder type"),
    db: Session = Depends(get_db)
):
    """Lists registered responders."""
    return emergency_service.get_responders(db, availability, responder_type)

@api_router.post("/responders", response_model=ResponderResponse, status_code=status.HTTP_201_CREATED)
@root_router.post("/responders", response_model=ResponderResponse, status_code=status.HTTP_201_CREATED)
def create_responder(
    payload: ResponderCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Registers a new responder unit.
    Restricted to ADMIN role.
    """
    return emergency_service.create_responder(db, payload)

@api_router.get("/responders/nearby", response_model=List[ResponderNearbyResponse])
@root_router.get("/responders/nearby", response_model=List[ResponderNearbyResponse])
def get_nearby_responders(
    latitude: float = Query(..., ge=-90.0, le=90.0),
    longitude: float = Query(..., ge=-180.0, le=180.0),
    radius_km: float = Query(50.0, ge=0.5, le=500.0),
    responder_type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Finds responders ranked by proximity to the provided target coordinates."""
    return emergency_service.get_nearby_responders(db, latitude, longitude, radius_km, responder_type)

@api_router.get("/notifications", response_model=List[NotificationResponse])
@root_router.get("/notifications", response_model=List[NotificationResponse])
def list_notifications(
    user_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Lists emergency notifications."""
    return emergency_service.get_notifications(db, user_id, status, limit)
