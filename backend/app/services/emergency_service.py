import math
import random
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..models.emergency import (
    Incident,
    IncidentLocation,
    Responder,
    ResponderAssignment,
    EmergencyNotification,
    IncidentStatusHistory,
    IncidentStatusEnum,
    ResponderAvailabilityEnum,
    AssignmentStatusEnum,
    NotificationTypeEnum,
    NotificationStatusEnum
)
from ..schemas.emergency import IncidentCreate, ResponderCreate

def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two points in kilometers."""
    R = 6371.0 # Earth's radius in kilometers
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

def estimate_travel_time_mins(distance_km: float, avg_speed_kmh: float = 35.0) -> int:
    """Estimates emergency vehicle travel time in minutes."""
    if distance_km <= 0:
        return 1
    hours = distance_km / avg_speed_kmh
    return max(1, round(hours * 60))

def generate_incident_reference(db: Session) -> str:
    """Generates sequential incident reference code like INC-2026-0001."""
    year = datetime.utcnow().year
    count = db.query(Incident).count()
    return f"INC-{year}-{count + 1:04d}"

def create_incident(db: Session, payload: IncidentCreate, reported_by_id: Optional[int] = None) -> Incident:
    """Creates a confirmed incident location and binds it to a newly registered emergency incident."""
    # 1. Create Location
    loc_data = payload.location
    location = IncidentLocation(
        latitude=loc_data.latitude,
        longitude=loc_data.longitude,
        address=loc_data.address.strip(),
        city=loc_data.city.strip() if loc_data.city else None,
        state=loc_data.state.strip() if loc_data.state else None,
        postal_code=loc_data.postal_code.strip() if loc_data.postal_code else None,
        landmark=loc_data.landmark.strip() if loc_data.landmark else None,
    )
    db.add(location)
    db.flush()

    # 2. Create Incident
    ref_code = generate_incident_reference(db)
    incident = Incident(
        incident_reference=ref_code,
        reported_by_id=reported_by_id,
        incident_type=payload.incident_type.value,
        severity=payload.severity.value,
        description=payload.description.strip(),
        status=IncidentStatusEnum.REPORTED.value,
        incident_location_id=location.id
    )
    db.add(incident)
    db.flush()

    # 3. Create initial status history entry
    history = IncidentStatusHistory(
        incident_id=incident.id,
        old_status=None,
        new_status=IncidentStatusEnum.REPORTED.value,
        changed_by_id=reported_by_id,
        notes="Incident reported and registered in the system."
    )
    db.add(history)

    # 4. Generate notification
    notification = EmergencyNotification(
        user_id=reported_by_id,
        incident_id=incident.id,
        type=NotificationTypeEnum.STATUS_UPDATE.value,
        title=f"Incident {ref_code} Reported",
        message=f"{payload.severity.value} severity {payload.incident_type.value} reported at {location.address}.",
        status=NotificationStatusEnum.UNREAD.value
    )
    db.add(notification)

    db.commit()
    db.refresh(incident)
    return incident

def get_incidents(
    db: Session,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    incident_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
) -> List[Incident]:
    """Retrieves incidents with optional filters."""
    query = db.query(Incident)
    if status:
        query = query.filter(Incident.status == status)
    if severity:
        query = query.filter(Incident.severity == severity)
    if incident_type:
        query = query.filter(Incident.incident_type == incident_type)
    return query.order_by(desc(Incident.created_at)).offset(offset).limit(limit).all()

def get_incident_by_id(db: Session, incident_id: int) -> Optional[Incident]:
    """Finds incident by primary key with relations."""
    return db.query(Incident).filter(Incident.id == incident_id).first()

def update_incident_status(
    db: Session,
    incident: Incident,
    new_status: str,
    changed_by_id: Optional[int] = None,
    notes: Optional[str] = None
) -> Incident:
    """Updates incident lifecycle state, creates history entry and notification."""
    old_status = incident.status
    incident.status = new_status
    incident.updated_at = datetime.utcnow()

    # Record History
    history = IncidentStatusHistory(
        incident_id=incident.id,
        old_status=old_status,
        new_status=new_status,
        changed_by_id=changed_by_id,
        notes=notes or f"Status transitioned from {old_status} to {new_status}"
    )
    db.add(history)

    # Create Notification
    notification = EmergencyNotification(
        user_id=incident.reported_by_id,
        incident_id=incident.id,
        type=NotificationTypeEnum.STATUS_UPDATE.value,
        title=f"Incident {incident.incident_reference} Status Updated",
        message=f"Incident status changed to {new_status}.",
        status=NotificationStatusEnum.UNREAD.value
    )
    db.add(notification)

    # If resolved or cancelled, release assigned responder
    if new_status in [IncidentStatusEnum.RESOLVED.value, IncidentStatusEnum.CANCELLED.value]:
        if incident.assigned_responder:
            incident.assigned_responder.availability_status = ResponderAvailabilityEnum.AVAILABLE.value
            incident.assigned_responder.active_incident_id = None
        # Mark assignment completed
        assignment = db.query(ResponderAssignment).filter(
            ResponderAssignment.incident_id == incident.id,
            ResponderAssignment.status.in_([AssignmentStatusEnum.PENDING.value, AssignmentStatusEnum.ACCEPTED.value])
        ).first()
        if assignment:
            assignment.status = AssignmentStatusEnum.COMPLETED.value
            assignment.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(incident)
    return incident

def get_incident_history(db: Session, incident_id: int) -> List[IncidentStatusHistory]:
    """Retrieves full audit timeline for an incident."""
    return db.query(IncidentStatusHistory).filter(
        IncidentStatusHistory.incident_id == incident_id
    ).order_by(desc(IncidentStatusHistory.changed_at)).all()

def create_responder(db: Session, payload: ResponderCreate) -> Responder:
    """Creates an emergency responder unit."""
    responder = Responder(
        name=payload.name.strip(),
        responder_type=payload.responder_type.value,
        contact=payload.contact.strip(),
        current_latitude=payload.current_latitude,
        current_longitude=payload.current_longitude,
        availability_status=payload.availability_status.value
    )
    db.add(responder)
    db.commit()
    db.refresh(responder)
    return responder

def get_responders(
    db: Session,
    availability: Optional[str] = None,
    responder_type: Optional[str] = None
) -> List[Responder]:
    """Retrieves responder fleet."""
    query = db.query(Responder)
    if availability:
        query = query.filter(Responder.availability_status == availability)
    if responder_type:
        query = query.filter(Responder.responder_type == responder_type)
    return query.all()

def get_responder_by_id(db: Session, responder_id: int) -> Optional[Responder]:
    """Finds responder by primary key."""
    return db.query(Responder).filter(Responder.id == responder_id).first()

def get_nearby_responders(
    db: Session,
    latitude: float,
    longitude: float,
    radius_km: float = 50.0,
    responder_type: Optional[str] = None
) -> List[dict]:
    """
    Finds responders within radius_km ordered by proximity to the specified target coordinates.
    Computes distance and estimated travel time.
    """
    query = db.query(Responder)
    if responder_type:
        query = query.filter(Responder.responder_type == responder_type)
    
    responders = query.all()
    results = []
    for r in responders:
        dist = calculate_haversine_distance(latitude, longitude, r.current_latitude, r.current_longitude)
        if dist <= radius_km:
            eta = estimate_travel_time_mins(dist)
            # Convert to dictionary matching ResponderNearbyResponse
            results.append({
                "id": r.id,
                "name": r.name,
                "responder_type": r.responder_type,
                "contact": r.contact,
                "current_latitude": r.current_latitude,
                "current_longitude": r.current_longitude,
                "availability_status": r.availability_status,
                "active_incident_id": r.active_incident_id,
                "created_at": r.created_at,
                "updated_at": r.updated_at,
                "distance_km": dist,
                "estimated_travel_time_mins": eta
            })
    
    # Sort by distance
    results.sort(key=lambda item: item["distance_km"])
    return results

def assign_responder_to_incident(
    db: Session,
    incident: Incident,
    responder: Responder
) -> Incident:
    """Assigns an emergency responder to an incident and creates assignment record."""
    incident.assigned_responder_id = responder.id
    incident.status = IncidentStatusEnum.ASSIGNED.value
    incident.updated_at = datetime.utcnow()

    responder.availability_status = ResponderAvailabilityEnum.BUSY.value
    responder.active_incident_id = incident.id
    responder.updated_at = datetime.utcnow()

    # Create ResponderAssignment record
    assignment = ResponderAssignment(
        incident_id=incident.id,
        responder_id=responder.id,
        status=AssignmentStatusEnum.PENDING.value,
        assigned_at=datetime.utcnow()
    )
    db.add(assignment)

    # Status History
    history = IncidentStatusHistory(
        incident_id=incident.id,
        old_status=incident.status,
        new_status=IncidentStatusEnum.ASSIGNED.value,
        notes=f"Responder {responder.name} ({responder.responder_type}) assigned to incident."
    )
    db.add(history)

    # Notification for dispatch
    notification = EmergencyNotification(
        incident_id=incident.id,
        type=NotificationTypeEnum.DISPATCH.value,
        title=f"Unit Dispatched for {incident.incident_reference}",
        message=f"{responder.name} assigned to {incident.incident_type} at {incident.location.address}.",
        status=NotificationStatusEnum.UNREAD.value
    )
    db.add(notification)

    db.commit()
    db.refresh(incident)
    return incident

def get_notifications(
    db: Session,
    user_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = 50
) -> List[EmergencyNotification]:
    """Retrieves notifications."""
    query = db.query(EmergencyNotification)
    if user_id:
        query = query.filter(EmergencyNotification.user_id == user_id)
    if status:
        query = query.filter(EmergencyNotification.status == status)
    return query.order_by(desc(EmergencyNotification.created_at)).limit(limit).all()
