"""
IOGP Life-Saving Rules Mapping Engine
------------------------------------
Maps free-text safety report evidence deterministically against the 9 standard
IOGP Life-Saving Rules (LSR):
1. Energy Isolation (LSR-01)
2. Work at Height (LSR-02)
3. Safe Mechanical Lifting (LSR-03)
4. Line of Fire (LSR-04)
5. Confined Space Entry (LSR-05)
6. Bypassing Safety Controls (LSR-06)
7. Hot Work & Fire Prevention (LSR-07)
8. Driving & Mobile Equipment (LSR-08)
9. Work Authorization / PTW (LSR-09)

Supports:
- Single primary rule mapping
- Multi-rule support when multiple rules are genuinely triggered
- Strict rule: Never forces a rule when evidence is insufficient
- Energy Vector is kept conceptually distinct from IOGP Rules.
"""

import re
from typing import Dict, Any, Optional, List

LSR_DEFINITIONS = {
    "ENERGY_ISOLATION": {
        "code": "LSR-01",
        "name": "Energy Isolation (LOTO)",
        "tagline": "Verify isolation and zero energy before starting work",
        "keywords": [
            r'\bloto\b', r'\block[\s-]*out\b', r'\btag[\s-]*out\b', r'\bwithout_isolation\b',
            r'\bnot_locked_out\b', r'\bisolat\w+', r'\bzero energy\b', r'\bde-energiz\w+',
            r'\belectrical panel\b', r'\bcircuit breaker\b', r'\bswitchgear\b'
        ],
        "mandatory_controls": [
            "Physical lock and tag applied at isolation point",
            "Zero energy verification (try-step / voltage test / pressure bleed)",
            "Authorized isolation certificate in place"
        ],
        "category": "High-Energy Control"
    },
    "WORK_AT_HEIGHT": {
        "code": "LSR-02",
        "name": "Work at Height",
        "tagline": "Protect yourself against a fall when working at height",
        "keywords": [
            r'\bheight\b', r'\bwithout_harness\b', r'\bscaffold\w*', r'\bladder\b',
            r'\bharness\b', r'\blanyard\b', r'\bfall arrest\b', r'\bguardrail\b',
            r'\broof\b', r'\bopen grating\b', r'\bmanlift\b'
        ],
        "mandatory_controls": [
            "100% tie-off using approved double lanyard harness above 1.8m",
            "Inspected and certified scaffolding with green tag",
            "Toe-boards and mid-rails secured on all working decks"
        ],
        "category": "Fall Protection"
    },
    "SAFE_MECHANICAL_LIFTING": {
        "code": "LSR-03",
        "name": "Safe Mechanical Lifting",
        "tagline": "Plan lifting operations and control the lift zone",
        "keywords": [
            r'\bcrane\b', r'\blift\w+', r'\brigg\w+', r'\bsling\b', r'\bshackle\b',
            r'\bsuspended load\b', r'\bhoist\b', r'\btagline\b', r'\bwinch\b'
        ],
        "mandatory_controls": [
            "Exclusion zone established beneath suspended load path",
            "Certified lifting gear with valid inspection color code",
            "Competent rigger and designated banksman directing the lift"
        ],
        "category": "Mechanical Lifting"
    },
    "LINE_OF_FIRE": {
        "code": "LSR-04",
        "name": "Line of Fire",
        "tagline": "Keep yourself and others out of the line of fire",
        "keywords": [
            r'\bline of fire\b', r'\bstruck by\b', r'\bstruck-by\b', r'\bpinch point\b', r'\bdropped object\b',
            r'\bfalling object\b', r'\bwhipping hose\b', r'\bstored tension\b', r'\bpressure release\b',
            r'\bstanding under\b', r'\bdrop zone\b', r'\bunsafe proximity\b'
        ],
        "mandatory_controls": [
            "Barricades and clear warning signs around dynamic drop zones",
            "Body positioning clear of potential projectile or recoil paths",
            "Tool tethering and secondary retention nets for overhead works"
        ],
        "category": "Physical Trajectory Hazard"
    },
    "CONFINED_SPACE": {
        "code": "LSR-05",
        "name": "Confined Space Entry",
        "tagline": "Obtain authorization before entering a confined space",
        "keywords": [
            r'\bconfined space\b', r'\btank entry\b', r'\bvessel entry\b', r'\bmanhole\b',
            r'\bh2s\b', r'\btoxic gas\b', r'\boxygen deficiency\b', r'\bno_gas_test\b',
            r'\bbreathing apparatus\b'
        ],
        "mandatory_controls": [
            "Continuous atmospheric gas monitoring calibrated for multi-gas (LEL, O2, H2S, CO)",
            "Dedicated hole-watch standby personnel outside entry point",
            "Emergency rescue plan and extraction tripod stationed at site"
        ],
        "category": "Atmospheric & Space Hazard"
    },
    "BYPASS_SAFETY_CONTROLS": {
        "code": "LSR-06",
        "name": "Bypassing Safety Controls",
        "tagline": "Obtain authorization before overriding or disabling safety controls",
        "keywords": [
            r'\bbypass\w*', r'\boverrid\w*', r'\bbridg\w*', r'\bdefeat\w*',
            r'\binterlock\b', r'\bguard_missing\b', r'\besd bypass\b', r'\balarm defeat\b',
            r'\btamper\w*', r'\bbypassing safety control\b', r'\bremoving machine guard\b',
            r'\bunsafe operation\b'
        ],
        "mandatory_controls": [
            "Formal Management of Change (MOC) and bypass certificate authorized",
            "Compensatory physical controls manned continuously",
            "Clear warning signage placed at bypassed instrumentation"
        ],
        "category": "Engineered Barrier Defenses"
    },
    "HOT_WORK": {
        "code": "LSR-07",
        "name": "Hot Work & Fire Prevention",
        "tagline": "Control flammables and ignition sources in hazardous zones",
        "keywords": [
            r'\bhot work\b', r'\bwelding\b', r'\bgrinding\b', r'\bsparks\b',
            r'\bflammable\b', r'\bcombustible\b', r'\btorch cutting\b', r'\bfire watch\b',
            r'\bfire\b', r'\bexplosion\b', r'\bhydrocarbon leak\b', r'\bgas release\b',
            r'\bgas\s+(?:is\s+)?leak\w*\b', r'\bgas leak\w*\b', r'\bleak\w* gas\b', r'\bgas leakage\b', r'\bflammable gas\b'
        ],
        "mandatory_controls": [
            "Dedicated fire watch stationed with charged fire extinguisher for 30 min post-work",
            "Atmospheric hydrocarbon gas testing completed within 15m radius (0% LEL)",
            "Fire-retardant habitat / containment blankets installed"
        ],
        "category": "Thermal & Ignition Hazard"
    },
    "MOBILE_EQUIPMENT": {
        "code": "LSR-08",
        "name": "Driving & Mobile Equipment",
        "tagline": "Follow road safety rules and maintain pedestrian segregation",
        "keywords": [
            r'\bforklift\b', r'\bvehicle\b', r'\btruck\b', r'\bdumper\b',
            r'\bpedestrian\b', r'\bblind spot\b', r'\breversing\b', r'\bspeeding\b'
        ],
        "mandatory_controls": [
            "Physical pedestrian walkways segregated with fixed barriers",
            "Seatbelt fastened, beacon lamp and reverse audible alarm operational",
            "Designated marshaller during reversing in confined yard areas"
        ],
        "category": "Kinetic & Transport Hazard"
    },
    "WORK_AUTHORIZATION": {
        "code": "LSR-09",
        "name": "Work Authorization (PTW)",
        "tagline": "Work with a valid work permit when required",
        "keywords": [
            r'\bwithout_permit\b', r'\bno_permit\b', r'\bpermit\b', r'\bptw\b',
            r'\bunauthorized_action\b', r'\bjha\b', r'\btoolbox talk\b', r'\brisk assessment\b',
            r'\bentering restricted area\b', r'\brestricted area\b', r'\bprocedure not followed\b',
            r'\bunauthorized operation\b', r'\boperating without authorization\b'
        ],
        "mandatory_controls": [
            "Valid, signed Permit-to-Work (PTW) displayed visibly at job site",
            "Job Hazard Analysis (JHA) briefed to all workers during pre-task briefing (TBT)",
            "Stop-work authority re-briefed if job scope or environmental conditions change"
        ],
        "category": "Administrative Governance"
    }
}


