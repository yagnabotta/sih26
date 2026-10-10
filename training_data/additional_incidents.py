"""
Additional Expert-Curated Industrial & Refinery Incident Records
================================================================
Expands the dataset to provide rich coverage for:
- Moderate risk scenarios (30-69)
- Serious hazards with high potential (70-85)
- Worker colloquial vernacular with typos and informal wording
- Negative controls with dangerous keywords in benign/administrative contexts
"""

additional_moderate_hazards = [
    (
        "Packing gland on boiler feedwater pump leaking hot water at 60C onto floor drain, pump operating within vibration tolerances.",
        "Equipment Failure", "Moderate", 35,
        "Thermal water release, minor slip hazard on floor",
        "Floor drain captured runoff, water non-hazardous, pump mechanically stable",
        "Low-consequence utility packing weep draining safely to floor sump without process threat.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Boiler Feedwater Skid"
    ),
    (
        "Centrifugal pump motor tripped on thermal overload relay after 8 hours continuous run, no smoke or physical damage.",
        "Equipment Failure", "Moderate", 38,
        "Motor thermal trip, duty interruption",
        "Thermal protective relay functioned properly, zero overheating damage, standby pump took over",
        "Electrical protection barrier operated as designed; no damage or personnel hazard.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Effluent Treatment Plant"
    ),
    (
        "Steam trap on low-pressure heating line failed open, blowing 3-bar steam to atmospheric condensate receiver.",
        "Equipment Failure", "Moderate", 42,
        "Low-pressure steam vent, localized noise and vapor plume",
        "Discharged into engineered receiver, ambient atmospheric area, no personnel in blast zone",
        "Utility steam trap failure discharging to designated collection vessel with low consequence.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Utility Piperack"
    ),
    (
        "Conveyor belt in sulfur loading shed developed minor edge tracking misalignment, rubbing against stationary guide roller.",
        "Equipment Failure", "Moderate", 45,
        "Mechanical friction, sulfur dust environment",
        "Belt stopped by alignment limit switch, roller temperature checked normal, zero smoke",
        "Automated misalignment sensor prevented friction heating in combustible dust area.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Sulfur Pastillation Shed"
    ),
    (
        "Pressure gauge glass cracked on cooling water return header, no fluid leakage observed.",
        "Equipment Failure", "Moderate", 32,
        "Degraded instrument casing",
        "Bourdon tube intact, zero fluid escape, low-pressure cooling water line",
        "Superficial gauge glass defect without loss of primary pressure containment.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Cooling Tower Area"
    ),
    (
        "Air compressor unloader valve sticking intermittently causing minor discharge pressure oscillations between 6 and 7.5 bar.",
        "Equipment Failure", "Moderate", 36,
        "Pneumatic pressure oscillation",
        "Operating well below design limit of 10 bar, safety relief valve set at 9.5 bar intact",
        "Pneumatic unloader anomaly contained within normal operating design envelope.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Utility Air Compressor Skid"
    ),
    (
        "Mechanical seal oil reservoir sight glass cloudy and low by 20%, secondary barrier intact.",
        "Equipment Failure", "Moderate", 40,
        "Barrier fluid depletion",
        "Primary and secondary seal faces intact, zero external leakage, topped up during shift",
        "Auxiliary barrier fluid monitoring caught weep prior to mechanical seal degradation.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Crude Unit Pump Bay"
    ),
    (
        "Low pressure fuel gas piping flange weeping small bubbles during routine soapy water leak test at 0.5 bar, no odor detected outside 1 meter.",
        "Gas Leak", "Moderate", 44,
        "Micro-leak on flammable fuel gas line",
        "Very low operating pressure (0.5 bar), well-ventilated outdoor rack, zero detectable vapor cloud",
        "Fugitive flange weep caught during routine soap inspection below hazardous threshold.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Offsites Fuel Gas Skid"
    ),
    (
        "Instrument air tube fitting loose on control valve actuator, leaking 6-bar dry compressed air with audible hiss.",
        "Gas Leak", "Moderate", 32,
        "Audible air hiss, valve sluggishness",
        "Inert non-toxic non-flammable instrument air, fitting tightened on line with wrench",
        "Utility compressed air leak with zero toxicity, flammability, or structural impact.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Control Valve Manifold"
    ),
    (
        "Minor low-pressure methane seep of 50 ppm detected at sample valve bonnet during fugitive emissions survey, well below LEL.",
        "Gas Leak", "Moderate", 42,
        "Fugitive hydrocarbon emission",
        "Concentration 50 ppm (LEL is 50,000 ppm), open-air location, no ignition sources",
        "Fugitive emission detected by optical imaging survey; orders of magnitude below lower explosive limit.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Gas Processing Skid"
    ),
    (
        "Nitrogen blanketing regulator on slop tank weeping slightly at vent port into well-ventilated outdoor atmosphere.",
        "Gas Leak", "Moderate", 38,
        "Inert gas venting",
        "Outdoor open deck, zero asphyxiation risk in open air, tank blanketing pressure maintained",
        "Minor nitrogen regulator weep into well-ventilated outdoor atmosphere without asphyxiation pocket.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Slop Oil Tank"
    ),
    (
        "Slight natural gas smell detected near meter skid outdoors, handheld detector registered 4% LEL at 10cm from flange.",
        "Gas Leak", "Moderate", 48,
        "Localized flammable gas odor",
        "4% LEL is well below 10% action threshold and 100% explosive limit, well-ventilated outdoor skid",
        "Localized minor gas weep below actionable safety threshold; tightened during shift.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Gas Metering Station"
    ),
    (
        "Drum pump transfer hose clamp loosened, leaking approximately 15 liters of dilute caustic soda solution (5%) into dedicated concrete sump.",
        "Chemical Spill", "Moderate", 46,
        "Corrosive chemical release, 15L volume",
        "Low concentration (5%), fully contained in concrete sump, neutralizing agent applied immediately",
        "Contained low-concentration chemical release with complete engineered sump capture.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Water Treatment Bay"
    ),
    (
        "Coolant expansion tank overflowed 20 liters of ethylene glycol mixture into concrete equipment pad during chiller maintenance.",
        "Chemical Spill", "Moderate", 40,
        "20L chemical spill, slip hazard",
        "Non-flammable aqueous mixture, contained on bunded pad, recovered with wet vacuum",
        "Equipment pad containment prevented soil ingress; fluid recovered with wet vacuum.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Chiller Building Pad"
    ),
    (
        "Diesel fuel transfer nozzle dripped approximately 8 liters into gravel containment berm while refueling mobile air compressor.",
        "Chemical Spill", "Moderate", 44,
        "Combustible fuel release onto ground",
        "Engineered gravel containment berm caught spill, absorbent pads deployed, ignition sources isolated",
        "Localized fuel spill inside designed containment berm with prompt absorbent deployment.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Contractor Laydown Yard"
    ),
    (
        "Minor corrosion weep on sulfuric acid sampling line flange wrapped with pH indicator cloth showing localized pink spot, no free droplets.",
        "Chemical Spill", "Moderate", 52,
        "Corrosive acid weep indicator",
        "Indicator cloth caught weep prior to free droplet formation, line depressurized for gasket swap",
        "Proactive indicator barrier identified pinhole weep before acid spray or droplet discharge.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Alkylation Acid Area"
    ),
    (
        "Lube oil filter housing drain plug seeped 3 liters of turbine oil into machinery tray during filter cartridge replacement.",
        "Chemical Spill", "Moderate", 36,
        "3L lube oil release",
        "Captured 100% in machinery drip tray, wiped with pads, zero hot pipe contact",
        "Routine maintenance drip captured fully within equipment collection pan.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Turbine Hall Basement"
    ),
    (
        "Operator tripped over low pipe conduit in well-lit walkway and sustained superficial scrape on right shin, treated at first aid station.",
        "Personal Injury", "Moderate", 34,
        "Pedestrian trip obstacle, skin abrasion",
        "Same-level walk, good illumination, first-aid treatment only, pipe tagged for high-visibility marking",
        "Low-energy trip on level surface resulting in minor abrasion without structural or kinetic hazard.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Crude Unit Walkway"
    ),
    (
        "Maintenance technician pinched index finger between wrench and valve handwheel flange, minor blood blister, returned to work.",
        "Personal Injury", "Moderate", 32,
        "Mechanical pinch point, minor contusion",
        "Manual tool application, safety gloves worn mitigating trauma, zero fracture",
        "Low-force pinch incident mitigated by leather work gloves; non-disabling minor contusion.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Valve Manifold Deck"
    ),
    (
        "Warehouse worker twisted left ankle while stepping down from 20cm concrete dock curb, no fracture confirmed on clinic X-ray.",
        "Personal Injury", "Moderate", 36,
        "Low curb step down, soft tissue strain",
        "20cm step height, steel-toe ankle-support boots worn, cold pack applied",
        "Low-elevation misstep resulting in sprain without high kinetic energy or fall exposure.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Warehouse Loading Dock"
    ),
    (
        "Welder sustained minor first-degree flash burn to neck skin through gap between collar and welding helmet.",
        "Personal Injury", "Moderate", 38,
        "UV radiation exposure to neck",
        "First-degree superficial redness, soothing gel applied, collar shroud added to PPE",
        "Minor superficial UV exposure without deep thermal tissue damage or open flame.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Fabrication Bay"
    ),
    (
        "Operator bumped shoulder against unpadded low pipe hanger in piperack crawl space while wearing hard hat and safety vest.",
        "Personal Injury", "Moderate", 30,
        "Low clearance overhead obstacle",
        "PPE worn, walking pace, minor superficial bruise, foam padding installed on hanger",
        "Low-velocity contact in restricted space without high energy or fall potential.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Piperack Ground Corridor"
    ),
    (
        "240V lighting circuit breaker tripped in field substation due to moisture ingress in outdoor luminaire junction box.",
        "Electrical / Arc Flash", "Moderate", 36,
        "Moisture in electrical junction, circuit outage",
        "Breaker tripped instantly on ground fault, enclosure contained fault, zero arc flash",
        "Standard protective tripping mechanism functioned properly on low-voltage lighting branch.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Substation 01 Yard"
    ),
    (
        "Small scorch mark observed on 24V DC terminal block inside instrument junction box due to loose screw connection.",
        "Electrical / Arc Flash", "Moderate", 38,
        "Loose terminal heating, minor scorched plastic",
        "Extra-low voltage 24V DC, intrinsically safe circuit, zero flammable gas present",
        "Low-energy thermal degradation on 24V instrument wire without arc flash capability.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Instrument Rack Unit 2"
    ),
    (
        "Temporary 110V power extension lead found routed across metal grating without protective rubber cable crossover bridge.",
        "Electrical / Arc Flash", "Moderate", 42,
        "Substandard cable routing over grating",
        "Heavy-duty double-insulated industrial cable, GFCI breaker protecting feed, cable undamaged",
        "Procedural routing defect mitigated by GFCI protection and intact double insulation.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Scaffold Deck Level 1"
    ),
    (
        "Electrician found emergency stop button contact block loose inside field control station, stop function sluggish.",
        "Electrical / Arc Flash", "Moderate", 48,
        "Degraded safety instrumented switch contact",
        "System had redundant soft stop on DCS console, contact re-torqued and tested immediately",
        "Control switch mechanical degradation caught during routine functional testing.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Compressor Local Panel"
    ),
    (
        "Scaffold toe board displaced by 50mm on 2-meter working platform in mechanical workshop, creating small opening.",
        "Work at Height", "Moderate", 38,
        "Small gap in toe board barrier, potential tool drop",
        "Low platform height (2m), workshop floor barricaded below, toe board re-clamped",
        "Minor architectural toe-board displacement on low platform with zero personnel exposed below.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Workshop Bay 2"
    ),
    (
        "Worker stepped onto scaffold plank that had minor 5mm flex, platform stable with double handrails intact.",
        "Work at Height", "Moderate", 35,
        "Plank deflection under foot",
        "Plank within permissible deflection limits, double handrails and midrails secure",
        "Minor scaffold board bounce without structural degradation or fall exposure.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Column Access Scaffold"
    ),
    (
        "Safety harness lanyard inspection tag faded and illegible, harness retired from service during daily pre-use check.",
        "Work at Height", "Moderate", 32,
        "Administrative tagging defect on PPE",
        "Harness webbing physically intact, worker replaced harness with new tagged unit before climbing",
        "Pre-use inspection protocol successfully intercepted substandard documentation before use.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Tool Crib"
    ),
    (
        "Temporary ladder secured with single tie wire instead of standard two rope lashings at top of 2.5m platform.",
        "Work at Height", "Moderate", 46,
        "Substandard top ladder restraint",
        "Ladder base on level concrete with non-skid feet, tied off with second lashing immediately",
        "Incomplete ladder securing mitigated by level foundation and prompt remediation.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Platform Access Stair"
    ),
    (
        "Steam pipe thermal insulation cladding smoldered locally after light oil drip soaked into mineral wool, extinguished with 2 liters water.",
        "Fire & Explosion", "Moderate", 50,
        "Insulation smoldering from oil soak",
        "Localized to 10cm section, extinguished promptly with water, cladding stripped and line cleaned",
        "Slow smolder in pipe lagging extinguished immediately before open flame established.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Steam Manifold"
    ),
    (
        "Friction between loose drive belt and pump guard produced smoke and small 5cm glow, motor shut down immediately, extinguished with CO2.",
        "Fire & Explosion", "Moderate", 54,
        "Belt friction glow, localized smoke",
        "Motor shut down on DCS trip, CO2 applied in seconds, guard and belt replaced",
        "Localized mechanical friction hot spot contained and extinguished without propagation.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Cooling Water Pump Skid"
    ),
    (
        "Grinding spark ignited dry grass outside boundary fence 30 meters from process unit, stamped out immediately by fire watch.",
        "Fire & Explosion", "Moderate", 44,
        "Open spark ignition of dry vegetation",
        "30 meters outside unit boundary, dedicated fire watch stamped out in 10 seconds with water spray",
        "Peripheral grass spark extinguished immediately by dedicated hot work fire watch.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Refinery Perimeter Fence"
    ),
    (
        "Diesel exhaust soot puff flashed momentarily inside muffler tailpipe during emergency generator startup test, self-extinguished instantly.",
        "Fire & Explosion", "Moderate", 42,
        "Internal exhaust spark flash",
        "Fully contained inside heavy steel exhaust silencer, flame arrestor in line, zero exterior ignition",
        "Internal generator exhaust puff contained entirely inside heavy steel silencer duct.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Emergency Power House"
    )
]

