"""Build and validate the submission file against the organizers' rules:
exact columns and row order of sample_submission.csv, one probability in [0, 1] per test row, nothing dropped."""
import numpy as np
import pandas as pd

from .config import ID, TIME

COLUMNS = [ID, TIME, "SepsisLabel"]


def build(sample: pd.DataFrame, scored: pd.DataFrame, prob_col: str = "SepsisLabel") -> pd.DataFrame:
    """Attach probabilities to the sample's own (Patient_ID, Hour) rows, preserving its order."""
    if scored.duplicated([ID, TIME]).any():
        raise ValueError("scored frame has duplicate (Patient_ID, Hour) keys")
    sub = sample[[ID, TIME]].merge(scored[[ID, TIME, prob_col]].rename(columns={prob_col: "SepsisLabel"}), on=[ID, TIME], how="left")
    return sub[COLUMNS]


def validate(sub: pd.DataFrame, sample: pd.DataFrame) -> None:
    """Raise AssertionError with a specific message if any submission rule is broken."""
    assert list(sub.columns) == COLUMNS, f"columns must be exactly {COLUMNS}, got {list(sub.columns)}"
    assert len(sub) == len(sample), f"row count {len(sub)} != sample {len(sample)}"
    assert (sub[ID].to_numpy() == sample[ID].to_numpy()).all() and (sub[TIME].to_numpy() == sample[TIME].to_numpy()).all(), \
        "Patient_ID / Hour must match sample_submission.csv row for row, in the same order"
    p = sub["SepsisLabel"]
    assert pd.api.types.is_float_dtype(p), "SepsisLabel must be numeric probabilities"
    assert p.notna().all(), f"{int(p.isna().sum())} rows have no prediction (never drop test rows)"
    assert np.isfinite(p.to_numpy()).all(), "SepsisLabel contains inf"
    assert p.between(0, 1).all(), "probabilities must be within [0, 1]"
    assert p.nunique() > 2, "predictions look binary or constant; submit continuous probabilities"
