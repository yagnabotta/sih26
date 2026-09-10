import re
from typing import Dict, Optional

def analyze_energy_and_exposure(text: str) -> Dict[str, Optional[str]]:
    """
    Identifies specific energy sources and worker exposure contexts when supported.
    Returns None when the information is not supported by the report.
    """
    lower_text = text.lower()
    energy_source = None
    exposure = None

    # 1. Energy Source Detection
    if re.search(r'\b(heat|extreme heat|hot pipe|hot surface|cooling system|heat stroke|heat exhaustion|high temperature|ambient heat|overheating|fire|hot work|welding|flash fire|hot steam|molten)\b', lower_text):
        energy_source = "Thermal Energy"
    elif re.search(r'\b(live conductor|energized conductor|insulation|electrical|voltage|440v|11kv|live cable|spark|arc flash|switchgear|breaker|energized)\b', lower_text):
        energy_source = "Electrical Energy"
    elif re.search(r'\b(pressure release|high-pressure release|uncontrolled.*pressure|pressurized|pressure|hydraulic|steam|gas line|pipeline|hydrotest|blowout|manifold)\b', lower_text):
        energy_source = "Stored Pressure / Pneumatic & Hydraulic Energy"
    elif re.search(r'\b(moving vehicle|struck by.*vehicle|vehicle.*plant|forklift|truck|vehicle|dumper|loader|trailer|moving crane)\b', lower_text):
        energy_source = "Kinetic Energy"
    elif re.search(r'\b(rotating|machinery|shaft|gear|conveyor|pinch|roller|impeller|grinder|guard)\b', lower_text):
        energy_source = "Mechanical Energy"
    elif re.search(r'\b(acid|toxic gas|h2s|chemical|corrosive|hazardous fluid|chemical burn)\b', lower_text):
        energy_source = "Chemical / Toxic Energy"
    elif re.search(r'\b(slip\w*|slippery|slick|trip|uneven surface|water on floor|oily floor)\b', lower_text):
        energy_source = "Gravity / Kinetic"
    elif re.search(r'\b(overhead|suspended|crane|hoist|dropped|fell from|height|scaffold|ladder|roof|edge)\b', lower_text):
        energy_source = "Gravity (High elevation potential energy / falling mass)"

    # 2. Exposure Context Detection
    if re.search(r'\b(hot pipe|hot surface|touching.*hot|hot equipment|scalding)\b', lower_text):
        exposure = "Direct contact with hot surface / thermal equipment"
    elif re.search(r'\b(heat|extreme heat|cooling system|high temperature|heat-rest|heat stroke|heat exhaustion)\b', lower_text):
        exposure = "Exposure to excessive heat / elevated thermal environment"
    elif re.search(r'\b(live.*conductor|energized conductor|contact.*energized|near energized|exposed live|live wire|live panel|touching.*conductor|conductors)\b', lower_text):
        exposure = "Worker in direct physical proximity or potential contact with live electrical conductors"
    elif re.search(r'\b(struck by.*vehicle|moving vehicle|near forklift|pedestrian.*vehicle|vehicle.*plant|reversing)\b', lower_text):
        exposure = "Pedestrian worker situated in immediate trajectory of mobile equipment"
    elif re.search(r'\b(uncontrolled.*pressure|pressure release|line break|blowout|pressurized release)\b', lower_text):
        exposure = "Worker situated in direct line-of-fire of uncontrolled pressure release"
    elif re.search(r'\b(standing under|beneath|in drop zone|near crane|under load)\b', lower_text):
        exposure = "Worker directly exposed in line-of-fire beneath suspended load"
    elif re.search(r'\b(at height|on scaffold|on roof|on ladder|near open edge|at elevation)\b', lower_text):
        exposure = "Worker exposed to unprotected fall edge at elevation"
    elif re.search(r'\b(machinery.*guard|unguarded.*machin|near rotating|reaching into|near belt|unprotected nip|machine without)\b', lower_text):
        exposure = "Worker limbs in proximity to unguarded mechanical movement"
    elif re.search(r'\b(chemical burn|acid spill|corrosive|toxic spill|handling.*chemical)\b', lower_text):
        exposure = "Direct worker exposure to hazardous chemical substance"
    elif re.search(r'\b(inside tank|in vessel|inside manhole|enclosed chamber)\b', lower_text):
        exposure = "Worker occupied within enclosed/confined space environment"
    elif re.search(r'\b(slip\w*|slippery|slick|trip|walking|entrance|door|corridor|path|oily floor)\b', lower_text) and any(k in lower_text for k in ["slip", "slippery", "slick", "oily"]):
        exposure = "Potential slip/fall exposure on compromised walking surface"
    elif re.search(r'\b(bypassed|no ppe|without protection|unprotected)\b', lower_text):
        exposure = "Worker performing high-risk task without primary protection barrier"

    return {
        "energy_source": energy_source or "Insufficient Information",
        "exposure": exposure or "Insufficient Information"
    }
