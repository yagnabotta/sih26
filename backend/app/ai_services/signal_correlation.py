"""
Weak Signal & Hazard Interaction Correlation Engine
---------------------------------------------------
Implements multi-factor weak signal correlation, cross-hazard escalation analysis,
and compound precursor identification across safety observation reports.

Core Principles:
1. Multi-factor correlation: Incident type, underlying hazard, location relationship,
   time window, shared equipment/process, environmental conditions, and evidence confidence.
2. Rejection of additive count logic: Does NOT predict major incident simply because
   similar minor incidents occur or counts are added (e.g., Small Fire + Small Fire != Big Fire).
3. Distinguishes CONFIRMED, PLAUSIBLE, UNCERTAIN, and UNSUPPORTED correlations.
4. Accounts for active safety controls to assess realistic residual risk.
5. Rejects duplicate submissions from inflating risk scores.
6. Retains appropriate operational priority for severe isolated hazards.
"""

import re
from typing import List, Dict, Any, Optional, Set, Tuple
from datetime import datetime, date, timedelta
from collections import defaultdict


# ============================================================================
# 1. HAZARD ROLE & SEMANTIC FEATURE DEFINITIONS
# ============================================================================

ROLE_PATTERNS = {
    "GAS_LEAK": re.compile(
        r'\b((?:gas\b.{0,25}\b(?:leak\w*|escap\w*|hiss\w*|smell|odor|vent\w*|cloud|release\w*)|'
        r'(?:leak\w*|escap\w*|hiss\w*|release\w*).{0,25}\bgas\b)|natural\s+gas|propane|lpg|methane|'
        r'hydrocarbon\s+(?:gas|vapor)|flammable\s+gas|gas\s+detector|lel)\b',
        re.IGNORECASE
    ),
    "IGNITION_SOURCE": re.compile(
        r'\b(ignition\s*(?:source)?|spark\w*|welding|cutting\s+torch|grinding|hot\s*work|open\s+flame|'
        r'naked\s+flame|torch|electrical\s+switch|arcing|arc\s+flash|heater|furnace|burners?|combustion)\b',
        re.IGNORECASE
    ),
    "FIRE_OR_SMOKE": re.compile(
        r'\b(fire|smoke|flames?|smoldering|burning|open\s+flame|flash\s+fire|conflagration|fire\s+explosion|explosion|blast|detonation|toaster\s+fire|kitchen\s+fire|trash\s+fire)\b',
        re.IGNORECASE
    ),
    "POOR_VENTILATION": re.compile(
        r'\b(poor\s+ventilation|inadequate\s+ventilation|unventilated|confined\s+space|enclosed\s+(?:area|room|space|chamber)|'
        r'no\s+air\s*flow|stagnant\s+air|low[\s-]lying|trench|under\s+awning|pit|basement|poor\s+airflow|stagnant\s+vapor)\b',
        re.IGNORECASE
    ),
    "OIL_FUEL_LEAK": re.compile(
        r'\b((?:(?:oil|fuel|diesel|hydraulic|lubricant|lube|solvent)\b.{0,25}\b(?:leak\w*|seep\w*|spill\w*|puddle|drip\w*|spray\w*)|'
        r'(?:leak\w*|seep\w*|spill\w*|drip\w*).{0,25}\b(?:oil|fuel|diesel|hydraulic|lubricant|lube|solvent)\b)|flammable\s+liquid)\b',
        re.IGNORECASE
    ),
    "HOT_SURFACE": re.compile(
        r'\b(hot\s+surface|exhaust\s*(?:manifold)?|steam\s+pipe|boiler|operating\s+heater|turbocharger|radiator|hot\s+engine|uninsulated\s+pipe|high\s+surface\s+temp)\b',
        re.IGNORECASE
    ),
    "ELECTRICAL_FAULT": re.compile(
        r'\b(electrical\s+fault|short\s+circuit|sparking\s+(?:wire|cable)|loose\s+(?:connection|cable|lug|terminal)|'
        r'overheated\s+cable|damaged\s+insulation|breaker\s+tripping|arcing\s+terminal|switchboard\s+spark|motor\s+fault|'
        r'electrical\s+malfunction|insulation\s+breakdown|electrical\s+fire)\b',
        re.IGNORECASE
    ),
    "FLAMMABLE_MATERIAL": re.compile(
        r'\b(flammable\s+material|combustible|solvent\s+drum|paint\s+can|wooden\s+pallet|cardboard|paper\s+waste|oily\s+rag|cleaning\s+solvent|chemical\s+thinner)\b',
        re.IGNORECASE
    ),
    "CHEMICAL_LEAK": re.compile(
        r'\b(chemical\s+(?:leak\w*|spill\w*|drip\w*|fumes?)|acid\s+(?:spill\w*|leak\w*|drip\w*|line)|caustic|'
        r'toxic\s+(?:chemical|vapor|gas)|chlorine|ammonia|h2s|hydrogen\s+sulfide|benzene|hazardous\s+liquid|corrosive)\b',
        re.IGNORECASE
    ),
    "HUMAN_EXPOSURE": re.compile(
        r'\b(human\s+exposure|workers?\s+(?:present|nearby|walking|in\s+area)|personnel\s+(?:exposed|present|in\s+area|nearby)|'
        r'operator\s+nearby|technicians?\s+(?:working|in\s+proximity)|without\s+ppe|no\s+respirator|line[\s-]of[\s-]fire|'
        r'pedestrians?|roughnecks?|in\s+proximity)\b',
        re.IGNORECASE
    ),
    "PRESSURE_INCREASE": re.compile(
        r'\b(pressure\s+(?:increase|rise|rising|spike|surge|surging|anomalous)|overpressure|exceeded\s+setpoint|high\s+pressure|abnormal\s+pressure|gauge\s+rising|relief\s+valve\s+lift|\d+\s*bar)\b',
        re.IGNORECASE
    ),
    "EQUIPMENT_WEAKNESS": re.compile(
        r'\b(equipment\s+weakness|worn\s+gasket|thinned\s+pipe|fatigued\s+bolt|cracked\s+(?:casing|flange|weld)|degraded\s+seal|'
        r'seal\s+weeping|seal\s+weep|loosened\s+flange|structural\s+degradation|compromised\s+joint|vibration|pulsation)\b',
        re.IGNORECASE
    ),
    "CORROSION": re.compile(
        r'\b(corrosion|corroded|severe\s+rust|metal\s+loss|pitting|wall\s+thinning|oxidation|pipe\s+corrosion|flange\s+corrosion)\b',
        re.IGNORECASE
    ),
    "HIGH_PRESSURE": re.compile(
        r'\b(high\s+pressure|pressurized\s+(?:line|pipeline|pipe|vessel|system|manifold|cylinder)|\d+\s*bar|high\s+psi)\b',
        re.IGNORECASE
    ),
    "BLOCKED_EXIT": re.compile(
        r'\b((?:emergency\s+exit|exit|escape\s+route|egress|fire\s+door)\b.{0,30}\b(?:blocked|obstructed|locked|padlocked|cluttered|impassable)\b|'
        r'(?:blocked|obstructed|locked|padlocked|cluttered|impassable)\b.{0,30}\b(?:emergency\s+exit|exit|escape\s+route|egress|fire\s+door)\b)\b',
        re.IGNORECASE
    ),
    "DAMAGED_GUARD": re.compile(
        r'\b(damaged\s+(?:machine\s+)?guard|missing\s+guard|guard\s+removed|interlock\s+bypassed|nip\s+point\s+exposed|'
        r'conveyor\s+guard\s+off|unprotected\s+rotating|safety\s+interlock\s+defeated|unguarded\s+machine|inadequate\s+(?:machine\s+)?guarding|inadequate\s+guarding)\b',
        re.IGNORECASE
    ),
    "MOVING_MACHINERY": re.compile(
        r'\b(moving\s+machinery|rotating\s+(?:equipment|shaft|parts?)|conveyor\s+belt|pump\s+shaft|compressor\s+rotor|'
        r'motor\s+coupling|drill\s+string|spindle|crusher|spinning\s+drum|roller|pinch\s+point|nip\s+point|conveyor)\b',
        re.IGNORECASE
    ),
    "NEAR_MISS_EVENT": re.compile(
        r'\b(near[\s-]miss|almost\s+(?:injured|hit|struck|caught|trapped|drawn\s+in)|narrowly\s+avoided|'
        r'pulled\s+(?:hand|away|arm)\s+in\s+time|clothing\s+(?:caught|snagged|dragged)|close\s+call)\b',
        re.IGNORECASE
    ),
    "VIBRATION": re.compile(
        r'\b(vibration|micro[\s-]vibration|pulsation|cyclic\s+thermal|chattering|resonant\s+vibration|shaking\s+pipe)\b',
        re.IGNORECASE
    ),
    "SEAL_WEEPING": re.compile(
        r'\b(seal\s+weeping|acoustic\s+weep|ultrasonic\s+(?:weep|leak)|flange\s+weeping|micro[\s-]seepage|gasket\s+weep|gasket\s+seepage)\b',
        re.IGNORECASE
    ),
    "SLIP_FALL_ICE": re.compile(
        r'\b(icy|ice\b|frost\b|snow\b|frozen\s+ground|winter\s+weather|parking\s+lot\s+ice)\b',
        re.IGNORECASE
    ),
    "SLIP_FALL_KITCHEN": re.compile(
        r'\b(cooking\s+oil|kitchen\s+grease|cafeteria\s+floor|kitchen\s+floor|spilled\s+gravy|food\s+spill|canteen\s+floor)\b',
        re.IGNORECASE
    ),
    "HIGH_SEVERITY_HAZARD": re.compile(
        r'\b(blowout|catastrophic|rupture|massive\s+(?:release|leak)|unconfined\s+vapor|explosion\b|blast\s+wave|'
        r'50\s*bar|100\s*bar|severe\s+toxic|fatal\s+risk|life[\s-]threatening|arc\s+flash\s+blast)\b',
        re.IGNORECASE
    )
}

