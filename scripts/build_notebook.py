"""Assemble notebooks/sepsis_submission.ipynb from the package sources, so the notebook runs exactly the repo's code.

    python scripts/build_notebook.py

On Kaggle: add the dataset containing train.csv, test.csv and sample_submission.csv, Run All; submission.csv is written
to /kaggle/working. Locally the notebook falls back to data/raw/.
"""
from pathlib import Path

import nbformat as nbf

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src" / "sepsis"
MODULES = ["config", "cleaning", "features", "calibration", "evaluation", "submission", "modeling", "pipeline"]

md = nbf.v4.new_markdown_cell
code = nbf.v4.new_code_cell

cells = [
    md("""# Early Sepsis Prediction: time-aware model with calibrated probabilities

Deep Data Hackathon 2026, problem statement 1. For every ICU hour the model outputs the probability that the patient is developing sepsis.

**Approach**
1. **Cleaning** (causal, per patient): drop the empty `EtCO2` column, blank out physiologically impossible values, forward-fill only (never backfill), and add measurement-count and time-since-last-measurement features, because missingness is informative.
2. **Features** (strictly causal, no future hours): rolling 6 h and 12 h statistics, 6 h and 12 h trends, running extremes since ICU admission, and qSOFA / SIRS / partial SOFA style scores. A unit test checks that changing future hours never changes an earlier feature.
3. **Validation**: 5-fold `GroupKFold` on `Patient_ID`, so no patient appears on both sides. Metrics (AUPRC, AUROC) come from out-of-fold predictions.
4. **Calibration and threshold**: Platt scaling is fitted on out-of-fold predictions and kept only if it improves the Brier score on held-out patients. The alert threshold maximises F1 on the calibrated out-of-fold probabilities.
5. **Submission**: the model is refit on all training patients and scores every test row. The file is validated against `sample_submission.csv` (same columns, rows and order, probabilities in [0, 1], no missing rows)."""),
    code("""import json, os, sys, time
from pathlib import Path

import numpy as np
import pandas as pd

FAST = os.environ.get("SEPSIS_FAST") == "1"   # smoke test only; never set on Kaggle
ON_KAGGLE = Path("/kaggle/input").exists()
OUT_DIR = Path("/kaggle/working") if ON_KAGGLE else Path.cwd()


def find(name):
    \"\"\"Locate a competition file under /kaggle/input, or data/raw when running locally.\"\"\"
    if ON_KAGGLE:
        hits = sorted(Path("/kaggle/input").rglob(name))
        if hits:
            return hits[0]
    for base in [Path.cwd(), *Path.cwd().parents]:
        for rel in ("data/raw", "."):
            if (base / rel / name).exists():
                return base / rel / name
    raise FileNotFoundError(f"{name} not found. Add the dataset to the notebook (Add Input) and re-run.")


PATHS = {n: find(n) for n in ("train.csv", "test.csv", "sample_submission.csv")}
print({k: str(v) for k, v in PATHS.items()})
os.makedirs(OUT_DIR / "sepsis_src" / "sepsis", exist_ok=True)"""),
    md("## Source modules\nThe cells below write the pipeline's modules to disk (identical to `src/sepsis/` in the project repository) and import them."),
    code("%%writefile sepsis_src/sepsis/__init__.py\n# sepsis pipeline package\n"),
]
for m in MODULES:
    cells.append(code(f"%%writefile sepsis_src/sepsis/{m}.py\n" + (SRC / f"{m}.py").read_text(encoding="utf-8").rstrip() + "\n"))

