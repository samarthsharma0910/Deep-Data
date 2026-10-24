import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from sepsis.cleaning import clean
from sepsis.config import DYNAMIC, ID, TIME
from sepsis.features import add_features, feature_columns


def _raw(n_patients=6, hours=30, seed=0) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []
    for p in range(n_patients):
        for h in range(hours):
            r = {c: np.nan for c in DYNAMIC}
            for c, lo, hi in (("HR", 50, 140), ("Resp", 10, 35), ("SBP", 80, 160), ("MAP", 50, 100), ("Temp", 35.5, 39.5), ("O2Sat", 85, 100)):
                if rng.random() > 0.2:
                    r[c] = rng.uniform(lo, hi)
            if h % 6 == 0:
                r["Lactate"], r["Creatinine"], r["Platelets"] = rng.uniform(0.5, 5), rng.uniform(0.5, 4), rng.uniform(40, 300)
            r.update({ID: float(p), TIME: h, "Age": 60.0, "Gender": 1.0, "Unit1": np.nan, "Unit2": np.nan,
                      "HospAdmTime": -5.0, "ICULOS": h + 1.0, "EtCO2": np.nan, "SepsisLabel": float(h > 25 and p % 2 == 0)})
            rows.append(r)
    return pd.DataFrame(rows)


def test_features_are_causal():
    """Changing or removing future hours must not change any feature at earlier hours."""
    raw = _raw()
    full = add_features(clean(raw))
    cut = 18
    past = raw[raw[TIME] < cut].copy()
    short = add_features(clean(past))
    cols = feature_columns(full)
    a = full[full[TIME] < cut].reset_index(drop=True)[cols]
    b = short.reset_index(drop=True)[cols]
    pd.testing.assert_frame_equal(a, b, check_exact=False, rtol=1e-5, atol=1e-5)

    tampered = raw.copy()
    tampered.loc[tampered[TIME] >= cut, ["HR", "MAP", "Lactate", "Creatinine", "Resp"]] = 999.0
    t = add_features(clean(tampered))
    pd.testing.assert_frame_equal(a, t[t[TIME] < cut].reset_index(drop=True)[cols], check_exact=False, rtol=1e-5, atol=1e-5)


def test_patients_do_not_leak_into_each_other():
    raw = _raw()
    both = add_features(clean(raw))
    alone = add_features(clean(raw[raw[ID] == 3.0]))
    cols = feature_columns(both)
    pd.testing.assert_frame_equal(both[both[ID] == 3.0].reset_index(drop=True)[cols], alone.reset_index(drop=True)[cols],
                                  check_exact=False, rtol=1e-5, atol=1e-5)


def test_row_order_and_count_preserved():
    raw = _raw()
    c = clean(raw)
    f = add_features(c)
    assert len(f) == len(c)
    assert (f[[ID, TIME]].values == c[[ID, TIME]].values).all()
    assert np.isfinite(f[feature_columns(f)].replace([np.inf, -np.inf], np.nan).fillna(0).values).all()
