"""
Safety Observation Validity Layer
=================================
Validates whether free-text input constitutes a legitimate workplace safety
observation (Unsafe Act, Unsafe Condition, Hazard, Near-Miss, Environmental Defect)
versus genuinely unrelated conversational or off-topic input.

Key Principle:
DO NOT require industrial equipment, energy vectors, or barrier failures before
accepting an observation. Simple operational, environmental, or housekeeping
observations (e.g. 'At front door it is very slippery', 'Emergency exit is blocked')
are fully valid safety observations.

Valid Categories Evaluated:
1. Slip / Trip / Fall (slippery, wet floor, puddle, trip, ice, oil slick, uneven)
2. PPE / Protective Clothing (helmet, goggles, harness, boots, earplugs, gloves)
3. Falling Object / Dropped Object (overhead tool, loose bracket, falling item)
4. Electrical Hazards (cables, wires, outlets, switchgear, sparks, live panels)
5. Fire & Thermal (sparks, hot surface, welding, open flame, flammable, smoke)
6. Chemical & Hazardous Substances (fumes, odors, acids, drums, spills, solvents)
7. Gas & Fluid Leakage (hissing, dripping, pipe leak, valve weeping, seepage)
8. Pressure & Pressurized Systems (hoses, gauges, cylinders, relief valves)
9. Mechanical & Machinery (guards, rotating shafts, nip points, belts, chains)
10. Vehicles & Mobile Equipment (forklifts, trucks, pedestrians, reversing)
11. Working at Height (scaffolding, ladders, roofs, railings, platforms)
12. Confined Space & Pits (tanks, vessels, manholes, toxic atmosphere)
13. Excavation & Trenching (ditches, shoring, cave-in risk, ground instability)
14. Lifting & Rigging (cranes, hoists, slings, shackles, suspended loads)
15. Energy Isolation / LOTO (lockout, tagout, isolation, de-energization)
16. Emergency Access & Egress (blocked exits, fire doors, obstructed extinguishers)
17. Housekeeping & Storage (clutter, tools on floor, improperly stacked boxes)
18. Lighting & Visibility (poor illumination, dark stairwells, blind spots, glare)
19. Environmental & Ambient Conditions (air quality, dust, extreme heat, cold)
20. Barrier & Control Deficiencies (loose guardrail, broken gate, missing signage)
21. Unsafe Acts (procedural bypass, speeding, horseplay, not following rules)
22. Unsafe Conditions (any physical state creating hazard potential)
23. Near Misses (almost hit, close call, narrowly avoided accident)
24. Worker Exposure (personnel proximity to physical hazard)
"""

import re
import json
import logging
from typing import Dict, Any, Optional, List, Tuple

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

try:
    from rapidfuzz import fuzz, process
    RAPIDFUZZ_AVAILABLE = True
except ImportError:
    RAPIDFUZZ_AVAILABLE = False


# Canonical safety concepts for fuzzy spelling tolerance
CANONICAL_SAFETY_CONCEPTS = [
    "slippery", "slipped", "tripped", "hazard", "leakage", "leaking", "helmet",
    "harness", "goggles", "gloves", "barrier", "guardrail", "electrical",
    "wire", "cable", "switch", "breaker", "pressure", "chemical", "spill",
    "corrosion", "unlocked", "isolation", "blocked", "egress", "extinguisher",
    "scaffold", "ladder", "forklift", "pedestrian", "welding", "flammable",
    "exhaust", "ventilation", "lighting", "housekeeping", "clutter", "damage",
    "broken", "cracked", "missing", "unsecured", "overloaded", "malfunction",
    "injured", "injury", "exposure", "thermal", "vibrating", "vibration",
    "explosion", "fireball", "blast", "rupture"
]

