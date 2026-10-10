"""
Dataset Generator for Oil Refinery and Industrial Safety Intelligence
=====================================================================
Generates realistic, expert-curated industrial incident reports across:
1. Catastrophic explosions & major blasts (Risk 88-98, Critical)
2. Rapidly spreading process fires & hydrocarbon infernos (Risk 86-95, Critical)
3. Serious hazards with high potential (Risk 70-85, Serious)
4. Moderate localized hazards with containment (Risk 30-69, Moderate)
5. Minor controlled fires & contained spills (Risk 10-28, Low)
6. Negative contextual examples (drills, toolbox talks, inspections) (Risk 5-20, Low)
7. Missing/vague information examples (Risk 15-25, Low/Uncertain)
8. Worker variations with colloquial phrasing, spelling errors, and varying lengths.

Outputs:
- training_data/industrial_refinery_incidents.csv
- training_data/train.csv (70%)
- training_data/val.csv (15%)
- training_data/test.csv (15%)
- training_data/processed/refinery_incident_dataset.csv
"""

import os
import random
import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.model_selection import train_test_split

# Set fixed seed for full reproducibility
SEED = 42
random.seed(SEED)
np.random.seed(SEED)

records = []

def add_record(
    desc,
    inc_type,
    severity,
    score,
    inc_factors,
    dec_factors,
    explanation,
    sif_label,
    barrier="BARRIER_INSUFFICIENT_INFO",
    loc="Refinery Process Area",
    obs_sev=None
):
    if obs_sev is None:
        obs_sev = severity
    records.append({
        "report_id": f"REF-OIL-{len(records)+1:04d}",
        "incident_description": desc,
        "report_text": desc,  # Canonical alias for pipeline
        "incident_type": inc_type,
        "severity_level": severity,
        "expected_risk_score": int(score),
        "risk_increasing_factors": inc_factors,
        "risk_reducing_factors": dec_factors,
        "score_explanation": explanation,
        "sif_potential": sif_label,
        "barrier_failure": barrier,
        "observed_severity": obs_sev,
        "location": loc,
        "data_source": "Oil Refinery Field Operations & Expert Curated"
    })

# ------------------------------------------------------------------------------
# 1. CRITICAL: MAJOR EXPLOSIONS & CATASTROPHIC BLASTS (Score 88 - 98)
# ------------------------------------------------------------------------------
catastrophic_explosions = [
    (
        "Catastrophic blast and major explosion occurred near fuel storage tanks in Tank Farm 4. Fireball and shockwave observed across the refinery.",
        "Fire & Explosion", "Critical", 94,
        "Massive hydrocarbon inventory, violent shockwave blast, proximity to active bulk fuel storage tanks, multiple personnel in vicinity",
        "Plant-wide emergency siren sounded, automatic isolation valves initiated",
        "Catastrophic overpressure blast and fireball with acute potential for mass fatalities and widespread destruction across tank farm.",
        "SIF-potential", "BARRIER_FAILED", "Tank Farm 4"
    ),
    (
        "Huge blast erupted by fuel storage tanks, massive explosion with fire expanding into nearby units.",
        "Fire & Explosion", "Critical", 93,
        "Massive vapor cloud explosion, rapid escalation toward adjacent units, personnel in blast trajectory",
        "Refinery fire brigade deployed emergency foam monitors",
        "Major explosion near fuel storage presenting immediate life-threatening blast trauma and uncontained fire spread.",
        "SIF-potential", "BARRIER_FAILED", "Tank Farm 2"
    ),
    (
        "major explsion tank farm 4 big fire shockwave shaken bldg",
        "Fire & Explosion", "Critical", 92,
        "Structural building shaking, massive blast energy, high flammable fuel presence",
        "Emergency alarms sounding",
        "High-energy catastrophic blast reported informally; immediate fatality threat from structural collapse and blast wave.",
        "SIF-potential", "BARRIER_FAILED", "Tank Farm 4"
    ),
    (
        "Crude distillation column heater tube ruptured violently resulting in catastrophic explosion and heavy fireball lifting the furnace roof.",
        "Fire & Explosion", "Critical", 96,
        "Furnace roof blown off, extreme thermal blast, release of superheated crude oil, personnel in unit pathway",
        "Emergency fuel gas trip actuated",
        "Lethal blast energy and thermal radiation from furnace explosion capable of causing instant multiple fatalities.",
        "SIF-potential", "BARRIER_FAILED", "Crude Distillation Unit (CDU)"
    ),
    (
        "LPG sphere 301 BLEVE explosion following high-pressure drain line detachment. Massive fireball engulfed the entire sphere manifold.",
        "Fire & Explosion", "Critical", 98,
        "Boiling Liquid Expanding Vapor Explosion (BLEVE), catastrophic loss of primary containment, lethal fireball radius > 200m",
        "Water deluge deluge system triggered",
        "Maximal severity catastrophic industrial disaster with guaranteed fatal outcome for personnel within blast contour.",
        "SIF-potential", "BARRIER_FAILED", "LPG Storage Area"
    ),
    (
        "Reformer hydrogen reactor vessel head sheared off under 150 bar pressure causing a devastating blast and flying shrapnel across piperacks.",
        "Fire & Explosion", "Critical", 97,
        "150 bar pressure release, high-velocity metal shrapnel, hydrogen auto-ignition, high density process area",
        "None effective",
        "Extreme high-pressure stored energy catastrophic failure with supersonic shrapnel projection across work areas.",
        "SIF-potential", "BARRIER_FAILED", "Reformer Unit"
    ),
    (
        "High-pressure gas line exploded near compressor house 3 throwing debris 60 meters and knocking down operations crew.",
        "Fire & Explosion", "Critical", 92,
        "Line rupture blast, heavy flying debris, operators physically thrown by overpressure wave",
        "Unit shutdown tripped automatically",
        "High-pressure line blowout with physical blast wave impact directly injuring personnel in line-of-fire.",
        "SIF-potential", "BARRIER_FAILED", "Compressor House 3"
    ),
    (
        "big explodid sound at vacuum unit boiler blast very loud fire spreading everywhere",
        "Fire & Explosion", "Critical", 91,
        "Boiler blast, rapid flame spread across vacuum unit, informal worker report indicating uncontained disaster",
        "Workers evacuating area",
        "Boiler explosion with rapidly propagating fire presenting immediate catastrophic consequence potential.",
        "SIF-potential", "BARRIER_FAILED", "Vacuum Distillation Unit"
    ),
    (
        "Catastrophic failure of high-pressure separator vessel resulting in instantaneous vapor cloud explosion (VCE) in gas processing plant.",
        "Fire & Explosion", "Critical", 96,
        "Unconfined vapor cloud explosion, supersonic flame front, extensive structural damage to control annex",
        "Emergency shutdown activated",
        "Catastrophic VCE with massive overpressure generating lethal trauma across entire operational sector.",
        "SIF-potential", "BARRIER_FAILED", "Gas Processing Plant"
    ),
    (
        "Naphtha hydrotreater reactor explosion during catalyst regeneration, shockwave shattered windows in central control room.",
        "Fire & Explosion", "Critical", 93,
        "Heavy shockwave reaching blast-resistant buildings, severe vessel overpressurization, toxic catalyst release",
        "Blast walls mitigated damage to control room",
        "Severe explosion with high energy release capable of fatal injury to any personnel in the processing plot.",
        "SIF-potential", "BARRIER_FAILED", "Hydrotreater Unit"
    ),
    (
        "fire explosion near pipeline",
        "Fire & Explosion", "Critical", 96,
        "Hydrocarbon pipeline rupture blast, uncontained fire, immediate line-of-fire hazard",
        "Emergency isolation initiated",
        "Pipeline explosion and fire with severe overpressure and thermal radiation posing immediate fatality risk.",
        "SIF-potential", "BARRIER_FAILED", "Pipeline Corridor"
    ),
    (
        "fire explotion near pipeline",
        "Fire & Explosion", "Critical", 96,
        "Worker report of pipeline blast with fire; high kinetic blast wave and thermal hazard",
        "Evacuation alarm sounded",
        "Pipeline explosion reported by field operator; acute catastrophic blast trauma potential.",
        "SIF-potential", "BARRIER_FAILED", "Pipeline Corridor"
    ),
    (
        "fire explosion",
        "Fire & Explosion", "Critical", 95,
        "Uncontained explosion and fire in industrial process facility; lethal thermal and blast energy",
        "Plant alarms activated",
        "Industrial fire and explosion event with acute potential for fatal trauma.",
        "SIF-potential", "BARRIER_FAILED", "Process Unit"
    ),
    (
        "fire explotion",
        "Fire & Explosion", "Critical", 95,
        "Worker informal report of fire and explosion event in active operational plot",
        "Emergency services responding",
        "Explosion and fire incident presenting life-threatening blast overpressure.",
        "SIF-potential", "BARRIER_FAILED", "Operating Area"
    ),
    (
        "pipeline explosion",
        "Fire & Explosion", "Critical", 95,
        "Catastrophic pipeline rupture blast with high-velocity shockwave and flying debris",
        "Sectional block valves closed",
        "Catastrophic pipeline blast with fatal projectile and overpressure consequences.",
        "SIF-potential", "BARRIER_FAILED", "Main Pipeline"
    ),
    (
        "gas explotion occurred near pipeline",
        "Fire & Explosion", "Critical", 94,
        "Flammable gas ignition and explosion along pipeline route, high thermal radiation",
        "Fire monitors dispatched",
        "Gas explosion in transfer pipeline with direct personnel blast exposure.",
        "SIF-potential", "BARRIER_FAILED", "Gas Pipeline Corridor"
    )
]

