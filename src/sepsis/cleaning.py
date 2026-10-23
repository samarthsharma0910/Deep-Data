"""Causal, per-patient cleaning: nothing here looks at future hours."""
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
