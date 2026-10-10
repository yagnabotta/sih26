from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Table, JSON
from sqlalchemy.orm import relationship
from ..database import Base

# Many-to-Many Association Table linking Safety Reports to Weak Signals
report_weak_signals = Table(
    "report_weak_signals",
    Base.metadata,
    Column("report_id", Integer, ForeignKey("safety_reports.id", ondelete="CASCADE"), primary_key=True),
    Column("weak_signal_id", Integer, ForeignKey("weak_signals.id", ondelete="CASCADE"), primary_key=True)
)

class WeakSignal(Base):
    __tablename__ = "weak_signals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    signal_id = Column(String(50), index=True, nullable=False)  # e.g. "WS-001"
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    
    signal_type = Column(String(100), default="RECURRING_HAZARD", nullable=False)
    title = Column(String(255), nullable=False)
    category = Column(String(100), default="Process Safety Precursor", nullable=False)
    description = Column(Text, nullable=True)
    detected_hazard = Column(String(200), nullable=True)
    location = Column(String(200), nullable=True)
    unit = Column(String(100), nullable=True)
    activity = Column(String(200), nullable=True)
    energy_vector = Column(String(200), nullable=True)
    barrier_issue = Column(String(200), nullable=True)
    
    recurrence_count = Column(Integer, default=1, nullable=False)
    risk_score = Column(Integer, default=80, nullable=False)
    risk_level = Column(String(50), default="Medium", nullable=False)
    
    first_detected_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_detected_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    current_report_id = Column(Integer, ForeignKey("safety_reports.id", ondelete="SET NULL"), nullable=True)
    related_report_ids = Column(JSON, default=list, nullable=False)  # List of matching Report IDs/References
    
    detection_reason = Column(Text, nullable=True)
    escalation_path = Column(Text, nullable=True)
    recommended_action = Column(Text, nullable=True)
    
    # Traceable evidence structures
    similarity_evidence = Column(JSON, default=dict, nullable=True)
    temporal_evidence = Column(JSON, default=dict, nullable=True)
    spatial_evidence = Column(JSON, default=dict, nullable=True)
    
    status = Column(String(50), default="Under Review", nullable=False)  # Under Review, Escalated, Mitigated, Completed
    reviewer_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="weak_signals")
    safety_reports = relationship("SafetyReport", secondary=report_weak_signals, back_populates="weak_signals")
    current_report = relationship("SafetyReport", foreign_keys=[current_report_id])


class WeakSignalReview(Base):
    __tablename__ = "weak_signal_reviews"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    signal_id = Column(String(50), nullable=False, index=True)
    status = Column(String(50), default="Under Review", nullable=False)
    decision = Column(String(100), nullable=True)  # Confirmed, Not Relevant / Incorrect, Relevant but Low Importance
    reviewer = Column(String(100), nullable=True)  # Reviewer email/name
    reviewer_notes = Column(Text, nullable=True)    # Feedback/rationale
    reviewed_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("Organization", back_populates="weak_signal_reviews")
