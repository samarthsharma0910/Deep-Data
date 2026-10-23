"""Creates the sepsis project folder structure. Idempotent: never overwrites an existing file.
Run from the project root:  python setup_project.py
Also moves train.csv / test.csv / sample_submission.csv from the root into data/raw/."""
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent

DIRS = ['data/raw', 'data/interim', 'data/processed', 'notebooks', 'models', 'reports/figures',
        'submissions', 'src/sepsis', 'scripts', 'tests']

RAW_FILES = ['train.csv', 'test.csv', 'sample_submission.csv']

FILES = {
'.gitignore': "data/\nmodels/\nsubmissions/\n__pycache__/\n.ipynb_checkpoints/\n*.pyc\n.venv/\n",
'requirements.txt': "numpy\npandas\nscikit-learn\nmatplotlib\njupyter\n# optional, faster boosting:\n# lightgbm\n# xgboost\n",
'README.md': """# Early Sepsis Prediction (Deep Data Hackathon 2026, PS1)

Hourly probability of sepsis for ICU patients (PhysioNet/CinC 2019). Metrics: AUPRC, AUROC.

## Layout
- `data/raw/` original train.csv, test.csv, sample_submission.csv
- `data/interim/` cleaned data, `data/processed/` model-ready features
- `src/sepsis/` package: config, cleaning, features, modeling, evaluation, prediction
- `scripts/` pipeline entry points, run in order: `01_clean.py`, `02_features.py`, `03_train.py`, `04_predict.py`
- `notebooks/` EDA and the final Kaggle notebook; `models/`, `reports/`, `submissions/` outputs

## Rules
- Validate with GroupKFold on `Patient_ID` (never split rows of one patient).
- Only causal features (past hours); no backfill, no future leakage.
- Submit probabilities in [0, 1] for every test row, same order as sample_submission.csv.
- On Kaggle: upload data as a public dataset and change the paths in `src/sepsis/config.py`.
""",
'src/sepsis/__init__.py': "",
'tests/__init__.py': "",
'src/sepsis/config.py': '''from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
INTERIM = ROOT / "data" / "interim"
PROCESSED = ROOT / "data" / "processed"
MODELS = ROOT / "models"
SUBMISSIONS = ROOT / "submissions"

ID, TIME, TARGET = "Patient_ID", "Hour", "SepsisLabel"
VITALS = ["HR", "O2Sat", "Temp", "SBP", "MAP", "DBP", "Resp"]
LABS = ["BaseExcess", "HCO3", "FiO2", "pH", "PaCO2", "SaO2", "AST", "BUN", "Alkalinephos", "Calcium",
        "Chloride", "Creatinine", "Bilirubin_direct", "Glucose", "Lactate", "Magnesium", "Phosphate",
        "Potassium", "Bilirubin_total", "TroponinI", "Hct", "Hgb", "PTT", "WBC", "Fibrinogen", "Platelets"]
DYNAMIC = VITALS + LABS
DROP_COLS = ["EtCO2"]  # 100% missing
# plausible physiological ranges; outside -> NaN
RANGES = {"HR": (20, 300), "O2Sat": (20, 100), "Temp": (25, 45), "SBP": (30, 300), "MAP": (20, 300),
          "DBP": (10, 300), "Resp": (2, 80), "FiO2": (0.1, 1.0), "pH": (6.5, 8.0), "Hct": (5, 70),
          "Hgb": (2, 25), "Glucose": (10, 1500)}
SEED = 42
N_FOLDS = 5
''',
'src/sepsis/cleaning.py': '''"""Causal, per-patient cleaning: nothing here looks at future hours."""
import numpy as np
import pandas as pd

from .config import DROP_COLS, DYNAMIC, ID, RANGES, TIME


def clean(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values([ID, TIME]).reset_index(drop=True)
    df = df.drop(columns=DROP_COLS, errors="ignore")
    for c, (lo, hi) in RANGES.items():
        df.loc[(df[c] < lo) | (df[c] > hi), c] = np.nan
    # Unit1/Unit2 both NaN for one hospital system: keep that as its own signal
    df["Unit_missing"] = df.Unit1.isna().astype(int)
    df[["Unit1", "Unit2"]] = df[["Unit1", "Unit2"]].fillna(0)
    obs = df[DYNAMIC].notna()
    new = {}
    for c in DYNAMIC:
        new[c + "_obs"] = obs[c].astype(np.int8)
        last = df[TIME].where(obs[c]).groupby(df[ID]).ffill()
        new[c + "_tsl"] = (df[TIME] - last).fillna(-1)  # hours since last measured, -1 = never
    new = pd.DataFrame(new)
    cnt = obs.groupby(df[ID]).cumsum().add_suffix("_cnt")
    df = pd.concat([df, new, cnt], axis=1)
    df[DYNAMIC] = df.groupby(ID)[DYNAMIC].ffill()  # forward-fill only, never backfill
    return df
''',
'src/sepsis/features.py': '''"""Temporal features (all causal): rolling stats, trends, SOFA/qSOFA-style scores. TODO."""
import pandas as pd


def add_features(df: pd.DataFrame) -> pd.DataFrame:
    raise NotImplementedError
''',
'src/sepsis/modeling.py': '''"""Model training with GroupKFold on Patient_ID. TODO."""
''',
'src/sepsis/evaluation.py': '''"""AUPRC / AUROC, calibration, alert threshold selection. TODO."""
''',
'src/sepsis/predict.py': '''"""Build submissions/submission.csv matching sample_submission.csv (Patient_ID, Hour, SepsisLabel). TODO."""
''',
'scripts/01_clean.py': '''import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import pandas as pd
from sepsis.cleaning import clean
from sepsis.config import INTERIM, RAW

INTERIM.mkdir(parents=True, exist_ok=True)
for name in ("train", "test"):
    df = clean(pd.read_csv(RAW / f"{name}.csv"))
    df.to_csv(INTERIM / f"clean_{name}.csv", index=False)
    print(name, df.shape)
''',
'scripts/02_features.py': "# TODO: clean_*.csv -> data/processed/ via sepsis.features.add_features\n",
'scripts/03_train.py': "# TODO: GroupKFold training, save model to models/, report AUPRC/AUROC\n",
'scripts/04_predict.py': "# TODO: predict test, write submissions/submission.csv\n",
'notebooks/01_eda.ipynb': '{"cells": [], "metadata": {}, "nbformat": 4, "nbformat_minor": 5}\n',
}


def main():
    for d in DIRS:
        (ROOT / d).mkdir(parents=True, exist_ok=True)
    for name in RAW_FILES:
        src, dst = ROOT / name, ROOT / 'data/raw' / name
        if src.exists() and not dst.exists():
            shutil.move(src, dst); print('moved', name)
    for rel, content in FILES.items():
        p = ROOT / rel
        if not p.exists():
            p.write_text(content, encoding='utf-8'); print('created', rel)
    print('done')


if __name__ == '__main__':
    main()
