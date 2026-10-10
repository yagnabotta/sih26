"""
Automated Test Suite for Weak Signal Correlation Logic
======================================================
Tests the 10 specific requirements defined in the Safety Precursor AI specification:

1. Gas leak + related fire -> identify a possible connected ignition hazard when supporting evidence exists.
2. Two unrelated small fires -> do not infer a major fire.
3. Two gas leaks with a documented shared pipeline -> identify a possible common hazard.
4. Two gas leaks without sufficient relationship evidence -> do not assert a common cause.
5. Repeated machinery hazards + a related near miss -> flag a potential recurring machinery risk.
6. Two incidents with similar descriptions but unrelated causes -> avoid false correlation.
7. Missing timestamps or locations -> represent uncertainty instead of inventing a connection.
8. One serious isolated hazard -> retain its appropriate risk priority even without a second report.
9. Multiple related reports with effective safety controls -> account for the controls when assessing residual risk.
10. Duplicate reports -> do not inflate the risk merely because the same report appears multiple times.
"""

import pytest
from backend.app.ai_services.signal_correlation import evaluate_report_pair_or_group


# ---------------------------------------------------------------------------
# Test Case 1: Gas leak + related fire -> identify possible connected ignition hazard
# ---------------------------------------------------------------------------
def test_case_1_gas_leak_plus_related_fire():
    reports = [
        {
            "report_id": "REP-01",
            "description": "Minor hydrocarbon gas leak reported around compressor flange with audible hissing sound.",
            "location": "Unit 1 Compressor Bay",
            "report_date": "2026-10-01",
            "report_type": "Near Miss",
            "observed_severity": "Moderate"
        },
        {
            "report_id": "REP-02",
            "description": "Small fire and open flame observed at electrical conduit in compressor bay.",
            "location": "Unit 1 Compressor Bay",
            "report_date": "2026-10-01",
            "report_type": "Incident",
            "observed_severity": "Moderate"
        }
    ]
    result = evaluate_report_pair_or_group(reports)
    
    assert result["cluster_detected"] is True, "Gas leak + related fire in same facility must detect a cluster"
    assert "Gas" in result["relationship"] and ("Ignition" in result["relationship"] or "Fire" in result["relationship"])
    assert result["combined_risk"] in ["HIGH", "CRITICAL"], "Combined risk must reflect significant hazard"
    assert result["confidence_level"] in ["CONFIRMED", "PLAUSIBLE"]
    # Must recommend investigation and not claim certainty of catastrophic explosion
    assert "investigation" in result["reason"].lower() or "urgent" in result["reason"].lower() or "potential" in result["reason"].lower()


# ---------------------------------------------------------------------------
# Test Case 2: Two unrelated small fires -> do not infer a major fire
# ---------------------------------------------------------------------------
def test_case_2_two_unrelated_small_fires():
    reports = [
        {
            "report_id": "FIRE-01",
            "description": "Minor electrical conduit fire extinguished in isolated warehouse storage area.",
            "location": "Remote Warehouse Sector D",
            "report_date": "2026-10-02",
            "report_type": "Incident",
            "observed_severity": "Low"
        },
        {
            "report_id": "FIRE-02",
            "description": "Small toaster kitchen fire in the administration office cafeteria pantry.",
            "location": "Administration Building Kitchen",
            "report_date": "2026-10-02",
            "report_type": "Incident",
            "observed_severity": "Low"
        }
    ]
    result = evaluate_report_pair_or_group(reports)

    # Must NOT infer a major fire or high risk cluster
    assert result["cluster_detected"] is False, "Unrelated small fires in disconnected buildings must not be combined"
    assert result["combined_risk"] == "LOW", "Combined risk must remain LOW"
    assert result["risk_classification"].lower() == "low"
    assert "Unrelated" in result["relationship"] or "Disconnected" in result["relationship"]
    assert "does not infer a major fire" in result["reason"].lower() or "separate" in result["reason"].lower()


# ---------------------------------------------------------------------------
# Test Case 3: Two gas leaks with a documented shared pipeline -> identify common hazard
# ---------------------------------------------------------------------------
def test_case_3_two_gas_leaks_shared_pipeline():
    reports = [
        {
            "report_id": "GAS-01",
            "description": "Minor methane gas leak detected at flanged joint on Pipeline P-101 in Unit 1.",
            "location": "Unit 1",
            "equipment": "Pipeline P-101",
            "report_date": "2026-10-03",
            "report_type": "Near Miss",
            "observed_severity": "Moderate"
        },
        {
            "report_id": "GAS-02",
            "description": "Secondary gas leak detected around valve packing along Pipeline P-101 in Unit 2.",
            "location": "Unit 2",
            "equipment": "Pipeline P-101",
            "report_date": "2026-10-04",
            "report_type": "Near Miss",
            "observed_severity": "Moderate"
        }
    ]
    result = evaluate_report_pair_or_group(reports)

    assert result["cluster_detected"] is True, "Two gas leaks on shared Pipeline P-101 must identify common hazard"
    assert "Pipeline" in result["pattern_name"] or "Pipeline" in result["relationship"]
    assert result["confidence_level"] == "CONFIRMED"
    assert result["combined_risk"] in ["MODERATE", "HIGH"]
    assert "pipeline" in result["reason"].lower() or "common" in result["reason"].lower()


