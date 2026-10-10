"""
Automated Regression Test Suite for Incident Risk Scoring and Context Intelligence Engine.
Tests all prompt requirements:
1. Major explosion near fuel tanks receives risk score > 85 (Critical).
2. Spreading fire in refinery processing unit receives risk score > 85 (Critical).
3. Small controlled fire (burn pit / extinguished flame) does not receive critical score (<= 35).
4. Minor contained oil spill (50ml / drip tray) is not classified as explosion/SIF risk (<= 25).
5. Different wordings describing the same event produce consistent scores.
6. Missing/vague information produces appropriate uncertainty (lower confidence).
7. Negative controls (toolbox talks, safety drills) do not produce false alarms.
8. Severe chemical releases vs minor spills are properly discriminated.
"""

import pytest
import sys
from pathlib import Path

# Add backend to path if needed
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.ai_services.ai_service import analyze_safety_report
from app.ai_services.sif_assessment import get_risk_tier


class TestIncidentRiskScoring:

    def test_major_explosion_near_fuel_tanks_receives_critical_score(self):
        """1. Major explosion near fuel tanks receives risk score > 85 (Critical)."""
        description = "Major explosion occurred near the crude oil storage tanks, blast wave damaged piping and multiple valves."
        result = analyze_safety_report("NEAR_MISS", description)

        assert result["ai_sif_score"] > 85, f"Expected risk score > 85, got {result['ai_sif_score']}"
        assert result["ai_classification"] == "SIF-potential"
        assert result["final_ai_decision"] == "CONFIRMED SIF PRECURSOR"
        assert result["score_breakdown"]["risk_tier"] == "Critical"
        assert get_risk_tier(result["ai_sif_score"]) == "Critical"

    def test_spreading_fire_in_refinery_process_unit_receives_critical_score(self):
        """2. Spreading fire in refinery processing unit receives risk score > 85 (Critical)."""
        description = "Hydrocarbon fire erupted at the crude distillation column bottom, rapidly spreading to adjacent pipe racks."
        result = analyze_safety_report("NEAR_MISS", description)

        assert result["ai_sif_score"] > 85, f"Expected risk score > 85, got {result['ai_sif_score']}"
        assert result["ai_classification"] == "SIF-potential"
        assert result["final_ai_decision"] == "CONFIRMED SIF PRECURSOR"
        assert result["score_breakdown"]["risk_tier"] == "Critical"

    def test_small_controlled_fire_does_not_receive_critical_score(self):
        """3. Small controlled fire in burn pit or quickly extinguished flame scores <= 35."""
        description = "Small rag caught flame near burner during maintenance, immediately extinguished with dry powder within 5 seconds, no damage."
        result = analyze_safety_report("NEAR_MISS", description)

        assert result["ai_sif_score"] <= 35, f"Expected score <= 35, got {result['ai_sif_score']}"
        assert result["ai_classification"] == "Non-SIF-potential"
        assert result["final_ai_decision"] == "NON-SIF OBSERVATION"
        assert result["score_breakdown"]["risk_tier"] in ["Low", "Moderate"]

    def test_burn_pit_controlled_thermal_operation(self):
        """3b. Controlled burn pit operation does not trigger high-energy thermal alarm."""
        description = "Controlled flaring and burn pit operation routine test conducted according to standard operating procedures."
        result = analyze_safety_report("UNSAFE_CONDITION", description)

        assert result["ai_sif_score"] <= 35, f"Expected score <= 35, got {result['ai_sif_score']}"
        assert result["ai_classification"] == "Non-SIF-potential"

    def test_minor_contained_oil_spill_not_classified_as_sif(self):
        """4. Minor contained oil spill (50ml / drip tray) is not classified as explosion/SIF risk (<= 25)."""
        description = "Approximately 50ml lube oil seeped from valve flange packing onto concrete drip tray, contained with absorbent pads."
        result = analyze_safety_report("UNSAFE_CONDITION", description)

        assert result["ai_sif_score"] <= 25, f"Expected score <= 25, got {result['ai_sif_score']}"
        assert result["ai_classification"] == "Non-SIF-potential"
        assert result["final_ai_decision"] == "NON-SIF OBSERVATION"
        assert result["score_breakdown"]["risk_tier"] == "Low"

    def test_paraphrase_consistency_on_explosion(self):
        """5. Different wordings describing the same event produce reasonably consistent scores."""
        formal = "Major explosion occurred near the crude oil storage tanks, blast wave damaged piping and multiple valves."
        informal = "Huge blast erupted by fuel storage tanks, massive explosion with fire expanding fast, pipes broke!"

        res_formal = analyze_safety_report("NEAR_MISS", formal)
        res_informal = analyze_safety_report("NEAR_MISS", informal)

        score_diff = abs(res_formal["ai_sif_score"] - res_informal["ai_sif_score"])
        assert score_diff <= 10, f"Score difference between paraphrases too large: {score_diff}"
        assert res_formal["score_breakdown"]["risk_tier"] == "Critical"
        assert res_informal["score_breakdown"]["risk_tier"] == "Critical"
        assert res_formal["ai_classification"] == res_informal["ai_classification"] == "SIF-potential"

    def test_vague_or_missing_information_produces_lower_confidence(self):
        """6. Missing/vague information produces appropriate uncertainty (confidence ~45% vs >80%)."""
        vague_text = "Something smelled weird near the pump earlier today."
        detailed_text = "Crude distillation tower feed line ruptured at weld seam at 45 bar, creating unconfined hydrocarbon vapor cloud."

        res_vague = analyze_safety_report("OBSERVATION", vague_text)
        res_detailed = analyze_safety_report("INCIDENT", detailed_text)

        assert res_vague["ai_confidence"] <= 55.0, f"Expected confidence <= 55%, got {res_vague['ai_confidence']}%"
        assert res_detailed["ai_confidence"] >= 80.0, f"Expected confidence >= 80%, got {res_detailed['ai_confidence']}%"
        assert res_vague["ai_sif_score"] <= 30

    def test_negative_context_controls_toolbox_talk(self):
        """7a. Safety training / toolbox talk discussing past disasters does not trigger alarm."""
        text = "Toolbox talk held with mechanical team discussing Buncefield explosion lessons learned and fuel tank overfill risks."
        result = analyze_safety_report("OBSERVATION", text)

        assert result["ai_sif_score"] <= 20, f"Expected score <= 20, got {result['ai_sif_score']}"
        assert result["ai_classification"] == "Non-SIF-potential"
        assert result["final_ai_decision"] == "NON-SIF OBSERVATION"

    def test_negative_context_controls_fire_drill(self):
        """7b. Fire drill simulation does not trigger alarm."""
        text = "Scheduled annual refinery emergency evacuation drill conducted, tested deluge valves and siren system."
        result = analyze_safety_report("OBSERVATION", text)

        assert result["ai_sif_score"] <= 20, f"Expected score <= 20, got {result['ai_sif_score']}"
        assert result["ai_classification"] == "Non-SIF-potential"
        assert result["final_ai_decision"] == "NON-SIF OBSERVATION"

    def test_contained_spill_vs_major_chemical_release_discrimination(self):
        """8. Differentiates minor drip from catastrophic chemical release."""
        minor_spill = "Small 30ml oil drop on motor casing caught in drip pan."
        major_release = "Acid drum ruptured during forklift transfer, leaking 500 liters of 70% hydrofluoric acid forming visible toxic cloud."

        res_minor = analyze_safety_report("NEAR_MISS", minor_spill)
        res_major = analyze_safety_report("NEAR_MISS", major_release)

        assert res_minor["ai_sif_score"] <= 20
        assert res_minor["ai_classification"] == "Non-SIF-potential"

        assert res_major["ai_sif_score"] >= 86
        assert res_major["ai_classification"] == "SIF-potential"
        assert res_major["score_breakdown"]["risk_tier"] == "Critical"

    def test_fire_explosion_near_pipeline_receives_critical_score(self):
        """9. Pipeline fire explosion receives score > 85 (Critical, 92-96)."""
        result = analyze_safety_report("UNSAFE_CONDITION", "fire explosion near pipeline")
        assert result["ai_sif_score"] > 85, f"Expected risk score > 85, got {result['ai_sif_score']}"
        assert result["ai_classification"] == "SIF-potential"
        assert result["final_ai_decision"] == "CONFIRMED SIF PRECURSOR"
        assert result["score_breakdown"]["risk_tier"] == "Critical"

    def test_fire_explotion_typo_receives_critical_score(self):
        """10. Worker spelling typo 'fire explotion' receives score > 85 (Critical, 92-96)."""
        result = analyze_safety_report("UNSAFE_CONDITION", "fire explotion")
        assert result["ai_sif_score"] > 85, f"Expected risk score > 85, got {result['ai_sif_score']}"
        assert result["ai_classification"] == "SIF-potential"
        assert result["final_ai_decision"] == "CONFIRMED SIF PRECURSOR"
        assert result["score_breakdown"]["risk_tier"] == "Critical"
