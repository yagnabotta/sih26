import json
import pytest
from backend.app.schemas.ai_analysis import AIAnalysisRequest
from backend.app.ai_services.ai_service import analyze_safety_report
from backend.app.ai_services.context_analyzer import classify_incident_category
from backend.app.ai_services.safety_validity import classify_safety_observation_validity

EXPECTED_15_OPTIONS = [
    "Gas Leak",
    "Oil Spill",
    "Chemical Spill",
    "Fire or Smoke",
    "Broken Machine",
    "Exposed Electric Wires",
    "Slippery Floor",
    "Broken Ladder or Platform",
    "Missing Safety Gear",
    "Uncovered Pit or Hole",
    "Falling Objects",
    "Blocked Emergency Exit",
    "Unsafe Chemical Storage",
    "Heavy Load Falling",
    "Broken Fire Extinguisher"
]

def test_exactly_15_options_defined():
    # Verify exact count and unique names
    assert len(EXPECTED_15_OPTIONS) == 15
    assert len(set(EXPECTED_15_OPTIONS)) == 15

def test_all_15_options_valid_safety_observations():
    for option in EXPECTED_15_OPTIONS:
        validity = classify_safety_observation_validity(f"Safety Factors: {option}")
        assert not validity["is_unrelated"], f"Option '{option}' was classified as unrelated!"

def test_ai_analysis_request_normalization():
    # Test normalization of checklist field into additional_context
    req = AIAnalysisRequest(
        report_text="",
        location="Unit 1",
        checklist=["Gas Leak", "Exposed Electric Wires"]
    )
    assert req.additional_context == "Safety Factors: Gas Leak, Exposed Electric Wires"

    # Test selected_checklist fallback
    req2 = AIAnalysisRequest(
        report_text="",
        location="Unit 1",
        selected_checklist=["Broken Fire Extinguisher"]
    )
    assert req2.additional_context == "Safety Factors: Broken Fire Extinguisher"

def test_ai_service_analysis_with_checklist_options():
    for option in ["Gas Leak", "Exposed Electric Wires", "Missing Safety Gear", "Falling Objects"]:
        res = analyze_safety_report(
            report_type="UNSAFE_CONDITION",
            description=f"Safety Factors: {option}",
            additional_context=f"Safety Factors: {option}"
        )
        assert res is not None
        assert "sif_precursor_assessment" in res
        assert "final_ai_decision" in res
        assert "identified_hazard" in res
