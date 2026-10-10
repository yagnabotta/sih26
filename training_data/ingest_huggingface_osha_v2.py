"""
Enhanced Hugging Face OSHA Dataset Ingestion Pipeline v2
========================================================
Combines:
1. Real OSHA incident records from SPECTRA (val.parquet + test.parquet = 13,762 available records)
2. Targeted balanced pairs for under-represented safety issues:
   - Oil Spills (Contained 50ml vs Catastrophic 5000L)
   - Falling Objects (Dropped 200g hand tool vs 200kg crane load)
   - Broken Machines (Cosmetic indicator LED vs Unguarded nip point)
   - Blocked Emergency Exits (Cardboard box vs Padlocked fire exit)
   - Slippery Floors (Entrance floor mat vs Elevated oily catwalk)
3. 136 Expert refinery field reports with informal phrasing & typos
4. Baseline foundational dataset

Produces:
- ml/data/sif_dataset_v5.csv (Comprehensive balanced master dataset v5)
"""

import os
import re
import pandas as pd
import numpy as np

SEED = 42
np.random.seed(SEED)

def classify_osha_incident(row):
    """
    Maps OSHA event, nature of injury, and narrative to SIF potential and risk tier.
    """
    text = str(row.get('narrative', '')).strip()
    ev = str(row.get('event_title', '')).lower()
    nat = str(row.get('nature_title', '')).lower()
    amp = int(row.get('amputation_bin', 0) or 0)
    hosp = int(row.get('hospitalized_bin', 0) or 0)
    t_low = text.lower()

    # 1. CRITICAL SIF (Score 86 - 96)
    is_critical = (
        amp == 1 or
        'amputation' in nat or
        any(k in ev for k in ['greater than 220 volts', 'high voltage', 'electrocution', 'arc flash']) or
        any(k in nat for k in ['electric shock', 'heat (thermal) burns', 'chemical burns', 'crushing injuries', 'intracranial', 'internal injuries']) or
        any(k in t_low for k in ['explosion', 'exploded', 'blast', 'fireball', 'toxic cloud', 'h2s', 'bleve']) or
        ('fall to lower level' in ev and 'less than 6 feet' not in ev)
    )

    if is_critical:
        score = int(np.random.randint(88, 96))
        return {
            'sif_potential': 'SIF-potential',
            'severity_level': 'Critical',
            'expected_risk_score': score,
            'incident_type': 'High-Energy Industrial SIF Precursor',
            'barrier_failure': 'Primary physical isolation or guarding breached'
        }

    # 2. SERIOUS SIF (Score 70 - 85)
    is_serious = (
        hosp == 1 or
        any(k in ev for k in ['caught in running equipment', 'compressed or pinched by shifting', 'struck by object falling from vehicle', 'pedestrian struck by']) or
        'fracture' in nat or
        any(k in t_low for k in ['forklift', 'crane', 'press', 'line of fire', 'pinch point', 'conveyor', 'crushed by'])
    )

    if is_serious:
        score = int(np.random.randint(72, 85))
        return {
            'sif_potential': 'SIF-potential',
            'severity_level': 'Serious',
            'expected_risk_score': score,
            'incident_type': 'Operational Equipment Injury',
            'barrier_failure': 'Equipment safeguard or exclusion boundary deficient'
        }

    # 3. MODERATE NON-SIF (Score 30 - 65)
    score = int(np.random.randint(32, 55))
    return {
        'sif_potential': 'Non-SIF-potential',
        'severity_level': 'Moderate',
        'expected_risk_score': score,
        'incident_type': 'Low-Energy Workplace Occurrence',
        'barrier_failure': 'Housekeeping or surface condition'
    }


