from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User
from ..schemas.ai_analysis import AIAnalysisResponse
from ..dependencies import get_current_user
from ..services.analysis_service import get_organization_analyses
from ..ai_services.ai_service import analyze_safety_report
from ..ai_services.signal_correlation import detect_latent_weak_signals_in_text

router = APIRouter(prefix="/api/analysis", tags=["AI Analysis"])
ai_analysis_router = APIRouter(prefix="/api/ai-analysis", tags=["AI Analysis"])

class LiveAnalysisRequest(BaseModel):
    report_text: str
    report_name: Optional[str] = None
    report_type: Optional[str] = "Near Miss"
    location: Optional[str] = "Unit 1"
    site: Optional[str] = None
    report_date: Optional[str] = None

def calculate_dynamic_risk(hazard: Optional[str], energy: Optional[str], exposure: Optional[str], barrier_status: str, sif: str, text: str) -> int:
    """
    Computes a grounded 0-100 risk score based on:
    - Actual injury
    - SIF potential (high energy & fatality pathway)
    - Energy source severity
    - Personnel exposure proximity
    - Barrier failure or absence
    - Event consequence potential
    """
    t_low = text.lower()
    
    # 1. SIF potential base weight
    is_sif = sif in ["YES", "SIF"]
    base_score = 45 if is_sif else 15
    
    # 2. Actual Injury presence
    has_no_injury = bool(re.search(r'\b(not injured|no injury|no one was injured|no one injured|avoided injury|without injury)\b', t_low))
    has_injury = bool(re.search(r'\b(injured|injury|burns?|wound|cut|amputation|fracture|heat stroke|hospitaliz|hurt)\b', t_low)) and not has_no_injury
    injury_weight = 20 if has_injury else (5 if has_no_injury else 10)
    
    # 3. Hazard Severity Weight
    sev_weight = 10
    if hazard and hazard != "Insufficient Information":
        h_low = hazard.lower()
        if any(k in h_low for k in ["electrical", "live conductor", "arc flash", "pressure release", "pressurized", "vehicle", "mobile equipment", "suspended load", "dropped object", "fall from height"]):
            sev_weight = 22
        elif any(k in h_low for k in ["fire", "chemical", "confined space", "rotating"]):
            sev_weight = 18
        elif any(k in h_low for k in ["heat", "thermal"]):
            sev_weight = 14
        elif "slip" in h_low or "trip" in h_low:
            sev_weight = 6

    # 4. Energy Vector Weight
    ene_weight = 5
    if energy and energy != "Insufficient Information":
        e_low = energy.lower()
        if any(k in e_low for k in ["electrical", "stored pressure", "pneumatic", "hydraulic", "kinetic", "gravity (high"]):
            ene_weight = 18
        elif any(k in e_low for k in ["thermal", "chemical", "mechanical"]):
            ene_weight = 12
        elif "gravity / kinetic" in e_low:
            ene_weight = 5

    # 5. Exposure Severity Weight
    exp_weight = 5
    if exposure and exposure != "Insufficient Information":
        ex_low = exposure.lower()
        if any(k in ex_low for k in ["line-of-fire", "trajectory", "direct physical proximity", "fall edge", "direct contact"]):
            exp_weight = 15
        elif "slip/fall exposure" in ex_low:
            exp_weight = 5

    # 6. Barrier Status Breakdown
    bar_weight = 5
    if barrier_status in ["BARRIER_FAILED", "Barrier Failed", "Failed"]:
        bar_weight = 15
    elif barrier_status in ["BARRIER_MISSING", "Barrier Missing", "Missing / Not Deployed"]:
        bar_weight = 12
    elif barrier_status in ["BARRIER_PRESENT", "Barrier Intact", "Intact / Functioning"]:
        bar_weight = 0

    # 7. Consequence Escalation
    esc_weight = 0
    if any(k in t_low for k in ["serious injury", "uncontrolled", "high-pressure", "amputation", "life-threatening", "emergency", "crushed"]):
        esc_weight = 12
    elif any(k in t_low for k in ["flame", "smoke", "hiss", "pressure", "leak", "live conductor"]):
        esc_weight = 6

    total = base_score + (injury_weight // 2) + (sev_weight // 2) + (ene_weight // 2) + (exp_weight // 2) + (bar_weight // 2) + esc_weight
    
    # Bound according to severity context
    if is_sif:
        return max(75, min(98, total))
    elif has_injury:
        return max(40, min(70, total))
    else:
        return max(15, min(50, total))

def generate_dynamic_recommendations(hazard: Optional[str], text: str) -> List[str]:
    h_low = (hazard or "").lower()
    t_low = text.lower()
    if "heat" in h_low or "heat" in t_low:
        return [
            "Implement and mandate strict heat-rest schedules with shaded recovery stations.",
            "Provide continuous cool drinking water, electrolyte solutions, and physiological monitoring.",
            "Inspect workspace ventilation, cooling systems, and air-movement blowers.",
            "Conduct training on early symptoms of heat exhaustion and heat stroke."
        ]
    elif "slip" in h_low or "slip" in t_low or "slippery" in t_low or "oily" in t_low:
        return [
            "Clean and degrease the affected walking surface immediately.",
            "Identify and repair the source of fluid leakage from equipment.",
            "Place prominent warning signage and temporary anti-slip barricades.",
            "Verify area condition during routine walkthrough safety inspections."
        ]
    elif "electrical" in h_low or "conductor" in h_low or "arc" in h_low:
        return [
            "De-energize electrical circuit and perform verified Lockout/Tagout (LOTO).",
            "Verify zero voltage using a calibrated test instrument before physical contact.",
            "Repair or replace damaged cable insulation and restore enclosure integrity.",
            "Mandate qualified electrical PPE per NFPA 70E standards."
        ]
    elif "pressure" in h_low or "pipe" in h_low or "gas" in h_low:
        return [
            "Isolate upstream supply valve and depressurize affected line segment.",
            "Establish safety exclusion perimeter until re-pressurization tests pass.",
            "Inspect flange gaskets, relief valves, and fittings for mechanical failure.",
            "Conduct continuous atmospheric and pressure monitoring during remediation."
        ]
    elif "vehicle" in h_low or "forklift" in h_low or "truck" in h_low:
        return [
            "Establish clear physical pedestrian walkways with rigid guardrails.",
            "Mandate high-visibility PPE and verify operating vehicle backup alarms/strobes.",
            "Enforce speed limits and pedestrian right-of-way zones across all operating bays.",
            "Review vehicle movement plans and eliminate blind-corner risks."
        ]
    elif "guard" in h_low or "rotating" in h_low or "machinery" in h_low:
        return [
            "Stop machine immediately and reinstall interlocked safety safeguards.",
            "Implement pre-start physical guard inspection before equipment startup.",
            "Ensure emergency-stop (E-stop) controls are tested and accessible.",
            "Enforce strict policy prohibiting operation of machinery without required guards."
        ]
    elif "height" in h_low or "fall" in h_low or "scaffold" in h_low:
        return [
            "Ensure certified 100% tie-off with inspected harness and dual lanyard.",
            "Install top-rail, mid-rail, and toe-board fall protection barriers.",
            "Red-tag scaffold or ladder until certified inspection sign-off.",
            "Clear walkway of trip hazards and verify secure planking."
        ]
    elif "chemical" in h_low:
        return [
            "Deploy chemical spill kit and contain runoff with compatible absorbent.",
            "Wear appropriate chemical-resistant gloves, goggles, and respiratory PPE.",
            "Review Safety Data Sheet (SDS) for specific neutralization protocols.",
            "Ventilate area and verify integrity of primary chemical containers."
        ]
    else:
        return [
            "Conduct immediate walkdown inspection to identify hazard root cause.",
            "Implement appropriate physical controls and warning demarcation.",
            "Verify area condition during regular shift safety inspections.",
            "Log findings in facility safety maintenance tracking register."
        ]

import re

SAFETY_KEYWORDS_PATTERN = re.compile(
    r'\b(leak\w*|leaked|oil|oily|seep\w*|gas|fire|flame|smoke|spark|explosion|blast|burn|flash|'
    r'heat|hot|stroke|temperature|cooling|cool|sun|overheat\w*|scalding|'
    r'spill\w*|blowout|hazard\w*|unsafe|danger\w*|risk|incident\w*|injur\w*|wound\w*|fatality|fatal|'
    r'precursor\w*|sif|near miss|accident\w*|damage\w*|defect\w*|rupture\w*|burst\w*|crack\w*|collapse\w*|corrosion|'
    r'rust\w*|slip\w*|slippery|slick|trip\w*|fall\w*|fell|dropped|pinch\w*|crush\w*|'
    r'struck|whipping|flying|sharp|cut\w*|electrical|electric|voltage|11kv|415v|wire|arc|cable|'
    r'conductor\w*|insulation|breaker|panel|switch\w*|switchgear|switchboard|transformer|loto|lockout|tagout|isolation|'
    r'isolate\w*|shock|valve|pipe\w*|pipeline|flange|gasket|tank|cylinder|pressure|relief|'
    r'hiss\w*|manifold|vessel|boiler|steam|hydraulic|pneumatic|toxic|chemical|acid|caustic|'
    r'h2s|hydrocarbon|fume\w*|vapor|confined|crane|lift\w*|hoist|rigging|sling|shackle|'
    r'derrick|rig|drill|casing|scaffold\w*|ladder|height|catwalk|grating|deck|'
    r'guard\w*|harness|lanyard|barrier\w*|barricade\w*|interlock|e-stop|alarm|ppe|helmet|'
    r'goggle\w*|glove\w*|respirator|permit|ptw|pump|compressor|turbine|generator|forklift|truck|'
    r'vehicle\w*|trailer|reversing|excavat\w*|trench\w*|housekeeping|puddle|floor|surface|walkway)\b',
    re.IGNORECASE
)

CONVERSATIONAL_PATTERN = re.compile(
    r'\b(beautiful|handsome|gorgeous|cute|pretty|sweet|sexy|'
    r'how are you|who are you|what is your name|love you|hate you|'
    r'good morning|good afternoon|good evening|good night|thank you|thanks|'
    r'you are|tell me a joke|weather|movie|music|hello|hey|yo)\b',
    re.IGNORECASE
)

def is_unrelated_input(text: str) -> bool:
    if not text:
        return True
    cleaned = text.strip()
    if len(cleaned) < 4:
        return True
    if CONVERSATIONAL_PATTERN.search(cleaned) and not SAFETY_KEYWORDS_PATTERN.search(cleaned):
        return True
    if not SAFETY_KEYWORDS_PATTERN.search(cleaned):
        return True
    return False

def handle_live_analysis(payload: LiveAnalysisRequest) -> Dict[str, Any]:
    text = payload.report_text.strip()
    r_type = payload.report_type or "Near Miss"

    # Intercept unrelated, conversational, or non-safety inputs
    if is_unrelated_input(text):
        return {
            "is_unrelated": True,
            "report_name": "Enter Correct Issue",
            "determination_status": "UNRELATED INPUT",
            "classification": "UNRELATED",
            "classification_code": "UNRELATED",
            "sif_status": "NON-SIF",
            "sif_precursor": "NO",
            "sif_potential_score": 0,
            "risk_score": 0,
            "confidence": 0,
            "root_cause": "Not Applicable",
            "detected_hazards": [
                "Observation does not contain recognized industrial safety hazards or equipment context",
                "Zero physical energy vectors or critical barrier failures found in input"
            ],
            "hazard": "Insufficient Information",
            "energy_vector": "None Identified",
            "worker_exposure": "Not Applicable",
            "barrier_status": "Not Applicable (Unrelated Input)",
            "life_saving_rule": "Not Applicable",
            "recommendations": [
                "Enter a correct safety issue describing equipment, location, and conditions",
                "Include specific hazard parameters (e.g. pressure, voltage, chemical, elevation)"
            ],
            "corrective_actions": [
                "Provide frontline coaching on entering actionable safety observations"
            ],
            "explanation": f'The input "{text}" is not recognized as a related operational safety issue. Please enter a correct safety issue describing equipment, location, barrier conditions, or hazardous energy vectors.'
        }
    
    # Run AI pipeline
    raw_result = analyze_safety_report(
        report_type=r_type,
        description=text,
        additional_context=f"Location: {payload.location or 'Unit 1'}"
    )

    hazard = raw_result.get("identified_hazard") or "Insufficient Information"
    energy = raw_result.get("energy_source") or "Insufficient Information"
    exposure = raw_result.get("exposure") or "Insufficient Information"
    barrier_display = raw_result.get("barrier_status") or "Insufficient Information"
    barrier_raw = raw_result.get("barrier_information") or "BARRIER_INSUFFICIENT_INFO"
    
    derived_classification = raw_result.get("classification", "UNSAFE CONDITION")
    derived_code = raw_result.get("classification_code", "UNSAFE_CONDITION")
    derived_root_cause = raw_result.get("root_cause", "Insufficient Information")

    sif_status = raw_result.get("sif_status", "NON-SIF")
    sif_assessment = raw_result.get("sif_precursor_assessment", "NO")
    if sif_status == "SIF" or sif_assessment in ["YES", "SIF"]:
        determination = "CONFIRMED SIF PRECURSOR"
        sif_val = "YES"
        sif_status = "SIF"
    elif sif_assessment == "INSUFFICIENT_INFORMATION":
        determination = "INSUFFICIENT INFORMATION"
        sif_val = "INSUFFICIENT_INFORMATION"
        sif_status = "NON-SIF"
    else:
        determination = "NON-SIF"
        sif_val = "NO"
        sif_status = "NON-SIF"

    risk_score = calculate_dynamic_risk(hazard, energy, exposure, barrier_raw, sif_status, text)
    recommendations = generate_dynamic_recommendations(hazard, text)

    # Dynamic confidence
    words = len(text.split())
    if words < 3 or (hazard == "Insufficient Information" and energy == "Insufficient Information"):
        confidence = "Not Available"
    else:
        # Grounded confidence calculated from completeness and match clarity
        score_base = 84.0
        if hazard != "Insufficient Information": score_base += 5.5
        if energy != "Insufficient Information": score_base += 4.0
        if barrier_display != "Insufficient Information": score_base += 3.0
        confidence = min(96.8, round(score_base, 1))

    detected_items = [
        f"Hazard: {hazard}",
        f"Energy Vector: {energy}",
        f"Worker Exposure: {exposure}",
        f"Barrier Status: {barrier_display}"
    ]

    return {
        "report_name": payload.report_name or f"Safety Observation ({payload.location or 'Unit 1'})",
        "determination_status": determination,
        "classification": derived_classification,
        "classification_code": derived_code,
        "sif_status": sif_status,
        "sif_precursor": sif_val,
        "sif_potential_score": risk_score,
        "risk_score": risk_score,
        "confidence": confidence,
        "hazard": hazard,
        "energy_vector": energy,
        "worker_exposure": exposure,
        "barrier_status": barrier_display,
        "root_cause": derived_root_cause,
        "detected_high_energy_vectors": detected_items,
        "detected_hazards": detected_items,
        "recommended_controls": recommendations,
        "recommended_actions": {
            "immediate_actions": [{"action": a} for a in recommendations[:2]],
            "corrective_actions": [{"action": a} for a in recommendations[2:]]
        },
        "why_identified": {
            "summary": raw_result.get("explanation", "Observation analyzed dynamically based on available report context.")
        },
        "explanation": raw_result.get("explanation", "Observation analyzed dynamically based on available report context."),
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

@router.post("/analyze")
def analyze_live_report_analysis(payload: LiveAnalysisRequest):
    return handle_live_analysis(payload)

@ai_analysis_router.post("/analyze")
def analyze_live_report_ai_analysis(payload: LiveAnalysisRequest):
    return handle_live_analysis(payload)

@router.get("", response_model=List[AIAnalysisResponse])
def list_completed_analyses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves all completed AI analyses belonging to the authenticated organization."""
    return get_organization_analyses(db, current_user.organization_id)
