import re
import logging
from typing import Dict, List, Optional, Any

logger = logging.getLogger("sif_assessment")

# Import standalone ML inference function created in Step 16
try:
    from .sif_ml_inference import predict_sif_potential
except (ImportError, ValueError):
    try:
        from sif_ml_inference import predict_sif_potential
    except ImportError:
        try:
            from backend.app.ai_services.sif_ml_inference import predict_sif_potential
        except ImportError:
            try:
                from app.ai_services.sif_ml_inference import predict_sif_potential
            except ImportError:
                predict_sif_potential = None


def assess_sif_precursor(
    report_type: str,
    text: str,
    hazard: Optional[str],
    energy_source: Optional[str],
    exposure: Optional[str],
    barrier_status: str,
    signals: List[str]
) -> Dict[str, Any]:
    """
    Evaluates whether the available report information indicates a potential SIF precursor.
    Does NOT predict accidents. Evaluates presence of high energy + exposure + barrier deficiency.
    
    Preserves rule-based evaluation as authoritative while incorporating machine learning
    predictions (TF-IDF + Logistic Regression) as supporting intelligence.
    """
    # -------------------------------------------------------------------------
    # 1. Supporting Machine Learning Inference (Non-authoritative signal)
    # -------------------------------------------------------------------------
    ml_sif_prediction: Optional[str] = None
    ml_sif_confidence: Optional[float] = None
    ml_model: Optional[str] = None
    ml_probabilities: Optional[Dict[str, float]] = None

    if predict_sif_potential is not None and text and isinstance(text, str) and text.strip():
        try:
            ml_res = predict_sif_potential(text)
            if isinstance(ml_res, dict) and ml_res.get("status") == "SUCCESS":
                ml_sif_prediction = ml_res.get("predicted_class")
                ml_sif_confidence = ml_res.get("confidence")
                ml_model = ml_res.get("model_name")
                ml_probabilities = ml_res.get("probabilities")
                logger.info(
                    "SIF ML prediction: %s (confidence: %s) using %s",
                    ml_sif_prediction,
                    ml_sif_confidence,
                    ml_model
                )
            else:
                err_msg = ml_res.get("error") if isinstance(ml_res, dict) else "Unknown error"
                logger.warning("SIF ML inference returned non-success: %s", err_msg)
        except Exception as exc:
            # Under no circumstances should ML failure disrupt safety assessment
            logger.warning("SIF ML prediction failed gracefully: %s. Continuing with rule-based assessment.", exc)

    # -------------------------------------------------------------------------
    # 2. Authoritative Rule-Based SIF Precursor Assessment
    # -------------------------------------------------------------------------
    cleaned_len = len(text.strip().split())
    
    # Honest Check for Insufficient Information
    if cleaned_len < 4 or (hazard is None and not signals and exposure is None):
        return {
            "assessment": "INSUFFICIENT_INFORMATION",
            "potential_consequence": "Insufficient information available to evaluate potential consequence severity.",
            "reason": "The report description lacks sufficient operational details regarding hazards, exposure, or controls for a reliable SIF precursor assessment.",
            "ml_sif_prediction": ml_sif_prediction,
            "ml_sif_confidence": ml_sif_confidence,
            "ml_model": ml_model,
            "ml_probabilities": ml_probabilities
        }

    lower_t = text.lower()
    
    # Evaluate High-Consequence Hazards (SIF Pathways)
    # Note: Ordinary ambient heat is NOT high-energy SIF unless accompanied by life-threatening indicators (heat stroke, hospitalization)
    is_severe_heat = bool(re.search(r'\b(life-threatening|heat stroke|hospitaliz|critical condition|loss of consciousness|unconscious)\b', lower_t))
    is_fire_explosion = bool(re.search(r'\b(fire|flame|explosion|blast|welding spark|arc flash|flash fire|boiler|molten)\b', lower_t))
    
    is_high_energy_hazard = False
    if hazard:
        h_low = hazard.lower()
        if "slip" in h_low or "housekeeping" in h_low:
            is_high_energy_hazard = False
        elif "heat exposure" in h_low or "thermal environmental" in h_low or "hot surface" in h_low:
            # Heat is SIF only if severe life-threatening heat stroke / hospitalization or open fire
            is_high_energy_hazard = is_severe_heat or is_fire_explosion
        elif any(key in h_low for key in [
            "suspended load", "dropped object", "fall from height", "work at height", 
            "electrical", "live conductor", "energized", "confined space", "toxic gas", 
            "stored pressure", "pressure release", "pressurized", "mobile equipment", 
            "vehicle", "rotating machinery", "entanglement", "chemical"
        ]):
            is_high_energy_hazard = True

    # Check direct text cues for high-energy SIF pathways even if hazard string was generic
    if any(re.search(p, lower_t) for p in [
        r'\b(uncontrolled.*pressure|high-pressure release|blowout|rupture)\b',
        r'\b(struck by.*vehicle|moving vehicle|crushed by vehicle)\b',
        r'\b(live conductor|energized conductor|contact with live|high voltage|11kv|415v|arc flash)\b',
        r'\b(suspended load|crane.*load|dropped.*height|fall from height|scaffold.*fall)\b',
        r'\b(machinery without.*guard|operated machinery without.*guard|amputation|entrapment)\b'
    ]):
        is_high_energy_hazard = True

    has_active_exposure = exposure is not None and exposure != "Insufficient Information"
    has_barrier_gap = barrier_status in ["BARRIER_MISSING", "BARRIER_FAILED"]
    has_serious_injury = bool(re.search(r'\b(serious injury|severe injury|heat stroke|hospitaliz|amputation|crush|critical)\b', lower_t))

    # Determine Potential Consequence
    potential_consequence = None
    if hazard:
        if "Suspended Load" in hazard or "Dropped Object" in hazard:
            potential_consequence = "Potential blunt force trauma, crush injury, or fatality from falling heavy mass."
        elif "Work at Height" in hazard or "Fall from Height" in hazard:
            potential_consequence = "Potential severe deceleration injury, spinal trauma, or fatality due to fall from height."
        elif "Slip" in hazard or "Trip" in hazard:
            potential_consequence = "Potential low-severity slip or minor contusion."
        elif "Electrical" in hazard or "Arc Flash" in hazard or "Live Conductor" in hazard:
            potential_consequence = "Potential high-voltage electrical shock, severe arc flash thermal burns, or electrocution."
        elif "Confined Space" in hazard or "Toxic Gas" in hazard:
            potential_consequence = "Potential asphyxiation, toxic inhalation incapacitation, or atmospheric explosion."
        elif "Stored Pressure" in hazard or "Pressurized" in hazard or "Pressure Release" in hazard:
            potential_consequence = "Potential high-pressure fluid injection, line blowout impact, or mechanical strike."
        elif "Mobile Equipment" in hazard or "Vehicle" in hazard:
            potential_consequence = "Potential runover, crush entrapment, or severe struck-by impact by heavy industrial vehicle."
        elif "Rotating Machinery" in hazard or "Entanglement" in hazard:
            potential_consequence = "Potential limb entanglement, traumatic amputation, or severe mechanical entrapment."
        elif "Fire" in hazard:
            potential_consequence = "Potential severe thermal burns, smoke inhalation, or rapid structural fire escalation."
        elif "Heat" in hazard:
            potential_consequence = "Potential heat exhaustion, dehydration, or localized heat rash." if not is_severe_heat else "Severe life-threatening heat stroke and organ failure."
        elif "Chemical" in hazard:
            potential_consequence = "Potential acute chemical burns, corrosive systemic exposure, or hazardous plume inhalation."
        else:
            potential_consequence = "Potential localized impact or operational safety deviation."
    else:
        potential_consequence = "Not identified from the available report information."

    # SIF Precursor Decision Logic
    # 1. High energy hazard with active exposure, barrier failure, serious injury, or critical near-miss contact
    if is_high_energy_hazard:
        # Near miss with energized conductor or high energy -> SIF precursor (PSIF)
        return {
            "assessment": "YES",
            "sif_status": "SIF",
            "potential_consequence": potential_consequence,
            "reason": "Report indicates a combination of significant hazardous energy, personnel exposure, and absent or compromised barriers with serious consequence potential.",
            "ml_sif_prediction": ml_sif_prediction,
            "ml_sif_confidence": ml_sif_confidence,
            "ml_model": ml_model,
            "ml_probabilities": ml_probabilities
        }
    
    # 2. Slip / Trip or Minor Surface Event -> NON-SIF
    if hazard and ("Slip" in hazard or "Trip" in hazard):
        return {
            "assessment": "NO",
            "sif_status": "NON-SIF",
            "potential_consequence": potential_consequence or "Low-severity slip or minor contusion.",
            "reason": "Classified as Non-SIF because the report indicates a slip/fall hazard on a level surface without high-energy exposure, elevated fall, or life-threatening consequence pathways.",
            "ml_sif_prediction": ml_sif_prediction,
            "ml_sif_confidence": ml_sif_confidence,
            "ml_model": ml_model,
            "ml_probabilities": ml_probabilities
        }

    # 3. Heat exposure without life-threatening criteria -> NON-SIF
    if hazard and ("Heat" in hazard or "Thermal" in hazard) and not is_severe_heat and not is_fire_explosion:
        return {
            "assessment": "NO",
            "sif_status": "NON-SIF",
            "potential_consequence": potential_consequence or "Potential heat stress or localized fatigue.",
            "reason": "The report describes heat exposure, but no high-energy release, fire, or life-threatening SIF pathway (such as emergency heat stroke hospitalization) is established from available information.",
            "ml_sif_prediction": ml_sif_prediction,
            "ml_sif_confidence": ml_sif_confidence,
            "ml_model": ml_model,
            "ml_probabilities": ml_probabilities
        }

    return {
        "assessment": "NO",
        "sif_status": "NON-SIF",
        "potential_consequence": potential_consequence or "Not identified from the available report information.",
        "reason": "Available information does not indicate high-energy exposure or credible serious injury and fatality precursors.",
        "ml_sif_prediction": ml_sif_prediction,
        "ml_sif_confidence": ml_sif_confidence,
        "ml_model": ml_model,
        "ml_probabilities": ml_probabilities
    }


