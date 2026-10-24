"""Snapshot sepsis model: hourly vitals, labs and demographics -> probability of the sepsis label at that hour.

Inputs are the last known (forward-filled) values, so a clinician can enter them by hand. Gradient-boosted trees
handle missing inputs natively, which is why unmeasured labs are left as NaN instead of being imputed.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.model_selection import GroupShuffleSplit

from .config import ID, INTERIM, LABS, SEED, TARGET, VITALS

DEMOGRAPHICS = ["Age", "Gender", "Unit1", "Unit2", "HospAdmTime", "ICULOS"]
FEATURES = VITALS + LABS + DEMOGRAPHICS

# stands in for an infinite split threshold: every measured value goes left, only missing values go right
BIG = 1e30

PARAMS = dict(max_iter=250, learning_rate=0.06, max_leaf_nodes=31, min_samples_leaf=100,
              l2_regularization=1.0, early_stopping=False, random_state=SEED)


# time-aware model (rolling stats, trends, running extremes, clinical scores): see features.py and scripts/05_train_temporal.py
TEMPORAL_PARAMS = dict(max_iter=400, learning_rate=0.05, max_leaf_nodes=15, min_samples_leaf=200,
                       l2_regularization=3.0, early_stopping=False, random_state=SEED)


def load(split: str) -> pd.DataFrame:
    cols = [ID, "Hour"] + FEATURES + ([TARGET] if split == "train" else [])
    return pd.read_csv(INTERIM / f"clean_{split}.csv.gz", usecols=cols)


def split_by_patient(df: pd.DataFrame, test_size: float = 0.2):
    """Patient-level holdout: no patient appears on both sides, so hours of one stay never leak."""
    gss = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=SEED)
    tr, va = next(gss.split(df, df[TARGET], groups=df[ID]))
    return df.iloc[tr], df.iloc[va]


def fit(df: pd.DataFrame) -> HistGradientBoostingClassifier:
    return HistGradientBoostingClassifier(**PARAMS).fit(df[FEATURES], df[TARGET])


def _r(x: float) -> float:
    return float(f"{x:.8g}")


def export_trees(model: HistGradientBoostingClassifier) -> dict:
    """Plain-JSON copy of the fitted trees: the browser evaluates sum(leaf values) + baseline, then a sigmoid."""
    trees = []
    for per_class in model._predictors:
        nodes = per_class[0].nodes
        leaf = nodes["is_leaf"].astype(bool)
        trees.append({
            "f": np.where(leaf, -1, nodes["feature_idx"]).tolist(),
            "t": [_r(v) if np.isfinite(v) else BIG for v in nodes["num_threshold"]],  # inf (leaves, and splits that only separate missing values) is not valid JSON
            "l": nodes["left"].tolist(),
            "r": nodes["right"].tolist(),
            "v": [_r(v) for v in nodes["value"]],
            "m": nodes["missing_go_to_left"].astype(int).tolist(),
        })
    return {"baseline": _r(float(model._baseline_prediction.ravel()[0])), "trees": trees}


def predict_raw(tree_json: dict, X: np.ndarray) -> np.ndarray:
    """Reference implementation of the exported evaluator (used to verify the JSON against sklearn)."""
    out = np.full(len(X), tree_json["baseline"], dtype=float)
    for t in tree_json["trees"]:
        for i, row in enumerate(X):
            n = 0
            while t["f"][n] >= 0:
                x = row[t["f"][n]]
                go_left = bool(t["m"][n]) if np.isnan(x) else x <= t["t"][n]
                n = t["l"][n] if go_left else t["r"][n]
            out[i] += t["v"][n]
    return out


def feature_meta(df: pd.DataFrame) -> dict:
    """Observed range and median per feature, used by the form for hints and range warnings."""
    meta = {}
    for f in FEATURES:
        s = df[f].dropna()
        meta[f] = {"min": _r(float(s.min())), "max": _r(float(s.max())), "median": _r(float(s.median())),
                   "measured": _r(float(df[f].notna().mean()))}
    return meta


def write_json(obj: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":"), allow_nan=False), encoding="utf-8")
