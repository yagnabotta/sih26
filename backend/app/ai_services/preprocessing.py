"""
Safety NLP Preprocessing Module
-------------------------------
Provides robust, explainable, and safety-aware text preprocessing for industrial
incident reports, near-misses, and unsafe acts/conditions.

Key Features:
- Strict preservation of critical safety negations (e.g. 'not', 'no', 'without', 'missing', 'failed')
- Normalization of safety compound terms (e.g. 'without helmet' -> 'without_helmet')
- PII masking (names, emails, phone numbers, employee IDs)
- Custom safety-aware tokenizer
- Leakage-controlled preprocessing for reproducible model training
"""

import re
from typing import List, Optional

# Safety-critical negation & deficiency terms that must NEVER be stripped as stopwords
CRITICAL_SAFETY_TERMS = {
    "no", "not", "without", "never", "none", "neither", "nor", "lacks", "lacking",
    "missing", "failed", "broken", "damaged", "bypassed", "overridden", "tampered",
    "unauthorized", "unsecured", "uninspected", "unisolated", "ungrounded", "exposed",
    "parted", "leaking", "ruptured", "blown", "dropped", "slipped", "tripped", "fell"
}

# Common English stopwords EXCLUDING critical safety terms and negations
BASE_STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "then", "of", "at", "by", "for",
    "with", "about", "against", "between", "into", "through", "during", "before",
    "after", "above", "below", "to", "from", "up", "down", "in", "out", "on", "off",
    "over", "under", "again", "further", "once", "here", "there", "when", "where",
    "why", "how", "all", "any", "both", "each", "few", "more", "most", "other",
    "some", "such", "only", "own", "same", "so", "than", "too", "very", "s", "t",
    "can", "will", "just", "should", "now", "d", "ll", "m", "o", "re", "ve", "y"
}

# Compound negation patterns to bind into safety tokens to prevent positive misclassification
COMPOUND_NEGATIONS = [
    (r'\bwithout\s+(?:wearing\s+|a\s+|an\s+)?(helmet|hard\s*hat)\b', 'without_helmet'),
    (r'\bwithout\s+(?:wearing\s+|a\s+|an\s+)?(harness|safety\s*belt|fall\s*protection)\b', 'without_harness'),
    (r'\bwithout\s+(?:wearing\s+|any\s+)?(ppe|gloves|goggles|face\s*shield|boots)\b', 'without_ppe'),
    (r'\bwithout\s+(?:a\s+|an\s+|valid\s+)?(permit|ptw|work\s*permit|clearance)\b', 'without_permit'),
    (r'\bno\s+(permit|ptw|work\s*permit|clearance)\b', 'no_permit'),
    (r'\bwithout\s+(?:proper\s+|energy\s+)?(isolation|loto|lockout|tagout)\b', 'without_isolation'),
    (r'\bnot\s+(?:locked\s*out|tagged\s*out|isolated|de-energized)\b', 'not_locked_out'),
    (r'\bnot\s+(?:wearing|used|deployed|clipped|anchored|tied\s*off)\b', 'not_wearing'),
    (r'\b(?:machine\s+)?guard\s+(?:was\s+)?(missing|removed|absent|detached)\b', 'guard_missing'),
    (r'\bno\s+(?:machine\s+)?guard\b', 'guard_missing'),
    (r'\bmissing\s+(?:machine\s+)?guard\b', 'guard_missing'),
    (r'\bnot\s+(?:grounded|earthed)\b', 'not_grounded'),
    (r'\bnot\s+(?:inspected|certified|calibrated|tested)\b', 'not_inspected'),
    (r'\bno\s+(?:gas\s*test|gas\s*testing|atmospheric\s*test)\b', 'no_gas_test'),
    (r'\bnot\s+(?:authorized|approved|certified)\b', 'unauthorized_action'),
    (r'\bno\s+injury\s+(?:occurred|reported|observed)\b', 'no_injury_occurred'),
    (r'\bno\s+(?:ppe\s+was\s+)?missing\b', 'no_ppe_missing'),
    (r'\bnot\s+(?:exposed|in\s+line\s+of\s+fire)\b', 'not_exposed'),
]

