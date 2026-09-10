import re
from typing import Optional

def detect_hazard(text: str) -> Optional[str]:
    """
    Identifies specific hazard categories supported by report context.
    Returns None if no specific hazard can be verified from the report text.
    """
    lower_text = text.lower()

    # Priority 1: High-consequence industrial hazards
    if re.search(r'\b(suspended load|overhead load|crane lift|rigging|dropped object|falling pipe|falling tool|fell from above|dropped from)\b', lower_text):
        return "Suspended Load & Dropped Object Hazard (Gravity / High Energy)"
    
    if re.search(r'\b(height|scaffold|ladder|roof|edge|fall protection|harness|grating missing|hole|platform edge|climbing)\b', lower_text):
        return "Work at Height & Fall Hazard (Gravity)"
    
    if re.search(r'\b(electrical|live wire|voltage|high voltage|panel|switchgear|arc flash|energized|shock|breaker|conduit|cable cut|conductor|insulation|energized conductor)\b', lower_text):
        return "Electrical Arc Flash & Shock Hazard (Electrical Energy)"
    
    if re.search(r'\b(confined space|tank|vessel|manhole|toxic gas|h2s|oxygen deficiency|methane|flammable gas|gas leak)\b', lower_text):
        return "Confined Space & Atmospheric / Toxic Gas Hazard"
    
    if re.search(r'\b(pressure release|high-pressure release|uncontrolled.*pressure|stored pressure|pressurized|hydraulic|steam|line break|hydrotest|blowout|pipeline pressure|loto|lockout|tagout)\b', lower_text):
        return "Hazardous Energy & Pressurized Line Release (Mechanical/Pneumatic Energy)"
    
    if re.search(r'\b(moving vehicle|struck by.*vehicle|vehicle.*plant|forklift|vehicle|truck|dumper|loader|pedestrian|traffic|blind spot|heavy equipment movement)\b', lower_text):
        return "Mobile Equipment & Vehicle-Pedestrian Interaction Hazard (Kinetic Energy)"
    
    if re.search(r'\b(rotating|pinch point|conveyor|roller|blade|gear|nip point|machine guard|machinery.*guard|unguarded.*machine|entanglement)\b', lower_text):
        return "Rotating Machinery & Entanglement Hazard (Mechanical Energy)"
    
    # Thermal and Heat Hazards
    if re.search(r'\b(hot pipe|hot surface|touching.*hot|hot equipment|scalding)\b', lower_text):
        return "Hot Surface & Thermal Hazard (Thermal Energy)"
        
    if re.search(r'\b(heat|extreme heat|heat-rest|cooling system|heat stroke|heat exhaustion|high temperature|ambient heat|overheating)\b', lower_text):
        return "Heat Exposure & Thermal Environmental Hazard (Thermal Energy)"

    if re.search(r'\b(fire|hot work|welding|sparks|combustible|flammable liquid|hydrocarbon spill|flash)\b', lower_text):
        return "Fire & Thermal Ignition Hazard (Thermal Energy)"
    
    if re.search(r'\b(chemical|acid|caustic|solvent|corrosive|toxic spill|chemical drum|chemical burn)\b', lower_text):
        return "Hazardous Chemical Exposure Hazard (Chemical Energy)"
    
    if re.search(r'\b(trench|excavation|cave-in|collapse|shoring|unstable slope)\b', lower_text):
        return "Excavation & Trench Collapse Hazard"
    
    if re.search(r'\b(slip\w*|slippery|slick|trip|uneven surface|housekeeping|water on floor|oily floor|oil.*leak.*floor|debris)\b', lower_text):
        return "Slip / Fall Hazard (Walking-Working Surface)"

    return None
