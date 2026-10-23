from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
INTERIM = ROOT / "data" / "interim"
PROCESSED = ROOT / "data" / "processed"
MODELS = ROOT / "models"
SUBMISSIONS = ROOT / "submissions"

ID, TIME, TARGET = "Patient_ID", "Hour", "SepsisLabel"
VITALS = ["HR", "O2Sat", "Temp", "SBP", "MAP", "DBP", "Resp"]
LABS = ["BaseExcess", "HCO3", "FiO2", "pH", "PaCO2", "SaO2", "AST", "BUN", "Alkalinephos", "Calcium",
        "Chloride", "Creatinine", "Bilirubin_direct", "Glucose", "Lactate", "Magnesium", "Phosphate",
        "Potassium", "Bilirubin_total", "TroponinI", "Hct", "Hgb", "PTT", "WBC", "Fibrinogen", "Platelets"]
DYNAMIC = VITALS + LABS
DROP_COLS = ["EtCO2"]  # 100% missing
# plausible physiological ranges; outside -> NaN
RANGES = {"HR": (20, 300), "O2Sat": (20, 100), "Temp": (25, 45), "SBP": (30, 300), "MAP": (20, 300),
          "DBP": (10, 300), "Resp": (2, 80), "FiO2": (0.1, 1.0), "pH": (6.5, 8.0), "Hct": (5, 70),
          "Hgb": (2, 25), "Glucose": (10, 1500)}
SEED = 42
N_FOLDS = 5