for item in catastrophic_explosions:
    add_record(*item)

# ------------------------------------------------------------------------------
# 2. CRITICAL: SPREADING REFINERY PROCESS FIRES & JET FIRES (Score 86 - 95)
# ------------------------------------------------------------------------------
spreading_fires = [
    (
        "Rapidly spreading hydrocarbon fire in the crude distillation unit (CDU) heater, flames spreading to adjacent pipe racks, emergency shutdown activated.",
        "Fire & Explosion", "Critical", 92,
        "Active rapid propagation to piperacks, uncontained fuel feed, high process temperature (>350C), refinery wide escalation risk",
        "ESD initiated, fixed deluge monitors energized",
        "Major uncontained process fire spreading toward critical infrastructure with high potential for catastrophic failure.",
        "SIF-potential", "BARRIER_FAILED", "CDU Heater Unit"
    ),
    (
        "Crude oil transfer line ruptured under 40 bar pressure, massive burning jet fire impinging on structural steel columns of Unit 10.",
        "Fire & Explosion", "Critical", 91,
        "High-pressure pressurized burning jet, structural steel flame impingement causing collapse risk, unisolated fuel",
        "Emergency isolation valve attempted remotely",
        "Jet fire impinging on load-bearing refinery structures presents imminent threat of structural collapse and escalation.",
        "SIF-potential", "BARRIER_FAILED", "Unit 10 Structure"
    ),
    (
        "Heavy gas oil pump P-204 mechanical seal blew out, resulting in a large uncontained fire expanding across the second deck.",
        "Fire & Explosion", "Critical", 89,
        "Seal blowout, pressurized hot hydrocarbon release, multi-level deck fire propagation, egress pathways compromised",
        "Drain sumps open",
        "Spreading hydrocarbon fire across operational decks threatening worker escape routes and adjacent piping.",
        "SIF-potential", "BARRIER_FAILED", "Pump House 2"
    ),
    (
        "fire in pump house spreding quick to pipes black smoke everywere operators running",
        "Fire & Explosion", "Critical", 88,
        "Rapid flame spread, dense toxic smoke, chaotic emergency evacuation, flammable piping endangered",
        "Operators evacuating",
        "Uncontrolled process unit fire with rapid expansion threatening lives of operational personnel on site.",
        "SIF-potential", "BARRIER_FAILED", "Pump House 1"
    ),
    (
        "Diesel pipeline manifold flange failed, high-pressure spray ignited, spreading fire engulfed nearby electrical cable trays.",
        "Fire & Explosion", "Critical", 90,
        "High-pressure liquid spray fire, cable tray propagation destroying plant instrument controls, secondary flash potential",
        "Deluge activated",
        "Spreading fire destroying vital electrical and instrumentation controls, creating cascading shutdown failures.",
        "SIF-potential", "BARRIER_FAILED", "Pipe Manifold Area"
    ),
    (
        "Uncontrolled hydrocarbon fire in FCCU regenerator overhead line, radiating extreme heat preventing firefighter approach.",
        "Fire & Explosion", "Critical", 92,
        "Extreme thermal radiation flux, inability to approach for manual firefighting, large continuous inventory",
        "Remote water cannons positioned",
        "Refinery catalytic cracker fire with extreme thermal radiation capable of causing third-degree burns and fatalities.",
        "SIF-potential", "BARRIER_FAILED", "FCCU Plot"
    ),
    (
        "flames comming out from cdu pipe rack growing fast cant put out with portable foam",
        "Fire & Explosion", "Critical", 88,
        "Failure of first-line firefighting barriers, growing flame front on piperack carrying multiple fuels",
        "Fire brigade en route",
        "Uncontained escalating fire on multi-line piperack where portable extinguishing barriers have completely failed.",
        "SIF-potential", "BARRIER_FAILED", "CDU Piperack"
    ),
    (
        "Naphtha storage tank roof seal caught fire with flames expanding across the floating roof rim threatening tank boilover.",
        "Fire & Explosion", "Critical", 91,
        "Full tank surface fire potential, rim seal destruction, risk of catastrophic tank boilover",
        "Subsurface foam injection started",
        "Large atmospheric storage tank fire with acute potential for full-surface involvement and tank destruction.",
        "SIF-potential", "BARRIER_FAILED", "Tank 205"
    )
]

for item in spreading_fires:
    add_record(*item)

# ------------------------------------------------------------------------------
# 3. CRITICAL: TOXIC RELEASES, ARC FLASH, HIGH-FALL HAZARDS (Score 86 - 95)
# ------------------------------------------------------------------------------
other_critical_hazards = [
    (
        "Major H2S gas leak (>500 ppm) from corroded heat exchanger bundle, toxic cloud drifting across main operations walkway, 2 workers collapsed.",
        "Gas Leak", "Critical", 95,
        "Lethal H2S concentration (>100 ppm is IDLH), actual casualties reported, atmospheric drift toward occupied zones",
        "Emergency sirens sounding",
        "Acute lethal toxic gas exposure with proven human casualties and uncontained atmospheric dispersal.",
        "SIF-potential", "BARRIER_FAILED", "Amine Treater Unit"
    ),
    (
        "Worker entered crude storage tank without breathing apparatus or gas testing while internal H2S levels were 320 ppm.",
        "Gas Leak", "Critical", 93,
        "Unmonitored confined space entry, lethal atmospheric poison, complete absence of respiratory barrier",
        "Standby watch spotted worker and sounded alarm",
        "Extreme SIF precursor: entry into immediately dangerous to life or health (IDLH) toxic atmosphere without protection.",
        "SIF-potential", "BARRIER_MISSING", "Tank 104"
    ),
    (
        "Electrician racked in 11kV circuit breaker onto closed earth switch causing massive arc flash and blast, panel doors blown open.",
        "Electrical / Arc Flash", "Critical", 94,
        "11,000 Volts fault energy, arc flash thermal blast > 40 cal/cm2, mechanical failure of enclosure doors",
        "Upstream breaker tripped on overcurrent",
        "High-voltage arc flash explosion with catastrophic thermal and blast energy directed straight at technician.",
        "SIF-potential", "BARRIER_FAILED", "Main Substation B"
    ),
    (
        "15-ton crane boom collapsed during heavy reactor head lift, load crashed across worker muster area, rigging snapped.",
        "Equipment Failure", "Critical", 93,
        "15,000 kg falling mass, collapse into designated personnel gathering area, catastrophic structural failure",
        "Area was partially cordoned",
        "Catastrophic dropped heavy load with lethal crushing force capable of multiple fatalities.",
        "SIF-potential", "BARRIER_FAILED", "Turnaround Rigging Plot"
    ),
    (
        "Scaffolding tower at 28 meters elevation suffered base collapse during high winds, 3 workers hanging onto loose planks without harness tie-off.",
        "Work at Height", "Critical", 92,
        "28m fall height (guaranteed fatal threshold), structural scaffold collapse, zero fall arrest anchor connected",
        "Workers holding structural ledger",
        "Extreme work at height imminent fall hazard where single slip results in fatal 28-meter ground impact.",
        "SIF-potential", "BARRIER_MISSING", "Column C-101 Scaffolding"
    ),
    (
        "High pressure hydrogen line operating at 120 bar suffered flange blowout, high-velocity invisible gas jet whistling loudly near hot heater.",
        "Gas Leak", "Critical", 91,
        "120 bar hydrogen, auto-ignition risk near hot surfaces, invisible flame front, line of fire exposure",
        "Area evacuated immediately",
        "Pressurized hydrogen release with acute potential for instantaneous unconfined blast and severe line-of-fire injury.",
        "SIF-potential", "BARRIER_FAILED", "Hydrocracker Unit"
    ),
    (
        "Technician opened pressurized acid line without LOTO or bleeding pressure, concentrated sulfuric acid sprayed directly onto face shield and chest.",
        "Chemical Spill", "Critical", 89,
        "Pressurized hazardous chemical spray, LOTO bypassed, direct line-of-fire bodily contact with corrosive acid",
        "Worker was wearing acid suit and face shield",
        "Severe chemical line-of-fire release with potential for chemical blindness and deep systemic burns.",
        "SIF-potential", "BARRIER_BYPASSED", "Alkylation Unit"
    )
]

