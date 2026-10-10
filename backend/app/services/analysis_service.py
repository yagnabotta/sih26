import re
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from sqlalchemy.orm import Session
from ..models.safety_report import SafetyReport, AnalysisStatusEnum
from ..models.ai_analysis import AIAnalysis
from ..models.user import User
from ..ai_services.ai_service import analyze_safety_report
from ..schemas.ai_analysis import AIAnalysisResponse, AIAnalysisRequest, AIAnalysisExecuteResponse
from ..schemas.safety_report import SafetyReportCreate
from .report_service import find_duplicate_report, create_report
from .historical_pattern_service import detect_and_update_weak_signals

FREE_TEXT_FALLBACK = "No free-text observation provided."

def extract_checklist_items(additional_context: Optional[Union[str, List[str]]]) -> List[str]:
    """Extract the user-selected safety factor labels without inventing content."""
    if isinstance(additional_context, list):
        return [str(item).strip() for item in additional_context if str(item).strip()]
    if not isinstance(additional_context, str) or not additional_context.strip():
        return []
    if "Safety Factors:" not in additional_context:
        return []
    factors_text = additional_context.split("Safety Factors:", 1)[1].strip()
    return [item.strip(" -\t") for item in re.split(r'[,;\n]\s*', factors_text) if item.strip(" -\t")]

def format_submitted_observation(description: str, checklist_items: List[str]) -> str:
    """Return the real submitted observation, including structured selections."""
    free_text = (description or "").strip()
    if free_text == FREE_TEXT_FALLBACK:
        free_text = ""
    selected_text = "\n".join(f"- {item}" for item in checklist_items)
    if free_text and checklist_items:
        return f"{free_text}\n\nSelected Safety Factors:\n{selected_text}"
    return free_text or selected_text or FREE_TEXT_FALLBACK

def execute_ai_analysis(db: Session, report: SafetyReport) -> AIAnalysis:
    """
    Executes AI analysis for a safety report and persists explainable structured results.
    """
    report.analysis_status = AnalysisStatusEnum.PROCESSING.value
    db.commit()

    try:
        # Run 10-step AI pipeline on normalized description (falling back to original)
        desc_to_analyze = report.normalized_description or report.description or ""
        checklist_items = extract_checklist_items(report.additional_context)
        if checklist_items:
            submitted_observation = format_submitted_observation(report.description, checklist_items)
            if submitted_observation != FREE_TEXT_FALLBACK:
                report.description = submitted_observation

        desc_to_analyze = report.description or ""
        if (not desc_to_analyze or desc_to_analyze == FREE_TEXT_FALLBACK) and checklist_items:
            structured_factors = "\n".join(f"- {item}" for item in checklist_items)
            desc_to_analyze = (
                "Safety Observation:\n"
                f"{FREE_TEXT_FALLBACK}\n\n"
                "Selected Safety Factors:\n"
                f"{structured_factors}\n\n"
                f"Classification:\n{report.report_type.replace('_', ' ').title()}\n\n"
                f"Operating Unit:\n{report.location}"
            )

        raw_result = analyze_safety_report(
            report_type=report.report_type,
            description=desc_to_analyze,
            additional_context=report.additional_context
        )


        # Check if existing analysis exists for re-runs
        analysis = db.query(AIAnalysis).filter(AIAnalysis.report_id == report.id).first()
        if not analysis:
            analysis = AIAnalysis(
                report_id=report.id,
                organization_id=report.organization_id,
                analysis_context=raw_result["analysis_context"],
                identified_action=raw_result["identified_action"],
                identified_condition=raw_result["identified_condition"],
                identified_event=raw_result["identified_event"],
                identified_hazard=raw_result["identified_hazard"],
                safety_signals=raw_result["safety_signals"],
                energy_source=raw_result["energy_source"],
                exposure=raw_result["exposure"],
                barrier_information=raw_result["barrier_information"],
                potential_consequence=raw_result["potential_consequence"],
                sif_precursor_assessment=raw_result["sif_precursor_assessment"],
                explanation=raw_result["explanation"]
            )
            db.add(analysis)
        else:
            analysis.analysis_context = raw_result["analysis_context"]
            analysis.identified_action = raw_result["identified_action"]
            analysis.identified_condition = raw_result["identified_condition"]
            analysis.identified_event = raw_result["identified_event"]
            analysis.identified_hazard = raw_result["identified_hazard"]
            analysis.safety_signals = raw_result["safety_signals"]
            analysis.energy_source = raw_result["energy_source"]
            analysis.exposure = raw_result["exposure"]
            analysis.barrier_information = raw_result["barrier_information"]
            analysis.potential_consequence = raw_result["potential_consequence"]
            analysis.sif_precursor_assessment = raw_result["sif_precursor_assessment"]
            analysis.explanation = raw_result["explanation"]

        report.analysis_status = AnalysisStatusEnum.COMPLETED.value
        db.commit()
        db.refresh(analysis)
        return analysis

    except Exception as e:
        report.analysis_status = AnalysisStatusEnum.FAILED.value
        db.commit()
        raise e

