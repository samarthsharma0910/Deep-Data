"""Generates the simulated demo cohort for the dashboard (fixed seed).

18 patients (6 per unit), 48 hourly rows each. Risk scores are SIMULATED trajectories, not model output.
    python scripts/simulate.py   ->   public/data/dataset.json
"""
import json
from pathlib import Path

import numpy as np

SEED = 7
H = 48
OUT = Path(__file__).resolve().parents[1] / "public" / "data" / "dataset.json"
rng = np.random.default_rng(SEED)

# id, unit, age, sex, diagnosis, admitHoursBeforeSnapshot, kind, extras
SPEC = [
    ("P001", "MICU", 67, "M", "Community-acquired pneumonia", 71, "septic", {}),
    ("P002", "MICU", 54, "F", "Diabetic ketoacidosis", 30, "stable", {}),
    ("P003", "MICU", 72, "M", "Acute pancreatitis", 58, "rising", {}),
    ("P004", "MICU", 48, "F", "COPD exacerbation", 26, "stable", {}),
    ("P005", "MICU", 61, "M", "Urinary tract infection with delirium", 44, "rising", {"stale": 3}),
    ("P006", "MICU", 79, "F", "Acute heart failure", 90, "stable", {}),
    ("P007", "SICU", 58, "M", "Post-op bowel resection", 36, "stable", {}),
    ("P008", "SICU", 65, "F", "Perforated diverticulitis, post-op", 40, "rising", {"no_lactate": True}),
    ("P009", "SICU", 70, "M", "Necrotising soft-tissue infection", 62, "septic", {}),
    ("P010", "SICU", 63, "M", "Post-op aortic repair", 52, "stable", {"creat_base": 1.4}),
    ("P011", "SICU", 52, "F", "Aspiration pneumonia", 77, "recovering", {}),
    ("P012", "SICU", 44, "M", "Polytrauma, day 3", 69, "stable", {"stale": 4}),
    ("P013", "CCU", 69, "M", "NSTEMI", 28, "stable", {}),
    ("P014", "CCU", 74, "F", "Atrial fibrillation with rapid response", 22, "stable", {"no_lactate": True}),
    ("P015", "CCU", 66, "F", "Cardiogenic shock, suspected line infection", 84, "septic", {}),
    ("P016", "CCU", 57, "M", "Post-cardiac arrest care", 34, "stable", {"plt_base": 140}),
    ("P017", "CCU", 76, "F", "Infective endocarditis", 96, "rising", {}),
    ("P018", "CCU", 61, "M", "Unstable angina", 20, "stable", {}),
]
SEPTIC_ONSET = {"P001": 27, "P009": 31, "P015": 34}
SEPTIC_PEAK = {"P001": 0.94, "P009": 0.96, "P015": 0.92}
RISING = {"P003": (24, 0.68), "P005": (28, 0.66), "P008": (36, 0.55), "P017": (32, 0.70)}


def smooth(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def ar_noise(sd, rho=0.7):
    e = rng.normal(0, sd, H)
    out = np.zeros(H)
    for i in range(H):
        out[i] = (rho * out[i - 1] if i else 0) + e[i]
    return out


def latent(pid, kind):
    h = np.arange(H)
    if kind == "septic":
        s = 0.05 + (SEPTIC_PEAK[pid] - 0.05) * smooth((h - SEPTIC_ONSET[pid]) / 14)
        s = s + ar_noise(0.012)
        s[-4:] = np.maximum(s[-4:], 0.88)
    elif kind == "rising":
        onset, peak = RISING[pid]
        s = 0.08 + (peak - 0.08) * smooth((h - onset) / 18) + ar_noise(0.015)
    elif kind == "recovering":
        s = 0.10 + 0.62 * smooth((h - 8) / 14) - 0.54 * smooth((h - 22) / 24) + ar_noise(0.012)
    else:
        s = rng.uniform(0.03, 0.07) + ar_noise(0.008)
    return np.clip(s, 0.01, 0.99)


def r(v, d=1):
    return None if v is None else round(float(v), d)


patients, rows = [], []
for i, (pid, unit, age, sex, dx, admit, kind, ex) in enumerate(SPEC):
    n = i % 6 + 1
    patients.append({"id": pid, "bed": f"{unit}-{n:02d}", "unit": unit, "age": age, "sex": sex,
                     "diagnosis": dx, "admitHoursBeforeSnapshot": admit})
    s = latent(pid, kind)
    p = s  # physiological severity follows the latent trajectory
    stale = ex.get("stale", 0)
    has_vitals = rng.random(H) > 0.06
    if stale:
        has_vitals[H - stale:] = False
        has_vitals[H - stale - 1] = True
    else:
        has_vitals[H - 1] = True
    t_off, l_off, c_off = int(rng.integers(0, 2)), int(rng.integers(0, 6)), int(rng.integers(0, 12))
    for h in range(H):
        v = bool(has_vitals[h])
        pi = p[h]
        row = {"pid": pid, "h": h, "hr": None, "sbp": None, "map": None, "temp": None, "rr": None,
               "spo2": None, "gcs": None, "lactate": None, "wbc": None, "creatinine": None,
               "platelets": None, "score": None}
        if v:
            row["hr"] = round(76 + 58 * pi + rng.normal(0, 4))
            row["sbp"] = round(124 - 42 * pi + rng.normal(0, 5))
            row["map"] = round(88 - 34 * pi + rng.normal(0, 3))
            row["rr"] = round(15 + 16 * pi + rng.normal(0, 1.5))
            row["spo2"] = int(min(100, round(98 - 11 * pi + rng.normal(0, 0.8))))
            row["score"] = r(min(0.99, max(0.01, s[h] + rng.normal(0, 0.012))), 3)
            if (h + t_off) % 2 == 0:
                row["temp"] = r(36.8 + 2.0 * pi + rng.normal(0, 0.15))
        if h % 4 == 3:
            row["gcs"] = 14 if (kind == "septic" and pi > 0.8 and rng.random() < 0.6) else 15
        if (h + l_off) % 6 == 5 and not ex.get("no_lactate"):
            row["lactate"] = r(0.9 + 4.2 * pi ** 1.3 + rng.normal(0, 0.15))
        if (h + c_off) % 12 == 11:
            row["wbc"] = r(7.5 + 11 * pi + rng.normal(0, 0.6))
            row["creatinine"] = r(ex.get("creat_base", 0.8) + 2.4 * pi + rng.normal(0, 0.08), 2)
            row["platelets"] = round(ex.get("plt_base", 230) - 120 * pi + rng.normal(0, 8))
        rows.append(row)

dataset = {
    "meta": {"snapshotTime": "2026-10-23T09:00:00+05:30", "hours": H, "demoThreshold": 0.60,
             "modelVersion": None, "dataSource": "simulated"},
    "patients": patients,
    "observations": rows,
    "evaluation": None,
    "explanations": None,
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(dataset, separators=(",", ":")), encoding="utf-8")
print(f"wrote {OUT} ({len(patients)} patients, {len(rows)} rows)")