for item in other_critical_hazards:
    add_record(*item)

# ------------------------------------------------------------------------------
# 4. SERIOUS HAZARDS WITH SIF POTENTIAL (Score 70 - 85)
# ------------------------------------------------------------------------------
serious_hazards = [
    (
        "Worker performing piping repair at 6 meters elevation on pipe rack without safety harness clipped to lifeline.",
        "Work at Height", "Serious", 80,
        "6 meter fall height exceeds fatal trauma threshold, absence of fall arrest connection",
        "Scaffold platform had partial handrails",
        "Significant SIF precursor: working at fatal elevation with missing personal fall arrest tie-off.",
        "SIF-potential", "BARRIER_MISSING", "Offsites Piperack"
    ),
    (
        "Unisolated 415V electrical terminal box found open with live bare busbars exposed in wet rainy weather near pedestrian path.",
        "Electrical / Arc Flash", "Serious", 78,
        "Live 415V electrical potential, water pooling creating shock conductivity, exposed to unshielded personnel",
        "Warning cone placed nearby",
        "Serious electrocution hazard due to energized electrical parts exposed in wet outdoor operating conditions.",
        "SIF-potential", "BARRIER_MISSING", "Cooling Tower Area"
    ),
    (
        "Heavy forklift operated at high speed in blind corner of warehouse, nearly striking walking operator who jumped aside.",
        "Personal Injury", "Serious", 76,
        "High kinetic mass vehicle, blind corner trajectory, pedestrian proximity in line of travel",
        "Operator reacted and swerved",
        "Serious near-miss with mobile industrial machinery having potential for life-altering crush injury.",
        "SIF-potential", "BARRIER_COMPROMISED", "Central Warehouse"
    ),
    (
        "Nitrogen purge hose disconnected while under 7 bar pressure, whipping violently across the deck striking handrails.",
        "Equipment Failure", "Serious", 77,
        "Pressurized whipping hose dynamic energy, line-of-fire impact hazard",
        "No personnel in direct line of fire at moment of disconnect",
        "Dynamic high-pressure hose whip capable of severe blunt force trauma or skull fracture.",
        "SIF-potential", "BARRIER_FAILED", "Utility Station 4"
    ),
    (
        "Flange bolts found loosened on high-pressure sour crude oil line before positive physical isolation was confirmed.",
        "Gas Leak", "Serious", 82,
        "Potential high-pressure hydrocarbon and H2S release, procedural LOTO breakdown",
        "Technician stopped work before separating flange faces",
        "Critical procedural violation on high-energy toxic line caught just prior to containment loss.",
        "SIF-potential", "BARRIER_BYPASSED", "Crude Manifold"
    ),
    (
        "Overhead crane hoist brake slipped 1 meter while transporting 3-ton compressor casing over maintenance workshop.",
        "Equipment Failure", "Serious", 81,
        "Heavy suspended load, mechanical brake degradation, potential for sudden drop",
        "Area was cordoned off below",
        "Compromised crane lifting barrier with heavy mass suspended over workshop personnel floor.",
        "SIF-potential", "BARRIER_COMPROMISED", "Mechanical Workshop"
    ),
    (
        "scafold plank cracked worker stepped on it and nearly sliped down 8 meters",
        "Work at Height", "Serious", 79,
        "8m elevation, damaged load-bearing plank, worker lost footing",
        "Worker caught onto scaffold tube with hands",
        "Substandard working platform at fatal height where barrier degradation directly led to near-fall event.",
        "SIF-potential", "BARRIER_FAILED", "Unit 3 Column"
    ),
    (
        "Contractor grinding steel near fuel oil sample point with flammable vapor reading at 25% LEL without hot work permit.",
        "Fire & Explosion", "Serious", 83,
        "Ignition sparks in flammable vapor atmosphere, hot work authorization omitted",
        "Safety officer intervened and stopped work immediately",
        "Active ignition source introduced into flammable atmosphere, creating acute flash fire precursor.",
        "SIF-potential", "BARRIER_BYPASSED", "Fuel Oil Blending"
    ),
    (
        "Acid drum tipped over during forklift transfer, leaking 50 liters of 70% hydrofluoric acid into outdoor unbunded gravel.",
        "Chemical Spill", "Serious", 84,
        "Highly toxic corrosive hydrofluoric acid, lack of secondary containment, toxic vapor generation",
        "Spill response team deployed calcium gluconate neutralizing agent",
        "Uncontained release of extremely hazardous chemical capable of fatal skin absorption and respiratory toxicity.",
        "SIF-potential", "BARRIER_FAILED", "Chemical Storage Yard"
    ),
    (
        "Trench wall collapsed in 2.5m deep excavation while worker was installing drainage pipe without trench box shoring.",
        "Equipment Failure", "Serious", 82,
        "Soil engulfment hazard, depth > 2m, complete absence of protective shoring cage",
        "Soil pinned worker up to waist, fellow crew dug him out",
        "Serious cave-in incident with acute asphyxiation and crushing hazard from unbarricaded excavation walls.",
        "SIF-potential", "BARRIER_MISSING", "Offsite Utilities Trench"
    )
]

for item in serious_hazards:
    add_record(*item)

