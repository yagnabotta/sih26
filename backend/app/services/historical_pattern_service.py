"""
Historical Pattern Analysis & Dynamic Weak-Signal Detection Service
-------------------------------------------------------------------
Implements multi-dimensional evidence correlation between the CURRENT REPORT
and all previously stored relevant safety records in the database.

Core Governance Rules:
1. Triggered dynamically on every single report analysis and bulk CSV ingestion.
2. Compares current report against actual stored historical reports for the organization.
3. Does NOT claim a weak signal on single/isolated observations (Strict Rule: >= 2 records required).
4. Uses 'Narrative Similarity — Jaccard Token Similarity' for transparent lexical comparison.
5. Multi-evidence correlation: Narrative similarity + Spatial/Unit co-location + Hazard taxonomy + Barrier issue + Energy vector.
6. Prevents duplicate weak signals: Updates existing WeakSignal entities when recurring patterns intensify.
7. Formulates conservative 'Potential escalation paths' without claiming certainty (never 'fire will occur').
8. Strictly maintains bi-directional relationships: SafetyReport <-> WeakSignal.
"""

import re
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, date
from sqlalchemy.orm import Session

from ..models.safety_report import SafetyReport
from ..models.ai_analysis import AIAnalysis
from ..models.weak_signal import WeakSignal
from ..ai_services.similarity_service import compute_similarity


# ==============================================================================
# CONFIGURABLE & DOCUMENTED MULTI-DIMENSIONAL EVIDENCE WEIGHTS (Sum to 1.0)
# ==============================================================================
WEIGHT_NARRATIVE_SIMILARITY: float = 0.25   # Narrative Similarity — Jaccard Token Similarity
WEIGHT_HAZARD_MATCH: float = 0.25          # Industrial hazard taxonomy & family classification
WEIGHT_LOCATION_MATCH: float = 0.20        # Spatial / unit co-location
WEIGHT_ACTIVITY_MATCH: float = 0.10        # Operational task / activity correlation
WEIGHT_BARRIER_MATCH: float = 0.10         # Barrier deficiency or degradation alignment
WEIGHT_TEMPORAL_RECURRENCE: float = 0.10   # Observation recurrence within surveillance window

# Calibrated Decision Threshold
# Requires composite evidence >= 0.50 AND total recurrence >= 2 records
PATTERN_EVIDENCE_THRESHOLD: float = 0.50
MIN_RECURRENCE_COUNT: int = 2
ANALYSIS_WINDOW_DAYS: int = 180

# A weak signal needs repeated evidence of the same safety deficiency. Narrative
# overlap and co-location alone are correlation clues, not signal conditions.
MIN_SAFETY_EVIDENCE_DIMENSIONS: int = 2


def normalize_unit(val: Optional[str]) -> str:
    """Normalizes unit and location strings for robust spatial matching."""
    if not val:
        return "unknown"
    s = str(val).strip().lower()
    m = re.search(r'unit\s*[-_#]?\s*0*(\d+)', s)
    if m:
        return f"unit-{int(m.group(1))}"
    if "front door" in s or "entrance" in s or "entry" in s:
        return "entrance-area"
    if "compressor" in s:
        return "compressor-bay"
    if "substation" in s or "switchgear" in s or "electrical room" in s:
        return "electrical-substation"
    if "walkway" in s or "corridor" in s or "aisle" in s:
        return "transit-walkway"
    return re.sub(r'[^a-z0-9]', '', s) or "general-area"


