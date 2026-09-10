import re
from typing import List, Dict, Any, Optional, Set, Tuple
from datetime import datetime, date, timedelta
from collections import defaultdict

# ============================================================================
# 1. HAZARD ROLE & FEATURE DEFINITIONS
# ============================================================================

ROLE_PATTERNS = {
    "GAS_LEAK": re.compile(
        r'\b((?:gas\b.{0,60}\b(?:leak\w*|escap\w*|hiss\w*|smell|odor|vent\w*|cloud|release\w*)|(?:leak\w*|escap\w*|hiss\w*|release\w*).{0,60}\bgas\b)|natural\s+gas|propane|lpg|methane|hydrocarbon\s+(?:gas|vapor)|flammable\s+gas|gas\s+detector|lel)\b',
        re.IGNORECASE
    ),
    "ACTIVE_IGNITION_SOURCE": re.compile(
        r'\b(spark\w*|welding|cutting\s+torch|grinding|hot\s*work|open\s+flame|naked\s+flame|torch|arcing|arc\s+flash|operating\s+heater|heater|furnace|burners?|combustion|fire|flames?)\b',
        re.IGNORECASE
    ),
    "IGNITION_SOURCE": re.compile(
        r'\b(ignition\s*(?:source)?|spark\w*|welding|cutting\s+torch|grinding|hot\s*work|open\s+flame|naked\s+flame|torch|electrical\s+switch|arcing|arc\s+flash|operating\s+heater|heater|furnace|burners?|combustion)\b',
        re.IGNORECASE
    ),
    "PASSIVE_ELECTRICAL_DAMAGE": re.compile(
        r'\b(damaged\s+(?:electrical\s+)?(?:wiring|cable|insulation)|wiring\s+(?:is\s+)?present\s+nearby|frayed\s+wire|compromised\s+cable|damaged\s+wiring)\b',
        re.IGNORECASE
    ),
    "POOR_VENTILATION": re.compile(
        r'\b(poor\s+ventilation|inadequate\s+ventilation|unventilated|confined\s+space|enclosed\s+(?:area|room|space|chamber)|no\s+air\s*flow|stagnant\s+air|low[\s-]lying|trench|under\s+awning|pit|basement|poor\s+airflow|stagnant\s+vapor)\b',
        re.IGNORECASE
    ),
    "OIL_FUEL_LEAK": re.compile(
        r'\b((?:(?:oil|fuel|diesel|hydraulic|lubricant|lube|solvent)\b.{0,60}\b(?:leak\w*|seep\w*|spill\w*|puddle|drip\w*|spray\w*)|(?:leak\w*|seep\w*|spill\w*|drip\w*).{0,60}\b(?:oil|fuel|diesel|hydraulic|lubricant|lube|solvent)\b)|flammable\s+liquid)\b',
        re.IGNORECASE
    ),
    "SLIP_FALL_HAZARD": re.compile(
        r'\b(slip\w*|slipped|slippery|lost\s+footing|trip\w*|tripped|floor|ground|surface|puddle|walking\s+surface|oily\s+floor|slippery\s+surface)\b',
        re.IGNORECASE
    ),
    "FALL_HEIGHT_HAZARD": re.compile(
        r'\b(working\s+at\s+height|at\s+height|elevated|elevation|scaffold\w*|ladder|platform|working\s+platform|monkey\s+board|roof|mast|derrick)\b',
        re.IGNORECASE
    ),
    "MISSING_FALL_PROTECTION": re.compile(
        r'\b(guardrail\s+(?:is\s+|was\s+|found\s+)?(?:missing|removed|damaged|absent)|missing\s+guardrail|no\s+guardrail|no\s+fall\s+protection|fall\s+protection\s+(?:missing|absent|lacking)|unanchored|no\s+harness|unclipped|harness\s+(?:not|unclipped|missing)|no\s+tie[\s-]off|without\s+tie[\s-]off|missing\s+toe[\s-]board|unsecured\s+plank|no\s+fall\s+arrest)\b',
        re.IGNORECASE
    ),
    "ELECTRICAL_EXPOSURE": re.compile(
        r'\b(live\s+(?:conductor|wire|cable|busbar|terminal)|exposed\s+(?:conductor|wire|cable|terminal|copper)|damaged\s+(?:cable\s+)?insulation|insulation\s+damaged|insulation\s+breakdown|near\s+(?:the\s+)?(?:conductor|wire|cable|live\s+part)|close\s+to\s+(?:the\s+)?(?:exposed\s+conductor|live\s+wire)|touching\s+wire|contact\s+with\s+(?:live|conductor|wire))\b',
        re.IGNORECASE
    ),
    "HOT_SURFACE": re.compile(
        r'\b(hot\s+surface|exhaust\s*(?:manifold)?|steam\s+pipe|boiler|operating\s+heater|turbocharger|radiator|hot\s+engine|uninsulated\s+pipe|high\s+surface\s+temp)\b',
        re.IGNORECASE
    ),
    "ELECTRICAL_FAULT": re.compile(
        r'\b(electrical\s+fault|short\s+circuit|sparking\s+(?:wire|cable)|loose\s+(?:connection|cable|lug|terminal)|overheated\s+cable|damaged\s+insulation|breaker\s+tripping|arcing\s+terminal|switchboard\s+spark|motor\s+fault|electrical\s+malfunction|insulation\s+breakdown)\b',
        re.IGNORECASE
    ),
    "FLAMMABLE_MATERIAL": re.compile(
        r'\b(flammable\s+material|combustible|solvent\s+drum|paint\s+can|wooden\s+pallet|cardboard|paper\s+waste|oily\s+rag|cleaning\s+solvent|chemical\s+thinner)\b',
        re.IGNORECASE
    ),
    "CHEMICAL_LEAK": re.compile(
        r'\b(chemical\s+(?:leak\w*|spill\w*|drip\w*|fumes?|container|drum)|acid\s+(?:spill\w*|leak\w*|drip\w*|line|container)|caustic|toxic\s+(?:chemical|vapor|gas)|chlorine|ammonia|h2s|hydrogen\s+sulfide|benzene|hazardous\s+liquid|corrosive|leaked\s+chemical)\b',
        re.IGNORECASE
    ),
    "CHEMICAL_EXPOSURE": re.compile(
        r'\b(exposed\s+to\s+(?:the\s+)?(?:chemical|acid|toxic|fumes|vapor|leaked)|worker\s+(?:is\s+)?(?:directly\s+)?exposed|inhalation|chemical\s+burns?|skin\s+contact|no\s+respirator|without\s+(?:respiratory\s+)?ppe|respiratory\s+irritation)\b',
        re.IGNORECASE
    ),
    "VEHICLE_PEDESTRIAN": re.compile(
        r'\b(forklift|vehicle|truck|mobile\s+equipment|loader|crane\s+travel|reversing|struck[\s-]by|pedestrian|traffic|movement|moving\s+vehicle)\b',
        re.IGNORECASE
    ),
    "HUMAN_EXPOSURE": re.compile(
        r'\b(human\s+exposure|worker\s+exposure|worker\s+proximity|workers?|personnel|technicians?|operators?|electricians?|mechanics?|roughnecks?|pedestrians?|in\s+(?:close\s+)?proximity|near\s+(?:the\s+)?(?:exposed|conductor|line|machinery|spill|cable)|close\s+to|without\s+(?:respiratory\s+)?ppe|no\s+respirator|line[\s-]of[\s-]fire)\b',
        re.IGNORECASE
    ),
    "PRESSURE_INCREASE": re.compile(
        r'\b(pressure\s+(?:increase|rise|rising|spike|surge|surging|anomalous)|overpressure|exceeded\s+setpoint|high\s+pressure|abnormal\s+pressure|gauge\s+rising|relief\s+valve\s+lift|\d+\s*bar)\b',
        re.IGNORECASE
    ),
    "EQUIPMENT_WEAKNESS": re.compile(
        r'\b(equipment\s+weakness|worn\s+gasket|thinned\s+pipe|fatigued\s+bolt|cracked\s+(?:casing|flange|weld)|degraded\s+seal|seal\s+weeping|seal\s+weep|loosened\s+flange|structural\s+degradation|compromised\s+joint|vibration|pulsation)\b',
        re.IGNORECASE
    ),
    "CORROSION": re.compile(
        r'\b(corrosion|corroded|severe\s+rust|metal\s+loss|pitting|wall\s+thinning|oxidation|pipe\s+corrosion|flange\s+corrosion)\b',
        re.IGNORECASE
    ),
    "HIGH_PRESSURE": re.compile(
        r'\b(high[\s-]pressure|pressurized\s+(?:line|pipeline|pipe|vessel|system|manifold|cylinder)|\d+\s*bar|high\s+psi)\b',
        re.IGNORECASE
    ),
    "BLOCKED_EXIT": re.compile(
        r'\b((?:emergency\s+exit|exit|escape\s+route|egress|fire\s+door)\b.{0,60}\b(?:blocked|obstructed|locked|padlocked|cluttered|impassable)\b|(?:blocked|obstructed|locked|padlocked|cluttered|impassable)\b.{0,60}\b(?:emergency\s+exit|exit|escape\s+route|egress|fire\s+door)\b)\b',
        re.IGNORECASE
    ),
    "FIRE_OR_SMOKE": re.compile(
        r'\b(fire|smoke|flames?|smoldering|burning|open\s+flame|flash\s+fire|conflagration)\b',
        re.IGNORECASE
    ),
    "DAMAGED_GUARD": re.compile(
        r'\b(damaged\s+(?:machine\s+)?guard|missing\s+guard|guard\s+removed|interlock\s+bypassed|nip\s+point\s+exposed|conveyor\s+guard\s+off|unprotected\s+rotating|safety\s+interlock\s+defeated|unguarded\s+machine)\b',
        re.IGNORECASE
    ),
    "MOVING_MACHINERY": re.compile(
        r'\b(moving\s+machinery|rotating\s+(?:equipment|shaft|parts?)|conveyor\s+belt|pump\s+shaft|compressor\s+rotor|motor\s+coupling|drill\s+string|spindle|crusher|spinning\s+drum)\b',
        re.IGNORECASE
    ),
    "VIBRATION": re.compile(
        r'\b(vibration|micro[\s-]vibration|pulsation|cyclic\s+thermal|chattering|resonant\s+vibration|shaking\s+pipe)\b',
        re.IGNORECASE
    ),
    "SEAL_WEEPING": re.compile(
        r'\b(seal\s+weeping|acoustic\s+weep|ultrasonic\s+(?:weep|leak)|flange\s+weeping|micro[\s-]seepage|gasket\s+weep|gasket\s+seepage)\b',
        re.IGNORECASE
    )
}