# ------------------------------------------------------------------------------
# 5. MODERATE HAZARDS & LOCALIZED INCIDENTS (Score 30 - 69)
# ------------------------------------------------------------------------------
moderate_hazards = [
    (
        "Packing gland on hot bitumen valve started smoking with minor 10cm localized flame, extinguished within 30 seconds with 5kg dry powder.",
        "Fire & Explosion", "Moderate", 48,
        "Thermal ignition of hydrocarbon residue, localized flame",
        "Immediate prompt extinguishment, no propagation, zero pressure blowout, valve isolated",
        "Localized small equipment fire extinguished promptly without spread or threat to life.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Bitumen Plant"
    ),
    (
        "Hydraulic oil line on mobile crane developed pinhole leak spraying fine mist onto hot engine exhaust, creating heavy smoke but no open flame.",
        "Fire & Explosion", "Moderate", 52,
        "Flammable fluid spray near hot surface, fire precursor",
        "Engine killed immediately, fire extinguisher staged, no flame erupted",
        "Potential ignition hazard controlled rapidly before fire could establish.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Crane Laydown Area"
    ),
    (
        "small flame on pump p12 caught grease wiped out with co2 extinguisher immediately no damage",
        "Fire & Explosion", "Moderate", 38,
        "Small localized open flame on grease deposit",
        "Zero propagation, rapid operator action with portable extinguisher, zero damage",
        "Minor surface fire controlled immediately by worker; low consequence potential.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Pump Station 5"
    ),
    (
        "Chemical drum valve weeping slowly, approximately 10 liters of diluted detergent spilled inside concrete containment bund.",
        "Chemical Spill", "Moderate", 36,
        "Chemical liquid release, minor slip hazard",
        "Secondary concrete bund completely contained spill, low toxicity liquid",
        "Contained industrial spill with effective secondary containment preventing environmental or worker harm.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Washdown Bay"
    ),
    (
        "Worker slipped on oily floor grating near slop tank and bruised left knee, grating had missing anti-skid coating.",
        "Personal Injury", "Moderate", 40,
        "Surface slip on walkway, minor personal contusion",
        "Same-level fall, zero high-energy exposure, no head impact",
        "Low-energy slip and fall resulting in minor first-aid injury without serious consequence potential.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Slop Tank Area"
    ),
    (
        "Portable angle grinder guard was missing while worker trimmed unpressurized steel bracket in fabrication shop.",
        "Equipment Failure", "Moderate", 58,
        "Missing machine guard barrier, wheel shatter risk",
        "Worker wearing full face shield and leather gloves, low-mass workpiece",
        "Machinery safety violation with PPE barriers mitigating potential injury severity.",
        "Non-SIF-potential", "BARRIER_MISSING", "Fabrication Shop"
    ),
    (
        "diesel leak from drain valve about 5 liters on concrete floor drained into oil water separator",
        "Chemical Spill", "Moderate", 42,
        "Flammable liquid on floor, hydrocarbon odor",
        "Drained into designed oily water drainage system, ignition sources isolated",
        "Contained fuel leak managed by plant drainage infrastructure without escalation.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Diesel Day Tank"
    ),
    (
        "Handrail on secondary stairway loose and wobbling when pushed, bolt missing on middle stanchion.",
        "Work at Height", "Moderate", 35,
        "Degraded stairway barrier, potential loss of balance",
        "Stairway enclosed, wide steps, low elevation change",
        "Compromised architectural barrier with low probability of serious fall consequence.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Unit 2 Staircase"
    ),
    (
        "Exposed 24V DC instrument cable lying across operator walkway creating a tripping obstacle.",
        "Electrical / Arc Flash", "Moderate", 32,
        "Trip obstacle on walkway, cable abrasion risk",
        "Extra-low voltage (24V DC) poses zero shock or arc flash hazard",
        "Low-voltage cable causing minor housekeeping trip hazard without electrical energy risk.",
        "Non-SIF-potential", "BARRIER_INSUFFICIENT_INFO", "Control Room Walkway"
    ),
    (
        "Small pinhole leak on 2-inch utility cooling water pipe dripping 1 liter per minute onto asphalt road.",
        "Equipment Failure", "Moderate", 30,
        "Piping degradation, puddle formation",
        "Low pressure non-hazardous ambient water, away from electrical gear",
        "Low consequence utility water piping leak without hazardous energy or chemical exposure.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Roadway 3"
    )
]

for item in moderate_hazards:
    add_record(*item)

# ------------------------------------------------------------------------------
# 6. LOW RISK: MINOR CONTROLLED FIRES & CONTAINED SPILLS (Score 10 - 28)
# ------------------------------------------------------------------------------
minor_controlled_and_contained = [
    (
        "Small controlled fire inside designated burn pit for emergency response training, safely extinguished with handheld extinguisher.",
        "Fire & Explosion", "Low", 22,
        "Controlled ignition of diesel tray in fire pit",
        "Designated concrete burn pit, trained ERT crew on standby, fire monitors ready, safely put out with extinguisher",
        "Planned, fully controlled fire training exercise within designated containment with zero escalation risk.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Fire Training Ground"
    ),
    (
        "Minor lube oil leak of approximately 50ml onto concrete drip tray beneath pump P-101. Fully contained, wiped with absorbents.",
        "Chemical Spill", "Low", 15,
        "50ml oil seepage",
        "Dedicated drip tray caught 100% of volume, wiped clean immediately, zero hot surface contact, zero environmental escape",
        "Negligible volume contained on engineered drip pan; zero life-threatening or fire escalation potential.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Pump P-101 Skid"
    ),
    (
        "little oil on floor in tray wipe up 50ml clean with rag",
        "Chemical Spill", "Low", 14,
        "Very small oil drip",
        "Caught in tray, wiped immediately with rag, no hazard left",
        "Informal report of minor routine lube oil drip caught in drip tray and cleaned up.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Compressor Shed"
    ),
    (
        "Welding spark landed on fire blanket during hot work and was immediately quenched with water bottle by designated fire watcher.",
        "Fire & Explosion", "Low", 20,
        "Hot work spark on blanket",
        "Fire blanket protected piping, dedicated fire watch present with water, zero smoldering, zero spread",
        "Safety controls functioned flawlessly; designated fire watch quenched single spark instantly.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Maintenance Bay"
    ),
    (
        "Small paper trash can fire in maintenance office smoking, extinguished in 5 seconds with 2kg CO2 extinguisher.",
        "Fire & Explosion", "Low", 24,
        "Small office paper ignition",
        "Contained inside metal bin, rapidly extinguished with CO2, zero process proximity, zero damage",
        "Minor non-industrial paper bin ignition safely put out within seconds.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Workshop Office"
    ),
    (
        "tiny flame on rag put out in sec with water bucket",
        "Fire & Explosion", "Low", 18,
        "Single rag scorch",
        "Extinguished in seconds with water bucket, isolated location",
        "Informal report of tiny smoldering rag extinguished immediately without hazard.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Welding Shop"
    ),
    (
        "Drip of approximately 100ml diesel fuel from sampling valve caught in dedicated sample bucket, no ground contamination.",
        "Chemical Spill", "Low", 16,
        "Minor fuel drip",
        "Captured fully in sample bucket, sample valve closed tight",
        "Routine sample collection drip captured in bucket without leakage or exposure.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Sample Station 2"
    ),
    (
        "Controlled test ignition of pilot burner on flare stack executed successfully according to standard startup procedure.",
        "Fire & Explosion", "Low", 20,
        "Thermal pilot burner flame",
        "Engineered flare stack tip, controlled electronic ignition, normal operating envelope",
        "Routine engineered flare pilot ignition executed under safe operating parameters.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Elevated Flare Stack"
    ),
    (
        "Two drops of hydraulic oil noticed on compressor skid baseplate, wiped clean with shop rag during daily inspection.",
        "Chemical Spill", "Low", 12,
        "Trivial oil drops",
        "Wiped immediately, skid plate clean, zero leakage running",
        "Trivial surface weep during routine inspection with zero consequence potential.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Compressor Skid"
    ),
    (
        "small fire in burn pit for trainig put out safely by team",
        "Fire & Explosion", "Low", 20,
        "Controlled fire training",
        "Designated burn pit, training team extinguished it safely",
        "Planned firefighting training exercise executed safely in designated burn facility.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Training Area"
    )
]

for item in minor_controlled_and_contained:
    add_record(*item)

