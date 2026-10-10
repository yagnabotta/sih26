import sys
import os

# Ensure backend package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.database import SessionLocal, Base, engine, ensure_emergency_schema
from backend.app.seed_data import seed_sample_data
from backend.app.ai_services.sif_ml_inference import predict_sif_potential
from backend.app.models.weak_signal import WeakSignalReview
from backend.app.services.weak_signal_service import (
    get_weak_signals_for_organization,
    get_weak_signal_by_id,
    update_weak_signal_review
)
from backend.app.routers.analysis import handle_live_analysis, LiveAnalysisRequest

def test_all():
    print("=== 1. Verifying Untouched ML Model ===")
    ml_res = predict_sif_potential("High pressure natural gas leak on pipe joint with flange hissing")
    print("ML Prediction Status:", ml_res.get("status"))
    print("ML Class:", ml_res.get("predicted_class"))
    print("ML Confidence:", ml_res.get("confidence"))
    print("ML Model:", ml_res.get("model_name"))
    assert ml_res.get("status") == "SUCCESS", "ML prediction failed!"

    print("\n=== 2. Verifying DB Tables & Weak Signal Service ===")
    ensure_emergency_schema()
    seed_sample_data()
    db = SessionLocal()
    try:
        data = get_weak_signals_for_organization(db, "id001")
        summary = data.get("summary", {})
        signals = data.get("weak_signals", [])
        print(f"Total Active Signals: {summary.get('total_active_signals')}")
        print(f"High Risk Precursors: {summary.get('high_risk_precursors')}")
        print(f"Escalating Patterns: {summary.get('escalating_patterns')}")
        print(f"Signals Count: {len(signals)}")
        assert len(signals) >= 2, "Expected at least 2 weak signals!"
        
        first_sig = signals[0]
        print("\nSample Weak Signal:")
        print(" - ID:", first_sig.get("signal_id"))
        print(" - Title:", first_sig.get("title"))
        print(" - Category:", first_sig.get("category"))
        print(" - Risk Score:", first_sig.get("risk_score"))
        print(" - SIF Precursor:", first_sig.get("potential_sif_precursor"))
        print(" - Source Reports Count:", len(first_sig.get("source_reports", [])))
        print(" - Progression Steps Count:", len(first_sig.get("progression_steps", [])))

        print("\n=== 3. Verifying Review & Strict Locking ===")
        sig_id = first_sig.get("signal_id")
        db.query(WeakSignalReview).filter(
            WeakSignalReview.organization_id == "id001",
            WeakSignalReview.signal_id == sig_id
        ).delete()
        db.commit()

        # Update to Under Review with notes
        res1 = update_weak_signal_review(db, "id001", sig_id, "Under Review", "Engineering audit dispatched.")
        print("Status update 1 (Under Review):", res1["review_status"])
        
        # Update to Completed
        res2 = update_weak_signal_review(db, "id001", sig_id, "Completed", "Audit sign-off verified.")
        print("Status update 2 (Completed):", res2["review_status"])
        
        # Attempt to revert (should raise ValueError)
        lock_passed = False
        try:
            update_weak_signal_review(db, "id001", sig_id, "Under Review", "Attempt to revert.")
        except ValueError as e:
            lock_passed = True
            print("Lock Enforcement verified:", str(e))
        assert lock_passed, "Strict completion lock failed to enforce!"

        print("\n=== 4. Verifying Live Analysis Weak Signals Integration ===")
        live_req = LiveAnalysisRequest(
            report_text="Flange gasket on separator inlet pipe joint had micro-vibrations and faint acoustic hissing below 5% LEL near electrical box.",
            location="Unit 3",
            report_type="Near Miss"
        )
        live_res = handle_live_analysis(live_req)
        weak_sigs = live_res.get("weak_signals", [])
        print("Live Analysis Precursor:", live_res.get("sif_precursor"))
        print("Live Analysis Risk Score:", live_res.get("sif_potential_score"))
        print(f"Live Analysis Weak Signals Detected: {len(weak_sigs)}")
        for ws in weak_sigs:
            print(f" - [{ws.get('signal_id')}] {ws.get('title')}: {ws.get('signal')} (Risk: {ws.get('risk_score')})")
        assert len(weak_sigs) > 0, "Expected at least 1 weak signal detected from hissing/vibration text!"

        print("\n>>> ALL CHECKS PASSED SUCCESSFULLY! <<<")
    finally:
        db.close()

if __name__ == "__main__":
    test_all()
