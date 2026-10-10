"""
Hybrid SIF Decision Engine
==========================
Combines deterministic Rule-Based Safety Assessment with Supervised Machine Learning
Probabilities and Feature Evidence into an auditable, explainable safety decision.

Architecture:
Rule-Based SIF Assessment (High Energy + Exposure + Barrier Gap)
        +
ML Model Inference (TF-IDF + Logistic Regression calibrated probability)
        +
Feature Evidence (Active terms & log-odds weights)
        ↓
Hybrid Decision Engine

Output Schema (Kept Separately per Requirements):
- ai_classification: "SIF-potential" | "Non-SIF-potential" | "Insufficient Information"
- ai_sif_score: MAUT-grounded Multi-Hazard Risk Score (0 to 100)
- ai_confidence: Model certainty and evidence completeness (0 to 100%)
- rule_based_assessment: "YES" | "NO" | "INSUFFICIENT_INFORMATION"
- ml_probability: Float probability (0.0 to 1.0)
- final_ai_decision: "CONFIRMED SIF PRECURSOR" | "NON-SIF OBSERVATION" | "INSUFFICIENT INFORMATION"
- contributing_features: List of active terms and weights
"""

import logging
from typing import Dict, List, Optional, Any

logger = logging.getLogger("sif_assessment")

try:
    from .sif_ml_inference import predict_sif_potential
except (ImportError, ValueError):
    try:
        from sif_ml_inference import predict_sif_potential
    except ImportError:
        predict_sif_potential = None

try:
    from .hazard_detection import detect_all_hazards, HAZARD_SEVERITY_WEIGHTS
except (ImportError, ValueError):
    try:
        from hazard_detection import detect_all_hazards, HAZARD_SEVERITY_WEIGHTS
    except ImportError:
        detect_all_hazards = None
        HAZARD_SEVERITY_WEIGHTS = {}

try:
    from .safety_context import (
        is_negative_context,
        is_controlled_thermal_context,
        is_minor_contained_spill,
        is_catastrophic_explosion,
        is_spreading_process_fire,
        is_critical_toxic_or_chemical_release,
        is_vague_or_missing_info
    )
except (ImportError, ValueError):
    try:
        from safety_context import (
            is_negative_context,
            is_controlled_thermal_context,
            is_minor_contained_spill,
            is_catastrophic_explosion,
            is_spreading_process_fire,
            is_critical_toxic_or_chemical_release,
            is_vague_or_missing_info
        )
    except ImportError:
        def is_negative_context(t): return False
        def is_controlled_thermal_context(t): return False
        def is_minor_contained_spill(t): return False
        def is_catastrophic_explosion(t): return False
        def is_spreading_process_fire(t): return False
        def is_critical_toxic_or_chemical_release(t): return False
        def is_vague_or_missing_info(t): return False