# ------------------------------------------------------------------------------
# 7. NEGATIVE EXAMPLES: KEYWORDS PRESENT WITHOUT ACTIVE INCIDENT (Score 5 - 20)
# ------------------------------------------------------------------------------
negative_examples = [
    (
        "Conducted morning safety toolbox talk discussing lessons learned from the 2005 Texas City refinery explosion.",
        "Safety Drill / Negative Context", "Low", 10,
        "Dangerous keywords 'explosion', 'refinery' present in text",
        "Administrative safety meeting, educational review, zero operational hazard, no physical event occurred",
        "Classroom toolbox safety review discussing historical industrial incident; no active plant hazard.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Meeting Room A"
    ),
    (
        "Emergency response fire drill conducted at Tank Farm 2 to test fire monitor water pressure and foam cannons.",
        "Safety Drill / Negative Context", "Low", 16,
        "Keywords 'fire', 'tank farm', 'drill' present",
        "Planned simulation drill, water and synthetic foam tested safely, all personnel accounted for",
        "Scheduled emergency response drill evaluating fire suppression equipment; zero actual fire or threat.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Tank Farm 2"
    ),
    (
        "Completed monthly routine inspection of 45 fire extinguishers and hose reels in Unit 1; all pressure gauges in green zone.",
        "Safety Drill / Negative Context", "Low", 12,
        "Keywords 'fire extinguishers', 'hose reels'",
        "Equipment verification, all units tagged and compliant, zero emergency",
        "Routine maintenance audit of emergency safety equipment with zero active hazard.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Unit 1 Operating Area"
    ),
    (
        "Safety stand-down held in workshop to discuss proper use of explosion-proof flashlights in hazardous classified areas.",
        "Safety Drill / Negative Context", "Low", 10,
        "Keywords 'explosion-proof', 'hazardous areas'",
        "Educational safety communication, safety awareness meeting",
        "Worker awareness discussion on hazardous area electrical ratings; no active incident.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Electrical Shop"
    ),
    (
        "Delivered training presentation on chemical spill containment kits and eyewash station maintenance procedures.",
        "Safety Drill / Negative Context", "Low", 10,
        "Keywords 'chemical spill', 'containment kits'",
        "Classroom procedural training session, no chemicals handled",
        "Safety training session on spill kit readiness with zero physical hazardous release.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Safety Training Room"
    ),
    (
        "Conducted scheduled fire water deluge test on sphere 101, all spray nozzles verified clear and flowing clean water.",
        "Safety Drill / Negative Context", "Low", 14,
        "Keywords 'fire water deluge', 'sphere'",
        "Routine functional test of deluge defense barriers using clean water",
        "Preventive functional test of fire protection system confirming barrier readiness.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Sphere 101"
    ),
    (
        "Reviewed historical case study of Piper Alpha gas explosion during quarterly process safety management workshop.",
        "Safety Drill / Negative Context", "Low", 10,
        "Keywords 'gas explosion', 'Piper Alpha'",
        "Historical academic process safety case study discussion",
        "Theoretical educational review of past disaster to reinforce permit-to-work compliance.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Conference Hall"
    ),
    (
        "safety talk about fire prevention in pump room with operators today",
        "Safety Drill / Negative Context", "Low", 10,
        "Keywords 'fire', 'pump room'",
        "Informal safety communication, preventive discussion",
        "Toolbox discussion on good housekeeping and fire prevention in machinery rooms.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Pump House"
    ),
    (
        "Replaced 2 discharged fire extinguisher inspection tags in warehouse corridor during safety walkabout.",
        "Safety Drill / Negative Context", "Low", 8,
        "Keywords 'fire extinguisher'",
        "Tag replacement, administrative documentation update",
        "Routine administrative upkeep of extinguisher inspection tags; no operational defect.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Warehouse Corridor"
    ),
    (
        "Conducted annual full-scale plant evacuation fire drill with local municipal emergency fire services participating.",
        "Safety Drill / Negative Context", "Low", 18,
        "Keywords 'plant evacuation', 'fire drill', 'fire services'",
        "Simulated exercise, full safety supervision, plant in safe steady state",
        "Controlled emergency readiness exercise to validate evacuation muster protocols.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Refinery Wide"
    )
]

for item in negative_examples:
    add_record(*item)

# ------------------------------------------------------------------------------
# 8. VAGUE / MISSING INFORMATION EXAMPLES (Score 15 - 25, Elevated Uncertainty)
# ------------------------------------------------------------------------------
vague_examples = [
    (
        "Something smelled weird near unit.",
        "Vague / Insufficient Info", "Low", 18,
        "Unspecified odor reported",
        "No identified hazard, no location, no pressure/energy vector specified",
        "Description lacks operational details, hazard classification, or location; elevated assessment uncertainty.",
        "Non-SIF-potential", "BARRIER_INSUFFICIENT_INFO", "Unknown Unit"
    ),
    (
        "Noise heard near equipment yesterday.",
        "Vague / Insufficient Info", "Low", 16,
        "Unspecified acoustic observation",
        "No specific machinery identified, no operating anomaly confirmed",
        "Vague report with missing operational data; requires physical inspection to determine credibility.",
        "Non-SIF-potential", "BARRIER_INSUFFICIENT_INFO", "Plant Area"
    ),
    (
        "Worker felt unsafe in the area.",
        "Vague / Insufficient Info", "Low", 18,
        "Subjective worker concern",
        "Zero details on energy source, task, hazard vector, or barrier status",
        "Subjective perception lacking factual hazard evidence; high uncertainty assessment.",
        "Non-SIF-potential", "BARRIER_INSUFFICIENT_INFO", "General Plant"
    ),
    (
        "Need someone to check pump area.",
        "Vague / Insufficient Info", "Low", 15,
        "General maintenance request",
        "No hazard or failure described",
        "General work request without safety observation details; indeterminate risk.",
        "Non-SIF-potential", "BARRIER_INSUFFICIENT_INFO", "Pump Area"
    ),
    (
        "Small issue observed during night shift.",
        "Vague / Insufficient Info", "Low", 16,
        "Indeterminate issue",
        "No energy, no exposure, no barrier information",
        "Extremely vague observation report lacking essential safety parameters.",
        "Non-SIF-potential", "BARRIER_INSUFFICIENT_INFO", "Night Shift Plot"
    ),
    (
        "saw smoke comming from somewhere in distance",
        "Vague / Insufficient Info", "Low", 22,
        "Unconfirmed distant smoke sighting",
        "No verified source, no unit identified, no personnel known exposed",
        "Distant unconfirmed visual observation requiring field verification before risk assessment.",
        "Non-SIF-potential", "BARRIER_INSUFFICIENT_INFO", "Distance Boundary"
    )
]

for item in vague_examples:
    add_record(*item)

