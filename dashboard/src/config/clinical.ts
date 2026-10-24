import type { ReviewStatus, VarKey } from '../types';

export const HOURS = 48;
export const LAST_HOUR = HOURS - 1;
export const STALE_AFTER_H = 2;
export const RISING_PTS = 15;
export const CHANGE_WINDOW_H = 6;
export const CHANGE_TOLERANCE_H = 2;
export const SPARK_HOURS = 12;
export const ACTOR = 'Unauthenticated demo user';

export interface VitalSpec {
  key: VarKey;
  label: string;
  short: string;
  unit: string;
  min: number;
  max: number;
  digits: number;
  ref: string;
  band?: { from: number; to: number; label: string; source: string };
}

export const VITALS: VitalSpec[] = [
  { key: 'hr', label: 'Heart rate', short: 'HR', unit: 'bpm', min: 40, max: 160, digits: 0, ref: '60–100',
    band: { from: 90, to: 160, label: 'HR > 90', source: 'SIRS criterion, Levy 2003 (SCCM/ESICM/ACCP/ATS/SIS)' } },
  { key: 'map', label: 'Mean arterial pressure', short: 'MAP', unit: 'mmHg', min: 40, max: 110, digits: 0, ref: '70–105',
    band: { from: 40, to: 65, label: 'MAP < 65', source: 'Surviving Sepsis Campaign MAP target 65 mmHg' } },
  { key: 'temp', label: 'Temperature', short: 'Temp', unit: '°C', min: 35, max: 40, digits: 1, ref: '36.1–37.8',
    band: { from: 38.3, to: 40, label: 'Temp > 38.3', source: 'Levy 2003 diagnostic criteria' } },
  { key: 'rr', label: 'Respiratory rate', short: 'RR', unit: '/min', min: 8, max: 36, digits: 0, ref: '12–20',
    band: { from: 22, to: 36, label: 'RR ≥ 22', source: 'qSOFA, Seymour 2016' } },
  { key: 'spo2', label: 'Oxygen saturation', short: 'SpO₂', unit: '%', min: 84, max: 100, digits: 0, ref: '95–100' },
];

export interface LabSpec {
  key: VarKey;
  label: string;
  unit: string;
  digits: number;
  criterion: number;
  criterionText: string;
  ref: string;
  source: string;
  flag: (v: number) => boolean;
}

export const LABS: LabSpec[] = [
  { key: 'lactate', label: 'Lactate', unit: 'mmol/L', digits: 1, criterion: 2, criterionText: '> 2', ref: '0.5–2.0', source: 'Sepsis-3', flag: (v) => v > 2 },
  { key: 'wbc', label: 'WBC', unit: '×10⁹/L', digits: 1, criterion: 12, criterionText: '> 12 or < 4', ref: '4.0–11.0', source: 'SIRS', flag: (v) => v > 12 || v < 4 },
  { key: 'creatinine', label: 'Creatinine', unit: 'mg/dL', digits: 2, criterion: 1.2, criterionText: '≥ 1.2', ref: '0.6–1.2', source: 'SOFA renal', flag: (v) => v >= 1.2 },
  { key: 'platelets', label: 'Platelets', unit: '×10⁹/L', digits: 0, criterion: 150, criterionText: '< 150', ref: '150–400', source: 'SOFA coag.', flag: (v) => v < 150 },
];

/** Reference spreads used only for the illustrative baseline-change chart. */
export const TYPICAL_SD: Partial<Record<VarKey, number>> = {
  hr: 12, sbp: 14, map: 9, temp: 0.5, rr: 3.5, spo2: 2.5, lactate: 0.9, wbc: 3, creatinine: 0.35, platelets: 45,
};

export const VAR_LABEL: Record<VarKey, string> = {
  hr: 'Heart rate', sbp: 'Systolic BP', map: 'MAP', temp: 'Temperature', rr: 'Resp. rate', spo2: 'SpO₂',
  gcs: 'GCS', lactate: 'Lactate', wbc: 'WBC', creatinine: 'Creatinine', platelets: 'Platelets',
};

export const VAR_UNIT: Record<VarKey, string> = {
  hr: 'bpm', sbp: 'mmHg', map: 'mmHg', temp: '°C', rr: '/min', spo2: '%', gcs: '', lactate: 'mmol/L',
  wbc: '×10⁹/L', creatinine: 'mg/dL', platelets: '×10⁹/L',
};

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  awaiting: 'Awaiting review', escalated: 'Escalated', acknowledged: 'Acknowledged', dismissed: 'Dismissed',
};

export const ESCALATE_REASONS = [
  'Bedside review by intensivist', 'Suspected infection – evaluate for bundle',
  'Haemodynamic deterioration', 'Rising lactate', 'Other',
];
export const DISMISS_REASONS = [
  'Known non-infectious cause', 'Measurement artefact', 'Already on sepsis management',
  'Comfort-focused care', 'Other',
];

export const BUNDLE_ITEMS = [
  { id: 'cultures', label: 'Blood cultures drawn' },
  { id: 'antibiotics', label: 'Broad-spectrum antibiotics given' },
  { id: 'lactate', label: 'Repeat lactate' },
  { id: 'fluids', label: 'Crystalloid fluids started' },
];
