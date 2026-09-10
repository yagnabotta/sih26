import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import SessionLocal
from backend.app.models.safety_report import SafetyReport
from backend.app.models.ai_analysis import AIAnalysis
from backend.app.routers.auth import create_access_token

client = TestClient(app)

def test_api_weak_signals_flow():
    print("=================================================================")
    print("      TESTING /api/weak-signals FASTAPI ENDPOINT FLOW           ")
    print("=================================================================")

    # Authenticate as user in id001
    token = create_access_token({"sub": "admin1@gmail.com", "org_id": "id001", "role": "ADMINISTRATOR"})
    headers = {"Authorization": f"Bearer {token}"}

    db = SessionLocal()
    try:
        # 1. Clean DB
        db.query(AIAnalysis).delete()
        db.query(SafetyReport).delete()
        db.commit()

        # 2. Test 0 reports
        resp = client.get("/api/weak-signals", headers=headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        print("\nAPI Response with 0 reports:")
        print("  Summary:", data["summary"])
        print("  Weak Signals Count:", len(data["weak_signals"]))
        print("  Emerging Clusters Count:", len(data["emerging_clusters"]))
        assert data["summary"]["total_active_signals"] == 0
        assert data["summary"]["total_clusters"] == 0
        assert data["weak_signals"] == []
        assert data["emerging_clusters"] == []
        print("  >>> PASS: /api/weak-signals returns empty signals and clusters when 0 reports exist!")

        # 3. Add 1 report
        rep1 = SafetyReport(
            organization_id="id001",
            report_reference="REP-USER-001",
            report_type="Unsafe Condition",
            description="High-pressure natural gas pipeline leaking with loud hissing sound.",
            location="Unit 1 Compressor Bay",
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
            energy_source="High-Pressure Gas",
            barrier_information="Pipe flange degraded",
            explanation="Single gas leak observation."
        )
        db.add(analysis1)
        db.commit()

        resp1 = client.get("/api/weak-signals", headers=headers)
        assert resp1.status_code == 200
        data1 = resp1.json()
        print("\nAPI Response with 1 report:")
        print("  Summary:", data1["summary"])
        print("  Weak Signals Count:", len(data1["weak_signals"]))
        print("  Emerging Clusters Count:", len(data1["emerging_clusters"]))
        assert len(data1["weak_signals"]) == 1
        assert len(data1["emerging_clusters"]) == 0
        assert data1["weak_signals"][0]["source_reports"][0]["report_id"] == "REP-USER-001"
        print("  >>> PASS: 1 Report creates 1 individual weak signal and ZERO multi-report clusters!")

        # 4. Add 2nd interacting report
        rep2 = SafetyReport(
            organization_id="id001",
            report_reference="REP-USER-002",
            report_type="Unsafe Act",
            description="Electrician using unshielded grinding wheel with sparks near gas pipeline.",
            location="Unit 1 Compressor Bay",
            report_date="2026-09-10",
            analysis_status="COMPLETED"
        )
        db.add(rep2)
        db.commit()
        db.refresh(rep2)
        analysis2 = AIAnalysis(
            report_id=rep2.id,
            organization_id="id001",
            identified_hazard="Grinding Sparks / Ignition Source",
            sif_precursor_assessment="YES",
            energy_source="Thermal Energy",
            barrier_information="Hot work spark shield missing",
            explanation="Active grinding sparks near fuel source."
        )
        db.add(analysis2)
        db.commit()

        resp2 = client.get("/api/weak-signals", headers=headers)
        assert resp2.status_code == 200
        data2 = resp2.json()
        print("\nAPI Response with 2 reports:")
        print("  Summary:", data2["summary"])
        print("  Emerging Clusters Count:", len(data2["emerging_clusters"]))
        assert len(data2["emerging_clusters"]) == 1
        cl = data2["emerging_clusters"][0]
        print("  Cluster Title:", cl["cluster_title"])
        print("  Potential Consequence:", cl["potential_consequence"])
        print("  Cluster Signals:", [s["report_id"] for s in cl["signals"]])
        assert "Gas Leak" in cl["relationship"] or "Ignition" in cl["relationship"]
        assert "Fire" in cl["potential_consequence"] or "Explosion" in cl["potential_consequence"]
        assert len(cl["signals"]) == 2
        assert cl["signals"][0]["report_id"] == "REP-USER-001"
        assert cl["signals"][1]["report_id"] == "REP-USER-002"
        print("  >>> PASS: 2 reports successfully formed an Emerging Risk Cluster with exact user report IDs!")

        # 5. Clean DB after test
        db.query(AIAnalysis).delete()
        db.query(SafetyReport).delete()
        db.commit()
        print("  >>> DB cleaned successfully.")

    finally:
        db.close()

    print("\n=================================================================")
    print("      ALL /api/weak-signals API TESTS PASSED!                   ")
    print("=================================================================")

if __name__ == "__main__":
    test_api_weak_signals_flow()