# ------------------------------------------------------------------------------
# 9. EXPANDED WORKER VARIATIONS & REALISTIC INDUSTRIAL INCIDENTS
# (Refinery unit variations, spelling variations, different phrasings)
# ------------------------------------------------------------------------------
expanded_variations = [
    # Paraphrases of Major Explosion
    (
        "Massive explosion ripped through hydrogen compressor unit 4 with violent shockwave flattening scaffolding towers.",
        "Fire & Explosion", "Critical", 95,
        "High-pressure hydrogen explosion, scaffolding collapse, supersonic shockwave, active plot",
        "Automated ESD shutdown initiated",
        "Devastating explosion with lethal overpressure and blast shrapnel destroying structures.",
        "SIF-potential", "BARRIER_FAILED", "Hydrogen Compressor 4"
    ),
    (
        "huge blast at tank area all windows broken fire high in sky",
        "Fire & Explosion", "Critical", 93,
        "Shattered glass indicates high overpressure wave, large visible fire column, bulk tank proximity",
        "Emergency responders mobilizing",
        "Informal report confirming catastrophic blast wave overpressure and major escalating fire.",
        "SIF-potential", "BARRIER_FAILED", "Tank Farm Area"
    ),
    (
        "Boiler blast in utility plant blew inspection hatch off with tremendous force, hot steam and flames filling building.",
        "Fire & Explosion", "Critical", 92,
        "High pressure steam and fire explosion, heavy missile projectile hazard, enclosed building trap",
        "Automatic boiler trip actuated",
        "Severe utility boiler explosion creating deadly thermal blast and ballistic projectile hazards.",
        "SIF-potential", "BARRIER_FAILED", "Utility Boiler House"
    ),
    # Paraphrases of Spreading Fire
    (
        "Crude distillation pump P-102 caught fire, flames spreading across piperack and impinging on high-pressure naphtha line.",
        "Fire & Explosion", "Critical", 91,
        "Impingement on high-pressure naphtha line, rapid escalation threat, multi-tier fire",
        "Fixed foam deluge activated by operator",
        "Escalating process fire impinging directly on pressurized light hydrocarbon line.",
        "SIF-potential", "BARRIER_FAILED", "CDU Pump Area"
    ),
    (
        "fire expanding into unit 2 cant put out with portable foam need fire brigade now",
        "Fire & Explosion", "Critical", 90,
        "Handheld extinguishing barriers completely overwhelmed, fire encroaching into adjacent operational unit",
        "Plant fire brigade dispatched",
        "Urgent operational report of uncontained propagating fire that has breached initial response barriers.",
        "SIF-potential", "BARRIER_FAILED", "Unit 2 Border"
    ),
    (
        "Uncontained burning gasoline pool fire spreading along drainage canal towards process wastewater separators.",
        "Fire & Explosion", "Critical", 89,
        "Running liquid pool fire, propagation along open drain network, vapor cloud ignition hazard",
        "Foam barrier laid at canal interceptor",
        "High-velocity spreading pool fire utilizing plant drainage system as propagation pathway.",
        "SIF-potential", "BARRIER_FAILED", "Drainage Canal 3"
    ),
    # Additional Realistic Gas & Toxic Leaks
    (
        "H2S alarm triggered at 85 ppm on amine regenerator overhead line, operators observed yellow sulfur staining and smelled strong gas.",
        "Gas Leak", "Critical", 90,
        "85 ppm H2S exceeds occupational ceiling (>10 ppm is hazardous, 100 ppm lethal), active leak",
        "Area evacuated, breathing apparatus donned",
        "Dangerous toxic gas concentration capable of causing pulmonary edema and knockdown within minutes.",
        "SIF-potential", "BARRIER_FAILED", "Amine Regeneration"
    ),
    (
        "High pressure methane gas leaking from corroded weld on separator gas outlet, loud whistling sound and gas cloud visible in sunlight.",
        "Gas Leak", "Critical", 88,
        "High pressure hydrocarbon release, visible gas density inversion, loud acoustic energy indicating high flow rate",
        "Unit depressurization started",
        "High-pressure flammable gas blowout with acute vapor cloud ignition and flash fire potential.",
        "SIF-potential", "BARRIER_FAILED", "Separator Skid"
    ),
    (
        "gas leak near furnace loud hissing flame detector blared warning",
        "Gas Leak", "Critical", 89,
        "Flammable gas release directly adjacent to open furnace firebox, immediate ignition source",
        "Automated slam-shut valve tripped",
        "High-risk proximity between major flammable gas release and active process ignition source.",
        "SIF-potential", "BARRIER_FAILED", "Furnace F-101"
    ),
    # Chemical & Oil Spills (Varying Scales)
    (
        "5000-liter hot caustic soda tank drained into open roadway after operator opened wrong manual drain valve without permit.",
        "Chemical Spill", "Serious", 83,
        "Massive chemical volume, corrosive hot caustic liquid, uncontained pedestrian roadway flooding",
        "Neutralization team dispatched with acid wash",
        "High-volume toxic chemical spill on roadway presenting severe chemical burn hazard to plant workers.",
        "SIF-potential", "BARRIER_BYPASSED", "Water Treatment Plant"
    ),
    (
        "Minor hydraulic oil drip of 100ml from forklift steering ram onto asphalt parking lot, absorbed with sawdust immediately.",
        "Chemical Spill", "Low", 15,
        "Small 100ml volume",
        "Non-hazardous lubricant, absorbed immediately with sawdust, parking lot area",
        "Localized minor hydraulic seep without operational hazard or environmental breach.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Forklift Parking"
    ),
    (
        "lube oil drip 50ml under turbine bearing caught in pan all clean",
        "Chemical Spill", "Low", 14,
        "50ml oil seep",
        "Captured fully in pan, zero contact with hot steam lines, wiped clean",
        "Trivial oil weeping collected in engineered capture pan with zero escalation risk.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Turbine Hall"
    ),
    # Work at Height & Falling Objects
    (
        "Scaffolder dropped 12kg steel coupler from 18m height, coupler crashed through corrugated roof 1 meter from technician.",
        "Work at Height", "Critical", 89,
        "18 meter drop height, heavy steel object, lethal impact kinetic energy (> 2000 Joules), near-miss with worker",
        "Technician stepped away seconds prior",
        "Critical dropped object precursor where kinetic energy was far in excess of fatal head trauma threshold.",
        "SIF-potential", "BARRIER_MISSING", "Scaffold Overhaul Plot"
    ),
    (
        "Contractor working on pipe bridge 12 meters above ground with harness worn but lanyard dangling unattached.",
        "Work at Height", "Serious", 82,
        "12m fatal fall height, fall arrest harness unanchored",
        "Solid grating platform underfoot",
        "Severe procedural violation at fatal elevation; zero fall protection active in event of trip.",
        "SIF-potential", "BARRIER_MISSING", "Pipe Bridge East"
    ),
    (
        "small tool sliped from hand fell 1 meter onto soft soil no one around",
        "Work at Height", "Low", 15,
        "1 meter low drop",
        "Soft soil, zero personnel below, low kinetic energy",
        "Low-energy dropped tool at knee height without injury consequence.",
        "Non-SIF-potential", "BARRIER_INSUFFICIENT_INFO", "Ground Trench"
    ),
    # Electrical Hazards
    (
        "Technician opened energized 6.6kV switchgear cubicle after testing interlock had been defeated with mechanical override key.",
        "Electrical / Arc Flash", "Critical", 92,
        "6,600 Volts energized busbar, interlock safety barrier deliberately defeated, direct physical access",
        "Technician realized before touching busbar and withdrew",
        "Critical SIF precursor: defeated barrier allowing direct physical access to high-voltage live conductors.",
        "SIF-potential", "BARRIER_BYPASSED", "Substation 3"
    ),
    (
        "Extension cord with cracked outer insulation used to power portable 110V inspection lamp on dry concrete floor.",
        "Electrical / Arc Flash", "Moderate", 35,
        "Degraded cord insulation",
        "110V reduced voltage system, dry environment, ground fault circuit interrupter (GFCI) active",
        "Damaged insulation on portable cord mitigated by GFCI and dry operating environment.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Maintenance Shed"
    ),
    # Machine Guarding & Mechanical
    (
        "Conveyor belt tail pulley nip point guard missing while workers actively shovel spilled sulfur 30cm from rotating drum.",
        "Equipment Failure", "Serious", 80,
        "Unshielded rotating pinch point, workers in direct line of fire (<30cm), high kinetic entrapment hazard",
        "Worker stepped back when warned",
        "Acute machinery entrapment hazard with potential for catastrophic limb amputation or crushing.",
        "SIF-potential", "BARRIER_MISSING", "Sulfur Pastillation Plant"
    ),
    (
        "Plastic safety cover loose on small electric water cooler motor in administration break room.",
        "Equipment Failure", "Low", 12,
        "Loose cosmetic cover",
        "Fractional horsepower small domestic appliance, low torque, office setting",
        "Negligible mechanical hazard on small low-power office appliance.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Break Room"
    ),
    # Additional Industrial Refinery Scenarios
    (
        "distillation colum boiler blew out fire spread to main piperack emergency horn sounded",
        "Fire & Explosion", "Critical", 93,
        "Boiler blowout, fire spreading to main piperack carrying hydrocarbons, emergency alarm",
        "Plant emergency horn sounded, operators evacuating",
        "Catastrophic boiler failure with spreading fire along vital piperack infrastructure.",
        "SIF-potential", "BARRIER_FAILED", "Distillation Unit"
    ),
    (
        "cdu pump p-104 mechanical seal ruptured spraying hot naphtha burning across deck",
        "Fire & Explosion", "Critical", 91,
        "Mechanical seal rupture, hot naphtha liquid spray, active burning pool on deck",
        "Remote ESD valve activated",
        "High-temperature volatile hydrocarbon seal blowout creating spreading surface fire.",
        "SIF-potential", "BARRIER_FAILED", "CDU Pump Plot"
    ),
    (
        "blast in reformer heater tube fire spreading rapidly emergency shutdown",
        "Fire & Explosion", "Critical", 92,
        "Heater tube rupture, rapid fire expansion, heater structural damage",
        "Emergency shutdown activated",
        "Reformer furnace explosion with spreading fire posing acute structural failure risk.",
        "SIF-potential", "BARRIER_FAILED", "Reformer Heater"
    ),
    (
        "heavy explosion at gas compressor room roof collapsed two workers trapped inside",
        "Fire & Explosion", "Critical", 97,
        "Structural roof collapse, workers trapped inside high-energy gas zone, blast destruction",
        "Rescue team mobilizing",
        "Catastrophic compressor room blast with trapped personnel in life-threatening condition.",
        "SIF-potential", "BARRIER_FAILED", "Compressor House 1"
    ),
    (
        "flash fire and explosion in fuel oil tank farm massive black smoke spreading toward unit",
        "Fire & Explosion", "Critical", 94,
        "Flash fire, tank farm explosion, massive propagating smoke plume and radiant heat",
        "Foam monitor system actuated",
        "Tank farm explosion with acute escalation potential across multi-tank storage inventory.",
        "SIF-potential", "BARRIER_FAILED", "Fuel Oil Tank Farm"
    ),
    (
        "propane accumulator vessel ruptured blast wave shattered office doors 100 meters away",
        "Fire & Explosion", "Critical", 95,
        "High-pressure propane vessel rupture, blast overpressure wave extending 100m",
        "Unit automatically tripped",
        "Catastrophic BLEVE / vessel burst with supersonic overpressure wave impacting distant structures.",
        "SIF-potential", "BARRIER_FAILED", "Gas Plant Plot"
    ),
    (
        "flames leaped 15m from cracked flange on hot crude line heading for piperack",
        "Fire & Explosion", "Critical", 91,
        "15-meter flame jet, cracked flange under pressure, heading for main piperack",
        "Fire monitor water screen deployed",
        "Major high-pressure crude jet fire directly impinging on critical piperack structure.",
        "SIF-potential", "BARRIER_FAILED", "Crude Unit Piperack"
    ),
    (
        "tank 304 overfilled gasoline overflow ignited major fire spreading across bund",
        "Fire & Explosion", "Critical", 93,
        "Loss of primary containment, ignited gasoline pool spreading across large bund wall",
        "Bund containment wall intact, foam deluge activated",
        "Major spreading storage tank bund fire with extreme thermal radiation and boilover risk.",
        "SIF-potential", "BARRIER_FAILED", "Tank 304"
    ),
    # Additional Controlled Fires & Contained Spills
    (
        "hot work spark landed on wet rag and was extinguished with water cup immediately by fire watch",
        "Fire & Explosion", "Low", 18,
        "Single spark on wet rag",
        "Fire watch present, quenched instantly with water cup, zero flame established, zero damage",
        "Standard hot work mitigation; single spark extinguished on contact with water cup.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Boiler Platform"
    ),
    (
        "small trash fire in smoking shelter extinguished with garden hose in 20 sec completely cold",
        "Fire & Explosion", "Low", 22,
        "Smoking shelter trash can ignition",
        "Hose deployed immediately, extinguished in 20 seconds, cold to touch, isolated area",
        "Minor localized trash container ignition put out rapidly with water hose.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Smoking Shelter"
    ),
    (
        "small controlled test burn of oil sample in laboratory fume hood according to astm standard",
        "Fire & Explosion", "Low", 15,
        "Laboratory analytical test burn",
        "Engineered fume hood ventilation, controlled quantity (10ml), fire extinguisher present",
        "Planned laboratory analytical test carried out within engineered containment.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Quality Control Lab"
    ),
    (
        "welder torch backfired small pop quenched in water bath by welder zero fire",
        "Fire & Explosion", "Low", 16,
        "Torch backfire pop",
        "Quenched in water bath instantly, flashback arrestor intact, zero flame spread",
        "Minor torch pop safely quenched in dedicated water bath; safety devices functioned.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Structural Workshop"
    ),
    (
        "pilot burner flame extinguished then reignited automatically on flare tip within safe parameters",
        "Fire & Explosion", "Low", 20,
        "Flare pilot reignition cycle",
        "Engineered auto-ignition spark system worked, safe flare tip enclosure, continuous purge",
        "Normal automated flare pilot re-ignition sequence within safe operational envelope.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Refinery Flare Tip"
    ),
    (
        "minor drip of 50ml hydraulic oil on floor wiped with cotton rag during filter swap",
        "Chemical Spill", "Low", 14,
        "50ml oil drip",
        "Wiped with rag immediately, floor dry, filter swapped cleanly",
        "Routine filter change minor fluid drip cleaned up immediately without residue.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Hydraulic Skid"
    ),
    (
        "30ml compressor oil weep captured in drip pan under pump bearing zero leak on concrete",
        "Chemical Spill", "Low", 12,
        "30ml minor weep",
        "Captured 100% in dedicated drip pan, zero ground contact, pump operating normal",
        "Trivial bearing weep fully collected in engineered pan; zero escalation pathway.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Compressor Building"
    ),
    (
        "minor glycol weep of 100ml in utility skid contained on concrete pad wiped with absorbant",
        "Chemical Spill", "Low", 15,
        "100ml glycol weep",
        "Captured on concrete pad, wiped with absorbent pad, non-flammable cooling fluid",
        "Small non-hazardous glycol weep contained and cleaned with absorbent pads.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Chiller Skid"
    ),
    (
        "drop of diesel on concrete driveway wiped dry with paper towel by driver",
        "Chemical Spill", "Low", 10,
        "Isolated diesel drop",
        "Wiped dry with paper towel immediately, zero puddle, zero fire hazard",
        "Trivial vehicle fuel droplet cleaned with towel; negligible consequence potential.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Vehicle Gate"
    ),
    (
        "sampling valve wept 40ml gasoline into closed recovery pot zero fumes in air",
        "Chemical Spill", "Low", 16,
        "40ml sampling weep",
        "Closed loop recovery pot captured liquid, zero atmospheric release, valve closed",
        "Engineered closed-loop sampling pot captured valve weeping without vapor release.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Sample Station 4"
    ),
    # Additional Negative Examples (Keywords present, no incident)
    (
        "Reviewed Texas City refinery explosion video during mandatory safety induction for new contractor personnel.",
        "Safety Drill / Negative Context", "Low", 10,
        "Dangerous keywords 'refinery explosion', 'Texas City'",
        "Classroom video training, new hire safety orientation, zero operational hazard",
        "Mandatory educational training reviewing historical incident video in conference room.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Induction Center"
    ),
    (
        "Safety standdown meeting discussing vapor cloud explosion prevention held in central maintenance facility.",
        "Safety Drill / Negative Context", "Low", 10,
        "Dangerous keywords 'vapor cloud explosion'",
        "Educational administrative meeting, work paused for safety discussion, zero hazard",
        "Refinery safety stand-down communicating process safety principles to workforce.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Maintenance Hall"
    ),
    (
        "Conducted unannounced fire drill at crude unit to practice muster count and emergency siren response.",
        "Safety Drill / Negative Context", "Low", 15,
        "Dangerous keywords 'fire drill', 'crude unit', 'siren'",
        "Controlled simulation exercise, all personnel accounted for at muster point within 3 minutes",
        "Scheduled emergency drill validating muster accounting procedures with zero actual fire.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Crude Unit Muster Point"
    ),
    (
        "Tested fire pump P-501 emergency auto-start on simulated pressure drop, diesel engine started in 10 seconds.",
        "Safety Drill / Negative Context", "Low", 12,
        "Dangerous keywords 'fire pump', 'emergency'",
        "Routine weekly preventive test of backup fire water pump, safe testing loop",
        "Preventive functional test confirming firewater pump readiness under simulated trigger.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Fire Pump Station"
    ),
    (
        "Replaced foam concentrate bladder in fire station foam truck during scheduled quarterly preventive maintenance.",
        "Safety Drill / Negative Context", "Low", 10,
        "Dangerous keywords 'foam concentrate', 'fire station'",
        "Routine workshop equipment overhaul, foam truck out of service for planned 2 hours with backup available",
        "Routine preventive overhaul of mobile firefighting defense asset in vehicle workshop.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Refinery Fire Station"
    ),
    (
        "Hazard communication presentation on flammable gas leak detection held for operations shift B.",
        "Safety Drill / Negative Context", "Low", 10,
        "Dangerous keywords 'flammable gas leak'",
        "Classroom presentation, operations briefing room, zero operational field work",
        "Training presentation on gas monitoring instrumentation; no active plant release.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Shift Briefing Room"
    ),
    (
        "Inspected fire dampers and smoke detectors in central control building HVAC ductwork, all functioning properly.",
        "Safety Drill / Negative Context", "Low", 10,
        "Dangerous keywords 'fire dampers', 'smoke detectors'",
        "Routine HVAC maintenance inspection, all components passed functional test",
        "Routine inspection confirming passive fire protection barrier integrity in control building.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Central Control Building"
    ),
    (
        "Monthly audit of flammable gas detectors calibration across Unit 3 completed with zero instrument drift.",
        "Safety Drill / Negative Context", "Low", 10,
        "Dangerous keywords 'flammable gas detectors'",
        "Instrumentation maintenance audit, test calibration gas applied safely according to procedure",
        "Routine instrument calibration audit confirming fixed gas detection barrier accuracy.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Unit 3 Plot"
    ),
    (
        "Toolbox talk on chemical spill kit locations and emergency showers conducted before shift start.",
        "Safety Drill / Negative Context", "Low", 10,
        "Dangerous keywords 'chemical spill'",
        "Pre-shift safety briefing, zero chemicals handled during discussion",
        "Pre-shift worker communication on emergency shower and spill response readiness.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Control Room"
    ),
    (
        "Demonstrated dry chemical extinguisher operation to new apprentices on empty cylinder training prop.",
        "Safety Drill / Negative Context", "Low", 12,
        "Dangerous keywords 'dry chemical extinguisher'",
        "Training prop, cold demonstration, zero fire, qualified training officer leading",
        "Educational training session demonstrating fire extinguisher pin and horn operation.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Safety Yard"
    ),
    # Additional Serious & Moderate Precursors
    (
        "Worker climbing temporary vertical ladder without fall arrester sleeve attached at 14 meters elevation.",
        "Work at Height", "Serious", 83,
        "14m fatal fall potential, missing guided-type fall arrester sleeve, vertical ladder",
        "Worker was holding rungs with both hands",
        "Severe work at height violation: climbing uncaged 14m vertical ladder without fall arrest.",
        "SIF-potential", "BARRIER_MISSING", "Flare Knockout Drum"
    ),
    (
        "Hydraulic pressure line at 200 bar had swollen outer braid with wire threads snapping under pulsating load.",
        "Equipment Failure", "Serious", 81,
        "200 bar stored hydraulic pressure, imminent hose rupture, fluid injection hazard",
        "Technician observed defect and depressurized system before burst",
        "Imminent high-pressure line burst caught before lethal injection or projectile release.",
        "SIF-potential", "BARRIER_COMPROMISED", "Hydraulic Power Unit"
    ),
    (
        "Forklift tines punctured plastic chemical tote spilling 200 liters of 30% hydrochloric acid in delivery yard.",
        "Chemical Spill", "Serious", 82,
        "200L corrosive acid spill, dense acid fumes, open outdoor unbunded yard",
        "Yard evacuated, emergency response team deployed lime neutralizer",
        "Substantial uncontained corrosive acid release generating hazardous fumes across delivery yard.",
        "SIF-potential", "BARRIER_FAILED", "Chemical Delivery Bay"
    ),
    (
        "Electrician touched de-energized busbar without testing for absence of voltage with approved calibrated detector.",
        "Electrical / Arc Flash", "Serious", 79,
        "Procedural failure on high-voltage equipment, failure to verify zero energy",
        "Busbar was de-energized by upstream breaker; no electric shock occurred",
        "Life-critical electrical safety rule violation: contact with unverified conductors.",
        "SIF-potential", "BARRIER_BYPASSED", "Substation 4"
    ),
    (
        "Rigging sling chafed against sharp girder edge during 4-ton valve lift, two synthetic strands severed.",
        "Equipment Failure", "Serious", 80,
        "4,000 kg suspended mass, sling degradation under tension, sharp edge contact",
        "Lift stopped, load landed safely on wooden dunnage",
        "Critical rigging defect: damaged lifting sling supporting heavy overhead load.",
        "SIF-potential", "BARRIER_COMPROMISED", "Main Piperack Lift"
    ),
    (
        "Grinder threw sparks into oil-contaminated floor drain with missing cover in compressor house.",
        "Fire & Explosion", "Serious", 78,
        "Hot sparks entering oily vapor drain, missing mechanical drain cover, enclosed building",
        "Worker stopped grinding when supervisor intervened",
        "Dangerous interaction between active ignition sparks and flammable vapor drain pathway.",
        "SIF-potential", "BARRIER_MISSING", "Compressor Room"
    ),
    (
        "Compressor high-pressure discharge valve packing leaking sweet gas at 40 bar with loud hissing sound.",
        "Gas Leak", "Serious", 81,
        "40 bar sweet gas release, high continuous flow rate, potential for explosive atmosphere",
        "Area cordoned off, unit load reduced",
        "High-pressure gas release with significant volume escaping into operating compressor plot.",
        "SIF-potential", "BARRIER_FAILED", "Gas Booster Station"
    ),
    # Additional Vague / Missing Info
    (
        "Smell in the air near north fence during morning inspection.",
        "Vague / Insufficient Info", "Low", 18,
        "Unspecified odor, open boundary fence",
        "No toxic or flammable reading confirmed, no specific source",
        "Vague environmental observation lacking operational details or confirmed hazard.",
        "Non-SIF-potential", "BARRIER_INSUFFICIENT_INFO", "North Fence"
    ),
    (
        "Strange sound during shift handover on cooling water system.",
        "Vague / Insufficient Info", "Low", 17,
        "Acoustic anomaly",
        "Cooling water system non-hazardous, no pressure or temperature abnormality recorded",
        "Incomplete acoustic observation requiring field monitoring; indeterminate hazard.",
        "Non-SIF-potential", "BARRIER_INSUFFICIENT_INFO", "Cooling Water Unit"
    ),
    (
        "Something was leaking yesterday afternoon near pipe rack.",
        "Vague / Insufficient Info", "Low", 20,
        "Unverified past leak",
        "Fluid type unknown, pressure unknown, rate unknown, location unspecified",
        "Historical third-party observation with missing technical data; high uncertainty.",
        "Non-SIF-potential", "BARRIER_INSUFFICIENT_INFO", "Piperack General"
    ),
    (
        "Vibration on equipment noticed by technician.",
        "Vague / Insufficient Info", "Low", 15,
        "Unspecified mechanical vibration",
        "No equipment tag, no severity, no process impact stated",
        "Vague mechanical observation lacking equipment identifier or baseline deviation.",
        "Non-SIF-potential", "BARRIER_INSUFFICIENT_INFO", "Refinery Plot"
    ),
    (
        "Area needs inspection after rainstorm.",
        "Vague / Insufficient Info", "Low", 14,
        "Weather inspection request",
        "Zero incident or failure identified",
        "Routine housekeeping request post-weather event with zero active incident evidence.",
        "Non-SIF-potential", "BARRIER_INSUFFICIENT_INFO", "Outdoor Areas"
    )
]

