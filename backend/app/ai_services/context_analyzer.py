import re
from typing import Dict, Any

def get_category_context(report_type: str) -> dict:
    """
    Returns the analytical lens and focus area based on report category.
    Note: The category provides analysis context only and does NOT automatically
    determine risk, severity, or SIF status.
    """
    r_type = (report_type or "").upper().replace("-", "_").replace(" ", "_")

    if r_type == "UNSAFE_ACT":
        return {
            "category": "UNSAFE_ACT",
            "focus": "Human action, worker behavior, task execution, procedure adherence, and direct hazard exposure.",
            "description": "The report was analyzed with focus on human action, activity, hazard exposure, and available safety controls."
        }
    elif r_type == "UNSAFE_CONDITION":
        return {
            "category": "UNSAFE_CONDITION",
            "focus": "Physical workplace condition, equipment integrity, environmental factors, and engineering controls.",
            "description": "The report was analyzed with focus on the hazardous condition, hazard source, potential exposure, and control condition."
        }
    elif r_type == "NEAR_MISS":
        return {
            "category": "NEAR_MISS",
            "focus": "Unplanned safety event, release of energy or sequence of events, personnel exposure, and barrier effectiveness.",
            "description": "The report was analyzed with focus on the event, potential exposure, possible consequences, and available barriers."
        }
    else:
        return {
            "category": "GENERAL_OBSERVATION",
            "focus": "General industrial safety observation, hazards, and controls.",
            "description": "The report was analyzed with focus on available safety information, identified hazards, and control measures."
        }


