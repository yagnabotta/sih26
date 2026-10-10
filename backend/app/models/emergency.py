import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base

# ==============================================================================
# ENUMS / CONSTANTS
# ==============================================================================

class IncidentTypeEnum(str, enum.Enum):
    FIRE = "FIRE"
    MEDICAL = "MEDICAL"
    ROAD_ACCIDENT = "ROAD_ACCIDENT"
    GAS_LEAK = "GAS_LEAK"
    SECURITY = "SECURITY"
    INDUSTRIAL_ACCIDENT = "INDUSTRIAL_ACCIDENT"
    ENVIRONMENTAL = "ENVIRONMENTAL"
    OTHER = "OTHER"

class SeverityEnum(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class IncidentStatusEnum(str, enum.Enum):
    REPORTED = "REPORTED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    ASSIGNED = "ASSIGNED"
    RESPONDER_ACCEPTED = "RESPONDER_ACCEPTED"
    EN_ROUTE = "EN_ROUTE"
    ARRIVED = "ARRIVED"
    RESPONDING = "RESPONDING"
    RESOLVED = "RESOLVED"
    CANCELLED = "CANCELLED"
    ESCALATED = "ESCALATED"

class ResponderTypeEnum(str, enum.Enum):
    FIRE_ENGINE = "FIRE_ENGINE"
    AMBULANCE = "AMBULANCE"
    POLICE = "POLICE"
    HAZMAT = "HAZMAT"
    RESCUE_TEAM = "RESCUE_TEAM"
    OTHER = "OTHER"

class ResponderAvailabilityEnum(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    BUSY = "BUSY"
    OFFLINE = "OFFLINE"

class AssignmentStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"
    COMPLETED = "COMPLETED"

class NotificationStatusEnum(str, enum.Enum):
    UNREAD = "UNREAD"
    READ = "READ"

class NotificationTypeEnum(str, enum.Enum):
    DISPATCH = "DISPATCH"
    STATUS_UPDATE = "STATUS_UPDATE"
    ESCALATION = "ESCALATION"
    BROADCAST = "BROADCAST"


# ==============================================================================
# DATABASE MODELS
# ==============================================================================

class IncidentLocation(Base):
    """
    Dedicated entity for the confirmed geographic location of an emergency incident.
    Enforces the principle that User Location (reporter GPS) != Incident Location.
    """
    __tablename__ = "incident_locations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String(500), nullable=False)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    landmark = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    incident = relationship("Incident", back_populates="location", uselist=False)


class Incident(Base):
    """
    Represents an emergency incident reported on the hyperlocal platform.
    """
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    incident_reference = Column(String(50), unique=True, index=True, nullable=False)
    reported_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    incident_type = Column(String(50), nullable=False, index=True)
    severity = Column(String(50), nullable=False, index=True)
    description = Column(Text, nullable=False)
    status = Column(String(50), default=IncidentStatusEnum.REPORTED.value, nullable=False, index=True)
    
    incident_location_id = Column(Integer, ForeignKey("incident_locations.id", ondelete="RESTRICT"), nullable=False, index=True)
    assigned_responder_id = Column(Integer, ForeignKey("responders.id", ondelete="SET NULL"), nullable=True, index=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    location = relationship("IncidentLocation", back_populates="incident")
    reporter = relationship("User", foreign_keys=[reported_by_id], back_populates="reported_incidents")
    assigned_responder = relationship("Responder", foreign_keys=[assigned_responder_id], back_populates="assigned_incidents")
    assignments = relationship("ResponderAssignment", back_populates="incident", cascade="all, delete-orphan")
    status_history = relationship("IncidentStatusHistory", back_populates="incident", cascade="all, delete-orphan", order_by="desc(IncidentStatusHistory.changed_at)")
    notifications = relationship("EmergencyNotification", back_populates="incident", cascade="all, delete-orphan")


class Responder(Base):
    """
    Emergency response unit (e.g. Ambulance, Fire Engine, Police Squad).
    Tracks live GPS coordinates and availability state.
    """
    __tablename__ = "responders"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(150), nullable=False)
    responder_type = Column(String(50), nullable=False, index=True)
    contact = Column(String(50), nullable=False)
    current_latitude = Column(Float, nullable=False)
    current_longitude = Column(Float, nullable=False)
    availability_status = Column(String(50), default=ResponderAvailabilityEnum.AVAILABLE.value, nullable=False, index=True)
    active_incident_id = Column(Integer, ForeignKey("incidents.id", ondelete="SET NULL"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    assigned_incidents = relationship("Incident", foreign_keys=[Incident.assigned_responder_id], back_populates="assigned_responder")
    active_incident = relationship("Incident", foreign_keys=[active_incident_id])
    assignments = relationship("ResponderAssignment", back_populates="responder", cascade="all, delete-orphan")


class ResponderAssignment(Base):
    """
    Tracks the assignment lifecycle of a responder to an incident.
    """
    __tablename__ = "responder_assignments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    incident_id = Column(Integer, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, index=True)
    responder_id = Column(Integer, ForeignKey("responders.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(50), default=AssignmentStatusEnum.PENDING.value, nullable=False, index=True)
    
    assigned_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    incident = relationship("Incident", back_populates="assignments")
    responder = relationship("Responder", back_populates="assignments")


class EmergencyNotification(Base):
    """
    System alert or notification for citizens, responders, or coordinators.
    """
    __tablename__ = "emergency_notifications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=True, index=True)
    
    type = Column(String(50), default=NotificationTypeEnum.STATUS_UPDATE.value, nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(50), default=NotificationStatusEnum.UNREAD.value, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="notifications")
    incident = relationship("Incident", back_populates="notifications")


class IncidentStatusHistory(Base):
    """
    Immutable audit log recording every transition in an incident's lifecycle.
    """
    __tablename__ = "incident_status_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    incident_id = Column(Integer, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, index=True)
    old_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=False)
    changed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    notes = Column(Text, nullable=True)

    # Relationships
    incident = relationship("Incident", back_populates="status_history")
    changed_by = relationship("User")