def get_organization_analyses(db: Session, org_id: str):
    """Retrieves all completed AI analyses for the organization."""
    return db.query(AIAnalysis).filter(AIAnalysis.organization_id == org_id).all()

def execute_direct_analysis(
    db: Session,
    current_user: User,
    request: AIAnalysisRequest
) -> AIAnalysisExecuteResponse:
    """
    Executes the current main 10-step AI NLP engine on an observation,
    enforces duplicate prevention via Issue #11 composite key,
    persists the SafetyReport and its AIAnalysis in SQLite if new,
    and returns the rich structured response.
    """
    description = (request.report_text or "").strip()
    location = (request.location or "Unit 1").strip()
    norm_type = (request.report_type or "NEAR_MISS").strip().upper().replace("-", "_").replace(" ", "_")
    if norm_type not in ["UNSAFE_ACT", "UNSAFE_CONDITION", "NEAR_MISS"]:
        norm_type = "NEAR_MISS"
    report_date = (request.report_date or datetime.utcnow().strftime("%Y-%m-%d")).strip()

    # Explicitly extract and initialize selected checklist safety factors at the top
    checklist_items: List[str] = []
    if request.additional_context:
        ctx_val = request.additional_context if isinstance(request.additional_context, str) else ", ".join(str(x) for x in request.additional_context)
        factors_text = ctx_val.replace("Safety Factors:", "").strip()
        checklist_items = [f.strip() for f in re.split(r'[,;]\s*', factors_text) if f.strip()]

    # Format analysis input based on whether description and/or checklist factors exist
    if not description and checklist_items:
        structured_factors = "\n".join(f"- {item}" for item in checklist_items)
        structured_context = (
            "Safety Observation:\n"
            "No free-text observation provided.\n\n"
            "Selected Safety Factors:\n"
            f"{structured_factors}\n\n"
            f"Classification:\n{norm_type.replace('_', ' ').title()}\n\n"
            f"Operating Unit:\n{location}"
        )
        desc_to_analyze = structured_context
        description_for_report = format_submitted_observation(description, checklist_items)
    else:
        desc_to_analyze = description
        description_for_report = format_submitted_observation(description, checklist_items)

    # 1. Run the real current main 10-step AI NLP engine
    raw_result = analyze_safety_report(
        report_type=norm_type,
        description=desc_to_analyze,
        additional_context=request.additional_context
    )

    # Dynamic Location Extraction: prioritize explicit request location, then text extracted location
    extracted_loc = raw_result.get("extracted_entities", {}).get("location")
    invalid_locs = ["unknown", "insufficient information", "not identified", "none", "n/a", ""]
    
    if request.location and request.location.strip() and request.location.strip().lower() not in invalid_locs:
        location = request.location.strip()
    elif extracted_loc and extracted_loc.strip() and extracted_loc.strip().lower() not in invalid_locs:
        location = extracted_loc.strip()
    else:
        location = (request.location or "Unit 1").strip()

    # 2. Extract Life-Saving Rules
    lsr_info = raw_result.get("life_saving_rule")
    if isinstance(lsr_info, dict) and lsr_info.get("rule_name"):
        iogp_rule = f"{lsr_info['rule_name']} ({lsr_info.get('rule_code', 'LSR')})"
    else:
        iogp_rule = None

    # 3. Determine SIF classification & dynamic risk metrics (strictly from pipeline)
    sif_status = raw_result.get("sif_precursor_assessment", "NO")
    is_sif = sif_status == "YES"
    determination_status = raw_result.get("final_ai_decision", "CONFIRMED SIF PRECURSOR" if is_sif else "NON-SIF OBSERVATION")
    risk_score = raw_result.get("ai_sif_score", 25 if not is_sif else 85)
    confidence = raw_result.get("ai_confidence", 85.0)

    # 4. Extract hazards & energy vectors
    hazards: List[str] = []
    all_hazards_detected = raw_result.get("all_detected_hazards", [])
    if all_hazards_detected:
        for hz in all_hazards_detected:
            if hz not in hazards:
                hazards.append(hz)
    elif raw_result.get("identified_hazard"):
        hazards.append(raw_result["identified_hazard"])

    # Include explicit checklist factors not already represented in detected hazards
    for item in checklist_items:
        item_clean = item.strip()
        item_words = set(re.findall(r'\w+', item_clean.lower())) - {"not", "followed", "hazard", "issue"}
        already_covered = any(
            item_clean.lower() in h.lower() or 
            (len(item_words) > 0 and any(w in h.lower() for w in item_words))
            for h in hazards
        )
        if not already_covered:
            hazards.append(f"Safety Factor: {item_clean}")

    if not hazards:
        if is_sif:
            hazards.append("High Potential Energy Vector")
        elif sif_status == "INSUFFICIENT_INFORMATION":
            hazards.append("Indeterminate Hazard / Insufficient Information")
        else:
            hazards.append("General Operational Observation")

    high_energy_vectors: List[str] = []
    all_energy_srcs = raw_result.get("all_energy_sources", [])
    if all_energy_srcs:
        for esrc in all_energy_srcs:
            if esrc not in high_energy_vectors:
                high_energy_vectors.append(esrc)
    else:
        energy_source_raw = raw_result.get("energy_source")
        if energy_source_raw and energy_source_raw not in ["Not identified / Insufficient Information", "None Identified", "UNKNOWN"]:
            high_energy_vectors.append(energy_source_raw)

    # 5. Barrier status description
    barrier_eval = raw_result.get("barrier_information")
    if barrier_eval == "BARRIER_MISSING":
        barrier_status_desc = "Missing / Not Deployed"
    elif barrier_eval == "BARRIER_FAILED":
        barrier_status_desc = "Failed / Mechanical Rupture"
    elif barrier_eval == "BARRIER_BYPASSED":
        barrier_status_desc = "Bypassed / Overridden"
    elif barrier_eval == "BARRIER_COMPROMISED":
        barrier_status_desc = "Compromised / Degraded"
    elif barrier_eval == "BARRIER_PRESENT":
        barrier_status_desc = "Intact / Functioning"
    else:
        barrier_status_desc = "Insufficient Information"

    # 6. Actionable recommendations & CAPA (Prioritized by SIF Precursor Severity)
    h_lower = (raw_result.get("identified_hazard") or "").lower()
    t_lower = desc_to_analyze.lower()
    c_lower = " ".join(checklist_items).lower()
    comb_lower = f"{t_lower} {h_lower} {c_lower}"

    if "loto" in comb_lower or "lockout" in comb_lower or "isolation" in comb_lower:
        recommended_controls = [
            "Immediately stop work and perform positive Lockout/Tagout (LOTO) energy isolation.",
            "Verify zero-energy state with calibrated instruments before entering work zone.",
            "Apply individual safety padlocks and danger tags to all energy isolation points.",
            "Review Isolation Certificate and verify try-step with authorized supervisor."
        ]
        corrective_actions = [
            "Conduct safety stand-down on Life-Saving Rule: Energy Isolation (LSR-01).",
            "Audit facility energy isolation and LOTO verification field procedures."
        ]
    elif "confined" in comb_lower or "tank entry" in comb_lower or "vessel entry" in comb_lower:
        recommended_controls = [
            "Stop entry immediately; conduct atmospheric gas testing (0% LEL, 19.5-23.5% O2, 0 ppm toxic).",
            "Verify valid Confined Space Entry Permit and assign dedicated standby sentry.",
            "Maintain continuous forced ventilation and calibrated multi-gas monitor.",
            "Confirm emergency rescue plan and retrieval tripod/harness are positioned at entrance."
        ]
        corrective_actions = [
            "Audit confined space atmospheric testing protocols and authorization permits.",
            "Conduct mandatory retraining on Confined Space Entry procedures."
        ]
    elif "high pressure" in comb_lower or "high-pressure" in comb_lower or "pressurized" in comb_lower:
        recommended_controls = [
            "Isolate upstream pressure supply and depressurize system to 0 PSI before inspection.",
            "Barricade pressure exclusion zone and position personnel outside the line of fire.",
            "Inspect high-pressure whip-checks, hammer unions, and manifold connections.",
            "Verify pressure bleed-off valves are locked open and tagged."
        ]
        corrective_actions = [
            "Conduct pressure systems integrity audit and inspect line securement devices.",
            "Brief operations personnel on high-pressure line-of-fire hazard controls."
        ]
    elif "dropped" in comb_lower or "line of fire" in comb_lower or "suspended load" in comb_lower or "struck" in comb_lower:
        recommended_controls = [
            "Barricade drop zone and prohibit personnel from walking under dynamic trajectories.",
            "Inspect tool tethering, secondary retention nets, and overhead securement.",
            "Ensure clear communication and spotter assignment during overhead/moving tasks.",
            "Verify personnel maintain safe clearance outside the line of fire."
        ]
        corrective_actions = [
            "Audit drop-prevention controls and tool lanyards across working areas.",
            "Conduct safety stand-down on line-of-fire hazard recognition."
        ]
    elif "water" in comb_lower and ("electrical" in comb_lower or "panel" in comb_lower):
        recommended_controls = [
            "De-energize electrical panel immediately and establish barrier cordon.",
            "Identify and isolate the source of water leakage.",
            "Inspect panel enclosure for water ingress and perform insulation resistance test.",
            "Verify dry, safe conditions before restoring electrical power."
        ]
        corrective_actions = [
            "Permanent pipe/roof repair to eliminate water path above electrical gear.",
            "Recertify electrical insulation integrity before re-energizing."
        ]
    elif "gas" in comb_lower or "hydrocarbon" in comb_lower or "leak" in comb_lower:
        recommended_controls = [
            "Isolate upstream supply valve and depressurize affected line segment.",
            "Evacuate area and perform continuous atmospheric gas testing (0% LEL).",
            "Inspect flange gasket, valve seals, and fittings for degradation.",
            "Establish safety exclusion perimeter until re-pressurization tests pass."
        ]
        corrective_actions = [
            "Replace degraded flange gasket/valve seal and verify with leak detection.",
            "Log containment inspection in process safety integrity tracking register."
        ]
    elif "slip" in comb_lower or "slippery" in comb_lower:
        recommended_controls = [
            "Inspect and rectify the slippery surface, identify the source of moisture/oil.",
            "Provide warning signage and prevent pedestrian exposure until corrected.",
            "Clean and dry the affected area immediately with compatible absorbent.",
            "Verify the area during routine post-shift safety inspection."
        ]
        corrective_actions = [
            "Rectify drainage defect or fluid source causing surface slickness.",
            "Log routine maintenance inspection in CMMS ledger."
        ]
    elif "exit" in comb_lower or "egress" in comb_lower or "blocked" in comb_lower:
        recommended_controls = [
            "Immediately clear designated emergency exit and evacuation route.",
            "Remove all stored obstructions, boxes, and materials from doorway.",
            "Conduct walkdown of all emergency egress pathways in facility.",
            "Brief area shift personnel on maintaining 100% unobstructed exit access."
        ]
        corrective_actions = [
            "Mark floor with yellow hatching 'Keep Clear At All Times'.",
            "Audit facility egress compliance during weekly safety committee walk."
        ]
    elif "tools" in comb_lower or "housekeeping" in comb_lower or "stacked" in comb_lower:
        recommended_controls = [
            "Clear unattended tools and materials from walkway immediately.",
            "Restack materials and boxes within designated weight and height limits.",
            "Conduct routine housekeeping walkdown across working area.",
            "Ensure tools are stored in designated tool racks or containers."
        ]
        corrective_actions = [
            "Implement 5S housekeeping standard across working bays.",
            "Verify aisle clearance during end-of-shift handover."
        ]
    elif "ppe" in comb_lower or "safety glasses" in comb_lower or "helmet" in comb_lower or "goggles" in comb_lower:
        recommended_controls = [
            "Provide required safety equipment / PPE immediately before worker continues task.",
            "Brief frontline team on mandatory 100% PPE compliance in operational areas.",
            "Verify all personnel on shift are equipped with inspected PPE.",
            "Document observation in shift safety briefing log."
        ]
        corrective_actions = [
            "Conduct shift safety stand-down on Life-Saving Rule personal accountability.",
            "Ensure frontline supervisor enforces pre-task PPE checks."
        ]
    elif is_sif:
        recommended_controls = [
            "Immediately trigger Emergency Shutdown (ESD) or line isolation valve",
            "Evacuate personnel upwind and establish a 50-meter safety exclusion zone",
            "Conduct continuous multi-gas / zero-energy verification before re-entry",
            "Depressurize and lock-out / tag-out all upstream energy sources"
        ]
        corrective_actions = [
            "Issue Stop-Work Notice and stand down operating shift team",
            "Dispatch Field HSE Superintendent for barrier integrity inspection",
            "Log high-priority CAPA item in corporate safety intelligence system"
        ]
    else:
        recommended_controls = [
            "Conduct immediate walkdown inspection to identify hazard root cause",
            "Implement appropriate physical controls and warning demarcation",
            "Verify area condition during regular shift safety inspections",
            "Log findings in facility safety maintenance tracking register"
        ]
        corrective_actions = [
            "Log routine maintenance inspection in CMMS ledger",
            "Review standard operating procedures with shift crew"
        ]

    # Report Name: prioritize actual AI-identified hazard
    if raw_result.get("identified_hazard") and raw_result["identified_hazard"] not in ["Insufficient Information", "General Operational Observation"]:
        report_name = raw_result["identified_hazard"]
    elif request.report_name and request.report_name.strip() and not request.report_name.strip().startswith("Safety Observation"):
        report_name = request.report_name.strip()
    elif checklist_items:
        report_name = f"{' & '.join(checklist_items[:2])} Observation ({location})"
    else:
        report_name = f"{norm_type.replace('_', ' ').title()} Observation ({location})"


    # 7. Check for duplicate using Issue #11 composite duplicate key
    extra_context = request.additional_context

    report_create = SafetyReportCreate(
        report_type=norm_type,
        description=description_for_report,
        location=location,
        report_date=report_date,
        additional_context=extra_context,
        incident_latitude=request.incident_latitude,
        incident_longitude=request.incident_longitude,
        incident_address=request.incident_address,
        incident_location_name=request.incident_location_name
    )


    duplicate = find_duplicate_report(db, current_user.organization_id, report_create)
    is_duplicate = False
    if duplicate:
        report = duplicate
        is_duplicate = True
        message = f"Observation matches existing report {report.report_reference}. Reusing existing analysis."
        if request.incident_latitude is not None and report.incident_latitude is None:
            report.incident_latitude = request.incident_latitude
            report.incident_longitude = request.incident_longitude
            report.incident_address = request.incident_address
            report.incident_location_name = request.incident_location_name
            db.commit()
        # Ensure analysis exists for duplicate
        analysis = db.query(AIAnalysis).filter(AIAnalysis.report_id == report.id).first()
        if not analysis:
            analysis = execute_ai_analysis(db, report)
    else:
        # Create and persist new report in SQLite database
        report = create_report(db, report_create, current_user)
        analysis = execute_ai_analysis(db, report)
        message = f"Report created and persisted as {report.report_reference}."

    db.refresh(report)

    # Dynamic Historical Comparison & Weak Signal Detection
    try:
        ws_res = detect_and_update_weak_signals(
            db=db,
            org_id=current_user.organization_id,
            current_report=report,
            raw_nlp_result=raw_result
        )
    except Exception as ws_err:
        ws_res = {
            "weak_signal_detected": False,
            "weak_signal_id": None,
            "weak_signal_title": None,
            "weak_signal_reason": f"Historical pattern analysis unavailable: {str(ws_err)}",
            "escalation_path": None,
            "related_reports": [],
            "weak_signals": []
        }

    explanation_text = raw_result.get("explanation") or ""
    if is_sif:
        default_energy = "High-Pressure Hydrocarbon Vector"
    elif sif_status == "INSUFFICIENT_INFORMATION":
        default_energy = "Indeterminate Energy Vector (Insufficient Data)"
    else:
        default_energy = "Low Kinetic / Surface Hydrostatic Energy (< 100 J)"
    energy_val = raw_result.get("energy_source") or default_energy

    if is_sif:
        default_lsr = "Line of Fire (LSR-04) & Energy Isolation (LSR-01)"
    elif sif_status == "INSUFFICIENT_INFORMATION":
        default_lsr = "Not Applicable (Insufficient Information)"
    else:
        default_lsr = "General Workplace Housekeeping Standards"

    return AIAnalysisExecuteResponse(
        report_id=report.id,
        report_reference=report.report_reference,
        description=report.description,
        report_name=report_name,
        sif_precursor=sif_status if sif_status in ["YES", "NO", "INSUFFICIENT_INFORMATION"] else "NO",
        determination_status=determination_status,
        confidence=confidence,
        risk_score=risk_score,
        sif_potential_score=risk_score,
        classification=norm_type,
        hazard=raw_result.get("identified_hazard"),
        detected_hazards=hazards,
        detected_high_energy_vectors=high_energy_vectors,
        energy_vector=energy_val,
        energy_source=energy_val,
        worker_exposure=raw_result.get("exposure"),
        barrier_status=barrier_status_desc,
        life_saving_rule=iogp_rule or default_lsr,
        iogp_rule=iogp_rule or default_lsr,
        explanation=explanation_text,
        why_identified={
            "summary": explanation_text,
            "evidence_points": [
                f"Hazard: {raw_result.get('identified_hazard') or 'General operational deviation'}",
                f"Energy Vector: {energy_val}",
                f"Worker Exposure: {raw_result.get('exposure') or 'None detected'}",
                f"Barrier Condition: {barrier_status_desc}",
                f"Life-Saving Rule: {iogp_rule or default_lsr}",
                *( [f"Evaluated Safety Factors: {', '.join(checklist_items)}"] if checklist_items else [] )
            ],
            "evidence_spans": [
                {
                    "field": "energy_source",
                    "value": energy_val,
                    "confidence": confidence,
                    "source": "Operational Narrative Text"
                },
                {
                    "field": "barrier_status",
                    "value": barrier_status_desc,
                    "confidence": confidence,
                    "source": "Operational Narrative Text"
                },
                *( [
                    {
                        "field": "safety_factors",
                        "value": ", ".join(checklist_items),
                        "confidence": confidence,
                        "source": "Checklist Selections"
                    }
                ] if checklist_items else [] )
            ]
        },
        recommended_controls=recommended_controls,
        corrective_actions=corrective_actions,

        weak_signals=ws_res.get("weak_signals", []),
        weak_signal_detected=ws_res.get("weak_signal_detected", False),
        weak_signal_id=ws_res.get("weak_signal_id"),
        weak_signal_title=ws_res.get("weak_signal_title"),
        weak_signal_reason=ws_res.get("weak_signal_reason"),
        related_reports=ws_res.get("related_reports", []),
        escalation_path=ws_res.get("escalation_path"),
        incident_latitude=report.incident_latitude if report.incident_latitude is not None else request.incident_latitude,
        incident_longitude=report.incident_longitude if report.incident_longitude is not None else request.incident_longitude,
        incident_address=report.incident_address or request.incident_address,
        incident_location_name=report.incident_location_name or request.incident_location_name,
        ai_classification=raw_result.get("ai_classification", "Non-SIF-potential"),
        ai_sif_score=raw_result.get("ai_sif_score", risk_score),
        ai_confidence=raw_result.get("ai_confidence", confidence),
        rule_based_assessment=raw_result.get("rule_based_assessment", "NO"),
        ml_probability=raw_result.get("ml_probability", 0.0),
        final_ai_decision=raw_result.get("final_ai_decision", determination_status),
        contributing_features=raw_result.get("contributing_features", []),
        human_classification=None,
        human_sif_score=None,
        reviewer_feedback=None,
        review_status="Pending Review",
        is_duplicate=is_duplicate,
        is_unrelated=False,
        message=message,
        created_at=report.created_at
    )