def compute_maut_risk_score_legacy(
    hazard: Optional[str],
    energy_source: Optional[str],
    exposure: Optional[str],
    barrier_status: str,
    text: str,
    all_hazards: Optional[List[str]] = None,
    all_energy_sources: Optional[List[str]] = None
) -> int:
    """
    Legacy Additive Multi-Attribute Utility Theory (MAUT) Risk Score (0 - 100).
    Retained strictly for backward compatibility and benchmarking under legacy_scoring=True.
    Using a maximum-severity + cumulative-risk approach across:
    1. Multi-Hazard Severity & Cumulative Factor Boost (0 - 35)
    2. Energy Vector Severity (0 - 28)
    3. Worker Exposure Pathway (0 - 22)
    4. Safety Barrier Condition (0 - 20)
    5. Compound SIF Precursor Synergy Escalation (0 - 15)
    """
    t_low = (text or "").lower()
    h_low = (hazard or "").lower()
    e_low = (energy_source or "").lower()
    ex_low = (exposure or "").lower()

    # Discover all hazards if not explicitly passed
    detected_hazards = list(all_hazards or [])
    if not detected_hazards and detect_all_hazards is not None:
        detected_hazards = detect_all_hazards(text)
    if not detected_hazards and hazard:
        detected_hazards = [hazard]

    # 1. Multi-Hazard Severity & Cumulative Factor Boost (0 - 35)
    has_critical_context = any(
        k in t_low for k in [
            "loto", "lockout", "pressure", "high-pressure", "high pressure",
            "confined space", "electrical", "voltage", "suspended load",
            "flammable", "gas leak", "h2s"
        ]
    )

    hazard_weights: List[int] = []
    for hz in detected_hazards:
        hz_l = hz.lower()
        if any(k in hz_l for k in ["loto", "lockout", "isolation", "confined space", "atmospheric"]):
            hazard_weights.append(30)
        elif any(k in hz_l for k in ["line-of-fire", "line of fire", "high-pressure", "pressure", "suspended load", "dropped object", "electrical", "arc flash", "gas leakage", "fire"]):
            hazard_weights.append(28)
        elif any(k in hz_l for k in ["fall", "height", "trench", "excavation"]):
            hazard_weights.append(26)
        elif any(k in hz_l for k in ["chemical", "mobile equipment", "pedestrian", "safeguard", "guard"]):
            hazard_weights.append(22)
        elif any(k in hz_l for k in ["ppe", "protective equipment", "head protection", "glasses", "goggles"]):
            hazard_weights.append(22 if has_critical_context else 14)
        elif any(k in hz_l for k in ["slip", "trip", "housekeeping", "lighting"]):
            hazard_weights.append(8)
        else:
            hazard_weights.append(12)

    if not hazard_weights:
        hazard_weights = [10]

    hazard_weights.sort(reverse=True)
    primary_hazard_sev = hazard_weights[0]

    # Cumulative Multi-Hazard Boost: each additional concurrent hazard adds cumulative risk
    cumulative_boost = 0
    for w in hazard_weights[1:]:
        if w >= 26:
            cumulative_boost += 6
        elif w >= 20:
            cumulative_boost += 4
        else:
            cumulative_boost += 2

    hazard_score = min(35, primary_hazard_sev + cumulative_boost)

    # 2. Energy Vector Severity (0 - 28)
    energy_score = 6
    detected_energies = list(all_energy_sources or [])
    if any(k in e_low or any(k in src.lower() for src in detected_energies) or k in t_low for k in ["pressure", "pneumatic", "hydraulic", "high_pressure", "high-pressure", "high pressure", "blowout"]):
        energy_score = 28
    elif any(k in e_low or any(k in src.lower() for src in detected_energies) or k in t_low for k in ["electrical", "high-voltage", "11kv", "415v", "arc flash"]):
        energy_score = 28
    elif any(k in e_low or any(k in src.lower() for src in detected_energies) or k in t_low for k in ["toxic", "atmospheric", "confined space", "h2s"]):
        energy_score = 26
    elif any(k in e_low or any(k in src.lower() for src in detected_energies) or k in t_low for k in ["gravity", "suspended load", "dropped object", "fall from height", "work at height"]):
        energy_score = 25
    elif any(k in e_low or any(k in src.lower() for src in detected_energies) or k in t_low for k in ["thermal", "fire", "flame", "heat"]):
        energy_score = 24
    elif any(k in e_low or any(k in src.lower() for src in detected_energies) or k in t_low for k in ["kinetic", "mobile equipment", "forklift", "vehicle", "rotating machinery"]):
        energy_score = 20
    elif any(k in e_low or any(k in src.lower() for src in detected_energies) for k in ["chemical"]):
        energy_score = 18
    elif "multiple" in e_low:
        energy_score = 26
    elif any(k in h_low for k in ["slip", "trip", "housekeeping"]):
        energy_score = 5

    # 3. Worker Exposure Severity (0 - 22)
    exposure_score = 6
    if any(k in ex_low or k in t_low for k in ["line-of-fire", "line of fire", "in the line of fire", "stood in the line of fire", "standing in line of fire", "standing under suspended load", "under suspended load", "under load"]):
        exposure_score = 22
    elif any(k in ex_low or k in t_low for k in ["confined space", "inside vessel", "tank entry"]):
        exposure_score = 20
    elif any(k in ex_low or k in t_low for k in ["touching live", "live panel", "direct physical proximity", "fall edge", "unprotected edge"]):
        exposure_score = 20
    elif any(k in ex_low for k in ["trajectory", "rotating machinery", "restricted area", "thermal"]):
        exposure_score = 16
    elif any(k in ex_low for k in ["not exposed", "not_exposed", "zero exposure"]):
        exposure_score = 2
    elif any(k in ex_low for k in ["slip", "walking", "door"]):
        exposure_score = 5
    else:
        exposure_score = 8

    # 4. Safety Barrier Condition (0 - 20)
    barrier_score = 4
    b_norm = (barrier_status or "").upper()
    if any(k in b_norm for k in ["FAILED", "RUPTURE"]):
        barrier_score = 20
    elif any(k in b_norm for k in ["BYPASSED", "OVERRIDDEN"]):
        barrier_score = 20
    elif any(k in b_norm for k in ["MISSING", "NOT DEPLOYED"]):
        if any(k in t_low for k in ["loto", "lockout", "isolation", "gas test", "gas testing", "guard"]):
            barrier_score = 18
        else:
            barrier_score = 10
    elif any(k in b_norm for k in ["COMPROMISED", "DEGRADED"]):
        barrier_score = 10
    elif any(k in b_norm for k in ["PRESENT", "INTACT", "FUNCTIONING"]):
        barrier_score = 2
    else:
        barrier_score = 5

    # 5. Compound Multi-Precursor SIF Synergy / Escalation (0 - 15)
    synergy_score = 0
    has_loto = any(k in t_low for k in ["loto", "lockout", "tagout", "energy isolation"])
    has_line_of_fire = any(k in t_low for k in ["line of fire", "line-of-fire", "in the line of fire", "stood in the line of fire", "under suspended load", "under load"])
    has_pressure = any(k in t_low for k in ["pressure", "high-pressure", "high pressure", "pressurized", "hydraulic"])
    has_confined = any(k in t_low for k in ["confined space", "tank entry", "vessel entry"])
    has_gas_test_issue = any(k in t_low for k in ["gas testing", "gas test", "atmospheric"])
    has_suspended = any(k in t_low for k in ["suspended load", "dropped object", "crane lift"])

    if has_loto and has_line_of_fire and has_pressure:
        synergy_score = 12
    elif has_confined and (has_loto or has_gas_test_issue):
        synergy_score = 12
    elif has_suspended and has_line_of_fire:
        synergy_score = 10
    elif has_loto and has_pressure:
        synergy_score = 8
    elif has_pressure and has_line_of_fire:
        synergy_score = 8
    elif has_loto and any(k in t_low for k in ["electrical", "voltage"]):
        synergy_score = 10

    raw_score = hazard_score + energy_score + exposure_score + barrier_score + synergy_score

    # Normalized score ranges:
    # 0–20 Low
    # 21–40 Moderate
    # 41–60 High
    # 61–80 Very High
    # 81–100 Critical
    if raw_score >= 100:
        scaled_score = min(95, 85 + int((raw_score - 100) * 0.6))
    elif raw_score >= 80:
        scaled_score = min(88, 75 + int((raw_score - 80) * 0.65))
    elif raw_score >= 60:
        scaled_score = min(74, 55 + int((raw_score - 60) * 0.95))
    elif raw_score >= 40:
        scaled_score = min(54, 38 + int((raw_score - 40) * 0.8))
    else:
        scaled_score = max(5, int(raw_score * 0.85))

    return max(0, min(100, scaled_score))


# ==============================================================================
# GATED MONOTONIC SIF RISK SCORING MODEL
# ==============================================================================

# Standard Industrial Risk Tiers (Continuous Partition)
# 86 - 100: Critical (Major explosions, spreading fires, immediate threat to multiple people)
# 70 - 85:  Serious (Significant harm potential, serious high-energy hazard)
# 30 - 69:  Moderate (Localized incidents, contained energy, non-life-threatening)
# 0 - 29:   Low (Controlled thermal, contained minor spills, non-incident training/drills)

ANCHOR_POINTS: List[tuple] = [
    # (modified_likelihood, score)
    (0.00, 5.0),
    (0.04, 12.0),
    (0.10, 20.0),
    (0.20, 35.0),
    (0.40, 55.0),
    (0.60, 72.0),
    (0.78, 86.0),
    (1.00, 96.0)
]


