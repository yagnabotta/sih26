"""
Hazard Detection Module
=======================
Identifies specific workplace safety hazard categories supported by report context.
Supports multi-hazard detection and severity-ranked primary hazard selection.
Strictly avoids hallucinating hazards without evidence.
"""

import re
from typing import Optional, List, Dict

try:
    from .safety_context import (
        is_negative_context,
        is_controlled_thermal_context,
        is_minor_contained_spill,
        is_catastrophic_explosion,
        is_spreading_process_fire
    )
except (ImportError, ValueError):
    try:
        from safety_context import (
            is_negative_context,
            is_controlled_thermal_context,
            is_minor_contained_spill,
            is_catastrophic_explosion,
            is_spreading_process_fire
        )
    except ImportError:
        def is_negative_context(t): return False
        def is_controlled_thermal_context(t): return False
        def is_minor_contained_spill(t): return False
        def is_catastrophic_explosion(t): return False
        def is_spreading_process_fire(t): return False

# Severity weights for multi-hazard prioritization (0 - 35 scale)
HAZARD_SEVERITY_WEIGHTS: Dict[str, int] = {
    "Catastrophic Explosion & Blast Hazard": 35,
    "Spreading Hydrocarbon Process Fire": 33,
    "Lockout / Tagout (LOTO) Non-Compliance": 30,
    "Atmospheric & Confined Space Hazard": 30,
    "High-Pressure Line & Stored Energy Hazard": 28,
    "Line-of-Fire Hazard": 28,
    "Suspended Load & Dropped Object Hazard": 28,
    "Electrical Arc Flash & Shock Hazard": 28,
    "Water Leakage & Electrical Hazard": 28,
    "Fire & Thermal Ignition Hazard": 28,
    "Work at Height & Fall Hazard": 26,
    "Excavation & Trench Collapse Hazard": 26,
    "Mobile Equipment & Pedestrian Near Miss": 22,
    "Hazardous Chemical Exposure Hazard": 22,
    "Gas Leakage & Flammable Atmosphere": 28,
    "Mechanical Safeguard & Barrier Deficiency": 20,
    "Procedural Non-Compliance & Operational Control Deficit": 20,
    "Fall Protection / Safety Harness Non-Compliance": 24,
    "PPE / Head Protection Non-Compliance": 16,
    "Personal Protective Equipment (PPE) Non-Compliance": 14,
    "Electrical & Trip Hazard": 16,
    "Emergency Access & Egress Obstruction": 12,
    "Unsafe Machinery Operation & Equipment Control": 20,
    "Controlled Thermal Operation / Minor Extinguished Fire": 8,
    "Minor Contained Chemical / Oil Seepage": 6,
    "Slip / Trip / Fall Hazard": 8,
    "Housekeeping / Trip Hazard": 8,
    "Lighting & Visibility Defect": 6,
    "Safety Training / Drill / Non-Hazardous Context": 4
}


