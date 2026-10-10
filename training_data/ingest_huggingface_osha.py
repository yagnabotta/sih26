"""
Hugging Face OSHA Incident Dataset Ingestion Pipeline
=====================================================
Ingests and standardizes real-world workplace accident narratives from US OSHA Severe Injury
Reports (SPECTRA: Simar123456/spectra-osha-sir on Hugging Face).

Combines with:
1. Real OSHA incident reports (manufacturing, industrial, energy, construction)
2. 1,500 balanced non-SIF operational safety observations & near-misses
3. Expert-curated refinery incident reports with worker phrasing & misspellings
4. Baseline foundational dataset

Produces:
- training_data/processed/osha_ingested_dataset.csv
- ml/data/sif_dataset_v4.csv (Combined balanced master training dataset v4)
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
    Follows National Safety Council (NSC) & Campbell Institute SIF precursor definitions.
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
        any(k in t_low for k in ['forklift', 'crane', 'press', 'line of fire', 'pinch point', 'conveyor'])
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


def generate_balanced_non_sif_observations(count=1500):
    """
    Generates realistic non-SIF industrial observations, routine audits,
    minor housekeeping, tool inspections, and negative controls.
    """
    locations = [
        "Pump House 1", "Workshop 4", "Control Annex", "Warehouse B", "Utility Yard",
        "Tank 102 Perimeter", "Main Gate 3", "Substation Walkway", "Office Corridor",
        "Maintenance Bay 2", "Cooling Tower Area", "Compressor Shed", "Drum Storage Yard"
    ]
    
    actions = [
        "conducted routine housekeeping walkdown, minor water puddle mopped and wet floor sign posted",
        "noticed small 30ml oil drop on motor casing caught in drip tray, wiped with absorbent pad",
        "replaced burned out fluorescent light tube on exterior stairway, area illumination restored",
        "tested eyewash station and emergency shower flow rate on scheduled monthly test, normal operation",
        "conducted pre-shift toolbox talk discussing heat stress prevention and hydration guidelines",
        "inspected dry powder fire extinguisher gauge, verified pressure needle in green zone with intact tag",
        "stored loose hand tools in designated metal shadow board after shift completion",
        "performed routine atmospheric gas test inside battery room, 20.9% oxygen and 0% LEL confirmed",
        "removed empty wooden pallet from walkway and stacked in designated outdoor storage zone",
        "replaced damaged safety warning sign on railing near maintenance workshop entrance",
        "routine shift handover completed with zero injuries and all equipment functioning normally",
        "inspected portable electrical lead for physical scuffs, insulation intact and tag up to date",
        "small paper trash can smoking slightly, extinguished immediately with water cup, zero damage",
        "tightened loose screw on metal file cabinet drawer handle in operations shift office",
        "conducted weekly 5S housekeeping audit of tool storage locker, all items accounted for"
    ]

    records = []
    for i in range(count):
        loc = np.random.choice(locations)
        act = np.random.choice(actions)
        date = f"2024-{np.random.randint(1,13):02d}-{np.random.randint(1,29):02d}"
        score = int(np.random.randint(5, 25))
        
        # Add slight natural wording variations
        prefixes = [
            f"Operator at {loc} ",
            f"Routine shift inspection at {loc}: ",
            f"During walkdown of {loc}, ",
            f"Field technician noted at {loc} that ",
            f"Safety observation logged for {loc}: "
        ]
        prefix = np.random.choice(prefixes)
        text = f"{prefix}{act}."

        records.append({
            "report_id": f"OBS-NONSIF-{i+1:05d}",
            "report_type": "Observation",
            "date": date,
            "location": loc,
            "activity": "Routine Maintenance / Housekeeping",
            "barrier_failure": "None Identified / Controls Active",
            "observed_severity": "Low",
            "report_text": text,
            "incident_description": text,
            "sif_potential": "Non-SIF-potential",
            "life_saving_rule": "General Workplace Housekeeping Standards",
            "data_source": "Industrial Field Safety Observations",
            "incident_type": "Workplace Observation",
            "severity_level": "Low",
            "expected_risk_score": score,
            "risk_increasing_factors": "Minor localized surface condition",
            "risk_reducing_factors": "Immediate housekeeping correction and verified zero high energy",
            "score_explanation": "Routine workplace safety observation with verified absence of high energy."
        })

    return pd.DataFrame(records)


def main():
    parquet_path = "training_data/spectra_osha_val.parquet"
    if not os.path.exists(parquet_path):
        print(f"Loading {parquet_path}...")
        df_raw = pd.read_parquet("https://huggingface.co/datasets/Simar123456/spectra-osha-sir/resolve/main/val.parquet")
        df_raw.to_parquet(parquet_path)
    else:
        df_raw = pd.read_parquet(parquet_path)

    print(f"Loaded raw OSHA dataset: {len(df_raw)} records")

    valid_df = df_raw[df_raw['narrative'].str.len() > 35].copy()
    print(f"Valid length narratives: {len(valid_df)}")

    osha_records = []
    for idx, row in valid_df.iterrows():
        text = str(row['narrative']).strip()
        classification = classify_osha_incident(row)
        
        osha_records.append({
            "report_id": f"OSHA-SIR-{row['id']}",
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
            "risk_reducing_factors": "Post-incident emergency medical treatment logged",
            "score_explanation": f"Official OSHA Severe Injury Report record ({row.get('nature_title')})."
        })

    osha_df = pd.DataFrame(osha_records)
    print(f"Classified OSHA records: {len(osha_df)}")

    # Sample 1,500 representative OSHA SIF incidents
    sif_osha = osha_df[osha_df['sif_potential'] == 'SIF-potential'].sample(n=1500, random_state=SEED)

    # Generate 1,500 diverse industrial non-SIF observations
    non_sif_df = generate_balanced_non_sif_observations(count=1500)
    print(f"Generated balanced non-SIF records: {len(non_sif_df)}")

    # Save processed OSHA dataset
    os.makedirs("training_data/processed", exist_ok=True)
    osha_df.to_csv("training_data/processed/osha_ingested_dataset.csv", index=False)

    # Load baseline datasets
    v2_df = pd.read_csv("ml/data/sif_dataset_v2.csv")
    refinery_df = pd.read_csv("training_data/industrial_refinery_incidents.csv")
    print(f"Base v2 records: {len(v2_df)} | Refinery records: {len(refinery_df)}")

    # Combine into v4 master dataset
    combined_v4 = pd.concat([
        v2_df,
        refinery_df,
        sif_osha,
        non_sif_df
    ], ignore_index=True)

    combined_v4 = combined_v4.drop_duplicates(subset=['report_text']).reset_index(drop=True)
    print(f"\n==========================================")
    print(f"Combined V4 master dataset: {len(combined_v4)} records")
    print("Class distribution:")
    print(combined_v4['sif_potential'].value_counts())
    print("Severity distribution (where present):")
    if 'severity_level' in combined_v4.columns:
        print(combined_v4['severity_level'].value_counts(dropna=False).head(5))

    v4_path = "ml/data/sif_dataset_v4.csv"
    combined_v4.to_csv(v4_path, index=False)
    print(f"Saved master dataset V4 to: {v4_path}")


if __name__ == "__main__":
    main()