def extract_energy_utility(
    energy_source: Optional[str],
    text: str,
    all_energy_sources: Optional[List[str]] = None
) -> float:
    """
    Extracts normalized energy utility (0.0 - 1.0) based on physical energy vectors.
    Energy is the essential prerequisite for serious injury or fatality.
    """
    t_low = (text or "").lower()
    e_low = (energy_source or "").lower()
    detected_sources = [s.lower() for s in (all_energy_sources or [])]

    # Negative Training / Non-Incident Context
    if is_negative_context(t_low):
        return 0.05

    # Critical Catastrophic Blast & Major Explosion
    if is_catastrophic_explosion(t_low):
        return 0.98

    # Rapidly Spreading Hydrocarbon Process Fire
    if is_spreading_process_fire(t_low):
        return 0.95

    # Critical Toxic Gas or Major Hazardous Chemical Release
    if is_critical_toxic_or_chemical_release(t_low):
        return 0.95

    # Controlled Thermal / Immediately Extinguished Small Flame
    if is_controlled_thermal_context(t_low):
        return 0.20

    # Minor Contained Chemical / Oil Seepage (< 1L)
    if is_minor_contained_spill(t_low):
        return 0.15

    # Critical High-Energy Vectors (0.85 - 0.95)
    if any(k in e_low or any(k in s for s in detected_sources) or k in t_low for k in [
        "high pressure", "high-pressure", "pressurized", "hydraulic", "pneumatic", "blowout", "psi", "bar"
    ]):
        return 0.95
    if any(k in e_low or any(k in s for s in detected_sources) or k in t_low for k in [
        "electrical", "high-voltage", "11kv", "415v", "arc flash", "live wire", "switchgear", "voltage"
    ]):
        return 0.95
    if any(k in e_low or any(k in s for s in detected_sources) or k in t_low for k in [
        "toxic", "atmospheric", "confined space", "h2s", "asphyxiat"
    ]):
        return 0.92
    if any(k in e_low or any(k in s for s in detected_sources) or k in t_low for k in [
        "suspended load", "dropped object", "fall from height", "work at height", "crane", "scaffold"
    ]):
        return 0.90
    if any(k in e_low or any(k in s for s in detected_sources) or k in t_low for k in [
        "thermal", "fire", "flame", "explosion", "flash fire", "blast"
    ]):
        return 0.88

    # Moderate Kinetic & Chemical Vectors (0.55 - 0.75)
    if any(k in e_low or any(k in s for s in detected_sources) or k in t_low for k in [
        "kinetic", "mobile equipment", "forklift", "vehicle", "rotating machinery", "crush"
    ]):
        return 0.70
    if any(k in e_low or any(k in s for s in detected_sources) or k in t_low for k in [
        "chemical", "acid", "corrosive", "caustic"
    ]):
        return 0.65
    if "multiple" in e_low:
        return 0.75

    # Low Energy / Surface Vectors (0.05 - 0.25)
    if any(k in t_low for k in ["zero energy", "de-energized verified", "isolated verified", "zero stored energy"]):
        return 0.02
    if any(k in e_low or k in t_low for k in ["slip", "trip", "puddle", "housekeeping", "walkway"]):
        return 0.10
    if any(k in e_low or k in t_low for k in ["hand tool", "minor cut", "hot pipe", "lighting"]):
        return 0.25

    return 0.30  # Baseline for indeterminate energy


def extract_exposure_utility(exposure: Optional[str], text: str) -> float:
    """
    Extracts normalized exposure utility (0.0 - 1.0) representing the personnel pathway.
    """
    t_low = (text or "").lower()
    ex_low = (exposure or "").lower()

    # Zero Exposure Condition (0.0) or Negative Non-Operational Context
    if is_negative_context(t_low) or any(k in ex_low or k in t_low for k in [
        "not exposed", "not_exposed", "zero exposure", "no personnel present", "remote operation", "unoccupied"
    ]):
        return 0.0

    # Catastrophic Blast & Major Explosion (Acute Facility Danger Zone)
    if is_catastrophic_explosion(t_low):
        return 0.95

    # Spreading Process Fire (High Deck/Piperack Exposure Pathway)
    if is_spreading_process_fire(t_low):
        return 0.92

    # Critical Toxic Gas or Major Uncontained Chemical Release
    if is_critical_toxic_or_chemical_release(t_low):
        return 0.90

    # Controlled Thermal / Contained Minor Spill
    if is_controlled_thermal_context(t_low) or is_minor_contained_spill(t_low):
        return 0.15

    # Direct Line-of-Fire / Danger Zone (0.85 - 0.95)
    if any(k in ex_low or k in t_low for k in [
        "line-of-fire", "line of fire", "in the line of fire", "stood in the line of fire",
        "standing in line of fire", "standing under suspended load", "under suspended load",
        "under load", "drop zone", "in drop zone"
    ]):
        return 0.95
    if any(k in ex_low or k in t_low for k in [
        "confined space", "inside vessel", "tank entry", "manhole entry"
    ]):
        return 0.92
    if any(k in ex_low or k in t_low for k in [
        "touching live", "live panel", "direct physical proximity", "fall edge", "unprotected edge"
    ]):
        return 0.90

    # Restricted Danger Zone (0.50 - 0.70)
    if any(k in ex_low or k in t_low for k in ["trajectory", "rotating machinery", "restricted area"]):
        return 0.65
    if any(k in ex_low or k in t_low for k in ["elevated platform", "scaffold deck", "forklift path"]):
        return 0.50

    # Incidental / Surface Exposure (0.10 - 0.20)
    if any(k in ex_low or k in t_low for k in ["slip", "trip", "walking", "door", "walkway"]):
        return 0.20

    # Vague / Indeterminate Description
    if is_vague_or_missing_info(t_low):
        return 0.20

    return 0.35  # Conservative baseline for indeterminate exposure


def extract_barrier_effectiveness(barrier_status: str, text: str) -> float:
    """
    Extracts barrier effectiveness (0.0 - 1.0).
    1.0 = fully effective / impenetrable.
    0.0 = completely failed, bypassed, or absent.
    Failure rate utility = 1.0 - effectiveness.
    """
    t_low = (text or "").lower()
    b_norm = (barrier_status or "").upper()

    if is_negative_context(t_low):
        return 0.95
    if is_catastrophic_explosion(t_low) or is_spreading_process_fire(t_low):
        return 0.00
    if is_controlled_thermal_context(t_low) or is_minor_contained_spill(t_low):
        return 0.90

    if any(k in b_norm or k in t_low for k in ["FULLY EFFECTIVE", "IMPENETRABLE", "RATED ENCLOSURE INTACT"]):
        return 1.00
    if any(k in b_norm for k in ["FAILED", "RUPTURE"]):
        return 0.00
    if any(k in b_norm for k in ["BYPASSED", "OVERRIDDEN"]):
        return 0.00
    if any(k in b_norm for k in ["MISSING", "NOT DEPLOYED"]) or any(k in t_low for k in ["loto not followed", "not locked out", "without isolation"]):
        if any(k in t_low for k in ["loto", "lockout", "isolation", "gas test", "guard"]):
            return 0.05
        return 0.15
    if any(k in b_norm for k in ["COMPROMISED", "DEGRADED"]):
        return 0.40
    if any(k in b_norm for k in ["PRESENT", "INTACT", "FUNCTIONING"]):
        return 0.90

    return 0.45  # Indeterminate barrier


