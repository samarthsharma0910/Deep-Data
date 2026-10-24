"""Score test.csv with the SNAPSHOT model (the one behind the dashboard's Assess Patient page).

Writes submissions/submission_snapshot.csv. The competition submission, submissions/submission.csv, comes from the
time-aware model: run scripts/05_train_temporal.py.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import joblib
import pandas as pd

from sepsis import modeling, submission
from sepsis.config import MODELS, RAW, SUBMISSIONS

model = joblib.load(MODELS / "hgb.joblib")
test = modeling.load("test")
test["SepsisLabel"] = model.predict_proba(test[modeling.FEATURES])[:, 1]

sample = pd.read_csv(RAW / "sample_submission.csv")
sub = submission.build(sample, test)
submission.validate(sub, sample)

SUBMISSIONS.mkdir(exist_ok=True)
sub.to_csv(SUBMISSIONS / "submission_snapshot.csv", index=False)
print(f"wrote {SUBMISSIONS / 'submission_snapshot.csv'}: {len(sub)} rows, mean probability {sub['SepsisLabel'].mean():.4f}")