def generate_targeted_safety_pairs():
    """
    Generates balanced high-SIF vs low-Non-SIF pairs for under-represented safety issues.
    """
    records = []
    
    # 1. OIL SPILL PAIRS
    oil_high = [
        "Major crude oil transfer pipeline ruptured, spraying 5000 liters of hot oil onto pipe racks near CDU furnace.",
        "High pressure hydraulic oil line burst at 3000 psi, creating oil mist cloud directly over running diesel generator.",
        "Uncontained 2000-liter lube oil spill spreading from tank farm bund breach towards storm water drainage.",
        "Heavy fuel oil leak spraying onto uninsulated steam turbine casing, creating intense vapor and fire hazard.",
        "Fuel oil tank overfill discharged 10 tons of oil into pump station area with operators in line of fire."
    ]
    oil_low = [
        "Minor lube oil seepage of approximately 50ml from valve packing into dedicated concrete drip tray, wiped with pad.",
        "Small 20ml oil drip caught in drip pan beneath motor gearbox, zero heat source, cleaned during routine maintenance.",
        "Routine walkdown noted 30ml oil stain inside compressor skid drip tray, wiped clean with absorbent rag.",
        "A few drops of lubricating oil noticed on grease nipple, wiped off with shop rag during daily inspection.",
        "Small oil drip tray under hydraulic pump emptied and cleaned with absorbent pads during routine shift audit."
    ]
    for text in oil_high:
        records.append(("SIF-potential", "Critical", 92, "Oil Spill", text, "Uncontained High-Volume Oil Release", "Failed Primary Containment"))
    for text in oil_low:
        records.append(("Non-SIF-potential", "Low", 15, "Oil Spill", text, "Minor Contained Seepage", "Controls Active / Drip Tray Intact"))

    # 2. FALLING OBJECTS PAIRS
    fall_high = [
        "A 200kg steel scaffolding tube dropped from 15 meters elevation into active worker walkway below.",
        "Heavy 5-ton crane spreader bar dropped 8 meters during tandem lift when rigging sling sheared.",
        "Dropped object: 50kg valve bonnet fell from pipe bridge walkway missing rigger by 1 meter.",
        "Scaffolding clamp fell from 25 meters height through safety net onto drill deck work area.",
        "Unsecured 30kg metal grating panel dislodged from 4th floor platform and plummeted to ground level."
    ]
    fall_low = [
        "Small plastic roll weighing 100 grams slipped from worker hand onto soft grass ground, no one nearby.",
        "A 50g rubber washer fell from 1 meter height during bench assembly onto rubber work mat.",
        "Plastic pen dropped from shirt pocket onto office floor, picked up immediately.",
        "Lightweight plastic safety tag fell from valve handle onto floor grating, retrieved and reattached.",
        "Small 150g aluminum tape roll slipped from maintenance toolbelt onto gravel ground from waist height."
    ]
    for text in fall_high:
        records.append(("SIF-potential", "Critical", 90, "Falling Objects", text, "Heavy Dropped Object", "Missing Dropped Object Barrier"))
    for text in fall_low:
        records.append(("Non-SIF-potential", "Low", 12, "Falling Objects", text, "Incidental Light Object Drop", "Negligible Mass / Zero Energy"))

    # 3. BROKEN MACHINE PAIRS
    machine_high = [
        "Heavy industrial conveyor tail pulley guard missing, exposing high-speed rotating nip point to operator.",
        "Lathe machine emergency stop switch broken and inoperable while rotating at 1500 RPM.",
        "Centrifugal pump mechanical seal shattered violently throwing metal fragments across pump bay.",
        "Overhead crane hoist limit switch broken, causing hook block to two-block and snap hoisting cable.",
        "Hydraulic press safety light curtain bypassed with machine running at full stamping tonnage."
    ]
    machine_low = [
        "LED status indicator lamp burned out on packaging machine control panel, replacement bulb ordered.",
        "Plastic volume adjustment knob on workshop machine cracked, machine functions normally.",
        "Small cosmetic scratch on lathe metal outer housing cover observed during weekly 5S audit.",
        "Rubber vibration dampening foot on bench drill slightly worn, scheduled for next quarterly maintenance.",
        "Label sticker on machine serial number plate peeling at corner, replaced with new adhesive tag."
    ]
    for text in machine_high:
        records.append(("SIF-potential", "Critical", 88, "Broken Machine", text, "Catastrophic Machinery Safeguard Failure", "Barrier Missing / Bypassed"))
    for text in machine_low:
        records.append(("Non-SIF-potential", "Low", 14, "Broken Machine", text, "Cosmetic Machine Wear", "Protective Safeguards 100% Intact"))

    # 4. BLOCKED EMERGENCY EXIT PAIRS
    exit_high = [
        "Primary emergency exit door in compressor house padlocked shut during high-pressure gas operations.",
        "Emergency fire escape door welded shut during unauthorized construction work in active process unit.",
        "Emergency exit corridor completely blocked by stacked steel beams and scaffolding materials, zero egress.",
        "Fire exit door handle broken and door jammed closed from inside control room during night shift.",
        "Exit stairway completely obstructed by heavy machinery crate leaving workers with zero escape route."
    ]
    exit_low = [
        "Single empty cardboard box placed near emergency exit door during mail delivery, immediately relocated.",
        "Cleaning mop temporarily resting against wall 2 meters from emergency exit door, removed by cleaner.",
        "Temporary plastic trash bag placed near exit corridor during office housekeeping, cleared within 5 minutes.",
        "Weekly inspection verified emergency exit push bar operates smoothly, exit signage illuminated.",
        "Small doormat at emergency exit adjusted after becoming slightly wrinkled, clear exit confirmed."
    ]
    for text in exit_high:
        records.append(("SIF-potential", "Critical", 86, "Blocked Emergency Exit", text, "Emergency Egress Blocked", "Emergency Barrier Compromised"))
    for text in exit_low:
        records.append(("Non-SIF-potential", "Low", 15, "Blocked Emergency Exit", text, "Minor Temporary Housekeeping Near Exit", "Egress Path Uncompromised"))

    # 5. SLIPPERY FLOOR PAIRS
    slip_high = [
        "Heavy lube oil slick covering elevated steel catwalk 15 meters above ground without toe board or safety net.",
        "Large puddle of hydraulic fluid covering floor directly in front of energized 11kV open switchgear panel.",
        "Ice and crude oil mixture on drilling rig drill floor rotary table creating severe slip hazard into moving machinery.",
        "Slippery chemical condensate on ladder rungs leading to 20-meter reactor platform without fall arrest.",
        "Heavy grease spill on dark industrial stairway steps without handrail lighting."
    ]
    slip_low = [
        "Small water splash from drinking water cooler onto linoleum floor, wiped immediately and warning cone placed.",
        "Light rain moisture on main office entrance rubber floor mat, warning sign displayed at entrance.",
        "Minor dust accumulation on warehouse concrete walkway mopped during routine afternoon shift cleaning.",
        "Worker noticed small wet patch near restroom sink on tile floor and placed yellow cautionary cone.",
        "Walkdown noted routine clean and dry floor conditions throughout central control room."
    ]
    for text in slip_high:
        records.append(("SIF-potential", "Critical", 86, "Slippery Floor", text, "High-Energy Compound Slip Hazard", "Barrier Missing / High Consequence"))
    for text in slip_low:
        records.append(("Non-SIF-potential", "Low", 10, "Slippery Floor", text, "Minor Low-Severity Floor Moisture", "Housekeeping Prompt / Zero Energy"))

    df_pairs = []
    for i, (sif, sev, score, cat, desc, inc_type, barrier) in enumerate(records):
        df_pairs.append({
            "report_id": f"PAIR-{cat[:3].upper()}-{i+1:04d}",
            "report_type": "Observation" if sif == "Non-SIF-potential" else "Near-Miss",
            "date": "2024-05-15",
            "location": "Industrial Facility",
            "activity": f"{cat} Operations",
            "barrier_failure": barrier,
            "observed_severity": sev,
            "report_text": desc,
            "incident_description": desc,
            "sif_potential": sif,
            "life_saving_rule": "Work Authorisation" if sif == "SIF-potential" else "General Workplace Housekeeping Standards",
            "data_source": "Expert Targeted Safety Pairs",
            "incident_type": inc_type,
            "severity_level": sev,
            "expected_risk_score": score,
            "risk_increasing_factors": f"Specific hazard category: {cat}",
            "risk_reducing_factors": "Verified engineered controls",
            "score_explanation": f"Targeted pair for {cat} ({sev})."
        })

    return pd.DataFrame(df_pairs)


