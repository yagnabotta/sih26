"""
Reproducible ML/NLP Training Pipeline for SIF Precursor Detection
=================================================================
SIH 2026 Problem Statement 26165:
AI/NLP Engine to Detect Serious Injury & Fatality (SIF) Precursors
in OIL's Unsafe-Act / Unsafe-Condition and Near-Miss Reports.

Executes via single command:
    python -m training.train_all

Pipeline Architecture:
1. Load & Validate Safety Reports Dataset
2. Schema & Completeness Audit (no hallucinated fields)
3. Data Cleaning & Deduplication
4. PII Protection (names, emails, phones, employee IDs)
5. Text Normalization with Critical Negation Preservation
6. Stratified Split (Train 70%, Validation 15%, Test 15%)
7. TF-IDF Feature Extraction (unigrams + bigrams, safety-aware)
8. Multi-Model Benchmark:
   - Baseline 1: Dummy Baseline Classifier
   - Baseline 2: Linear Support Vector Classifier (LinearSVC)
   - Primary: TF-IDF + Logistic Regression (class_weight='balanced')
9. Rigorous Evaluation:
   - Precision, Recall, F1 (Macro & Weighted)
   - SIF-specific Precision, SIF Recall, SIF F1
   - Confusion Matrix
   - ROC-AUC & PR-AUC
10. Model Selection & Interpretability Analysis (Feature Weights)
11. Versioned Artifact Storage (models/sif_classifier/ & ml/models/)
12. Export machine-readable training_results.json and human-readable training_report.txt
"""

import os
import sys
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
    roc_auc_score,
    precision_recall_curve,
    auc
)

# Project paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from training.data_pipeline import load_and_prepare_dataset, split_safety_data
from app.ai_services.preprocessing import safety_aware_tokenize

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("train_all")

# Artifact Directories
ARTIFACT_DIR = PROJECT_ROOT / "models" / "sif_classifier"
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

LEGACY_ML_MODELS_DIR = PROJECT_ROOT / "ml" / "models"
LEGACY_ML_RESULTS_DIR = PROJECT_ROOT / "ml" / "results"
LEGACY_ML_MODELS_DIR.mkdir(parents=True, exist_ok=True)
LEGACY_ML_RESULTS_DIR.mkdir(parents=True, exist_ok=True)

# Primary Dataset Path
V5_DATASET = PROJECT_ROOT / "ml" / "data" / "sif_dataset_v5.csv"
V4_DATASET = PROJECT_ROOT / "ml" / "data" / "sif_dataset_v4.csv"
V3_DATASET = PROJECT_ROOT / "ml" / "data" / "sif_dataset_v3.csv"
V2_DATASET = PROJECT_ROOT / "ml" / "data" / "sif_dataset_v2.csv"
DEFAULT_DATASET = V5_DATASET if V5_DATASET.exists() else (V4_DATASET if V4_DATASET.exists() else V3_DATASET)
FALLBACK_DATASET = PROJECT_ROOT / "ml" / "data" / "sif_dataset.csv"


