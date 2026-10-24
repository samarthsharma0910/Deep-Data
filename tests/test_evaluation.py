import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from sepsis import evaluation


def _frame():
    rng = np.random.default_rng(0)
    n = 400
    y = (rng.random(n) < 0.2).astype(int)
    df = pd.DataFrame({"Patient_ID": np.repeat(np.arange(40), 10), "Hour": np.tile(np.arange(10), 40), "SepsisLabel": y})
    return df, np.clip(y * 0.3 + rng.random(n) * 0.7, 0, 1)


def test_partitions_include_unlabelled_test():
    df, p = _frame()
    ev = evaluation.evaluate(df, p, 100, 1000, 50, 500)
    assert [x["name"] for x in ev["partitions"]] == ["Training", "Held-out validation", "Test"]
    assert ev["partitions"][2] == {**ev["partitions"][2], "patients": 50, "rows": 500}
    assert 0.5 < ev["auroc"] <= 1


def test_partitions_without_test():
    df, p = _frame()
    ev = evaluation.evaluate(df, p, 100, 1000)
    assert [x["name"] for x in ev["partitions"]] == ["Training", "Held-out validation"]
