/** Evaluator for the exported gradient-boosted trees (see src/sepsis/modeling.py). No React, no DOM. */

export interface Tree { f: number[]; t: number[]; l: number[]; r: number[]; v: number[]; m: number[] }

export interface FeatureMeta { min: number; max: number; median: number; measured: number }

export interface ModelEvaluationFile {
  modelVersion: string;
  cohort: string;
  splitMethod: string;
  partitions: { name: string; patients: number; rows: number }[];
  auroc: number;
  auprc: number;
  baselineAuprc: number;
  sensitivity: number;
  specificity: number;
  precision: number;
  operatingThreshold: number;
  medianLeadTimeHours: number | null;
  patientsDetected: number;
  sepsisPatients: number;
  roc: { fpr: number; tpr: number }[];
  pr: { recall: number; precision: number }[];
  calibration: { predicted: number; observed: number; n: number }[];
  leadTimes: number[];
}

export interface ModelFile {
  version: string;
  features: string[];
  meta: Record<string, FeatureMeta>;
  model: { baseline: number; trees: Tree[] };
  evaluation: ModelEvaluationFile;
}

export interface Example {
  id: string;
  title: string;
  label: 0 | 1;
  note: string;
  values: Record<string, number>;
  expectedProbability: number;
}

export type Inputs = Record<string, number | null | undefined>;

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

function rawScore(model: ModelFile, x: number[]): number {
  let s = model.model.baseline;
  for (const t of model.model.trees) {
    let n = 0;
    while (t.f[n] >= 0) {
      const v = x[t.f[n]];
      const left = Number.isNaN(v) ? t.m[n] === 1 : v <= t.t[n];
      n = left ? t.l[n] : t.r[n];
    }
    s += t.v[n];
  }
  return s;
}

const vector = (model: ModelFile, inputs: Inputs): number[] =>
  model.features.map((f) => { const v = inputs[f]; return v == null || Number.isNaN(v) ? NaN : v; });

/** Probability that this hour carries the sepsis label. Blank inputs are treated as unmeasured. */
export function predict(model: ModelFile, inputs: Inputs): number {
  return sigmoid(rawScore(model, vector(model, inputs)));
}

export interface Contribution { feature: string; delta: number }

const SKIP_CONTRIBUTION = new Set(['Gender', 'Unit1', 'Unit2']);

/**
 * Change in probability compared with the same patient having a typical (population median) value for each entered input.
 * Positive means the entered value raises the estimate. Describes the model, not clinical causes.
 */
export function contributions(model: ModelFile, inputs: Inputs): Contribution[] {
  const base = predict(model, inputs);
  const out: Contribution[] = [];
  for (const f of model.features) {
    const v = inputs[f];
    if (v == null || Number.isNaN(v) || SKIP_CONTRIBUTION.has(f)) continue;
    out.push({ feature: f, delta: base - predict(model, { ...inputs, [f]: model.meta[f].median }) });
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/** Observed sepsis rate in the held-out calibration bin nearest to this probability. */
export function nearestCalibration(model: ModelFile, p: number): { observed: number; n: number } | null {
  const bins = model.evaluation.calibration;
  if (!bins.length) return null;
  let best = bins[0];
  for (const b of bins) if (Math.abs(b.predicted - p) < Math.abs(best.predicted - p)) best = b;
  return { observed: best.observed, n: best.n };
}