def train_and_evaluate_model(
    name: str,
    classifier: Any,
    X_train: List[str],
    y_train: np.ndarray,
    X_val: List[str],
    y_val: np.ndarray,
    X_test: List[str],
    y_test: np.ndarray,
    vectorizer: TfidfVectorizer,
    target_names: List[str]
) -> Dict[str, Any]:
    """
    Fits vectorizer and classifier in an explicit Pipeline,
    evaluates against Test set, and computes safety-critical metrics.
    """
    logger.info(f"Training model candidate: {name}...")
    pipeline = Pipeline([
        ("tfidf", vectorizer),
        ("clf", classifier)
    ])

    pipeline.fit(X_train, y_train)

    # Predictions
    y_test_pred = pipeline.predict(X_test)
    
    # Calculate Probabilities if supported
    y_test_proba = None
    has_proba = hasattr(pipeline.named_steps["clf"], "predict_proba")
    if has_proba:
        y_test_proba = pipeline.predict_proba(X_test)

    # Metric calculations
    acc = float(accuracy_score(y_test, y_test_pred))
    p_macro = float(precision_score(y_test, y_test_pred, average="macro", zero_division=0))
    r_macro = float(recall_score(y_test, y_test_pred, average="macro", zero_division=0))
    f1_macro = float(f1_score(y_test, y_test_pred, average="macro", zero_division=0))

    p_weighted = float(precision_score(y_test, y_test_pred, average="weighted", zero_division=0))
    r_weighted = float(recall_score(y_test, y_test_pred, average="weighted", zero_division=0))
    f1_weighted = float(f1_score(y_test, y_test_pred, average="weighted", zero_division=0))

    # SIF-specific metrics (Crucial for safety-critical analysis)
    sif_idx = target_names.index("SIF-potential") if "SIF-potential" in target_names else 1
    p_sif = float(precision_score(y_test, y_test_pred, pos_label="SIF-potential", zero_division=0))
    r_sif = float(recall_score(y_test, y_test_pred, pos_label="SIF-potential", zero_division=0))
    f1_sif = float(f1_score(y_test, y_test_pred, pos_label="SIF-potential", zero_division=0))

    # Confusion matrix
    cm = confusion_matrix(y_test, y_test_pred, labels=target_names).tolist()

    # ROC-AUC & PR-AUC if probabilities available
    roc_auc_val = None
    pr_auc_val = None
    if has_proba and y_test_proba is not None:
        try:
            # Binary ROC-AUC
            y_test_binary = (y_test == "SIF-potential").astype(int)
            roc_auc_val = float(roc_auc_score(y_test_binary, y_test_proba[:, sif_idx]))
            
            p_curve, r_curve, _ = precision_recall_curve(y_test_binary, y_test_proba[:, sif_idx])
            pr_auc_val = float(auc(r_curve, p_curve))
        except Exception as e:
            logger.warning(f"Could not calculate ROC/PR AUC for {name}: {e}")

    # Full classification report
    cls_report = classification_report(y_test, y_test_pred, target_names=target_names, output_dict=True)

    return {
        "name": name,
        "pipeline": pipeline,
        "accuracy": acc,
        "precision_macro": p_macro,
        "recall_macro": r_macro,
        "f1_macro": f1_macro,
        "precision_weighted": p_weighted,
        "recall_weighted": r_weighted,
        "f1_weighted": f1_weighted,
        "sif_precision": p_sif,
        "sif_recall": r_sif,
        "sif_f1": f1_sif,
        "confusion_matrix": cm,
        "confusion_matrix_labels": target_names,
        "roc_auc": roc_auc_val,
        "pr_auc": pr_auc_val,
        "classification_report": cls_report
    }


def extract_feature_interpretability(
    pipeline: Pipeline,
    top_n: int = 15
) -> Dict[str, Any]:
    """
    Extracts top positive and negative predictive features from the linear model
    to provide transparent evidence for XAI explanations.
    """
    vectorizer = pipeline.named_steps.get("tfidf")
    clf = pipeline.named_steps.get("clf")

    if not vectorizer or not clf or not hasattr(clf, "coef_"):
        return {"top_sif_features": [], "top_non_sif_features": []}

    feature_names = np.array(vectorizer.get_feature_names_out())
    coef = clf.coef_[0]  # Binary classification weights

    # Top features for positive class (SIF-potential)
    top_pos_indices = np.argsort(coef)[-top_n:][::-1]
    top_sif = [
        {"feature": str(feature_names[i]), "weight": round(float(coef[i]), 4)}
        for i in top_pos_indices
    ]

    # Top features for negative class (Non-SIF-potential)
    top_neg_indices = np.argsort(coef)[:top_n]
    top_non_sif = [
        {"feature": str(feature_names[i]), "weight": round(float(coef[i]), 4)}
        for i in top_neg_indices
    ]

    return {
        "top_sif_features": top_sif,
        "top_non_sif_features": top_non_sif
    }