def classify_incident_category(text: str) -> Dict[str, Any]:
    """
    Automatically classifies free-text explanation into NEAR_MISS, UNSAFE_ACT, or UNSAFE_CONDITION
    based on standard industrial safety definitions (OSHA 1904, Heinrich/Bird model).
    """
    if not text or not text.strip():
        return {
            "category": "NEAR_MISS",
            "label": "Near Miss",
            "confidence": 0.50,
            "rationale": "Default category assigned due to empty observation text.",
            "indicators": []
        }

    t_low = text.lower().strip()

    # 1. Near Miss Patterns (Unplanned event, energy release, dropped object, close call with no injury)
    near_miss_patterns = [
        (r'\b(near\s*miss|almost\s*hit|nearly\s*struck|narrowly\s*missed|close\s*call|near\s*collision)\b', 'Close call / near impact event'),
        (r'\b(dropped\s*object|fell\s*from\s*height|fell\s*and\s*missed|falling\s*tool|dropped\s*from)\b', 'Falling or dropped object event'),
        (r'\b(snapped|ruptured|burst|whipped|cable\s*broke|hose\s*whipped|wire\s*snapped)\b', 'Sudden mechanical failure / unexpected release'),
        (r'\b(slipped\s*and\s*regained|caught\s*balance|stumbled\s*but|almost\s*fell)\b', 'Slip or trip recovery without injury'),
        (r'\b(swerved|braked\s*suddenly|near\s*miss\s*with\s*vehicle)\b', 'Vehicle near-miss interaction'),
        (r'\b(arc\s*flash\s*occurred|spark\s*burst|blast\s*occurred|explosion\s*occurred|fire\s*flash)\b', 'Hazardous energy burst or sudden event')
    ]

    # 2. Unsafe Act Patterns (Human behavior, procedure non-compliance, PPE non-use, risky actions)
    unsafe_act_patterns = [
        (r'\b(not\s*wearing|without\s*(wearing|ppe|harness|helmet|glasses|gloves)|failed\s*to\s*wear|improper\s*ppe|removed\s*ppe|missing\s*(?:safety\s*)?gear|no\s*safety\s*gear)\b', 'PPE omission or improper personal protective equipment usage'),
        (r'\b(procedure\s*not\s*followed|ptw\s*violation|permit\s*violation|without\s*permit|unauthorized\s*operation|no\s*ptw)\b', 'Procedure, permit-to-work, or protocol non-compliance'),
        (r'\b(bypassed|bypassing|interlock\s*disabled|tampered\s*with|overrode|defeated\s*safety)\b', 'Intentional bypassing or tampering with safety controls'),
        (r'\b(speeding|excessive\s*speed|driving\s*recklessly|cell\s*phone|phone\s*distraction|mobile\s*use)\b', 'Unsafe operational behavior or operator distraction'),
        (r'\b(standing\s*under|walked\s*under\s*suspended|under\s*the\s*crane|under\s*load|line\s*of\s*fire)\b', 'Worker positioned directly in line-of-fire or under suspended load'),
        (r'\b(loto\s*not\s*followed|failed\s*to\s*isolate|did\s*not\s*de-energize|worked\s*on\s*live)\b', 'Failure to isolate hazardous energy or adhere to LOTO'),
        (r'\b(removed\s*(machine\s*)?guard|wrong\s*tool|improvised\s*tool|unauthorized\s*access)\b', 'Worker removed safety guard or used inappropriate improvised tooling'),
        (r'\b(smoking\s*in|horseplay|rushing|ignored\s*warning|ignored\s*alarm)\b', 'Workplace conduct violation or ignoring active safety alarms')
    ]

    # 3. Unsafe Condition Patterns (Physical, mechanical, environmental workplace hazards)
    unsafe_condition_patterns = [
        (r'\b(slippery\s*(surface|floor|ground|walkway)|oil\s*puddle|spill\s*on\s*floor|wet\s*floor|water\s*leak|puddle)\b', 'Hazardous surface condition (spill, slip, trip hazard)'),
        (r'\b(uneven\s*(ground|surface|grating|floor)|pothole|damaged\s*grating|hole\s*in\s*floor|trip\s*hazard)\b', 'Physical structural or walkway surface defect'),
        (r'\b(damaged|broken|corroded|cracked|defective|leaking|faulty|malfunction)\s*(equipment|pump|pipe|valve|cable|wire|machine|flange|ladder|scaffold)\b', 'Defective, damaged, or deteriorating physical equipment'),
        (r'\b(missing\s*(guard|handrail|cover|barrier|grating|barricade|sign|signage))\b', 'Missing physical safety barrier, guard, or required warning signage'),
        (r'\b(exposed\s*(wiring|wire|cable|conductor|voltage|busbar|live\s*part))\b', 'Exposed electrical wiring or uninsulated energized conductors'),
        (r'\b(blocked\s*(exit|door|egress|aisle|fire\s*door|extinguisher))\b', 'Obstructed emergency evacuation exit or safety equipment access'),
        (r'\b(poor\s*lighting|dark\s*(area|stairwell|hallway)|inadequate\s*illumination|dim\s*lighting)\b', 'Inadequate illumination creating poor visibility hazard'),
        (r'\b(gas\s*leak|chemical\s*spill|corrosion|rust|high\s*pressure\s*hazard|high\s*temp|overheating)\b', 'Environmental, chemical, or pressurized physical workplace defect'),
        (r'\b(poor\s*housekeeping|clutter|debris\s*on\s*walkway|loose\s*tools)\b', 'Housekeeping deficiency or physical floor clutter')
    ]

    act_matches = []
    for pat, desc in unsafe_act_patterns:
        if re.search(pat, t_low):
            act_matches.append(desc)

    cond_matches = []
    for pat, desc in unsafe_condition_patterns:
        if re.search(pat, t_low):
            cond_matches.append(desc)

    nm_matches = []
    for pat, desc in near_miss_patterns:
        if re.search(pat, t_low):
            nm_matches.append(desc)

    # Scoring & Disambiguation:
    # 1. Clear Near Miss event (e.g. dropped object that narrowly missed someone, close call)
    if nm_matches and not (act_matches and len(act_matches) > len(nm_matches)):
        return {
            "category": "NEAR_MISS",
            "label": "Near Miss",
            "confidence": 0.92,
            "rationale": f"Identified as Near Miss based on unplanned close-call occurrence: {', '.join(nm_matches[:2])}.",
            "indicators": nm_matches
        }

    # 2. Worker action / behavior
    if act_matches and len(act_matches) >= len(cond_matches):
        return {
            "category": "UNSAFE_ACT",
            "label": "Unsafe Act",
            "confidence": 0.90,
            "rationale": f"Identified as Unsafe Act based on worker behavioral / procedural factor: {', '.join(act_matches[:2])}.",
            "indicators": act_matches
        }

    # 3. Physical condition / environment / equipment defect
    if cond_matches:
        return {
            "category": "UNSAFE_CONDITION",
            "label": "Unsafe Condition",
            "confidence": 0.90,
            "rationale": f"Identified as Unsafe Condition based on physical environmental or equipment hazard: {', '.join(cond_matches[:2])}.",
            "indicators": cond_matches
        }

    # Fallback heuristic: check if human subject vs physical object is dominant
    if any(k in t_low for k in ["worker", "technician", "operator", "crew", "person", "employee", "he ", "she ", "they "]):
        if any(v in t_low for v in ["did", "was", "not", "wearing", "operating", "walking", "climbing", "running"]):
            return {
                "category": "UNSAFE_ACT",
                "label": "Unsafe Act",
                "confidence": 0.82,
                "rationale": "Identified as Unsafe Act due to worker activity context in description.",
                "indicators": ["Worker action context"]
            }

    # Default to UNSAFE_CONDITION if physical words exist, else NEAR_MISS
    return {
        "category": "UNSAFE_CONDITION",
        "label": "Unsafe Condition",
        "confidence": 0.78,
        "rationale": "Identified as Unsafe Condition based on physical workplace observation context.",
        "indicators": ["Physical condition context"]
    }

