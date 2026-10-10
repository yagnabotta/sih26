from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from pydantic import BaseModel, Field, model_validator

class AIAnalysisResponse(BaseModel):
    id: int
    report_id: int
    organization_id: str
    analysis_context: Optional[str] = None
    identified_action: Optional[str] = None
    identified_condition: Optional[str] = None
    identified_event: Optional[str] = None
    identified_hazard: Optional[str] = None
    safety_signals: Optional[List[str]] = []
    energy_source: Optional[str] = None
    exposure: Optional[str] = None
    barrier_information: Optional[str] = None
    potential_consequence: Optional[str] = None
    sif_precursor_assessment: str # YES, NO, INSUFFICIENT_INFORMATION
    explanation: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AIAnalysisRequest(BaseModel):
    report_text: str = Field(default="", description="Field description of safety observation")
    report_name: Optional[str] = None
    report_type: Optional[str] = Field(default="NEAR_MISS", description="UNSAFE_ACT, UNSAFE_CONDITION, NEAR_MISS")
    location: Optional[str] = Field(default="Unit 1")
    site: Optional[str] = None
    report_date: Optional[str] = None
    additional_context: Optional[Union[str, List[str]]] = None
    incident_latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    incident_longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    incident_address: Optional[str] = None
    incident_location_name: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_input_fields(cls, values: Any) -> Any:
        if isinstance(values, dict):
            if not values.get("report_text"):
                values["report_text"] = values.get("text") or values.get("description") or ""
            if not values.get("location"):
                values["location"] = values.get("facility_unit") or values.get("site") or values.get("operating_unit") or "Unit 1"
            if not values.get("report_type"):
                values["report_type"] = values.get("classification") or "NEAR_MISS"
            if isinstance(values.get("additional_context"), list):
                values["additional_context"] = f"Safety Factors: {', '.join(str(x) for x in values['additional_context'])}"
        return values

class AIAnalysisExecuteResponse(BaseModel):
    report_id: Optional[int] = None
    report_reference: Optional[str] = None
    description: Optional[str] = None
    report_name: str
    sif_precursor: str  # "YES", "NO", "INSUFFICIENT_INFORMATION"
    determination_status: str
    confidence: Union[float, str, int] = 0
    risk_score: int = 0
    sif_potential_score: int = 0
    classification: Optional[str] = "Near Miss"
    hazard: Optional[str] = None
    detected_hazards: List[str] = []
    detected_high_energy_vectors: List[str] = []
    energy_vector: Optional[str] = None
    energy_source: Optional[str] = None
    worker_exposure: Optional[str] = None
    barrier_status: Optional[str] = None
    life_saving_rule: Optional[str] = None
    iogp_rule: Optional[str] = None
    explainable_reasoning: Optional[str] = None
    explanation: Optional[str] = None
    why_identified: Optional[Dict[str, Any]] = None
    recommended_controls: List[str] = []
    corrective_actions: List[str] = []
    weak_signals: List[Dict[str, Any]] = []
    weak_signal_detected: bool = False
    weak_signal_id: Optional[str] = None
    weak_signal_title: Optional[str] = None
    weak_signal_reason: Optional[str] = None
    related_reports: Optional[List[Dict[str, Any]]] = []
    escalation_path: Optional[str] = None

    # Incident Location Fields
    incident_latitude: Optional[float] = None
    incident_longitude: Optional[float] = None
    incident_address: Optional[str] = None
    incident_location_name: Optional[str] = None
    
    # Hybrid SIF Decision Engine Fields
    ai_classification: Optional[str] = None
    ai_sif_score: Optional[int] = None
    ai_confidence: Optional[Union[float, str]] = None
    rule_based_assessment: Optional[str] = None
    ml_probability: Optional[float] = None
    final_ai_decision: Optional[str] = None
    contributing_features: Optional[List[Dict[str, Any]]] = []

    # Human-In-The-Loop Governance Fields
    human_classification: Optional[str] = None
    human_sif_score: Optional[int] = None
    reviewer_feedback: Optional[str] = None
    review_status: Optional[str] = "Pending Review"

    is_duplicate: bool = False
    is_unrelated: bool = False
    message: Optional[str] = None
    created_at: Optional[datetime] = None
