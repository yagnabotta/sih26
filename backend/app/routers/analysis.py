import re
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User
from ..schemas.ai_analysis import AIAnalysisResponse, AIAnalysisRequest, AIAnalysisExecuteResponse
from ..dependencies import get_current_user
from ..services.analysis_service import get_organization_analyses, execute_direct_analysis
from ..ai_services.ai_service import analyze_safety_report
from ..ai_services.signal_correlation import detect_latent_weak_signals_in_text
from ..ai_services.safety_validity import classify_safety_observation_validity
from ..ai_services.context_analyzer import classify_incident_category
from ..ai_services.voice_translation import translate_to_safety_english

router = APIRouter(prefix="/api/analysis", tags=["AI Analysis"])
ai_analysis_router = APIRouter(prefix="/api/ai-analysis", tags=["AI Analysis"])

class LiveAnalysisRequest(BaseModel):
    report_text: Optional[str] = Field(default="", max_length=999999)
    description: Optional[str] = Field(default="", max_length=999999)
    report_name: Optional[str] = None
    report_type: Optional[str] = None
    classification: Optional[str] = None
    location: Optional[str] = None
    operating_unit: Optional[str] = None
    site: Optional[str] = None
    report_date: Optional[str] = None
    checklist: Optional[List[str]] = None
    selected_checklist: Optional[List[str]] = None
    additional_context: Optional[str] = None
    legacy_scoring: Optional[bool] = False

def generate_dynamic_recommendations(hazard: Optional[str], text: str) -> List[str]:
    h_low = (hazard or "").lower()
    t_low = text.lower()
    comb = f"{h_low} {t_low}"
    
    controls: List[str] = []
    
    # 1. High-Energy Electrical Priority
    if any(k in comb for k in ["electrical", "arc flash", "cable", "voltage", "panel", "busbar"]):
        controls.append("De-energize electrical circuit and perform positive Lockout/Tagout (LOTO).")
        controls.append("Verify zero-voltage state with calibrated test instrument before contact.")
        
    # 2. Machine & Equipment Failure Priority
    if any(k in comb for k in ["equipment failure", "machine", "mechanical", "guard", "malfunction", "breakdown"]):
        controls.append("Isolate equipment power and tag out-of-service until certified maintenance inspection.")
        controls.append("Inspect physical machine safeguards, interlocks, and mechanical components.")
        
    # 3. Fire, Hot Work & Combustible Gas Priority
    if any(k in comb for k in ["fire", "blast", "ignition", "hot work", "gas", "flammable", "leak", "hydrocarbon"]):
        controls.append("Immediately trigger Emergency Shutdown (ESD) or line isolation valve.")
        controls.append("Perform continuous atmospheric gas testing (0% LEL) and station a certified fire watch.")

    # 4. Confined Space Entry Priority
    if any(k in comb for k in ["confined", "tank entry", "vessel entry"]):
        controls.append("Stop entry immediately; conduct multi-gas testing (0% LEL, 19.5-23.5% O2, 0 ppm toxic).")
        controls.append("Verify Confined Space Entry Permit and assign dedicated standby sentry.")

    # 5. Fall from Height & Scaffolding
    if any(k in comb for k in ["height", "fall", "scaffold", "ladder"]):
        controls.append("Ensure certified 100% tie-off with inspected harness and lanyard.")
        controls.append("Install top-rail, mid-rail, and toe-board fall protection barriers.")

    # 6. Suspended Load & Line of Fire
    if any(k in comb for k in ["suspended load", "load", "crane", "rigging", "dropped", "line of fire", "line-of-fire", "struck"]):
        controls.append("Barricade drop zone and prohibit personnel from walking under suspended loads.")
        controls.append("Verify personnel maintain safe clearance outside the line of fire.")

    # 7. Surface Slip / Trip / Housekeeping
    if any(k in comb for k in ["slip", "trip", "slippery", "housekeeping", "walkway", "floor"]):
        controls.append("Inspect and rectify the slippery surface; clean and dry affected area with absorbent.")
        controls.append("Provide warning signage and prevent pedestrian exposure until corrected.")

    # 8. Emergency Egress & Blocked Exits
    if any(k in comb for k in ["exit", "egress", "blocked"]):
        controls.append("Immediately clear designated emergency exit and evacuation route.")

    # Fallback if no specific matched
    if not controls:
        controls = [
            "Conduct immediate walkdown inspection to identify hazard root cause.",
            "Implement appropriate physical controls and warning demarcation.",
            "Verify area condition during regular shift safety inspections.",
            "Log findings in facility safety maintenance tracking register."
        ]
        
    # Deduplicate while preserving order and return top 4 items
    seen = set()
    unique_controls = []
    for c in controls:
        if c not in seen:
            seen.add(c)
            unique_controls.append(c)
            
    return unique_controls[:4]


