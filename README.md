# Early Sepsis Prediction (Deep Data Hackathon 2026, PS1)

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

## Model and manual assessment
- `python scripts/03_train.py` trains the snapshot model (patient-level holdout), writes `models/hgb.joblib`, `reports/metrics.json`,
  `dashboard/public/data/model.json` (trees and held-out evaluation, evaluated in the browser) and `examples.json`.
- `python scripts/04_predict.py` scores `test.csv` and writes `submissions/submission.csv`.
- The dashboard's **Assess Patient** page lets anyone enter a patient's latest values and see the model's estimate.
  Held-out result: AUROC 0.81, AUPRC 0.094 (the average hour is 0.021). It is a research demonstration, not a medical device.