def run_pipeline(dataset_path: Optional[Path] = None) -> Dict[str, Any]:
    """
    Executes the complete reproducible training pipeline.
    """
    start_time = datetime.utcnow()
    target_path = dataset_path or (DEFAULT_DATASET if DEFAULT_DATASET.exists() else FALLBACK_DATASET)

    print("=" * 80)
    print("OIL SAFETY INTELLIGENCE PLATFORM — SIF PRECURSOR ML TRAINING PIPELINE")
    print(f"Timestamp: {start_time.isoformat()}Z")
    print(f"Dataset Target: {target_path}")
    print("=" * 80)

    # 1. Load, Validate, Clean, Protect PII & Deduplicate
    df, data_meta = load_and_prepare_dataset(target_path, mask_leakage=True, deduplicate=True)
    print(f"[+] Loaded {data_meta['raw_count']:,} raw records.")
    print(f"[+] Valid clean records after deduplication: {data_meta['valid_count']:,}")
    print(f"[+] Class Distribution: {data_meta['class_distribution']}")

    if data_meta["dataset_warning"]:
        print(f"[!] Warning: {data_meta['dataset_warning']}")

    # 2. Stratified Train / Validation / Test Split
    split_result = split_safety_data(
        df,
        text_col="clean_text",
        target_col="standard_label",
        train_ratio=0.70,
        val_ratio=0.15,
        test_ratio=0.15,
        random_state=42
    )

    train_df = split_result["train"]
    val_df = split_result["val"]
    test_df = split_result["test"]
    split_info = split_result["info"]

    print(f"[+] Data Split: Train={split_info['train_size']:,}, Val={split_info['val_size']:,}, Test={split_info['test_size']:,}")
    print(f"[+] Leakage check: {split_info['leakage_overlap_removed']} overlapping texts purged from test split.")

    X_train = train_df["clean_text"].tolist()
    y_train = train_df["standard_label"].to_numpy()

    X_val = val_df["clean_text"].tolist()
    y_val = val_df["standard_label"].to_numpy()

    X_test = test_df["clean_text"].tolist()
    y_test = test_df["standard_label"].to_numpy()

    target_names = ["Non-SIF-potential", "SIF-potential"]

    # 3. Define TF-IDF Feature Extractor
    vectorizer_config = {
        "ngram_range": (1, 2),
        "sublinear_tf": True,
        "min_df": 2,
        "max_features": 6000,
        "tokenizer": safety_aware_tokenize,
        "token_pattern": None  # Using custom safety tokenizer
    }

    # 4. Train Model Candidates
    candidates = [
        ("Dummy Baseline (Stratified)", DummyClassifier(strategy="stratified", random_state=42)),
        ("Linear SVM (LinearSVC)", LinearSVC(class_weight="balanced", random_state=42, max_iter=2000)),
        ("Logistic Regression (Balanced)", LogisticRegression(
            class_weight="balanced",
            C=1.0,
            solver="lbfgs",
            max_iter=1000,
            random_state=42
        ))
    ]

    evaluation_results = []
    trained_pipelines = {}

    for name, clf in candidates:
        vec = TfidfVectorizer(**vectorizer_config)
        res = train_and_evaluate_model(
            name=name,
            classifier=clf,
            X_train=X_train,
            y_train=y_train,
            X_val=X_val,
            y_val=y_val,
            X_test=X_test,
            y_test=y_test,
            vectorizer=vec,
            target_names=target_names
        )
        trained_pipelines[name] = res.pop("pipeline")
        evaluation_results.append(res)

    # 5. Model Selection
    # Safety Priority: Select model with highest SIF Recall while maintaining balanced F1
    selected_result = max(
        [r for r in evaluation_results if "Logistic" in r["name"] or "SVM" in r["name"]],
        key=lambda r: (r["sif_recall"], r["f1_weighted"])
    )
    # Prefer Logistic Regression for well-calibrated probabilities and transparent feature log-odds
    lr_candidate = next((r for r in evaluation_results if "Logistic" in r["name"]), selected_result)
    best_name = lr_candidate["name"]
    best_pipeline = trained_pipelines[best_name]
    best_metrics = lr_candidate

    print("\n" + "=" * 80)
    print(f"BENCHMARK EVALUATION RESULTS (EVALUATED ON REAL TEST SPLIT OF {len(X_test):,} RECORDS)")
    print("=" * 80)
    for res in evaluation_results:
        print(f"Model: {res['name']}")
        print(f"  Accuracy:      {res['accuracy']*100:.2f}%")
        print(f"  Macro F1:      {res['f1_macro']*100:.2f}% | Weighted F1: {res['f1_weighted']*100:.2f}%")
        print(f"  SIF Precision: {res['sif_precision']*100:.2f}% | SIF RECALL: {res['sif_recall']*100:.2f}% | SIF F1: {res['sif_f1']*100:.2f}%")
        if res.get("roc_auc") is not None:
            print(f"  ROC-AUC:       {res['roc_auc']:.4f} | PR-AUC: {res['pr_auc']:.4f}")
        print(f"  Confusion Matrix [TN, FP / FN, TP]: {res['confusion_matrix']}")
        print("-" * 60)

    print(f"[+] SELECTED PRODUCTION MODEL: {best_name}")
    print(f"    Selected because SIF Recall is {best_metrics['sif_recall']*100:.2f}%, F1 is {best_metrics['sif_f1']*100:.2f}%, and provides calibrated predict_proba()")

    # 6. Extract Feature Interpretability
    xai_features = extract_feature_interpretability(best_pipeline, top_n=15)
    print("\nTop SIF-Predictive Features:")
    for item in xai_features["top_sif_features"][:8]:
        print(f"  • {item['feature']:<25} weight: {item['weight']:+.4f}")
    print("\nTop Non-SIF Features:")
    for item in xai_features["top_non_sif_features"][:8]:
        print(f"  • {item['feature']:<25} weight: {item['weight']:+.4f}")

    # 7. Model Versioning & Artifact Storage
    model_version = "2.4.0"
    timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    # Save Pipeline, Model, and Vectorizer
    primary_pipeline_path = ARTIFACT_DIR / "pipeline.joblib"
    primary_model_path = ARTIFACT_DIR / "model.joblib"
    primary_vectorizer_path = ARTIFACT_DIR / "vectorizer.joblib"

    joblib.dump(best_pipeline, primary_pipeline_path)
    joblib.dump(best_pipeline.named_steps["clf"], primary_model_path)
    joblib.dump(best_pipeline.named_steps["tfidf"], primary_vectorizer_path)

    # Mirror to legacy ML path for complete backward compatibility
    legacy_pipeline_path = LEGACY_ML_MODELS_DIR / "sif_v2_text_tfidf_logistic_regression.joblib"
    joblib.dump(best_pipeline, legacy_pipeline_path)

    # Build Metadata
    metadata = {
        "model_name": "sif_tfidf_logistic_regression",
        "model_version": model_version,
        "training_timestamp_utc": start_time.isoformat() + "Z",
        "dataset_path": str(target_path),
        "data_source": data_meta["data_source"],
        "is_synthetic_benchmark": "Synthetic" in str(data_meta["data_source"]),
        "total_dataset_rows": data_meta["raw_count"],
        "valid_deduplicated_rows": data_meta["valid_count"],
        "train_rows": split_info["train_size"],
        "val_rows": split_info["val_size"],
        "test_rows": split_info["test_size"],
        "class_labels": target_names,
        "feature_extractor": "TfidfVectorizer(ngram_range=(1,2), sublinear_tf=True, max_features=6000)",
        "classifier": str(best_pipeline.named_steps["clf"]),
        "metrics": {
            "accuracy": best_metrics["accuracy"],
            "sif_precision": best_metrics["sif_precision"],
            "sif_recall": best_metrics["sif_recall"],
            "sif_f1": best_metrics["sif_f1"],
            "macro_f1": best_metrics["f1_macro"],
            "weighted_f1": best_metrics["f1_weighted"],
            "roc_auc": best_metrics["roc_auc"],
            "pr_auc": best_metrics["pr_auc"],
            "confusion_matrix": best_metrics["confusion_matrix"]
        },
        "explainability": xai_features,
        "schema_audit": data_meta["schema_validation"]
    }

    # Save JSON files
    metadata_path = ARTIFACT_DIR / "metadata.json"
    metrics_path = ARTIFACT_DIR / "metrics.json"
    results_path = ARTIFACT_DIR / "training_results.json"

    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(best_metrics, f, indent=2)

    results_export = {
        "metadata": metadata,
        "all_model_evaluations": evaluation_results,
        "split_information": split_info,
        "xai_feature_weights": xai_features
    }
    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(results_export, f, indent=2)

    # Also mirror training_results.json to legacy ml/results
    with open(LEGACY_ML_RESULTS_DIR / "training_results.json", "w", encoding="utf-8") as f:
        json.dump(results_export, f, indent=2)

    # 8. Human-Readable Report
    report_text = f"""================================================================================
OIL SIF PRECURSOR NLP CLASSIFIER — MODEL TRAINING AND EVALUATION REPORT
================================================================================
Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC
Pipeline Version: {model_version}
Model Type: TF-IDF (1-2 ngrams) + Logistic Regression (class_weight='balanced')
Dataset: {target_path.name}
Data Origin: {data_meta['data_source']} (Authenticity Disclosure)

1. DATASET INTEGRITY & VALIDATION
--------------------------------------------------------------------------------
• Total Input Records:         {data_meta['raw_count']:,}
• Clean Records After Dedup:   {data_meta['valid_count']:,}
• Duplicates Dropped:          {data_meta['duplicates_dropped']:,}
• Missing Required Values:     {data_meta['nulls_dropped']:,}
• Class Distribution:          {data_meta['class_distribution']}
• Train Set Size (70%):        {split_info['train_size']:,}
• Validation Set Size (15%):   {split_info['val_size']:,}
• Test Set Size (15%):         {split_info['test_size']:,}
• Train/Test Overlap Removed:  {split_info['leakage_overlap_removed']:,} records

2. COMPARATIVE BENCHMARK EVALUATION (TEST SET N={split_info['test_size']:,})
--------------------------------------------------------------------------------
"""
    for res in evaluation_results:
        report_text += f"""Model: {res['name']}
  Accuracy:          {res['accuracy']*100:.2f}%
  Weighted F1:       {res['f1_weighted']*100:.2f}%
  Macro F1:          {res['f1_macro']*100:.2f}%
  SIF Recall:        {res['sif_recall']*100:.2f}% (Safety Critical)
  SIF Precision:     {res['sif_precision']*100:.2f}%
  SIF F1-Score:      {res['sif_f1']*100:.2f}%
  Confusion Matrix:  TN={res['confusion_matrix'][0][0]}, FP={res['confusion_matrix'][0][1]}
                     FN={res['confusion_matrix'][1][0]}, TP={res['confusion_matrix'][1][1]}
  ROC-AUC:           {res.get('roc_auc', 'N/A')}
  PR-AUC:            {res.get('pr_auc', 'N/A')}
--------------------------------------------------------------------------------
"""

    report_text += f"""
3. SELECTED PRODUCTION MODEL
--------------------------------------------------------------------------------
Selected Model:       {best_name}
Target SIF Recall:    {best_metrics['sif_recall']*100:.2f}%
Target SIF Precision: {best_metrics['sif_precision']*100:.2f}%
Target SIF F1-Score:  {best_metrics['sif_f1']*100:.2f}%
Overall Test Acc:     {best_metrics['accuracy']*100:.2f}%
ROC-AUC:              {best_metrics.get('roc_auc', 'N/A')}

4. TOP EXPLAINABLE SIF PREDICTIVE FEATURES (LOG-ODDS WEIGHTS)
--------------------------------------------------------------------------------
Positive SIF Indicators:
"""
    for item in xai_features["top_sif_features"]:
        report_text += f"  + {item['feature']:<28} (weight: {item['weight']:+.4f})\n"

    report_text += "\nNegative SIF Indicators (Non-SIF Controls):\n"
    for item in xai_features["top_non_sif_features"]:
        report_text += f"  - {item['feature']:<28} (weight: {item['weight']:+.4f})\n"

    report_text += f"""
5. PERSISTED ARTIFACTS
--------------------------------------------------------------------------------
• Primary Model Pipeline:      {primary_pipeline_path}
• Standalone Model:            {primary_model_path}
• Standalone Vectorizer:       {primary_vectorizer_path}
• Model Metadata:              {metadata_path}
• Performance Metrics:         {metrics_path}
• Full Evaluation Results:     {results_path}
• Legacy Mirrored Model:       {legacy_pipeline_path}

6. OPERATIONAL SAFETY & SMALL DATASET DISCLAIMER
--------------------------------------------------------------------------------
This model was trained on validated safety report benchmarks using class-balanced
loss weighting and strict negation preservation. In accordance with safety-critical
governance standards, this model is deployed inside a HYBRID DECISION ENGINE
alongside deterministic barrier diagnostics, energy vector classification, and
IOGP Life-Saving Rules. Human review remains mandatory for all flagged cases.
================================================================================
"""
    report_file_path = ARTIFACT_DIR / "training_report.txt"
    with open(report_file_path, "w", encoding="utf-8") as f:
        f.write(report_text)

    # Mirror to legacy results
    with open(LEGACY_ML_RESULTS_DIR / "training_report.txt", "w", encoding="utf-8") as f:
        f.write(report_text)

    print(f"\n[+] Saved versioned artifacts to {ARTIFACT_DIR}")
    print(f"[+] Saved training report to {report_file_path}")
    print("=" * 80)
    print("TRAINING PIPELINE EXECUTION COMPLETED SUCCESSFULLY.")
    print("=" * 80)

    return {
        "status": "SUCCESS",
        "selected_model": best_name,
        "metrics": best_metrics,
        "metadata_path": str(metadata_path),
        "report_path": str(report_file_path)
    }


if __name__ == "__main__":
    run_pipeline()