additional_serious_hazards = [
    (
        "Sour gas line sample tap valve packing failed, releasing H2S gas at 35 ppm into compressor deck, area beacon activated.",
        "Gas Leak", "Serious", 82,
        "H2S concentration 35 ppm (IDLH is 100 ppm), toxic atmospheric hazard, active release",
        "Fixed gas beacon energized, operators donned SCBA and isolated upstream manual block",
        "Significant toxic gas release exceeding permissible exposure limits with acute inhalation risk.",
        "SIF-potential", "BARRIER_FAILED", "Sour Gas Compressor Deck"
    ),
    (
        "LPG cylinder filling hose developed bulge and pinhole leak venting liquid propane plume near tanker loading bay.",
        "Gas Leak", "Serious", 84,
        "Pressurized LPG release, rapid vaporization, flammable vapor cloud near vehicle transit",
        "Automated pneumatic slam-shut valve tripped by operator, water fog deployed",
        "Severe flammable gas leak with acute vapor cloud ignition and flash fire potential.",
        "SIF-potential", "BARRIER_FAILED", "LPG Loading Bay"
    ),
    (
        "Refrigeration ammonia line flange gasket weeping sharp pungent vapor at 45 ppm near refrigeration compressor plant.",
        "Gas Leak", "Serious", 80,
        "Toxic ammonia gas release, respiratory irritant, potential for corrosive eye damage",
        "Emergency ventilation initiated, operators donned full-face respirators, flange clamped",
        "Toxic chemical gas release in operating building requiring respiratory barrier deployment.",
        "SIF-potential", "BARRIER_FAILED", "Ammonia Chiller Plant"
    ),
    (
        "Corroded 2-inch sweet gas relief line discharging 15-bar methane gas continuously through open vent pipe directly above walkway.",
        "Gas Leak", "Serious", 83,
        "15 bar flammable gas jet, discharge directly above personnel access walkway",
        "Area cordoned off, process unit rate curtailed, vent redirected",
        "High-pressure flammable gas release impinging on pedestrian transit pathway.",
        "SIF-potential", "BARRIER_FAILED", "Gas Recovery Skid"
    ),
    (
        "Unloading hose disconnected prematurely during caustic soda road tanker transfer, releasing 300 liters of 50% sodium hydroxide.",
        "Chemical Spill", "Serious", 82,
        "300L highly corrosive chemical release, open concrete apron, worker proximity",
        "Emergency shower used by driver, neutralizing acid wash applied by spill team",
        "Substantial corrosive liquid release with severe chemical burn potential to transfer operators.",
        "SIF-potential", "BARRIER_FAILED", "Chemical Offloading Rack"
    ),
    (
        "Operator splashed on chest and face shield with warm amine solution at 60C when bleed valve purged without diffuser tube.",
        "Chemical Spill", "Serious", 81,
        "Hot corrosive chemical release under pressure, direct line-of-fire spray on operator",
        "Operator was wearing chemical face shield and PVC apron preventing skin contact, flushed at eyewash",
        "High-energy chemical line-of-fire release where PPE barrier prevented life-altering burn injury.",
        "SIF-potential", "BARRIER_BYPASSED", "Amine Treater Unit"
    ),
    (
        "Methanol storage tank sight glass fractured, leaking continuous stream of flammable methanol at 20 liters/minute onto gravel.",
        "Chemical Spill", "Serious", 84,
        "Volatile flammable toxic chemical release, continuous flow, uncontained gravel pool",
        "Manual tank root valve closed with long reach wrench, aqueous foam laid over pool",
        "Significant loss of primary containment involving volatile flammable solvent with vapor fire hazard.",
        "SIF-potential", "BARRIER_FAILED", "Methanol Day Storage"
    ),
    (
        "Sulfuric acid dosing pump diaphragm ruptured, spraying concentrated 98% acid inside pump enclosure with acid dripping onto doorway.",
        "Chemical Spill", "Serious", 83,
        "Concentrated 98% sulfuric acid, pressurized spray, exit pathway obstructed by acid dripping",
        "Enclosure door interlock cut pump power, lime neutralizer deployed",
        "Pressurized concentrated acid spray creating severe corrosive injury hazard.",
        "SIF-potential", "BARRIER_FAILED", "Demineralization Plant"
    ),
    (
        "Pre-use inspection of 20-ton mobile crane hoist wire rope revealed 5 broken exterior wire strands and severe bird-caging near hook.",
        "Equipment Failure", "Serious", 82,
        "Imminent wire rope failure, 20-ton lifting capacity, heavy industrial turnaround environment",
        "Inspection detected flaw before hook was attached to 14-ton heat exchanger bundle",
        "Critical lifting gear barrier degradation caught just prior to heavy overhead lift.",
        "SIF-potential", "BARRIER_COMPROMISED", "Turnaround Rigging Bay"
    ),
    (
        "Emergency diesel firewater pump fuel throttle actuator stuck in overspeed condition during monthly full-flow churn test.",
        "Equipment Failure", "Serious", 80,
        "Overspeed mechanical runaway, potential engine flywheel fragmentation, primary fire protection compromised",
        "Manual emergency air shutoff damper tripped by technician",
        "Critical safety defense asset runaway caught prior to mechanical disintegration.",
        "SIF-potential", "BARRIER_COMPROMISED", "Firewater Pump House"
    ),
    (
        "Centrifugal crude oil booster pump vibrating at 22 mm/s with bearing housing reaching 115C, approaching catastrophic seizure.",
        "Equipment Failure", "Serious", 83,
        "Extreme vibration exceeding trip limits, high thermal friction, pressurized hot hydrocarbon fluid",
        "Operator executed emergency stop before shaft sheared or mechanical seal ruptured",
        "Near-catastrophic mechanical breakdown on high-energy hydrocarbon pump intercepted in extremis.",
        "SIF-potential", "BARRIER_COMPROMISED", "Crude Booster Station"
    ),
    (
        "Hydraulic cherry picker boom cylinder began creeping down 50cm uncommanded while worker was elevated in basket at 14m.",
        "Equipment Failure", "Serious", 84,
        "14m elevation, uncommanded descent, internal hydraulic seal bypass in primary holding cylinder",
        "Worker lowered boom using manual ground controls and exited safely",
        "Major failure of load-holding hydraulic barrier supporting personnel at fatal height.",
        "SIF-potential", "BARRIER_FAILED", "Tank Farm Maintenance Plot"
    ),
    (
        "Overhead traveling crane pendant cable insulation damaged with exposed live 110V control conductors dangling near operator hands.",
        "Equipment Failure", "Serious", 78,
        "Exposed live electrical conductor on handheld pendant control, operator contact hazard",
        "Crane main isolator pulled before shock occurred",
        "Degraded electrical control barrier on heavy machinery presenting direct shock hazard.",
        "SIF-potential", "BARRIER_COMPROMISED", "Heavy Machine Shop"
    ),
    (
        "Rigger hand caught between heavy 8-inch steel pipe spool and dunnage beam when load shifted, resulting in compound finger fracture.",
        "Personal Injury", "Serious", 80,
        "Heavy pipe spool crushing force, load shift during landing, permanent bone fracture",
        "Tag line in use, other riggers stayed clear, emergency first response dispatched",
        "High-energy pinch point resulting in severe orthopedic crushing trauma.",
        "SIF-potential", "BARRIER_FAILED", "Pipe Fabrication Yard"
    ),
    (
        "Operator descended dark access ladder during power dip, missed bottom two rungs and fell 1.5m to concrete, fracturing right wrist.",
        "Personal Injury", "Serious", 76,
        "Loss of lighting, 1.5m fall to hard concrete, fracture of limb",
        "Worker was holding side stanchion which slowed descent, fellow operator rendered assistance",
        "Fall from ladder in degraded visibility resulting in significant disabling bone fracture.",
        "SIF-potential", "BARRIER_FAILED", "Offsites Manifold Pit"
    ),
    (
        "Machinist struck in chest by 5kg workpiece that detached from rotating lathe chuck at 600 RPM, suffering severe cracked ribs.",
        "Personal Injury", "Serious", 84,
        "High-velocity rotational projectile, direct blunt thoracic impact, internal injury potential",
        "Lathe interlocked shield deflected portion of energy, worker taken to trauma center",
        "High kinetic energy mechanical ejection striking personnel in direct line-of-fire.",
        "SIF-potential", "BARRIER_FAILED", "Central Maintenance Workshop"
    ),
    (
        "High-pressure wash wand at 250 bar slipped from contractor grip, water jet punctured rubber boot and lacerated worker foot.",
        "Personal Injury", "Serious", 82,
        "250 bar fluid injection energy, subcutaneous puncture hazard, tissue necrosis risk",
        "Trigger deadman valve released shutting off jet, worker transported immediately to surgical hospital",
        "High-pressure water jet injection incident with acute surgical trauma potential.",
        "SIF-potential", "BARRIER_FAILED", "Hydroblasting Bay"
    ),
    (
        "Electrician opened 3.3kV terminal compartment of cooling water pump motor while upstream feeder was tagged but not racked out.",
        "Electrical / Arc Flash", "Serious", 84,
        "3,300 Volts energized circuit, procedural isolation failure, failure to rack out breaker",
        "Voltage detector test performed before physical contact, alarm sounded, technician withdrew",
        "Life-critical electrical rule violation caught by final test barrier prior to fatal shock.",
        "SIF-potential", "BARRIER_BYPASSED", "Cooling Water Substation"
    ),
    (
        "Heavy arc scorch and copper splatter found inside 415V motor control center cubicle after breaker failed to clear fault cleanly.",
        "Electrical / Arc Flash", "Serious", 82,
        "415V internal fault arc plasma, molten copper projection, breaker mechanism failure",
        "Cubicle door was latched shut containing arc blast, upstream incomer cleared fault",
        "High-energy electrical arc flash event contained by enclosure barrier; high fatality potential if door open.",
        "SIF-potential", "BARRIER_FAILED", "Substation 04 MCC Room"
    ),
    (
        "Three-phase 415V armored power cable run across heavy vehicle haul road crushed by loaded dump truck, jacket ripped open.",
        "Electrical / Arc Flash", "Serious", 80,
        "Heavy vehicle crushing live electrical cable, phase-to-ground fault hazard on roadway",
        "Upstream earth leakage breaker tripped instantly, road barricaded",
        "Severe mechanical damage to energized medium-voltage cable on vehicular roadway.",
        "SIF-potential", "BARRIER_COMPROMISED", "Refinery Expansion Access Road"
    ),
    (
        "Contractor drilled into concrete wall and severed energized 415V conduit, tripping sub-distribution breaker with loud pop and sparks.",
        "Electrical / Arc Flash", "Serious", 81,
        "Penetration of live concealed power conduit, sparks and acoustic blast at arm length",
        "Insulated rotary hammer drill handle prevented electric shock to contractor, breaker tripped",
        "Direct contact with concealed live power line where tool insulation served as sole barrier.",
        "SIF-potential", "BARRIER_BYPASSED", "Administration Control Annex"
    ),
    (
        "Contractor erecting scaffolding at 10 meters height without intermediate guardrails and without attaching harness to static lifeline.",
        "Work at Height", "Serious", 83,
        "10-meter fatal fall elevation, zero personal fall arrest connection, unguarded platform edge",
        "Safety inspector halted work immediately and ordered worker to tether to structural beam",
        "Severe work at height non-compliance with imminent potential for fatal ground impact.",
        "SIF-potential", "BARRIER_MISSING", "Vessel V-102 Scaffolding"
    ),
    (
        "Removable floor grating section on 3rd level process structure removed for valve rigging without installing temporary safety barrier.",
        "Work at Height", "Serious", 84,
        "Open 12-meter hole in deck floor, unbarricaded, walkway in active operational area",
        "Operator spotted open hole from 3 meters away and placed temporary safety ladder across hole",
        "Unguarded opening in high-level deck floor presenting direct fatal fall trap for operators.",
        "SIF-potential", "BARRIER_MISSING", "Unit 12 Fractionation Deck"
    ),
    (
        "Worker stepped out onto fragile fiberglass roof skylight sheet while inspecting piperack rainwater guttering at 7m elevation.",
        "Work at Height", "Serious", 83,
        "Fragile roof surface, 7-meter drop through to concrete workshop floor below, zero crawling boards",
        "Worker felt panel crack and stepped back onto structural steel purlin",
        "Fragile roof breakthrough hazard with acute fatal fall consequence potential.",
        "SIF-potential", "BARRIER_MISSING", "Warehouse Roof"
    ),
    (
        "Painter operating on single unanchored aluminum extension ladder resting on rounded crude pipeline 5 meters above concrete floor.",
        "Work at Height", "Serious", 81,
        "Unstable ladder footing on round pipe, 5-meter fall height, no harness anchor",
        "Supervisor stopped work before ladder slipped",
        "Grossly unstable access method at fatal fall height caught prior to ladder slip.",
        "SIF-potential", "BARRIER_MISSING", "Offsites Crude Manifold"
    ),
    (
        "Contractor using motorized weed trimmer with metal blade near LPG mounded bullets perimeter fence, striking rocks and throwing sparks.",
        "Fire & Explosion", "Serious", 82,
        "Mechanical sparks thrown adjacent to LPG storage boundary, unauthorized tool in zone 2",
        "Gas detector reading was 0% LEL, work stopped immediately and contractor escorted off site",
        "Active ignition source introduced into flammable gas storage buffer zone.",
        "SIF-potential", "BARRIER_BYPASSED", "LPG Bullet Storage Perimeter"
    ),
    (
        "Diesel generator exhaust flexible bellows cracked open, directing 450C exhaust gas directly onto adjacent acoustic insulation foam.",
        "Fire & Explosion", "Serious", 81,
        "450C hot gas impingement on combustible soundproofing foam, fire precursor",
        "Operator observed glowing gas in darkness and shut down generator",
        "Hot surface thermal ignition precursor threatening generator building structure.",
        "SIF-potential", "BARRIER_FAILED", "Standby Generator Skid"
    ),
    (
        "Hot work cutting torch sparks dropped through open grating into unwashed oily wastewater pit below, igniting surface oil film.",
        "Fire & Explosion", "Serious", 84,
        "Hot slag igniting hydrocarbon film in enclosed wastewater pit, smoke rising to process deck",
        "Fire watch deployed dry powder extinguisher immediately, knocking down fire in 20 seconds",
        "Ignition of flammable hydrocarbon vapor in wastewater drainage network.",
        "SIF-potential", "BARRIER_FAILED", "Oily Water Separator Basin"
    ),
    (
        "Kerosene pump seal failed, atomized aerosol hydrocarbon mist spraying across hot turbine casing (380C) before operator tripped pump.",
        "Fire & Explosion", "Serious", 85,
        "Pressurized aerosol hydrocarbon mist impinging on 380C hot turbine surface (autoignition risk)",
        "Emergency pump trip hit within 15 seconds, steam quench activated",
        "Extremely high-risk auto-ignition scenario caught seconds before major flash fire erupted.",
        "SIF-potential", "BARRIER_FAILED", "Kerosene Treater Unit"
    )
]