# ---------------------------------------------------------------------------
# Test Case 4: Two gas leaks without sufficient relationship evidence -> do not assert common cause
# ---------------------------------------------------------------------------
def test_case_4_two_gas_leaks_unrelated_sources():
    reports = [
        {
            "report_id": "GL-NORTH",
            "description": "Minor propane cylinder valve weep detected at outdoor storage cage in Site North Depot.",
            "location": "Site North Depot",
            "report_date": "2026-10-01",
            "report_type": "Near Miss",
            "observed_severity": "Minor"
        },
        {
            "report_id": "GL-SOUTH",
            "description": "Minor laboratory natural gas burner line seep at testing facility in Site South Tech Center.",
            "location": "Site South Tech Center",
            "report_date": "2026-10-05",
            "report_type": "Near Miss",
            "observed_severity": "Minor"
        }
    ]
    result = evaluate_report_pair_or_group(reports)

    assert result["cluster_detected"] is False, "Independent gas leaks across unrelated sites must not assert common cause"
    assert result["confidence_level"] == "UNSUPPORTED"
    assert result["combined_risk"] == "LOW"
    assert "does not assert a common cause" in result["reason"].lower() or "independent" in result["reason"].lower()


# ---------------------------------------------------------------------------
# Test Case 5: Repeated machinery hazards + related near miss -> flag recurring machinery risk
# ---------------------------------------------------------------------------
def test_case_5_repeated_machinery_hazard_plus_near_miss():
    reports = [
        {
            "report_id": "MACH-01",
            "description": "Inadequate machine guarding observed on Conveyor Line 3 drive roller.",
            "location": "Packaging Bay Unit 2",
            "equipment": "Conveyor Line 3",
            "report_date": "2026-10-02",
            "report_type": "Unsafe Condition",
            "observed_severity": "Moderate"
        },
        {
            "report_id": "MACH-02",
            "description": "Worker almost injured when sleeve was nearly caught in Conveyor Line 3 rotating nip point; pulled away in time.",
            "location": "Packaging Bay Unit 2",
            "equipment": "Conveyor Line 3",
            "report_date": "2026-10-03",
            "report_type": "Near Miss",
            "observed_severity": "Moderate"
        }
    ]
    result = evaluate_report_pair_or_group(reports)

    assert result["cluster_detected"] is True, "Guarding condition + related near-miss must flag recurring machinery hazard"
    assert result["combined_risk"] == "HIGH"
    assert "Machinery" in result["relationship"] or "Guarding" in result["relationship"]
    assert "Amputation" in result["potential_consequence"] or "Entanglement" in result["potential_consequence"]
    assert result["confidence_level"] == "CONFIRMED"


# ---------------------------------------------------------------------------
# Test Case 6: Two incidents with similar descriptions but unrelated causes -> avoid false correlation
# ---------------------------------------------------------------------------
def test_case_6_similar_descriptions_unrelated_causes():
    reports = [
        {
            "report_id": "SLIP-01",
            "description": "Worker slipped and lost balance on icy patch on sidewalk during winter morning frost.",
            "location": "Employee Parking Lot Sidewalk",
            "report_date": "2026-10-01",
            "report_type": "Incident",
            "observed_severity": "Low"
        },
        {
            "report_id": "SLIP-02",
            "description": "Worker slipped on spilled cooking oil on floor in main cafeteria kitchen pantry.",
            "location": "Cafeteria Kitchen",
            "report_date": "2026-10-02",
            "report_type": "Incident",
            "observed_severity": "Low"
        }
    ]
    result = evaluate_report_pair_or_group(reports)

    # Must avoid false correlation based on mere token overlap ('slipped')
    assert result["cluster_detected"] is False, "Disparate causes (ice vs cooking oil in separate facilities) must reject false correlation"
    assert result["combined_risk"] == "LOW"
    assert result["confidence_level"] == "UNSUPPORTED"
    assert "distinct" in result["reason"].lower() or "unrelated" in result["reason"].lower() or "rejected" in result["reason"].lower()