# PII Detection Patterns
PII_EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')
PII_PHONE_PATTERN = re.compile(r'\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b')
PII_EMPLOYEE_ID_PATTERN = re.compile(r'\b(?:EMP|OIL|STAFF|USER|OPERATOR|ID)[-_]?\d{3,8}\b', re.IGNORECASE)
PII_NATIONAL_ID_PATTERN = re.compile(r'\b\d{4}[-\s]\d{4}[-\s]\d{4}\b')

# Optional spaCy NER loader
_SPACY_NLP = None
_SPACY_ATTEMPTED = False

def get_spacy_nlp():
    """Lazily loads lightweight spaCy pipeline if available."""
    global _SPACY_NLP, _SPACY_ATTEMPTED
    if _SPACY_NLP is not None:
        return _SPACY_NLP
    if _SPACY_ATTEMPTED:
        return None
    _SPACY_ATTEMPTED = True
    try:
        import spacy
        # Try loading a small model if installed, otherwise blank English model
        try:
            _SPACY_NLP = spacy.load("en_core_web_sm")
        except Exception:
            _SPACY_NLP = spacy.blank("en")
    except Exception:
        _SPACY_NLP = None
    return _SPACY_NLP


def mask_pii(text: str) -> str:
    """
    Detects and masks personally identifiable information (PII)
    including email addresses, phone numbers, employee badges, and person names
    while strictly preserving operational equipment tags, units, and safety context.
    """
    if not text or not isinstance(text, str):
        return ""

    result = text
    # 1. Mask emails
    result = PII_EMAIL_PATTERN.sub("[EMAIL]", result)
    # 2. Mask phone numbers
    result = PII_PHONE_PATTERN.sub("[PHONE]", result)
    # 3. Mask employee badges
    result = PII_EMPLOYEE_ID_PATTERN.sub("[EMPLOYEE_ID]", result)
    # 4. Mask national ID numbers
    result = PII_NATIONAL_ID_PATTERN.sub("[NATIONAL_ID]", result)

    # 5. Mask person names using spaCy if available and trained model is present
    nlp = get_spacy_nlp()
    if nlp is not None and hasattr(nlp, "pipe_names") and "ner" in nlp.pipe_names:
        try:
            if hasattr(nlp, "max_length") and len(result) > nlp.max_length:
                nlp.max_length = max(nlp.max_length, len(result) + 100000)
            doc = nlp(result)
            masked_chars = list(result)
            # Replace PERSON entities from back to front to maintain index offsets
            for ent in reversed(doc.ents):
                if ent.label_ == "PERSON":
                    # Avoid masking operational keywords like "Rig Manager", "Safety Officer", "Operator"
                    ent_text = ent.text.lower()
                    if not any(k in ent_text for k in ["unit", "rig", "plant", "station", "valve", "pump", "well", "operator", "officer", "manager"]):
                        start, end = ent.start_char, ent.end_char
                        masked_chars[start:end] = list("[PERSON]")
            result = "".join(masked_chars)
        except Exception:
            pass

    return result


# High-confidence safety domain spelling normalization dictionary
SAFETY_SPELLING_MAP = {
    "explouser": "exposure",
    "exposur": "exposure",
    "expusure": "exposure",
    "exposer": "exposure",
    "exposuer": "exposure",
    "slipery": "slippery",
    "slipry": "slippery",
    "slippry": "slippery",
    "slipary": "slippery",
    "leek": "leak",
    "leeking": "leaking",
    "leekage": "leakage",
    "injurd": "injured",
    "injuried": "injured",
    "ingured": "injured",
    "saftey": "safety",
    "safty": "safety",
    "electical": "electrical",
    "electic": "electric",
    "electircal": "electrical",
    "elctrical": "electrical",
    "barir": "barrier",
    "barrer": "barrier",
    "barriar": "barrier",
    "chemcial": "chemical",
    "chemiacl": "chemical",
    "pressur": "pressure",
    "presure": "pressure",
    "wellding": "welding",
    "weldng": "welding",
    "flamable": "flammable",
    "temprature": "temperature",
    "tempreture": "temperature",
    "temparature": "temperature",
    "scafold": "scaffold",
    "scafolding": "scaffolding",
    "extingwisher": "extinguisher",
    "extingsher": "extinguisher",
    "hazad": "hazard",
    "hazrd": "hazard",
    "helmit": "helmet",
    "helmt": "helmet",
    "harnes": "harness",
    "entery": "entry",
    "atmostpheric": "atmospheric",
    "atmoshperic": "atmospheric",
    "monitering": "monitoring",
    "inured": "injured",
    "valv": "valve",
    "cylender": "cylinder",
}


