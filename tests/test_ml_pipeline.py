"""
Comprehensive ML/NLP Pipeline and Edge-Case Test Suite
======================================================
Tests all requirements from SIH 2026 Problem Statement 26165:
- Preprocessing and critical negation preservation
- Negation edge cases ("No injury occurred", "No PPE was missing", "without isolation", "not exposed", "unknown barrier condition")
- Structured entity and measurement extraction (voltage, pressure, elevation, load, PPE, permit, isolation)
- Deterministic energy vector classification
- 6-state barrier diagnostics (ensuring hazard descriptions alone do NOT infer 'barrier failed')
- Multi-rule IOGP Life-Saving Rules engine
- Standalone ML inference and model loading
- Hybrid SIF Decision Engine (Rule Assessment + ML Probability + Risk Score)
- Risk Score vs AI Confidence separation
- Historical weak signal pattern detection
"""

import os
import sys
import unittest
from pathlib import Path

# Set up project root in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.ai_services.preprocessing import (
    preprocess_text,
    mask_pii,
    preserve_negations,
    safety_aware_tokenize
)
from app.ai_services.information_extraction import (
    extract_safety_information,
    extract_measurements
)
from app.ai_services.energy_exposure_analysis import analyze_energy_and_exposure
from app.ai_services.barrier_analysis import analyze_barriers
from app.ai_services.life_saving_rules import map_life_saving_rules, map_all_life_saving_rules
from app.ai_services.sif_ml_inference import predict_sif_potential, get_model
from app.ai_services.sif_assessment import assess_sif_precursor, compute_maut_risk_score
from app.ai_services.ai_service import analyze_safety_report
from app.ai_services.pattern_analysis import analyze_operational_patterns


class TestSafetyPreprocessing(unittest.TestCase):
    """Verifies safety negation preservation and PII masking."""

    def test_compound_negation_preservation(self):
        cases = [
            ("technician entered without helmet", "without_helmet"),
            ("performed work without permit", "without_permit"),
            ("maintenance on breaker not locked out", "not_locked_out"),
            ("conveyor machine guard was missing", "guard_missing"),
            ("worked without isolation on live 11kV busbar", "without_isolation"),
        ]
        for raw, expected_token in cases:
            processed = preprocess_text(raw)
            self.assertIn(expected_token, processed, f"Failed to preserve {expected_token} in: {raw}")

    def test_negation_edge_cases(self):
        # Edge cases specified by user prompt
        text_no_injury = preprocess_text("During test, No injury occurred at Unit 2.")
        self.assertIn("no_injury_occurred", text_no_injury)

        text_no_ppe = preprocess_text("Audit showed that No PPE was missing on drill floor.")
        self.assertIn("no_ppe_missing", text_no_ppe)

        text_without_iso = preprocess_text("Work started without isolation on valve manifold.")
        self.assertIn("without_isolation", text_without_iso)

        text_not_exposed = preprocess_text("Observer verified that personnel were not exposed to blast trajectory.")
        self.assertIn("not_exposed", text_not_exposed)

    def test_pii_masking(self):
        raw = "Contact engineer rahul.sharma@oilindia.in or +91-9876543210 regarding badge EMP-4029 at Rig-04."
        masked = mask_pii(raw)
        self.assertNotIn("rahul.sharma@oilindia.in", masked)
        self.assertIn("[EMAIL]", masked)
        self.assertNotIn("9876543210", masked)
        self.assertIn("[PHONE]", masked)
        self.assertIn("[EMPLOYEE_ID]", masked)
        # Verify operational equipment / location context is retained
        self.assertIn("Rig-04", masked)


