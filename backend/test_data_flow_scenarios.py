import sys
import os

# Ensure backend package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.ai_services.signal_correlation import evaluate_report_pair_or_group
from backend.app.services.weak_signal_service import get_weak_signals_for_organization
from backend.app.database import SessionLocal, Base, engine
from backend.app.models.safety_report import SafetyReport
from backend.app.models.ai_analysis import AIAnalysis

def run_scenario_tests():
    print("=================================================================")
    print("      VERIFYING DYNAMIC HAZARD CONSEQUENCE DATA FLOW            ")
    print("=================================================================")

    # -------------------------------------------------------------
    # Scenario 1: Gas Pipeline Leak + Open Flame
    # -------------------------------------------------------------
    r1 = {
        "report_id": "USER-REP-01",
        "description": "Gas pipeline is leaking in the compressor room.",
        "location": "Unit 1",
        "report_type": "Unsafe Condition"
    }
    r2 = {
        "report_id": "USER-REP-02",
        "description": "Open flame is present near the leak.",
        "location": "Unit 1",
        "report_type": "Unsafe Act"
    }
    res1 = evaluate_report_pair_or_group([r1, r2])
    print("\nScenario 1 (Gas + Flame):")
    print("  Cluster Detected:", res1["cluster_detected"])
    print("  Relationship:", res1["relationship"])
    print("  Consequence:", res1["potential_consequence"])
    assert res1["cluster_detected"] is True
    assert "Fire" in res1["potential_consequence"] or "Explosion" in res1["potential_consequence"]
    assert res1["signals"][0]["report_id"] == "USER-REP-01"
    assert res1["signals"][1]["report_id"] == "USER-REP-02"
    print("  >>> PASS: Gas + Flame produced Fire/Explosion dynamically!")

    # -------------------------------------------------------------
    # Scenario 2: Hydraulic Oil Leak + Worker Slipped
    # -------------------------------------------------------------
    r3 = {
        "report_id": "USER-REP-03",
        "description": "Hydraulic oil is leaking onto the floor.",
        "location": "Unit 2",
        "report_type": "Unsafe Condition"
    }
    r4 = {
        "report_id": "USER-REP-04",
        "description": "Worker slipped on the oily floor.",
        "location": "Unit 2",
        "report_type": "Near Miss"
    }
    res2 = evaluate_report_pair_or_group([r3, r4])
    print("\nScenario 2 (Oil Leak + Slip):")
    print("  Cluster Detected:", res2["cluster_detected"])
    print("  Relationship:", res2["relationship"])
    print("  Consequence:", res2["potential_consequence"])
    assert res2["cluster_detected"] is True
    assert "Slip" in res2["potential_consequence"] or "Fall" in res2["potential_consequence"]
    assert "Fire" not in res2["potential_consequence"], "Should NOT produce Fire consequence!"
    assert res2["signals"][0]["report_id"] == "USER-REP-03"
    assert res2["signals"][1]["report_id"] == "USER-REP-04"
    print("  >>> PASS: Oil Leak + Slip produced Slip/Fall consequence (NOT Fire/Explosion)!")

    # -------------------------------------------------------------
    # Scenario 3: Electrical Cable Damaged + Worker Exposed
    # -------------------------------------------------------------
    r5 = {
        "report_id": "USER-REP-05",
        "description": "Electrical cable has damaged insulation.",
        "location": "Unit 3",
        "report_type": "Unsafe Condition"
    }
    r6 = {
        "report_id": "USER-REP-06",
        "description": "Worker is working near exposed conductors.",
        "location": "Unit 3",
        "report_type": "Unsafe Act"
    }
    res3 = evaluate_report_pair_or_group([r5, r6])
    print("\nScenario 3 (Electrical Damage + Exposure):")
    print("  Cluster Detected:", res3["cluster_detected"])
    print("  Relationship:", res3["relationship"])
    print("  Consequence:", res3["potential_consequence"])
    assert res3["cluster_detected"] is True
    assert "Shock" in res3["potential_consequence"] or "Arc Flash" in res3["potential_consequence"] or "Electrical" in res3["potential_consequence"]
    assert "Fire" not in res3["potential_consequence"], "Should NOT produce Fire consequence!"
    assert res3["signals"][0]["report_id"] == "USER-REP-05"
    assert res3["signals"][1]["report_id"] == "USER-REP-06"
    print("  >>> PASS: Electrical Damage + Exposure produced Electrical Shock / Arc Flash risk!")

    # -------------------------------------------------------------
    # Scenario 4: Worker At Height + Guardrail Missing
    # -------------------------------------------------------------
    r7 = {
        "report_id": "USER-REP-07",
        "description": "Worker is working at height on elevated platform.",
        "location": "Unit 4",
        "report_type": "Unsafe Act"
    }
    r8 = {
        "report_id": "USER-REP-08",
        "description": "Guardrail is missing on elevated platform edge.",
        "location": "Unit 4",
        "report_type": "Unsafe Condition"
    }
    res4 = evaluate_report_pair_or_group([r7, r8])
    print("\nScenario 4 (Height + Missing Guardrail):")
    print("  Cluster Detected:", res4["cluster_detected"])
    print("  Relationship:", res4["relationship"])
    print("  Consequence:", res4["potential_consequence"])
    assert res4["cluster_detected"] is True
    assert "Fall" in res4["potential_consequence"] or "Height" in res4["potential_consequence"]
    assert "Fire" not in res4["potential_consequence"], "Should NOT produce Fire consequence!"
    assert res4["signals"][0]["report_id"] == "USER-REP-07"
    assert res4["signals"][1]["report_id"] == "USER-REP-08"
    print("  >>> PASS: Height + Missing Guardrail produced Fall From Height risk!")

    # -------------------------------------------------------------
    # Scenario 5: Chemical Container Leak + Worker Exposed
    # -------------------------------------------------------------
    r9 = {
        "report_id": "USER-REP-09",
        "description": "Chemical container is leaking toxic acid fumes.",
        "location": "Unit 5",
        "report_type": "Unsafe Condition"
    }
    r10 = {
        "report_id": "USER-REP-10",
        "description": "Worker is exposed to the chemical without respirator.",
        "location": "Unit 5",
        "report_type": "Unsafe Act"
    }
    res5 = evaluate_report_pair_or_group([r9, r10])
    print("\nScenario 5 (Chemical Leak + Exposure):")
    print("  Cluster Detected:", res5["cluster_detected"])
    print("  Relationship:", res5["relationship"])
    print("  Consequence:", res5["potential_consequence"])
    assert res5["cluster_detected"] is True
    assert "Chemical" in res5["potential_consequence"] or "Inhalation" in res5["potential_consequence"] or "Burn" in res5["potential_consequence"]
    assert "Fire" not in res5["potential_consequence"], "Should NOT produce Fire consequence!"
    assert res5["signals"][0]["report_id"] == "USER-REP-09"
    assert res5["signals"][1]["report_id"] == "USER-REP-10"
    print("  >>> PASS: Chemical Leak + Exposure produced Chemical Exposure / Injury!")

    print("\n=================================================================")
    print("         ALL 5 DYNAMIC SCENARIOS VALIDATED SUCCESSFULLY!         ")
    print("=================================================================")

if __name__ == "__main__":
    run_scenario_tests()
