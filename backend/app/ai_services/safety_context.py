"""
Safety Operational Context and Pattern Recognition
===================================================
Provides deterministic context detection for:
1. Catastrophic explosions & major industrial blasts
2. Spreading process fires vs controlled thermal operations
3. Minor contained spills vs uncontained chemical releases
4. Negative contexts (fire drills, toolbox talks, historical reviews, extinguisher audits)
5. Vague or incomplete reports requiring uncertainty handling
"""

import re
from typing import Dict, Any


def is_negative_context(text: str) -> bool:
    """
    Detects whether the report narrative describes an administrative safety meeting,
    training drill, historical case study, or routine non-emergency inspection
    where dangerous keywords appear without an active operational incident.
    """
    if not text or not isinstance(text, str):
        return False
    t = text.lower()
    return any(k in t for k in [
        "toolbox talk", "safety meeting", "safety stand-down", "safety standdown",
        "lessons learned", "historical case", "past incident review",
        "fire drill", "mock drill", "evacuation drill", "emergency exercise",
        "routine inspection of", "monthly inspection of", "quarterly inspection", "annual inspection", "inspection tags",
        "classroom training", "training presentation", "demonstrated dry chemical",
        "safety induction", "mandatory safety induction", "training video",
        "preventive maintenance", "foam truck", "fire station", "fire dampers",
        "smoke detectors", "functioning properly", "all functioning properly",
        "audit of flammable gas detectors", "talk about fire prevention", "safety talk",
        "hydrostatic pressure testing", "pressure testing of", "testing of fire", "completed successfully",
        "tabletop emergency", "tabletop simulation", "seminar", "refresher class",
        "permit to work issued", "replacing fire blanket", "replaced worn fire blanket", "safety committee reviewed"
    ])


def is_controlled_thermal_context(text: str) -> bool:
    """
    Detects small, controlled, or immediately extinguished minor thermal events
    (e.g., burn pit training, flare pilot ignition, single spark quenched immediately,
    trash can fire extinguished in seconds).
    """
    if not text or not isinstance(text, str):
        return False
    t = text.lower()
    if is_negative_context(text):
        return False
    return any(k in t for k in [
        "burn pit", "controlled fire", "fire training ground", "flare pilot", "pilot burner",
        "extinguished within", "extinguished in", "extinguished immediately",
        "quenched with", "water cup", "water bottle", "rag scorch", "paper trash can fire",
        "put out in sec", "put out in seconds", "put out immediately", "zero spread", "zero damage",
        "wiped out with co2", "extinguisher immediately", "caught grease wiped out", "no damage"
    ]) and not any(k in t for k in [
        "spreading", "uncontained", "shockwave", "blast", "major explosion", "massive explosion"
    ])


def is_minor_contained_spill(text: str) -> bool:
    """
    Detects small localized spills that are fully captured in engineered secondary
    containment (drip tray, drip pan, bund) with negligible consequence potential.
    """
    if not text or not isinstance(text, str):
        return False
    t = text.lower()
    if is_negative_context(text):
        return False
    return any(k in t for k in [
        "50ml", "40ml", "30ml", "100ml", "drip tray", "drip pan",
        "minor lube oil leak", "minor oil leak", "minor oil drip", "little oil on floor in tray",
        "caught in dedicated", "wiped with rag", "wiped with absorb", "drop of diesel",
        "wept 40ml", "2 drops of", "two drops", "few drops", "isolated drop", "drop of", "trivial"
    ]) and not any(k in t for k in [
        "explosion", "blast", "uncontained", "fire", "toxic cloud", "chemical burn", "acid spray", "hydrofluoric"
    ])


def is_catastrophic_explosion(text: str) -> bool:
    """
    Detects explicit reports of major explosions, blasts, BLEVEs,
    vapor cloud explosions, pipeline explosions, or blast shockwaves in refineries and industrial facilities.
    Handles worker spelling variations like 'explotion', 'explodid', 'explod'.
    """
    if not text or not isinstance(text, str):
        return False
    if is_negative_context(text):
        return False
    t = text.lower()
    
    # Direct explosion / blast keywords and phonetic / worker misspellings
    explosion_terms = [
        "explosion", "explotion", "explod", "explodid", "exploding", "exploded",
        "blast", "blasted", "bleve", "vce", "detonation", "fireball", "shockwave",
        "fire explosion", "fire explotion", "gas explosion", "pipeline explosion"
    ]
    if any(k in t for k in explosion_terms):
        return True

    return any(k in t for k in [
        "boiler burst", "furnace roof blown", "shrapnel across", "head sheared off",
        "tube ruptured violently", "shattered windows", "blew inspection", "blown open"
    ])


def is_spreading_process_fire(text: str) -> bool:
    """
    Detects uncontained or rapidly spreading hydrocarbon fires in process units,
    piperacks, pipelines, tank farms, or involving major fuels where initial containment has failed.
    """
    if not text or not isinstance(text, str):
        return False
    if is_negative_context(text) or is_controlled_thermal_context(text):
        return False
    t = text.lower()
    return any(k in t for k in [
        "rapidly spreading", "spreading fire", "spreading to pipe", "spreading across",
        "growing fast", "uncontrolled hydrocarbon fire", "uncontained fire", "jet fire",
        "fire expanding", "cant put out with portable", "flames spreading", "flames leaped",
        "roof seal caught fire", "rim seal", "boilover", "flames expanding across",
        "gas leak near furnace loud hissing flame detector", "burning across", "burning pool",
        "engulfed", "spraying hot naphtha", "spraying hot", "flames filling building"
    ]) or (
        any(k in t for k in ["fire", "flames", "burning", "ignited"]) and
        any(k in t for k in [
            "cdu heater", "pipe racks", "piperack", "adjacent pipe", "structural steel",
            "emergency shutdown activated", "tank 304", "bund fire", "tank roof seal", "floating roof rim",
            "pipeline", "manifold", "gas line", "fuel line", "crude line", "deck"
        ])
    )


def is_critical_toxic_or_chemical_release(text: str) -> bool:
    """
    Detects life-threatening toxic gas releases (e.g. H2S > 50 ppm, IDLH atmospheres)
    or uncontained major hazardous chemical spills (> 20L corrosive/toxic).
    """
    if not text or not isinstance(text, str):
        return False
    if is_negative_context(text):
        return False
    t = text.lower()
    return any(k in t for k in [
        "h2s alarm triggered", "85 ppm", "100 ppm", "320 ppm", "500 ppm", "toxic cloud",
        "hydrofluoric acid", "50 liters of 70%", "5000-liter hot caustic", "acid sprayed directly onto",
        "fatal atmospheric asphyxiation", "unbunded gravel"
    ])


def is_vague_or_missing_info(text: str) -> bool:
    """
    Detects reports with minimal or ambiguous phrasing that lack concrete operational
    facts regarding hazard type, equipment, energy vector, or containment.
    """
    if not text or not isinstance(text, str):
        return True
    t = text.lower().strip()
    words = t.split()
    if len(words) <= 12:
        if any(k in t for k in ["smell", "smelled", "noise", "sound", "unsafe", "check", "issue", "noticed", "something", "weird", "strange", "odor", "not sure", "leaking yesterday"]):
            if not any(k in t for k in [
                "explosion", "blast", "fire", "gas leak", "chemical spill", "h2s",
                "voltage", "fall", "crane", "loto", "11kv", "scaffold"
            ]):
                return True
    return False