# Genuinely unrelated conversational phrases
CONVERSATIONAL_PATTERNS = [
    r'^(?:hello|hi|hey|yo|howdy)(?:\s+there)?(?:\s+how\s+are\s+you)?[\.!\?]?$',
    r'\bhow\s+are\s+you\b',
    r'\bwho\s+are\s+you\b',
    r'\bwhat\s+is\s+your\s+name\b',
    r'\btell\s+me\s+a\s+joke\b',
    r'\bwhat\s+(?:is\s+the\s+)?weather\b',
    r'\bi\s+like\s+(?:cricket|football|movies|music|coding|pizza|coffee)\b',
    r'\bwhat\s+is\s+python\b',
    r'\bwhat\s+is\s+ai\b',
    r'\bgood\s+(?:morning|afternoon|evening|night)\b',
    r'^(?:thank\s+you|thanks|ok|okay|bye|goodbye)[\.!\?]?$',
    r'\bwho\s+won\s+the\s+match\b',
    r'\bsing\s+a\s+song\b',
    r'^(?:asdf|qwerty|zxcv|test|1234|abc)[\.!\?]?$'
]
CONVERSATIONAL_REGEX = re.compile("|".join(CONVERSATIONAL_PATTERNS), re.IGNORECASE)

# Vague / Ambiguous Insufficient Information patterns
INSUFFICIENT_INFO_PATTERNS = [
    r'^(?:something|anything|an?\s+issue|a\s+problem|an?\s+incident|an?\s+accident|an?\s+event|issue|problem)\s+(?:happened|occurred|took\s+place|reported|there|here|went\s+wrong)(?:\s+(?:near|at|in|on|around|by|for)\b.*)?[\.!\?]?$',
    r'^(?:something\s+happened|an\s+issue\s+occurred|there\s+was\s+a\s+problem|incident\s+occurred|something\s+went\s+wrong|issue\s+happened|problem\s+occurred|accident\s+happened)(?:\s+(?:near|at|in|on|around|by|for)\b.*)?[\.!\?]?$',
    r'^(?:check\s+this|look\s+at\s+this|investigate\s+this|something\s+is\s+wrong)(?:\s+(?:near|at|in|on|around|by|for)\b.*)?[\.!\?]?$'
]
INSUFFICIENT_INFO_REGEX = re.compile("|".join(INSUFFICIENT_INFO_PATTERNS), re.IGNORECASE)