def normalize_safety_spelling(text: str) -> str:
    """
    Normalizes high-confidence spelling mistakes and phonetic variants
    in frontline safety reports (e.g. 'explouser' -> 'exposure') without altering standard text.
    """
    if not text:
        return ""

    tokens = text.split()
    corrected_tokens = []
    for tok in tokens:
        # Strip trailing punctuation for dictionary check
        clean_tok = re.sub(r'^[^\w]+|[^\w]+$', '', tok).lower()
        if clean_tok in SAFETY_SPELLING_MAP:
            replacement = SAFETY_SPELLING_MAP[clean_tok]
            # preserve original punctuation
            prefix = tok[:len(tok) - len(tok.lstrip('.,!?;:"\'()[]{}'))]
            suffix = tok[len(tok.rstrip('.,!?;:"\'()[]{}')):]
            corrected_tokens.append(f"{prefix}{replacement}{suffix}")
        else:
            corrected_tokens.append(tok)

    return " ".join(corrected_tokens)


def preserve_negations(text: str) -> str:
    """
    Identifies safety compound negations and binds them into unified tokens
    so tokenizers and vectorizers do not dissolve them into false positives.
    """
    if not text:
        return ""

    normalized = text
    for pattern, replacement in COMPOUND_NEGATIONS:
        normalized = re.sub(pattern, f" {replacement} ", normalized, flags=re.IGNORECASE)

    return normalized


def preprocess_text(text: str, mask_personal_data: bool = True) -> str:
    """
    Normalizes report text while strictly preserving critical safety negations
    and condition indicators (e.g. not, without, missing, failed, damaged).

    Steps:
    1. Handle empty / null input
    2. Normalize line breaks and multiple whitespaces
    3. Normalize safety domain spelling errors (e.g. explouser -> exposure)
    4. Mask PII if enabled
    5. Bind critical compound negations (e.g. 'without helmet' -> 'without_helmet')
    6. Clean redundant whitespace
    """
    if not text or not isinstance(text, str):
        return ""

    # 1. Whitespace and newline normalization
    cleaned = re.sub(r'[\r\n\t]+', ' ', text)
    cleaned = re.sub(r'\s{2,}', ' ', cleaned).strip()

    # 2. Spelling normalization for safety vocabulary
    cleaned = normalize_safety_spelling(cleaned)

    # 3. PII Masking
    if mask_personal_data:
        cleaned = mask_pii(cleaned)

    # 4. Negation preservation
    cleaned = preserve_negations(cleaned)

    # 5. Final whitespace clean
    cleaned = re.sub(r'\s{2,}', ' ', cleaned).strip()
    return cleaned


def safety_aware_tokenize(text: str) -> List[str]:
    """
    Custom tokenizer for safety reports that preserves compound negations,
    safety acronyms, and operational alphanumeric codes (e.g. 11kV, 415V, Rig-04).
    """
    if not text:
        return []

    processed = preprocess_text(text, mask_personal_data=False).lower()
    # Extract alphanumeric tokens, compound tokens with underscores, and hyphenated terms
    tokens = re.findall(r'\b[a-z0-9_]+(?:-[a-z0-9_]+)*\b', processed)
    return tokens
