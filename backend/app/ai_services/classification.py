import re
from typing import Dict, Any, Optional

def infer_root_cause(
    text: str,
    classification: str,
    hazard: Optional[str] = None,
    barrier_status: Optional[str] = None
) -> str:
    """
    Infers an evidence-grounded root cause statement directly from the facts of the report.
    Does not invent unsupported facts.
    """
    lower = text.lower()
    
    # Check for empty or minimal input lacking hazard context
    words = lower.split()
    is_no_hazard = not hazard or hazard == "Insufficient Information"
    if len(words) < 5 and is_no_hazard:
        return "Insufficient Information"
    if lower.strip().rstrip('.') in ["worker was injured", "a man is injured", "a man was injured", "person injured", "employee injured", "injury occurred"]:
        return "Insufficient Information"

    # 1. Ignored Heat-Rest Schedule
    if re.search(r'\b(ignored.*heat-rest|heat-rest.*schedule|rest schedule)\b', lower):
        return "Failure to follow the mandatory heat-rest schedule resulted in prolonged worker exposure to extreme heat and consequent injury."
    
    # 2. Cooling System Failure
    if re.search(r'\b(cooling system failed|cooling failed|failure of.*cooling)\b', lower):
        return "Mechanical failure of the workspace cooling system resulted in excessive heat accumulation and consequent heat injury."
        
    # 3. General Heat Exposure (like "A man is injured due to heat")
    if re.search(r'\b(heat|extreme heat|high temperature|ambient heat)\b', lower) and not re.search(r'\b(welding|fire|hot pipe)\b', lower):
        if "injured" in lower or "injury" in lower:
            return "The reported injury appears to be associated with uncontrolled heat exposure; additional information is required to determine the specific underlying cause."
        return "Excessive thermal environmental conditions created heat exposure hazard without adequate cooling or rest controls."

    # 4. Ignored PPE Requirements / Chemical Burns
    if re.search(r'\b(ignored.*ppe|without.*ppe|failed to wear.*ppe)\b', lower) and re.search(r'\b(chemical|burn|acid)\b', lower):
        return "Failure to follow required PPE controls resulted in worker exposure to the chemical hazard."

    if re.search(r'\b(ignored.*ppe|without.*ppe|failed to wear.*ppe|no ppe)\b', lower):
        return "Failure to wear mandatory personal protective equipment directly exposed personnel to active hazards."

    # 5. Operating Machinery Without Required Guard
    if re.search(r'\b(operated.*machin.*without.*guard|machinery without.*guard|machine without.*guard|without the required guard)\b', lower):
        return "Operating machinery without the required safeguard in place resulted in direct worker contact with moving parts and injury."

    # 6. Unguarded Rotating Machine (Condition)
    if re.search(r'\b(unguarded rotating machine|unguarded machine|exposed rotating|unguarded conveyor)\b', lower):
        return "Inadequate physical machine guarding allowed direct personnel exposure to hazardous rotating components."

    # 7. Bypassed Interlock / Procedure Violation
    if re.search(r'\b(bypassed.*interlock|interlock bypassed|bridged.*interlock|bypassed safety)\b', lower):
        return "Bypassing safety interlocks defeated critical engineered safeguards, exposing personnel to operational danger."

    # 8. Entered Restricted Area Without Authorization
    if re.search(r'\b(entered.*restricted|without authorization|unauthorized entry)\b', lower):
        return "Entering a designated restricted zone without authorization bypassed access controls and exposed the worker to active hazards."

    # 9. Handling Hot Equipment / Pipe Without Procedure
    if re.search(r'\b(hot equipment|hot pipe|touching.*hot|hot surface)\b', lower):
        if re.search(r'\b(without following|procedure|unprotected)\b', lower):
            return "Handling hot equipment without following mandatory thermal protection procedures resulted in thermal contact and burn injury."
        return "Direct physical contact with an uninsulated hot surface resulted in thermal exposure and injury."

    # 10. Oil Leaking from Equipment -> Slipped / Slippery Surface
    if re.search(r'\b(oil was leaking|oil leaked|leaking.*oil|damaged equipment.*oil)\b', lower):
        if "slipped" in lower or "slip" in lower:
            return "Failure to control the equipment leak resulted in oil accumulation and created a slip hazard."
        return "Equipment fluid leakage or loss of containment created a slip and fall hazard on the walking surface."

    # 11. Wet / Oily Floor Near Miss
    if re.search(r'\b(almost slipped|nearly slipped|almost fell)\b', lower):
        return "Inadequate control of the walking surface condition created a slip potential, narrowly avoiding personnel injury."

    # 12. Damaged Electrical Insulation / Live Conductors
    if re.search(r'\b(damaged electrical insulation|damaged insulation|exposed.*conductor|live conductor)\b', lower):
        return "Physical degradation or mechanical damage to electrical insulation compromised energized conductor isolation."

    # 13. Near Contact with Energized Conductor
    if re.search(r'\b(nearly contacted|almost contacted|nearly came into contact)\b', lower) and re.search(r'\b(electrical|conductor|wire|energized)\b', lower):
        return "Inadequate electrical isolation, guarding, or clearance boundaries allowed worker proximity to energized conductors."

    # 14. Uncontrolled High-Pressure Release
    if re.search(r'\b(uncontrolled.*pressure|high-pressure release|pressure release|line rupture)\b', lower):
        return "Loss of pressure containment or mechanical integrity failure resulted in an uncontrolled high-pressure energy release."

    # 15. Struck by Moving Vehicle
    if re.search(r'\b(struck by.*vehicle|moving vehicle|vehicle.*plant|forklift.*pedestrian)\b', lower):
        return "Inadequate pedestrian segregation and traffic management controls allowed moving vehicle interaction with worker."

    # 16. Crane / Suspended Load Near Miss or Drop
    if re.search(r'\b(crane|suspended load|dropped object|dropped from|overhead load)\b', lower):
        return "Deficient rigging integrity or inadequate exclusion zone enforcement allowed personnel exposure to suspended load path."

    # 17. Work at Height / Fall Protection
    if re.search(r'\b(height|scaffold|ladder|fall from|roof edge|harness)\b', lower):
        return "Inadequate 100% fall protection tie-off or edge barrier defenses permitted exposure to elevated fall hazards."

    # If no hazard can be identified from the observation, do not invent generic root causes
    if is_no_hazard:
        return "Insufficient Information"

    # Context fallback when a specific hazard exists
    if classification == "UNSAFE ACT":
        return "Deviation from established operational safety protocols directly contributed to the observed event."
    elif classification == "UNSAFE CONDITION":
        return "Physical or environmental workplace hazards remained unmitigated, presenting operational risk."
    elif classification == "NEAR MISS":
        return "Uncontrolled hazard interaction occurred with potential consequence, but timely barrier intervention or clearance prevented harm."
    
    return "Insufficient Information regarding specific root cause."


