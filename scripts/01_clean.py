import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import pandas as pd
from sepsis.cleaning import clean
from sepsis.config import INTERIM, RAW

INTERIM.mkdir(parents=True, exist_ok=True)
for name in ("train", "test"):
    df = clean(pd.read_csv(RAW / f"{name}.csv"))
    df.to_csv(INTERIM / f"clean_{name}.csv", index=False)
    print(name, df.shape)