# ---------------------------------------------------------------------------
# Test Case 7: Missing timestamps or locations -> represent uncertainty instead of inventing connection
# ---------------------------------------------------------------------------
def test_case_7_missing_timestamps_or_locations():
    reports = [
        {
            "report_id": "REP-MISSING-LOC",
            "description": "Gas is hissing and leaking from a pressurized flange line.",
            "location": None,  # Missing location
            "report_date": None,  # Missing date
            "report_type": "Near Miss",
            "observed_severity": "Moderate"
        },
        {
            "report_id": "REP-HOT-WORK",
            "description": "Hot work welding sparks emitted near fuel line.",
            "location": "Unit 2 Process Area",
            "report_date": "2026-10-05",
            "report_type": "Unsafe Act",
            "observed_severity": "Moderate"
        }
    ]
    result = evaluate_report_pair_or_group(reports)

    # Must NOT invent location (cannot assume they are in Unit 1 or Unit 2)
    assert result["confidence_level"] == "UNCERTAIN", "Missing location/timestamp must be classified as UNCERTAIN"
    assert len(result["missing_information"]) > 0, "Must explicitly list missing data fields"
    assert any("location" in m.lower() for m in result["missing_information"])
    assert "uncertainty" in result["reason"].lower() or "missing" in result["reason"].lower()
    # Risk should not be asserted as high/critical without verification
    assert result["combined_risk"] != "CRITICAL"


# ---------------------------------------------------------------------------
# Test Case 8: One serious isolated hazard -> retain appropriate risk priority without second report
# ---------------------------------------------------------------------------
def test_case_8_one_serious_isolated_hazard():
    reports = [
        {
            "report_id": "CRIT-01",
            "description": "Catastrophic high-pressure gas pipeline rupture with 50 bar methane release and massive blowout.",
            "location": "Unit 3 Main Header",
            "report_date": "2026-10-05",
            "report_type": "Incident",
            "observed_severity": "Critical"
        }
    ]
    result = evaluate_report_pair_or_group(reports)

    # Must NOT downgrade to LOW merely because only 1 report exists
    assert result["combined_risk"] in ["HIGH", "CRITICAL"], "Severe isolated hazard must retain high operational priority"
    assert result["risk_classification"] in ["High", "Critical"]
    assert result["correlation_score"] >= 80
    assert "isolated" in result["relationship"].lower() or "isolated" in result["pattern_name"].lower()


# ---------------------------------------------------------------------------
# Test Case 9: Multiple related reports with effective safety controls -> account for residual risk
# ---------------------------------------------------------------------------
def test_case_9_effective_safety_controls_reduce_residual_risk():
    reports = [
        {
            "report_id": "GAS-MITIGATED",
            "description": "Gas leak detected at flange; line immediately isolated by ESD valves and atmosphere ventilated to 0% LEL.",
            "location": "Unit 1 Compressor Bay",
            "report_date": "2026-10-05",
            "report_type": "Near Miss",
            "observed_severity": "Moderate"
        },
        {
            "report_id": "FIRE-MITIGATED",
            "description": "Hot work sparks initiated small smolder; fire immediately extinguished with dry chemical in 5 seconds and power de-energized under LOTO.",
            "location": "Unit 1 Compressor Bay",
            "report_date": "2026-10-05",
            "report_type": "Incident",
            "observed_severity": "Moderate"
        }
    ]
    result = evaluate_report_pair_or_group(reports)

    # Active controls verified: residual risk should be Moderate/Low, NOT Critical
    assert result["cluster_detected"] is True
    assert result["combined_risk"] in ["MODERATE", "LOW"], f"Residual risk should be Moderate or Low, got {result['combined_risk']}"
    assert len(result["residual_controls_identified"]) > 0, "Must record verified active controls"
    assert "controls" in result["reason"].lower() or "mitigated" in result["reason"].lower()


# ---------------------------------------------------------------------------
# Test Case 10: Duplicate reports -> do not inflate the risk
# ---------------------------------------------------------------------------
def test_case_10_duplicate_reports_do_not_inflate_risk():
    reports = [
        {
            "report_id": "DUP-01",
            "description": "Minor hydraulic oil drip from pump P-102 casing seal onto concrete drip pan.",
            "location": "Pump House Bay B",
            "report_date": "2026-10-06",
            "report_type": "Unsafe Condition",
            "observed_severity": "Minor"
        },
        {
            "report_id": "DUP-02",
            "description": "Minor hydraulic oil drip from pump P-102 casing seal onto concrete drip pan.",
            "location": "Pump House Bay B",
            "report_date": "2026-10-06",
            "report_type": "Unsafe Condition",
            "observed_severity": "Minor"
        }
    ]
    result = evaluate_report_pair_or_group(reports)

    # Must NOT inflate score or create escalating cluster
    assert result["cluster_detected"] is False, "Duplicate reports must not create an escalating cluster"
    assert result["combined_risk"] == "LOW", "Risk must not be inflated for duplicate submissions"
    assert result["correlation_score"] <= 35
    assert "duplicate" in result["relationship"].lower() or "duplicate" in result["pattern_name"].lower()
    assert "not inflated" in result["reason"].lower() or "duplicate" in result["reason"].lower()