def classify_safety_observation(
    text: str,
    hazard: Optional[str] = None,
    barrier_status: Optional[str] = None,
    energy_source: Optional[str] = None
) -> Dict[str, Any]:
    """
    Independently classifies a safety observation as:
    - NEAR MISS
    - UNSAFE ACT
    - UNSAFE CONDITION

    Core Principles:
    1. An actual injury occurred -> NEVER Near Miss.
    2. NEAR MISS requires: NO actual injury/harm, AND potential for injury/harm existed.
    3. UNSAFE ACT requires evidence that unsafe human behavior, procedure violation,
       improper operation, or non-compliance directly contributed.
    4. UNSAFE CONDITION applies when the primary cause is physical/environmental condition,
       defective equipment, lack of engineering control, or workplace hazards without worker violation.
    5. An injury does NOT automatically mean Unsafe Act.
    """
    lower = text.lower().strip()

    # Detect negation phrases indicating NO injury
    no_injury_patterns = [
        r'\bnot injured\b',
        r'\bno injury\b',
        r'\bno one was injured\b',
        r'\bno one injured\b',
        r'\bavoided injury\b',
        r'\bprevented injury\b',
        r'\bwithout injury\b',
        r'\bdid not cause injury\b',
        r'\bno personnel harmed\b',
        r'\bno harm\b',
        r'\bwithout being injured\b',
        r'\bno one hurt\b'
    ]
    has_no_injury_statement = any(re.search(p, lower) for p in no_injury_patterns)

    # Detect explicit injury occurrences
    injury_patterns = [
        r'\binjured\b',
        r'\binjury\b',
        r'\bburns?\b',
        r'\bwound\b',
        r'\bcut\b',
        r'\blaceration\b',
        r'\bamputation\b',
        r'\bfracture\b',
        r'\bbroken bone\b',
        r'\bheat stroke\b',
        r'\bheat exhaustion\b',
        r'\bhospitalized\b',
        r'\bhospitalization\b',
        r'\bresulting in injury\b',
        r'\bsuffered.*injury\b',
        r'\bgot hurt\b'
    ]
    has_injury_mention = any(re.search(p, lower) for p in injury_patterns)
    
    # Actual injury is TRUE if injury mentioned AND not negated by a "no injury" statement
    actual_injury = has_injury_mention and not has_no_injury_statement

    # Detect Near-Miss indicators
    near_miss_indicators = [
        r'\balmost slipped\b',
        r'\bnearly slipped\b',
        r'\bnearly struck\b',
        r'\balmost struck\b',
        r'\balmost hit\b',
        r'\bnearly hit\b',
        r'\bnearly contacted\b',
        r'\balmost contacted\b',
        r'\bnearly came into contact\b',
        r'\balmost fell\b',
        r'\bnarrowly avoided\b',
        r'\bnarrowly missed\b',
        r'\bclose call\b',
        r'\bnear miss\b'
    ]
    has_near_miss_event = any(re.search(p, lower) for p in near_miss_indicators)

    # Detect Unsafe Human Behavior / Procedural Violation
    unsafe_act_patterns = [
        r'\bignored.*(heat-rest|schedule|ppe|rule|procedure|warning|permit)\b',
        r'\boperated.*without.*(ppe|guard|permit|authorization|tie-off|loto)\b',
        r'\boperating.*without.*(ppe|guard|permit|authorization|tie-off|loto)\b',
        r'\bwithout required (ppe|guard|permit|harness)\b',
        r'\bwithout the required (guard|ppe|permit|harness)\b',
        r'\bwithout wearing required\b',
        r'\bfailed to wear\b',
        r'\brefused to wear\b',
        r'\bbypassed.*(interlock|guard|procedure|switch|safety)\b',
        r'\bbypassing.*(interlock|guard|procedure|switch|safety)\b',
        r'\bentered.*restricted area.*without\b',
        r'\bentered.*without authorization\b',
        r'\bunauthorized entry\b',
        r'\bwithout following the required procedure\b',
        r'\bhandling.*without following\b',
        r'\bworking without loto\b',
        r'\bdid not apply lockout\b',
        r'\bwithout isolation\b',
        r'\breckless\b',
        r'\bspeeding\b',
        r'\bdistracted\b',
        r'\busing mobile phone\b',
        r'\bstanding under.*suspended\b',
        r'\bwalked beneath.*load\b'
    ]
    has_unsafe_act_behavior = any(re.search(p, lower) for p in unsafe_act_patterns)

    # -------------------------------------------------------------------------
    # CLASSIFICATION DECISION ENGINE
    # -------------------------------------------------------------------------
    if actual_injury:
        # If an actual injury occurred, it CANNOT be a Near Miss.
        if has_unsafe_act_behavior:
            classification = "UNSAFE ACT"
            code = "UNSAFE_ACT"
            reasoning = "The report describes an actual injury directly contributed to by unsafe human action or procedure violation."
        else:
            classification = "UNSAFE CONDITION"
            code = "UNSAFE_CONDITION"
            reasoning = "An actual injury occurred, but the report indicates it was primarily driven by physical, environmental, or equipment hazards without worker behavioral fault."
    else:
        # No actual injury occurred
        if has_near_miss_event or (has_no_injury_statement and any(k in lower for k in ["almost", "nearly", "narrowly", "close call", "slipped", "contact", "struck"])):
            classification = "NEAR MISS"
            code = "NEAR_MISS"
            reasoning = "No actual injury occurred, and the observation describes a close-call event with potential to cause consequence."
        elif has_unsafe_act_behavior:
            classification = "UNSAFE ACT"
            code = "UNSAFE_ACT"
            reasoning = "The report identifies unsafe human behavior, procedure non-compliance, or improper operation."
        else:
            # Physical, equipment, or environmental condition without event/near-hit
            classification = "UNSAFE CONDITION"
            code = "UNSAFE_CONDITION"
            reasoning = "The primary report context reflects a hazardous physical, mechanical, or environmental workplace condition."

    # Synthesize factual context root cause
    root_cause = infer_root_cause(text, classification, hazard, barrier_status)

    return {
        "classification": classification,
        "classification_code": code,
        "actual_injury": actual_injury,
        "has_unsafe_act_behavior": has_unsafe_act_behavior,
        "root_cause": root_cause,
        "classification_reasoning": reasoning
    }