def is_code_or_technical_documentation(text: str) -> Tuple[bool, str]:
    """
    Detects whether the input text is software source code, technical docstrings,
    programming documentation, or system specifications rather than a legitimate
    workplace safety observation.
    """
    if not text or not isinstance(text, str):
        return False, ""
    
    raw = text.strip()
    
    # 1. Docstring markers / code blocks / markup
    if '"""' in raw or "'''" in raw:
        return True, "Python docstring syntax ('\"\"\"' or '\'\'\'')"
    
    if '```' in raw:
        return True, "markdown code block delimiters ('```')"

    if re.search(r'<(?:script|div|span|p|html|body|table|tr|td|form|button)\b', raw, re.IGNORECASE):
        return True, "HTML/web markup tags"

    # 2. Section underlines common in code docstrings / reStructuredText / Markdown
    # e.g., "Safety NLP Preprocessing Module\n-------------------------------"
    underline_match = re.search(r'([A-Za-z0-9_\s]{3,})\n\s*([-=~_]{3,})\s*(?:\n|$)', raw)
    if underline_match:
        header_text = underline_match.group(1).lower()
        if any(term in header_text for term in [
            'module', 'class', 'function', 'api', 'service', 'engine', 'package',
            'preprocessing', 'pipeline', 'architecture', 'specification', 'sdk',
            'controller', 'model', 'nlp', 'parser', 'component', 'algorithm'
        ]):
            return True, f"software module or technical specification header ('{underline_match.group(1).strip()}')"

    # 3. Source code keywords and statements
    code_statement_patterns = [
        # Python
        r'^\s*(?:def\s+[a-zA-Z_]\w*\s*\(|class\s+[a-zA-Z_]\w*|import\s+[a-zA-Z_]\w+|from\s+[a-zA-Z_]\w+\s+import|return\s+|raise\s+[a-zA-Z_]\w*Error)',
        # JS / TS
        r'^\s*(?:const\s+[a-zA-Z_]\w*\s*=|let\s+[a-zA-Z_]\w*\s*=|var\s+[a-zA-Z_]\w*\s*=|function\s+[a-zA-Z_]\w*\s*\(|export\s+(?:default|const|let|var|function))',
        # Java / C++ / C#
        r'^\s*(?:public\s+(?:class|static|void|int|String)|private\s+|protected\s+|#include\s+[<"]|std::|System\.out\.println)',
        # Code print / logging
        r'(?:console\.log\s*\(|print\s*\(["\']|logger\.(?:info|debug|error|warning)\s*\()',
        # Code mapping notation like 'without helmet' -> 'without_helmet'
        r'[\'"][^\'"]+[\'"]\s*->\s*[\'"][^\'"]+[\'"]',
        # Python dunder or decorators
        r'(?:if\s+__name__\s*==\s*[\'"]__main__[\'"]|@classmethod|@staticmethod|@pytest\.|@router\.)'
    ]
    for pat in code_statement_patterns:
        if re.search(pat, raw, re.MULTILINE):
            return True, "source code syntax or programming statements"

    # 4. Technical software / AI / documentation headers
    doc_header_patterns = [
        r'\b(?:Key Features:|Features:|Installation:|Usage Examples?:|API Reference:|Parameters:|Returns:|Arguments:|Kwargs:|Attributes:|Changelog:)\b',
    ]
    for pat in doc_header_patterns:
        if re.search(pat, raw, re.IGNORECASE):
            return True, "technical documentation headers"

    # 5. Technical Software / NLP / ML Jargon clusters (if 2 or more appear)
    technical_terms = [
        r'\btokenizer\b', r'\btokenization\b', r'\bpreprocessing module\b', r'\bnlp preprocessing\b',
        r'\bpii masking\b', r'\bmodel training\b', r'\breproducible model\b', r'\bdata leakage\b',
        r'\bhyperparameters?\b', r'\bloss function\b', r'\blearning rate\b', r'\btrain[- ]test split\b',
        r'\bregex\b', r'\bregular expression\b', r'\bapi endpoint\b', r'\bjson payload\b',
        r'\bdocstring\b', r'\bunit tests?\b', r'\bsource code\b', r'\bcompound terms\b',
        r'\bneural network\b', r'\bvectorizer\b', r'\bembeddings?\b'
    ]
    tech_matches = sum(1 for pat in technical_terms if re.search(pat, raw, re.IGNORECASE))
    if tech_matches >= 2:
        return True, "software engineering or NLP technical documentation terminology"

    # 6. JSON structured payload check
    if (raw.startswith('{') and raw.endswith('}')) or (raw.startswith('[') and raw.endswith(']')):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, (dict, list)):
                return True, "JSON formatted data payload"
        except Exception:
            pass

    # 7. SQL queries check
    if re.search(r'^\s*(?:SELECT\s+.+\s+FROM|INSERT\s+INTO\s+\w+|UPDATE\s+\w+\s+SET|DELETE\s+FROM\s+\w+|CREATE\s+TABLE)\b', raw, re.IGNORECASE | re.DOTALL):
        return True, "SQL database query statements"

    return False, ""

