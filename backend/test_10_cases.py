import json
from app.ai_services.ai_service import analyze_safety_report
from app.routers.analysis import handle_live_analysis, LiveAnalysisRequest

test_cases = [
    ("TEST 1", "A man is injured due to heat"),
    ("TEST 2", "Worker ignored the required heat-rest schedule and continued working in extreme heat, resulting in injury."),
    ("TEST 3", "Worker was injured because the cooling system failed in the work area."),
    ("TEST 4", "Worker almost slipped on an oily floor but was not injured."),
    ("TEST 5", "Oil leaked onto the floor and created a slippery surface."),
    ("TEST 6", "Worker operated machinery without the required guard and was injured."),
    ("TEST 7", "Worker was struck by a moving vehicle in the plant."),
    ("TEST 8", "Worker suffered a serious injury following an uncontrolled high-pressure release."),
    ("TEST 9", "Damaged electrical insulation exposed workers to live electrical conductors."),
    ("TEST 10", "Worker nearly contacted an energized conductor but was not injured.")
]

print("=" * 80)
print("RUNNING 10 CORE SAFETY INTELLIGENCE TEST CASES")
print("=" * 80)

for test_name, text in test_cases:
    print(f"\n--- {test_name} ---")
    print(f"Input: \"{text}\"")
    
    req = LiveAnalysisRequest(report_text=text, report_type="Near Miss", location="Unit 1")
    res = handle_live_analysis(req)
    
    print(f"  Classification:  {res['classification']}")
    print(f"  SIF Status:      {res['sif_status']} (Precursor: {res['sif_precursor']})")
    print(f"  Risk Score:      {res['risk_score']}/100")
    print(f"  Hazard:          {res['hazard']}")
    print(f"  Energy Vector:   {res['energy_vector']}")
    print(f"  Worker Exposure: {res['worker_exposure']}")
    print(f"  Barrier Status:  {res['barrier_status']}")
    print(f"  Root Cause:      {res['root_cause']}")
    print(f"  Explanation:     {res['explanation'][:120]}...")