def extract_hazard_family(hazard_name: Optional[str], text: str) -> str:
    """Classifies the primary hazard into its industrial safety family."""
    combined = f"{hazard_name or ''} {text or ''}".lower()
    
    if any(k in combined for k in ["housekeeping", "tools on floor", "boxes stacked", "stacked improperly", "clutter", "wooden box", "box", "boxes", "pallet", "materials on floor"]):
        return "HOUSEKEEPING_STORAGE"
    if any(k in combined for k in ["slip", "slippery", "slick", "trip", "wet floor", "water on floor", "water puddle"]):
        return "SLIP_TRIP_FALL"
    if any(k in combined for k in ["water is leaking near", "water leaking near electrical", "water leakage & electrical", "panel water"]):
        return "WATER_ELECTRICAL_COMPOUND"
    if any(k in combined for k in ["gas", "leak", "hiss", "flange", "propane", "lpg", "methane", "h2s"]):
        return "GAS_LEAKAGE"
    if any(k in combined for k in ["electrical", "electric", "cable", "switchgear", "panel", "voltage", "arcing", "breaker", "shock"]):
        return "ELECTRICAL_HAZARD"
    if any(k in combined for k in ["guard", "machine guard", "nip point", "conveyor", "rotating parts", "pinch point"]):
        return "MACHINE_GUARDING"
    if any(k in combined for k in ["forklift", "truck", "pedestrian", "vehicle", "near miss with pedestrian"]):
        return "VEHICLE_PEDESTRIAN"
    if any(k in combined for k in ["exit", "emergency exit", "fire exit", "egress", "door blocked"]):
        return "EMERGENCY_EGRESS"
    if any(k in combined for k in ["helmet", "hard hat", "ppe", "safety glasses", "goggles", "respirator", "head protection"]):
        return "PPE_NON_COMPLIANCE"

    if any(k in combined for k in ["height", "scaffold", "ladder", "roof edge", "fall from height"]):
        return "WORKING_AT_HEIGHT"
    if any(k in combined for k in ["confined space", "tank entry", "vessel entry", "entering the vessel", "entered the vessel", "inside the vessel"]):
        return "CONFINED_SPACE"

    if any(k in combined for k in ["fire", "hot work", "welding", "open flame", "sparks"]):
        return "HOT_WORK_FIRE"
    if any(k in combined for k in ["pressure", "pressurized", "psi", "hydraulic", "hydrotest", "blowout"]):
        return "PRESSURE_HAZARD"
    
    return "OPERATIONAL_DEVIATION"


def generate_potential_escalation_path(hazard_family: str, hazard_name: str, location: str) -> str:
    """
    Formulates conservative potential escalation pathways without claiming certainty.
    Strictly uses: 'Potential escalation path', NOT 'Fire will occur'.
    """
    paths = {
        "GAS_LEAKAGE": "Repeated gas release → vapor accumulation in congested area → possible ignition source exposure → potential flash fire or vapor cloud overpressure event.",
        "SLIP_TRIP_FALL": "Repeated liquid/water accumulation on walking surface → loss of foot traction → possible fall from same level → potential musculoskeletal sprain or contusion injury.",
        "WATER_ELECTRICAL_COMPOUND": "Water ingress adjacent to energized busbars → moisture degradation of conductor insulation → possible phase-to-ground flashover → potential electrical arc blast, equipment damage, or electrical shock.",
        "ELECTRICAL_HAZARD": "Repeated electrical terminal looseness or exposed cabling → conductor thermal stress or physical wear → possible insulation breakdown → potential arc flash fault, fire, or worker electrocution.",
        "MACHINE_GUARDING": "Repeated operation without physical safeguard in place → personnel exposure to rotating machinery → possible mechanical nip-point entrapment → potential crushing or serious hand injury.",
        "VEHICLE_PEDESTRIAN": "Repeated close-proximity mobile vehicle movement near workers → blind-spot line-of-sight obstruction → possible vehicle trajectory deviation → potential pedestrian struck-by collision.",
        "EMERGENCY_EGRESS": "Repeated obstruction of designated egress door → impeded egress flow during abnormal event → possible evacuation delay → potential personnel exposure to smoke or hazardous conditions.",
        "PPE_NON_COMPLIANCE": "Repeated work without mandatory head protection → overhead activity in operating sector → possible dropped object deflection → potential serious traumatic impact injury.",
        "HOUSEKEEPING_STORAGE": "Repeated unattended tooling and unorganized storage on deck → pathway obstruction → possible tripping event → potential worker fall against structural steelwork.",
        "WORKING_AT_HEIGHT": "Repeated elevated work without positive fall arrest anchorage → plank displacement or loss of balance → possible fall from elevation → potential severe fall trauma.",
        "HOT_WORK_FIRE": "Repeated open spark discharge near combustible materials → thermal ember migration → possible smoldering ignition of residues → potential localized flash fire.",
        "PRESSURE_HAZARD": "Repeated pressure anomalies on fittings → cyclic mechanical fatigue on coupling → possible seal blowout → potential high-pressure fluid jet injection or equipment damage."
    }
    return paths.get(
        hazard_family,
        f"Recurring operational deviation regarding {hazard_name or 'hazard'} in {location} → repeated exposure to baseline condition → possible degradation of secondary barriers → potential escalation if unrectified."
    )


