from datetime import datetime
from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship
from ..database import Base

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String(50), primary_key=True, index=True) # e.g. "id001"
    name = Column(String(200), nullable=False)
    sector = Column(String(100), default="Energy & Industrial Operations")
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    safety_reports = relationship("SafetyReport", back_populates="organization", cascade="all, delete-orphan")
    sif_findings = relationship("SIFFinding", back_populates="organization", cascade="all, delete-orphan")
    weak_signal_reviews = relationship("WeakSignalReview", back_populates="organization", cascade="all, delete-orphan")
    weak_signals = relationship("WeakSignal", back_populates="organization", cascade="all, delete-orphan")
