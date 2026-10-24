import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from sepsis import calibration, submission


def _sample():
    return pd.DataFrame({"Patient_ID": [5.0, 5.0, 5.0, 9.0, 9.0], "Hour": [0, 1, 2, 0, 1], "SepsisLabel": 0.05})


def test_build_keeps_sample_order_and_validates():
    sample = _sample()
    scored = pd.DataFrame({"Patient_ID": [9.0, 9.0, 5.0, 5.0, 5.0], "Hour": [1, 0, 2, 1, 0], "SepsisLabel": [0.9, 0.8, 0.3, 0.2, 0.1]})
    sub = submission.build(sample, scored)
    submission.validate(sub, sample)
    assert sub["SepsisLabel"].tolist() == [0.1, 0.2, 0.3, 0.8, 0.9]


@pytest.mark.parametrize("mutate,msg", [
    (lambda s: s.drop(index=0), "row count"),
    (lambda s: s.assign(SepsisLabel=s["SepsisLabel"].where(s.index != 2)), "no prediction"),
    (lambda s: s.assign(SepsisLabel=s["SepsisLabel"] * 3), r"\[0, 1\]"),
    (lambda s: s.assign(SepsisLabel=(s["SepsisLabel"] > 0.5).astype(float)), "continuous"),
    (lambda s: s.iloc[::-1].reset_index(drop=True), "row for row"),
    (lambda s: s.rename(columns={"SepsisLabel": "p"}), "columns"),
])
def test_validate_rejects_broken_submissions(mutate, msg):
    sample = _sample()
    good = submission.build(sample, pd.DataFrame({**{k: sample[k] for k in ("Patient_ID", "Hour")}, "SepsisLabel": [0.1, 0.2, 0.3, 0.4, 0.5]}))
    with pytest.raises(AssertionError, match=msg):
        submission.validate(mutate(good), sample)


def test_platt_is_monotone_and_keeps_ranking():
    rng = np.random.default_rng(0)
    p = rng.random(2000) ** 3
    y = (rng.random(2000) < p * 1.5).astype(int)
    cal = calibration.PlattCalibrator().fit(p, y)
    q = cal.transform(p)
    assert cal.a > 0
    assert (np.diff(q[np.argsort(p)]) >= -1e-12).all()  # never reverses the ranking
    assert q.min() >= 0 and q.max() <= 1