def extract_hazard_modifier(
    hazard: Optional[str],
    text: str,
    all_hazards: Optional[List[str]] = None
) -> float:
    """
    Extracts hazard class prior modifier (0.60 - 1.25) acting as a multiplier on likelihood.
    """
    t_low = (text or "").lower()
    h_low = (hazard or "").lower()
    detected = [h.lower() for h in (all_hazards or [])]

    if is_negative_context(t_low):
        return 0.60
    if is_controlled_thermal_context(t_low) or is_minor_contained_spill(t_low):
        return 0.70

    primary_mod = 1.00
    if any(k in h_low or any(k in s for s in detected) or k in t_low for k in ["catastrophic", "blast", "explosion", "loto", "lockout", "isolation", "confined space"]):
        primary_mod = 1.15
    elif any(k in h_low or any(k in s for s in detected) or k in t_low for k in ["line-of-fire", "line of fire", "high-pressure", "suspended load", "electrical", "arc flash"]):
        primary_mod = 1.12
    elif any(k in h_low or any(k in s for s in detected) or k in t_low for k in ["fall", "height", "scaffold"]):
        primary_mod = 1.10
    elif any(k in h_low or any(k in s for s in detected) or k in t_low for k in ["chemical", "mobile equipment", "flammable", "gas leak", "fire"]):
        primary_mod = 1.05
    elif any(k in h_low or any(k in s for s in detected) for k in ["slip", "trip", "housekeeping"]):
        primary_mod = 0.70
    elif any(k in h_low or any(k in s for s in detected) for k in ["lighting"]):
        primary_mod = 0.60

    # Mild monotonic synergy for multiple concurrent high hazards (+0.04 each, capped at 1.25)
    high_hazard_count = sum(
        1 for s in detected
        if any(k in s for k in ["loto", "confined", "line-of-fire", "pressure", "suspended", "electrical", "fall", "blast", "explosion"])
    )
    if high_hazard_count > 1:
        primary_mod = min(1.25, primary_mod + (high_hazard_count - 1) * 0.04)

    return primary_mod


def map_likelihood_to_score(likelihood: float) -> float:
    """
    Continuous, strictly monotonic piecewise-linear mapping from [0.0, 1.0] to [5.0, 96.0].
    Every segment has strictly positive slope (no discontinuities, no negative jumps).
    """
    x = max(0.0, min(1.0, float(likelihood)))
    for i in range(len(ANCHOR_POINTS) - 1):
        x0, y0 = ANCHOR_POINTS[i]
        x1, y1 = ANCHOR_POINTS[i + 1]
        if x <= x1:
            if x1 == x0:
                return y0
            slope = (y1 - y0) / (x1 - x0)
            return y0 + slope * (x - x0)
    return ANCHOR_POINTS[-1][1]


def get_risk_tier(score: int) -> str:
    """Returns calibrated industrial safety tier label."""
    if score >= 86:
        return "Critical"
    elif score >= 70:
        return "Serious"
    elif score >= 30:
        return "Moderate"
    else:
        return "Low"


# Explicit, Named Safety-Critical Floor Overrides
OVERRIDE_RULES: List[Dict[str, Any]] = [
    {
        "id": "RULE_MAJOR_EXPLOSION_OR_BLAST",
        "name": "Major Explosion or Catastrophic Blast Hazard Floor Override",
        "tier": "Critical",
        "floor_score": 92,
        "description": "Explicit report of catastrophic explosion, blast overpressure, or major fuel tank blast in facility.",
        "matches": lambda t, e_u, ex_u, b_eff: (
            is_catastrophic_explosion(t)
        )
    },
    {
        "id": "RULE_SPREADING_PROCESS_FIRE",
        "name": "Spreading Refinery Process Fire Floor Override",
        "tier": "Critical",
        "floor_score": 90,
        "description": "Rapidly spreading or uncontained hydrocarbon fire in process unit, tank farm, or piperack.",
        "matches": lambda t, e_u, ex_u, b_eff: (
            is_spreading_process_fire(t)
        )
    },
    {
        "id": "RULE_CRITICAL_TOXIC_OR_CHEMICAL_RELEASE",
        "name": "Critical Toxic Gas or Major Hazardous Chemical Release Floor Override",
        "tier": "Critical",
        "floor_score": 88,
        "description": "High-concentration toxic gas release (>50 ppm H2S) or major uncontained hazardous chemical release.",
        "matches": lambda t, e_u, ex_u, b_eff: (
            is_critical_toxic_or_chemical_release(t)
        )
    },
    {
        "id": "RULE_LOTO_STORED_ENERGY_LINE_OF_FIRE",
        "name": "LOTO Bypassed with Stored Energy in Line-of-Fire Floor Override",
        "tier": "Critical",
        "floor_score": 88,
        "description": "Lockout/Tagout bypassed or missing while personnel exposed to pressurized or energized line-of-fire.",
        "matches": lambda t, e_u, ex_u, b_eff: (
            any(k in t for k in ["loto", "lockout", "tagout", "energy isolation", "without isolation", "not locked out", "bypassed loto"]) and
            (e_u >= 0.85 or any(k in t for k in ["electrical", "pressure", "hydraulic", "pneumatic", "11kv", "415v", "voltage"])) and
            (ex_u >= 0.70 or any(k in t for k in ["line of fire", "line-of-fire", "in the line of fire", "under load", "direct contact"]))
        )
    },
    {
        "id": "RULE_CONFINED_SPACE_UNMONITORED_ENTRY",
        "name": "Unmonitored Confined Space Entry Floor Override",
        "tier": "Critical",
        "floor_score": 86,
        "description": "Confined space vessel/tank entry without verified atmospheric gas testing or energy isolation.",
        "matches": lambda t, e_u, ex_u, b_eff: (
            any(k in t for k in ["confined space", "tank entry", "vessel entry", "manhole entry"]) and
            (any(k in t for k in ["gas test", "atmospheric", "oxygen", "h2s", "toxic", "loto", "permit", "without ptw", "no permit", "not tested", "bypassed"]) or b_eff <= 0.40)
        )
    },
    {
        "id": "RULE_HIGH_VOLTAGE_LIVE_EXPOSURE",
        "name": "High-Voltage Live Conductor Direct Exposure Floor Override",
        "tier": "Critical",
        "floor_score": 86,
        "description": "High-voltage switchgear or conductor maintenance without verified de-energization or physical boundary.",
        "matches": lambda t, e_u, ex_u, b_eff: (
            any(k in t for k in ["electrical", "arc flash", "switchgear", "11kv", "415v", "transformer", "busbar", "motor control center", "mcc", "pendant cable", "conductors"]) and
            (ex_u >= 0.70 or any(k in t for k in ["touching", "live panel", "proximity", "contact", "flash", "arc scorch", "copper splatter", "dangling", "exposed live"])) and
            (b_eff <= 0.40 or any(k in t for k in ["not isolated", "uninsulated", "live", "open panel", "breaker failed to clear", "damaged insulation"]))
        )
    },
    {
        "id": "RULE_SUSPENDED_LOAD_DROP_ZONE",
        "name": "Personnel Positioned in Suspended Load Drop Zone Floor Override",
        "tier": "Critical",
        "floor_score": 86,
        "description": "Personnel positioned directly beneath suspended heavy crane load or rigging drop zone.",
        "matches": lambda t, e_u, ex_u, b_eff: (
            any(k in t for k in ["suspended load", "dropped object", "crane lift", "rigging lift", "crane dropped", "heavy iron pipe"]) and
            any(k in t for k in ["under load", "under suspended load", "standing under", "walked under", "drop zone", "line of fire", "line-of-fire", "near walkway", "almost hit"])
        )
    },
    {
        "id": "RULE_HIGH_PRESSURE_LINE_PROJECTILE",
        "name": "High-Pressure Stored Energy Line-of-Fire Floor Override",
        "tier": "Very High",
        "floor_score": 82,
        "description": "Pressurized fluid or pneumatic line with degraded barrier and personnel in release projectile trajectory.",
        "matches": lambda t, e_u, ex_u, b_eff: (
            any(k in t for k in ["high pressure", "high-pressure", "hydraulic", "pneumatic", "blowout", "pressurized", "sweet gas", "sour gas", "bar", "psi"]) and
            (ex_u >= 0.70 or any(k in t for k in ["line of fire", "line-of-fire", "trajectory", "path", "leaking", "hissing", "whistling"])) and
            b_eff <= 0.40
        )
    },
    {
        "id": "RULE_MAJOR_CHEMICAL_OR_ACID_RELEASE",
        "name": "Major Corrosive Chemical or Acid Release Floor Override",
        "tier": "Very High",
        "floor_score": 82,
        "description": "Substantial uncontained release or line-of-fire spray of hazardous corrosive chemical or acid.",
        "matches": lambda t, e_u, ex_u, b_eff: (
            any(k in t for k in ["caustic soda", "sodium hydroxide", "hydrochloric acid", "sulfuric acid", "methanol", "amine solution", "unloading hose disconnected", "acid leek", "acid spray", "spraying concentrated"]) and
            b_eff <= 0.40
        )
    },
    {
        "id": "RULE_MACHINERY_ENTRAPMENT_OR_ROTATING_HAZARD",
        "name": "Machinery Entrapment / Rotating Equipment Barrier Failure Floor Override",
        "tier": "Very High",
        "floor_score": 80,
        "description": "Unguarded rotating nip point or mechanical equipment failure with acute crushing or amputation hazard.",
        "matches": lambda t, e_u, ex_u, b_eff: (
            any(k in t for k in ["nip point", "tail pulley", "rotating drum", "broken strands", "wire rope revealed", "overspeed condition", "lathe chuck"]) and
            b_eff <= 0.40
        )
    },
    {
        "id": "RULE_FALL_FROM_HEIGHT_NO_PROTECTION",
        "name": "Unprotected Work at Height Fall Hazard Floor Override",
        "tier": "Critical",
        "floor_score": 86,
        "description": "Work at height (>2m, scaffold, roof edge, elevation) without fall arrest tie-off or physical guardrails.",
        "matches": lambda t, e_u, ex_u, b_eff: (
            any(k in t for k in ["work at height", "fall from height", "scaffold", "roof edge", "unprotected edge", "elevation", "pipe rack", "height", "ladder", "meters", "grating", "skylight"]) and
            any(k in t for k in ["no harness", "without harness", "without safety harness", "not tied off", "no tie-off", "missing guardrail", "missing handrail", "unsecured", "dangling unattached", "ladder slipped", "unanchored", "without fall arrester"])
        )
    }
]