additional_worker_vernacular = [
    (
        "smelling bad rotten egg gas near sour water pump p-202 got dizzy had to run out",
        "Gas Leak", "Serious", 81,
        "Acute toxic H2S symptoms (dizziness), active sour water pump leak, worker in line-of-fire",
        "Worker evacuated area successfully, alarm beacon triggered",
        "Informal report describing toxic H2S atmospheric exposure resulting in physiological symptoms.",
        "SIF-potential", "BARRIER_FAILED", "Sour Water Stripper"
    ),
    (
        "acid leeking on alkylation skid yellow drips on floor suit got burned a bit",
        "Chemical Spill", "Serious", 82,
        "Corrosive acid line leakage, chemical suit degradation from contact, direct exposure",
        "Worker rinsed at safety shower immediately, neutralized area with lime",
        "Informal report of active corrosive acid leak causing protective equipment damage.",
        "SIF-potential", "BARRIER_FAILED", "Alkylation Unit Skid"
    ),
    (
        "sparkin wire in substation box loud pop and black smoke",
        "Electrical / Arc Flash", "Serious", 78,
        "Electrical arcing fault, explosive pop acoustic energy, smoke generation in substation",
        "Worker exited substation, breaker tripped",
        "Informal report of high-energy electrical arcing fault inside substation panel.",
        "SIF-potential", "BARRIER_FAILED", "Substation 02"
    ),
    (
        "crane dropped heavy iron pipe spool near walkway almost hit rigger",
        "Equipment Failure", "Serious", 83,
        "Heavy dropped mass near pedestrian walkway, near-miss with rigger",
        "Rigger jumped back, load struck ground dunnage",
        "Informal report of major dropped overhead load with life-threatening crushing potential.",
        "SIF-potential", "BARRIER_FAILED", "Pipe Staging Bay"
    ),
    (
        "ladder sliped from wall guy fell 3 meters broke his arm",
        "Work at Height", "Serious", 79,
        "3m fall elevation, ladder footing failure, permanent bone fracture",
        "First aid crew arrived, worker transported to hospital",
        "Informal worker narrative of fall from height causing severe disabling orthopedic injury.",
        "SIF-potential", "BARRIER_FAILED", "Pump House Ladder"
    ),
    (
        "smal oil leek under pump 50ml caught in pan wiped with rag",
        "Chemical Spill", "Low", 14,
        "50ml oil drip",
        "Caught in pan, wiped with rag, zero heat source, pump running fine",
        "Informal report of minor routine lube oil drip fully contained in drip pan.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Booster Pump Skid"
    ),
    (
        "water pipe leeking on asphalt making big puddle",
        "Equipment Failure", "Moderate", 30,
        "Utility water leak, roadway puddle",
        "Ambient non-hazardous water, away from electric cables, isolated by valve",
        "Informal description of utility cooling water leak with low consequence potential.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Plant Perimeter Road"
    ),
    (
        "valve packin dripping hot water near drain steam coming out",
        "Equipment Failure", "Moderate", 35,
        "Hot utility water drip, minor vapor",
        "Directed toward drain, non-hazardous fluid, valve isolated",
        "Informal report of utility hot water packing weep discharging safely into drain.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Utility Manifold"
    ),
    (
        "guy sliped on oily deck bruised his knee put ice on it",
        "Personal Injury", "Moderate", 36,
        "Surface slip, minor personal bruise",
        "Same level fall, ice pack applied, deck degreased immediately",
        "Informal report of minor level surface slip resulting in superficial bruise.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Slop Oil Deck"
    ),
    (
        "motor got very hot smelled burn rubber shut off breaker",
        "Equipment Failure", "Moderate", 42,
        "Motor overheating, rubber belt smell",
        "Breaker opened promptly, zero open flame, belt replaced",
        "Informal report of motor belt friction intercepted before fire development.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Ventilation Fan Shed"
    ),
    (
        "h2s monitor beeping loud 35ppm ran to windsock quick",
        "Gas Leak", "Serious", 82,
        "35 ppm H2S toxic gas exposure, personal monitor alarm sounding",
        "Worker followed escape procedure and moved upwind to muster point",
        "Informal report of elevated toxic gas release triggering emergency worker evacuation.",
        "SIF-potential", "BARRIER_FAILED", "Amine Treater Deck"
    ),
    (
        "forktuck hit handrail bent steel post near office",
        "Personal Injury", "Moderate", 44,
        "Vehicle impact with handrail, structural post deformation",
        "Low vehicle speed, pedestrian walkway clear, driver unhurt",
        "Informal description of mobile vehicle impact with architectural barrier at low speed.",
        "Non-SIF-potential", "BARRIER_COMPROMISED", "Office Walkway"
    ),
    (
        "welder spark set rag on fire put out with water cup right away",
        "Fire & Explosion", "Low", 18,
        "Single rag ignition from hot work spark",
        "Fire watch present with water cup, put out immediately, zero spread",
        "Informal report of minor hot work spark quenched instantaneously with water cup.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Boiler Platform"
    ),
    (
        "small smoke from belt on fan stopped motor no fire",
        "Fire & Explosion", "Moderate", 46,
        "Belt slip smoke",
        "Motor stopped via local switch, zero open flame, no process impact",
        "Informal report of machinery friction smoke controlled before ignition.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Cooling Fan 4"
    ),
    (
        "drum fell off palate rolled on ground no leek",
        "Equipment Failure", "Moderate", 38,
        "Drum displacement from pallet during handling",
        "Drum intact, bung tight, zero fluid release, placed back with forklift",
        "Informal report of dropped container without loss of primary containment.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Drum Storage Yard"
    )
]

