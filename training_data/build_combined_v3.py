import pandas as pd
from pathlib import Path

v2_path = Path("ml/data/sif_dataset_v2.csv")
refinery_path = Path("training_data/industrial_refinery_incidents.csv")
v3_path = Path("ml/data/sif_dataset_v3.csv")

df_v2 = pd.read_csv(v2_path)
df_ref = pd.read_csv(refinery_path)

print(f"V2 records: {len(df_v2)}")
print(f"Refinery records: {len(df_ref)}")

# Align columns
df_ref_aligned = df_ref.copy()
if "report_type" not in df_ref_aligned.columns:
    df_ref_aligned["report_type"] = "Near-Miss"
if "date" not in df_ref_aligned.columns:
    df_ref_aligned["date"] = "2026-10-10"
if "activity" not in df_ref_aligned.columns:
    df_ref_aligned["activity"] = "Refinery Operations"
if "life_saving_rule" not in df_ref_aligned.columns:
    df_ref_aligned["life_saving_rule"] = "Process Safety"

# Combine
combined_df = pd.concat([df_v2, df_ref_aligned], ignore_index=True)
combined_df.to_csv(v3_path, index=False)
print(f"Combined V3 records: {len(combined_df)}")
print(f"Saved to: {v3_path}")