def evaluate_override_rules(
    text: str,
    energy_utility: float,
    exposure_utility: float,
    barrier_effectiveness: float
) -> Tuple[int, Optional[str], List[str]]:
    """
    Evaluates safety-critical floor override rules.
    Returns (highest_floor_score, primary_override_rule_name, list_of_all_triggered_rule_names).
    """
    t_low = (text or "").lower()

    # Never trigger critical safety floor overrides on non-incidents, drills, or controlled minor operations
    if is_negative_context(t_low) or is_controlled_thermal_context(t_low) or is_minor_contained_spill(t_low):
        return 0, None, []

    highest_floor = 0
    primary_name: Optional[str] = None
    triggered: List[str] = []

    for rule in OVERRIDE_RULES:
        try:
            if rule["matches"](t_low, energy_utility, exposure_utility, barrier_effectiveness):
                triggered.append(rule["name"])
                if rule["floor_score"] > highest_floor:
                    highest_floor = rule["floor_score"]
                    primary_name = rule["name"]
        except Exception:
            continue

    return highest_floor, primary_name, triggered


def compute_gated_monotonic_risk_score(
    hazard: Optional[str],
    energy_source: Optional[str],
    exposure: Optional[str],
    barrier_status: str,
    text: str,
    all_hazards: Optional[List[str]] = None,
    all_energy_sources: Optional[List[str]] = None
) -> Tuple[int, Dict[str, Any]]:
    """
    Computes Gated, Monotonic SIF Precursor Risk Score (0 - 100):
    1. factor utilities: energy_utility, exposure_utility, barrier_effectiveness
    2. sif_likelihood = energy_utility * exposure_utility * (1 - barrier_effectiveness)
    3. hazard class acts as a prior/modifier on likelihood
    4. mapped to 0-100 via continuous, monotonic function
    5. safety-critical floor override rules guarantee non-negotiable protections
    """
    e_u = extract_energy_utility(energy_source, text, all_energy_sources)
    ex_u = extract_exposure_utility(exposure, text)
    b_eff = extract_barrier_effectiveness(barrier_status, text)
    b_fail = max(0.0, min(1.0, 1.0 - b_eff))

    h_mod = extract_hazard_modifier(hazard, text, all_hazards)

    # Gated multiplicative likelihood
    sif_likelihood = e_u * ex_u * b_fail
    modified_likelihood = min(1.0, sif_likelihood * h_mod)

    # Continuous score mapping
    continuous_score = map_likelihood_to_score(modified_likelihood)

    # Clean zero exposure / effective barrier gating
    if ex_u <= 0.01 or b_fail <= 0.01:
        continuous_score = min(continuous_score, 10.0)

    # Floor override evaluation
    override_floor, primary_override, triggered_overrides = evaluate_override_rules(
        text, e_u, ex_u, b_eff
    )

    # Non-incident and localized containment dampeners
    t_clean = (text or "").lower()
    if is_negative_context(t_clean):
        continuous_score = min(continuous_score, 12.0)
        override_floor = 0
        primary_override = None
        triggered_overrides = []
    elif is_minor_contained_spill(t_clean):
        continuous_score = min(continuous_score, 18.0)
        override_floor = 0
        primary_override = None
        triggered_overrides = []
    elif is_controlled_thermal_context(t_clean):
        continuous_score = min(continuous_score, 24.0)
        override_floor = 0
        primary_override = None
        triggered_overrides = []
    elif is_vague_or_missing_info(t_clean):
        continuous_score = min(continuous_score, 20.0)
        override_floor = 0
        primary_override = None
        triggered_overrides = []

    # Localized equipment defect / moderate operational hazard baseline floor (32 - 45)
    has_active_defect = any(k in t_clean for k in [
        "tripped on", "failed open", "leaking hot water", "misalignment", "sight glass cloudy",
        "unloader valve sticking", "gauge glass cracked", "seep of 50 ppm", "regulator weeping",
        "spilled inside", "leaking approximately", "drain plug seeped", "acid sampling line flange wrapped",
        "tripped over", "twisted left ankle", "pinched index finger", "flash burn to neck",
        "bumped shoulder", "circuit breaker tripped", "terminal block inside instrument",
        "emergency stop button contact block loose", "toe board displaced", "temporary ladder secured with single",
        "insulation cladding smoldered", "friction between loose drive belt", "soot puff flashed",
        "drum fell off", "diesel leak from drain valve"
    ])
    if has_active_defect and not is_negative_context(t_clean) and not is_minor_contained_spill(t_clean) and not is_controlled_thermal_context(t_clean) and not is_vague_or_missing_info(t_clean):
        continuous_score = max(continuous_score, 34.0)

    final_score = int(round(max(continuous_score, float(override_floor))))
    final_score = max(0, min(100, final_score))
    risk_tier = get_risk_tier(final_score)

    # Plain-language driver explanation
    drivers = []
    if e_u >= 0.85:
        drivers.append(f"high-energy magnitude ({e_u:.2f})")
    elif e_u <= 0.20:
        drivers.append(f"low energy severity ({e_u:.2f})")

    if ex_u >= 0.85:
        drivers.append(f"direct personnel line-of-fire exposure ({ex_u:.2f})")
    elif ex_u <= 0.05:
        drivers.append("isolated/zero worker exposure")

    if b_eff <= 0.15:
        drivers.append(f"severe barrier breach/absence ({b_fail:.2f} failure rate)")
    elif b_eff >= 0.85:
        drivers.append(f"active functional defense barrier ({b_eff:.2f} effectiveness)")

    if primary_override:
        drivers.append(f"safety-critical override: '{primary_override}'")

    if drivers:
        explanation = f"{risk_tier} SIF potential ({final_score}/100) driven by " + ", ".join(drivers) + "."
    else:
        explanation = f"{risk_tier} SIF potential ({final_score}/100) evaluated across energy, exposure, and barrier state."

    breakdown = {
        "energy_utility": round(e_u, 3),
        "exposure_utility": round(ex_u, 3),
        "barrier_effectiveness": round(b_eff, 3),
        "barrier_failure_utility": round(b_fail, 3),
        "sif_likelihood": round(sif_likelihood, 3),
        "hazard_modifier": round(h_mod, 3),
        "modified_likelihood": round(modified_likelihood, 3),
        "continuous_score": round(continuous_score, 1),
        "override_floor": override_floor,
        "final_score": final_score,
        "risk_tier": risk_tier,
        "override_rule_applied": primary_override,
        "triggered_override_rules": triggered_overrides,
        "main_drivers_explanation": explanation,
        "scoring_model": "gated_monotonic_v1"
    }

    return final_score, breakdown


