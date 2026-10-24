"""Builds public/data/dataset.json from the project's real files, once a model has produced scores.

    python scripts/export_from_project.py --scores ../submissions/submission.csv --model-version v1.0

Inputs
  --raw     held-out records with the original columns        (default ../data/raw/test.csv)
  --scores  CSV with Patient_ID, Hour, SepsisLabel (0-1 risk)  (default ../submissions/submission.csv)
  --evaluation  optional JSON in the ModelEvaluation shape; copied through untouched, never computed here.
                Defaults to the held-out evaluation written by scripts/03_train.py in public/data/model.json

Each exported patient is a retrospective replay: the last 48 recorded hours are shown and the final
recorded hour is treated as the snapshot hour. Nothing is estimated: unmeasured values stay null.
The dataset has no GCS, diagnosis or bed numbers, so those are null / absent.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

H = 48
HERE = Path(__file__).resolve().parents[1]
COLS = {"HR": "hr", "SBP": "sbp", "MAP": "map", "Temp": "temp", "Resp": "rr", "O2Sat": "spo2",
        "Lactate": "lactate", "WBC": "wbc", "Creatinine": "creatinine", "Platelets": "platelets"}
DIGITS = {"temp": 1, "lactate": 1, "wbc": 1, "creatinine": 2}


def clean(v, d=0):
    return None if pd.isna(v) else (round(float(v), d) if d else int(round(float(v))))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default=str(HERE.parent / "data" / "raw" / "test.csv"))
    ap.add_argument("--scores", default=str(HERE.parent / "submissions" / "submission.csv"))
    ap.add_argument("--evaluation", default=None)
    ap.add_argument("--model-version", default=None)
    ap.add_argument("--snapshot", default="2026-10-23T09:00:00+05:30")
    ap.add_argument("--threshold", type=float, default=None,
                    help="alert threshold 0-1; default is the model operating threshold from the evaluation (0.60 without one)")
    ap.add_argument("--patients", type=int, default=18)
    ap.add_argument("--out", default=str(HERE / "public" / "data" / "dataset.json"))
    a = ap.parse_args()

    raw = pd.read_csv(a.raw)
    sc = pd.read_csv(a.scores)[["Patient_ID", "Hour", "SepsisLabel"]].rename(columns={"SepsisLabel": "score"})
    df = raw.merge(sc, on=["Patient_ID", "Hour"], how="inner").sort_values(["Patient_ID", "Hour"])
    if df.empty:
        raise SystemExit("No overlap between --raw and --scores on Patient_ID/Hour")
    if sc["score"].nunique() == 1:
        print(f"WARNING: every score is {sc['score'].iloc[0]}; this looks like a placeholder, not model output")

    g = df.groupby("Patient_ID")
    stats = pd.DataFrame({"n": g.size(), "peak": g.score.max()})
    pool = stats[stats.n >= H].sort_values("peak", ascending=False)  # prefer full 48 h stays
    if len(pool) < a.patients:
        pool = stats.sort_values("peak", ascending=False)
    idx = np.linspace(0, len(pool) - 1, min(a.patients, len(pool))).round().astype(int)  # spread across risk
    chosen = list(pool.index[sorted(set(idx))])

    patients, rows = [], []
    for i, pid in enumerate(chosen):
        d = df[df.Patient_ID == pid].tail(H).reset_index(drop=True)
        off = H - len(d)
        last = d.iloc[-1]
        unit = "MICU" if last.get("Unit1") == 1 else "SICU" if last.get("Unit2") == 1 else "Unspecified"
        los = int(max(0, round(float(last["ICULOS"]) + max(0.0, -float(last["HospAdmTime"])))))
        pid_s = f"P{int(pid)}"
        patients.append({"id": pid_s, "bed": f"{'ICU' if unit == 'Unspecified' else unit}-{i + 1:02d}", "unit": unit,
                         "age": int(round(float(last["Age"]))), "sex": "M" if last["Gender"] == 1 else "F",
                         "diagnosis": None, "admitHoursBeforeSnapshot": los})
        for k, r in d.iterrows():
            row = {"pid": pid_s, "h": k + off, "gcs": None, "score": clean(r["score"], 3)}
            for src, dst in COLS.items():
                row[dst] = clean(r[src], DIGITS.get(dst, 0))
            rows.append(row)

    model_file = HERE / "public" / "data" / "model.json"
    if a.evaluation:
        evaluation = json.loads(Path(a.evaluation).read_text(encoding="utf-8"))
    elif model_file.exists():
        evaluation = json.loads(model_file.read_text(encoding="utf-8")).get("evaluation")
    else:
        evaluation = None
    threshold = a.threshold if a.threshold is not None else round((evaluation or {}).get("operatingThreshold", 0.60), 2)
    version = a.model_version or (evaluation or {}).get("modelVersion") or "unversioned"
    out = {"meta": {"snapshotTime": a.snapshot, "hours": H, "demoThreshold": threshold,
                    "modelVersion": version, "dataSource": "project"},
           "patients": patients, "observations": rows, "evaluation": evaluation, "explanations": None}
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {a.out}: {len(patients)} patients, {len(rows)} rows")


if __name__ == "__main__":
    main()