# Comprehensive Safety Observation Category Signals
SAFETY_OBSERVATION_PATTERNS = [
    # 1. Slip / Trip / Fall & Surface Contamination
    (r'\b(slip\w*|slippery|slick|trip\w*|fall\w*|fell|stumble\w*|water on floor|wet floor|water puddle|greasy floor|oil on floor|mud on deck|uneven surface|uneven floor|ice on walkway|skid|water on floor)\b', "Slip / Trip / Fall"),

    # 2. Worker Injury, Harm & Medical
    (r'\b(injur\w*|injured|injury|hurt|wound\w*|burn\w*|casualty|first aid|hospital|bleeding|pain|fracture|struck by|hit by|caught in|crushed|worker fell|worker slipped|worker injured|man is injured|worker was injured|person injured)\b', "Worker Injury / Incident"),

    # 3. Thermal & Heat Exposure
    (r'\b(heat\b|thermal|high temperature|excessive heat|heat stress|heatstroke|hot surface|burn hazard|fire|flame|sparks|burning|combustible|flammable|welding without screen|smoking in area|explouser|exposure|exposed to heat|hot work|explosion|explosions|explode|exploding|exploded|blast|blasts|blasted|detonation|fireball|fireballs|blowout|blew out|blew apart|boom)\b', "Thermal / Heat Exposure"),

    # 4. PPE & Protective Equipment
    (r'\b(ppe|personal protective equipment|helmet|hard hat|safety shoes|steel toe|goggles|safety glasses|face shield|earplugs|harness|lanyard|high-vis|vest|respirator|mask|without ppe|no ppe|not wearing|no helmet|no harness|no gloves|without gloves|gloves|eye protection|safety gear|missing safety gear|no safety gear)\b', "PPE / Protective Equipment"),

    # 5. Housekeeping & Dropped Objects
    (r'\b(housekeeping|tools on floor|left on the floor|clutter|boxes stacked|stacked improperly|unstable stack|messy|trash on walkway|debris on floor|unsecured pallet|blocked walkway|untidy|box almost fell|box fell|dropped object|dropped tool|object fell)\b', "Housekeeping / Storage"),

    # 6. Emergency Access & Egress
    (r'\b(emergency exit|fire exit|exit blocked|blocked exit|fire door|fire extinguisher|eye wash|egress|obstruction in aisle|evacuation route|access blocked|path blocked|door blocked)\b', "Emergency Access / Egress"),

    # 7. Lighting & Visibility
    (r'\b(lighting|poor lighting|dim light|dark walkway|dark corridor|bulb burnt|no light|insufficient lighting|glare|blind spot|visibility poor)\b', "Lighting / Visibility"),

    # 8. Electrical & Wiring
    (r'\b(electrical|electric|wire|cable|cord|loose cable|frayed|bare wire|exposed conductor|conduit|outlet|plug|socket|switchboard|switchgear|panel|breaker|arc flash|spark|energized|shock|damaged cable|cable is damaged|wire is exposed|electrical wire)\b', "Electrical"),

    # 9. Leakage, Fluid Release & Spills
    (r'\b(leak\w*|water leaking|oil leaking|pipe leaking|hose leaking|dripping|seepage|puddle forming|steam leaking|flange leak|valve dripping|weeping|water is leaking|oil spilled|spill\w*|spilled|fluid release)\b', "Leakage / Fluid Release"),

    # 10. Gas & Atmosphere
    (r'\b(gas leak|gas odor|smell of gas|gas smell|gas is leaking|h2s|toxic gas|fumes|vapor|smoke|hissing sound|air quality|ventilation|oxygen|flammable atmosphere|atmospheric monitoring|atmospheric test\w*|gas test\w*|gas monitor\w*|air monitor\w*|multi-gas|lel detector)\b', "Gas / Atmospheric Hazard"),
    # 19. Unexpected Equipment Start / Operation (compound phrases only to avoid false positives on generic words)
    (r'(?:(?:machine|equipment|motor|pump|compressor|conveyor|engine|generator|turbine|mixer|agitator|fan|blower)\s+(?:started|came on|running|operating|activated|restarted|turned on))|(?:(?:started|came on|restarted|turned on|activated)\s+(?:suddenly|unexpectedly|without warning|during (?:maintenance|inspection|repair|shutdown|work)))|(?:\b(?:unexpected(?:ly)?)\s+(?:start|activation|movement|operation))', "Unexpected Equipment Operation"),
    # 20. Abnormal Noise / Sound
    (r'\b(noise|sound|audible|buzz|hum|squeak|clank|rattle|click|unusual noise|loud noise|strange noise)\b', "Abnormal Noise"),

    # 11. Mechanical, Safeguards & Vibration
    (r'\b(guard\w*|machine guard|guard missing|guard loose|loose guard|exposed blade|nip point|pinch point|conveyor|rotating|moving parts|entanglement|jammed machine|vibrat\w*|machine is vibrating|excessive vibration)\b', "Mechanical & Safeguards"),

    # 12. Vehicles & Mobile Equipment
    (r'\b(forklift|truck|vehicle|dumper|loader|pedestrian|almost hit|narrowly missed|near collision|speeding vehicle|reversing without alarm|reversing without spotter|forklift nearly hit|forklift almost hit)\b', "Vehicle & Pedestrian Safety"),

    # 13. Working at Height
    (r'\b(height|scaffold\w*|ladder|roof|edge|mezzanine|platform|handrail missing|open grating|hole in floor|hole\b|uncovered pit|pit\b|toe-board missing|fall hazard)\b', "Working at Height"),

    # 14. Confined Space & Pits
    (r'\b(confined space|enclosed space|vessel entry|tank entry|pit entry|pit\b|uncovered pit|manhole|trench|excavation|ditch|entering (?:the )?vessel|entered (?:the )?vessel|inside (?:the )?vessel|inside (?:the )?tank|vessel)\b', "Confined Space & Excavation"),

    # 15. Lifting & Rigging
    (r'\b(crane|hoist|winch|sling|rigging|shackle|suspended load|overhead load|dropped object|falling tool|lifting gear)\b', "Lifting & Rigging"),

    # 16. Energy Isolation (LOTO) & Permits
    (r'\b(loto|lockout|tagout|isolation|isolated|permit|ptw|work permit|authorization|de-energize)\b', "Energy Isolation & Work Authorization"),

    # 17. Barrier & Physical Protection Deficiencies
    (r'\b(barricade|handrail|guardrail|barrier missing|barrier damaged|fence broken|gate open|warning sign missing|warning tape|without monitoring|without testing|not completed|not conducted|not performed|bypassed|omitted|restricted area|exclusion zone|restricted zone|unauthorized area)\b', "Barrier & Physical Protection"),

    # 18. General Hazard & Unsafe Condition terms
    (r'\b(hazard|unsafe|danger\w*|risk|near miss|incident|accident|damage\w*|defect\w*|faulty|abnormal|unstable|loose\b|corroded|exposure|explouser|rupture|ruptured|burst|catastrophic|collapse|structural failure)\b', "Operational Hazard")
]


