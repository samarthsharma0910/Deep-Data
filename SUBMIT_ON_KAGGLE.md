# How to submit on Kaggle

The deliverable is **one Kaggle notebook** that reads the data, trains the model and writes `submission.csv`
(columns `Patient_ID, Hour, SepsisLabel`, one probability per row of `sample_submission.csv`, same order).

## 0. Before you start
- Kaggle account with **phone verification** (Settings > Account > Phone verification), otherwise dataset upload is denied.
- The notebook is `notebooks/sepsis_submission.ipynb`. It is generated from the repo code, so rebuild it after any code change:
  `python scripts/build_notebook.py`

## 1. Upload the data as a public dataset
1. Kaggle > **Datasets** > **New Dataset**.
2. Drag in `train.csv`, `test.csv` and `sample_submission.csv` (from `data/raw/` or the organizers' Drive folder).
3. Title e.g. `Sepsis PS1 data`, visibility **Public** (so the judges can open it), **Create**.

## 2. Import the notebook
1. Kaggle > **Code** > **New Notebook**.
2. **File > Import Notebook** > upload `notebooks/sepsis_submission.ipynb`.

## 3. Attach the dataset
Right-hand pane > **Input** > **+ Add Input** > search the dataset from step 1 > add it.
You do not need to edit any path: the notebook finds `train.csv`, `test.csv` and `sample_submission.csv`
anywhere under `/kaggle/input`.

## 4. Run it
- Settings: leave the accelerator on **None** (CPU is enough). Internet can stay off.
- **Run All** (about 10 minutes on a laptop, allow up to 25 on Kaggle's CPU). Expect AUROC about 0.82 and AUPRC about 0.11. It prints the data summary, the five cross-validation folds, calibration, the alert threshold,
  the AUPRC / AUROC and plots, then writes `/kaggle/working/submission.csv` after validating it.
- If any check fails the notebook stops with a specific message (for example a row-count or order mismatch).

## 5. Make it public and hand it in
1. **Save Version** > **Save & Run All (Commit)**, so the saved version contains the outputs.
2. **Share** > visibility **Public**.
3. Submit the notebook link (and the dataset link) to the organizers.
4. If the portal asks for the file: Notebook **Output** tab > download `submission.csv`.

## Submission rules this repo enforces
| Rule | How it is checked |
| --- | --- |
| Exact columns `Patient_ID, Hour, SepsisLabel` | `submission.validate` |
| Same rows in the same order as `sample_submission.csv` | validated row by row |
| Every test row has a prediction (never `dropna`) | validated, rows are never dropped |
| Probabilities between 0 and 1, not 0/1 classes | validated |
| Patient-level validation (no patient on both sides) | `GroupKFold` on `Patient_ID`, asserted in the pipeline |
| No future data in features | `tests/test_features.py` changes future hours and checks the past is unchanged |

## Reproduce locally
```
python scripts/01_clean.py             # data/raw -> data/interim
python scripts/05_train_temporal.py    # CV, calibration, threshold, submissions/submission.csv
python scripts/build_notebook.py       # notebooks/sepsis_submission.ipynb
python -m pytest tests -q
```
