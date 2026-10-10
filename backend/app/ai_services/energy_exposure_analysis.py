"""
Deterministic Energy Vector and Worker Exposure Analysis
---------------------------------------------------------
Classifies physical energy vectors into standardized categories:
- GRAVITY
- KINETIC
- ELECTRICAL
- THERMAL
- CHEMICAL
- HIGH_PRESSURE / PNEUMATIC / HYDRAULIC
- TOXIC / ATMOSPHERIC
- MULTIPLE
- UNKNOWN

Evaluates worker exposure pathways with high-risk line-of-fire / confined space
prioritized over secondary generic observations.
"""

import re
from typing import Dict, Optional, List, Any

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


def analyze_energy_and_exposure(text: str) -> Dict[str, Any]:
    """
    Deterministically evaluates energy vector and worker exposure pathways.
    Returns 'UNKNOWN' if no recognizable physical energy vector is detected.
    """
    if not text or not isinstance(text, str):
        return {
            "energy_source": "UNKNOWN",
            "exposure": "Insufficient Information",
            "all_energy_sources": []
        }

    lower_text = text.lower()

    # 0. Negative Context (Training, Drills, Toolbox Talks, Equipment Audits)
    if is_negative_context(lower_text):
        return {
            "energy_source": "NONE (NON-OPERATIONAL / TRAINING)",
            "exposure": "Non-operational training, drill, or historical review; zero personnel exposure",
            "all_energy_sources": []
        }

    # 0b. Catastrophic Blast & Major Explosion (Acute Facility Danger Zone)
    if is_catastrophic_explosion(lower_text):
        return {
            "energy_source": "THERMAL / BLAST OVERPRESSURE",
            "exposure": "Acute facility-wide danger zone; personnel exposed to catastrophic blast overpressure, shockwave, and radiant heat",
            "all_energy_sources": ["THERMAL / BLAST OVERPRESSURE", "HIGH_PRESSURE / PNEUMATIC / HYDRAULIC"]
        }

    # 0c. Spreading Refinery Process Fire (Acute Process Deck / Piperack Exposure)
    if is_spreading_process_fire(lower_text):
        return {
            "energy_source": "THERMAL (UNCONTAINED PROCESS FIRE)",
            "exposure": "Personnel exposed to uncontained spreading process fire, radiant heat flux, and toxic combustion gases",
            "all_energy_sources": ["THERMAL", "CHEMICAL"]
        }

    # 0d. Controlled Thermal / Minor Extinguished Fire (Safe Standby)
    if is_controlled_thermal_context(lower_text):
        return {
            "energy_source": "THERMAL (CONTROLLED / LOCALIZED)",
            "exposure": "Personnel maintaining safe distance or actively managing controlled minor thermal source",
            "all_energy_sources": ["THERMAL (CONTROLLED)"]
        }

    # 0e. Minor Contained Spill (Incidental Contact)
    if is_minor_contained_spill(lower_text):
        return {
            "energy_source": "CHEMICAL (CONTAINED SEEPAGE < 1L)",
            "exposure": "Incidental surface contact only; zero dynamic energy or high-consequence exposure",
            "all_energy_sources": ["CHEMICAL (CONTAINED)"]
        }

    detected_sources: List[str] = []

    # 1. HIGH_PRESSURE / PNEUMATIC / HYDRAULIC
    if re.search(r'\b(pressurized|pressure|hydraulic|pneumatic|high[- ]pressure|high pressure|blowout|hydrotest|wellhead|choke manifold|bop|steam line|gas line|pipe burst|ruptured hose|psi|bar|stored pressure|sweet gas|sour gas|flange packing|discharge valve|hissing gas)\b', lower_text):
        detected_sources.append("HIGH_PRESSURE / PNEUMATIC / HYDRAULIC")

    # 2. ELECTRICAL
    if re.search(r'\b(electrical|voltage|11kv|415v|440v|33kv|230v|switchgear|transformer|live cable|circuit breaker|arc flash|electric shock|de-energiz|loto|lockout|live panel|loose cable|exposed wire|sparkin|scorch mark|busbar)\b', lower_text):
        detected_sources.append("ELECTRICAL")

    # 3. TOXIC / ATMOSPHERIC
    if re.search(r'\b(toxic gas|h2s|hydrogen sulfide|oxygen deficiency|nitrogen|toxic atmosphere|confined space|vessel entry|entering the vessel|entered the vessel|inside the vessel|inside the tank|tank entry|gas test|gas testing|atmospheric monitoring|air monitoring|ppm|rotten egg)\b', lower_text):
        detected_sources.append("TOXIC / ATMOSPHERIC")

    # 4. GRAVITY (Explicit elevation or falling heavy mass)
    if re.search(r'\b(suspended load|overhead load|dropped object|crane lift|hoist|scaffold|work at height|fall from height|ladder|roof edge|derrick|falling pipe|falling tool|falling object|standing under suspended load|meters elevation|meter elevation|meters height|meter height|pipe rack|elevation|fall height|skylight|fragile roof|open grating|floor grating|without safety harness|without harness|harness dangling|unanchored harness|unattached harness|ladder slipped|dropped iron|dropped spool|dropped beam)\b', lower_text):
        detected_sources.append("GRAVITY")

    # 5. KINETIC (Moving equipment, line-of-fire trajectory, heavy machinery)
    if re.search(r'\b(line of fire|line-of-fire|in the line of fire|stood in the line of fire|standing in line of fire|forklift|truck|vehicle|reversing|moving equipment|rotating machinery|conveyor belt|crush|pinch point|nip point|flywheel|winch|unsafe operation|struck-by|struck by|tail pulley|lathe|rotating chuck|wire rope|broken strands)\b', lower_text):
        detected_sources.append("KINETIC")

    # 6. THERMAL (exclude 'line of fire')
    thermal_text = re.sub(r'\bline[- ]of[- ]fire\b', '', lower_text)
    if re.search(r'\b(thermal|fire|flame|burning|hot work|welding|cutting torch|furnace|boiler|hot surface|molten|flash fire|steam burn|heat|burn|heat exposure|explosion|fire / explosion risk)\b', thermal_text):
        detected_sources.append("THERMAL")

    # 7. CHEMICAL (Corrosive / Hazardous liquid or chemical exposure)
    if re.search(r'\b(chemical|acid|caustic|corrosive|chemical spill|toxic spill|chemical drum|solvent|hydrocarbon leak|hydrocarbon|sodium hydroxide|hydrochloric|sulfuric|amine solution|methanol|glycol|chemical tote|acid leek|acid spray)\b', lower_text) and "TOXIC / ATMOSPHERIC" not in detected_sources:
        detected_sources.append("CHEMICAL")

    # Category determination
    unique_sources = list(dict.fromkeys(detected_sources))
    if len(unique_sources) == 0:
        energy_source = "UNKNOWN"
    elif len(unique_sources) == 1:
        energy_source = unique_sources[0]
    else:
        energy_source = "MULTIPLE"

    # Worker Exposure pathways: prioritize direct line-of-fire and high-energy exposure
    if re.search(r'\b(standing under|beneath suspended load|under load|under suspended load|drop zone|line of fire|line-of-fire|in the line of fire|stood in (?:the )?line of fire|standing in line of fire|entering line of fire|struck-by|struck by|spraying directly|sprayed directly|splashed on chest|unloading hose disconnected)\b', lower_text):
        exposure = "Worker positioned in direct line-of-fire of dynamic trajectory or falling object"
    elif re.search(r'\b(inside vessel|confined space|tank entry|inside pit|manhole|entering the vessel|entered the vessel|vessel entry)\b', lower_text):
        exposure = "Worker occupied within enclosed/confined space atmospheric hazard zone"
    elif re.search(r'\b(touching live|live panel|contact with conductor|bare hands|uninsulated|approached energized|open terminal)\b', lower_text):
        exposure = "Worker in direct physical proximity to live electrical conductors"
    elif re.search(r'\b(work at height|on scaffold|on roof|ladder without tie-off|near open edge|at elevation|working at height|meters elevation|meter elevation|meters height|without safety harness|without harness|harness dangling|unanchored|fragile roof|skylight|open grating)\b', lower_text):
        exposure = "Worker exposed to unprotected fall edge at elevation"
    elif re.search(r'\b(near forklift|vehicle path|almost hit a pedestrian|pedestrian in roadway|crossing blind spot)\b', lower_text):
        exposure = "Pedestrian situated in immediate trajectory of mobile industrial equipment"
    elif re.search(r'\b(restricted area|entering restricted area|exclusion zone|unsafe proximity|unauthorized entry)\b', lower_text):
        exposure = "Worker situated within restricted or exclusion hazard zone without authorization"
    elif re.search(r'\b(near rotating shaft|reaching into nip|unguarded gear|entanglement|unsafe operation|operating machinery|near moving equipment|nip point|tail pulley|rotating drum|shoveling 30cm|30cm from rotating)\b', lower_text):
        exposure = "Personnel directly engaged in or adjacent to active machinery operation"
    elif re.search(r'\b(water leaking near|water is leaking near).*?(panel|electrical|switch)', lower_text):
        exposure = "Water ingress in immediate proximity to energized electrical equipment"
    elif re.search(r'\b(without ppe|without_ppe|no ppe|without proper ppe|ppe not used|incorrect ppe|not wearing ppe|without helmet|without_helmet|no helmet)\b', lower_text):
        exposure = "Worker exposed to operational hazard without mandatory personal protective equipment"
    elif re.search(r'\b(not_exposed|not in line of fire|zero exposure)\b', lower_text):
        exposure = "Personnel confirmed not exposed to hazardous energy trajectory"
    elif re.search(r'\b(heat|burn|heat exposure)\b', lower_text):
        exposure = "Worker exposed to intense thermal energy / extreme heat source"
    elif re.search(r'\b(slip\w*|slippery|trip|walkway|entrance|door|floor)\b', lower_text):
        exposure = "Possible pedestrian worker exposure to surface slip/trip"
    elif re.search(r'\b(worker|man|person|employee|technician|operator|crew)\b', lower_text):
        exposure = "Worker present in active operational work area"
    else:
        exposure = "Possible"

    return {
        "energy_source": energy_source,
        "exposure": exposure,
        "all_energy_sources": unique_sources
    }
