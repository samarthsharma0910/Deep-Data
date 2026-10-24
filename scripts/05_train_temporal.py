"""Time-aware model + calibrated probabilities + justified alert threshold + validated submission.

The logic lives in src/sepsis/pipeline.py (also used by the Kaggle notebook):
  causal features -> 5-fold patient-grouped CV -> Platt calibration check -> alert threshold (max F1)
  -> final fit on all training patients -> calibrated test probabilities

Outputs: models/temporal_hgb.joblib, reports/temporal_metrics.json, submissions/submission.csv
Set SEPSIS_FAST=1 for a quick smoke run (2 folds, few trees); it never writes any output file.
"""
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import joblib
import pandas as pd

from sepsis import modeling, pipeline, submission
from sepsis.config import INTERIM, MODELS, N_FOLDS, RAW, SUBMISSIONS

FAST = os.environ.get("SEPSIS_FAST") == "1"
params, n_folds = dict(modeling.TEMPORAL_PARAMS), N_FOLDS
if FAST:
    params["max_iter"], n_folds = 40, 2
t0 = time.time()

result = pipeline.run(pd.read_csv(INTERIM / "clean_train.csv.gz"), pd.read_csv(INTERIM / "clean_test.csv.gz"), params, n_folds,
                      log=lambda *a: print(f"[{time.time() - t0:6.0f}s]", *a, flush=True))

sample = pd.read_csv(RAW / "sample_submission.csv")
sub = submission.build(sample, result["test"])
submission.validate(sub, sample)

if FAST:
    print("FAST run: nothing written")
else:
    MODELS.mkdir(exist_ok=True)
    (ROOT / "reports").mkdir(exist_ok=True)
    joblib.dump({"model": result["model"], "features": result["features"], "calibrator": result["calibrator"].to_dict(),
                 "alertThreshold": result["threshold"]}, MODELS / "temporal_hgb.joblib")
    (ROOT / "reports" / "temporal_metrics.json").write_text(json.dumps({**result["metrics"], "fast": False}, indent=2), encoding="utf-8")
    SUBMISSIONS.mkdir(exist_ok=True)
    sub.to_csv(SUBMISSIONS / "submission.csv", index=False)
    print(f"wrote {SUBMISSIONS / 'submission.csv'}: {len(sub)} rows")