def build_weak_signal_title(hazard_family: str, hazard_name: str, unit: str) -> str:
    """Builds a professional, standardized industrial weak signal title."""
    titles = {
        "GAS_LEAKAGE": f"Recurring Flammable Gas Micro-Leakage & Containment Degradation ({unit})",
        "SLIP_TRIP_FALL": f"Recurring Surface Slip/Trip Hazard & Walking Floor Slickness ({unit})",
        "WATER_ELECTRICAL_COMPOUND": f"Recurring Water Leakage Adjacent to Energized Electrical Gear ({unit})",
        "ELECTRICAL_HAZARD": f"Recurring Electrical Distribution & Conductor Integrity Issues ({unit})",
        "MACHINE_GUARDING": f"Recurring Mechanical Safeguard & Interlock Barrier Deficiency ({unit})",
        "VEHICLE_PEDESTRIAN": f"Recurring Mobile Equipment & Pedestrian Proximity Near Misses ({unit})",
        "EMERGENCY_EGRESS": f"Recurring Emergency Egress Pathway & Fire Door Obstruction ({unit})",
        "PPE_NON_COMPLIANCE": f"Recurring Personal Protective Equipment (PPE) Non-Compliance Patterns ({unit})",
        "HOUSEKEEPING_STORAGE": f"Recurring Housekeeping & Unsecured Tooling Trip Hazards ({unit})",
        "WORKING_AT_HEIGHT": f"Recurring Elevated Work & Fall Protection Anchorage Gaps ({unit})",
        "HOT_WORK_FIRE": f"Recurring Hot Work Sparks & Combustible Proximity Observations ({unit})",
        "PRESSURE_HAZARD": f"Recurring Pressurized Line & Hydraulic Connection Vibrations ({unit})"
    }
    return titles.get(hazard_family, f"Recurring Safety Pattern: {hazard_name or 'Operational Finding'} ({unit})")