for item in expanded_variations:
    add_record(*item)

# ------------------------------------------------------------------------------
# 10. EXPANDED MODERATE, SERIOUS, WORKER VERNACULAR & NEGATIVE CONTROLS
# ------------------------------------------------------------------------------
try:
    from .additional_incidents import (
        additional_moderate_hazards,
        additional_serious_hazards,
        additional_worker_vernacular,
        additional_negative_controls
    )
except (ImportError, ValueError):
    try:
        from additional_incidents import (
            additional_moderate_hazards,
            additional_serious_hazards,
            additional_worker_vernacular,
            additional_negative_controls
        )
    except ImportError:
        from training_data.additional_incidents import (
            additional_moderate_hazards,
            additional_serious_hazards,
            additional_worker_vernacular,
            additional_negative_controls
        )

for item in (additional_moderate_hazards + additional_serious_hazards + additional_worker_vernacular + additional_negative_controls):
    add_record(*item)

# Build DataFrame
df = pd.DataFrame(records)
print(f"Total structured incident records generated: {len(df)}")
print("Class distribution:")
print(df["sif_potential"].value_counts())
print("\nSeverity distribution:")
print(df["severity_level"].value_counts())

# Ensure output directory exists
out_dir = Path("training_data")
out_dir.mkdir(parents=True, exist_ok=True)
proc_dir = out_dir / "processed"
proc_dir.mkdir(parents=True, exist_ok=True)