def handle_live_analysis(payload: LiveAnalysisRequest) -> Dict[str, Any]:
    raw_text = (payload.report_text or payload.description or "").strip()
    
    if len(raw_text) > 999999:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Field description exceeds maximum allowed length of 999,999 characters."
        )
    
    # Check for checklist items
    checklist_items = payload.checklist or payload.selected_checklist or []
    if not checklist_items and payload.additional_context and "Safety Factors:" in payload.additional_context:
        ctx_factors = payload.additional_context.split("Safety Factors:")[-1].strip()
        checklist_items = [f.strip() for f in re.split(r'[,;]\s*', ctx_factors) if f.strip()]

    has_text = bool(raw_text)
    has_checklist = bool(checklist_items and len(checklist_items) > 0)

    # Mutual exclusivity: both checklist and description is not allowed!
    if has_text and has_checklist:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dual submission not allowed: Please provide either a detailed description OR select checklist factors, but not both."
        )

    if not has_text and not has_checklist:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide either a detailed description OR select at least one checklist factor."
        )

    if has_checklist and not has_text:
        text = f"Safety Factors: {', '.join(checklist_items)}"
        cat_info = classify_incident_category(" ".join(checklist_items))
        r_type = payload.report_type or payload.classification or cat_info["label"]
    else:
        text = raw_text
        # Strictly respect user's manual selection when entering description; do not assume
        r_type = payload.report_type or payload.classification or "Near Miss"
        cat_info = None

    # Step 0: Auto-translate multilingual text (Telugu/Hindi/Transliterated) to standard English
    if text and (re.search(r"[\u0c00-\u0c7f\u0900-\u097f]", text) or any(k in text.lower() for k in ["avtundi", "vasthundi", "ho raha hai", "lag gayi", "nikal rahi", "pagilipoyindi", "fat gaya"])):
        trans_res = translate_to_safety_english(text)
        if trans_res.get("translated_text"):
            text = trans_res["translated_text"]
            payload.report_text = text

    # Multi-Stage Step 1: Safety Observation Validity Layer
    validity = classify_safety_observation_validity(text)

    if validity["is_unrelated"]:
        return {
            "is_unrelated": True,
            "report_name": "Unrelated Input",
            "determination_status": "UNRELATED INPUT",
            "sif_precursor": "NO",
            "sif_potential_score": 0,
            "confidence": 0,
            "detected_hazards": [
                "Observation does not contain a recognized workplace safety hazard or condition"
            ],
            "energy_vector": "None Identified",
            "worker_exposure": "Not Applicable",
            "barrier_status": "Not Applicable (Unrelated Input)",
            "life_saving_rule": "Not Applicable",
            "recommendations": [
                "Please describe a safety hazard, unsafe condition, unsafe act, or near-miss observation."
            ],
            "corrective_actions": [
                "Enter an operational safety observation with details of conditions or hazards."
            ],
            "explanation": validity["explanation"],
            "why_identified": {"summary": validity["explanation"]},
            "identified_classification": cat_info
        }

    # Run Multi-Stage AI NLP Pipeline
    raw_result = analyze_safety_report(
        report_type=r_type,
        description=text,
        additional_context=f"Location: {payload.location or 'Not Specified'}",
        legacy_scoring=payload.legacy_scoring or False
    )

    hazard = raw_result.get("identified_hazard") or validity.get("primary_category") or "Insufficient Information"
    energy = raw_result.get("energy_source") or "Not identified / Insufficient Information"
    exposure = raw_result.get("exposure") or "Possible"
    barrier_raw = raw_result.get("barrier_information") or "BARRIER_INSUFFICIENT_INFO"

    if barrier_raw == "BARRIER_FAILED":
        barrier_display = "Failed"
    elif barrier_raw == "BARRIER_MISSING":
        barrier_display = "Missing / Not Deployed"
    elif barrier_raw == "BARRIER_BYPASSED":
        barrier_display = "Bypassed / Overridden"
    elif barrier_raw == "BARRIER_COMPROMISED":
        barrier_display = "Compromised / Degraded"
    elif barrier_raw == "BARRIER_PRESENT":
        barrier_display = "Intact / Functioning"
    else:
        barrier_display = "Insufficient Information"

    sif_val = raw_result.get("sif_precursor_assessment", "NO")
    final_decision = raw_result.get("final_ai_decision", "NON-SIF OBSERVATION")
    risk_score = raw_result.get("ai_sif_score", 20)
    confidence = raw_result.get("ai_confidence", 85.0)

    # Dynamic Location: from extracted location or payload or Unknown
    extracted_loc = raw_result.get("extracted_entities", {}).get("location")
    if extracted_loc and extracted_loc != "Unknown":
        report_location = extracted_loc
    elif payload.location and payload.location.strip():
        report_location = payload.location.strip()
    else:
        report_location = "Unknown"

    recommendations = generate_dynamic_recommendations(hazard, text)

    detected_items = [
        f"Hazard: {hazard}",
        f"Location: {report_location}",
        f"Energy Vector: {energy}",
        f"Worker Exposure: {exposure}",
        f"Barrier Status: {barrier_display}"
    ]

    lsr_obj = raw_result.get("life_saving_rule")
    lsr_display = lsr_obj.get("rule_name") if isinstance(lsr_obj, dict) else (
        "Line of Fire (LSR-04)" if sif_val == "YES" else "General Workplace Housekeeping Standards"
    )

    return {
        "report_name": payload.report_name or f"{hazard} ({report_location})",
        "determination_status": final_decision,
        "sif_precursor": sif_val,
        "sif_potential_score": risk_score,
        "confidence": confidence,
        "hazard": hazard,
        "location": report_location,
        "energy_vector": energy,
        "worker_exposure": exposure,
        "barrier_status": barrier_display,
        "detected_high_energy_vectors": [energy] if energy not in ["Not identified / Insufficient Information", "None Identified"] else [],
        "detected_hazards": detected_items,
        "recommended_controls": recommendations,
        "recommended_actions": {
            "immediate_actions": [{"action": a} for a in recommendations[:2]],
            "corrective_actions": [{"action": a} for a in recommendations[2:]]
        },
        "why_identified": {
            "summary": raw_result.get("explanation", "Observation evaluated through Multi-Stage Safety NLP Engine.")
        },
        "explanation": raw_result.get("explanation", "Observation evaluated through Multi-Stage Safety NLP Engine."),
        "life_saving_rule": lsr_display,
        "ai_classification": raw_result.get("ai_classification", "Non-SIF-potential"),
        "ai_sif_score": risk_score,
        "ai_confidence": confidence,
        "rule_based_assessment": raw_result.get("rule_based_assessment", "NO"),
        "ml_probability": raw_result.get("ml_probability", 0.0),
        "final_ai_decision": final_decision,
        "contributing_features": raw_result.get("contributing_features", []),
        "score_breakdown": raw_result.get("score_breakdown"),
        "override_rule_applied": raw_result.get("override_rule_applied"),
        "human_classification": None,
        "human_sif_score": None,
        "reviewer_feedback": None,
        "review_status": "Pending Review",
        "weak_signals": [
            {
                "signal_id": f"WS-LIVE-{i+1:02d}",
                "title": f"{ls.get('category', 'Process Safety')} Latent Deviation",
                "category": ls.get("category", "Process Safety Precursor"),
                "signal": ls.get("signal", "Latent operational irregularity"),
                "energy_source": ls.get("energy", energy),
                "barrier_status": ls.get("barrier", barrier_display),
                "risk_score": risk_score,
                "potential_sif_precursor": f"Cumulative escalation toward {hazard}"
            }
            for i, ls in enumerate(detect_latent_weak_signals_in_text(text))
        ]
    }


