from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field
from .ai_analysis import AIAnalysisResponse

class SafetyReportCreate(BaseModel):
    report_type: str = Field(..., description="UNSAFE_ACT, UNSAFE_CONDITION, NEAR_MISS")
    description: str = Field(default="", max_length=999999, description="Detailed description of observation")
    location: str = Field(..., min_length=2, description="Operational location or unit")
    report_date: Optional[str] = Field(None, description="Date of observation (YYYY-MM-DD)")
    additional_context: Optional[str] = None
    incident_latitude: Optional[float] = Field(None, ge=-90.0, le=90.0, description="Incident latitude (-90 to 90)")
    incident_longitude: Optional[float] = Field(None, ge=-180.0, le=180.0, description="Incident longitude (-180 to 180)")
    incident_address: Optional[str] = Field(None, max_length=500, description="Incident address")
    incident_location_name: Optional[str] = Field(None, max_length=200, description="Incident location name")

class SafetyReportListItem(BaseModel):
    id: int
    report_reference: str
    organization_id: str
    user_id: Optional[int] = None
    reporter_name: Optional[str] = None
    reporter_email: Optional[str] = None
    assigned_admin_id: Optional[int] = None
    assigned_admin_name: Optional[str] = None
    report_type: str
    description: str
    original_description: Optional[str] = None
    normalized_description: Optional[str] = None
    location: str
    report_date: str
    additional_context: Optional[str] = None
    incident_latitude: Optional[float] = None
    incident_longitude: Optional[float] = None
    incident_address: Optional[str] = None
    incident_location_name: Optional[str] = None
    analysis_status: str
    sif_precursor_assessment: Optional[str] = None
    identified_hazard: Optional[str] = None
    ai_score: Optional[int] = None
    sif_confidence: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True

class SafetyReportDetail(BaseModel):
    id: int
    report_reference: str
    organization_id: str
    user_id: Optional[int] = None
    reporter_name: Optional[str] = None
    reporter_email: Optional[str] = None
    assigned_admin_id: Optional[int] = None
    assigned_admin_name: Optional[str] = None
    report_type: str
    description: str
    original_description: Optional[str] = None
    normalized_description: Optional[str] = None
    location: str
    report_date: str
    additional_context: Optional[str] = None
    incident_latitude: Optional[float] = None
    incident_longitude: Optional[float] = None
    incident_address: Optional[str] = None
    incident_location_name: Optional[str] = None
    analysis_status: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    ai_analysis: Optional[AIAnalysisResponse] = None


    class Config:
        from_attributes = True