additional_negative_controls = [
    (
        "Presented technical paper on toxic gas dispersion modeling and catastrophic BLEVE consequences at HSE seminar.",
        "Safety Drill / Negative Context", "Low", 10,
        "Dangerous keywords 'toxic gas', 'BLEVE', 'catastrophic'",
        "Academic seminar in conference room, computer presentation, zero physical plant work",
        "Educational technical presentation on process safety simulation models.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Corporate Seminar Room"
    ),
    (
        "Safety committee reviewed plant incident history of major hydrocarbon fires and explosions from the last 15 years.",
        "Safety Drill / Negative Context", "Low", 10,
        "Dangerous keywords 'hydrocarbon fires', 'explosions'",
        "Administrative committee review meeting, historical records audit",
        "Routine committee meeting analyzing historical safety statistics and trends.",
        "Non-SIF-potential", "BARRIER_PRESENT", "HSE Conference Room"
    ),
    (
        "Quarterly inspection and hydrostatic pressure testing of fire hydrant main loop and deluge valves completed successfully.",
        "Safety Drill / Negative Context", "Low", 12,
        "Dangerous keywords 'fire hydrant', 'deluge valves'",
        "Preventive hydrostatic test using clean water, all systems passed test",
        "Routine verification test confirming operational readiness of firewater delivery network.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Refinery Firewater Ring"
    ),
    (
        "Conducted tabletop emergency simulation exercise regarding unconfined vapor cloud explosion scenario for operations management.",
        "Safety Drill / Negative Context", "Low", 12,
        "Dangerous keywords 'vapor cloud explosion', 'emergency scenario'",
        "Desktop paper exercise, simulation map, zero physical field action",
        "Tabletop emergency management training evaluating incident command coordination.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Incident Command Center"
    ),
    (
        "Permit to work issued for nitrogen line displacement following verified zero hydrocarbon gas testing.",
        "Safety Drill / Negative Context", "Low", 10,
        "Dangerous keywords 'nitrogen line', 'hydrocarbon gas'",
        "Standard authorized permit documentation, multi-signature safety verification completed",
        "Standard administrative permit-to-work verification prior to routine maintenance.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Shift Supervisor Office"
    ),
    (
        "Replaced worn fire blanket in hot work staging station during scheduled safety equipment audit.",
        "Safety Drill / Negative Context", "Low", 8,
        "Dangerous keywords 'fire blanket', 'hot work'",
        "Equipment replacement during routine audit, zero active hot work ongoing",
        "Routine housekeeping replenishment of emergency safety equipment.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Safety Staging Area"
    ),
    (
        "Conducted chemical spill response drill using water and dyed sawdust to test team mobilization time at tanker rack.",
        "Safety Drill / Negative Context", "Low", 15,
        "Dangerous keywords 'chemical spill', 'spill drill', 'tanker rack'",
        "Planned drill using water and harmless colored sawdust, full emergency crew deployed",
        "Controlled emergency training drill evaluating emergency spill team response speed.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Offloading Rack 2"
    ),
    (
        "Conducted toolbox talk explaining difference between deflagration and detonation in high-pressure hydrogen piping.",
        "Safety Drill / Negative Context", "Low", 10,
        "Dangerous keywords 'deflagration', 'detonation', 'hydrogen piping'",
        "Classroom briefing, educational safety discussion, zero operational hazard",
        "Toolbox educational discussion on combustion physics and explosion mechanics.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Reformer Briefing Room"
    ),
    (
        "Checked operability of high-expansion foam generator in lube oil storage warehouse during routine monthly PM.",
        "Safety Drill / Negative Context", "Low", 12,
        "Dangerous keywords 'foam generator', 'lube oil storage'",
        "Preventive maintenance electrical check on fan motor, zero foam discharge, warehouse secure",
        "Routine preventive maintenance check on warehouse foam fire protection system.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Lube Oil Warehouse"
    ),
    (
        "Reviewed lessons from BP Texas City disaster focusing on distillation column level indicator failures during refresher class.",
        "Safety Drill / Negative Context", "Low", 10,
        "Dangerous keywords 'Texas City disaster', 'distillation column failures'",
        "Educational refresher class, video case study, zero physical field hazard",
        "Mandatory operator training reviewing historical industry disaster lessons.",
        "Non-SIF-potential", "BARRIER_PRESENT", "Training Auditorium"
    )
]