@router.post("/analyze", response_model=AIAnalysisExecuteResponse)
def analyze_safety_observation(
    payload: AIAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Canonical direct AI Analysis endpoint:
    Uses the Safety Observation Validity Layer to accurately accept legitimate
    operational and environmental safety reports, executes the multi-stage AI pipeline,
    and returns dynamic structured results.
    Accepts checklist-only, description-only, or combined observations.
    """
    text = (payload.report_text or "").strip()
    if len(text) > 999999:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Field description exceeds maximum allowed length of 999,999 characters."
        )

    # Safely extract checklist_items from payload or additional_context
    checklist_items: List[str] = list(payload.checklist or payload.selected_checklist or [])
    if not checklist_items and payload.additional_context:
        ctx_val = payload.additional_context if isinstance(payload.additional_context, str) else ", ".join(str(x) for x in payload.additional_context)
        factors_text = ctx_val.replace("Safety Factors:", "").strip()
        checklist_items = [f.strip() for f in re.split(r'[,;]\s*', factors_text) if f.strip()]

    # Backend validation rule:
    # Mutual exclusivity: both checklist and description is not allowed!
    if text and len(checklist_items) > 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Dual submission not allowed: Please provide either a detailed description OR select checklist factors, but not both."
        )

    # INVALID only if: description is empty AND checklist_items is empty
    if not text and len(checklist_items) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please provide either a detailed description OR select at least one checklist factor."
        )

    # Step 0: Auto-translate multilingual text (Telugu/Hindi/Transliterated) to standard English
    if text and (re.search(r"[\u0c00-\u0c7f\u0900-\u097f]", text) or any(k in text.lower() for k in ["avtundi", "vasthundi", "ho raha hai", "lag gayi", "nikal rahi", "pagilipoyindi", "fat gaya"])):
        trans_res = translate_to_safety_english(text)
        if trans_res.get("translated_text"):
            text = trans_res["translated_text"]
            payload.report_text = text
            if hasattr(payload, "description") and payload.description:
                payload.description = text

    # Multi-Stage Step 1: Safety Observation Validity Layer
    validity_input = f"{text} {payload.additional_context or ''}".strip()
    validity = classify_safety_observation_validity(validity_input)

    if validity["is_unrelated"]:
        return AIAnalysisExecuteResponse(
            report_name="Unrelated Input",
            determination_status="UNRELATED INPUT",
            sif_precursor="NO",
            confidence=0,
            risk_score=0,
            sif_potential_score=0,
            classification=payload.report_type or "Near Miss",
            detected_hazards=[
                "Observation does not contain a recognized workplace safety hazard or condition"
            ],
            energy_source="None Identified",
            barrier_status="Not Applicable (Unrelated Input)",
            life_saving_rule="Not Applicable",
            iogp_rule="Not Applicable",
            explainable_reasoning=validity["explanation"],
            explanation=validity["explanation"],
            why_identified={"summary": validity["explanation"]},
            recommended_controls=[
                "Please describe a safety hazard, unsafe condition, unsafe act, or near-miss observation."
            ],
            corrective_actions=[
                "Enter an operational safety observation with details of conditions or hazards."
            ],
            is_unrelated=True,
            message=validity["explanation"]
        )

    try:
        return execute_direct_analysis(db, current_user, payload)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI analysis execution failed: {str(e)}"
        )


@ai_analysis_router.post("/analyze", response_model=AIAnalysisExecuteResponse)
def analyze_safety_observation_alias(
    payload: AIAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Compatibility alias routing to canonical analysis handler."""
    return analyze_safety_observation(payload, current_user, db)


@router.get("", response_model=List[AIAnalysisResponse])
def list_completed_analyses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves all completed AI analyses belonging to the authenticated organization."""
    return get_organization_analyses(db, current_user.organization_id)


class VoiceTranslationRequest(BaseModel):
    text: str
    source_language: Optional[str] = "auto"
    target_language: Optional[str] = "en"
    isolate_target_speaker: Optional[bool] = True


@router.post("/translate")
def translate_safety_voice_input(payload: VoiceTranslationRequest):
    """
    Step 2 & 3 of Voice Pipeline:
    Isolates target speaker, reduces machinery noise and background voices,
    and translates Telugu, Hindi, or English speech transcripts into verified English.
    """
    return translate_to_safety_english(payload.text, payload.source_language)
