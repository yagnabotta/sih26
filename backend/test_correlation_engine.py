import sys
import os

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.database import SessionLocal, Base, engine
from backend.app.seed_data import seed_sample_data
from backend.app.ai_services.sif_ml_inference import predict_sif_potential
from backend.app.ai_services.signal_correlation import (
    evaluate_report_pair_or_group,
    correlate_reports_into_weak_signals
)
from backend.app.services.weak_signal_service import (
    get_weak_signals_for_organization,
    update_weak_signal_review
)
from backend.app.routers.auth import PRESET_USERS, PRESET_ORGS

def run_tests():
    print("================================================================")
    print("      COMPREHENSIVE TEST SUITE: WEAK SIGNAL CORRELATION ENGINE   ")
    print("================================================================")

    # -------------------------------------------------------------
    # Test 1: Gas Leak + Ignition Source
    # -------------------------------------------------------------
    print("\n--- TEST 1: Gas Leak + Ignition Source ---")
    rep1 = {
        "report_id": "REP-001",
        "description": "Gas is leaking from a pipeline.",
        "location": "Unit 1 - Gas Processing Bay",
        "report_date": "2026-09-08"
    }
    rep2 = {
        "report_id": "REP-002",
        "description": "Fire/ignition source detected near the pipeline.",
        "location": "Unit 1 - Gas Processing Bay",
        "report_date": "2026-09-08"
    }
    res1 = evaluate_report_pair_or_group([rep1, rep2])
    print("Cluster Detected:", res1.get("cluster_detected"))
    print("Relationship:", res1.get("relationship"))
    print("Potential Consequence:", res1.get("potential_consequence"))
    print("Combined Risk:", res1.get("combined_risk"))
    print("Correlation Score:", res1.get("correlation_score"))
    print("Reason Excerpt:", res1.get("reason")[:90] + "...")
    print("Action Excerpt:", res1.get("recommended_action")[:90] + "...")

    assert res1["cluster_detected"] is True, "Expected cluster_detected = True"
    assert "Gas Leak" in res1["relationship"] and "Ignition" in res1["relationship"], f"Unexpected relationship: {res1['relationship']}"
    assert "Fire" in res1["potential_consequence"] or "Explosion" in res1["potential_consequence"], "Expected fire/explosion consequence"
    assert res1["combined_risk"] in ["HIGH", "CRITICAL"], "Expected HIGH or CRITICAL risk"
    print(">>> PASS: Gas Leak + Ignition Source correctly correlated!")

    # -------------------------------------------------------------
    # Test 2: Multi-Signal (3 Signals): Gas Leak + Poor Ventilation + Ignition Source
    # -------------------------------------------------------------
    print("\n--- TEST 2: 3-Signal Interaction (Gas Leak + Poor Ventilation + Ignition Source) ---")
    rep_vent = {
        "report_id": "REP-003",
        "description": "Poor ventilation and stagnant air in the enclosed pipe trench.",
        "location": "Unit 1 - Gas Processing Bay",
        "report_date": "2026-09-08"
    }
    res2 = evaluate_report_pair_or_group([rep1, rep_vent, rep2])
    print("Cluster Detected:", res2.get("cluster_detected"))
    print("Relationship:", res2.get("relationship"))
    print("Potential Consequence:", res2.get("potential_consequence"))
    print("Combined Risk:", res2.get("combined_risk"))
    print("Correlation Score:", res2.get("correlation_score"))
    assert res2["cluster_detected"] is True
    assert "Poor Ventilation" in res2["relationship"]
    assert res2["combined_risk"] == "CRITICAL"
    assert res2["correlation_score"] >= 95
    print(">>> PASS: 3-Signal escalation correctly identified as CRITICAL!")

    # -------------------------------------------------------------
    # Test 3: Unrelated Signals Must NOT Be Combined
    # -------------------------------------------------------------
    print("\n--- TEST 3: Unrelated Signals Isolation ---")
    rep_unrelated_1 = {
        "report_id": "REP-010",
        "description": "Slippery puddle of water on linoleum floor near cafeteria entrance.",
        "location": "Administrative Building Canteen",
        "report_date": "2026-09-07"
    }
    rep_unrelated_2 = {
        "report_id": "REP-011",
        "description": "Minor high-frequency vibration observed on water pump motor in Unit 4.",
        "location": "Unit 4 Cooling Tower",
        "report_date": "2026-09-07"
    }
    res3 = evaluate_report_pair_or_group([rep_unrelated_1, rep_unrelated_2])
    print("Cluster Detected:", res3.get("cluster_detected"))
    print("Relationship:", res3.get("relationship"))
    print("Combined Risk:", res3.get("combined_risk"))
    assert res3["cluster_detected"] is False, "Unrelated signals were incorrectly combined!"
    assert res3["combined_risk"] == "LOW"
    print(">>> PASS: Unrelated signals were correctly rejected from combining!")

    # -------------------------------------------------------------
    # Test 4: Oil/Fuel Leak + Hot Surface
    # -------------------------------------------------------------
    print("\n--- TEST 4: Oil/Fuel Leak + Hot Surface ---")
    rep_oil = {
        "report_id": "REP-020",
        "description": "Pressurized hydraulic oil leaking from loose fitting above engine bay.",
        "location": "Compressor Skid Bay 2",
        "report_date": "2026-09-08"
    }
    rep_hot = {
        "report_id": "REP-021",
        "description": "Uninsulated hot exhaust manifold surface operating at 380 deg C.",
        "location": "Compressor Skid Bay 2",
        "report_date": "2026-09-08"
    }
    res4 = evaluate_report_pair_or_group([rep_oil, rep_hot])
    print("Relationship:", res4.get("relationship"))
    print("Potential Consequence:", res4.get("potential_consequence"))
    print("Combined Risk:", res4.get("combined_risk"))
    assert res4["cluster_detected"] is True
    assert "Oil/Fuel Leak" in res4["relationship"] and "Hot Surface" in res4["relationship"]
    assert "Fire" in res4["potential_consequence"]
    print(">>> PASS: Oil/Fuel Leak + Hot Surface correctly identified!")

    # -------------------------------------------------------------
    # Test 5: Electrical Fault + Flammable Material
    # -------------------------------------------------------------
    print("\n--- TEST 5: Electrical Fault + Flammable Material ---")
    rep_elec = {
        "report_id": "REP-030",
        "description": "Loose terminal lug causing intermittent sparking and electrical arcing on 415V panel.",
        "location": "Workshop Bay 3",
        "report_date": "2026-09-08"
    }
    rep_flam = {
        "report_id": "REP-031",
        "description": "Open solvent drum and combustible oily rags stored against wall.",
        "location": "Workshop Bay 3",
        "report_date": "2026-09-08"
    }
    res5 = evaluate_report_pair_or_group([rep_elec, rep_flam])
    print("Relationship:", res5.get("relationship"))
    print("Potential Consequence:", res5.get("potential_consequence"))
    assert res5["cluster_detected"] is True
    assert "Electrical Fault" in res5["relationship"] and "Flammable Material" in res5["relationship"]
    print(">>> PASS: Electrical Fault + Flammable Material correctly identified!")

    # -------------------------------------------------------------
    # Test 6: Chemical Leak + Human Exposure
    # -------------------------------------------------------------
    print("\n--- TEST 6: Chemical Leak + Human Exposure ---")
    rep_chem = {
        "report_id": "REP-040",
        "description": "Corrosive acid line dripping toxic chemical vapors inside processing bay.",
        "location": "Chemical Dosing Unit",
        "report_date": "2026-09-08"
    }
    rep_human = {
        "report_id": "REP-041",
        "description": "Workers present conducting calibration without respiratory PPE nearby.",
        "location": "Chemical Dosing Unit",
        "report_date": "2026-09-08"
    }
    res6 = evaluate_report_pair_or_group([rep_chem, rep_human])
    print("Relationship:", res6.get("relationship"))
    print("Potential Consequence:", res6.get("potential_consequence"))
    assert res6["cluster_detected"] is True
    assert "Chemical Leak" in res6["relationship"] and "Human Exposure" in res6["relationship"]
    print(">>> PASS: Chemical Leak + Human Exposure correctly identified!")

    # -------------------------------------------------------------
    # Test 7: Blocked Emergency Exit + Fire
    # -------------------------------------------------------------
    print("\n--- TEST 7: Blocked Emergency Exit + Fire ---")
    rep_exit = {
        "report_id": "REP-050",
        "description": "Primary emergency escape route door padlocked and blocked by wooden pallets.",
        "location": "Turbine Hall East",
        "report_date": "2026-09-08"
    }
    rep_fire = {
        "report_id": "REP-051",
        "description": "Smoldering insulation and smoke observed emerging from cable tray.",
        "location": "Turbine Hall East",
        "report_date": "2026-09-08"
    }
    res7 = evaluate_report_pair_or_group([rep_exit, rep_fire])
    print("Relationship:", res7.get("relationship"))
    print("Potential Consequence:", res7.get("potential_consequence"))
    print("Combined Risk:", res7.get("combined_risk"))
    assert res7["cluster_detected"] is True
    assert res7["combined_risk"] == "CRITICAL"
    print(">>> PASS: Blocked Exit + Fire correctly escalated to CRITICAL!")

    # -------------------------------------------------------------
    # Test 8: Damaged Machine Guard + Moving Machinery
    # -------------------------------------------------------------
    print("\n--- TEST 8: Damaged Machine Guard + Moving Machinery ---")
    rep_guard = {
        "report_id": "REP-060",
        "description": "Damaged machine guard removed from conveyor head pulley during shift.",
        "location": "Material Handling Conveyor 01",
        "report_date": "2026-09-08"
    }
    rep_mach = {
        "report_id": "REP-061",
        "description": "High-speed moving machinery conveyor belt operating continuously with exposed nip point.",
        "location": "Material Handling Conveyor 01",
        "report_date": "2026-09-08"
    }
    res8 = evaluate_report_pair_or_group([rep_guard, rep_mach])
    print("Relationship:", res8.get("relationship"))
    print("Potential Consequence:", res8.get("potential_consequence"))
    assert res8["cluster_detected"] is True
    assert "Machine Guard" in res8["relationship"] and "Moving Machinery" in res8["relationship"]
    print(">>> PASS: Damaged Guard + Moving Machinery correctly identified!")

    # -------------------------------------------------------------
    # Test 9: Corrosion + High Pressure
    # -------------------------------------------------------------
    print("\n--- TEST 9: Corrosion + High Pressure ---")
    rep_corrosion = {
        "report_id": "REP-070",
        "description": "Severe external corrosion and metal wall thinning identified on pipe bend.",
        "location": "Unit 2 Manifold",
        "report_date": "2026-09-08"
    }
    rep_press = {
        "report_id": "REP-071",
        "description": "High pressure hydrocarbon gas line operating at 80 bar in the same line.",
        "location": "Unit 2 Manifold",
        "report_date": "2026-09-08"
    }
    res9 = evaluate_report_pair_or_group([rep_corrosion, rep_press])
    print("Relationship:", res9.get("relationship"))
    print("Combined Risk:", res9.get("combined_risk"))
    assert res9["cluster_detected"] is True
    assert res9["combined_risk"] == "CRITICAL"
    print(">>> PASS: Corrosion + High Pressure correctly escalated to CRITICAL!")

    # -------------------------------------------------------------
    # Test 10: Pressure Increase + Equipment Weakness
    # -------------------------------------------------------------
    print("\n--- TEST 10: Pressure Increase + Equipment Weakness ---")
    rep_press_rise = {
        "report_id": "REP-080",
        "description": "Unexpected pressure increase and pressure spike logged on separator line.",
        "location": "Unit 3 Separator",
        "report_date": "2026-09-08"
    }
    rep_weakness = {
        "report_id": "REP-081",
        "description": "Worn gasket and degraded seal with loose flange bolts on joint.",
        "location": "Unit 3 Separator",
        "report_date": "2026-09-08"
    }
    res10 = evaluate_report_pair_or_group([rep_press_rise, rep_weakness])
    print("Relationship:", res10.get("relationship"))
    print("Combined Risk:", res10.get("combined_risk"))
    assert res10["cluster_detected"] is True
    assert res10["combined_risk"] == "CRITICAL"
    print(">>> PASS: Pressure Increase + Equipment Weakness correctly escalated to CRITICAL!")

    # -------------------------------------------------------------
    # Test 11: Untouched Trained Weak-Signal ML Model Check
    # -------------------------------------------------------------
    print("\n--- TEST 11: Untouched SIF ML Model Check ---")
    ml_out = predict_sif_potential("Severe natural gas blowout from high-pressure separator flange")
    print("ML Status:", ml_out["status"])
    print("ML Class:", ml_out["predicted_class"])
    print("ML Confidence:", ml_out["confidence"])
    print("ML Model:", ml_out["model_name"])
    assert ml_out["status"] == "SUCCESS"
    assert ml_out["predicted_class"] == "SIF-potential"
    print(">>> PASS: Existing ML model works untouched!")

    # -------------------------------------------------------------
    # Test 12: Existing Auth & Tenant Isolation Check
    # -------------------------------------------------------------
    print("\n--- TEST 12: Existing Auth & Tenant Accounts ---")
    assert len(PRESET_ORGS) == 5
    assert len(PRESET_USERS) == 10
    print(f"Pre-configured Organizations: {len(PRESET_ORGS)}")
    print(f"Pre-configured User Credentials: {len(PRESET_USERS)}")
    print(">>> PASS: Authentication config and preset users intact!")

    # -------------------------------------------------------------
    # Test 13: Full Organization DB Multi-Report Correlation & Empty State Verification
    # -------------------------------------------------------------
    print("\n--- TEST 13: Full Organization Correlation via Service ---")
    Base.metadata.create_all(bind=engine)
    seed_sample_data()
    db = SessionLocal()
    try:
        from app.models.safety_report import SafetyReport
        from app.models.ai_analysis import AIAnalysis

        # Phase 1: 0 Reports -> Zero signals, Zero clusters, Clean empty state
        org_data = get_weak_signals_for_organization(db, "id001")
        summary = org_data["summary"]
        signals = org_data["weak_signals"]
        clusters = org_data["emerging_clusters"]
        print("Empty DB - Total Active Signals:", summary["total_active_signals"])
        print("Empty DB - Total Clusters:", summary["total_clusters"])
        assert summary["total_active_signals"] == 0, "Expected 0 signals for empty DB!"
        assert len(signals) == 0, "Expected empty signals list for empty DB!"
        assert len(clusters) == 0, "Expected empty clusters list for empty DB!"
        print(">>> PASS: Empty DB correctly returns 0 signals and 0 clusters (no fake baseline reports injected).")

        # Phase 2: 1 Report -> 1 Signal, Zero multi-report clusters
        rep1 = SafetyReport(
            organization_id="id001",
            report_reference="REP-TEST-0001",
            report_type="Unsafe Condition",
            description="High-pressure gas pipeline flange suffered severe leakage with loud hissing in Unit 1.",
            location="Unit 1",
            report_date="2026-09-10",
            analysis_status="COMPLETED"
        )
        db.add(rep1)
        db.commit()
        db.refresh(rep1)
        analysis1 = AIAnalysis(
            report_id=rep1.id,
            organization_id="id001",
            identified_hazard="Flammable Gas Leak",
            sif_precursor_assessment="YES",
            energy_source="High Pressure Gas",
            barrier_information="Flange seal degraded",
            explanation="Severe high-pressure gas release detected."
        )
        db.add(analysis1)
        db.commit()

        org_data_1 = get_weak_signals_for_organization(db, "id001")
        print("1 Report - Signals:", len(org_data_1["weak_signals"]), "Clusters:", len(org_data_1["emerging_clusters"]))
        assert len(org_data_1["weak_signals"]) == 1, "Expected 1 individual signal for 1 report!"
        assert len(org_data_1["emerging_clusters"]) == 0, "Expected 0 clusters for 1 report (must not invent 2nd report)!"
        assert org_data_1["weak_signals"][0]["source_reports"][0]["report_id"] == "REP-TEST-0001"
        print(">>> PASS: 1 Report generates 1 individual safety signal and 0 multi-report clusters.")

        # Phase 3: 2 Reports -> Multi-report cluster generated dynamically from user reports
        rep2 = SafetyReport(
            organization_id="id001",
            report_reference="REP-TEST-0002",
            report_type="Unsafe Act",
            description="Operator operating open flame heater near leaking gas pipeline in Unit 1.",
            location="Unit 1",
            report_date="2026-09-10",
            analysis_status="COMPLETED"
        )
        db.add(rep2)
        db.commit()
        db.refresh(rep2)
        analysis2 = AIAnalysis(
            report_id=rep2.id,
            organization_id="id001",
            identified_hazard="Open Flame & Ignition Source",
            sif_precursor_assessment="YES",
            energy_source="Thermal Energy",
            barrier_information="Hot work permit absent",
            explanation="Active open flame ignition source operated near gas release."
        )
        db.add(analysis2)
        db.commit()

        org_data_2 = get_weak_signals_for_organization(db, "id001")
        print("2 Reports - Signals:", len(org_data_2["weak_signals"]), "Clusters:", len(org_data_2["emerging_clusters"]))
        assert len(org_data_2["emerging_clusters"]) == 1, "Expected 1 emerging risk cluster from 2 interacting reports!"
        cl = org_data_2["emerging_clusters"][0]
        assert "Gas" in cl["relationship"] and "Ignition" in cl["relationship"]
        assert "Fire" in cl["potential_consequence"] or "Explosion" in cl["potential_consequence"]
        
        # Verify cluster observations trace strictly to user reports
        cl_rep_ids = [s["report_id"] for s in cl["signals"]]
        print("Cluster Signal IDs:", cl_rep_ids)
        assert "REP-TEST-0001" in cl_rep_ids
        assert "REP-TEST-0002" in cl_rep_ids
        assert len(cl["signals"]) == 2
        print(">>> PASS: 2 Reports correctly form an Emerging Risk Cluster with exact user report IDs and descriptions.")

        # Cleanup test data
        db.query(AIAnalysis).filter(AIAnalysis.report_id.in_([rep1.id, rep2.id])).delete()
        db.query(SafetyReport).filter(SafetyReport.id.in_([rep1.id, rep2.id])).delete()
        db.commit()
        print(">>> Cleaned up test reports.")
    finally:
        db.close()

    print("\n================================================================")
    print("         ALL 13 TESTS PASSED! ZERO ERRORS ENCOUNTERED.          ")
    print("================================================================")

if __name__ == "__main__":
    run_tests()
