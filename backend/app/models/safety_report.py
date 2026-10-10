import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Float
from sqlalchemy.orm import relationship
from ..database import Base

class ReportTypeEnum(str, enum.Enum):
    UNSAFE_ACT = "UNSAFE_ACT"
    UNSAFE_CONDITION = "UNSAFE_CONDITION"
    NEAR_MISS = "NEAR_MISS"

class AnalysisStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class SafetyReport(Base):
    __tablename__ = "safety_reports"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    report_reference = Column(String(50), unique=True, index=True, nullable=False) # e.g. REP-00101
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    report_type = Column(String(50), nullable=False) # UNSAFE_ACT, UNSAFE_CONDITION, NEAR_MISS
    description = Column(Text, nullable=False)
    original_description = Column(Text, nullable=True)
    normalized_description = Column(Text, nullable=True)
    location = Column(String(200), nullable=False)
    report_date = Column(String(50), nullable=False)
    additional_context = Column(Text, nullable=True)

    incident_latitude = Column(Float, nullable=True)
    incident_longitude = Column(Float, nullable=True)
    incident_address = Column(String(500), nullable=True)
    incident_location_name = Column(String(200), nullable=True)
    
    analysis_status = Column(String(50), default="PENDING", nullable=False) # PENDING, PROCESSING, COMPLETED, FAILED
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("Organization", back_populates="safety_reports")
    user = relationship("User", back_populates="safety_reports")
    ai_analysis = relationship("AIAnalysis", back_populates="safety_report", uselist=False, cascade="all, delete-orphan")
    feedbacks = relationship("Feedback", back_populates="safety_report", cascade="all, delete-orphan")
    weak_signals = relationship("WeakSignal", secondary="report_weak_signals", back_populates="safety_reports")
