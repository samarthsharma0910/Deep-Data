"""End-to-end time-aware pipeline, shared by scripts/05_train_temporal.py and the Kaggle notebook.

cleaned frames -> causal features -> patient-grouped CV (out-of-fold probabilities) -> calibration check ->
alert threshold -> final fit on all training patients -> calibrated test probabilities.
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import GroupKFold, GroupShuffleSplit

from . import calibration, evaluation
from .config import ID, SEED, TARGET, TIME
from .features import add_features, feature_columns


def run(train_clean: pd.DataFrame, test_clean: pd.DataFrame, params: dict, n_folds: int, log=print) -> dict:
    train, test = add_features(train_clean), add_features(test_clean)
    cols = feature_columns(train)
    assert cols == feature_columns(test), "train and test features differ"
    y, groups = train[TARGET].to_numpy(), train[ID].to_numpy()
    log(f"features: {len(cols)} columns, train {len(train)} rows / {train[ID].nunique()} patients, test {len(test)} rows")

    # patient-grouped cross-validation -> out-of-fold probabilities
    oof = np.zeros(len(train))
    folds = []
    for k, (tr, va) in enumerate(GroupKFold(n_splits=n_folds).split(train, y, groups)):
        assert not set(groups[tr]) & set(groups[va]), "a patient appears in both train and validation"
        m = HistGradientBoostingClassifier(**params).fit(train.iloc[tr][cols], y[tr])
        oof[va] = m.predict_proba(train.iloc[va][cols])[:, 1]
        folds.append({"fold": k, "auroc": roc_auc_score(y[va], oof[va]), "auprc": average_precision_score(y[va], oof[va])})
        log(f"fold {k}: AUROC {folds[-1]['auroc']:.4f} AUPRC {folds[-1]['auprc']:.4f}")

    # calibration: fit on one half of the out-of-fold patients, judge on the other half
    a_idx, b_idx = next(GroupShuffleSplit(n_splits=1, test_size=0.5, random_state=SEED).split(train, y, groups))
    check = calibration.PlattCalibrator().fit(oof[a_idx], y[a_idx])
    raw_b, cal_b = oof[b_idx], check.transform(oof[b_idx])
    calib = {"brierRaw": calibration.brier(y[b_idx], raw_b), "brierCalibrated": calibration.brier(y[b_idx], cal_b),
             "eceRaw": calibration.ece(y[b_idx], raw_b), "eceCalibrated": calibration.ece(y[b_idx], cal_b)}
    use_calibration = calib["brierCalibrated"] <= calib["brierRaw"]
    calibrator = calibration.PlattCalibrator().fit(oof, y) if use_calibration else calibration.PlattCalibrator()
    oof_cal = calibrator.transform(oof)
    log("calibration", {k: round(v, 5) for k, v in calib.items()}, "-> using Platt" if use_calibration else "-> keeping raw probabilities")

    # metrics on all out-of-fold predictions; alert threshold = max F1 on calibrated probabilities
    ev = evaluation.evaluate(train, oof_cal, int(train[ID].nunique()), int(len(train)))
    thr = ev["operatingThreshold"]
    table = []
    for t in (0.02, 0.05, 0.10, 0.15, 0.20, 0.30):
        flagged = oof_cal >= t
        table.append({"threshold": t, "flaggedShare": float(flagged.mean()),
                      "precision": float(y[flagged].mean()) if flagged.any() else None, "recall": float(flagged[y == 1].mean())})
    metrics = {
        "model": "temporal-hgb", "features": len(cols), "cv": f"{n_folds}-fold GroupKFold on Patient_ID", "folds": folds,
        "auroc": float(roc_auc_score(y, oof)), "auprc": float(average_precision_score(y, oof)), "baselineAuprc": float(y.mean()),
        "calibration": calib, "calibrationUsed": bool(use_calibration), "calibrator": calibrator.to_dict(),
        "alertThreshold": thr, "alertThresholdRule": "maximises F1 on calibrated out-of-fold probabilities",
        "atThreshold": {k: ev[k] for k in ("sensitivity", "specificity", "precision", "medianLeadTimeHours", "patientsDetected", "sepsisPatients")},
        "thresholdTable": table,
    }
    log(f"OOF AUROC {metrics['auroc']:.4f} AUPRC {metrics['auprc']:.4f} (baseline {metrics['baselineAuprc']:.4f}); "
        f"alert threshold {thr:.3f}: sensitivity {ev['sensitivity']:.3f}, precision {ev['precision']:.3f}")

    # final model on every training patient
    final = HistGradientBoostingClassifier(**params).fit(train[cols], y)
    test_p = calibrator.transform(final.predict_proba(test[cols])[:, 1])
    log(f"test probabilities: mean {test_p.mean():.4f}, max {test_p.max():.3f}")
    return {"metrics": metrics, "evaluation": ev, "model": final, "features": cols, "calibrator": calibrator,
            "threshold": thr, "test": test[[ID, TIME]].assign(SepsisLabel=test_p)}