# Save Master Dataset
master_csv = out_dir / "industrial_refinery_incidents.csv"
proc_csv = proc_dir / "refinery_incident_dataset.csv"
df.to_csv(master_csv, index=False)
df.to_csv(proc_csv, index=False)
print(f"Saved master dataset to: {master_csv} and {proc_csv}")

# Perform Stratified Train / Val / Test Split (70% Train, 15% Val, 15% Test)
# Stratify by severity_level to ensure balanced representation across all 4 severity tiers
train_df, temp_df = train_test_split(
    df,
    test_size=0.30,
    random_state=SEED,
    stratify=df["severity_level"]
)

val_df, test_df = train_test_split(
    temp_df,
    test_size=0.50,
    random_state=SEED,
    stratify=temp_df["severity_level"]
)

train_csv = out_dir / "train.csv"
val_csv = out_dir / "val.csv"
test_csv = out_dir / "test.csv"

train_df.to_csv(train_csv, index=False)
val_df.to_csv(val_csv, index=False)
test_df.to_csv(test_csv, index=False)

print(f"Stratified Splits Saved:")
print(f"  Train: {len(train_df)} rows ({train_csv})")
print(f"  Val:   {len(val_df)} rows ({val_csv})")
print(f"  Test:  {len(test_df)} rows ({test_csv})")
