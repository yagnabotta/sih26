from typing import Dict, Any, Optional
from .preprocessing import preprocess_text
from .context_analyzer import get_category_context
from .information_extraction import extract_safety_information
from .hazard_detection import detect_hazard
from .safety_signal_detection import detect_safety_signals
from .energy_exposure_analysis import analyze_energy_and_exposure
from .barrier_analysis import analyze_barriers
from .sif_assessment import assess_sif_precursor
from .explanation_generator import generate_explanation
from .life_saving_rules import map_life_saving_rules
from .classification import classify_safety_observation

def analyze_safety_report(
    report_type: str,
    description: str,
    additional_context: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes the modular AI/NLP Safety Intelligence Pipeline:
    1. Preprocess text (preserving negations)
    2. Structured Information Extraction
    3. Hazard Detection
    4. Safety Signal Detection
    5. Energy & Exposure Analysis
    6. Barrier / Control Analysis
    7. Dynamic Context-Based Observation Classification (Near Miss vs Unsafe Act vs Unsafe Condition)
    8. SIF Precursor Assessment (SIF vs NON-SIF)
    9. Contextual Root Cause Synthesis
    10. Explainable Result Generation
    """
    # Combine description and additional context for complete textual context
    full_text = description
    if additional_context and additional_context.strip():
        full_text += f". Additional Context: {additional_context.strip()}"
    
    # 1. Text Preprocessing
    cleaned_text = preprocess_text(full_text)

    # 2. Information Extraction
    extracted_info = extract_safety_information(cleaned_text, report_type)

    # 3. Hazard Identification
    identified_hazard = detect_hazard(cleaned_text)

    # 4. Safety Signal Detection
    safety_signals = detect_safety_signals(cleaned_text)

    # 5. Energy & Exposure Analysis
    energy_exposure = analyze_energy_and_exposure(cleaned_text)

    # 6. Barrier / Control Analysis
    barrier_eval = analyze_barriers(cleaned_text)

    # 7. Dynamic Classification (NEAR MISS vs UNSAFE ACT vs UNSAFE CONDITION) & Root Cause
    classification_data = classify_safety_observation(
        text=cleaned_text,
        hazard=identified_hazard,
        barrier_status=barrier_eval.get("status"),
        energy_source=energy_exposure.get("energy_source")
    )
    derived_classification = classification_data["classification"]
    derived_code = classification_data["classification_code"]
    derived_root_cause = classification_data["root_cause"]
    actual_injury = classification_data["actual_injury"]

    # Category Context using derived classification
    cat_context = get_category_context(derived_code)

    # 8. SIF Precursor Assessment & Consequence determination
    sif_result = assess_sif_precursor(
        report_type=derived_code,
        text=cleaned_text,
        hazard=identified_hazard,
        energy_source=energy_exposure.get("energy_source"),
        exposure=energy_exposure.get("exposure"),
        barrier_status=barrier_eval.get("status", "BARRIER_UNKNOWN"),
        signals=safety_signals
    )
    sif_status = sif_result.get("sif_status", "SIF" if sif_result["assessment"] in ["YES", "SIF"] else "NON-SIF")

    # 9. Explainable Result Generation
    explanation = generate_explanation(
        sif_assessment=sif_result["assessment"],
        hazard=identified_hazard,
        signals=safety_signals,
        energy_source=energy_exposure.get("energy_source"),
        exposure=energy_exposure.get("exposure"),
        barrier_desc=barrier_eval.get("description", "Not identified"),
        potential_consequence=sif_result.get("potential_consequence"),
        report_type=derived_code,
        classification=derived_classification,
        actual_injury=actual_injury,
        text=cleaned_text
    )

    # 10. Life-Saving Rules Evaluation (All 9 IOGP Rules)
    lsr_match = map_life_saving_rules(cleaned_text)

    # Structured Output (fields allow None when not identified)
    return {
        "analysis_context": cat_context["description"],
        "classification": derived_classification,
        "classification_code": derived_code,
        "sif_status": sif_status,
        "root_cause": derived_root_cause,
        "actual_injury": actual_injury,
        "identified_action": extracted_info.get("action"),
        "identified_condition": extracted_info.get("condition"),
        "identified_event": extracted_info.get("event"),
        "identified_hazard": identified_hazard or "Insufficient Information",
        "hazard": identified_hazard or "Insufficient Information",
        "safety_signals": safety_signals,
        "energy_source": energy_exposure.get("energy_source") or "Insufficient Information",
        "energy_vector": energy_exposure.get("energy_source") or "Insufficient Information",
        "exposure": energy_exposure.get("exposure") or "Insufficient Information",
        "worker_exposure": energy_exposure.get("exposure") or "Insufficient Information",
        "barrier_information": barrier_eval.get("status"),
        "barrier_status": barrier_eval.get("description", "Insufficient Information"),
        "potential_consequence": sif_result.get("potential_consequence"),
        "sif_precursor_assessment": sif_result["assessment"],
        "life_saving_rule": lsr_match,
        "explanation": explanation
    }
