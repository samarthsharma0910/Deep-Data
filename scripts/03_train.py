"""Train the snapshot model with a patient-level holdout, evaluate it, and export it for the dashboard.

Outputs
  models/hgb.joblib                         fitted sklearn model (used by 04_predict.py)
  reports/metrics.json                      held-out metrics
  dashboard/public/data/model.json          trees + feature metadata + held-out evaluation, run in the browser
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import joblib
import numpy as np
import pandas as pd

from sepsis import evaluation, modeling
from sepsis.config import INTERIM, MODELS, TARGET

df = modeling.load("train")
train, valid = modeling.split_by_patient(df)
print(f"train {train.shape}, held-out {valid.shape}, sepsis rate {train[TARGET].mean():.4f}")

model = modeling.fit(train)
p = model.predict_proba(valid[modeling.FEATURES])[:, 1]
test_ids = pd.read_csv(INTERIM / "clean_test.csv.gz", usecols=["Patient_ID"])["Patient_ID"]
ev = evaluation.evaluate(valid, p, int(train["Patient_ID"].nunique()), int(len(train)),
                         int(test_ids.nunique()), int(len(test_ids)))
print({k: (round(v, 4) if isinstance(v, float) else v) for k, v in ev.items() if not isinstance(v, (list,))})

trees = modeling.export_trees(model)
# the exported JSON must reproduce sklearn exactly before it is shipped
sample = valid[modeling.FEATURES].sample(300, random_state=0).to_numpy(dtype=float)
raw = modeling.predict_raw(trees, sample)
ref = model.decision_function(sample)
assert np.allclose(raw, ref, atol=1e-4), f"export mismatch: max diff {np.abs(raw - ref).max()}"
print("exported trees match sklearn on 300 rows")

MODELS.mkdir(exist_ok=True)
joblib.dump(model, MODELS / "hgb.joblib")
(ROOT / "reports").mkdir(exist_ok=True)
(ROOT / "reports" / "metrics.json").write_text(json.dumps(ev, indent=2), encoding="utf-8")

payload = {
    "version": "hgb-snapshot-1",
    "features": modeling.FEATURES,
    "meta": modeling.feature_meta(train),
    "model": trees,
    "evaluation": {
        "modelVersion": "hgb-snapshot-1",
        "cohort": "Held-out patients from train.csv (20%, patient-level split)",
        "splitMethod": "GroupShuffleSplit on Patient_ID",
        **ev,
    },
}
modeling.write_json(payload, ROOT / "dashboard" / "public" / "data" / "model.json")
print("wrote dashboard/public/data/model.json")

# Two real held-out patient-hours for the form's "Load example" buttons: the typical (median-scored) rich record of each class.
rich = valid[valid[modeling.FEATURES].notna().sum(axis=1) >= 18].copy()
rich["p"] = model.predict_proba(rich[modeling.FEATURES])[:, 1]


def typical(sub):
    return sub.iloc[(sub["p"] - sub["p"].median()).abs().argsort().iloc[0]]


thr = ev["operatingThreshold"]
cases = (
    ("Sepsis · model flags it", rich[(rich[TARGET] == 1) & (rich["p"] >= thr)], 1,
     "Held-out ICU hour labelled sepsis in the PhysioNet data. The model scores it above its alert threshold."),
    ("Sepsis · model misses it", rich[(rich[TARGET] == 1) & (rich["p"] < thr)], 1,
     "Held-out ICU hour labelled sepsis in the PhysioNet data. The model scores it below its alert threshold."),
    ("No sepsis", rich[(rich[TARGET] == 0) & (rich["p"] < thr)], 0,
     "Held-out ICU hour not labelled sepsis in the PhysioNet data."),
)
examples = []
for i, (title, sub, label, note) in enumerate(cases):
    row = typical(sub)
    values = {f: round(float(row[f]), 2) for f in modeling.FEATURES if not np.isnan(row[f])}
    examples.append({"id": f"example-{i}", "title": title, "label": label, "note": note,
                     "values": values, "expectedProbability": float(row["p"])})
modeling.write_json({"examples": examples}, ROOT / "dashboard" / "public" / "data" / "examples.json")
print("wrote dashboard/public/data/examples.json:", [(e["title"], round(e["expectedProbability"], 3)) for e in examples])