def main():
    val_path = "training_data/spectra_osha_val.parquet"
    test_path = "training_data/spectra_osha_test.parquet"

    df_val = pd.read_parquet(val_path)
    df_test = pd.read_parquet(test_path)
    df_combined_raw = pd.concat([df_val, df_test], ignore_index=True)
    print(f"Total raw OSHA records available (val + test): {len(df_combined_raw)}")

    valid_df = df_combined_raw[df_combined_raw['narrative'].str.len() > 35].copy()
    print(f"Valid length OSHA records: {len(valid_df)}")

    # Classify all OSHA records
    osha_records = []
    for idx, row in valid_df.iterrows():
        text = str(row['narrative']).strip()
        classification = classify_osha_incident(row)
        osha_records.append({
            "report_id": f"OSHA-SPECTRA-{row['id']}",
            "report_type": "Incident",
            "date": str(row.get('date', '2023-01-01'))[:10],
            "location": f"{str(row.get('sector', 'Industrial')).title()} Facility",
            "activity": str(row.get('event_title', 'Operational Task'))[:60],
            "barrier_failure": classification['barrier_failure'],
            "observed_severity": classification['severity_level'],
            "report_text": text,
            "incident_description": text,
            "sif_potential": classification['sif_potential'],
            "life_saving_rule": "Work Authorisation" if "Critical" in classification['severity_level'] else "General Workplace Housekeeping Standards",
            "data_source": "US OSHA Severe Injury Reports (HuggingFace)",
            "incident_type": classification['incident_type'],
            "severity_level": classification['severity_level'],
            "expected_risk_score": classification['expected_risk_score'],
            "risk_increasing_factors": f"Event: {row.get('event_title')}, Nature: {row.get('nature_title')}",
            "risk_reducing_factors": "Medical treatment logged",
            "score_explanation": f"OSHA Severe Injury record ({row.get('nature_title')})."
        })

    osha_df = pd.DataFrame(osha_records)
    print(f"Classified OSHA records: {len(osha_df)}")

    # Sample 2,000 diverse OSHA SIF incidents
    sif_osha = osha_df[osha_df['sif_potential'] == 'SIF-potential'].sample(n=2000, random_state=SEED)

    # Generate targeted safety pairs (oil spills, falling objects, machines, exits, slips)
    pairs_df = generate_targeted_safety_pairs()
    print(f"Targeted safety pairs generated: {len(pairs_df)}")

    # Load previous v4 master dataset
    v4_df = pd.read_csv("ml/data/sif_dataset_v4.csv")
    print(f"Previous V4 dataset size: {len(v4_df)}")

    # Combine into v5 master dataset
    combined_v5 = pd.concat([
        v4_df,
        sif_osha,
        pairs_df
    ], ignore_index=True)

    combined_v5 = combined_v5.drop_duplicates(subset=['report_text']).reset_index(drop=True)
    print("\n" + "=" * 60)
    print(f"MASTER DATASET V5 CREATED: {len(combined_v5)} RECORDS")
    print("Class distribution:")
    print(combined_v5['sif_potential'].value_counts())
    print("=" * 60)

    v5_path = "ml/data/sif_dataset_v5.csv"
    combined_v5.to_csv(v5_path, index=False)
    print(f"Saved master dataset V5 to: {v5_path}")


if __name__ == "__main__":
    main()
