"""Probability calibration. Platt scaling on the logit is strictly monotone, so it never changes the ranking
(AUROC / AUPRC are identical before and after); isotonic regression would flatten ties and lose rank information."""
import numpy as np
from sklearn.linear_model import LogisticRegression


def _logit(p: np.ndarray) -> np.ndarray:
    p = np.clip(np.asarray(p, dtype=float), 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p))


class PlattCalibrator:
    def __init__(self) -> None:
        self.a, self.b = 1.0, 0.0

    def fit(self, p: np.ndarray, y: np.ndarray) -> "PlattCalibrator":
        lr = LogisticRegression(C=1e6, solver="lbfgs", max_iter=1000).fit(_logit(p).reshape(-1, 1), y)
        self.a, self.b = float(lr.coef_[0, 0]), float(lr.intercept_[0])
        return self

    def transform(self, p: np.ndarray) -> np.ndarray:
        z = self.a * _logit(p) + self.b
        return 1 / (1 + np.exp(-z))

    def to_dict(self) -> dict:
        return {"method": "platt", "a": self.a, "b": self.b}


def brier(y: np.ndarray, p: np.ndarray) -> float:
    return float(np.mean((np.asarray(p) - np.asarray(y)) ** 2))


def ece(y: np.ndarray, p: np.ndarray, bins: int = 10) -> float:
    """Expected calibration error over equal-count probability bins."""
    y, p = np.asarray(y), np.asarray(p)
    order = np.argsort(p)
    total = 0.0
    for idx in np.array_split(order, bins):
        total += len(idx) / len(p) * abs(y[idx].mean() - p[idx].mean())
    return float(total)
