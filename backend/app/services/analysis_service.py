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
from ..ai_services.context_analyzer import classify_incident_category
from ..ai_services.safety_validity import classify_safety_observation_validity

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
    report_date = (request.report_date or datetime.utcnow().strftime("%Y-%m-%d")).strip()

    # Explicitly extract and initialize selected checklist safety factors at the top
    checklist_items: List[str] = list(getattr(request, "checklist", None) or getattr(request, "selected_checklist", None) or [])
    if not checklist_items and request.additional_context:
        ctx_val = request.additional_context if isinstance(request.additional_context, str) else ", ".join(str(x) for x in request.additional_context)
        if "Safety Factors:" in ctx_val:
            factors_text = ctx_val.replace("Safety Factors:", "").strip()
            checklist_items = [f.strip() for f in re.split(r'[,;]\s*', factors_text) if f.strip()]

    # Mutual exclusivity: both checklist and description is not allowed!
    if description and checklist_items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Dual submission not allowed: Please provide either a detailed description OR select checklist factors, but not both."
        )

    # Category selection: When entering description, DO NOT assume or override category;
    # strictly honor the user's manual selection!
    if description:
        raw_req_type = (request.report_type or "NEAR_MISS").strip().upper().replace("-", "_").replace(" ", "_")
        if raw_req_type in ["UNSAFE_ACT", "UNSAFE_CONDITION", "NEAR_MISS"]:
            norm_type = raw_req_type
        else:
            norm_type = "NEAR_MISS"
    elif checklist_items:
        cat_info = classify_incident_category(" ".join(checklist_items))
        norm_type = cat_info["category"]
    else:
        norm_type = "NEAR_MISS"

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

    # Multi-Stage Step 1: Safety Observation Validity Layer
    validity_input = f"{description} {request.additional_context or ''}".strip()
    validity = classify_safety_observation_validity(validity_input)
    if validity["is_unrelated"]:
        return AIAnalysisExecuteResponse(
            report_name="Unrelated Input",
            determination_status="UNRELATED INPUT",
            sif_precursor="NO",
            confidence=0,
            risk_score=0,
            sif_potential_score=0,
            classification=norm_type.replace('_', ' ').title(),
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

    # 1. Run the real current main 10-step AI NLP engine
    raw_result = analyze_safety_report(
        report_type=norm_type,
        description=desc_to_analyze,
        additional_context=request.additional_context,
        legacy_scoring=getattr(request, "legacy_scoring", False) or False
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

    rec_list: List[str] = []
    capa_list: List[str] = []

    # 1. High-Energy Electrical Controls
    if any(k in comb_lower for k in ["electrical", "arc flash", "cable", "voltage", "panel", "busbar"]):
        rec_list.append("De-energize electrical circuit and perform positive Lockout/Tagout (LOTO).")
        rec_list.append("Verify zero-voltage state with calibrated test instrument before contact.")
        capa_list.append("Conduct safety stand-down on Life-Saving Rule: Energy Isolation (LSR-01).")

    # 2. Machine & Equipment Failure Controls
    if any(k in comb_lower for k in ["equipment failure", "machine", "mechanical", "guard", "malfunction", "breakdown", "defect"]):
        rec_list.append("Isolate equipment power and tag out-of-service until certified maintenance inspection.")
        rec_list.append("Inspect physical machine safeguards, interlocks, and mechanical components.")
        capa_list.append("Review machine preventive maintenance ledger and recertify safeguard integrity.")

    # 3. Fire, Hot Work & Gas Controls
    if any(k in comb_lower for k in ["fire", "blast", "ignition", "hot work", "gas", "flammable", "hydrocarbon"]):
        rec_list.append("Immediately trigger Emergency Shutdown (ESD) or line isolation valve.")
        rec_list.append("Perform continuous atmospheric gas testing (0% LEL) and station a certified fire watch.")
        capa_list.append("Audit Hot Work Permits and combustible gas detection sensor calibration.")

    # 4. Confined Space Controls
    if any(k in comb_lower for k in ["confined", "tank entry", "vessel entry"]):
        rec_list.append("Stop entry immediately; conduct atmospheric gas testing (0% LEL, 19.5-23.5% O2, 0 ppm toxic).")
        rec_list.append("Verify valid Confined Space Entry Permit and assign dedicated standby sentry.")
        capa_list.append("Conduct mandatory retraining on Confined Space Entry procedures.")

    # 5. High Pressure Controls
    if any(k in comb_lower for k in ["high pressure", "high-pressure", "pressurized", "hydraulic"]):
        rec_list.append("Isolate upstream pressure supply and depressurize system to 0 PSI before inspection.")
        rec_list.append("Barricade pressure exclusion zone and position personnel outside the line of fire.")
        capa_list.append("Conduct pressure systems integrity audit and inspect line securement devices.")

    # 6. Fall from Height & Scaffolding Controls
    if any(k in comb_lower for k in ["height", "fall", "scaffold", "ladder"]):
        rec_list.append("Ensure certified 100% tie-off with inspected harness and lanyard.")
        rec_list.append("Install top-rail, mid-rail, and toe-board fall protection barriers.")
        capa_list.append("Audit working-at-height permits and inspect fall arrest anchorage points.")

    # 7. Suspended Load Controls
    if any(k in comb_lower for k in ["dropped", "line of fire", "line-of-fire", "suspended load", "struck", "crane", "rigging"]):
        rec_list.append("Barricade drop zone and prohibit personnel from walking under suspended loads.")
        rec_list.append("Verify personnel maintain safe clearance outside the dynamic line of fire.")
        capa_list.append("Audit drop-prevention controls and tool lanyards across working areas.")

    # 8. Surface Slip / Trip / Housekeeping Controls
    if any(k in comb_lower for k in ["slip", "trip", "slippery", "housekeeping", "walkway", "floor"]):
        rec_list.append("Inspect and rectify the slippery surface; clean and dry affected area with absorbent.")
        rec_list.append("Provide warning signage and prevent pedestrian exposure until corrected.")
        capa_list.append("Rectify drainage defect or fluid source causing surface slickness.")

    # Default fallback if no specific hazard matched
    if not rec_list:
        if is_sif:
            rec_list = [
                "Immediately trigger Emergency Shutdown (ESD) or line isolation valve",
                "Evacuate personnel upwind and establish a 50-meter safety exclusion zone",
                "Conduct continuous multi-gas / zero-energy verification before re-entry"
            ]
            capa_list = [
                "Issue Stop-Work Notice and stand down operating shift team",
                "Dispatch Field HSE Superintendent for barrier integrity inspection"
            ]
        else:
            rec_list = [
                "Conduct immediate walkdown inspection to identify hazard root cause",
                "Implement appropriate physical controls and warning demarcation",
                "Verify area condition during regular shift safety inspections"
            ]
            capa_list = [
                "Log routine maintenance inspection in CMMS ledger",
                "Review standard operating procedures with shift crew"
            ]

    # Deduplicate while preserving order
    def _dedup(items):
        seen = set()
        res = []
        for x in items:
            if x not in seen:
                seen.add(x)
                res.append(x)
        return res

    recommended_controls = _dedup(rec_list)[:4]
    corrective_actions = _dedup(capa_list)[:2]


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
        score_breakdown=raw_result.get("score_breakdown"),
        override_rule_applied=raw_result.get("override_rule_applied"),
        human_classification=None,
        human_sif_score=None,
        reviewer_feedback=None,
        review_status="Pending Review",
        is_duplicate=is_duplicate,
        is_unrelated=False,
        message=message,
        created_at=report.created_at
    )