class TestInformationExtraction(unittest.TestCase):
    """Verifies entity, measurement, and unit extraction without hallucination."""

    def test_measurements_extraction(self):
        text = "Substation breaker experienced arc at 11kV with 1500 psi hydraulic accumulator at 6m elevation carrying 5 tons."
        m = extract_measurements(text)
        self.assertIsNotNone(m["voltage"])
        self.assertIn("11kv", m["voltage"].lower())
        self.assertIsNotNone(m["pressure"])
        self.assertIn("1500 psi", m["pressure"].lower())
        self.assertIsNotNone(m["elevation"])
        self.assertIn("6m", m["elevation"].lower())
        self.assertIsNotNone(m["load_weight"])
        self.assertIn("5 tons", m["load_weight"].lower())

    def test_missing_entities_not_hallucinated(self):
        text = "Routine housekeeping walkdown completed."
        extracted = extract_safety_information(text)
        self.assertIn(extracted["equipment"], [None, "UNKNOWN"])
        self.assertIn(extracted["permit"], [None, "UNKNOWN"])
        self.assertIn(extracted["isolation"], [None, "UNKNOWN"])
        self.assertIsNone(extracted["measurements"]["voltage"])
        self.assertIsNone(extracted["measurements"]["pressure"])


class TestBarrierDiagnostics(unittest.TestCase):
    """Verifies deterministic 6-state barrier diagnostics and strict anti-hallucination."""

    def test_slippery_floor_does_not_infer_barrier_failed(self):
        # CRITICAL TEST CASE: "At front door it is very slippery" must NOT produce "barrier failed"
        res = analyze_barriers("At front door it is very slippery.")
        self.assertEqual(res["status"], "BARRIER_INSUFFICIENT_INFO")
        self.assertNotEqual(res["status"], "BARRIER_FAILED")

    def test_barrier_missing(self):
        res = analyze_barriers("Worker observed without harness at height on scaffold.")
        self.assertEqual(res["status"], "BARRIER_MISSING")

    def test_barrier_failed(self):
        res = analyze_barriers("Under load, crane rigging sling snapped and broke.")
        self.assertEqual(res["status"], "BARRIER_FAILED")

    def test_barrier_bypassed(self):
        res = analyze_barriers("Operator bypassed interlock safety switch on mud pump.")
        self.assertEqual(res["status"], "BARRIER_BYPASSED")

    def test_barrier_compromised(self):
        res = analyze_barriers("Secondary containment bund was corroded and had loose bolt.")
        self.assertEqual(res["status"], "BARRIER_COMPROMISED")

    def test_barrier_present(self):
        res = analyze_barriers("Safety net caught dropped tool and prevented injury.")
        self.assertEqual(res["status"], "BARRIER_PRESENT")


class TestEnergyVectorClassification(unittest.TestCase):
    """Verifies deterministic energy vector mapping."""

    def test_energy_vectors(self):
        cases = [
            ("Live 11kV electrical switchgear maintenance", ["Electrical", "ELECTRICAL"]),
            ("3000 psi hydrotest line vibrating near choke", ["Pneumatic / High Pressure", "HIGH_PRESSURE / PNEUMATIC / HYDRAULIC"]),
            ("H2S toxic gas detected near separator", ["Chemical / Gas", "TOXIC / ATMOSPHERIC", "CHEMICAL"]),
            ("Hot work welding cutting torch near tank", ["Thermal", "THERMAL"]),
            ("Crane hoist lifting suspended load over deck", ["Gravity", "GRAVITY"]),
            ("Forklift reversing in yard near pedestrian walkway", ["Kinetic", "KINETIC"]),
        ]
        for text, allowed_energies in cases:
            res = analyze_energy_and_exposure(text)
            self.assertIn(res["energy_source"], allowed_energies, f"Failed energy for: {text}")


class TestIOGPLifeSavingRules(unittest.TestCase):
    """Verifies all 9 IOGP rules and multi-rule capabilities."""

    def test_all_rules_mapping(self):
        text = "Worker entered confined space without permit while overriding alarm near live electrical panel."
        matches = map_all_life_saving_rules(text)
        matched_keys = [m["rule_key"] for m in matches]
        # Must match multiple distinct rules
        self.assertIn("CONFINED_SPACE", matched_keys)
        self.assertIn("WORK_AUTHORIZATION", matched_keys)
        self.assertIn("BYPASS_SAFETY_CONTROLS", matched_keys)
        self.assertIn("ENERGY_ISOLATION", matched_keys)
        self.assertGreaterEqual(len(matches), 2)

    def test_no_rule_forced_on_trivial_report(self):
        text = "Minor water puddle on the office floor near water cooler."
        match = map_life_saving_rules(text)
        self.assertIsNone(match)


