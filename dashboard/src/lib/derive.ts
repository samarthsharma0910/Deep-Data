import {
  CHANGE_TOLERANCE_H, CHANGE_WINDOW_H, HOURS, LABS, LAST_HOUR, RISING_PTS, STALE_AFTER_H, VAR_LABEL, VAR_UNIT,
} from '../config/clinical';
import type { Dataset, Episode, Observation, Patient, VarKey } from '../types';

export const scorePts = (s: number | null): number | null => (s == null ? null : Math.round(s * 100));

const VITAL_KEYS: VarKey[] = ['hr', 'sbp', 'map', 'rr', 'spo2'];

function emptyRow(pid: string, h: number): Observation {
  return { pid, h, hr: null, sbp: null, map: null, temp: null, rr: null, spo2: null, gcs: null,
    lactate: null, wbc: null, creatinine: null, platelets: null, score: null };
}

/** One dense 48-hour array per patient, indexed by hour. */
export function groupObservations(ds: Dataset): Map<string, Observation[]> {
  const out = new Map<string, Observation[]>();
  for (const p of ds.patients) out.set(p.id, Array.from({ length: HOURS }, (_, h) => emptyRow(p.id, h)));
  for (const o of ds.observations) {
    const arr = out.get(o.pid);
    if (arr && o.h >= 0 && o.h < HOURS) arr[o.h] = o;
  }
  return out;
}

export interface Measured { h: number; v: number }

export function latestOf(obs: Observation[], key: VarKey): Measured | null {
  for (let h = obs.length - 1; h >= 0; h--) {
    const v = obs[h][key];
    if (v != null) return { h, v };
  }
  return null;
}

export function latestScore(obs: Observation[]): { h: number; pts: number } | null {
  for (let h = obs.length - 1; h >= 0; h--) {
    const pts = scorePts(obs[h].score);
    if (pts != null) return { h, pts };
  }
  return null;
}

/** Latest points minus points 6 h earlier (nearest earlier value within 2 h). */
export function changeOver6h(obs: Observation[]): number | null {
  const latest = latestScore(obs);
  if (!latest) return null;
  const target = latest.h - CHANGE_WINDOW_H;
  for (let h = target; h >= Math.max(0, target - CHANGE_TOLERANCE_H); h--) {
    const pts = scorePts(obs[h].score);
    if (pts != null) return latest.pts - pts;
  }
  return null;
}

/** Continuous runs at or above the threshold; unmeasured hours do not break a run. */
export function findEpisodes(obs: Observation[], thrPts: number): Episode[] {
  const eps: Episode[] = [];
  let cur: Episode | null = null;
  const pid = obs[0]?.pid ?? '';
  for (let h = 0; h < obs.length; h++) {
    const pts = scorePts(obs[h].score);
    if (pts == null) continue;
    if (pts >= thrPts) {
      if (!cur) cur = { key: `${pid}@${h}`, pid, startHour: h, endHour: h, ongoing: false, peak: pts };
      cur.endHour = h;
      cur.peak = Math.max(cur.peak, pts);
    } else if (cur) {
      eps.push(cur);
      cur = null;
    }
  }
  if (cur) { cur.ongoing = true; eps.push(cur); }
  return eps;
}

export interface Freshness {
  lastVitalsH: number | null;
  ageH: number | null;
  stale: boolean;
  noVitals: boolean;
  noLactate: boolean;
}

export function freshness(obs: Observation[]): Freshness {
  let last: number | null = null;
  for (let h = obs.length - 1; h >= 0 && last == null; h--) {
    if (VITAL_KEYS.some((k) => obs[h][k] != null)) last = h;
  }
  const ageH = last == null ? null : LAST_HOUR - last;
  return {
    lastVitalsH: last,
    ageH,
    stale: ageH != null && ageH > STALE_AFTER_H,
    noVitals: last == null,
    noLactate: obs.every((o) => o.lactate == null),
  };
}

export interface Organ { key: string; label: string; score: number | null; basis: string }
export interface Sofa { total: number; scored: number; organs: Organ[] }

const band = (v: number, cuts: number[], dir: 'up' | 'down'): number =>
  cuts.reduce((n, c) => n + (dir === 'up' ? (v >= c ? 1 : 0) : (v < c ? 1 : 0)), 0);

/** Partial SOFA (Vincent 1996) from the variables this dataset carries. */
export function sofaPartial(obs: Observation[]): Sofa {
  const map = latestOf(obs, 'map');
  const cr = latestOf(obs, 'creatinine');
  const plt = latestOf(obs, 'platelets');
  const gcs = latestOf(obs, 'gcs');
  const organs: Organ[] = [
    { key: 'cv', label: 'Cardiovascular', score: map ? (map.v < 70 ? 1 : 0) : null, basis: map ? `MAP ${map.v} mmHg` : 'No MAP' },
    { key: 'renal', label: 'Renal', score: cr ? band(cr.v, [1.2, 2.0, 3.5, 5.0], 'up') : null, basis: cr ? `Creatinine ${cr.v} mg/dL` : 'No creatinine' },
    { key: 'coag', label: 'Coagulation', score: plt ? band(plt.v, [150, 100, 50, 20], 'down') : null, basis: plt ? `Platelets ${plt.v} ×10⁹/L` : 'No platelets' },
    { key: 'cns', label: 'CNS', score: gcs ? (gcs.v >= 15 ? 0 : gcs.v >= 13 ? 1 : gcs.v >= 10 ? 2 : gcs.v >= 6 ? 3 : 4) : null, basis: gcs ? `GCS ${gcs.v}` : 'No GCS' },
    { key: 'resp', label: 'Respiratory', score: null, basis: 'Needs PaO₂/FiO₂' },
    { key: 'liver', label: 'Liver', score: null, basis: 'Needs bilirubin' },
  ];
  const scored = organs.filter((o) => o.score != null);
  return { total: scored.reduce((s, o) => s + (o.score ?? 0), 0), scored: scored.length, organs };
}

