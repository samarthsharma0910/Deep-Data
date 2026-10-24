"""Held-out evaluation: AUROC / AUPRC, curves, calibration, operating point and detection lead time."""
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, precision_recall_curve, roc_auc_score, roc_curve

from .config import ID, TARGET


def _thin(a: np.ndarray, n: int = 60) -> np.ndarray:
    idx = np.unique(np.linspace(0, len(a) - 1, min(n, len(a))).round().astype(int))
    return a[idx]


def operating_point(y: np.ndarray, p: np.ndarray) -> dict:
    """Threshold that maximises F1 on the held-out hours."""
    prec, rec, thr = precision_recall_curve(y, p)
    f1 = 2 * prec[:-1] * rec[:-1] / np.clip(prec[:-1] + rec[:-1], 1e-12, None)
    i = int(np.argmax(f1))
    return {"threshold": float(thr[i]), "precision": float(prec[i]), "recall": float(rec[i]), "f1": float(f1[i])}


def specificity_at(y: np.ndarray, p: np.ndarray, thr: float) -> float:
    neg = y == 0
    return float(((p < thr) & neg).sum() / neg.sum())


def calibration(y: np.ndarray, p: np.ndarray, bins: int = 10) -> list[dict]:
    q = pd.qcut(p, bins, duplicates="drop")
    g = pd.DataFrame({"y": y, "p": p, "q": q}).groupby("q", observed=True)
    return [{"predicted": float(v.p.mean()), "observed": float(v.y.mean()), "n": int(len(v))} for _, v in g]


def lead_times(df: pd.DataFrame, p: np.ndarray, thr: float) -> tuple[list[float], int, int]:
    """Hours between the first alert and clinical onset for sepsis patients.

    PhysioNet sets SepsisLabel = 1 from 6 h before clinical onset, so onset = first positive hour + 6.
    Returns (lead times of detected patients, detected, total sepsis patients).
    """
    d = pd.DataFrame({ID: df[ID].values, "h": df["Hour"].values, "y": df[TARGET].values, "p": p})
    leads, detected, total = [], 0, 0
    for _, g in d.groupby(ID):
        pos = g[g.y == 1]
        if pos.empty:
            continue
        total += 1
        onset = pos.h.min() + 6
        alerts = g[g.p >= thr]
        if not alerts.empty:
            detected += 1
            leads.append(float(onset - alerts.h.min()))
    return leads, detected, total


def evaluate(df: pd.DataFrame, p: np.ndarray, n_train_patients: int, n_train_rows: int,
             test_patients: int | None = None, test_rows: int | None = None) -> dict:
    y = df[TARGET].values
    op = operating_point(y, p)
    fpr, tpr, _ = roc_curve(y, p)
    prec, rec, _ = precision_recall_curve(y, p)
    leads, det, tot = lead_times(df, p, op["threshold"])
    return {
        "auroc": float(roc_auc_score(y, p)),
        "auprc": float(average_precision_score(y, p)),
        "baselineAuprc": float(y.mean()),
        "sensitivity": op["recall"],
        "specificity": specificity_at(y, p, op["threshold"]),
        "precision": op["precision"],
        "operatingThreshold": op["threshold"],
        "medianLeadTimeHours": float(np.median(leads)) if leads else None,
        "patientsDetected": det,
        "sepsisPatients": tot,
        "roc": [{"fpr": float(a), "tpr": float(b)} for a, b in zip(_thin(fpr), _thin(tpr))],
        "pr": [{"recall": float(a), "precision": float(b)} for a, b in zip(_thin(rec), _thin(prec))],
        "calibration": calibration(y, p),
        "leadTimes": [float(np.clip(v, -48, 48)) for v in leads],
        "partitions": [
            {"name": "Training", "patients": n_train_patients, "rows": n_train_rows, "status": "Used to fit the model"},
            {"name": "Held-out validation", "patients": int(df[ID].nunique()), "rows": int(len(df)),
             "status": "Labelled; source of every metric shown"},
            *([{"name": "Test", "patients": test_patients, "rows": test_rows,
                "status": "Unlabelled; scored for submission only, no metrics"}] if test_patients is not None else []),
        ],
    }