def classify_sif_precursor(
    report_type: str,
    hazard: Optional[str],
    barrier_status: Optional[str],
    energy_source: Optional[str],
    sif_assessment: str
) -> Dict[str, Any]:
    """
    Synthesizes multi-attribute safety intelligence classification:
    - Risk Priority Tier
    - Precursor Density Impact
    - Control Hierarchy Level
    """
    if sif_assessment in ["YES", "SIF"]:
        if barrier_status in ["BARRIER_MISSING", "BARRIER_FAILED"]:
            priority = "CRITICAL_PRECURSOR"
            priority_label = "Critical Priority"
            urgency = "Immediate Stop-Work / Operational Verification Required"
            confidence = 0.94
        else:
            priority = "ELEVATED_PRECURSOR"
            priority_label = "Elevated Priority"
            urgency = "Barriers Compromised - Targeted Inspection Needed"
            confidence = 0.88
    elif sif_assessment == "INSUFFICIENT_INFORMATION":
        priority = "DATA_INCOMPLETE"
        priority_label = "Data Clarification"
        urgency = "Report narrative lacks equipment, energy, or barrier details"
        confidence = 0.50
    else:
        priority = "ROUTINE_CONTROLLED"
        priority_label = "Routine Controlled"
        urgency = "Standard HSE Housekeeping / Administrative Follow-up"
        confidence = 0.92

    # Classify barrier control level
    barrier_hierarchy = "ENGINEERING"
    if barrier_status in ["BARRIER_FAILED", "BARRIER_MISSING"]:
        barrier_hierarchy = "CRITICAL_HARD_DEFENSE"
    elif barrier_status == "BARRIER_PRESENT":
        barrier_hierarchy = "ADMINISTRATIVE_OR_PPE"

    return {
        "priority_tier": priority,
        "priority_label": priority_label,
        "urgency": urgency,
        "confidence_score": confidence,
        "barrier_hierarchy_impact": barrier_hierarchy
    }