cells += [
    code("""sys.path.insert(0, str(OUT_DIR / "sepsis_src"))
from sepsis import modeling, pipeline, submission
from sepsis.cleaning import clean
from sepsis.config import ID, N_FOLDS, TIME

raw_train, raw_test = pd.read_csv(PATHS["train.csv"]), pd.read_csv(PATHS["test.csv"])
sample = pd.read_csv(PATHS["sample_submission.csv"])
print("train", raw_train.shape, "patients", raw_train[ID].nunique(), "| test", raw_test.shape, "patients", raw_test[ID].nunique())
print("sepsis rate (rows):", round(raw_train["SepsisLabel"].mean(), 4), "| patients ever septic:", round(raw_train.groupby(ID)["SepsisLabel"].max().mean(), 4))
assert not set(raw_train[ID]) & set(raw_test[ID]), "train and test share patients"
clean_train, clean_test = clean(raw_train), clean(raw_test)
print("cleaned", clean_train.shape, clean_test.shape)"""),
    md("## Train, cross-validate, calibrate"),
    code("""params = dict(modeling.TEMPORAL_PARAMS)
n_folds = N_FOLDS
if FAST:
    params["max_iter"], n_folds = 40, 2
    print("FAST smoke run: results are NOT the real model")
t0 = time.time()
result = pipeline.run(clean_train, clean_test, params, n_folds, log=lambda *a: print(f"[{time.time() - t0:5.0f}s]", *a))"""),
    md("## Held-out (out-of-fold) results"),
    code("""m, ev = result["metrics"], result["evaluation"]
print(f"AUROC {m['auroc']:.4f}   AUPRC {m['auprc']:.4f}   (an average hour is {m['baselineAuprc']:.4f})")
print(f"Calibration (held-out patients): Brier {m['calibration']['brierRaw']:.5f} raw vs {m['calibration']['brierCalibrated']:.5f} Platt; "
      f"ECE {m['calibration']['eceRaw']:.4f} vs {m['calibration']['eceCalibrated']:.4f}; calibration applied: {m['calibrationUsed']}")
a = m["atThreshold"]
print(f"Alert threshold {m['alertThreshold']:.3f} ({m['alertThresholdRule']}): sensitivity {a['sensitivity']:.3f}, "
      f"specificity {a['specificity']:.3f}, precision {a['precision']:.3f}; "
      f"{a['patientsDetected']} of {a['sepsisPatients']} sepsis patients alerted, median first alert {a['medianLeadTimeHours']:.1f} h before onset")
pd.DataFrame(m["thresholdTable"])"""),
    code("""import matplotlib.pyplot as plt

fig, ax = plt.subplots(1, 3, figsize=(14, 4))
ax[0].plot([p["recall"] for p in ev["pr"]], [p["precision"] for p in ev["pr"]], color="#286b75")
ax[0].axhline(m["baselineAuprc"], ls="--", color="grey"); ax[0].set(title="Precision-recall", xlabel="Recall", ylabel="Precision")
ax[1].plot([p["fpr"] for p in ev["roc"]], [p["tpr"] for p in ev["roc"]], color="#286b75")
ax[1].plot([0, 1], [0, 1], ls="--", color="grey"); ax[1].set(title="ROC", xlabel="False positive rate", ylabel="True positive rate")
c = ev["calibration"]
ax[2].plot([b["predicted"] for b in c], [b["observed"] for b in c], "o-", color="#286b75")
top = max(b["predicted"] for b in c); ax[2].plot([0, top], [0, top], ls="--", color="grey")
ax[2].set(title="Calibration (out-of-fold)", xlabel="Predicted probability", ylabel="Observed sepsis rate")
plt.tight_layout(); plt.show()"""),
    md("## Submission\nOne probability per test row, in the order of `sample_submission.csv`."),
    code("""sub = submission.build(sample, result["test"])
submission.validate(sub, sample)
sub.to_csv(OUT_DIR / "submission.csv", index=False)
print(f"wrote {OUT_DIR / 'submission.csv'}: {len(sub)} rows, probabilities {sub['SepsisLabel'].min():.4f} to {sub['SepsisLabel'].max():.4f}")
sub.head()"""),
    md("""## Notes and limits
* The features and the model only look backwards in time; test patients are scored independently of each other.
* Metrics are out-of-fold on the training patients. The hidden test labels are never used.
* Median lead time counts the first alert at the chosen threshold relative to the PhysioNet convention that `SepsisLabel` turns on 6 h before clinical onset; early alerts may include false alarms.
* This is a research model trained on public PhysioNet/CinC 2019 data and is not a medical device."""),
]

nb = nbf.v4.new_notebook(cells=cells, metadata={"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"}})
out = ROOT / "notebooks" / "sepsis_submission.ipynb"
nbf.write(nb, out)
print(f"wrote {out} ({len(cells)} cells)")