export type CriterionState = 'met' | 'no' | 'n/a';
export interface Criterion { label: string; state: CriterionState; value: string }
export interface Qsofa { met: number; known: number; criteria: Criterion[] }

/** qSOFA (Seymour 2016): RR ≥ 22, SBP ≤ 100, GCS < 15. */
export function qsofa(obs: Observation[]): Qsofa {
  const rr = latestOf(obs, 'rr');
  const sbp = latestOf(obs, 'sbp');
  const gcs = latestOf(obs, 'gcs');
  const mk = (label: string, m: Measured | null, unit: string, test: (v: number) => boolean): Criterion =>
    !m ? { label, state: 'n/a', value: 'Not measured' }
      : { label, state: test(m.v) ? 'met' : 'no', value: `${m.v}${unit ? ' ' + unit : ''}` };
  const criteria = [
    mk('Respiratory rate ≥ 22/min', rr, '/min', (v) => v >= 22),
    mk('Systolic BP ≤ 100 mmHg', sbp, 'mmHg', (v) => v <= 100),
    mk('GCS < 15', gcs, '', (v) => v < 15),
  ];
  return { met: criteria.filter((c) => c.state === 'met').length, known: criteria.filter((c) => c.state !== 'n/a').length, criteria };
}

export interface Finding { key: VarKey; text: string }

/** Measured values (latest) that cross a published criterion, shown with their units. */
export function findings(obs: Observation[]): Finding[] {
  const out: Finding[] = [];
  const add = (key: VarKey, digits = 0) => {
    const m = latestOf(obs, key);
    if (m) out.push({ key, text: `${VAR_LABEL[key].replace('Resp. rate', 'RR')} ${m.v.toFixed(digits)} ${VAR_UNIT[key]}`.trim() });
  };
  for (const lab of LABS) {
    const m = latestOf(obs, lab.key);
    if (m && lab.flag(m.v)) add(lab.key, lab.digits);
  }
  const map = latestOf(obs, 'map'); if (map && map.v < 65) add('map');
  const rr = latestOf(obs, 'rr'); if (rr && rr.v >= 22) add('rr');
  const temp = latestOf(obs, 'temp'); if (temp && temp.v > 38.3) add('temp', 1);
  const hr = latestOf(obs, 'hr'); if (hr && hr.v > 90) add('hr');
  return out;
}

export interface Row {
  patient: Patient;
  obs: Observation[];
  latest: { h: number; pts: number } | null;
  change: number | null;
  rising: boolean;
  above: boolean;
  fresh: Freshness;
  sofa: Sofa;
  qsofa: Qsofa;
  episodes: Episode[];
  active: Episode | null;
  findings: Finding[];
}

export function buildRows(ds: Dataset, thrPts: number): Row[] {
  const grouped = groupObservations(ds);
  return ds.patients.map((patient) => {
    const obs = grouped.get(patient.id)!;
    const latest = latestScore(obs);
    const change = changeOver6h(obs);
    const episodes = findEpisodes(obs, thrPts);
    const active = episodes.find((e) => e.ongoing) ?? null;
    return {
      patient, obs, latest, change,
      rising: change != null && change >= RISING_PTS,
      above: latest != null && latest.pts >= thrPts,
      fresh: freshness(obs), sofa: sofaPartial(obs), qsofa: qsofa(obs),
      episodes, active, findings: findings(obs),
    };
  });
}

export function baselineShift(obs: Observation[]): { key: VarKey; delta: number; latest: number; baseline: number }[] {
  const keys: VarKey[] = ['hr', 'sbp', 'map', 'temp', 'rr', 'spo2', 'lactate', 'wbc', 'creatinine', 'platelets'];
  const out: { key: VarKey; delta: number; latest: number; baseline: number }[] = [];
  for (const key of keys) {
    const base = obs.slice(0, 12).map((o) => o[key]).filter((v): v is number => v != null);
    const last = latestOf(obs, key);
    if (!base.length || !last) continue;
    const baseline = base.reduce((a, b) => a + b, 0) / base.length;
    out.push({ key, delta: last.v - baseline, latest: last.v, baseline });
  }
  return out;
}

export type Tone = 'critical' | 'rising' | 'stable';
/** Risk category used for colour: at/above threshold, rising 15+ points in 6 h, or neither. */
export const toneOf = (r: Row): Tone => (r.above ? 'critical' : r.rising ? 'rising' : 'stable');
export const hasDataIssue = (r: Row): boolean => r.fresh.stale || r.fresh.noVitals || r.fresh.noLactate;