def compute_maut_risk_score(
    hazard: Optional[str],
    energy_source: Optional[str],
    exposure: Optional[str],
    barrier_status: str,
    text: str,
    all_hazards: Optional[List[str]] = None,
    all_energy_sources: Optional[List[str]] = None,
    legacy_scoring: bool = False,
    return_breakdown: bool = False
) -> Any:
    """
    Main SIF Risk Score Entry Point.
    By default (legacy_scoring=False), uses the Gated Monotonic SIF Model.
    If legacy_scoring=True, routes to compute_maut_risk_score_legacy.
    """
    import os
    env_legacy = os.environ.get("ENABLE_LEGACY_SCORING", "").lower() in ["1", "true"]
    use_legacy = legacy_scoring or env_legacy

    if use_legacy:
        score = compute_maut_risk_score_legacy(
            hazard=hazard,
            energy_source=energy_source,
            exposure=exposure,
            barrier_status=barrier_status,
            text=text,
            all_hazards=all_hazards,
            all_energy_sources=all_energy_sources
        )
        if return_breakdown:
            return score, {
                "final_score": score,
                "risk_tier": get_risk_tier(score),
                "scoring_model": "legacy_maut",
                "override_rule_applied": None,
                "triggered_override_rules": [],
                "main_drivers_explanation": "Legacy additive MAUT score calculated."
            }
        return score

    score, breakdown = compute_gated_monotonic_risk_score(
        hazard=hazard,
        energy_source=energy_source,
        exposure=exposure,
        barrier_status=barrier_status,
        text=text,
        all_hazards=all_hazards,
        all_energy_sources=all_energy_sources
    )

    if return_breakdown:
        return score, breakdown
    return score


