/** Care unit; 'Unspecified' when the source data does not say. */
export type Unit = 'MICU' | 'SICU' | 'CCU' | 'Unspecified';
export const UNIT_ORDER: Unit[] = ['MICU', 'SICU', 'CCU', 'Unspecified'];

export interface Patient {
  id: string;
  bed: string;
  unit: Unit;
  age: number;
  sex: 'M' | 'F';
  diagnosis: string | null;
  admitHoursBeforeSnapshot: number;
}

/** One hourly row; null = not measured. h = 0..47, 47 is the snapshot hour. */
export interface Observation {
  pid: string;
  h: number;
  hr: number | null;
  sbp: number | null;
  map: number | null;
  temp: number | null;
  rr: number | null;
  spo2: number | null;
  gcs: number | null;
  lactate: number | null;
  wbc: number | null;
  creatinine: number | null;
  platelets: number | null;
  score: number | null;
}

export type VarKey = 'hr' | 'sbp' | 'map' | 'temp' | 'rr' | 'spo2' | 'gcs' | 'lactate' | 'wbc' | 'creatinine' | 'platelets';

export interface Meta {
  snapshotTime: string;
  hours: number;
  demoThreshold: number;
  modelVersion: string | null;
  dataSource?: 'simulated' | 'project';
}

export interface ModelEvaluation {
  modelVersion: string;
  cohort: string;
  splitMethod: string;
  partitions: { name: string; patients: number; rows: number }[];
  auroc?: number;
  auprc?: number;
  sensitivity?: number;
  specificity?: number;
  precision?: number;
  baselineAuprc?: number;
  operatingThreshold?: number;
  patientsDetected?: number;
  sepsisPatients?: number;
  medianLeadTimeHours?: number;
  roc?: { fpr: number; tpr: number }[];
  pr?: { recall: number; precision: number }[];
  calibration?: { predicted: number; observed: number; n: number }[];
  leadTimes?: number[];
}

export interface ModelExplanation {
  pid: string;
  hour: number;
  method: string;
  attributions: { feature: string; value: string | number; contribution: number }[];
}

export interface AuditEvent {
  id: string;
  at: number;
  actor: string;
  action: 'acknowledge' | 'escalate' | 'dismiss' | 'bundle-record' | 'bundle-undo';
  pid: string;
  alertKey?: string;
  reason?: string;
  note?: string;
  detail?: string;
}

export interface Dataset {
  meta: Meta;
  patients: Patient[];
  observations: Observation[];
  evaluation: ModelEvaluation | null;
  explanations: ModelExplanation[] | null;
}

export type ReviewStatus = 'awaiting' | 'escalated' | 'acknowledged' | 'dismissed';

export interface Episode {
  key: string;
  pid: string;
  startHour: number;
  endHour: number;
  ongoing: boolean;
  peak: number;
}