def classify_safety_observation_validity(text: str) -> Dict[str, Any]:
    """
    Evaluates raw input into one of three distinct categories:
    1. VALID SAFETY OBSERVATION - Operational observation, condition, act, hazard, or near-miss.
    2. INSUFFICIENT INFORMATION - Vague, ambiguous text lacking operational specifics.
    3. UNRELATED INPUT - Conversational greetings, off-topic chat, software code, docstrings, or random text.

    Returns:
        Dict containing:
            - is_valid_safety_observation: bool
            - is_unrelated: bool
            - is_insufficient_information: bool
            - validation_category: "VALID SAFETY OBSERVATION" | "INSUFFICIENT INFORMATION" | "UNRELATED INPUT"
            - primary_category: Optional[str]
            - detected_categories: List[str]
            - confidence_score: float (0.0 to 1.0)
            - explanation: str
    """
    if not text or not isinstance(text, str):
        result = {
            "is_valid_safety_observation": False,
            "is_unrelated": True,
            "is_insufficient_information": False,
            "validation_category": "UNRELATED INPUT",
            "primary_category": None,
            "detected_categories": [],
            "confidence_score": 0.0,
            "explanation": "No text provided. Please enter a workplace safety observation."
        }
        logger.debug(f"Safety validation result: {result['validation_category']}, confidence: {result['confidence_score']}")
        return result

    cleaned = text.strip()

    # Pre-normalize high-frequency safety typos (e.g. explouser -> exposure)
    try:
        from .preprocessing import normalize_safety_spelling
        cleaned = normalize_safety_spelling(cleaned)
    except Exception:
        pass

    lower_cleaned = cleaned.lower()

    # Check for Vague / Insufficient Information inputs (e.g. "something happened", "an issue occurred")
    if INSUFFICIENT_INFO_REGEX.search(lower_cleaned):
        result = {
            "is_valid_safety_observation": False,
            "is_unrelated": False,
            "is_insufficient_information": True,
            "validation_category": "INSUFFICIENT INFORMATION",
            "primary_category": "Insufficient Information",
            "detected_categories": [],
            "confidence_score": 0.20,
            "explanation": "The safety report lacks specific operational details (hazard, equipment, act, or condition). Please provide a more descriptive observation."
        }
        logger.debug(f"Safety validation result: {result['validation_category']}, confidence: {result['confidence_score']}")
        return result

    # Very short inputs (e.g. "hi", "ok", "a", "asdf")
    if len(lower_cleaned) < 4:
        result = {
            "is_valid_safety_observation": False,
            "is_unrelated": True,
            "is_insufficient_information": False,
            "validation_category": "UNRELATED INPUT",
            "primary_category": None,
            "detected_categories": [],
            "confidence_score": 0.0,
            "explanation": "The description does not appear to contain a workplace safety observation. Please describe a safety hazard, unsafe condition, unsafe act, or near-miss observation."
        }
        logger.debug(f"Safety validation result: {result['validation_category']}, confidence: {result['confidence_score']}")
        return result

    # Check for Source Code, Technical Documentation, Docstrings
    is_code, code_reason = is_code_or_technical_documentation(cleaned)
    if is_code:
        result = {
            "is_valid_safety_observation": False,
            "is_unrelated": True,
            "is_insufficient_information": False,
            "validation_category": "UNRELATED INPUT",
            "primary_category": "Technical Documentation / Source Code",
            "detected_categories": [],
            "confidence_score": 0.0,
            "explanation": f"Input appears to be software code or technical documentation ({code_reason}) rather than an operational workplace safety observation. Please describe a safety hazard, unsafe condition, unsafe act, or near-miss observation."
        }
        logger.debug(f"Safety validation result: {result['validation_category']}, confidence: {result['confidence_score']}")
        return result

    # Step 1: Detect and match safety observation categories
    matched_categories: List[str] = []
    for pattern, category_name in SAFETY_OBSERVATION_PATTERNS:
        if re.search(pattern, lower_cleaned):
            if category_name not in matched_categories:
                matched_categories.append(category_name)

    # Step 2: If regex didn't find a direct hit, apply fuzzy concept matching
    if not matched_categories and RAPIDFUZZ_AVAILABLE:
        tokens = re.findall(r'\b[a-z]{4,}\b', lower_cleaned)
        for token in tokens:
            best_match = process.extractOne(token, CANONICAL_SAFETY_CONCEPTS, scorer=fuzz.ratio, score_cutoff=82)
            if best_match:
                concept = best_match[0]
                if concept in ["slippery", "slipped", "tripped"]:
                    matched_categories.append("Slip / Trip / Fall")
                elif concept in ["helmet", "harness", "goggles", "gloves"]:
                    matched_categories.append("PPE / Protective Equipment")
                elif concept in ["wire", "cable", "electrical", "switch", "breaker"]:
                    matched_categories.append("Electrical")
                elif concept in ["leakage", "leaking"]:
                    matched_categories.append("Leakage / Fluid Release")
                elif concept in ["housekeeping", "clutter"]:
                    matched_categories.append("Housekeeping / Storage")
                elif concept in ["blocked", "egress", "extinguisher"]:
                    matched_categories.append("Emergency Access / Egress")
                elif concept in ["injured", "injury"]:
                    matched_categories.append("Worker Injury / Incident")
                elif concept in ["exposure", "thermal"]:
                    matched_categories.append("Thermal / Heat Exposure")
                elif concept in ["vibrating", "vibration"]:
                    matched_categories.append("Mechanical & Safeguards")
                else:
                    matched_categories.append("Operational Hazard")
                break

    # Decision Logic:
    # If safety patterns matched, it is a VALID SAFETY OBSERVATION even if conversational words coexist
    # (e.g. "Hello, water is leaking near door" -> VALID because of "water is leaking near door")
    if matched_categories:
        primary = matched_categories[0]
        result = {
            "is_valid_safety_observation": True,
            "is_unrelated": False,
            "is_insufficient_information": False,
            "validation_category": "VALID SAFETY OBSERVATION",
            "primary_category": primary,
            "detected_categories": matched_categories,
            "confidence_score": min(0.98, 0.75 + (0.08 * len(matched_categories))),
            "explanation": f"Validated workplace safety observation relating to {primary}."
        }
        logger.debug(f"Safety validation result: {result['validation_category']}, confidence: {result['confidence_score']}")
        return result

    # Step 3: Check for pure conversational/off-topic patterns
    is_pure_conversational = bool(CONVERSATIONAL_REGEX.search(lower_cleaned))
    if is_pure_conversational:
        result = {
            "is_valid_safety_observation": False,
            "is_unrelated": True,
            "is_insufficient_information": False,
            "validation_category": "UNRELATED INPUT",
            "primary_category": None,
            "detected_categories": [],
            "confidence_score": 0.0,
            "explanation": "The description does not appear to contain a workplace safety observation. Please describe a safety hazard, unsafe condition, unsafe act, or near-miss observation."
        }
        logger.debug(f"Safety validation result: {result['validation_category']}, confidence: {result['confidence_score']}")
        return result

    # Step 4: Fallback check: Does text contain action verbs or physical condition adjectives?
    # e.g. "Boxes were tilted", "Pipe was hot", "Floor is wet", "Water on floor", "Worker fell"
    condition_verbs = re.search(r'\b(was|is|were|are|found|observed|noticed|left|fell|hanging|leaking|loose|blocked|broken|damaged|hot|cold|smells?|wet|dark|sharp|slippery|injured|exposed|vibrating|spilled|dropped|overheating|getting|exploded|blew|spread|burning|occurred)\b', lower_cleaned)
    noun_indicators = re.search(r'\b(floor|door|walkway|wall|pipe|machine|motor|pump|compressor|conveyor|engine|generator|turbine|valve|equipment|crane|hoist|scaffold|ladder|vessel|stair|tool|box|panel|wire|room|yard|deck|ground|air|water|tank|tanks|worker|man|person|crew|operator|cable|gas|oil|heat|temperature|lighting|light|exit|entrance|explosion|fire|flame|fireball|fuel|unit)\b', lower_cleaned)
    if condition_verbs and noun_indicators:
        result = {
            "is_valid_safety_observation": True,
            "is_unrelated": False,
            "is_insufficient_information": False,
            "validation_category": "VALID SAFETY OBSERVATION",
            "primary_category": "Unsafe Condition",
            "detected_categories": ["Unsafe Condition"],
            "confidence_score": 0.75,
            "explanation": "Validated general operational unsafe condition."
        }
        logger.debug(f"Safety validation result: {result['validation_category']}, confidence: {result['confidence_score']}")
        return result

    # Genuinely unclassifiable / unrelated non-safety input
    result = {
        "is_valid_safety_observation": False,
        "is_unrelated": True,
        "is_insufficient_information": False,
        "validation_category": "UNRELATED INPUT",
        "primary_category": None,
        "detected_categories": [],
        "confidence_score": 0.0,
        "explanation": "The description does not appear to contain a workplace safety observation. Please describe a safety hazard, unsafe condition, unsafe act, or near-miss observation."
    }
    logger.debug(f"Safety validation result: {result['validation_category']}, confidence: {result['confidence_score']}")
    return result