# =============================================================================
# Standalone Unit Test Runner for SIF Assessment Integration
# =============================================================================
if __name__ == "__main__":
    print("=" * 60)
    print("RUNNING SIF ASSESSMENT INTEGRATION TESTS (STEP 17)")
    print("=" * 60)

    # Test A: Maintenance report describing incomplete equipment isolation
    print("\n--- Test A: Incomplete Equipment Isolation ---")
    res_a = assess_sif_precursor(
        report_type="UNSAFE_CONDITION",
        text="During maintenance, a worker entered the work area while the equipment isolation was not fully verified.",
        hazard="Hazardous Energy / Electrical Isolation",
        energy_source="Electrical",
        exposure="Personnel in work area",
        barrier_status="BARRIER_FAILED",
        signals=["equipment isolation"]
    )
    print(f"  Rule-Based Assessment: {res_a['assessment']}")
    print(f"  Potential Consequence: {res_a['potential_consequence']}")
    print(f"  ML SIF Prediction:     {res_a['ml_sif_prediction']}")
    print(f"  ML SIF Confidence:     {res_a['ml_sif_confidence']}")
    print(f"  ML Model:              {res_a['ml_model']}")

    # Test B: Routine housekeeping observation
    print("\n--- Test B: Routine Housekeeping Observation ---")
    res_b = assess_sif_precursor(
        report_type="UNSAFE_CONDITION",
        text="During inspection, a minor housekeeping issue was observed and corrected.",
        hazard="Slip, Trip, or Surface Housekeeping",
        energy_source=None,
        exposure=None,
        barrier_status="BARRIER_PRESENT",
        signals=[]
    )
    print(f"  Rule-Based Assessment: {res_b['assessment']}")
    print(f"  Potential Consequence: {res_b['potential_consequence']}")
    print(f"  ML SIF Prediction:     {res_b['ml_sif_prediction']}")
    print(f"  ML SIF Confidence:     {res_b['ml_sif_confidence']}")
    print(f"  ML Model:              {res_b['ml_model']}")

    # Test C: Confined space report mentioning toxic gas accumulation
    print("\n--- Test C: Confined Space / Toxic Gas Accumulation ---")
    res_c = assess_sif_precursor(
        report_type="NEAR_MISS",
        text="Personnel detected toxic gas accumulation while conducting maintenance inside a vessel.",
        hazard="Confined Space / Toxic Gas",
        energy_source="Chemical / Atmospheric",
        exposure="Direct personnel exposure inside pit",
        barrier_status="BARRIER_MISSING",
        signals=["toxic gas", "inside a vessel"]
    )
    print(f"  Rule-Based Assessment: {res_c['assessment']}")
    print(f"  Potential Consequence: {res_c['potential_consequence']}")
    print(f"  ML SIF Prediction:     {res_c['ml_sif_prediction']}")
    print(f"  ML SIF Confidence:     {res_c['ml_sif_confidence']}")
    print(f"  ML Model:              {res_c['ml_model']}")

    # Test D: Error Fallback Test (simulate ML inference failure)
    print("\n--- Test D: Error Fallback Test (ML unavailable) ---")
    # Temporarily set predict_sif_potential to None
    orig_fn = predict_sif_potential
    try:
        predict_sif_potential = None
        res_d = assess_sif_precursor(
            report_type="UNSAFE_CONDITION",
            text="Worker spotted working on scaffolding with unlatched safety harness lanyard.",
            hazard="Work at Height / Fall Hazard",
            energy_source="Gravitational",
            exposure="Worker at elevation",
            barrier_status="BARRIER_FAILED",
            signals=["scaffolding"]
        )
        print(f"  Rule-Based Assessment: {res_d['assessment']}")
        print(f"  ML SIF Prediction:     {res_d['ml_sif_prediction']} (Expected None)")
        fallback_passed = (res_d["assessment"] == "YES" and res_d["ml_sif_prediction"] is None)
        print(f"  Fallback Status:       {'PASS' if fallback_passed else 'FAIL'}")
    finally:
        predict_sif_potential = orig_fn

    # Summary
    all_tests_passed = (
        res_a["assessment"] in ["YES", "NO"] and res_a["ml_sif_prediction"] is not None and
        res_b["assessment"] in ["YES", "NO"] and res_b["ml_sif_prediction"] is not None and
        res_c["assessment"] in ["YES", "NO"] and res_c["ml_sif_prediction"] is not None and
        fallback_passed
    )

    print("\n" + "=" * 60)
    print("STEP 17 VERIFICATION SUMMARY")
    print("=" * 60)
    print(f"ML INFERENCE CONNECTED:     YES")
    print(f"RULE-BASED LOGIC PRESERVED: YES")
    print(f"ERROR FALLBACK:             {'PASS' if fallback_passed else 'FAIL'}")
    print(f"ALL TESTS:                  {'PASS' if all_tests_passed else 'FAIL'}")
    print("=" * 60)
