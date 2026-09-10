import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from ..database import Base

class SIFPrecursorEnum(str, enum.Enum):
    YES = "YES"
    NO = "NO"
    INSUFFICIENT_INFORMATION = "INSUFFICIENT_INFORMATION"

class AIAnalysis(Base):
    __tablename__ = "ai_analyses"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    report_id = Column(Integer, ForeignKey("safety_reports.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    
    analysis_context = Column(Text, nullable=True)
    identified_action = Column(Text, nullable=True)
    identified_condition = Column(Text, nullable=True)
    identified_event = Column(Text, nullable=True)
    identified_hazard = Column(Text, nullable=True)
    safety_signals = Column(JSON, nullable=True) # List of detected strings
    energy_source = Column(Text, nullable=True)
    exposure = Column(Text, nullable=True)
    barrier_information = Column(Text, nullable=True) # BARRIER_PRESENT, BARRIER_MISSING, BARRIER_FAILED, BARRIER_UNKNOWN
    potential_consequence = Column(Text, nullable=True)
    sif_precursor_assessment = Column(String(50), nullable=False) # YES, NO, INSUFFICIENT_INFORMATION
    sif_status = Column(String(50), nullable=True) # SIF, NON-SIF
    classification = Column(String(50), nullable=True) # NEAR MISS, UNSAFE ACT, UNSAFE CONDITION
    root_cause = Column(Text, nullable=True)
    risk_score = Column(Integer, nullable=True)
    explanation = Column(Text, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    safety_report = relationship("SafetyReport", back_populates="ai_analysis")