def detect_and_update_weak_signals(
    db: Session,
    org_id: str,
    current_report: SafetyReport,
    raw_nlp_result: Dict[str, Any],
    min_jaccard_threshold: float = 0.14
) -> Dict[str, Any]:
    """
    Executes historical comparison and weak signal detection strictly using
    actual historical database records for the organization.
    """
    current_text = f"{current_report.description} {current_report.additional_context or ''}".strip()
    current_unit = current_report.location or "Unit 1"
    norm_current_unit = normalize_unit(current_unit)
    
    current_hazard = (
        raw_nlp_result.get("identified_hazard") or 
        (current_report.ai_analysis.identified_hazard if current_report.ai_analysis else None) or 
        "Operational Observation"
    )
    current_family = extract_hazard_family(current_hazard, current_text)
    current_energy = raw_nlp_result.get("energy_source") or "Not identified / Insufficient Information"
    current_barrier = raw_nlp_result.get("barrier_information") or "BARRIER_INSUFFICIENT_INFO"
    current_activity = raw_nlp_result.get("identified_action") or ""

    # 1. Retrieve prior safety reports for this organization (excluding current report)
    prior_reports = db.query(SafetyReport).filter(
        SafetyReport.organization_id == org_id,
        SafetyReport.id != current_report.id
    ).order_by(SafetyReport.id.desc()).all()

    if not prior_reports:
        return {
            "weak_signal_detected": False,
            "weak_signal_id": None,
            "weak_signal_title": None,
            "weak_signal_reason": "No emerging weak signals detected.",
            "historical_comparison": "Historical comparison unavailable — insufficient historical data.",
            "escalation_path": None,
            "related_reports": [],
            "weak_signals": []
        }

    # 2. Historical Candidate Search (Pre-filtering)
    # Avoid comparing against completely unrelated records unnecessarily
    candidate_reports: List[SafetyReport] = []
    for prev in prior_reports:
        prev_text = f"{prev.description} {prev.additional_context or ''}".strip()
        norm_prev_unit = normalize_unit(prev.location)
        prev_hazard = prev.ai_analysis.identified_hazard if prev.ai_analysis else ""
        prev_family = extract_hazard_family(prev_hazard, prev_text)

        # Quick candidate inclusion criteria:
        # Same unit, same hazard family, common energy keyword, or basic lexical token overlap
        is_candidate = (
            norm_current_unit == norm_prev_unit or
            (current_family == prev_family and current_family != "OPERATIONAL_DEVIATION") or
            any(w in prev_text.lower() for w in current_text.lower().split() if len(w) > 4)
        )
        if is_candidate:
            candidate_reports.append(prev)

    if not candidate_reports:
        return {
            "weak_signal_detected": False,
            "weak_signal_id": None,
            "weak_signal_title": None,
            "weak_signal_reason": "No emerging weak signals detected.",
            "historical_comparison": "Historical comparison unavailable — insufficient historical data.",
            "escalation_path": None,
            "related_reports": [],
            "weak_signals": []
        }


    # 3. Transparent Multi-Dimensional Evidence Scoring
    matching_reports_info: List[Dict[str, Any]] = []
    matching_report_models: List[SafetyReport] = []
    evidence_scores: List[float] = []
    jaccard_scores: List[float] = []

    for prev in candidate_reports:
        prev_text = f"{prev.description} {prev.additional_context or ''}".strip()
        norm_prev_unit = normalize_unit(prev.location)
        prev_hazard = prev.ai_analysis.identified_hazard if prev.ai_analysis else ""
        prev_family = extract_hazard_family(prev_hazard, prev_text)
        prev_energy = (prev.ai_analysis.energy_source if prev.ai_analysis else "") or ""
        prev_barrier = (prev.ai_analysis.barrier_information if prev.ai_analysis else "") or ""
        prev_activity = (prev.ai_analysis.identified_action if prev.ai_analysis else "") or ""

        # Dimension A: Narrative Similarity — Jaccard Token Similarity (0.0 to 1.0)
        jaccard_sim = compute_similarity(current_text, prev_text)

        # Dimension B: Hazard Taxonomy Match
        if current_family == prev_family and current_family != "OPERATIONAL_DEVIATION":
            hazard_score = 1.0
        elif current_hazard and prev_hazard and any(w in prev_hazard.lower() for w in current_hazard.lower().split() if len(w) > 3):
            hazard_score = 0.5
        else:
            hazard_score = 0.0

        # Dimension C: Location & Spatial Match
        if norm_current_unit == norm_prev_unit and norm_current_unit != "unknown":
            location_score = 1.0
        elif (norm_current_unit in norm_prev_unit) or (norm_prev_unit in norm_current_unit):
            location_score = 0.5
        else:
            location_score = 0.0

        # Dimension D: Activity Match
        if current_activity and prev_activity and any(w in prev_activity.lower() for w in current_activity.lower().split() if len(w) > 3):
            activity_score = 1.0
        else:
            activity_score = 0.0

        energy_score = 1.0 if (
            current_energy != "Not identified / Insufficient Information" and
            prev_energy and current_energy.lower() == prev_energy.lower()
        ) else 0.0

        # Dimension E: Barrier Issue Match
        if ("failed" in current_barrier.lower() or "missing" in current_barrier.lower()) and \
           ("failed" in prev_barrier.lower() or "missing" in prev_barrier.lower()):
            barrier_score = 1.0
        elif current_barrier != "BARRIER_INSUFFICIENT_INFO" and current_barrier == prev_barrier:
            barrier_score = 0.75
        else:
            barrier_score = 0.0

        # Dimension F: Temporal Recurrence within Surveillance Window
        temporal_score = 0.5
        try:
            cur_date = datetime.strptime(str(current_report.report_date)[:10], "%Y-%m-%d").date()
            prev_date = datetime.strptime(str(prev.report_date)[:10], "%Y-%m-%d").date()
            diff_days = abs((cur_date - prev_date).days)
            if diff_days <= 30:
                temporal_score = 1.0
            elif diff_days <= 90:
                temporal_score = 0.8
            elif diff_days <= ANALYSIS_WINDOW_DAYS:
                temporal_score = 0.5
            else:
                temporal_score = 0.2
        except Exception:
            temporal_score = 0.5

        # Composite Evidence Score (Weighted Sum)
        composite_evidence = (
            (jaccard_sim * WEIGHT_NARRATIVE_SIMILARITY) +
            (hazard_score * WEIGHT_HAZARD_MATCH) +
            (location_score * WEIGHT_LOCATION_MATCH) +
            (activity_score * WEIGHT_ACTIVITY_MATCH) +
            (barrier_score * WEIGHT_BARRIER_MATCH) +
            (temporal_score * WEIGHT_TEMPORAL_RECURRENCE)
        )

        # A weak signal represents recurrence of one meaningful safety issue.
        # Do not merge different hazards merely because their words or locations
        # overlap (for example, a gas leak and an ignition-source observation).
        shared_safety_family = (
            current_family == prev_family and current_family != "OPERATIONAL_DEVIATION"
        )
        corroborating_dimensions = sum([
            location_score > 0,
            barrier_score > 0,
            energy_score > 0,
            activity_score > 0,
            temporal_score >= 0.5,
        ])
        is_match = (
            shared_safety_family and
            temporal_score >= 0.5 and
            corroborating_dimensions >= MIN_SAFETY_EVIDENCE_DIMENSIONS and
            composite_evidence >= PATTERN_EVIDENCE_THRESHOLD
        )
        reasons = []
        if is_match:
            reasons.append(
                f"Recurring {current_family.replace('_', ' ').title()} with "
                f"{corroborating_dimensions} corroborating safety evidence dimensions"
            )

        if is_match:
            matching_report_models.append(prev)
            evidence_scores.append(composite_evidence)
            jaccard_scores.append(jaccard_sim)
            matching_reports_info.append({
                "report_id": prev.id,
                "report_reference": prev.report_reference,
                "report_type": prev.report_type,
                "location": prev.location,
                "report_date": prev.report_date,
                "short_description": prev.description[:100],
                "similarity_score": round(jaccard_sim, 4),
                "similarity_method": "Narrative Similarity — Jaccard Token Similarity",
                "evidence_score": round(composite_evidence, 4),
                "hazard_match": "Yes" if hazard_score > 0 else "No",
                "location_match": "Yes" if location_score > 0 else "No",
                "barrier_match": "Yes" if barrier_score > 0 else "No",
                "energy_match": "Yes" if energy_score > 0 else "No",
                "activity_match": "Yes" if activity_score > 0 else "No",
                "match_reason": "; ".join(reasons)
            })

    # 4. Strict Recurrence Gate: Total count >= 2 records required (Current + >= 1 Prior)
    if not matching_report_models:
        return {
            "weak_signal_detected": False,
            "weak_signal_id": None,
            "weak_signal_title": None,
            "weak_signal_reason": "No emerging weak signals detected.",
            "historical_comparison": "Historical comparison unavailable — insufficient historical data.",
            "escalation_path": None,
            "related_reports": [],
            "weak_signals": []
        }


    # Recurring pattern detected!
    recurrence_count = 1 + len(matching_report_models)
    escalation_path = generate_potential_escalation_path(current_family, current_hazard, current_unit)
    signal_title = build_weak_signal_title(current_family, current_hazard, current_unit)
    
    avg_jaccard = round(sum(jaccard_scores) / len(jaccard_scores), 4) if jaccard_scores else 0.0
    max_jaccard = round(max(jaccard_scores), 4) if jaccard_scores else 0.0
    avg_evidence = round(sum(evidence_scores) / len(evidence_scores), 4) if evidence_scores else 0.5

    detection_reason = (
        f"{recurrence_count} related observations with similar {current_family.replace('_', ' ').lower()} "
        f"conditions were found in {current_unit} within the configured analysis window "
        f"({current_report.report_reference} + {len(matching_report_models)} historical reports: "
        f"{', '.join([r.report_reference for r in matching_report_models[:3]])})."
    )

    # Structured Evidence Artifacts
    similarity_evidence = {
        "method": "Narrative Similarity — Jaccard Token Similarity",
        "average_similarity": avg_jaccard,
        "max_similarity": max_jaccard,
        "composite_evidence_score": avg_evidence,
        "evidence_threshold": PATTERN_EVIDENCE_THRESHOLD
    }
    spatial_evidence = {
        "unit": current_unit,
        "normalized_unit": norm_current_unit,
        "same_unit_matches": sum(1 for m in matching_report_models if normalize_unit(m.location) == norm_current_unit),
        "total_historical_matches": len(matching_report_models)
    }
    temporal_evidence = {
        "analysis_window_days": ANALYSIS_WINDOW_DAYS,
        "recurrence_count": recurrence_count,
        "supporting_dates": [str(m.report_date)[:10] for m in matching_report_models] + [str(current_report.report_date)[:10]]
    }

    # 5. Duplicate Weak Signal Prevention: Look for existing matching WeakSignal in DB
    existing_signal = db.query(WeakSignal).filter(
        WeakSignal.organization_id == org_id,
        WeakSignal.detected_hazard == current_family,
        WeakSignal.unit == norm_current_unit
    ).first()

    all_related_ids = [r.id for r in matching_report_models] + [current_report.id]
    base_risk_score = 82 if recurrence_count == 2 else min(96, 82 + (recurrence_count - 2) * 5)
    risk_level = "High" if base_risk_score >= 90 else "Medium"

    if existing_signal:
        # UPDATE existing weak signal (prevent duplicate WS-001, WS-002)
        existing_signal.recurrence_count = max(existing_signal.recurrence_count + 1, recurrence_count)
        existing_signal.last_detected_at = datetime.utcnow()
        existing_signal.current_report_id = current_report.id
        existing_signal.detection_reason = detection_reason
        existing_signal.escalation_path = escalation_path
        existing_signal.risk_score = base_risk_score
        existing_signal.risk_level = risk_level
        existing_signal.similarity_evidence = similarity_evidence
        existing_signal.spatial_evidence = spatial_evidence
        existing_signal.temporal_evidence = temporal_evidence
        
        # Merge related report IDs
        curr_ids = list(existing_signal.related_report_ids or [])
        for r_id in all_related_ids:
            if r_id not in curr_ids:
                curr_ids.append(r_id)
        existing_signal.related_report_ids = curr_ids

        # Ensure relationships in association table
        if current_report not in existing_signal.safety_reports:
            existing_signal.safety_reports.append(current_report)
        for rep in matching_report_models:
            if rep not in existing_signal.safety_reports:
                existing_signal.safety_reports.append(rep)

        db.commit()
        db.refresh(existing_signal)
        active_signal = existing_signal

    else:
        # CREATE new weak signal
        signal_count = db.query(WeakSignal).filter(WeakSignal.organization_id == org_id).count()
        new_signal_id = f"WS-{signal_count + 1:03d}"

        active_signal = WeakSignal(
            signal_id=new_signal_id,
            organization_id=org_id,
            signal_type="RECURRING_HAZARD",
            title=signal_title,
            category=current_family.replace("_", " ").title(),
            description=f"Automated multi-record surveillance detected recurring {current_family.replace('_', ' ').lower()} conditions in {current_unit}.",
            detected_hazard=current_family,
            location=current_unit,
            unit=norm_current_unit,
            activity=current_activity or "Routine Operations",
            energy_vector=current_energy,
            barrier_issue=current_barrier,
            recurrence_count=recurrence_count,
            risk_score=base_risk_score,
            risk_level=risk_level,
            first_detected_at=datetime.utcnow(),
            last_detected_at=datetime.utcnow(),
            current_report_id=current_report.id,
            related_report_ids=all_related_ids,
            detection_reason=detection_reason,
            escalation_path=escalation_path,
            recommended_action=f"Inspect and remediate recurring {current_hazard.lower()} conditions across {current_unit}; verify physical controls.",
            similarity_evidence=similarity_evidence,
            spatial_evidence=spatial_evidence,
            temporal_evidence=temporal_evidence,
            status="Under Review"
        )
        db.add(active_signal)
        db.flush()

        # Link relationships in association table
        active_signal.safety_reports.append(current_report)
        for rep in matching_report_models:
            active_signal.safety_reports.append(rep)

        db.commit()
        db.refresh(active_signal)

    # 6. Format structured Weak Signal output for instant API and UI display
    formatted_source_reports = [
        {
            "report_id": current_report.report_reference,
            "report_type": current_report.report_type,
            "date_submitted": current_report.report_date,
            "short_description": current_report.description,
            "unit": current_report.location,
            "excerpt": current_report.description
        }
    ]
    for rep in matching_report_models:
        formatted_source_reports.append({
            "report_id": rep.report_reference,
            "report_type": rep.report_type,
            "date_submitted": rep.report_date,
            "short_description": rep.description,
            "unit": rep.location,
            "excerpt": rep.description
        })

    structured_signal = {
        "id": active_signal.id,
        "signal_id": active_signal.signal_id,
        "title": active_signal.title,
        "category": active_signal.category,
        "cluster_detected": True,
        "relationship": f"Recurring {active_signal.category} ({current_unit})",
        "potential_consequence": active_signal.escalation_path,
        "combined_risk": active_signal.risk_level.upper(),
        "correlation_score": active_signal.risk_score,
        "risk_score": active_signal.risk_score,
        "risk_level": active_signal.risk_level,
        "reason": active_signal.detection_reason,
        "recommended_action": active_signal.recommended_action,
        "first_detected_date": active_signal.first_detected_at.strftime("%Y-%m-%d"),
        "source": "Automated Multi-Record Surveillance",
        "potential_sif_precursor": active_signal.escalation_path,
        "why_identified": active_signal.detection_reason,
        "energy_source": active_signal.energy_vector,
        "barrier_status": active_signal.barrier_issue,
        "review_status": active_signal.status,
        "reviewer_notes": active_signal.reviewer_notes or "Under review by Operational Safety Team.",
        "recurrence_count": active_signal.recurrence_count,
        "similarity_evidence": active_signal.similarity_evidence,
        "spatial_evidence": active_signal.spatial_evidence,
        "temporal_evidence": active_signal.temporal_evidence,
        "source_reports": formatted_source_reports,
        "signals": [
            {
                "signal_num": idx + 1,
                "report_id": r["report_id"],
                "description": r["short_description"],
                "individual_risk": "MEDIUM",
                "location": r["unit"],
                "date": r["date_submitted"]
            }
            for idx, r in enumerate(formatted_source_reports)
        ],
        "progression_steps": [
            {"step": "First Anomaly", "trend": "Increasing", "status": f"Initial observation logged in {current_unit}"},
            {"step": "Recurrent Detection", "trend": "Increasing", "status": f"{recurrence_count} recurring reports identified without permanent elimination"},
            {"step": "Precursor Escalation", "trend": "Stable", "status": active_signal.escalation_path}
        ]
    }

    current_report_summary = {
        "report_id": current_report.id,
        "report_reference": current_report.report_reference,
        "report_type": current_report.report_type,
        "location": current_report.location,
        "report_date": current_report.report_date,
        "short_description": current_report.description[:100],
        "similarity_score": 1.0,
        "similarity_method": "Active Incident Trigger",
        "match_reason": "Current active safety report triggering surveillance correlation"
    }
    all_related_reports = [current_report_summary] + matching_reports_info

    return {
        "weak_signal_detected": True,
        "weak_signal_id": active_signal.signal_id,
        "weak_signal_title": active_signal.title,
        "weak_signal_reason": active_signal.detection_reason,
        "escalation_path": active_signal.escalation_path,
        "related_reports": all_related_reports,
        "weak_signals": [structured_signal]
    }