# ============================================================================
# 2. HAZARD INTERACTION RULES KNOWLEDGE BASE
# ============================================================================

INTERACTION_RULES = [
    # 1. Gas Leak + Ignition Source -> Fire/Explosion
    {
        "id": "RULE_GAS_IGNITION",
        "name": "Gas Leak + Ignition Source",
        "primary_roles": {"GAS_LEAK", "ACTIVE_IGNITION_SOURCE"},
        "potential_consequence": "Fire/Explosion",
        "combined_risk": "CRITICAL",
        "base_score": 94,
        "category": "Gas Containment & Fire Explosion Prevention",
        "danger": "Accumulation of flammable vapor in the presence of an ignition source could result in fire or explosion.",
        "root_cause": "Inadequate control of flammable gas release combined with the presence of an ignition source created a credible fire/explosion pathway.",
        "reason": (
            "A flammable gas release directly co-located with an active or potential ignition source "
            "satisfies the combustion triangle. Escaped hydrocarbon vapor mixed with ambient oxygen creates "
            "an immediate risk of flash fire, atmospheric vapor ignition, or catastrophic vapor cloud explosion (VCE)."
        ),
        "recommended_action": (
            "Immediately shut down all hot work and ignition sources, trip Emergency Shutdown (ESD) valves to isolate "
            "the gas supply, evacuate non-essential personnel, and verify 0% LEL with continuous atmospheric gas monitors."
        ),
        "expansion": {
            "role": "POOR_VENTILATION",
            "expanded_name": "Gas Leak + Poor Ventilation + Ignition Source",
            "expanded_consequence": "Gas Accumulation leading to Catastrophic Explosion",
            "expanded_risk": "CRITICAL",
            "expanded_score": 99,
            "expanded_reason": (
                "Gas leak trapped within an unventilated or confined area allows flammable concentration to rapidly accumulate "
                "within the explosive envelope (LEL to UEL). The presence of an ignition source provides the activation energy "
                "for a catastrophic confined vapor cloud explosion with extreme blast overpressure."
            )
        }
    },
    # 2. Gas Leak + Nearby Damaged Wiring (Passive, no active sparks) -> Conditional Latent Risk
    {
        "id": "RULE_GAS_DAMAGED_WIRING",
        "name": "Gas Leak + Nearby Damaged Wiring",
        "primary_roles": {"GAS_LEAK", "PASSIVE_ELECTRICAL_DAMAGE"},
        "potential_consequence": "Flammable Vapor Accumulation / Potential Fire Risk if Energized",
        "combined_risk": "HIGH",
        "base_score": 68,
        "category": "Process Safety & Electrical Isolation",
        "danger": "Gas leakage near damaged electrical wiring presents a latent ignition threat; fire or explosion requires an electrical spark or thermal arc.",
        "root_cause": "Gas containment failure in proximity to damaged electrical infrastructure; ignition pathway requires active electrical arcing or conductor energization.",
        "reason": (
            "A gas release in proximity to damaged wiring creates a conditional hazard. While damaged insulation alone is not an active flame, "
            "electrical switching, arcing, or energized faults can serve as an ignition source."
        ),
        "recommended_action": (
            "De-energize electrical circuits in the gas plume zone under Lockout/Tagout (LOTO), isolate the gas line, and inspect wiring prior to re-energization."
        ),
        "expansion": None
    },
    # 3. Oil Leak + Slip Exposure -> Slip / Fall Injury
    {
        "id": "RULE_OIL_SLIP",
        "name": "Oil Leak + Slip Exposure",
        "primary_roles": {"OIL_FUEL_LEAK", "SLIP_FALL_HAZARD"},
        "potential_consequence": "Slip / Fall Injury",
        "combined_risk": "MEDIUM",
        "base_score": 82,
        "category": "Workplace Safety & Walking-Working Surfaces",
        "danger": "Uncontrolled fluid release onto active pedestrian pathways creates high-slip contamination and worker fall injury potential.",
        "root_cause": "Failure to control the hydraulic oil leak resulted in a contaminated walking surface and increased slip risk.",
        "reason": (
            "Leaking hydraulic fluid or oil pooling across walking surfaces critically reduces friction, directly exposing traversing workers to slip, trip, and impact injuries."
        ),
        "recommended_action": (
            "Isolate hydraulic fluid supply, barricade affected walkway, apply absorbent degreasing compound, and re-establish safe walking-working surface traction."
        ),
        "expansion": None
    },
    # 4. Electrical Exposure + Worker Proximity -> Electric Shock / Arc Flash
    {
        "id": "RULE_ELECTRICAL_EXPOSURE",
        "name": "Electrical Exposure + Worker Proximity",
        "primary_roles": {"ELECTRICAL_EXPOSURE", "HUMAN_EXPOSURE"},
        "potential_consequence": "Electric Shock / Arc Flash",
        "combined_risk": "HIGH",
        "base_score": 82,
        "category": "Electrical Safety & Arc Flash Prevention",
        "danger": "Damaged conductor insulation with personnel working in direct proximity creates an immediate electrocution or arc flash exposure pathway.",
        "root_cause": "Damaged electrical insulation created an exposed energized hazard and increased worker exposure to electrical energy.",
        "reason": (
            "Uninsulated or damaged electrical conductors present an energized boundary hazard. Personnel working in close proximity without verified de-energization face direct shock or thermal arc flash risk."
        ),
        "recommended_action": (
            "Apply Lockout/Tagout (LOTO) to isolate electrical feed, verify zero energy state with calibrated voltmeter, and install approved insulation repair."
        ),
        "expansion": None
    },
    # 5. Fall Exposure + Missing Fall Protection -> Fall From Height
    {
        "id": "RULE_FALL_GUARDRAIL",
        "name": "Fall Exposure + Missing Fall Protection",
        "primary_roles": {"FALL_HEIGHT_HAZARD", "MISSING_FALL_PROTECTION"},
        "potential_consequence": "Fall From Height",
        "combined_risk": "CRITICAL",
        "base_score": 85,
        "category": "Working at Height & Fall Prevention",
        "danger": "Work at elevated work-surfaces without perimeter guardrails or certified 100% tie-off exposes workers to an unarrested gravitational fall with severe or fatal consequence.",
        "root_cause": "Working at elevation without mandatory guardrail barriers or fall arrest protection created an uncontrolled fall from height risk.",
        "reason": (
            "Elevated work combined with missing or removed perimeter barriers removes the primary defense against gravity, turning any loss of balance into an uncontrolled fall from elevation."
        ),
        "recommended_action": (
            "Cease work at elevation immediately, erect certified physical guardrails with mid-rails and toe-boards, and enforce 100% dual-lanyard tie-off."
        ),
        "expansion": None
    },
    # 6. Chemical Leak + Worker Exposure -> Chemical Exposure / Injury
    {
        "id": "RULE_CHEMICAL_EXPOSURE",
        "name": "Chemical Leak + Human Exposure",
        "primary_roles": {"CHEMICAL_LEAK", "HUMAN_EXPOSURE"},
        "potential_consequence": "Chemical Exposure / Injury",
        "combined_risk": "HIGH",
        "base_score": 82,
        "category": "Chemical & Toxic Hazard Management",
        "danger": "Uncontained release of hazardous chemical fluid or vapor contacting unshielded personnel causes acute chemical burns and toxic respiratory impairment.",
        "root_cause": "Loss of containment of hazardous chemicals combined with personnel exposure created an acute chemical injury risk.",
        "reason": (
            "Escape of corrosive, toxic, or hazardous chemical media combined with frontline worker presence in the vapor or splash zone results in direct chemical burns and toxic inhalation."
        ),
        "recommended_action": (
            "Evacuate personnel upwind, establish exclusion perimeter, mandate Level B chemical PPE with supplied-air respirators, and deploy chemical neutralizer."
        ),
        "expansion": None
    },
    # 7. High Pressure Release + Line-of-Fire Proximity
    {
        "id": "RULE_PRESSURE_PROXIMITY",
        "name": "High Pressure Release + Line-of-Fire Proximity",
        "primary_roles": {"HIGH_PRESSURE", "HUMAN_EXPOSURE"},
        "potential_consequence": "High-Energy Release / Serious Injury Potential",
        "combined_risk": "HIGH",
        "base_score": 82,
        "category": "Pressurized Systems & Line-of-Fire Safety",
        "danger": "Pressurized fluid or gas release in the immediate vicinity of unshielded workers creates high kinetic impact and line-of-fire injury potential.",
        "root_cause": "High-pressure process containment compromise with personnel situated in direct discharge path without physical blast shielding.",
        "reason": (
            "High-pressure stored pneumatic or hydraulic energy released near personnel creates extreme kinetic impact, missile hazards, and blast overpressure."
        ),
        "recommended_action": (
            "Depressurize and lock out system, establish line-of-fire exclusion zone, and inspect pressure relief devices."
        ),
        "expansion": None
    },
    # 8. Vehicle Movement + Pedestrian Exposure
    {
        "id": "RULE_VEHICLE_PEDESTRIAN",
        "name": "Vehicle Movement + Pedestrian Exposure",
        "primary_roles": {"VEHICLE_PEDESTRIAN", "HUMAN_EXPOSURE"},
        "potential_consequence": "Struck-By / Vehicle Interaction",
        "combined_risk": "HIGH",
        "base_score": 80,
        "category": "Mobile Equipment & Traffic Management",
        "danger": "Mobile plant equipment traversing shared operational areas without physical pedestrian segregation creates struck-by impact and crushing hazards.",
        "root_cause": "Inadequate pedestrian segregation and traffic management controls allowed moving vehicle interaction with worker.",
        "reason": (
            "Operating mobile plant machinery in shared operational walkways without physical pedestrian barriers creates an immediate risk of struck-by collisions or pinch-point crushing."
        ),
        "recommended_action": (
            "Enforce designated pedestrian walkways with physical crash barriers, mandate high-visibility PPE, and implement vehicle speed limiters."
        ),
        "expansion": None
    },
    # 9. Gas Leak + Poor Ventilation -> Gas Accumulation / Explosion Potential
    {
        "id": "RULE_GAS_VENTILATION",
        "name": "Gas Leak + Poor Ventilation",
        "primary_roles": {"GAS_LEAK", "POOR_VENTILATION"},
        "potential_consequence": "Gas Accumulation / Explosion Potential",
        "combined_risk": "HIGH",
        "base_score": 85,
        "category": "Gas Containment & Atmospheric Control",
        "danger": "Escaping flammable gas within an enclosed, unventilated, or low-lying area prevents natural convective dilution, accumulating into an explosive envelope.",
        "root_cause": "Uncontained flammable gas release within an inadequately ventilated enclosure allowed vapor concentration to accumulate toward explosive limits.",
        "reason": (
            "Escaping flammable gas within an enclosed, unventilated, or low-lying area prevents natural convective dilution. "
            "The gas steadily accumulates past the Lower Explosive Limit (LEL), transforming the entire enclosure into an explosive volume."
        ),
        "recommended_action": (
            "Isolate the gas source, deploy portable explosion-proof ventilation fans to clear the space, and prohibit entry "
            "until multi-gas testing confirms clean atmosphere (<5% LEL and >19.5% O2)."
        ),
        "expansion": None
    },
    # 10. Oil/Fuel Leak + Hot Surface -> Fire
    {
        "id": "RULE_OIL_HOT_SURFACE",
        "name": "Oil/Fuel Leak + Hot Surface",
        "primary_roles": {"OIL_FUEL_LEAK", "HOT_SURFACE"},
        "potential_consequence": "Thermal Ignition & Surface / Pool Fire",
        "combined_risk": "HIGH",
        "base_score": 92,
        "category": "Hot Work & Fire Prevention",
        "danger": "Combustible oil dripping onto an uninsulated hot surface creates immediate auto-ignition and rapid fire spread.",
        "root_cause": "Leaking combustible hydrocarbon fluid contacting an uninsulated hot surface operating above the fluid auto-ignition temperature.",
        "reason": (
            "Leaking combustible fuel or pressurized hydraulic oil dripping onto an uninsulated hot surface exceeding the fluid's "
            "auto-ignition temperature causes immediate thermal vaporization and open flame flashover."
        ),
        "recommended_action": (
            "Depressurize and isolate the leaking oil line, install temporary spray deflectors and permanent thermal insulation "
            "on hot manifolds, and position dry chemical fire extinguishing media."
        ),
        "expansion": None
    },
    # 11. Electrical Fault + Flammable Material -> Fire/Explosion
    {
        "id": "RULE_ELECTRICAL_FLAMMABLE",
        "name": "Electrical Fault + Flammable Material",
        "primary_roles": {"ELECTRICAL_FAULT", "FLAMMABLE_MATERIAL"},
        "potential_consequence": "Electrical Fire & Rapid Flame Spread",
        "combined_risk": "HIGH",
        "base_score": 90,
        "category": "Electrical Fire Safety & Prevention",
        "danger": "Electrical arcing or terminal overheating directly adjacent to combustible supplies creates immediate flame ignition and workshop spread.",
        "root_cause": "Co-location of unmitigated electrical arcing faults with combustible materials without fire-resistant separation.",
        "reason": (
            "Electrical arcing, terminal lug overheating, or short-circuit sparks in direct proximity to combustible rags, open "
            "solvent drums, or waste materials ignite an immediate localized fire that rapidly spreads to surrounding plant assets."
        ),
        "recommended_action": (
            "De-energize electrical circuit under Lockout/Tagout (LOTO), clear all flammable and combustible stores beyond a 10m "
            "exclusion radius, and re-torque electrical connections with a calibrated torque wrench."
        ),
        "expansion": None
    },
    # 12. Pressure Increase + Equipment Weakness -> Rupture/Failure
    {
        "id": "RULE_PRESSURE_WEAKNESS",
        "name": "Pressure Increase + Equipment Weakness",
        "primary_roles": {"PRESSURE_INCREASE", "EQUIPMENT_WEAKNESS"},
        "potential_consequence": "Pressure Vessel / Pipe Rupture",
        "combined_risk": "CRITICAL",
        "base_score": 90,
        "category": "Pressurized Systems Integrity",
        "danger": "Pressure surge exceeding degraded mechanical joint burst margins triggers catastrophic pipe burst and flying shrapnel.",
        "root_cause": "Operational pressure increase acting upon degraded mechanical joint integrity.",
        "reason": (
            "Operational pressure spikes or surging working fluid acting against mechanically weakened flanges, fatigued fasteners, or "
            "degraded gaskets exceed residual structural burst margins, triggering catastrophic line rupture and flying metal shrapnel."
        ),
        "recommended_action": (
            "Reduce process pressure to safe operating envelope, test and calibrate Pressure Safety Valves (PSVs), and conduct "
            "ultrasonic wall thickness and bolt torque verification across the affected segment."
        ),
        "expansion": None
    },
    # 13. Corrosion + High Pressure -> Equipment Failure / Rupture
    {
        "id": "RULE_CORROSION_PRESSURE",
        "name": "Corrosion + High Pressure",
        "primary_roles": {"CORROSION", "HIGH_PRESSURE"},
        "potential_consequence": "Catastrophic Equipment Rupture / Pressurized Blowout",
        "combined_risk": "CRITICAL",
        "base_score": 90,
        "category": "Pressurized Systems Integrity",
        "danger": "Severe localized wall thinning diminishes pressure retention, causing sudden catastrophic blowout.",
        "root_cause": "Uncontrolled wall-thinning corrosion in high-pressure operating line exceeding allowable hoop stress.",
        "reason": (
            "Severe localized corrosion wall-thinning diminishes hoop-stress resistance in high-pressure lines. The high internal energy "
            "causes sudden ductile tear or pinhole rupture, leading to explosive decompression."
        ),
        "recommended_action": (
            "Derate system pressure, execute phased-array ultrasonic thickness inspection (UT), and install an engineered metallic repair "
            "sleeve or replace the degraded pipe spool."
        ),
        "expansion": None
    },
    # 14. Blocked Emergency Exit + Fire -> Severe Evacuation Risk
    {
        "id": "RULE_BLOCKED_EXIT_FIRE",
        "name": "Blocked Emergency Exit + Fire",
        "primary_roles": {"BLOCKED_EXIT", "FIRE_OR_SMOKE"},
        "potential_consequence": "Severe Evacuation Trap / Life Safety Threat",
        "combined_risk": "CRITICAL",
        "base_score": 94,
        "category": "Emergency Preparedness & Life Safety",
        "danger": "Fire or smoke outbreak occurring while emergency exits are blocked traps personnel, multiplying asphyxiation casualties.",
        "root_cause": "Obstruction of designated emergency egress routes concurrent with an active fire event.",
        "reason": (
            "A fire or smoke outbreak occurring while emergency exits, escape doors, or evacuation routes are obstructed or locked creates a "
            "deadly human trap, multiplying smoke inhalation casualties and preventing safe egress."
        ),
        "recommended_action": (
            "Instantly clear obstructions from all emergency exits, unlock escape hardware, activate facility evacuation alarm, and verify "
            "redundant secondary egress routes are completely unimpeded."
        ),
        "expansion": None
    },
    # 15. Damaged Machine Guard + Moving Machinery -> Serious Injury
    {
        "id": "RULE_GUARD_MACHINERY",
        "name": "Damaged Machine Guard + Moving Machinery",
        "primary_roles": {"DAMAGED_GUARD", "MOVING_MACHINERY"},
        "potential_consequence": "Severe Entanglement / Amputation / Serious Injury",
        "combined_risk": "HIGH",
        "base_score": 85,
        "category": "Mechanical Safety & Machine Guarding",
        "danger": "Rotating equipment operating with defeated interlocks or missing guards exposes workers directly to lethal in-running nip points.",
        "root_cause": "Operating mechanical machinery without mandatory physical interlocked guards.",
        "reason": (
            "Operating high-speed rotating equipment or moving conveyors with defeated interlocks or missing physical guards exposes worker "
            "clothing and limbs directly to lethal in-running nip points and entanglement zones."
        ),
        "recommended_action": (
            "Initiate emergency stop, perform Lockout/Tagout (LOTO) on machinery drive, replace damaged physical mesh guards, and test safety "
            "interlock cutoff switches before restarting operations."
        ),
        "expansion": None
    },
    # 16. Piping Vibration + Seal Weepage -> Joint Blowout (Seed Benchmark)
    {
        "id": "RULE_VIBRATION_WEEPING",
        "name": "Piping Micro-Vibration + Flange Seal Weepage",
        "primary_roles": {"VIBRATION", "SEAL_WEEPING"},
        "potential_consequence": "Catastrophic Flange Blowout & Hydrocarbon Release",
        "combined_risk": "HIGH",
        "base_score": 86,
        "category": "Pressurized Hydrocarbons & Gas Containment",
        "danger": "Continuous micro-vibration induces bolt relaxation and accelerated seal weepage, leading to sudden joint blowout.",
        "root_cause": "Cyclic mechanical vibration causing fastener fatigue and flange gasket degradation.",
        "reason": (
            "Continuous micro-vibration induces cyclic mechanical bolt relaxation and fastener fatigue. Combined with seal weepage, the "
            "accelerated gasket degradation leads to sudden catastrophic gasket blowout on Joint B-12."
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
    """Normalizes location strings to support robust spatial matching (e.g., 'Unit 1', 'Unit 01', 'unit-1' -> 'unit-1')."""
    if not loc:
        return "general-facility"
    s = str(loc).strip().lower()
    m = re.search(r'unit\s*[-_#]?\s*0*(\d+)', s, re.IGNORECASE)
    if m:
        return f"unit-{int(m.group(1))}"
    s = re.sub(r'[-_]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

def extract_equipment_tag(text: str) -> Optional[str]:
    """Extracts explicit equipment/component tags like 'Joint B-12', 'Pipeline A-101', 'Pump P-202'."""
    m = re.search(r'\b(joint\s+[a-zA-Z0-9-]+|pipeline\s+[a-zA-Z0-9-]+|switchgear\s+[a-zA-Z0-9-]+|pump\s+[a-zA-Z0-9-]+|compressor\s+[a-zA-Z0-9-]+|panel\s+[a-zA-Z0-9-]+|tank\s+[a-zA-Z0-9-]+)\b', text, re.IGNORECASE)
    if m:
        return re.sub(r'\s+', ' ', m.group(0)).strip().title()
    return None

def extract_report_features(report: Dict[str, Any]) -> Dict[str, Any]:
    """Extracts semantic safety roles, equipment tags, location keys, and date from an observation report."""
    desc = report.get("description") or report.get("report_text") or ""
    add_ctx = report.get("additional_context") or ""
    full_text = f"{desc} {add_ctx}".strip()
    
    # Identify hazard roles
    detected_roles: Set[str] = set()
    for role_name, pattern in ROLE_PATTERNS.items():
        if pattern.search(full_text):
            detected_roles.add(role_name)
    
    # If explicit identified_hazard exists in report, cross-match
    hazard_str = (report.get("identified_hazard") or "").lower()
    for role_name, pattern in ROLE_PATTERNS.items():
        if pattern.search(hazard_str):
            detected_roles.add(role_name)

    loc_raw = report.get("location") or report.get("site") or "Unit 1"
    norm_loc = normalize_location(loc_raw)
    equip = extract_equipment_tag(full_text)

    # Date parsing
    date_val = report.get("report_date") or report.get("date") or str(date.today())
    
    # Severity
    sev = (report.get("observed_severity") or report.get("risk_level") or "Moderate").title()
    sif_assessment = report.get("sif_precursor_assessment") or ("YES" if report.get("sif_potential") == "SIF-potential" else "NO")

    return {
        "report_id": report.get("report_reference") or report.get("report_id") or f"REP-{report.get('id', '000')}",
        "raw_text": desc,
        "full_text": full_text,
        "location_raw": loc_raw,
        "location_norm": norm_loc,
        "equipment_tag": equip,
        "roles": detected_roles,
        "date": date_val,
        "severity": sev,
        "sif_assessment": sif_assessment,
        "report_type": report.get("report_type") or "Near Miss"
    }

# ============================================================================
# 4. SPATIAL & TEMPORAL PROXIMITY CHECK
# ============================================================================

def compute_time_relationship(dates: List[Any]) -> str:
    """Computes a dynamic human-readable time relationship based on actual report dates."""
    parsed_dates = []
    for d in dates:
        if not d:
            continue
        try:
            parsed_dates.append(datetime.strptime(str(d)[:10], "%Y-%m-%d").date())
        except Exception:
            pass

    if not parsed_dates or len(parsed_dates) < 2:
        return "Active operational window"

    days_diff = abs((max(parsed_dates) - min(parsed_dates)).days)
    if days_diff == 0:
        return "Reported on the same day (concurrent)"
    elif days_diff == 1:
        return "Within 24 hours (1 day apart)"
    else:
        return f"Reported {days_diff} days apart"

def get_single_report_potential_consequence(feat: Dict[str, Any]) -> str:
    roles = feat["roles"]
    if "GAS_LEAK" in roles:
        return "Gas Accumulation / Potential Vapor Ignition"
    if "OIL_FUEL_LEAK" in roles:
        return "Surface Contamination / Slip or Localized Fire Potential"
    if "ELECTRICAL_EXPOSURE" in roles or "ELECTRICAL_FAULT" in roles:
        return "Electric Shock / Arc Flash Hazard"
    if "FALL_HEIGHT_HAZARD" in roles or "MISSING_FALL_PROTECTION" in roles:
        return "Gravitational Fall from Elevation"
    if "CHEMICAL_LEAK" in roles or "CHEMICAL_EXPOSURE" in roles:
        return "Chemical Burn / Toxic Inhalation Risk"
    if "HIGH_PRESSURE" in roles or "PRESSURE_INCREASE" in roles:
        return "Pressurized Release / Line-of-Fire Impact"
    if "DAMAGED_GUARD" in roles or "MOVING_MACHINERY" in roles:
        return "Mechanical Entanglement / Pinch Point Risk"
    if "SLIP_FALL_HAZARD" in roles:
        return "Slip / Trip / Same-Level Fall Injury"
    return "Individual Process or Workplace Hazard Precursor"

def get_single_report_danger(feat: Dict[str, Any]) -> str:
    roles = feat["roles"]
    if "GAS_LEAK" in roles:
        return "Uncontained flammable gas release presents an escalating threat if an ignition source is introduced."
    if "OIL_FUEL_LEAK" in roles:
        return "Hydraulic or combustible fluid leakage compromises walking surface friction and introduces thermal exposure."
    if "ELECTRICAL_EXPOSURE" in roles or "ELECTRICAL_FAULT" in roles:
        return "Compromised electrical insulation or exposed energized conductors risk severe shock or arc flash."
    if "FALL_HEIGHT_HAZARD" in roles or "MISSING_FALL_PROTECTION" in roles:
        return "Elevated work without complete perimeter protection risks an unarrested fall."
    if "CHEMICAL_LEAK" in roles or "CHEMICAL_EXPOSURE" in roles:
        return "Loss of hazardous chemical containment threatens acute contact injuries or respiratory toxicity."
    return "Unresolved single precursor has potential to interact with secondary facility activities."

def get_single_report_root_cause(feat: Dict[str, Any]) -> str:
    roles = feat["roles"]
    if "GAS_LEAK" in roles:
        return "Containment barrier integrity loss in pressurized gas infrastructure."
    if "OIL_FUEL_LEAK" in roles:
        return "Seal or fitting leakage on fluid transfer or hydraulic power system."
    if "ELECTRICAL_EXPOSURE" in roles:
        return "Physical or environmental degradation of electrical conductor insulation."
    if "FALL_HEIGHT_HAZARD" in roles:
        return "Incomplete scaffold barrier installation or lack of continuous fall protection."
    if "CHEMICAL_LEAK" in roles:
        return "Chemical containment seal failure or handling procedure deviation."
    return "Initial operational barrier degradation logged in routine safety observation."

def get_single_report_recommended_action(feat: Dict[str, Any]) -> str:
    roles = feat["roles"]
    if "GAS_LEAK" in roles:
        return "Isolate gas source, conduct atmospheric LEL monitoring, and eliminate potential ignition sources in the dispersion zone."
    if "OIL_FUEL_LEAK" in roles:
        return "Contain leak, apply degreasing absorbent on contaminated surfaces, and repair hydraulic fitting."
    if "ELECTRICAL_EXPOSURE" in roles:
        return "De-energize circuit under LOTO, barricade exposed conductor, and repair insulation."
    if "FALL_HEIGHT_HAZARD" in roles:
        return "Pause work at elevation until certified guardrails are erected and 100% tie-off is verified."
    if "CHEMICAL_LEAK" in roles:
        return "Deploy chemical neutralizing absorbent, evacuate splash zone, and inspect vessel integrity."
    return "Perform barrier verification and rectify localized defect before adjacent work permits are approved."

def get_single_report_risk_score(feat: Dict[str, Any]) -> int:
    sev = feat["severity"].upper()
    is_sif = feat["sif_assessment"] == "YES"
    if is_sif or sev == "CRITICAL":
        return 72
    elif sev == "HIGH":
        return 60
    elif sev == "MEDIUM":
        return 45
    return 35

def calculate_proximity(feat1: Dict[str, Any], feat2: Dict[str, Any]) -> Tuple[bool, float, bool, int]:
    """
    Evaluates whether two reports are in reasonable physical and temporal proximity to interact.
    Returns (is_proximity_valid, proximity_weight, is_same_unit, days_apart).
    """
    is_same_unit = False
    spatial_weight = 0.75

    # 1. Equipment Match: Exact shared equipment overrides broad location differences
    if feat1["equipment_tag"] and feat2["equipment_tag"]:
        if feat1["equipment_tag"].lower() == feat2["equipment_tag"].lower():
            is_same_unit = True
            spatial_weight = 1.0

    # 2. Location Match
    if not is_same_unit:
        if feat1["location_norm"] == feat2["location_norm"]:
            is_same_unit = True
            spatial_weight = 1.0
        elif feat1["location_norm"] in feat2["full_text"].lower() or feat2["location_norm"] in feat1["full_text"].lower():
            is_same_unit = True
            spatial_weight = 0.95

    # 3. Temporal Proximity
    days_apart = 0
    try:
        d1 = datetime.strptime(str(feat1["date"])[:10], "%Y-%m-%d").date()
        d2 = datetime.strptime(str(feat2["date"])[:10], "%Y-%m-%d").date()
        days_apart = abs((d1 - d2).days)
    except Exception:
        days_apart = 0

    if days_apart > 30:
        if feat1["equipment_tag"] and feat1["equipment_tag"] == feat2["equipment_tag"]:
            return True, 0.65, True, days_apart
        return False, 0.0, is_same_unit, days_apart

    time_weight = max(0.5, 1.0 - (days_apart / 60.0))
    prox_weight = spatial_weight * time_weight
    return True, prox_weight, is_same_unit, days_apart

def calculate_dynamic_correlation_score(
    rule: Dict[str, Any],
    features: List[Dict[str, Any]],
    is_same_unit: bool,
    days_apart: int,
    is_expanded: bool = False
) -> int:
    """
    Dynamically computes correlation score (0-100) reflecting relationship strength:
    - 90-100: Direct compound physical interaction (e.g. Gas Leak + Active Ignition)
    - 75-89: Strong hazard-barrier interaction (e.g. Fall hazard + Missing guardrail, Oil leak + Slip surface)
    - 60-74: Conditional or passive interaction (e.g. Gas leak + Damaged wiring without sparks)
    - 40-59: Moderate/weak co-occurrence or cross-unit interaction
    - <40: Unrelated / No cluster formed
    """
    exp = rule.get("expansion")
    if is_expanded and exp:
        base = exp.get("expanded_score", 98)
    else:
        base = rule.get("base_score", 75)

    # Unit / location cohesion adjustment
    if is_same_unit:
        loc_adj = 2
    else:
        loc_adj = -12  # Cross-unit penalty

    # Temporal proximity adjustment
    if days_apart == 0:
        time_adj = 2
    elif days_apart <= 2:
        time_adj = 1
    elif days_apart <= 7:
        time_adj = 0
    else:
        time_adj = -min(10, int((days_apart - 7) / 2))

    # Severity & SIF precursor adjustment
    sev_adj = 0
    if any(f.get("sif_assessment") == "YES" for f in features):
        sev_adj += 2
    if any(f.get("severity", "").upper() == "CRITICAL" for f in features):
        sev_adj += 1

    final_score = base + loc_adj + time_adj + sev_adj
    return max(0, min(100, final_score))

# ============================================================================
# 5. CORE CORRELATION ENGINE IMPLEMENTATION
# ============================================================================

def evaluate_report_pair_or_group(reports: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Evaluates a specific pair or group of safety reports (e.g., Report 1: Gas Leak, Report 2: Ignition Source).
    Dynamically identifies compound hazards, computes proportional correlation scores (0-100),
    and supports single-report evaluations without error.
    """
    if not reports:
        return {
            "cluster_detected": False,
            "is_single_signal": False,
            "signals": [],
            "relationship": "No Observations Provided",
            "potential_consequence": "No observations provided for analysis",
            "combined_risk": "LOW",
            "correlation_score": 0,
            "danger": "No active hazard reported.",
            "root_cause": "N/A",
            "reason": "Please provide one or more safety observations to analyze.",
            "recommended_action": "Submit safety observation.",
            "location": "Facility",
            "time_relationship": "N/A"
        }

    # Handle Single Report Mode (Requirement 5)
    if len(reports) == 1:
        f = extract_report_features(reports[0])
        single_consequence = get_single_report_potential_consequence(f)
        single_danger = get_single_report_danger(f)
        single_root_cause = get_single_report_root_cause(f)
        single_action = get_single_report_recommended_action(f)
        single_score = get_single_report_risk_score(f)
        is_sif = f["sif_assessment"] == "YES" or f["severity"].upper() == "CRITICAL"

        return {
            "cluster_detected": False,
            "is_single_signal": True,
            "signal_type": "Single Emerging Safety Signal (High SIF Precursor)" if is_sif else "Single Emerging Safety Signal",
            "signals": [
                {
                    "signal_num": 1,
                    "report_id": f["report_id"],
                    "description": f["raw_text"],
                    "location": f["location_raw"],
                    "date": str(f["date"]),
                    "detected_roles": list(f["roles"]),
                    "assigned_role": list(f["roles"]),
                    "individual_risk": f["severity"].upper() if f["severity"].upper() in ["CRITICAL", "HIGH", "MEDIUM", "LOW"] else ("HIGH" if is_sif else "MEDIUM"),
                    "risk_level": f["severity"].upper() if f["severity"].upper() in ["CRITICAL", "HIGH", "MEDIUM", "LOW"] else ("HIGH" if is_sif else "MEDIUM")
                }
            ],
            "relationship": f"Single Emerging Safety Signal ({f['report_type']})",
            "potential_consequence": single_consequence,
            "combined_risk": f["severity"].upper() if f["severity"].upper() in ["CRITICAL", "HIGH", "MEDIUM", "LOW"] else ("HIGH" if is_sif else "MEDIUM"),
            "correlation_score": single_score,
            "danger": single_danger,
            "root_cause": single_root_cause,
            "reason": f"Single safety observation evaluated as an independent early warning signal in {f['location_raw']}. Continuous monitoring recommended for concurrent energy vectors.",
            "recommended_action": single_action,
            "location": f["location_raw"],
            "time_relationship": "Individual Observation"
        }

    features = [extract_report_features(r) for r in reports]

    # Calculate days apart across reports
    parsed_dates = []
    for f in features:
        try:
            parsed_dates.append(datetime.strptime(str(f["date"])[:10], "%Y-%m-%d").date())
        except Exception:
            pass
    days_apart = abs((max(parsed_dates) - min(parsed_dates)).days) if parsed_dates else 0
    time_relationship_str = compute_time_relationship([f["date"] for f in features])

    # Check shared equipment or unit cohesion
    all_same_unit = all(f["location_norm"] == features[0]["location_norm"] for f in features)
    shared_equipment = bool(features[0]["equipment_tag"] and all(f["equipment_tag"] == features[0]["equipment_tag"] for f in features))
    is_same_unit = all_same_unit or shared_equipment

    # Verify temporal cohesion (interactions separated by >30 days without shared equipment do not correlate)
    if days_apart > 30 and not shared_equipment:
        return {
            "cluster_detected": False,
            "is_single_signal": False,
            "signals": [
                {
                    "signal_num": i + 1,
                    "report_id": f["report_id"],
                    "description": f["raw_text"],
                    "location": f["location_raw"],
                    "date": str(f["date"]),
                    "detected_roles": list(f["roles"]),
                    "assigned_role": list(f["roles"]),
                    "individual_risk": f["severity"].upper() if f["severity"].upper() in ["CRITICAL", "HIGH", "MEDIUM", "LOW"] else "MEDIUM",
                    "risk_level": f["severity"].upper() if f["severity"].upper() in ["CRITICAL", "HIGH", "MEDIUM", "LOW"] else "MEDIUM"
                }
                for i, f in enumerate(features)
            ],
            "relationship": "None (Temporally Disconnected Hazards)",
            "potential_consequence": "Observations occurred outside the active operational interaction window (>30 days)",
            "combined_risk": "LOW",
            "correlation_score": 0,
            "danger": "No active compound hazard due to significant time interval between events.",
            "root_cause": "Independent historical events separated by significant operational interval.",
            "reason": f"Reports occurred {days_apart} days apart, exceeding the 30-day temporal correlation window.",
            "recommended_action": "Archive observations and review as separate historical items.",
            "location": features[0]["location_raw"] if is_same_unit else f"{features[0]['location_raw']} & {features[1]['location_raw']}",
            "time_relationship": time_relationship_str
        }

    # Aggregate detected roles
    all_roles: Set[str] = set()
    for f in features:
        for role in f["roles"]:
            all_roles.add(role)

    # Evaluate against interaction rules to find best match
    best_rule: Optional[Dict[str, Any]] = None
    best_score = 0
    matched_expansion = False

    for rule in INTERACTION_RULES:
        req = rule["primary_roles"]
        if req.issubset(all_roles):
            exp = rule.get("expansion")
            is_expanded = bool(exp and exp["role"] in all_roles)
            cand_score = calculate_dynamic_correlation_score(rule, features, is_same_unit, days_apart, is_expanded)

            if cand_score > best_score:
                best_score = cand_score
                best_rule = rule
                matched_expansion = is_expanded

    # Formulate contributing signals list
    contributing_signals = [
        {
            "signal_num": i + 1,
            "report_id": f["report_id"],
            "description": f["raw_text"],
            "location": f["location_raw"],
            "date": str(f["date"]),
            "detected_roles": list(f["roles"]),
            "assigned_role": list(f["roles"]),
            "individual_risk": f["severity"].upper() if f["severity"].upper() in ["CRITICAL", "HIGH", "MEDIUM", "LOW"] else "MEDIUM",
            "risk_level": f["severity"].upper() if f["severity"].upper() in ["CRITICAL", "HIGH", "MEDIUM", "LOW"] else "MEDIUM"
        }
        for i, f in enumerate(features)
    ]

    loc_display = features[0]["location_raw"] if is_same_unit else f"{features[0]['location_raw']} & {features[1]['location_raw']}"

    # If no rule matched or score is below interaction threshold (<40)
    if not best_rule or best_score < 40:
        return {
            "cluster_detected": False,
            "is_single_signal": False,
            "signals": contributing_signals,
            "relationship": "None (Independent Hazards Without Interaction)",
            "potential_consequence": "No compound escalation detected",
            "combined_risk": "LOW",
            "correlation_score": 0 if not best_rule else best_score,
            "danger": "Independent hazards without co-located physical coupling.",
            "root_cause": "Separate operational deviations without mutual escalation pathway.",
            "reason": "The submitted observations do not share physical hazard interaction, equipment, or co-located energy vectors that would compound into a serious precursor.",
            "recommended_action": "Treat observations as separate routine safety items.",
            "location": loc_display,
            "time_relationship": time_relationship_str
        }

    # Format successful correlation result
    exp = best_rule.get("expansion")
    if matched_expansion and exp:
        rel_name = exp["expanded_name"]
        pot_consequence = exp["expanded_consequence"]
        comb_risk = exp["expanded_risk"]
        reason_text = exp["expanded_reason"]
    else:
        rel_name = best_rule["name"]
        pot_consequence = best_rule["potential_consequence"]
        comb_risk = best_rule["combined_risk"]
        reason_text = best_rule["reason"]

    danger_text = best_rule.get("danger", "Elevated compound risk created by intersecting hazard vectors.")
    root_cause_text = best_rule.get("root_cause", "Concurrent breakdown or absence of independent defensive barriers.")

    return {
        "cluster_detected": True,
        "is_single_signal": False,
        "signal_type": "Emerging Critical-Risk Cluster" if comb_risk == "CRITICAL" else "Emerging Risk Cluster",
        "signals": contributing_signals,
        "relationship": rel_name,
        "potential_consequence": pot_consequence,
        "combined_risk": comb_risk,
        "correlation_score": best_score,
        "danger": danger_text,
        "root_cause": root_cause_text,
        "reason": reason_text,
        "recommended_action": best_rule["recommended_action"],
        "location": loc_display,
        "time_relationship": time_relationship_str
    }

# ============================================================================
# 6. MULTI-REPORT DATASET CORRELATION FOR PLATFORM DASHBOARDS
# ============================================================================

def build_progression_steps(relationship: str, consequence: str) -> List[Dict[str, str]]:
    """Builds a realistic 5-stage progression timeline based on the relationship and consequence."""
    rel_low = relationship.lower()
    con_low = consequence.lower()

    if "gas" in rel_low and ("ignition" in rel_low or "heater" in rel_low) and "ventilation" in rel_low:
        return [
            {"step": "1. Gas Leakage", "trend": "Increasing", "status": "Flange or pipeline develops pressurized gas release"},
            {"step": "2. Poor Ventilation", "trend": "Increasing", "status": "Vapor unable to disperse, accumulating in low-lying area"},
            {"step": "3. Gas Accumulation", "trend": "Increasing", "status": "Atmospheric concentration reaches explosive Lower Explosive Limit (LEL)"},
            {"step": "4. Ignition Proximity", "trend": "Increasing", "status": "Hot work or electrical fault provides active ignition source"},
            {"step": "5. Catastrophic Explosion", "trend": "Increasing", "status": "Unconfined or confined vapor cloud explosion (VCE) with extreme overpressure"}
        ]
    elif "gas" in rel_low and ("ignition" in rel_low or "heater" in rel_low):
        return [
            {"step": "1. Hydrocarbon Release", "trend": "Increasing", "status": "Gas leaking from pressurized pipeline or flange"},
            {"step": "2. Vapor Plume Dispersion", "trend": "Increasing", "status": "Flammable vapor plume travels toward active work zone"},
            {"step": "3. Ignition Proximity", "trend": "Increasing", "status": "Open flame, spark, or operating heater identified nearby"},
            {"step": "4. Flash Fire Threshold", "trend": "Increasing", "status": "Mixture reaches auto-ignition envelope"},
            {"step": "5. Catastrophic Explosion", "trend": "Increasing", "status": "Immediate flash fire and structural explosion hazard"}
        ]
    elif "gas" in rel_low and "wiring" in rel_low:
        return [
            {"step": "1. Gas Containment Loss", "trend": "Increasing", "status": "Flammable gas release enters surrounding atmosphere"},
            {"step": "2. Vapor Migration", "trend": "Increasing", "status": "Plume migrates toward electrical tray with damaged wiring"},
            {"step": "3. Latent Threat Co-location", "trend": "Increasing", "status": "Gas engulfs damaged insulation without active arcing"},
            {"step": "4. Potential Energization", "trend": "Conditional", "status": "Electrical switching or fault required to generate spark"},
            {"step": "5. Conditional Ignition", "trend": "Conditional", "status": "Potential flash fire if circuit arcs while within explosive range"}
        ]
    elif "slip" in rel_low or "slip" in con_low:
        return [
            {"step": "1. Fluid Containment Failure", "trend": "Increasing", "status": "Hydraulic or lubricating oil leaks from line or equipment"},
            {"step": "2. Surface Contamination", "trend": "Increasing", "status": "Fluid pools across active walking-working floor surface"},
            {"step": "3. Friction Loss", "trend": "Increasing", "status": "Floor friction coefficient drops below safe pedestrian threshold"},
            {"step": "4. Worker Traversal", "trend": "Increasing", "status": "Personnel traverse unbarricaded slippery pathway"},
            {"step": "5. Slip / Fall Impact", "trend": "Critical", "status": "Loss of footing resulting in sudden same-level fall or contusion injury"}
        ]
    elif "shock" in con_low or "arc flash" in con_low or ("electrical" in rel_low and "worker" in rel_low):
        return [
            {"step": "1. Insulation Breakdown", "trend": "Increasing", "status": "Mechanical damage or wear exposes live energized conductor"},
            {"step": "2. Barrier Absence", "trend": "Increasing", "status": "Absence of physical shielding or de-energization lockout"},
            {"step": "3. Worker Encroachment", "trend": "Increasing", "status": "Personnel execute maintenance within shock hazard boundary"},
            {"step": "4. Inadvertent Contact", "trend": "Increasing", "status": "Worker body or tool touches energized conductor or causes arc fault"},
            {"step": "5. Electrocution / Arc Flash", "trend": "Critical", "status": "Direct electrical shock or high-temperature arc blast injury"}
        ]
    elif "fall" in con_low or "guardrail" in rel_low:
        return [
            {"step": "1. Elevated Work Task", "trend": "Increasing", "status": "Personnel deployed on elevated platform or scaffolding"},
            {"step": "2. Perimeter Defense Missing", "trend": "Increasing", "status": "Guardrail, mid-rail, or toe-board absent or removed"},
            {"step": "3. Edge Proximity", "trend": "Increasing", "status": "Worker maneuvers near unprotected edge without fall arrest lanyard"},
            {"step": "4. Loss of Balance", "trend": "Increasing", "status": "Trip, stumble, or sudden shift in footing at edge"},
            {"step": "5. Unarrested Fall", "trend": "Critical", "status": "Gravitational fall from height resulting in critical impact trauma"}
        ]
    elif "chemical" in rel_low or "chemical" in con_low:
        return [
            {"step": "1. Vessel Containment Loss", "trend": "Increasing", "status": "Chemical container, drum, or valve develops leakage"},
            {"step": "2. Vapor / Liquid Release", "trend": "Increasing", "status": "Hazardous toxic or corrosive media spreads in work zone"},
            {"step": "3. Personal Boundary Breach", "trend": "Increasing", "status": "Personnel enter contaminated area without adequate chemical PPE"},
            {"step": "4. Acute Contact / Inhalation", "trend": "Increasing", "status": "Direct skin contact with liquid or respiratory inhalation of fumes"},
            {"step": "5. Chemical Injury", "trend": "Critical", "status": "Severe caustic burns, respiratory distress, or systemic toxicity"}
        ]
    elif "vehicle" in rel_low or "struck" in con_low:
        return [
            {"step": "1. Mobile Equipment Operation", "trend": "Increasing", "status": "Forklift or industrial vehicle operating in plant corridor"},
            {"step": "2. Shared Spatial Zone", "trend": "Increasing", "status": "Pedestrian personnel walking in vehicle travel route"},
            {"step": "3. Sightline / Warning Failure", "trend": "Increasing", "status": "Blind spot, lack of spotter, or missing physical pedestrian barrier"},
            {"step": "4. Encroachment Collision Course", "trend": "Increasing", "status": "Vehicle distance closes on traversing worker"},
            {"step": "5. Struck-By Trauma", "trend": "Critical", "status": "High-mass impact or crushing injury against structure"}
        ]
    elif "hot surface" in rel_low or "oil" in rel_low:
        return [
            {"step": "1. Fluid Loss", "trend": "Increasing", "status": "Combustible oil or fuel leaking from line/fitting"},
            {"step": "2. Thermal Migration", "trend": "Increasing", "status": "Fluid seeps onto uninsulated hot exhaust surface"},
            {"step": "3. Thermal Vaporization", "trend": "Increasing", "status": "Oil vaporizes rapidly at auto-ignition temperature"},
            {"step": "4. Surface Ignition", "trend": "Increasing", "status": "Localized flash fire erupts along pipe trench"},
            {"step": "5. Conflagration", "trend": "Increasing", "status": "Open pool fire spreads toward bulk fuel storage"}
        ]
    elif "electrical" in rel_low or "flammable" in rel_low:
        return [
            {"step": "1. Electrical Fault", "trend": "Increasing", "status": "Terminal overheating, loose lug, or wire micro-arcing"},
            {"step": "2. Thermal Hotspot", "trend": "Increasing", "status": "Insulation charring and ozone odor detected"},
            {"step": "3. Combustible Contact", "trend": "Increasing", "status": "Sparks land on nearby solvent or combustible supplies"},
            {"step": "4. Flashover", "trend": "Increasing", "status": "Rapid flame propagation across workshop floor"},
            {"step": "5. Facility Conflagration", "trend": "Increasing", "status": "Full switchboard and structural conflagration"}
        ]
    elif "exit" in rel_low or "fire" in rel_low:
        return [
            {"step": "1. Egress Obstruction", "trend": "Increasing", "status": "Emergency door or walkway padlocked or cluttered"},
            {"step": "2. Fire Outbreak", "trend": "Increasing", "status": "Smoke or open flame erupts in operational bay"},
            {"step": "3. Evacuation Attempt", "trend": "Increasing", "status": "Personnel attempt emergency exit but find path blocked"},
            {"step": "4. Toxic Inhalation", "trend": "Increasing", "status": "Heavy smoke accumulation creates immediate asphyxiation"},
            {"step": "5. Mass Casualty Risk", "trend": "Increasing", "status": "Critical life-safety emergency with zero primary escape route"}
        ]
    elif "guard" in rel_low or "machinery" in rel_low:
        return [
            {"step": "1. Guard Deficiency", "trend": "Increasing", "status": "Physical mesh barrier damaged or interlock bypassed"},
            {"step": "2. Continuous Rotation", "trend": "Stable", "status": "High-speed machinery operates with exposed nip point"},
            {"step": "3. Operator Proximity", "trend": "Increasing", "status": "Worker conducts manual task within line-of-fire"},
            {"step": "4. Pinch Point Exposure", "trend": "Increasing", "status": "Clothing or limb drawn into rotating mechanism"},
            {"step": "5. Amputation Precursor", "trend": "Increasing", "status": "Catastrophic mechanical crushing and amputation risk"}
        ]
    else:
        return [
            {"step": "1. Latent Deviation", "trend": "Increasing", "status": "Minor operating irregularity or barrier wear logged"},
            {"step": "2. Cumulative Degradation", "trend": "Increasing", "status": "Secondary safeguard or physical barrier compromised"},
            {"step": "3. Hazard Interaction", "trend": "Increasing", "status": "Co-occurring energy vector activates latent vulnerability"},
            {"step": "4. Escalation Proximity", "trend": "Increasing", "status": "Unmitigated cumulative risk approaching trip threshold"},
            {"step": "5. High SIF Precursor", "trend": "Increasing", "status": "Credible high-energy consequence pathway established"}
        ]

def correlate_reports_into_weak_signals(reports: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Scans an arbitrary list of safety reports from an organization and extracts all
    meaningful hazard interaction clusters (supporting 2-signal and 3+ signal combinations),
    both within identical operational units and across interacting cross-unit zones.
    """
    if not reports or len(reports) < 2:
        return []

    features = [extract_report_features(r) for r in reports]

    # Cluster reports by normalized location
    loc_groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for f in features:
        loc_groups[f["location_norm"]].append(f)

    correlated_results: List[Dict[str, Any]] = []
    seen_report_pairs: Set[Tuple[str, str]] = set()
    sig_counter = 1

    # 1. Evaluate within location groups
    for loc_key, group in loc_groups.items():
        if len(group) < 2:
            continue

        # Try Group Evaluation (Check if 3+ reports form an expanded multi-signal cluster)
        group_eval = evaluate_report_pair_or_group([r for r in reports if extract_report_features(r)["location_norm"] == loc_key])
        if group_eval.get("cluster_detected") and len(group_eval.get("signals", [])) >= 2:
            source_reps = [
                {
                    "report_id": s["report_id"],
                    "report_type": next((f["report_type"] for f in group if f["report_id"] == s["report_id"]), "Near Miss"),
                    "date_submitted": next((str(f["date"]) for f in group if f["report_id"] == s["report_id"]), str(date.today())),
                    "short_description": s["description"][:100] + ("..." if len(s["description"]) > 100 else ""),
                    "unit": s["location"],
                    "excerpt": s["description"]
                }
                for s in group_eval["signals"]
            ]

            title = f"{group[0]['location_raw']} {group_eval['relationship']}"
            progression = build_progression_steps(group_eval["relationship"], group_eval["potential_consequence"])

            correlated_results.append({
                "cluster_detected": True,
                "id": sig_counter,
                "signal_id": f"WS-{sig_counter:02d}",
                "title": title,
                "category": group_eval.get("category", "Process Safety & Hazard Interaction"),
                "relationship": group_eval["relationship"],
                "potential_consequence": group_eval["potential_consequence"],
                "potential_sif_precursor": group_eval["potential_consequence"],
                "combined_risk": group_eval["combined_risk"],
                "risk_level": group_eval["combined_risk"].title(),
                "risk_score": group_eval["correlation_score"],
                "correlation_score": group_eval["correlation_score"],
                "danger": group_eval.get("danger", ""),
                "root_cause": group_eval.get("root_cause", ""),
                "reason": group_eval["reason"],
                "why_identified": group_eval["reason"],
                "recommended_action": group_eval["recommended_action"],
                "first_detected_date": source_reps[0]["date_submitted"] if source_reps else str(date.today()),
                "source": f"Multi-Report Interaction ({len(source_reps)} Correlated Records)",
                "connected_signals": [f"{s['report_id']}: {s['description'][:70]}" for s in group_eval["signals"]],
                "progression_steps": progression,
                "source_reports": source_reps,
                "review_status": "Under Review",
                "reviewer_notes": f"Correlated by AI Interaction Engine: {group_eval['relationship']} in {group[0]['location_raw']}.",
                "key_learnings": f"Enforce immediate controls for {group_eval['relationship']}.",
                "energy_source": "Co-Occurring Energetic Vectors",
                "barrier_status": "DEFENSIVE CONTROLS COMPROMISED",
                "signals": group_eval["signals"],
                "time_relationship": group_eval.get("time_relationship", "Active operational window"),
                "location": group_eval.get("location", group[0]["location_raw"])
            })
            sig_counter += 1

            for i in range(len(group)):
                for j in range(i + 1, len(group)):
                    pair_key = (min(group[i]["report_id"], group[j]["report_id"]), max(group[i]["report_id"], group[j]["report_id"]))
                    seen_report_pairs.add(pair_key)
            continue

        # Pairwise within group
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                f1 = group[i]
                f2 = group[j]
                pair_key = (min(f1["report_id"], f2["report_id"]), max(f1["report_id"], f2["report_id"]))
                if pair_key in seen_report_pairs:
                    continue

                rep1 = next(r for r in reports if (r.get("report_reference") or r.get("report_id") or f"REP-{r.get('id', '000')}") == f1["report_id"])
                rep2 = next(r for r in reports if (r.get("report_reference") or r.get("report_id") or f"REP-{r.get('id', '000')}") == f2["report_id"])
                pair_eval = evaluate_report_pair_or_group([rep1, rep2])

                if pair_eval.get("cluster_detected"):
                    seen_report_pairs.add(pair_key)
                    source_reps = [
                        {
                            "report_id": s["report_id"],
                            "report_type": f1["report_type"] if s["report_id"] == f1["report_id"] else f2["report_type"],
                            "date_submitted": str(f1["date"]) if s["report_id"] == f1["report_id"] else str(f2["date"]),
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
                        "category": "Hazard Interaction & Precursor Correlation",
                        "relationship": pair_eval["relationship"],
                        "potential_consequence": pair_eval["potential_consequence"],
                        "potential_sif_precursor": pair_eval["potential_consequence"],
                        "combined_risk": pair_eval["combined_risk"],
                        "risk_level": pair_eval["combined_risk"].title(),
                        "risk_score": pair_eval["correlation_score"],
                        "correlation_score": pair_eval["correlation_score"],
                        "danger": pair_eval.get("danger", ""),
                        "root_cause": pair_eval.get("root_cause", ""),
                        "reason": pair_eval["reason"],
                        "why_identified": pair_eval["reason"],
                        "recommended_action": pair_eval["recommended_action"],
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
                        "signals": pair_eval["signals"],
                        "time_relationship": pair_eval.get("time_relationship", "Active operational window"),
                        "location": pair_eval.get("location", f1["location_raw"])
                    })
                    sig_counter += 1

    # 2. Cross-location pairwise evaluation (supports cross-unit hazard interaction)
    all_loc_keys = list(loc_groups.keys())
    for i in range(len(all_loc_keys)):
        for j in range(i + 1, len(all_loc_keys)):
            g1 = loc_groups[all_loc_keys[i]]
            g2 = loc_groups[all_loc_keys[j]]
            for f1 in g1:
                for f2 in g2:
                    pair_key = (min(f1["report_id"], f2["report_id"]), max(f1["report_id"], f2["report_id"]))
                    if pair_key in seen_report_pairs:
                        continue

                    # Pre-screen if combined roles match any rule
                    combined_roles = f1["roles"].union(f2["roles"])
                    if any(rule["primary_roles"].issubset(combined_roles) for rule in INTERACTION_RULES):
                        rep1 = next(r for r in reports if (r.get("report_reference") or r.get("report_id") or f"REP-{r.get('id', '000')}") == f1["report_id"])
                        rep2 = next(r for r in reports if (r.get("report_reference") or r.get("report_id") or f"REP-{r.get('id', '000')}") == f2["report_id"])
                        pair_eval = evaluate_report_pair_or_group([rep1, rep2])

                        if pair_eval.get("cluster_detected"):
                            seen_report_pairs.add(pair_key)
                            source_reps = [
                                {
                                    "report_id": s["report_id"],
                                    "report_type": f1["report_type"] if s["report_id"] == f1["report_id"] else f2["report_type"],
                                    "date_submitted": str(f1["date"]) if s["report_id"] == f1["report_id"] else str(f2["date"]),
                                    "short_description": s["description"][:100] + ("..." if len(s["description"]) > 100 else ""),
                                    "unit": s["location"],
                                    "excerpt": s["description"]
                                }
                                for s in pair_eval["signals"]
                            ]

                            title = f"{pair_eval.get('location', f1['location_raw'])} {pair_eval['relationship']}"
                            progression = build_progression_steps(pair_eval["relationship"], pair_eval["potential_consequence"])

                            correlated_results.append({
                                "cluster_detected": True,
                                "id": sig_counter,
                                "signal_id": f"WS-{sig_counter:02d}",
                                "title": title,
                                "category": "Cross-Unit Hazard Interaction",
                                "relationship": pair_eval["relationship"],
                                "potential_consequence": pair_eval["potential_consequence"],
                                "potential_sif_precursor": pair_eval["potential_consequence"],
                                "combined_risk": pair_eval["combined_risk"],
                                "risk_level": pair_eval["combined_risk"].title(),
                                "risk_score": pair_eval["correlation_score"],
                                "correlation_score": pair_eval["correlation_score"],
                                "danger": pair_eval.get("danger", ""),
                                "root_cause": pair_eval.get("root_cause", ""),
                                "reason": pair_eval["reason"],
                                "why_identified": pair_eval["reason"],
                                "recommended_action": pair_eval["recommended_action"],
                                "first_detected_date": source_reps[0]["date_submitted"] if source_reps else str(date.today()),
                                "source": f"Cross-Unit Interaction ({len(source_reps)} Records)",
                                "connected_signals": [f"{s['report_id']}: {s['description'][:70]}" for s in pair_eval["signals"]],
                                "progression_steps": progression,
                                "source_reports": source_reps,
                                "review_status": "Under Review",
                                "reviewer_notes": f"Cross-unit correlation: {pair_eval['relationship']} across {pair_eval.get('location', 'facility')}.",
                                "key_learnings": f"Review spatial hazard barriers between interacting zones.",
                                "energy_source": "Compound Energy Vector",
                                "barrier_status": "DEFENSIVE BOUNDARY COMPROMISED",
                                "signals": pair_eval["signals"],
                                "time_relationship": pair_eval.get("time_relationship", "Active operational window"),
                                "location": pair_eval.get("location", f"{f1['location_raw']} & {f2['location_raw']}")
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