def map_all_life_saving_rules(text: str) -> List[Dict[str, Any]]:
    """
    Evaluates free-text safety report against all 9 IOGP Life-Saving Rules.
    Returns list of all genuinely matched rules (allowing multiple matches).
    Never forces a rule when evidence is insufficient.
    """
    if not text or not isinstance(text, str):
        return []

    lower_text = text.lower()
    matched_rules: List[Dict[str, Any]] = []

    for rule_key, rule_meta in LSR_DEFINITIONS.items():
        for pattern in rule_meta["keywords"]:
            if re.search(pattern, lower_text):
                # Detect compliance or violation indicators
                violation = bool(re.search(
                    r'\b(without|no_|not_|missing|failed|bypassed|violated|ignored|unauthorized|sheared|parted|ruptured|damaged)\b',
                    lower_text
                ))
                matched_rules.append({
                    "rule_key": rule_key,
                    "rule_code": rule_meta["code"],
                    "rule_name": rule_meta["name"],
                    "tagline": rule_meta["tagline"],
                    "category": rule_meta["category"],
                    "status": "COMPROMISED / VIOLATION DETECTED" if violation else "RELEVANT / VERIFICATION REQUIRED",
                    "severity": "CRITICAL" if violation else "MONITORED",
                    "mandatory_controls": rule_meta["mandatory_controls"]
                })
                break  # Matched this rule, continue checking other rules

    return matched_rules


def map_life_saving_rules(text: str) -> Optional[Dict[str, Any]]:
    """
    Returns primary matched IOGP rule along with an 'all_matched_rules' list.
    Maintains backward compatibility with callers expecting a single dict or None.
    """
    matches = map_all_life_saving_rules(text)
    if not matches:
        return None

    primary = dict(matches[0])
    primary["all_matched_rules"] = matches
    return primary