# Active safety barrier / control patterns
CONTROL_PATTERNS = [
    re.compile(r'\b(?:extinguish(?:ed|ing)?|put\s+out|fire\s+quenched|flame\s+doused)\b', re.IGNORECASE),
    re.compile(r'\b(?:esd\s+(?:tripped|activated|isolated|actuated)|emergency\s+shutdown\s+(?:tripped|activated|isolated))\b', re.IGNORECASE),
    re.compile(r'\b(?:isolat(?:ed|ion\s+(?:confirmed|verified))|valves?\s+(?:closed|shut)|blinded\s+flange|blocked\s+in)\b', re.IGNORECASE),
    re.compile(r'\b(?:loto\s+(?:applied|implemented|verified|locked\s+out)|lockout\s*tagout)\b', re.IGNORECASE),
    re.compile(r'\b(?:de[\s-]energiz(?:ed|ing)|power\s+(?:cut|isolated)|breaker\s+tripped\s+safely)\b', re.IGNORECASE),
    re.compile(r'\b(?:ventilated|forced\s+air\s+dilution|0%\s*lel|lel\s+(?:at\s+)?zero|atmosphere\s+cleared)\b', re.IGNORECASE),
    re.compile(r'\b(?:deluge\s+(?:activated|spray)|foam\s+blanket|fire\s+watch\s+posted|dry\s+chemical\s+standby)\b', re.IGNORECASE),
    re.compile(r'\b(?:guard\s+replaced|interlock\s+repaired|barrier\s+restored)\b', re.IGNORECASE)
]


# ============================================================================
# 2. HAZARD INTERACTION RULES KNOWLEDGE BASE
# ============================================================================

INTERACTION_RULES = [
    # 1. Gas Leak + Ignition Source -> Potential Gas-Related Ignition Risk
    {
        "id": "RULE_GAS_IGNITION",
        "name": "Gas Leak + Ignition Source / Fire Explosion Precursor",
        "primary_roles": {"GAS_LEAK", "IGNITION_SOURCE"},
        "alt_roles": {"GAS_LEAK", "FIRE_OR_SMOKE"},
        "potential_consequence": "Catastrophic Vapor Cloud Explosion (VCE) & Severe Blast Overpressure Event",
        "combined_risk": "CRITICAL",
        "base_score": 95,
        "category": "Gas Containment & Fire Explosion Prevention",
        "reason": (
            "A flammable gas release directly co-located or sharing a gas process with an active ignition source or fire explosion "
            "satisfies combustion and explosion criteria. Escaping hydrocarbon vapor mixed with flame or explosion forms an urgent "
            "vapor cloud explosion (VCE) and severe blast overpressure precursor requiring urgent investigation. Major fire and severe blast are credible escalation risks."
        ),
        "recommended_action": (
            "Immediately shut down all hot work and ignition sources, trip Emergency Shutdown (ESD) valves to isolate "
            "the gas supply, evacuate non-essential personnel, and verify 0% LEL with continuous atmospheric gas monitors."
        ),
        "expansion": {
            "role": "POOR_VENTILATION",
            "expanded_name": "Gas Leak + Poor Ventilation + Ignition Source",
            "expanded_consequence": "Gas Accumulation leading to Severe Explosion Precursor",
            "expanded_risk": "CRITICAL",
            "expanded_score": 98,
            "expanded_reason": (
                "Gas leak trapped within an unventilated or confined area allows flammable concentration to accumulate "
                "within the explosive envelope (LEL to UEL). The presence of an ignition source provides activation energy "
                "for a severe confined vapor cloud explosion with extreme blast overpressure."
            )
        }
    },
    # 2. Gas Leak + Poor Ventilation -> Gas Accumulation / Explosion Potential
    {
        "id": "RULE_GAS_VENTILATION",
        "name": "Gas Leak + Poor Ventilation",
        "primary_roles": {"GAS_LEAK", "POOR_VENTILATION"},
        "alt_roles": None,
        "potential_consequence": "Gas Accumulation / Explosion Potential",
        "combined_risk": "HIGH",
        "base_score": 88,
        "category": "Gas Containment & Atmospheric Control",
        "reason": (
            "Escaping flammable gas within an enclosed or low-lying area prevents natural convective dilution. "
            "The gas steadily accumulates toward the Lower Explosive Limit (LEL), transforming the space into an explosive volume."
        ),
        "recommended_action": (
            "Isolate the gas source, deploy portable explosion-proof ventilation fans to clear the space, and prohibit entry "
            "until multi-gas testing confirms clean atmosphere (<5% LEL and >19.5% O2)."
        ),
        "expansion": None
    },
    # 3. Oil/Fuel Leak + Hot Surface -> Fire
    {
        "id": "RULE_OIL_HOT_SURFACE",
        "name": "Oil/Fuel Leak + Hot Surface",
        "primary_roles": {"OIL_FUEL_LEAK", "HOT_SURFACE"},
        "alt_roles": None,
        "potential_consequence": "Thermal Ignition & Surface / Pool Fire Precursor",
        "combined_risk": "HIGH",
        "base_score": 85,
        "category": "Hot Work & Fire Prevention",
        "reason": (
            "Leaking combustible fuel or pressurized hydraulic oil dripping onto an uninsulated hot surface exceeding the fluid's "
            "auto-ignition temperature causes localized thermal vaporization and open flame flashover."
        ),
        "recommended_action": (
            "Depressurize and isolate the leaking oil line, install spray deflectors and permanent thermal insulation "
            "on hot manifolds, and position dry chemical fire extinguishing media."
        ),
        "expansion": None
    },
    # 4. Electrical Fault + Flammable Material -> Fire/Explosion
    {
        "id": "RULE_ELECTRICAL_FLAMMABLE",
        "name": "Electrical Fault + Flammable Material",
        "primary_roles": {"ELECTRICAL_FAULT", "FLAMMABLE_MATERIAL"},
        "alt_roles": None,
        "potential_consequence": "Electrical Fire & Rapid Flame Spread",
        "combined_risk": "HIGH",
        "base_score": 86,
        "category": "Electrical Fire Safety & Prevention",
        "reason": (
            "Electrical arcing, terminal overheating, or short-circuit sparks in direct proximity to combustible rags, open "
            "solvent drums, or waste materials ignite a localized fire that can spread rapidly."
        ),
        "recommended_action": (
            "De-energize electrical circuit under Lockout/Tagout (LOTO), clear all flammable supplies beyond a 10m "
            "exclusion radius, and inspect electrical connections."
        ),
        "expansion": None
    },
    # 5. Chemical Leak + Human Exposure -> Toxic Exposure
    {
        "id": "RULE_CHEMICAL_HUMAN",
        "name": "Chemical Leak + Human Exposure",
        "primary_roles": {"CHEMICAL_LEAK", "HUMAN_EXPOSURE"},
        "alt_roles": None,
        "potential_consequence": "Acute Toxic Exposure & Inhalation Injury",
        "combined_risk": "HIGH",
        "base_score": 87,
        "category": "Chemical & Toxic Hazard Management",
        "reason": (
            "Escape of hazardous chemical fluid or toxic vapor in populated operational areas without verified respiratory barriers "
            "causes direct chemical burns, toxic gas inhalation, and potential pulmonary impairment."
        ),
        "recommended_action": (
            "Evacuate personnel immediately upwind, cordon off an exclusion zone, mandate appropriate chemical PPE, "
            "and deploy neutralizing absorbent."
        ),
        "expansion": None
    },
    # 6. Pressure Increase + Equipment Weakness -> Rupture/Failure
    {
        "id": "RULE_PRESSURE_WEAKNESS",
        "name": "Pressure Increase + Equipment Weakness",
        "primary_roles": {"PRESSURE_INCREASE", "EQUIPMENT_WEAKNESS"},
        "alt_roles": None,
        "potential_consequence": "Pressure Vessel / Pipe Rupture Precursor",
        "combined_risk": "CRITICAL",
        "base_score": 93,
        "category": "Pressurized Systems Integrity",
        "reason": (
            "Operational pressure spikes or surging working fluid acting against mechanically weakened flanges or "
            "degraded gaskets exceed residual structural burst margins, triggering line rupture."
        ),
        "recommended_action": (
            "Reduce process pressure to safe operating envelope, test Pressure Safety Valves (PSVs), and conduct "
            "ultrasonic wall thickness and bolt torque verification."
        ),
        "expansion": None
    },
    # 7. Corrosion + High Pressure -> Equipment Failure / Rupture
    {
        "id": "RULE_CORROSION_PRESSURE",
        "name": "Corrosion + High Pressure",
        "primary_roles": {"CORROSION", "HIGH_PRESSURE"},
        "alt_roles": None,
        "potential_consequence": "Catastrophic Equipment Rupture / Pressurized Blowout",
        "combined_risk": "CRITICAL",
        "base_score": 92,
        "category": "Pressurized Systems Integrity",
        "reason": (
            "Severe localized corrosion wall-thinning diminishes hoop-stress resistance in high-pressure lines. High internal energy "
            "causes sudden ductile tear or pinhole rupture, leading to explosive decompression."
        ),
        "recommended_action": (
            "Derate system pressure, execute phased-array ultrasonic thickness inspection (UT), and install an engineered metallic repair "
            "sleeve or replace degraded pipe segment."
        ),
        "expansion": None
    },
    # 8. Blocked Emergency Exit + Fire -> Severe Evacuation Risk
    {
        "id": "RULE_BLOCKED_EXIT_FIRE",
        "name": "Blocked Emergency Exit + Fire",
        "primary_roles": {"BLOCKED_EXIT", "FIRE_OR_SMOKE"},
        "alt_roles": None,
        "potential_consequence": "Severe Evacuation Trap / Life Safety Threat",
        "combined_risk": "CRITICAL",
        "base_score": 95,
        "category": "Emergency Preparedness & Life Safety",
        "reason": (
            "A fire or smoke outbreak occurring while emergency exits, escape doors, or evacuation routes are obstructed creates a "
            "deadly human trap, multiplying smoke inhalation casualties and preventing safe egress."
        ),
        "recommended_action": (
            "Instantly clear obstructions from all emergency exits, unlock escape hardware, activate facility evacuation alarm, and verify "
            "secondary egress routes are completely unimpeded."
        ),
        "expansion": None
    },
    # 9. Damaged Machine Guard + Moving Machinery / Near Miss -> Serious Injury
    {
        "id": "RULE_GUARD_MACHINERY",
        "name": "Inadequate Machine Guarding + Moving Machinery / Near-Miss",
        "primary_roles": {"DAMAGED_GUARD", "MOVING_MACHINERY"},
        "alt_roles": {"DAMAGED_GUARD", "NEAR_MISS_EVENT"},
        "potential_consequence": "Severe Entanglement / Amputation / Serious Injury Precursor",
        "combined_risk": "HIGH",
        "base_score": 85,
        "category": "Mechanical Safety & Machine Guarding",
        "reason": (
            "Operating moving machinery with defeated interlocks or missing physical guards, especially when corroborated by a "
            "recorded near-miss of personnel nearly caught, indicates a critical recurring machinery entanglement risk."
        ),
        "recommended_action": (
            "Initiate emergency stop, perform Lockout/Tagout (LOTO) on machinery drive, replace damaged physical guards, and "
            "verify safety interlock cutoff switches before restarting operations."
        ),
        "expansion": None
    },
    # 10. Piping Vibration + Seal Weeping -> Joint Blowout
    {
        "id": "RULE_VIBRATION_WEEPING",
        "name": "Piping Micro-Vibration + Flange Seal Weepage",
        "primary_roles": {"VIBRATION", "SEAL_WEEPING"},
        "alt_roles": None,
        "potential_consequence": "Flange Blowout & Hydrocarbon Release Precursor",
        "combined_risk": "HIGH",
        "base_score": 88,
        "category": "Pressurized Hydrocarbons & Gas Containment",
        "reason": (
            "Continuous micro-vibration induces cyclic mechanical bolt relaxation and fastener fatigue. Combined with seal weepage, the "
            "accelerated gasket degradation leads to sudden gasket blowout on connected pipe joints."
        ),
        "recommended_action": (
            "Install vibration dampening pipe supports, depressurize line, and replace gasket with spiral-wound metallic seal torqued to spec."
        ),
        "expansion": None
    }
]


