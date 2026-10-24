/** Input fields for the Assess Patient form. `key` is the model feature name (PhysioNet/CinC 2019 columns). */
export interface Field { key: string; label: string; unit: string; step?: string }
export interface FieldGroup { id: string; title: string; note?: string; fields: Field[] }

export const GROUPS: FieldGroup[] = [
  {
    id: 'vitals', title: 'Vital signs',
    fields: [
      { key: 'HR', label: 'Heart rate', unit: 'bpm' },
      { key: 'O2Sat', label: 'Oxygen saturation (pulse oximetry)', unit: '%' },
      { key: 'Temp', label: 'Temperature', unit: '°C', step: '0.1' },
      { key: 'SBP', label: 'Systolic blood pressure', unit: 'mmHg' },
      { key: 'MAP', label: 'Mean arterial pressure', unit: 'mmHg' },
      { key: 'DBP', label: 'Diastolic blood pressure', unit: 'mmHg' },
      { key: 'Resp', label: 'Respiratory rate', unit: '/min' },
    ],
  },
  {
    id: 'labs', title: 'Laboratory values', note: 'Enter the most recent value for each test. Leave a test blank if it has not been measured.',
    fields: [
      { key: 'Lactate', label: 'Lactate', unit: 'mmol/L', step: '0.1' },
      { key: 'WBC', label: 'White blood cell count', unit: '×10³/µL', step: '0.1' },
      { key: 'Creatinine', label: 'Creatinine', unit: 'mg/dL', step: '0.01' },
      { key: 'Platelets', label: 'Platelets', unit: '×10³/µL' },
      { key: 'BUN', label: 'Blood urea nitrogen', unit: 'mg/dL' },
      { key: 'Glucose', label: 'Glucose', unit: 'mg/dL' },
      { key: 'Bilirubin_total', label: 'Bilirubin, total', unit: 'mg/dL', step: '0.1' },
      { key: 'Bilirubin_direct', label: 'Bilirubin, direct', unit: 'mg/dL', step: '0.1' },
      { key: 'AST', label: 'AST', unit: 'U/L' },
      { key: 'Alkalinephos', label: 'Alkaline phosphatase', unit: 'U/L' },
      { key: 'Hct', label: 'Hematocrit', unit: '%', step: '0.1' },
      { key: 'Hgb', label: 'Hemoglobin', unit: 'g/dL', step: '0.1' },
      { key: 'PTT', label: 'Partial thromboplastin time', unit: 's', step: '0.1' },
      { key: 'Fibrinogen', label: 'Fibrinogen', unit: 'mg/dL' },
      { key: 'TroponinI', label: 'Troponin I', unit: 'ng/mL', step: '0.1' },
      { key: 'pH', label: 'Arterial pH', unit: '', step: '0.01' },
      { key: 'PaCO2', label: 'Arterial CO₂ pressure (PaCO₂)', unit: 'mmHg' },
      { key: 'SaO2', label: 'Arterial O₂ saturation (SaO₂)', unit: '%' },
      { key: 'FiO2', label: 'Inspired oxygen fraction (FiO₂)', unit: '0–1', step: '0.01' },
      { key: 'BaseExcess', label: 'Base excess', unit: 'mmol/L', step: '0.1' },
      { key: 'HCO3', label: 'Bicarbonate', unit: 'mmol/L' },
      { key: 'Chloride', label: 'Chloride', unit: 'mmol/L' },
      { key: 'Potassium', label: 'Potassium', unit: 'mmol/L', step: '0.1' },
      { key: 'Calcium', label: 'Calcium', unit: 'mg/dL', step: '0.1' },
      { key: 'Magnesium', label: 'Magnesium', unit: 'mmol/dL', step: '0.1' },
      { key: 'Phosphate', label: 'Phosphate', unit: 'mg/dL', step: '0.1' },
    ],
  },
];

export const LABEL: Record<string, string> = Object.fromEntries([
  ...GROUPS.flatMap((g) => g.fields.map((f) => [f.key, f.label])),
  ['Age', 'Age'], ['Gender', 'Sex'], ['Unit1', 'Unit'], ['Unit2', 'Unit'], ['HospAdmTime', 'Hospital-to-ICU time'], ['ICULOS', 'ICU stay so far'],
]);

export const UNIT: Record<string, string> = Object.fromEntries(GROUPS.flatMap((g) => g.fields.map((f) => [f.key, f.unit])));

export const CLINICAL_KEYS = GROUPS.flatMap((g) => g.fields.map((f) => f.key));