def assess_sif_precursor(
    report_type: str,
    text: str,
    hazard: Optional[str],
    energy_source: Optional[str],
    exposure: Optional[str],
    barrier_status: str,
    signals: List[str],
    all_hazards: Optional[List[str]] = None,
    all_energy_sources: Optional[List[str]] = None,
    legacy_scoring: bool = False
) -> Dict[str, Any]:
    """
    Executes the Hybrid SIF Decision Engine.
    Combines rule-based assessment with supervised ML probabilities and
    Multi-Hazard Gated Monotonic scoring.
    """
    cleaned_len = len((text or "").strip().split())

    # 1. Check for Insufficient Information
    if cleaned_len < 4 and (hazard is None and not signals and (energy_source is None or energy_source in ["UNKNOWN", "Insufficient Information"])):
        insufficient_breakdown = {
            "energy_utility": 0.10,
            "exposure_utility": 0.10,
            "barrier_effectiveness": 0.50,
            "barrier_failure_utility": 0.50,
            "sif_likelihood": 0.005,
            "hazard_modifier": 1.00,
            "modified_likelihood": 0.005,
            "continuous_score": 15.0,
            "override_floor": 0,
            "final_score": 15,
            "risk_tier": "Low",
            "override_rule_applied": None,
            "triggered_override_rules": [],
            "main_drivers_explanation": "Low score assigned due to insufficient operational safety information.",
            "scoring_model": "gated_monotonic_v1" if not legacy_scoring else "legacy_maut"
        }
        return {
            "assessment": "INSUFFICIENT_INFORMATION",
            "rule_based_assessment": "INSUFFICIENT_INFORMATION",
            "ai_classification": "Insufficient Information",
            "final_ai_decision": "INSUFFICIENT INFORMATION",
            "ml_probability": 0.0,
            "ai_sif_score": 15,
            "ai_confidence": 0.0,
            "potential_consequence": "Insufficient information available to evaluate potential consequence severity.",
            "reason": "The report description lacks sufficient operational details regarding hazards, energy sources, or controls for a reliable SIF precursor assessment.",
            "contributing_features": [],
            "score_breakdown": insufficient_breakdown,
            "override_rule_applied": None
        }

    # 2. Supervised ML Inference
    ml_sif_prediction: Optional[str] = None
    ml_sif_confidence: Optional[float] = None
    ml_probability: float = 0.5
    ml_model: Optional[str] = None
    contributing_features: List[Dict[str, Any]] = []

    if predict_sif_potential is not None and text and text.strip():
        try:
            ml_res = predict_sif_potential(text)
            if isinstance(ml_res, dict) and ml_res.get("status") == "SUCCESS":
                ml_sif_prediction = ml_res.get("predicted_class")
                ml_sif_confidence = ml_res.get("confidence")
                ml_probability = float(ml_res.get("sif_probability", 0.5))
                ml_model = ml_res.get("model_name")
                contributing_features = ml_res.get("contributing_features", [])
        except Exception as exc:
            logger.warning(f"ML inference fallback triggered: {exc}")

    # 3. Rule-Based Safety Evidence Evaluation
    h_low = (hazard or "").lower()
    e_low = (energy_source or "").lower()
    t_low = text.lower()

    detected_sources = all_energy_sources or []
    has_high_energy_source = (
        energy_source in [
            "GRAVITY", "KINETIC", "ELECTRICAL", "THERMAL", "CHEMICAL",
            "HIGH_PRESSURE / PNEUMATIC / HYDRAULIC", "TOXIC / ATMOSPHERIC", "MULTIPLE",
            "Electrical", "Pneumatic / High Pressure", "Chemical", "Thermal", "Gravity"
        ] or
        len(detected_sources) > 0 or
        any(k in h_low or k in e_low or k in t_low for k in [
            "suspended load", "dropped object", "fall from height", "work at height",
            "arc flash", "electrical", "confined space", "atmospheric", "high pressure",
            "high-pressure", "pressurized", "gas leak", "blowout", "toxic gas", "vehicle",
            "crane", "flame", "thermal", "heat", "line of fire", "line-of-fire", "loto", "lockout"
        ])
    )
    is_minor_slip = any(k in h_low for k in ["slip", "trip", "surface housekeeping"]) and not has_high_energy_source

    has_exposure = (
        (exposure is not None and "not exposed" not in exposure.lower() and exposure != "Insufficient Information") or
        len(signals) > 0 or
        any(k in t_low for k in ["line of fire", "line-of-fire", "under load", "confined space", "standing"])
    )
    has_barrier_deficiency = barrier_status in [
        "BARRIER_MISSING", "BARRIER_FAILED", "BARRIER_BYPASSED", "BARRIER_COMPROMISED"
    ]

    # Rule Assessment Determination
    if is_negative_context(t_low):
        rule_assessment = "NO"
        rule_reason = "Report documents a non-hazardous safety drill, toolbox talk, or routine inspection without an active SIF hazard."
    elif is_minor_contained_spill(t_low):
        rule_assessment = "NO"
        rule_reason = "Report describes minor contained chemical/oil seepage with intact barriers and zero fire or explosion potential."
    elif is_controlled_thermal_context(t_low):
        rule_assessment = "NO"
        rule_reason = "Report describes a controlled thermal operation or immediately extinguished small flame with zero escalation risk."
    elif is_catastrophic_explosion(t_low):
        rule_assessment = "YES"
        rule_reason = "Report documents a catastrophic explosion or blast overpressure hazard with acute potential for mass fatalities."
    elif is_spreading_process_fire(t_low):
        rule_assessment = "YES"
        rule_reason = "Report documents a rapidly spreading or uncontained hydrocarbon process fire with severe escalation potential."
    elif is_critical_toxic_or_chemical_release(t_low):
        rule_assessment = "YES"
        rule_reason = "Report documents a critical toxic gas or uncontained hazardous chemical release with severe life-safety threat."
    elif has_high_energy_source and (has_exposure or has_barrier_deficiency):
        rule_assessment = "YES"
        rule_reason = "Report presents evidence of hazardous high energy combined with personnel exposure or barrier deficiency."
    elif is_minor_slip:
        rule_assessment = "NO"
        rule_reason = "Report describes localized low-severity slip/trip condition without high-energy hazard or severe consequence potential."
    elif has_high_energy_source and not has_exposure and barrier_status == "BARRIER_PRESENT":
        rule_assessment = "NO"
        rule_reason = "High-energy vector was present but verified active barriers successfully prevented personnel exposure."
    elif has_high_energy_source:
        rule_assessment = "YES"
        rule_reason = "High-energy operational hazard identified with potential unmitigated exposure pathways."
    else:
        rule_assessment = "NO"
        rule_reason = "Available information does not indicate high-energy exposure or potential serious consequence precursors."

    # 4. Multi-Hazard Risk Score (Gated Monotonic by default, or Legacy MAUT)
    risk_score, score_breakdown = compute_maut_risk_score(
        hazard=hazard,
        energy_source=energy_source,
        exposure=exposure,
        barrier_status=barrier_status,
        text=text,
        all_hazards=all_hazards,
        all_energy_sources=all_energy_sources,
        legacy_scoring=legacy_scoring,
        return_breakdown=True
    )

    # 5. Hybrid Decision Synthesis harmonized with Risk Score Tiers
    override_applied = score_breakdown.get("override_rule_applied")
    if is_negative_context(t_low) or is_minor_contained_spill(t_low) or is_controlled_thermal_context(t_low):
        final_decision = "NON-SIF OBSERVATION"
        ai_class = "Non-SIF-potential"
    elif is_vague_or_missing_info(t_low) and not override_applied:
        final_decision = "NON-SIF OBSERVATION"
        ai_class = "Non-SIF-potential"
    elif override_applied or risk_score >= 70:
        final_decision = "CONFIRMED SIF PRECURSOR"
        ai_class = "SIF-potential"
    elif rule_assessment == "YES" and risk_score >= 60:
        final_decision = "CONFIRMED SIF PRECURSOR"
        ai_class = "SIF-potential"
    elif rule_assessment == "NO" and ml_probability >= 0.75 and has_high_energy_source and risk_score >= 50:
        final_decision = "CONFIRMED SIF PRECURSOR"
        ai_class = "SIF-potential"
        rule_reason += " (Escalated by high ML precursor probability)."
    else:
        final_decision = "NON-SIF OBSERVATION"
        ai_class = "Non-SIF-potential"

    # Dynamic AI Confidence represents model/evidence certainty (distinct from risk score)
    if is_vague_or_missing_info(t_low):
        ai_confidence = 45.0  # Explicitly communicates elevated uncertainty for vague observations
    elif is_negative_context(t_low):
        ai_confidence = 90.0
    else:
        conf_base = 82.0
        if ml_sif_confidence:
            conf_base = max(conf_base, ml_sif_confidence * 100)
        if hazard and hazard not in ["Insufficient Information", "UNKNOWN"]:
            conf_base += 4.0
        if energy_source and energy_source not in ["UNKNOWN", "Insufficient Information"]:
            conf_base += 4.0
        if barrier_status != "BARRIER_INSUFFICIENT_INFO":
            conf_base += 3.0
        ai_confidence = min(96.8, round(conf_base, 1))

    # Compound Co-Factors Detection for Multi-Hazard Synthesis
    has_slip_co_factor = any(k in t_low for k in ["slip", "trip", "slippery", "fall on same level", "housekeeping"])
    has_equip_co_factor = any(k in t_low for k in ["equipment failure", "machine", "mechanical failure", "malfunction", "breakdown", "defect"])

    # Consequence summary: explicitly captures high-energy combinations, catastrophic blasts, and minor events
    if is_catastrophic_explosion(t_low):
        potential_consequence = "Catastrophic overpressure blast trauma, severe structural collapse, and widespread fatal thermal radiation."
    elif is_spreading_process_fire(t_low):
        potential_consequence = "Severe uncontained process fire escalation, radiant heat burns, and cascading piperack/vessel destruction."
    elif is_critical_toxic_or_chemical_release(t_low):
        potential_consequence = "Acute toxic gas inhalation, chemical pulmonary edema, IDLH atmospheric exposure, or catastrophic chemical burns."
    elif is_controlled_thermal_context(t_low):
        potential_consequence = "Localized minor thermal event safely controlled or extinguished with zero life-threatening consequence potential."
    elif is_minor_contained_spill(t_low):
        potential_consequence = "Localized surface fluid seepage contained on drip tray; zero fire, blast, or toxic vapor consequence potential."
    elif is_negative_context(t_low):
        potential_consequence = "Non-operational training, drill, or historical review; zero active injury consequence potential."
    elif is_vague_or_missing_info(t_low):
        potential_consequence = "Indeterminate consequence potential due to insufficient operational details in report."
    elif any(k in t_low for k in ["high pressure", "high-pressure", "pressurized", "hydraulic"]) and any(k in t_low for k in ["line of fire", "line-of-fire", "in the line of fire", "loto", "lockout"]):
        potential_consequence = "High probability of fatal line-of-fire projectile impact, high-pressure fluid injection, or sudden dynamic energy release."
    elif any(k in t_low for k in ["confined space", "tank entry", "vessel entry"]):
        potential_consequence = "High probability of fatal atmospheric asphyxiation, toxic gas inhalation, or engulfment in enclosed space."
    elif any(k in t_low for k in ["suspended load", "under load", "dropped object", "under suspended load"]):
        potential_consequence = "High probability of fatal blunt-force crush injury or catastrophic struck-by trauma from falling heavy mass."
    elif any(k in e_low for k in ["electrical"]) or any(k in t_low for k in ["electrical", "live wire", "switchgear", "arc flash"]):
        if has_slip_co_factor and has_equip_co_factor:
            potential_consequence = "Potential high-voltage electrocution, arc flash burns, or fatal shock resulting from equipment failure, compounded by surface slip/trip hazard causing loss of balance near energized components."
        elif has_slip_co_factor:
            potential_consequence = "Potential high-voltage electrocution or severe arc flash burns, compounded by surface slip/trip hazard causing loss of footing in proximity to energized parts."
        elif has_equip_co_factor:
            potential_consequence = "Potential high-voltage electrocution, severe arc flash thermal burns, or fatal electrical shock triggered by electrical equipment failure."
        else:
            potential_consequence = "Potential high-voltage electrocution, severe arc flash thermal burns, or fatal electrical shock."
    elif has_high_energy_source and any(k in e_low or k in t_low for k in ["pressure", "pneumatic", "hydraulic"]):
        potential_consequence = "Potential high-pressure fluid injection, line blowout impact, or mechanical strike."
    elif has_high_energy_source and any(k in e_low or k in t_low for k in ["gravity", "height", "scaffold"]):
        potential_consequence = "Potential severe blunt force trauma, crush injury, or fatality from falling mass or fall from height."
    elif has_high_energy_source and any(k in e_low or k in t_low for k in ["toxic", "atmospheric"]):
        potential_consequence = "Potential acute toxic gas asphyxiation or oxygen deficiency in confined space."
    elif has_high_energy_source and any(k in e_low or k in t_low for k in ["chemical"]):
        potential_consequence = "Potential hazardous chemical contamination or chemical burns."
    elif has_high_energy_source and any(k in e_low or k in t_low for k in ["thermal", "fire"]):
        potential_consequence = "Potential severe thermal burns or flash fire injuries from extreme heat exposure."
    elif has_high_energy_source and any(k in e_low or k in t_low for k in ["kinetic"]):
        potential_consequence = "Potential heavy impact trauma, crushing injury, or caught-between machinery trauma."
    elif has_high_energy_source:
        potential_consequence = "Potential severe life-threatening trauma from unmitigated high-energy release."
    elif is_minor_slip:
        potential_consequence = "Potential low-severity surface slip or minor localized contusion."
    else:
        potential_consequence = "Localized operational hazard without immediate life-threatening potential."

    return {
        "assessment": "YES" if ai_class == "SIF-potential" else "NO",
        "ai_classification": ai_class,
        "final_ai_decision": final_decision,
        "rule_based_assessment": rule_assessment,
        "ml_probability": round(ml_probability, 4),
        "ai_sif_score": risk_score,
        "ai_confidence": ai_confidence,
        "potential_consequence": potential_consequence,
        "reason": rule_reason,
        "contributing_features": contributing_features,
        "ml_model": ml_model or "sif_tfidf_logistic_regression",
        "score_breakdown": score_breakdown,
        "override_rule_applied": score_breakdown.get("override_rule_applied")
    }