# ============================================================================
# 3. FEATURE EXTRACTION & NORMALIZATION
# ============================================================================

def normalize_location(loc: Optional[str]) -> str:
    """Normalizes location strings to support robust spatial matching."""
    if not loc or str(loc).strip().lower() in ["none", "null", "unknown", "unspecified", "n/a", ""]:
        return "unspecified-location"
    s = str(loc).strip().lower()
    m = re.search(r'unit\s*[-_#]?\s*0*(\d+)', s, re.IGNORECASE)
    if m:
        return f"unit-{int(m.group(1))}"
    s = re.sub(r'[-_]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

def extract_equipment_tag(text: str, report_dict: Optional[Dict[str, Any]] = None) -> Optional[str]:
    """Extracts explicit equipment/component tags like 'Joint B-12', 'Pipeline A-101', 'Pipeline P-101', 'Conveyor 3'."""
    # Check explicit report fields first
    if report_dict:
        for k in ["equipment", "equipment_tag", "equipment_id", "asset_id", "pipeline", "pipeline_id"]:
            val = report_dict.get(k)
            if val and str(val).strip():
                return str(val).strip().title()

    patterns = [
        r'\b(pipeline\s+[a-zA-Z0-9-]+|line\s+[a-zA-Z0-9-]+|p-?\d+[a-zA-Z0-9-]*)\b',
        r'\b(joint\s+[a-zA-Z0-9-]+|switchgear\s+[a-zA-Z0-9-]+|pump\s+[a-zA-Z0-9-]+|compressor\s+[a-zA-Z0-9-]+)\b',
        r'\b(conveyor\s+(?:line\s+)?[a-zA-Z0-9-]+|panel\s+[a-zA-Z0-9-]+|tank\s+[a-zA-Z0-9-]+|valve\s+[a-zA-Z0-9-]+)\b',
        r'\b(boiler\s+[a-zA-Z0-9-]+|feeder\s+[a-zA-Z0-9-]+|motor\s+[a-zA-Z0-9-]+)\b'
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            clean = re.sub(r'\s+', ' ', m.group(0)).strip().title()
            return clean
    return None

def extract_active_controls(full_text: str) -> List[str]:
    """Extracts documented active safety controls that reduce residual risk."""
    found = []
    t = full_text.lower()
    for cp in CONTROL_PATTERNS:
        m = cp.search(t)
        if m:
            found.append(m.group(0).strip())
    return list(dict.fromkeys(found))

def extract_report_features(report: Dict[str, Any]) -> Dict[str, Any]:
    """Extracts multi-factor structured details from an observation report."""
    desc = report.get("description") or report.get("report_text") or ""
    add_ctx = report.get("additional_context") or ""
    full_text = f"{desc} {add_ctx}".strip()
    
    # Identify hazard roles
    detected_roles: Set[str] = set()
    for role_name, pattern in ROLE_PATTERNS.items():
        if pattern.search(full_text):
            detected_roles.add(role_name)
    
    hazard_str = (report.get("identified_hazard") or "").lower()
    for role_name, pattern in ROLE_PATTERNS.items():
        if pattern.search(hazard_str):
            detected_roles.add(role_name)

    loc_val = report.get("location") or report.get("site")
    is_loc_missing = (not loc_val) or str(loc_val).strip().lower() in ["", "none", "null", "unknown", "unspecified", "n/a"]
    loc_raw = "Unspecified Location" if is_loc_missing else str(loc_val).strip()
    norm_loc = normalize_location(loc_raw)

    equip = extract_equipment_tag(full_text, report)

    # Date parsing
    date_val = report.get("report_date") or report.get("date") or report.get("timestamp") or report.get("created_at")
    is_date_missing = (not date_val) or str(date_val).strip().lower() in ["", "none", "null", "unknown", "unspecified", "n/a"]
    clean_date = None if is_date_missing else str(date_val).strip()[:10]

    sev = (report.get("observed_severity") or report.get("risk_level") or "Moderate").title()
    sif_assessment = report.get("sif_precursor_assessment") or ("YES" if report.get("sif_potential") == "SIF-potential" else "NO")

    controls = extract_active_controls(full_text)
    is_high_sev = bool(
        sev in ["High", "Critical"] or
        "HIGH_SEVERITY_HAZARD" in detected_roles or
        any(w in full_text.lower() for w in ["blowout", "rupture", "explosion", "50 bar", "100 bar", "catastrophic"])
    )

    cleaned_tokens = re.findall(r'[a-zA-Z0-9]+', full_text.lower())
    token_set = set(cleaned_tokens)

    return {
        "report_id": report.get("report_reference") or report.get("report_id") or f"REP-{report.get('id', '000')}",
        "raw_text": desc,
        "full_text": full_text,
        "location_raw": loc_raw,
        "location_norm": norm_loc,
        "is_location_missing": is_loc_missing,
        "equipment_tag": equip,
        "roles": detected_roles,
        "date": clean_date,
        "is_date_missing": is_date_missing,
        "severity": sev,
        "sif_assessment": sif_assessment,
        "report_type": report.get("report_type") or "Near Miss",
        "controls_found": controls,
        "has_controls": len(controls) > 0,
        "is_high_severity": is_high_sev,
        "token_set": token_set
    }


# ============================================================================
# 4. SPATIAL & PROCESS RELATIONSHIP EVALUATOR
# ============================================================================

def evaluate_spatial_and_process_connection(feat1: Dict[str, Any], feat2: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates physical, equipment, and operational connectivity between two reports.
    Distinguishes SHARED_EQUIPMENT, SAME_BAY, SHARED_PROCESS, DISCONNECTED, and UNCERTAIN.
    """
    missing_details = []
    if feat1["is_location_missing"]:
        missing_details.append(f"Location missing for report {feat1['report_id']}")
    if feat2["is_location_missing"]:
        missing_details.append(f"Location missing for report {feat2['report_id']}")

    if missing_details:
        return {
            "is_connected": False,
            "connection_type": "UNCERTAIN",
            "shared_equipment": None,
            "is_uncertain": True,
            "missing_details": missing_details,
            "explanation": "Cannot verify spatial relationship because location data is missing."
        }

    # 1. Shared documented equipment or pipeline
    eq1 = feat1.get("equipment_tag")
    eq2 = feat2.get("equipment_tag")
    if eq1 and eq2:
        clean1 = eq1.lower().replace(" ", "").replace("-", "")
        clean2 = eq2.lower().replace(" ", "").replace("-", "")
        if clean1 == clean2 or clean1 in clean2 or clean2 in clean1:
            return {
                "is_connected": True,
                "connection_type": "SHARED_EQUIPMENT",
                "shared_equipment": eq1,
                "is_uncertain": False,
                "missing_details": [],
                "explanation": f"Documented shared equipment/pipeline connection: {eq1}."
            }

    # Check text mentions of shared pipeline or connected process
    t1 = feat1["full_text"].lower()
    t2 = feat2["full_text"].lower()
    shared_pipeline_keywords = ["shared pipeline", "same pipeline", "common gas supply", "common header", "shared manifold"]
    if any(k in t1 or k in t2 for k in shared_pipeline_keywords):
        return {
            "is_connected": True,
            "connection_type": "SHARED_PROCESS",
            "shared_equipment": eq1 or eq2 or "Shared Process Line",
            "is_uncertain": False,
            "missing_details": [],
            "explanation": "Reports explicitly document a shared process/pipeline connection."
        }

    # 2. Location matching
    loc1 = feat1["location_norm"]
    loc2 = feat2["location_norm"]

    # Explicit independent building / distant site check
    distant_pairs = [
        ("site north", "site south"),
        ("depot a", "cafeteria b"),
        ("building a", "building b"),
        ("canteen", "cooling tower"),
        ("parking lot", "cafeteria"),
        ("kitchen", "warehouse"),
        ("kitchen", "isolated")
    ]
    raw1 = feat1["location_raw"].lower()
    raw2 = feat2["location_raw"].lower()
    for d1, d2 in distant_pairs:
        if (d1 in raw1 and d2 in raw2) or (d2 in raw1 and d1 in raw2):
            return {
                "is_connected": False,
                "connection_type": "DISCONNECTED",
                "shared_equipment": None,
                "is_uncertain": False,
                "missing_details": [],
                "explanation": f"Locations are physically disconnected ({feat1['location_raw']} vs {feat2['location_raw']}) with no shared process."
            }

    if loc1 == loc2 and loc1 != "unspecified-location":
        return {
            "is_connected": True,
            "connection_type": "SAME_BAY",
            "shared_equipment": eq1 or eq2,
            "is_uncertain": False,
            "missing_details": [],
            "explanation": f"Both observations occurred within {feat1['location_raw']}."
        }

    # Cross-text reference check
    if loc1 != "unspecified-location" and loc1 in t2:
        return {
            "is_connected": True,
            "connection_type": "SAME_BAY",
            "shared_equipment": eq1 or eq2,
            "is_uncertain": False,
            "missing_details": [],
            "explanation": f"Observation references {feat1['location_raw']} directly."
        }
    if loc2 != "unspecified-location" and loc2 in t1:
        return {
            "is_connected": True,
            "connection_type": "SAME_BAY",
            "shared_equipment": eq1 or eq2,
            "is_uncertain": False,
            "missing_details": [],
            "explanation": f"Observation references {feat2['location_raw']} directly."
        }

    # Disconnected by default when locations differ and no shared equipment
    return {
        "is_connected": False,
        "connection_type": "DISCONNECTED",
        "shared_equipment": None,
        "is_uncertain": False,
        "missing_details": [],
        "explanation": f"Locations are physically separate ({feat1['location_raw']} vs {feat2['location_raw']}) without documented connection."
    }

def calculate_proximity(feat1: Dict[str, Any], feat2: Dict[str, Any]) -> Tuple[bool, float]:
    """Evaluates spatial and temporal proximity for backward compatibility."""
    conn = evaluate_spatial_and_process_connection(feat1, feat2)
    if conn["is_connected"]:
        # Temporal check
        if feat1["date"] and feat2["date"]:
            try:
                d1 = datetime.strptime(feat1["date"], "%Y-%m-%d").date()
                d2 = datetime.strptime(feat2["date"], "%Y-%m-%d").date()
                diff = abs((d1 - d2).days)
                if diff > 60 and not conn["shared_equipment"]:
                    return False, 0.0
                time_weight = max(0.5, 1.0 - (diff / 90.0))
                return True, time_weight
            except Exception:
                return True, 0.8
        return True, 0.85
    return False, 0.0

def are_reports_duplicate(feat1: Dict[str, Any], feat2: Dict[str, Any]) -> bool:
    """Checks whether two reports are duplicate submissions of the same incident."""
    if feat1["report_id"] == feat2["report_id"]:
        return True

    # Same location (or both unspecified)
    same_loc = feat1["location_norm"] == feat2["location_norm"]
    
    # Text token Jaccard similarity
    s1 = feat1["token_set"]
    s2 = feat2["token_set"]
    if not s1 or not s2:
        return False
    jaccard = len(s1.intersection(s2)) / float(len(s1.union(s2)))

    # If near-identical wording (>= 0.80) and same hazard roles
    if jaccard >= 0.80 and same_loc and feat1["roles"] == feat2["roles"]:
        return True

    return False


# ============================================================================
# 5. CORE CORRELATION & RISK ASSESSMENT ENGINE
# ============================================================================

def evaluate_isolated_hazard(feat: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates a single isolated report (Requirement 8).
    Preserves High/Critical operational priority for severe single-point hazards,
    avoiding premature downgrading merely because a second report does not exist.
    Also detects intra-report compound precursors (e.g. gas leakage + fire explosion
    co-occurring within the same report narrative).
    """
    has_gas = "GAS_LEAK" in feat["roles"]
    has_ignition = bool({"IGNITION_SOURCE", "FIRE_OR_SMOKE"}.intersection(feat["roles"]))

    if has_gas and has_ignition:
        risk_class = "Critical"
        combined_risk = "CRITICAL"
        score = 96
        rel_name = "Gas Leak + Fire Explosion Precursor"
        consequence = "Catastrophic Vapor Cloud Explosion (VCE) & Severe Blast Overpressure Event"
        reason = (
            "Flammable gas release and fire explosion / ignition source co-occur within the observation narrative, "
            "forming an acute precursor to a catastrophic vapor cloud explosion (VCE) and severe blast overpressure event."
        )
        rec_action = (
            "Immediately activate Emergency Shutdown (ESD) isolation valves, quench all ignition sources, evacuate the hazard area, "
            "and conduct atmospheric gas testing to confirm 0% LEL."
        )
        conf = "CONFIRMED"
        cluster_detected = True
    else:
        cluster_detected = False
        is_severe = feat["is_high_severity"]
        sev_str = feat["severity"]

        if is_severe or sev_str in ["High", "Critical"]:
            risk_class = "Critical" if "HIGH_SEVERITY_HAZARD" in feat["roles"] or "blowout" in feat["full_text"].lower() else "High"
            combined_risk = risk_class.upper()
            score = 90 if risk_class == "Critical" else 80
            rel_name = "Isolated High-Severity Hazard (Prioritized Independent Precursor)"
            consequence = f"Critical isolated observation: {feat['raw_text'][:120]}"
            reason = (
                "A serious isolated hazard was identified. The system maintains its high operational risk priority "
                "based on credible worst-case consequences, without requiring a second corroborating report."
            )
            rec_action = "Execute immediate engineering isolation, verify primary barriers, and enforce safety standby."
            conf = "CONFIRMED"
        else:
            risk_class = "Low"
            combined_risk = "LOW"
            score = 25
            rel_name = "Isolated Routine Observation (No Escalation Pattern)"
            consequence = "Single routine observation analyzed in isolation with no supported escalation pattern."
            reason = "Observation does not demonstrate compound escalation or severe intrinsic consequence."
            rec_action = "Evaluate and close observation independently through standard local work orders."
            conf = "CONFIRMED"

    signals = [{
        "report_id": feat["report_id"],
        "description": feat["raw_text"],
        "location": feat["location_raw"],
        "detected_roles": list(feat["roles"])
    }]

    return {
        "cluster_detected": cluster_detected,
        "signals": signals,
        "pattern_name": rel_name,
        "relationship": rel_name,
        "incident_types": [feat["report_type"]],
        "locations": [feat["location_raw"]],
        "timestamps": [feat["date"]] if feat["date"] else [],
        "shared_hazard_or_pathway": consequence if cluster_detected else "Single-point observation evaluated on independent merit.",
        "evidence_summary": (
            f"Cross-hazard interaction detected in single narrative ({feat['report_id']}): Gas Leakage + Fire/Explosion."
            if cluster_detected else f"Single observation ({feat['report_id']}): Severity {feat['severity']}."
        ),
        "confidence_level": conf,
        "missing_information": [f"Location missing for {feat['report_id']}"] if feat["is_location_missing"] else [],
        "potential_consequence": consequence,
        "risk_classification": risk_class,
        "combined_risk": combined_risk,
        "correlation_score": score,
        "reason": reason,
        "recommended_preventive_actions": rec_action,
        "recommended_action": rec_action,
        "residual_controls_identified": feat["controls_found"]
    }


def evaluate_report_pair_or_group(reports: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Evaluates a specific pair or group of safety reports.
    Implements multi-factor correlation, cross-hazard escalation analysis,
    uncertainty representation, residual risk adjustment, and duplicate handling.
    """
    if not reports:
        return {
            "cluster_detected": False,
            "signals": [],
            "pattern_name": "No Reports Submitted",
            "relationship": "Insufficient Reports",
            "incident_types": [],
            "locations": [],
            "timestamps": [],
            "shared_hazard_or_pathway": "None",
            "evidence_summary": "Empty report list.",
            "confidence_level": "UNSUPPORTED",
            "missing_information": ["No report data provided."],
            "potential_consequence": "No data available to assess.",
            "risk_classification": "Low",
            "combined_risk": "LOW",
            "correlation_score": 0,
            "reason": "At least 1 report is required.",
            "recommended_preventive_actions": "Submit safety observations for analysis.",
            "recommended_action": "Submit safety observations for analysis.",
            "residual_controls_identified": []
        }

    features = [extract_report_features(r) for r in reports]

    # Requirement 8: Single report evaluation
    if len(features) == 1:
        return evaluate_isolated_hazard(features[0])

    contributing_signals = [
        {
            "report_id": f["report_id"],
            "description": f["raw_text"],
            "location": f["location_raw"],
            "detected_roles": list(f["roles"])
        }
        for f in features
    ]
    incident_types = list(dict.fromkeys(f["report_type"] for f in features))
    locations = list(dict.fromkeys(f["location_raw"] for f in features))
    timestamps = [f["date"] for f in features if f["date"]]

    # Collect missing information across reports
    missing_info = []
    for f in features:
        if f["is_location_missing"]:
            missing_info.append(f"Location missing for report {f['report_id']}")
        if f["is_date_missing"]:
            missing_info.append(f"Timestamp missing for report {f['report_id']}")

    # Requirement 10: Deduplication check
    is_duplicate_set = True
    for i in range(len(features) - 1):
        if not are_reports_duplicate(features[i], features[i + 1]):
            is_duplicate_set = False
            break

    if is_duplicate_set and len(features) >= 2:
        base_sev = features[0]["severity"]
        risk_class = "Moderate" if base_sev in ["High", "Critical"] else "Low"
        return {
            "cluster_detected": False,
            "signals": contributing_signals,
            "pattern_name": "Duplicate Submissions of Single Event",
            "relationship": "Duplicate Reports of Same Incident (No Multi-Signal Escalation)",
            "incident_types": incident_types,
            "locations": locations,
            "timestamps": timestamps,
            "shared_hazard_or_pathway": "None. Reports represent duplicate logging of a single observation.",
            "evidence_summary": f"Detected {len(features)} duplicate entries with matching description and roles.",
            "confidence_level": "CONFIRMED",
            "missing_information": missing_info,
            "potential_consequence": "Single observation duplicated across reporting entries without escalation.",
            "risk_classification": risk_class,
            "combined_risk": risk_class.upper(),
            "correlation_score": 25,
            "reason": (
                "The submitted reports represent duplicate submissions of the same single observation. "
                "Risk is not inflated merely because the same report appears multiple times."
            ),
            "recommended_preventive_actions": "Deduplicate safety records and consolidate under the primary incident reference.",
            "recommended_action": "Deduplicate safety records and consolidate under the primary incident reference.",
            "residual_controls_identified": features[0]["controls_found"]
        }

    # Aggregate detected roles and controls across all reports
    all_roles: Set[str] = set()
    all_controls: List[str] = []
    for f in features:
        for r in f["roles"]:
            all_roles.add(r)
        all_controls.extend(f["controls_found"])
    all_controls = list(dict.fromkeys(all_controls))

    # Evaluate connectivity between the reports (pairwise check against primary report)
    f1, f2 = features[0], features[1]
    conn = evaluate_spatial_and_process_connection(f1, f2)

    # Check specific scenario combinations
    is_gas_1 = "GAS_LEAK" in f1["roles"]
    is_gas_2 = "GAS_LEAK" in f2["roles"]

    # -------------------------------------------------------------------------
    # CASE C: Two Gas Leaks (Scenario C & Requirements 3, 4)
    # -------------------------------------------------------------------------
    if is_gas_1 and is_gas_2:
        # Case C1: Documented shared pipeline or equipment (Requirement 3)
        if conn["is_connected"] and conn["connection_type"] in ["SHARED_EQUIPMENT", "SHARED_PROCESS"]:
            eq_name = conn["shared_equipment"] or "Shared Pipeline"
            return {
                "cluster_detected": True,
                "signals": contributing_signals,
                "pattern_name": f"Common Pipeline Containment Degradation ({eq_name})",
                "relationship": "Repeated Gas Leaks on Shared Pipeline",
                "incident_types": incident_types,
                "locations": locations,
                "timestamps": timestamps,
                "shared_hazard_or_pathway": f"Multiple gas leakages linked to a common pipeline ({eq_name}) indicate systemic integrity degradation or gasket failure.",
                "evidence_summary": f"Documented connection along {eq_name}: {conn['explanation']}",
                "confidence_level": "CONFIRMED",
                "missing_information": missing_info,
                "potential_consequence": "Compound Loss of Primary Containment (LOPC) / Pressurized Line Failure",
                "risk_classification": "High",
                "combined_risk": "HIGH",
                "correlation_score": 82,
                "reason": (
                    f"Correlated gas release observations share a documented pipeline connection ({eq_name}), "
                    "indicating a common underlying containment hazard across the system."
                ),
                "recommended_preventive_actions": f"Perform immediate ultrasonic thickness scanning and gasket inspection across {eq_name}.",
                "recommended_action": f"Perform immediate ultrasonic thickness scanning and gasket inspection across {eq_name}.",
                "residual_controls_identified": all_controls
            }
        else:
            # Case C2: Two gas leaks without relationship evidence (Requirement 4)
            return {
                "cluster_detected": False,
                "signals": contributing_signals,
                "pattern_name": "Independent Gas Releases (No Common Cause Established)",
                "relationship": "Uncorrelated Gas Observations (Independent Sources)",
                "incident_types": incident_types,
                "locations": locations,
                "timestamps": timestamps,
                "shared_hazard_or_pathway": "None. Observations involve independent gas equipment in disconnected locations without shared pipeline evidence.",
                "evidence_summary": conn["explanation"],
                "confidence_level": "UNSUPPORTED",
                "missing_information": missing_info,
                "potential_consequence": "Independent localized gas releases without systemic shared escalation pathway.",
                "risk_classification": "Low",
                "combined_risk": "LOW",
                "correlation_score": 30,
                "reason": (
                    f"Two gas leaks reported in separate locations ({', '.join(locations)}) without documented shared pipeline "
                    "or common cause evidence. The system does not assert a common cause."
                ),
                "recommended_preventive_actions": "Inspect and repair each gas release point independently.",
                "recommended_action": "Inspect and repair each gas release point independently.",
                "residual_controls_identified": all_controls
            }

    # -------------------------------------------------------------------------
    # CASE A: Gas Leak + Fire / Ignition Source (Scenario A & Requirements 1, 9)
    # -------------------------------------------------------------------------
    has_gas = "GAS_LEAK" in all_roles
    has_fire_or_ign = bool(all_roles.intersection({"IGNITION_SOURCE", "FIRE_OR_SMOKE"}))

    if has_gas and has_fire_or_ign:
        # Check Requirement 7: Missing location or timestamp -> Represent uncertainty
        if conn["is_uncertain"] or missing_info:
            return {
                "cluster_detected": False,
                "signals": contributing_signals,
                "pattern_name": "Potential Correlation Requiring Verification (Missing Data)",
                "relationship": "Potential Gas-Related Ignition Risk (Uncertain / Verification Required)",
                "incident_types": incident_types,
                "locations": locations,
                "timestamps": timestamps,
                "shared_hazard_or_pathway": "Potential co-location of flammable gas release and ignition source requires physical verification.",
                "evidence_summary": f"Detected Gas Leak and Ignition/Fire, but location or timestamp is incomplete: {', '.join(missing_info)}.",
                "confidence_level": "UNCERTAIN",
                "missing_information": missing_info,
                "potential_consequence": "Possible flammable vapor ignition if reports originate from the same process or area.",
                "risk_classification": "Moderate",
                "combined_risk": "MODERATE",
                "correlation_score": 55,
                "reason": (
                    "A potential gas ignition combination was identified, but correlation cannot be confirmed due to missing data. "
                    "The system represents uncertainty and does not invent a physical connection without site verification."
                ),
                "recommended_preventive_actions": "Conduct urgent field verification to confirm physical locations and establish whether reports share a common process.",
                "recommended_action": "Conduct urgent field verification to confirm physical locations and establish whether reports share a common process.",
                "residual_controls_identified": all_controls
            }

        # Check if physically connected or shared process
        if conn["is_connected"]:
            # Requirement 9: Account for effective safety controls when assessing residual risk
            if all_controls:
                ctrl_str = ", ".join(all_controls)
                return {
                    "cluster_detected": True,
                    "signals": contributing_signals,
                    "pattern_name": "Potential Gas-Related Ignition Risk (Mitigated by Active Controls)",
                    "relationship": "Gas Leak + Ignition Source (Mitigated by Active Controls)",
                    "incident_types": incident_types,
                    "locations": locations,
                    "timestamps": timestamps,
                    "shared_hazard_or_pathway": "Flammable gas release and ignition source co-located; mitigated by active emergency isolation and controls.",
                    "evidence_summary": f"Co-located gas and ignition observation in {conn['explanation']} Corroborating controls verified: {ctrl_str}.",
                    "confidence_level": "CONFIRMED",
                    "missing_information": [],
                    "potential_consequence": "Residual Ignition / Flammable Gas Containment Hazard (Emergency controls in place)",
                    "risk_classification": "Moderate",
                    "combined_risk": "MODERATE",
                    "correlation_score": 55,
                    "reason": (
                        f"A potential gas ignition pathway was identified in {f1['location_raw']}, but documented active controls "
                        f"({ctrl_str}) successfully mitigated immediate escalation. Residual risk is classified as Moderate pending physical inspection."
                    ),
                    "recommended_preventive_actions": "Verify complete depressurization and gas clearance (0% LEL) before lifting isolation barriers.",
                    "recommended_action": "Verify complete depressurization and gas clearance (0% LEL) before lifting isolation barriers.",
                    "residual_controls_identified": all_controls
                }
            else:
                # Unmitigated Gas Leak + Fire / Ignition
                has_vent = "POOR_VENTILATION" in all_roles
                score = 98 if has_vent else 88
                risk_class = "Critical" if has_vent else "High"
                return {
                    "cluster_detected": True,
                    "signals": contributing_signals,
                    "pattern_name": "Potential Gas-Related Ignition & Blast Risk (Shared Facility/Process)",
                    "relationship": "Gas Leak + Fire / Potential Ignition Hazard",
                    "incident_types": incident_types,
                    "locations": locations,
                    "timestamps": timestamps,
                    "shared_hazard_or_pathway": "Escaping flammable hydrocarbon vapor co-located or sharing a gas process with an active ignition or fire source.",
                    "evidence_summary": f"Co-located gas release and ignition/fire identified in {conn['explanation']}",
                    "confidence_level": "CONFIRMED" if conn["connection_type"] == "SHARED_EQUIPMENT" else "PLAUSIBLE",
                    "missing_information": [],
                    "potential_consequence": "Catastrophic Vapor Cloud Explosion (VCE) & Severe Blast Overpressure Event",
                    "risk_classification": risk_class,
                    "combined_risk": risk_class.upper(),
                    "correlation_score": score,
                    "reason": (
                        f"A flammable gas release and an active fire/ignition source share an operational bay or gas process ({f1['location_raw']}). "
                        "The interaction between accumulated flammable hydrocarbon vapor and open flame/sparks forms a potential "
                        "major blast and explosion escalation risk requiring urgent investigation."
                    ),
                    "recommended_preventive_actions": "Immediately shut down all hot work, trip Emergency Shutdown (ESD) valves, and verify 0% LEL with gas detectors.",
                    "recommended_action": "Immediately shut down all hot work, trip Emergency Shutdown (ESD) valves, and verify 0% LEL with gas detectors.",
                    "residual_controls_identified": []
                }
        else:
            # SIF Precursor rejected: Disconnected locations
            return {
                "cluster_detected": False,
                "signals": contributing_signals,
                "pattern_name": "Spatially Disconnected Gas and Ignition Observations",
                "relationship": "None (Spatially Disconnected Hazards)",
                "incident_types": incident_types,
                "locations": locations,
                "timestamps": timestamps,
                "shared_hazard_or_pathway": "None. Gas leak and ignition sources are in physically disconnected facility areas without shared supply.",
                "evidence_summary": conn["explanation"],
                "confidence_level": "UNSUPPORTED",
                "missing_information": [],
                "potential_consequence": "No compound ignition escalation across separate locations.",
                "risk_classification": "Low",
                "combined_risk": "LOW",
                "correlation_score": 25,
                "reason": f"Reports are in disconnected facility areas ({', '.join(locations)}) with no shared pipeline or process.",
                "recommended_preventive_actions": "Treat observations as separate routine safety items.",
                "recommended_action": "Treat observations as separate routine safety items.",
                "residual_controls_identified": all_controls
            }

    # -------------------------------------------------------------------------
    # CASE B: Two Unrelated Small Fires (Scenario B & Requirement 2)
    # -------------------------------------------------------------------------
    is_fire_observation_1 = bool(f1["roles"].intersection({"FIRE_OR_SMOKE", "IGNITION_SOURCE"}))
    is_fire_observation_2 = bool(f2["roles"].intersection({"FIRE_OR_SMOKE", "IGNITION_SOURCE"}))

    if is_fire_observation_1 and is_fire_observation_2 and not has_gas:
        # Check if they share equipment, an electrical feeder, or a documented process
        if not conn["is_connected"] or conn["connection_type"] == "DISCONNECTED":
            return {
                "cluster_detected": False,
                "signals": contributing_signals,
                "pattern_name": "Independent Minor Fires (Unrelated Locations)",
                "relationship": "Unrelated Incidents (No Shared Hazard or Process)",
                "incident_types": incident_types,
                "locations": locations,
                "timestamps": timestamps,
                "shared_hazard_or_pathway": "None. Independent small fires occurring in disconnected buildings without shared causes or equipment.",
                "evidence_summary": f"Minor fire reports occurred in separate areas: {f1['location_raw']} and {f2['location_raw']}.",
                "confidence_level": "UNSUPPORTED",
                "missing_information": missing_info,
                "potential_consequence": "Separate localized minor events; no compound major fire pathway supported by evidence.",
                "risk_classification": "Low",
                "combined_risk": "LOW",
                "correlation_score": 25,
                "reason": (
                    f"Two small fires occurred in separate locations ({f1['location_raw']} and {f2['location_raw']}) "
                    "with no shared equipment, process, or common underlying hazard. "
                    "The system treats these as separate incidents and does not infer a major fire."
                ),
                "recommended_preventive_actions": "Investigate and close each fire observation independently under standard local corrective actions.",
                "recommended_action": "Investigate and close each fire observation independently under standard local corrective actions.",
                "residual_controls_identified": all_controls
            }


    # -------------------------------------------------------------------------
    # CASE D: Repeated Machine Guarding + Near Miss (Scenario D & Requirement 5)
    # -------------------------------------------------------------------------
    has_guard_issue = bool(all_roles.intersection({"DAMAGED_GUARD"}))
    has_near_miss_or_machinery = bool(all_roles.intersection({"NEAR_MISS_EVENT", "MOVING_MACHINERY"}))

    if has_guard_issue and has_near_miss_or_machinery and conn["is_connected"]:
        eq_name = conn["shared_equipment"] or "Machinery Line"
        return {
            "cluster_detected": True,
            "signals": contributing_signals,
            "pattern_name": "Recurring Machine Guarding Deficiency with Worker Near-Miss",
            "relationship": "Unsafe Machine Guarding + Corroborated Near-Miss",
            "incident_types": incident_types,
            "locations": locations,
            "timestamps": timestamps,
            "shared_hazard_or_pathway": "Inadequate machinery guarding directly corroborated by a recorded near-miss of personnel nearly caught in moving parts.",
            "evidence_summary": f"Machine guarding unsafe condition and near-miss event co-located in {f1['location_raw']}.",
            "confidence_level": "CONFIRMED",
            "missing_information": missing_info,
            "potential_consequence": "High SIF Precursor: Severe Mechanical Entanglement / Crushing / Amputation",
            "risk_classification": "High",
            "combined_risk": "HIGH",
            "correlation_score": 85,
            "reason": (
                "Repeated inadequate guarding condition directly corroborated by a near-miss where a worker was almost injured "
                "by moving machinery. Represents an escalating high-priority machinery hazard."
            ),
            "recommended_preventive_actions": "Lock out machinery drive immediately, reinstall certified interlocked physical guard, and conduct safety briefing.",
            "recommended_action": "Lock out machinery drive immediately, reinstall certified interlocked physical guard, and conduct safety briefing.",
            "residual_controls_identified": all_controls
        }

    # -------------------------------------------------------------------------
    # CASE E: Similar Descriptions but Unrelated Causes (Requirement 6)
    # -------------------------------------------------------------------------
    has_ice_slip = bool(f1["roles"].intersection({"SLIP_FALL_ICE"}) or f2["roles"].intersection({"SLIP_FALL_ICE"}))
    has_kitchen_slip = bool(f1["roles"].intersection({"SLIP_FALL_KITCHEN"}) or f2["roles"].intersection({"SLIP_FALL_KITCHEN"}))

    if (has_ice_slip and has_kitchen_slip) or (not conn["is_connected"] and "slip" in f1["full_text"].lower() and "slip" in f2["full_text"].lower()):
        return {
            "cluster_detected": False,
            "signals": contributing_signals,
            "pattern_name": "Independent Observations (Disparate Root Causes)",
            "relationship": "Unrelated Incidents (Disparate Operational Causes)",
            "incident_types": incident_types,
            "locations": locations,
            "timestamps": timestamps,
            "shared_hazard_or_pathway": "None. Distinct physical and causal mechanisms occurring in unrelated environments.",
            "evidence_summary": f"Reports share lexical terms but occur in distinct settings ({f1['location_raw']} vs {f2['location_raw']}).",
            "confidence_level": "UNSUPPORTED",
            "missing_information": missing_info,
            "potential_consequence": "Independent surface slip events without common organizational failure mode.",
            "risk_classification": "Low",
            "combined_risk": "LOW",
            "correlation_score": 20,
            "reason": (
                "Although narrative descriptions contain similar phrasing, the incidents occurred in unrelated facilities "
                "with distinct causal mechanisms (e.g. outdoor weather frost vs. indoor kitchen oil). False correlation rejected."
            ),
            "recommended_preventive_actions": "Apply localized mitigations (salting parking lot / degreasing kitchen floor) separately.",
            "recommended_action": "Apply localized mitigations (salting parking lot / degreasing kitchen floor) separately.",
            "residual_controls_identified": all_controls
        }

    # -------------------------------------------------------------------------
    # CASE F: Standard Knowledge Base Interaction Rules
    # -------------------------------------------------------------------------
    if not conn["is_connected"]:
        return {
            "cluster_detected": False,
            "signals": contributing_signals,
            "pattern_name": "Spatially Disconnected Observations",
            "relationship": "None (Spatially Disconnected Hazards)",
            "incident_types": incident_types,
            "locations": locations,
            "timestamps": timestamps,
            "shared_hazard_or_pathway": "None. Observations occurred in separate locations without documented connection.",
            "evidence_summary": conn["explanation"],
            "confidence_level": "UNSUPPORTED",
            "missing_information": missing_info,
            "potential_consequence": "No compound escalation detected across separate locations.",
            "risk_classification": "Low",
            "combined_risk": "LOW",
            "correlation_score": 20,
            "reason": f"Reports are in disconnected facility areas ({', '.join(locations)}) with no shared equipment.",
            "recommended_preventive_actions": "Treat observations as separate routine safety items.",
            "recommended_action": "Treat observations as separate routine safety items.",
            "residual_controls_identified": all_controls
        }

    best_rule: Optional[Dict[str, Any]] = None
    best_score = 0
    matched_expansion = False

    for rule in INTERACTION_RULES:
        req = rule["primary_roles"]
        alt = rule.get("alt_roles")
        is_match = req.issubset(all_roles) or (alt and alt.issubset(all_roles))
        if is_match:
            exp = rule.get("expansion")
            score = rule["base_score"]
            is_expanded = False
            if exp and exp["role"] in all_roles:
                score = exp["expanded_score"]
                is_expanded = True
            if score > best_score:
                best_score = score
                best_rule = rule
                matched_expansion = is_expanded

    if not best_rule:
        return {
            "cluster_detected": False,
            "signals": contributing_signals,
            "pattern_name": "Independent Hazards (No Compound Escalation)",
            "relationship": "None (Independent Hazards Without Interaction)",
            "incident_types": incident_types,
            "locations": locations,
            "timestamps": timestamps,
            "shared_hazard_or_pathway": "None. The submitted observations do not share physical hazard interaction or co-located energy vectors.",
            "evidence_summary": "No interacting hazard vectors detected between observations.",
            "confidence_level": "UNSUPPORTED",
            "missing_information": missing_info,
            "potential_consequence": "No compound escalation detected.",
            "risk_classification": "Low",
            "combined_risk": "LOW",
            "correlation_score": 25,
            "reason": "The submitted observations do not share physical hazard interaction, equipment, or co-located energy vectors that would compound into a serious precursor.",
            "recommended_preventive_actions": "Treat observations as separate routine safety items.",
            "recommended_action": "Treat observations as separate routine safety items.",
            "residual_controls_identified": all_controls
        }

    exp = best_rule.get("expansion")
    if matched_expansion and exp:
        rel_name = exp["expanded_name"]
        pot_consequence = exp["expanded_consequence"]
        comb_risk = exp["expanded_risk"]
        reason_text = exp["expanded_reason"]
        final_score = exp["expanded_score"]
    else:
        rel_name = best_rule["name"]
        pot_consequence = best_rule["potential_consequence"]
        comb_risk = best_rule["combined_risk"]
        reason_text = best_rule["reason"]
        final_score = best_rule["base_score"]

    # Active controls adjustment for standard interaction rule
    risk_class = comb_risk.title()
    if all_controls:
        final_score = max(50, final_score - 30)
        risk_class = "Moderate"
        comb_risk = "MODERATE"
        reason_text += f" Mitigated by active safety controls: {', '.join(all_controls)}."

    conf_level = "CONFIRMED" if conn["connection_type"] == "SHARED_EQUIPMENT" else "PLAUSIBLE"
    if missing_info:
        conf_level = "UNCERTAIN"

    return {
        "cluster_detected": True,
        "signals": contributing_signals,
        "pattern_name": rel_name,
        "relationship": rel_name,
        "incident_types": incident_types,
        "locations": locations,
        "timestamps": timestamps,
        "shared_hazard_or_pathway": pot_consequence,
        "evidence_summary": f"Interacting hazards identified in {f1['location_raw']}: {conn['explanation']}",
        "confidence_level": conf_level,
        "missing_information": missing_info,
        "potential_consequence": pot_consequence,
        "risk_classification": risk_class,
        "combined_risk": comb_risk,
        "correlation_score": final_score,
        "reason": reason_text,
        "recommended_preventive_actions": best_rule["recommended_action"],
        "recommended_action": best_rule["recommended_action"],
        "residual_controls_identified": all_controls
    }


# ============================================================================
# 6. MULTI-REPORT DATASET CORRELATION FOR PLATFORM DASHBOARDS
# ============================================================================

def build_progression_steps(relationship: str, consequence: str) -> List[Dict[str, str]]:
    """Builds a realistic 5-stage progression timeline based on relationship and consequence."""
    rel_low = relationship.lower()
    
    if "gas" in rel_low and ("ignition" in rel_low or "fire" in rel_low) and "ventilation" in rel_low:
        return [
            {"step": "1. Gas Leakage", "trend": "Increasing", "status": "Flange or pipeline develops pressurized gas release"},
            {"step": "2. Poor Ventilation", "trend": "Increasing", "status": "Vapor unable to disperse, accumulating in low-lying area"},
            {"step": "3. Gas Accumulation", "trend": "Increasing", "status": "Atmospheric concentration reaches explosive Lower Explosive Limit (LEL)"},
            {"step": "4. Ignition Proximity", "trend": "Increasing", "status": "Hot work or electrical fault provides active ignition source"},
            {"step": "5. Catastrophic Explosion", "trend": "Increasing", "status": "Confined vapor explosion with extreme blast overpressure"}
        ]
    elif "gas" in rel_low and ("ignition" in rel_low or "fire" in rel_low):
        return [
            {"step": "1. Hydrocarbon Release", "trend": "Increasing", "status": "Gas leaking from pressurized pipeline or flange"},
            {"step": "2. Vapor Dispersion", "trend": "Increasing", "status": "Flammable vapor plume travels toward active work zone"},
            {"step": "3. Ignition Proximity", "trend": "Increasing", "status": "Open flame, spark, or arcing contact identified nearby"},
            {"step": "4. Flash Fire Threshold", "trend": "Increasing", "status": "Mixture reaches auto-ignition envelope"},
            {"step": "5. Consequence Precursor", "trend": "Increasing", "status": "Potential flash fire or localized vapor ignition hazard"}
        ]
    elif "pipeline" in rel_low and "gas" in rel_low:
        return [
            {"step": "1. Initial Containment Weep", "trend": "Increasing", "status": "Minor gas seep detected at first flange joint"},
            {"step": "2. Systemic Pressure Pulsation", "trend": "Stable", "status": "Pressure surging or cyclic thermal stress along pipeline"},
            {"step": "3. Secondary Joint Weep", "trend": "Increasing", "status": "Second gas release detected along shared pipeline"},
            {"step": "4. Line Degradation", "trend": "Increasing", "status": "Systemic gasket fatigue or localized internal corrosion"},
            {"step": "5. Primary Containment Loss", "trend": "Increasing", "status": "Potential line blowout or major uncontained release"}
        ]
    elif "hot surface" in rel_low or "oil" in rel_low:
        return [
            {"step": "1. Fluid Loss", "trend": "Increasing", "status": "Combustible oil or fuel leaking from line/fitting"},
            {"step": "2. Thermal Migration", "trend": "Increasing", "status": "Fluid seeps onto uninsulated hot exhaust surface"},
            {"step": "3. Thermal Vaporization", "trend": "Increasing", "status": "Oil vaporizes rapidly at auto-ignition temperature"},
            {"step": "4. Surface Ignition", "trend": "Increasing", "status": "Localized flash fire erupts along pipe trench"},
            {"step": "5. Conflagration", "trend": "Increasing", "status": "Open pool fire spreads toward bulk fuel storage"}
        ]
    elif "guard" in rel_low or "machinery" in rel_low:
        return [
            {"step": "1. Guard Deficiency", "trend": "Increasing", "status": "Physical mesh barrier damaged or interlock bypassed"},
            {"step": "2. Continuous Rotation", "trend": "Stable", "status": "High-speed machinery operates with exposed nip point"},
            {"step": "3. Operator Proximity", "trend": "Increasing", "status": "Worker conducts manual task within line-of-fire"},
            {"step": "4. Corroborated Near-Miss", "trend": "Increasing", "status": "Worker clothing or limb narrowly escapes entanglement"},
            {"step": "5. SIF Amputation Risk", "trend": "Increasing", "status": "Escalating mechanical crushing and amputation hazard"}
        ]
    else:
        return [
            {"step": "1. Latent Deviation", "trend": "Increasing", "status": "Minor operating irregularity or barrier wear logged"},
            {"step": "2. Cumulative Degradation", "trend": "Increasing", "status": "Secondary safeguard or physical barrier compromised"},
            {"step": "3. Hazard Interaction", "trend": "Increasing", "status": "Co-occurring energy vector activates latent vulnerability"},
            {"step": "4. Escalation Proximity", "trend": "Increasing", "status": "Unmitigated cumulative risk approaching trip threshold"},
            {"step": "5. Precursor Escalation", "trend": "Increasing", "status": "Credible consequence pathway established requiring mitigation"}
        ]

def correlate_reports_into_weak_signals(reports: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Scans an arbitrary list of safety reports from an organization and extracts all
    meaningful hazard interaction clusters without false additive inflation.
    """
    if not reports or len(reports) < 2:
        return []

    features = [extract_report_features(r) for r in reports]

    # Cluster reports by location
    loc_groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for f in features:
        loc_groups[f["location_norm"]].append(f)

    correlated_results: List[Dict[str, Any]] = []
    seen_report_pairs = set()
    sig_counter = 1

    for loc_key, group in loc_groups.items():
        if len(group) < 2:
            continue

        # Pairwise evaluation across the group
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                f1 = group[i]
                f2 = group[j]
                pair_key = tuple(sorted([f1["report_id"], f2["report_id"]]))
                if pair_key in seen_report_pairs:
                    continue

                r1 = next(r for r in reports if (r.get("report_reference") or r.get("report_id") or f"REP-{r.get('id', '000')}") == f1["report_id"])
                r2 = next(r for r in reports if (r.get("report_reference") or r.get("report_id") or f"REP-{r.get('id', '000')}") == f2["report_id"])

                pair_eval = evaluate_report_pair_or_group([r1, r2])

                if pair_eval["cluster_detected"]:
                    seen_report_pairs.add(pair_key)
                    source_reps = [
                        {
                            "report_id": s["report_id"],
                            "report_type": f1["report_type"] if s["report_id"] == f1["report_id"] else f2["report_type"],
                            "date_submitted": str(f1["date"] or date.today()) if s["report_id"] == f1["report_id"] else str(f2["date"] or date.today()),
                            "short_description": s["description"][:100] + ("..." if len(s["description"]) > 100 else ""),
                            "unit": s["location"],
                            "excerpt": s["description"]
                        }
                        for s in pair_eval["signals"]
                    ]

                    title = f"{f1['location_raw']} {pair_eval['relationship']}"
                    progression = build_progression_steps(pair_eval["relationship"], pair_eval["potential_consequence"])

                    correlated_results.append({
                        "cluster_detected": True,
                        "id": sig_counter,
                        "signal_id": f"WS-{sig_counter:02d}",
                        "title": title,
                        "pattern_name": pair_eval.get("pattern_name", title),
                        "category": "Hazard Interaction & Precursor Correlation",
                        "relationship": pair_eval["relationship"],
                        "incident_types": pair_eval.get("incident_types", [f1["report_type"], f2["report_type"]]),
                        "locations": pair_eval.get("locations", [f1["location_raw"]]),
                        "timestamps": pair_eval.get("timestamps", []),
                        "shared_hazard_or_pathway": pair_eval.get("shared_hazard_or_pathway", pair_eval["potential_consequence"]),
                        "evidence_summary": pair_eval.get("evidence_summary", pair_eval["reason"]),
                        "confidence_level": pair_eval.get("confidence_level", "CONFIRMED"),
                        "missing_information": pair_eval.get("missing_information", []),
                        "potential_consequence": pair_eval["potential_consequence"],
                        "potential_sif_precursor": pair_eval["potential_consequence"],
                        "combined_risk": pair_eval["combined_risk"],
                        "risk_classification": pair_eval.get("risk_classification", pair_eval["combined_risk"].title()),
                        "risk_level": pair_eval.get("risk_classification", pair_eval["combined_risk"].title()),
                        "risk_score": pair_eval["correlation_score"],
                        "correlation_score": pair_eval["correlation_score"],
                        "reason": pair_eval["reason"],
                        "why_identified": pair_eval["reason"],
                        "recommended_preventive_actions": pair_eval.get("recommended_preventive_actions", pair_eval["recommended_action"]),
                        "recommended_action": pair_eval["recommended_action"],
                        "residual_controls_identified": pair_eval.get("residual_controls_identified", []),
                        "first_detected_date": source_reps[0]["date_submitted"] if source_reps else str(date.today()),
                        "source": f"Two-Signal Interaction ({len(source_reps)} Records)",
                        "connected_signals": [f"{s['report_id']}: {s['description'][:70]}" for s in pair_eval["signals"]],
                        "progression_steps": progression,
                        "source_reports": source_reps,
                        "review_status": "Under Review",
                        "reviewer_notes": f"Correlated by AI Interaction Engine: {pair_eval['relationship']} in {f1['location_raw']}.",
                        "key_learnings": f"Immediate mitigation required for {pair_eval['relationship']}.",
                        "energy_source": "Compound Energy Vector",
                        "barrier_status": "CRITICAL BARRIERS INTERLINKED",
                        "signals": pair_eval["signals"]
                    })
                    sig_counter += 1

    return correlated_results

def detect_latent_weak_signals_in_text(text: str) -> List[Dict[str, str]]:
    """Extracts latent weak signals from single report text for live analysis."""
    t_low = text.lower()
    detected = []
    
    for role_name, pattern in ROLE_PATTERNS.items():
        if pattern.search(t_low):
            detected.append({
                "category": role_name.replace("_", " ").title(),
                "signal": f"Latent {role_name.replace('_', ' ').lower()} condition detected in observation",
                "energy": "Latent Operational Energy",
                "barrier": "BARRIER LATENT DEFECT"
            })

    return detected