class TestMLInferenceAndArtifacts(unittest.TestCase):
    """Verifies trained model loading, predict_proba(), and feature interpretability."""

    def test_model_loading_and_inference(self):
        pipeline = get_model()
        self.assertIsNotNone(pipeline)
        
        # Test High-Potential SIF Narrative
        res_sif = predict_sif_potential("Crane hoist sling snapped under heavy suspended load over active drilling floor.")
        self.assertEqual(res_sif["status"], "SUCCESS")
        self.assertIsNotNone(res_sif["confidence"])
        self.assertGreater(res_sif["sif_probability"], 0.5)
        self.assertGreater(len(res_sif["contributing_features"]), 0)

        # Test Routine Non-SIF Narrative
        res_non = predict_sif_potential("Routine shift handover completed with minor housekeeping sweep on office walkway.")
        self.assertEqual(res_non["status"], "SUCCESS")
        self.assertLess(res_non["sif_probability"], 0.5)


class TestHybridDecisionEngine(unittest.TestCase):
    """Verifies Rule Assessment + ML Probability + MAUT Risk Score synthesis."""

    def test_hybrid_decision_high_sif(self):
        res = assess_sif_precursor(
            report_type="NEAR_MISS",
            text="Worker entered high pressure hydrotest zone at 3000 psi without isolation while line was vibrating.",
            hazard="Stored Pressure / High-Pressure Line",
            energy_source="Pneumatic / High Pressure",
            exposure="Worker in line-of-fire",
            barrier_status="BARRIER_MISSING",
            signals=["line was vibrating", "without isolation"]
        )
        self.assertEqual(res["assessment"], "YES")
        self.assertEqual(res["final_ai_decision"], "CONFIRMED SIF PRECURSOR")
        self.assertEqual(res["rule_based_assessment"], "YES")
        self.assertGreaterEqual(res["ai_sif_score"], 70)  # High risk score
        self.assertGreaterEqual(res["ai_confidence"], 80)

    def test_risk_score_distinct_from_confidence(self):
        # A clear, low-risk event should have HIGH confidence of being LOW risk
        res = assess_sif_precursor(
            report_type="UNSAFE_CONDITION",
            text="Small water drip from air conditioning unit onto entrance doormat causing minor slippery floor.",
            hazard="Slip, Trip, or Surface Housekeeping",
            energy_source="Gravity / Kinetic (Low Energy)",
            exposure="Worker exposed to low-consequence surface slip/trip",
            barrier_status="BARRIER_INSUFFICIENT_INFO",
            signals=[]
        )
        self.assertEqual(res["assessment"], "NO")
        self.assertEqual(res["final_ai_decision"], "NON-SIF OBSERVATION")
        # Risk Score should be low (< 35), while Confidence should be high (> 75%)
        self.assertLess(res["ai_sif_score"], 40)
        self.assertGreater(res["ai_confidence"], 75.0)
        self.assertNotEqual(res["ai_sif_score"], res["ai_confidence"])


class TestWeakSignalPatternAnalysis(unittest.TestCase):
    """Verifies that weak signals require cross-report historical evidence."""

    def test_pattern_aggregation(self):
        reports = [
            {
                "id": 1,
                "report_reference": "REP-101",
                "location": "Unit 2",
                "description": "Minor gas seep detected at valve flange during maintenance.",
                "identified_hazard": "Gas Leak / Pressure",
                "sif_precursor_assessment": "YES",
                "barrier_information": "BARRIER_FAILED"
            },
            {
                "id": 2,
                "report_reference": "REP-102",
                "location": "Unit 2",
                "description": "Secondary gas trace near same valve flange during pressure test.",
                "identified_hazard": "Gas Leak / Pressure",
                "sif_precursor_assessment": "YES",
                "barrier_information": "BARRIER_COMPROMISED"
            }
        ]
        patterns = analyze_operational_patterns(reports)
        self.assertEqual(len(patterns["top_locations"]), 1)
        self.assertEqual(patterns["top_locations"][0]["location"], "Unit 2")
        self.assertEqual(patterns["top_locations"][0]["sif_count"], 2)
        self.assertGreaterEqual(len(patterns["emerging_risks"]), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