def detect_all_hazards(text: str) -> List[str]:
    """
    Detects ALL verified hazard categories present in the report description
    and checklist selections.
    """
    if not text or not isinstance(text, str):
        return []

    lower_text = text.lower()
    detected = []

    # 0. Negative Context Filtering (Drills, Toolbox Talks, Routine Checks)
    if is_negative_context(lower_text):
        return ["Safety Training / Drill / Non-Hazardous Context"]

    # Critical Refinery Event Detections
    if is_catastrophic_explosion(lower_text):
        detected.append("Catastrophic Explosion & Blast Hazard")
    if is_spreading_process_fire(lower_text):
        detected.append("Spreading Hydrocarbon Process Fire")
    if is_controlled_thermal_context(lower_text):
        detected.append("Controlled Thermal Operation / Minor Extinguished Fire")
    if is_minor_contained_spill(lower_text):
        detected.append("Minor Contained Chemical / Oil Seepage")

    # 1. Lockout / Tagout (LOTO) Non-Compliance (Critical SIF Precursor)
    if re.search(r'\b(loto|lockout|tagout|lock-out|tag-out|de-energiz|without isolation|not locked out|ignored loto|bypassed loto|failed to follow loto|loto not followed|zero energy|energy isolation)\b', lower_text):
        detected.append("Lockout / Tagout (LOTO) Non-Compliance")

    # 2. Line of Fire & Trajectory Exposure (Critical SIF Precursor)
    if re.search(r'\b(line of fire|line-of-fire|in the line of fire|stood in the line of fire|standing in line of fire|drop zone|fall path|under load|standing under suspended load|under suspended load|struck-by|struck by|pinch point|in line of fire)\b', lower_text):
        detected.append("Line-of-Fire Hazard")

    # 3. High-Pressure Line & Stored Energy Hazard (Critical SIF Precursor)
    if re.search(r'\b(high[- ]pressure|high pressure|pressurized|hydraulic|pneumatic|pressure release|line break|pipe burst|blowout|hydrotest|steam line|stored pressure|ruptured hose|psi|bar|choke manifold)\b', lower_text):
        detected.append("High-Pressure Line & Stored Energy Hazard")

    # 4. Confined Space & Atmospheric Hazard (Critical SIF Precursor)
    if re.search(r'\b(confined space|tank entry|vessel entry|inside vessel|inside the tank|manhole|pit entry|atmospheric monitoring|gas testing|gas test|oxygen deficiency|h2s|toxic gas)\b', lower_text):
        detected.append("Atmospheric & Confined Space Hazard")

    # 5. Suspended Load & Dropped Object (Critical SIF Precursor)
    if re.search(r'\b(suspended load|overhead load|crane lift|rigging|dropped object|falling pipe|falling tool|fell from above|dropped from|falling object|standing under suspended load)\b', lower_text):
        detected.append("Suspended Load & Dropped Object Hazard")

    # 6. Electrical Arc Flash & Shock Hazard
    if re.search(r'\b(electrical|live wire|high voltage|voltage|switchboard|switchgear|arc flash|energized|shock|breaker|exposed wiring|11kv|415v)\b', lower_text):
        if ("water" in lower_text or "leak" in lower_text) and any(k in lower_text for k in ["panel", "switch", "wire", "cable", "breaker"]):
            detected.append("Water Leakage & Electrical Hazard")
        elif any(k in lower_text for k in ["walkway", "aisle", "floor", "ground", "trip", "loose"]):
            detected.append("Electrical & Trip Hazard")
        else:
            detected.append("Electrical Arc Flash & Shock Hazard")

    # 7. Work at Height & Fall Hazard
    if re.search(r'\b(height|scaffold|ladder|roof|edge|fall protection|grating missing|platform edge|climbing|working at height|fall from height)\b', lower_text):
        detected.append("Work at Height & Fall Hazard")

    # 8. Gas & Hydrocarbon Leakage / Flammable Atmosphere
    if re.search(r'\b(hydrocarbon|gas is leaking|gas leak|gas leakage|gas odor|smell of gas|flammable gas|hissing)\b', lower_text):
        if "Atmospheric & Confined Space Hazard" not in detected:
            detected.append("Gas Leakage & Flammable Atmosphere")

    # 9. Fire & Thermal / Explosion Hazard (exclude 'line of fire' and controlled fires)
    fire_text = re.sub(r'\bline[- ]of[- ]fire\b', '', lower_text)
    if re.search(r'\b(fire|hot work|welding|sparks|combustible|flammable liquid|flash fire|burn|heat exposure|thermal|explosion)\b', fire_text):
        if not is_controlled_thermal_context(lower_text) and "Controlled Thermal Operation / Minor Extinguished Fire" not in detected:
            detected.append("Fire & Thermal Ignition Hazard")

    # 10. Hazardous Chemical Exposure (exclude minor contained seeps)
    if re.search(r'\b(chemical|acid|caustic|solvent|corrosive|toxic spill|chemical drum|chemical spill)\b', lower_text):
        if not is_minor_contained_spill(lower_text):
            detected.append("Hazardous Chemical Exposure Hazard")

    # 11. Mobile Equipment / Pedestrian Near Miss
    if any(k in lower_text for k in ["forklift", "truck", "dumper", "loader"]) and any(k in lower_text for k in ["pedestrian", "hit a pedestrian", "almost hit", "near collision", "narrowly missed", "reversing"]):
        detected.append("Mobile Equipment & Pedestrian Near Miss")

    # 12. Mechanical Safeguard & Barrier Deficiency
    if any(k in lower_text for k in ["machine guard", "guard is missing", "guard missing", "guard_missing", "guard was missing", "guard is loose", "removing machine guard", "unguarded"]):
        detected.append("Mechanical Safeguard & Barrier Deficiency")

    # 13. Excavation & Trench Collapse
    if re.search(r'\b(trench|excavation|cave-in|collapse|shoring|unstable slope)\b', lower_text):
        detected.append("Excavation & Trench Collapse Hazard")

    # 14. Emergency Access & Egress Obstruction
    if any(k in lower_text for k in ["emergency exit", "fire exit", "exit blocked", "blocked exit", "fire door", "blocked door", "egress"]):
        detected.append("Emergency Access & Egress Obstruction")

    # 15. Housekeeping & Storage Defect
    if any(k in lower_text for k in ["tools on floor", "tools were left", "tools left on", "clutter", "boxes stacked", "stacked improperly", "unstable stack", "poor housekeeping"]):
        detected.append("Housekeeping / Trip Hazard")

    # 16. Slip / Trip / Fall Hazard
    if re.search(r'\b(slip\w*|slippery|slick|trip\w*|uneven surface|water on floor|water puddle|puddle|wet floor|oil spill|oil on floor)\b', lower_text):
        if "Water Leakage & Electrical Hazard" not in detected:
            detected.append("Slip / Trip / Fall Hazard")

    # 17. Lighting / Visibility
    if re.search(r'\b(lighting|poor lighting|dim light|dark walkway|glare)\b', lower_text):
        detected.append("Lighting & Visibility Defect")

    # 18. Procedural Non-Compliance
    if re.search(r'\b(procedure not followed|bypassing safety control|bypassed|defeat|interlock bypass|permit-to-work violation|ptw violation)\b', lower_text):
        if "Lockout / Tagout (LOTO) Non-Compliance" not in detected:
            detected.append("Procedural Non-Compliance & Operational Control Deficit")

    # 19. PPE Non-Compliance (Specific and General)
    if re.search(r'\b(harness|without_harness|no harness|safety belt|lanyard)\b', lower_text):
        detected.append("Fall Protection / Safety Harness Non-Compliance")
    elif re.search(r'\b(helmet|hard hat|hard_hat|without_helmet|no helmet)\b', lower_text):
        detected.append("PPE / Head Protection Non-Compliance")
    elif re.search(r'\b(ppe\b|without_ppe|no ppe|without ppe|without proper ppe|ppe not used|incorrect ppe|goggles|safety glasses|respirator|face shield|ppe issue)\b', lower_text):
        detected.append("Personal Protective Equipment (PPE) Non-Compliance")

    # Return unique items preserving discovery order
    return list(dict.fromkeys(detected))


def detect_hazard(text: str) -> Optional[str]:
    """
    Identifies the PRIMARY hazard category supported by report context.
    Selects the hazard with the highest safety severity weight so that critical
    SIF precursors (LOTO, High Pressure, Line of Fire, Confined Space) are not
    overshadowed by secondary violations such as missing PPE.
    """
    all_hazards = detect_all_hazards(text)
    if not all_hazards:
        return None

    # Sort hazards by severity weight descending
    all_hazards.sort(key=lambda h: HAZARD_SEVERITY_WEIGHTS.get(h, 10), reverse=True)
    return all_hazards[0]
