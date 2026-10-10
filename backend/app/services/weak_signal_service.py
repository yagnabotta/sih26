from typing import List, Dict, Any, Optional
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from ..models.weak_signal import WeakSignal, WeakSignalReview, report_weak_signals
from ..ai_services.signal_correlation import (
    evaluate_report_pair_or_group
)

def evaluate_custom_reports_correlation(reports: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Directly evaluates whether a set of reports interact to form a compound weak signal / precursor."""
    res = evaluate_report_pair_or_group(reports)
    if "is_correlated" not in res:
        res["is_correlated"] = res.get("cluster_detected", False)
    return res

def get_weak_signals_for_organization(db: Session, org_id: str) -> Dict[str, Any]:
    """
    Synthesizes weak signals for the given organization by querying actual
    WeakSignal database entities and completed safety reports. Zero static/hardcoded signals.
    """
    # 1. Fetch real WeakSignal entities from DB
    db_signals = db.query(WeakSignal).filter(WeakSignal.organization_id == org_id).all()

    correlated = []
    seen_titles = set()

    for ws in db_signals:
        source_reps = []
        if ws.safety_reports:
            for rep in ws.safety_reports:
                source_reps.append({
                    "report_id": rep.report_reference,
                    "report_type": rep.report_type,
                    "date_submitted": rep.report_date,
                    "short_description": rep.description,
                    "unit": rep.location,
                    "excerpt": rep.description
                })

        structured_sig = {
            "id": ws.id,
            "signal_id": ws.signal_id,
            "title": ws.title,
            "pattern_name": ws.title,
            "category": ws.category,
            "cluster_detected": True,
            "relationship": ws.title,
            "incident_types": list(dict.fromkeys(r["report_type"] for r in source_reps)) if source_reps else [ws.category],
            "locations": [ws.location or ws.unit] if (ws.location or ws.unit) else [],
            "timestamps": [str(r["date_submitted"]) for r in source_reps if r.get("date_submitted")],
            "shared_hazard_or_pathway": ws.escalation_path or ws.detected_hazard,
            "evidence_summary": ws.detection_reason,
            "confidence_level": "CONFIRMED" if ws.recurrence_count >= 2 else "PLAUSIBLE",
            "missing_information": [],
            "potential_consequence": ws.escalation_path,
            "combined_risk": ws.risk_level.upper(),
            "risk_classification": ws.risk_level,
            "correlation_score": ws.risk_score,
            "risk_score": ws.risk_score,
            "risk_level": ws.risk_level,
            "reason": ws.detection_reason,
            "recommended_preventive_actions": ws.recommended_action,
            "recommended_action": ws.recommended_action,
            "first_detected_date": ws.first_detected_at.strftime("%Y-%m-%d") if ws.first_detected_at else str(date.today()),
            "source": "Automated Multi-Record Surveillance",
            "potential_sif_precursor": ws.escalation_path,
            "why_identified": ws.detection_reason,
            "energy_source": ws.energy_vector,
            "barrier_status": ws.barrier_issue,
            "review_status": ws.status,
            "reviewer_notes": ws.reviewer_notes or "Under review by Operational Safety Team.",
            "recurrence_count": ws.recurrence_count,
            "source_reports": source_reps,
            "signals": [
                {
                    "signal_num": idx + 1,
                    "report_id": r["report_id"],
                    "description": r["short_description"],
                    "individual_risk": "MEDIUM",
                    "location": r["unit"],
                    "date": r["date_submitted"]
                }
                for idx, r in enumerate(source_reps)
            ],
            "progression_steps": [
                {"step": "First Anomaly", "trend": "Increasing", "status": f"Initial observation logged in {ws.location or ws.unit}"},
                {"step": "Recurrent Detection", "trend": "Increasing", "status": f"{ws.recurrence_count} recurring reports identified without permanent elimination"},
                {"step": "Precursor Escalation", "trend": "Stable", "status": ws.escalation_path}
            ]
        }
        correlated.append(structured_sig)
        seen_titles.add(ws.title.lower())

    # Weak signals are created only by the historical detector during report
    # analysis. Do not synthesize new signals while reading the dashboard:
    # correlation is evidence for review, not proof of a weak signal.

    # 4. Attach any persisted reviews from weak_signal_reviews table
    reviews = db.query(WeakSignalReview).filter(WeakSignalReview.organization_id == org_id).all()
    review_map = {rev.signal_id: rev for rev in reviews}

    for sig in correlated:
        sid = sig.get("signal_id")
        if sid and sid in review_map:
            sig["review_status"] = review_map[sid].status
            if review_map[sid].reviewer_notes:
                sig["reviewer_notes"] = review_map[sid].reviewer_notes

    # 5. Compute summary KPIs
    total_active = len(correlated)
    high_risk = sum(1 for s in correlated if s.get("risk_level") == "High" or (s.get("risk_score") or 0) >= 90)
    med_risk = sum(1 for s in correlated if s.get("risk_level") == "Medium" and (s.get("risk_score") or 0) < 90)
    low_risk = sum(1 for s in correlated if s.get("risk_level") == "Low")
    escalating = sum(1 for s in correlated if (s.get("risk_score") or 0) >= 80)
    avg_conf = round(sum(s.get("risk_score", 0) for s in correlated) / total_active, 1) if total_active > 0 else 0.0

    summary = {
        "total_active_signals": total_active,
        "high_risk_precursors": high_risk,
        "escalating_patterns": escalating,
        "average_confidence": avg_conf,
        "high_risk_count": high_risk,
        "medium_risk_count": med_risk,
        "low_risk_count": low_risk,
        "total_clusters": 0
    }

    # 6. Extract and format structured Emerging Risk Clusters
    emerging_clusters = []
    for idx, sig in enumerate(correlated, start=1):
        if not sig.get("cluster_detected", True):
            continue

        raw_signals = sig.get("signals") or []
        source_reps = sig.get("source_reports") or []
        
        signals_list = []
        if raw_signals:
            for s_idx, s in enumerate(raw_signals, start=1):
                signals_list.append({
                    "signal_num": s_idx,
                    "report_id": s.get("report_id", f"SIG-{s_idx:02d}"),
                    "description": s.get("description", ""),
                    "individual_risk": s.get("risk_level", "MEDIUM").upper(),
                    "location": s.get("location") or (sig.get("title", "").split()[0] if sig.get("title") else "Operating Area"),
                    "date": s.get("date", str(date.today())),
                    "detected_roles": s.get("detected_roles", [])
                })
        elif source_reps:
            for s_idx, rep in enumerate(source_reps, start=1):
                rtype = rep.get("report_type", "")
                r_risk = "MEDIUM" if ("near miss" in rtype.lower() or "unsafe" in rtype.lower()) else "LOW"
                # If high-risk phrasing present in excerpt, reflect realistic individual risk
                desc = (rep.get("short_description") or rep.get("excerpt") or "").lower()
                if "fire" in desc or "leak" in desc or "spark" in desc or "voltage" in desc or "fall" in desc:
                    r_risk = "MEDIUM/HIGH"
                signals_list.append({
                    "signal_num": s_idx,
                    "report_id": rep.get("report_id", f"REP-{s_idx:02d}"),
                    "description": rep.get("short_description") or rep.get("excerpt") or "",
                    "individual_risk": r_risk,
                    "location": rep.get("unit") or "Plant Operating Zone",
                    "date": rep.get("date_submitted", str(date.today())),
                    "detected_roles": []
                })

        # Calculate time relationship
        dates = [s.get("date") for s in signals_list if s.get("date")]
        time_rel = "Active operational window (within 48 hours)"
        if len(dates) >= 2:
            try:
                d1 = datetime.strptime(str(dates[0])[:10], "%Y-%m-%d").date()
                d2 = datetime.strptime(str(dates[1])[:10], "%Y-%m-%d").date()
                diff_days = abs((d1 - d2).days)
                if diff_days == 0:
                    time_rel = "Concurrent (Same shift / day occurrence)"
                elif diff_days == 1:
                    time_rel = "Within 24 hours of each other"
                else:
                    time_rel = f"Occurred within {diff_days} days of each other"
            except Exception:
                pass

        cluster_loc = "Plant Area"
        if signals_list and signals_list[0].get("location"):
            cluster_loc = signals_list[0]["location"]
        elif source_reps and source_reps[0].get("unit"):
            cluster_loc = source_reps[0]["unit"]

        rel = sig.get("relationship") or sig.get("title") or "Cross-Hazard Interaction"
        consequence = sig.get("potential_consequence") or sig.get("potential_sif_precursor") or "Catastrophic Incident"
        combined_risk = sig.get("combined_risk") or (sig.get("risk_level", "HIGH").upper())
        score = sig.get("correlation_score") or sig.get("risk_score") or 90
        reason = sig.get("reason") or sig.get("why_identified") or "Multiple co-located hazards interact to create an escalated consequence pathway."
        action = sig.get("recommended_action") or sig.get("key_learnings") or "Immediately inspect/isolate the affected area and enforce primary controls."
        progression = sig.get("progression_steps") or []

        risk_levels_summary = ", ".join([f"Signal {s['signal_num']}: {s['individual_risk']}" for s in signals_list])

        emerging_clusters.append({
            "id": idx,
            "cluster_id": f"CL-{idx:02d}",
            "cluster_title": f"EMERGING {combined_risk}-RISK CLUSTER: {rel}",
            "title": rel,
            "pattern_name": sig.get("pattern_name", rel),
            "relationship": rel,
            "signals": signals_list,
            "contributing_reports": source_reps,
            "incident_types": sig.get("incident_types", [s.get("individual_risk") for s in signals_list]),
            "locations": sig.get("locations", [cluster_loc]),
            "timestamps": sig.get("timestamps", [s.get("date") for s in signals_list if s.get("date")]),
            "shared_hazard_or_pathway": sig.get("shared_hazard_or_pathway", consequence),
            "evidence_summary": sig.get("evidence_summary", reason),
            "confidence_level": sig.get("confidence_level", "CONFIRMED"),
            "missing_information": sig.get("missing_information", []),
            "individual_risk_levels": risk_levels_summary,
            "location": cluster_loc,
            "time_relationship": time_rel,
            "correlation_score": score,
            "potential_consequence": consequence,
            "combined_risk": combined_risk,
            "risk_classification": sig.get("risk_classification", combined_risk.title()),
            "reason": reason,
            "recommended_preventive_actions": sig.get("recommended_preventive_actions", action),
            "recommended_action": action,
            "progression_steps": progression,
            "source_signal_id": sig.get("signal_id", f"WS-{idx:02d}"),
            "review_status": sig.get("review_status", "Under Review"),
            "reviewer_notes": sig.get("reviewer_notes", "")
        })

    summary["total_clusters"] = len(emerging_clusters)

    return {
        "summary": summary,
        "weak_signals": correlated,
        "emerging_clusters": emerging_clusters
    }

def get_weak_signal_by_id(db: Session, org_id: str, signal_id: str) -> Optional[Dict[str, Any]]:
    """Returns detailed forensic dossier for a specific weak signal or cluster."""
    result = get_weak_signals_for_organization(db, org_id)
    signals = result.get("weak_signals", [])
    clusters = result.get("emerging_clusters", [])
    
    clean_target = signal_id.strip().lower()

    # 1. Check clusters
    for c in clusters:
        if c.get("cluster_id", "").lower() == clean_target:
            return c
        if clean_target in c.get("title", "").lower() or clean_target in c.get("relationship", "").lower():
            return c

    # 2. Check weak signals
    for s in signals:
        if s.get("signal_id", "").lower() == clean_target:
            return s
        if str(s.get("id", "")).lower() == clean_target:
            return s
        if clean_target in s.get("title", "").lower():
            return s

    return signals[0] if signals else (clusters[0] if clusters else None)

def update_weak_signal_review(
    db: Session,
    org_id: str,
    signal_id: str,
    status: str,
    notes: Optional[str] = None,
    decision: Optional[str] = None,
    reviewer: Optional[str] = None
) -> Dict[str, Any]:
    """Persists auditor review status, human classification decision, and notes in the database with strict completion locking."""
    review = db.query(WeakSignalReview).filter(
        WeakSignalReview.organization_id == org_id,
        WeakSignalReview.signal_id == signal_id
    ).first()

    # Strict lock: completed records cannot be reverted
    if review and review.status in ["Completed", "Complete"] and status not in ["Completed", "Complete"]:
        raise ValueError("Finalized Record Locked: Records marked as Completed cannot be reverted.")

    clean_status = "Completed" if status in ["Completed", "Complete"] else status

    if not review:
        review = WeakSignalReview(
            organization_id=org_id,
            signal_id=signal_id,
            status=clean_status,
            decision=decision,
            reviewer=reviewer,
            reviewer_notes=notes or ""
        )
        db.add(review)
    else:
        review.status = clean_status
        if decision is not None:
            review.decision = decision
        if reviewer is not None:
            review.reviewer = reviewer
        if notes is not None:
            review.reviewer_notes = notes
        review.reviewed_at = datetime.utcnow()

    # Also update WeakSignal table if matching signal_id exists
    ws_entity = db.query(WeakSignal).filter(
        WeakSignal.organization_id == org_id,
        WeakSignal.signal_id == signal_id
    ).first()
    if ws_entity:
        ws_entity.status = clean_status
        if notes is not None:
            ws_entity.reviewer_notes = notes

    db.commit()
    db.refresh(review)

    # Return refreshed signal
    signal = get_weak_signal_by_id(db, org_id, signal_id)
    return {
        "status": "success",
        "signal_id": signal_id,
        "review_status": review.status,
        "reviewer_notes": review.reviewer_notes,
        "weak_signal": signal
    }


def clear_all_weak_signals_for_org(db: Session, org_id: str) -> Dict[str, Any]:
    """Clears all weak signals and associations for an organization to ensure a clean slate."""
    # 1. Delete from association table for this org's signals
    org_signal_ids = [s.id for s in db.query(WeakSignal.id).filter(WeakSignal.organization_id == org_id).all()]
    if org_signal_ids:
        db.execute(report_weak_signals.delete().where(report_weak_signals.c.weak_signal_id.in_(org_signal_ids)))
    
    # 2. Delete reviews and signals
    db.query(WeakSignalReview).filter(WeakSignalReview.organization_id == org_id).delete(synchronize_session=False)
    db.query(WeakSignal).filter(WeakSignal.organization_id == org_id).delete(synchronize_session=False)
    db.commit()

    return {
        "status": "success",
        "message": "All weak signals and multi-hazard clusters successfully cleared. Awaiting user-submitted descriptions.",
        "active_signals_count": 0,
        "emerging_clusters_count": 0
    }


def analyze_user_description_and_correlate(
    db: Session,
    current_user: Any,
    description: str,
    location: str = "Unit 1",
    report_type: str = "NEAR_MISS"
) -> Dict[str, Any]:
    """
    Takes an actual user-entered incident description, validates it,
    creates a persisted safety report, and runs real-time weak signal correlation
    against previously submitted legitimate reports.
    """
    from ..models.safety_report import SafetyReport
    from ..models.ai_analysis import AIAnalysis
    from ..services.report_service import generate_report_reference
    from ..ai_services.ai_service import analyze_safety_report
    from ..ai_services.safety_validity import classify_safety_observation_validity
    from .historical_pattern_service import detect_and_update_weak_signals

    clean_desc = (description or "").strip()
    clean_loc = (location or "Unit 1").strip()
    clean_type = (report_type or "NEAR_MISS").upper().replace(" ", "_")

    # Step 1: Safety Validity Check
    validity = classify_safety_observation_validity(clean_desc)
    if validity.get("is_unrelated"):
        return {
            "success": False,
            "is_unrelated": True,
            "message": validity.get("explanation", "Input does not contain a recognized safety observation."),
            "weak_signal_detected": False,
            "emerging_clusters": get_weak_signals_for_organization(db, current_user.organization_id).get("emerging_clusters", [])
        }

    # Step 2: Generate Reference & Persist Report
    org_id = current_user.organization_id
    ref = generate_report_reference(db, org_id)
    report = SafetyReport(
        report_reference=ref,
        organization_id=org_id,
        user_id=current_user.id if hasattr(current_user, "id") else None,
        report_type=clean_type,
        description=clean_desc,
        original_description=clean_desc,
        normalized_description=clean_desc,
        location=clean_loc,
        report_date=str(date.today()),
        analysis_status="COMPLETED"
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # Step 3: Run AI NLP Analysis
    raw_result = analyze_safety_report(
        report_type=clean_type,
        description=clean_desc,
        additional_context=f"Location: {clean_loc}"
    )

    ai_analysis = AIAnalysis(
        report_id=report.id,
        organization_id=org_id,
        analysis_context=raw_result.get("analysis_context", "Interactive Field Analysis"),
        identified_action=raw_result.get("identified_action"),
        identified_condition=raw_result.get("identified_condition"),
        identified_event=raw_result.get("identified_event"),
        identified_hazard=raw_result.get("identified_hazard"),
        safety_signals=raw_result.get("safety_signals", []),
        energy_source=raw_result.get("energy_source"),
        exposure=raw_result.get("exposure"),
        barrier_information=raw_result.get("barrier_information"),
        potential_consequence=raw_result.get("potential_consequence"),
        sif_precursor_assessment=raw_result.get("sif_precursor_assessment", "NO"),
        explanation=raw_result.get("explanation", "")
    )
    db.add(ai_analysis)
    db.commit()

    # Step 4: Run Real-Time Historical & Multi-Signal Correlation
    ws_res = detect_and_update_weak_signals(
        db=db,
        org_id=org_id,
        current_report=report,
        raw_nlp_result=raw_result
    )

    # Step 5: Fetch fresh weak signals state
    fresh_state = get_weak_signals_for_organization(db, org_id)

    return {
        "success": True,
        "report_reference": ref,
        "report_id": report.id,
        "location": clean_loc,
        "hazard": raw_result.get("identified_hazard"),
        "risk_score": raw_result.get("ai_sif_score", 30),
        "determination_status": raw_result.get("final_ai_decision", "NON-SIF OBSERVATION"),
        "weak_signal_detected": ws_res.get("weak_signal_detected", False),
        "weak_signal_title": ws_res.get("weak_signal_title"),
        "weak_signal_reason": ws_res.get("weak_signal_reason"),
        "escalation_path": ws_res.get("escalation_path"),
        "summary": fresh_state.get("summary"),
        "weak_signals": fresh_state.get("weak_signals", []),
        "emerging_clusters": fresh_state.get("emerging_clusters", [])
    }


def correlate_two_user_descriptions(
    db: Session,
    current_user: Any,
    description_1: str,
    location_1: str,
    description_2: str,
    location_2: str
) -> Dict[str, Any]:
    """
    Takes two user-entered incident descriptions, evaluates their cross-hazard
    physical, spatial, and escalation interaction, saves both as legitimate reports,
    and if correlated, creates an Emerging Multi-Signal Hazard Cluster.
    """
    from ..models.safety_report import SafetyReport
    from ..models.ai_analysis import AIAnalysis
    from ..services.report_service import generate_report_reference
    from ..ai_services.ai_service import analyze_safety_report
    from ..ai_services.signal_correlation import evaluate_report_pair_or_group

    org_id = current_user.organization_id
    today_str = str(date.today())

    # Create Report 1
    ref1 = generate_report_reference(db, org_id)
    rep1 = SafetyReport(
        report_reference=ref1,
        organization_id=org_id,
        user_id=current_user.id if hasattr(current_user, "id") else None,
        report_type="NEAR_MISS",
        description=description_1.strip(),
        original_description=description_1.strip(),
        normalized_description=description_1.strip(),
        location=location_1.strip(),
        report_date=today_str,
        analysis_status="COMPLETED"
    )
    db.add(rep1)
    db.commit()
    db.refresh(rep1)

    # Create Report 2
    ref2 = generate_report_reference(db, org_id)
    rep2 = SafetyReport(
        report_reference=ref2,
        organization_id=org_id,
        user_id=current_user.id if hasattr(current_user, "id") else None,
        report_type="UNSAFE_CONDITION",
        description=description_2.strip(),
        original_description=description_2.strip(),
        normalized_description=description_2.strip(),
        location=location_2.strip(),
        report_date=today_str,
        analysis_status="COMPLETED"
    )
    db.add(rep2)
    db.commit()
    db.refresh(rep2)

    # Analyze both reports
    raw_res1 = analyze_safety_report("NEAR_MISS", description_1.strip(), additional_context=f"Location: {location_1}")
    raw_res2 = analyze_safety_report("UNSAFE_CONDITION", description_2.strip(), additional_context=f"Location: {location_2}")

    # Evaluate correlation using rule-based engine
    eval_input = [
        {
            "report_id": ref1,
            "description": description_1.strip(),
            "location": location_1.strip(),
            "timestamp": f"{today_str}T08:00:00Z",
            "report_type": "Near Miss",
            "observed_severity": "Moderate"
        },
        {
            "report_id": ref2,
            "description": description_2.strip(),
            "location": location_2.strip(),
            "timestamp": f"{today_str}T10:30:00Z",
            "report_type": "Unsafe Condition",
            "observed_severity": "Moderate"
        }
    ]
    corr_result = evaluate_report_pair_or_group(eval_input)

    # If cluster detected, create WeakSignal in DB
    if corr_result.get("cluster_detected", False):
        signal_count = db.query(WeakSignal).filter(WeakSignal.organization_id == org_id).count()
        sig_id = f"WS-{signal_count + 1:03d}"
        
        ws_obj = WeakSignal(
            signal_id=sig_id,
            organization_id=org_id,
            signal_type="COMPOUND_HAZARD_CLUSTER",
            title=corr_result.get("pattern_name") or corr_result.get("relationship") or "Correlated Multi-Hazard Cluster",
            category=corr_result.get("relationship") or "Multi-Signal Interaction",
            description=corr_result.get("reason") or "Interacting safety observations indicate potential escalation.",
            detected_hazard=corr_result.get("relationship"),
            location=location_1.strip(),
            unit=location_1.strip(),
            activity="Operational Activity",
            energy_vector=raw_res1.get("energy_source") or raw_res2.get("energy_source"),
            barrier_issue=raw_res1.get("barrier_information") or raw_res2.get("barrier_information"),
            recurrence_count=2,
            risk_score=corr_result.get("correlation_score", 85),
            risk_level=corr_result.get("risk_classification", "High"),
            first_detected_at=datetime.utcnow(),
            last_detected_at=datetime.utcnow(),
            current_report_id=rep2.id,
            related_report_ids=[rep1.id, rep2.id],
            detection_reason=corr_result.get("reason") or "Rule-based physics & spatial correlation identified interacting hazards.",
            escalation_path=corr_result.get("potential_consequence") or "Potential escalated SIF event.",
            recommended_action=corr_result.get("recommended_preventive_actions") or "Inspect and isolate affected operational zone.",
            status="Under Review"
        )
        db.add(ws_obj)
        db.commit()
        db.refresh(ws_obj)

        # Associate both reports
        ws_obj.safety_reports.append(rep1)
        ws_obj.safety_reports.append(rep2)
        db.commit()

    fresh_state = get_weak_signals_for_organization(db, org_id)

    return {
        "success": True,
        "correlation_result": corr_result,
        "is_correlated": corr_result.get("cluster_detected", False),
        "cluster_detected": corr_result.get("cluster_detected", False),
        "report_1_ref": ref1,
        "report_2_ref": ref2,
        "summary": fresh_state.get("summary"),
        "weak_signals": fresh_state.get("weak_signals", []),
        "emerging_clusters": fresh_state.get("emerging_clusters", [])
    }

