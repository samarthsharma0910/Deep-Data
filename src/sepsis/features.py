"""Temporal features. Every feature at hour t uses only hours <= t of the same patient (no future data, no other patients).

Input is the cleaned frame from cleaning.clean(): forward-filled vitals/labs plus *_obs / *_tsl / *_cnt columns.
"""
import numpy as np
import pandas as pd

from .config import DYNAMIC, ID, TARGET, TIME, VITALS

DEMOGRAPHICS = ["Age", "Gender", "Unit1", "Unit2", "Unit_missing", "HospAdmTime", "ICULOS"]
WINDOW = 6    # hours for the short rolling statistics
LONG_WINDOW = 12
LAG = 6       # hours for trend features
LONG_LAG = 12
# running extremes since ICU admission: (column, cummax | cummin)
RUNNING = [("HR", "cummax"), ("Temp", "cummax"), ("Temp", "cummin"), ("Resp", "cummax"), ("MAP", "cummin"), ("SBP", "cummin"),
           ("Lactate", "cummax"), ("Creatinine", "cummax"), ("WBC", "cummax"), ("WBC", "cummin"), ("Platelets", "cummin"),
           ("Bilirubin_total", "cummax")]


def clinical_scores(df: pd.DataFrame) -> pd.DataFrame:
    """qSOFA / SIRS / partial SOFA style scores from the latest known values. Unknown values count as 'not met'."""
    d = df
    resp = d["Resp"]
    qsofa = (resp >= 22).astype(int) + (d["SBP"] <= 100).astype(int)  # GCS is not in this dataset
    sirs = (((d["Temp"] > 38) | (d["Temp"] < 36)).astype(int) + (d["HR"] > 90).astype(int)
            + ((resp > 20) | (d["PaCO2"] < 32)).astype(int) + ((d["WBC"] > 12) | (d["WBC"] < 4)).astype(int))
    cr, plt, bil = d["Creatinine"], d["Platelets"], d["Bilirubin_total"]
    sofa = ((d["MAP"] < 70).astype(int)
            + np.select([cr >= 5, cr >= 3.5, cr >= 2, cr >= 1.2], [4, 3, 2, 1], 0)
            + np.select([plt < 20, plt < 50, plt < 100, plt < 150], [4, 3, 2, 1], 0)
            + np.select([bil >= 12, bil >= 6, bil >= 2, bil >= 1.2], [4, 3, 2, 1], 0))
    out = pd.DataFrame({
        "qsofa": qsofa, "sirs": sirs, "sofa_partial": sofa,
        "shock_index": d["HR"] / d["SBP"].where(d["SBP"] > 0),
        "map_lt65": (d["MAP"] < 65).astype(int),
        "lactate_gt2": (d["Lactate"] > 2).astype(int),
    }, index=d.index)
    return out


def add_features(df: pd.DataFrame) -> pd.DataFrame:
    """Return ID, Hour, (label) and the feature columns, one row per input row, in the input order."""
    df = df.reset_index(drop=True)
    assert df.groupby(ID)[TIME].apply(lambda s: s.is_monotonic_increasing).all(), "rows must be ordered by Hour within patient"
    g = df.groupby(ID, sort=False)
    cols: dict[str, pd.Series] = {}

    for c in DYNAMIC + [f"{c}_tsl" for c in DYNAMIC] + [f"{c}_cnt" for c in DYNAMIC] + DEMOGRAPHICS:
        cols[c] = df[c]

    roll = g[VITALS].rolling(WINDOW, min_periods=1)
    for stat in ("mean", "min", "max", "std"):
        r = getattr(roll, stat)().reset_index(level=0, drop=True).reindex(df.index)
        for c in VITALS:
            cols[f"{c}_{stat}{WINDOW}"] = r[c]

    roll12 = g[VITALS].rolling(LONG_WINDOW, min_periods=1)
    for stat in ("mean", "min", "max"):
        r = getattr(roll12, stat)().reset_index(level=0, drop=True).reindex(df.index)
        for c in VITALS:
            cols[f"{c}_{stat}{LONG_WINDOW}"] = r[c]

    for c in DYNAMIC:
        cols[f"{c}_d{LAG}"] = df[c] - g[c].shift(LAG)
    for c in VITALS:
        cols[f"{c}_d{LONG_LAG}"] = df[c] - g[c].shift(LONG_LAG)
    for c, fn in RUNNING:
        cols[f"{c}_{fn}"] = getattr(g[c], fn)()

    sc = clinical_scores(df)
    for c in sc.columns:
        cols[c] = sc[c]
    tmp = pd.concat([df[[ID]], sc], axis=1)
    gs = tmp.groupby(ID, sort=False)
    for c in ("qsofa", "sirs", "sofa_partial"):
        cols[f"{c}_max"] = gs[c].cummax()
        cols[f"{c}_d{LAG}"] = sc[c] - gs[c].shift(LAG)

    feats = pd.DataFrame(cols).astype("float32")
    keep = [ID, TIME] + ([TARGET] if TARGET in df else [])
    return pd.concat([df[keep], feats], axis=1)


def feature_columns(frame: pd.DataFrame) -> list[str]:
    return [c for c in frame.columns if c not in (ID, TIME, TARGET)]
