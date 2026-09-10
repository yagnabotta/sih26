import re
from typing import Dict

def analyze_barriers(text: str) -> Dict[str, str]:
    """
    Analyzes safety controls and barriers mentioned in the report.
    Returns barrier status (BARRIER_PRESENT, BARRIER_MISSING, BARRIER_FAILED, BARRIER_UNKNOWN)
    and a descriptive explanation of barrier health.
    """
    lower_text = text.lower()

    # 1. Missing / Bypassed Barriers
    if re.search(r'\b(ignored.*heat-rest|without.*guard|no guard|missing guard|without required guard|no harness|without harness|no barricade|unbarricaded|without permit|no ptw|no loto|did not lock|without isolation|no tag|no gas test|ignored.*ppe|without.*ppe|entered.*without authorization)\b', lower_text):
        return {
            "status": "BARRIER_MISSING",
            "description": "Primary safety barrier, PPE control, machine guard, or administrative procedure was missing, omitted, or violated."
        }
    
    # 2. Failed Barriers
    if re.search(r'\b(cooling system failed|damaged electrical insulation|damaged insulation|uncontrolled.*pressure|snapped|broke|failed|barrier failed|malfunctioned|cracked|gave way|detached|dislodged|faulty|leak|leaking)\b', lower_text):
        return {
            "status": "BARRIER_FAILED",
            "description": "A safety barrier, cooling system, pressure containment, or physical insulation mechanism experienced failure or degradation."
        }
    
    # 3. Present / Functioning Barriers
    if re.search(r'\b(safety net caught|harness arrested|interlock stopped|emergency stop activated|tripped breaker|prevented injury|alarm sounded|gas detector alerted)\b', lower_text):
        return {
            "status": "BARRIER_PRESENT",
            "description": "A secondary safety barrier or warning control successfully activated and prevented actual severe contact/harm."
        }
    
    # 4. Specific Contextual Uncertainty (e.g. heat exposure without barrier data)
    if re.search(r'\b(heat|extreme heat|high temperature)\b', lower_text):
        return {
            "status": "BARRIER_INSUFFICIENT_INFO",
            "description": "Insufficient information regarding heat controls"
        }

    # 5. General Unknown / Insufficient Barrier Data
    return {
        "status": "BARRIER_INSUFFICIENT_INFO",
        "description": "Insufficient Information"
    }
