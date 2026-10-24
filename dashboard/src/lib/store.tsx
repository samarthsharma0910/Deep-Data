import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import { ACTOR, BUNDLE_ITEMS } from '../config/clinical';
import type { AuditEvent, Dataset, Unit } from '../types';
import { buildAlerts, type AlertItem, type Review } from './alerts';
import { buildRows, hasDataIssue, toneOf, type Row } from './derive';
import { getSnapshotMs } from './time';

export type SortKey = 'bed' | 'id' | 'age' | 'dx' | 'los' | 'risk' | 'change' | 'sofa' | 'qsofa' | 'data' | 'status';
export type ReviewMode = 'acknowledge' | 'escalate' | 'dismiss';
export type AlertTab = 'open' | 'reviewed' | 'all';
export type Kpi = 'critical' | 'rising' | 'issues' | 'stable';

export interface DialogTarget { mode: ReviewMode; key: string; pid: string }

export interface State {
  threshold: number;
  unit: 'ALL' | Unit;
  query: string;
  kpi: Kpi | null;
  sort: { key: SortKey; dir: 'asc' | 'desc' };
  alertTab: AlertTab;
  reviews: Record<string, Review>;
  audit: AuditEvent[];
  bundle: Record<string, Record<string, number>>;
  toast: { id: number; text: string } | null;
  dialog: DialogTarget | null;
  lastPid: string | null;
  backTo: 'census' | 'alerts';
}

export type Action =
  | { type: 'threshold'; value: number }
  | { type: 'unit'; value: State['unit'] }
  | { type: 'query'; value: string }
  | { type: 'kpi'; value: Kpi }
  | { type: 'sort'; key: SortKey }
  | { type: 'clearFilters' }
  | { type: 'alertTab'; value: AlertTab }
  | { type: 'openDialog'; target: DialogTarget | null }
  | { type: 'review'; mode: ReviewMode; key: string; pid: string; reason?: string; note?: string }
  | { type: 'bundle'; pid: string; item: string; on: boolean }
  | { type: 'visit'; pid: string; from: 'census' | 'alerts' }
  | { type: 'reset' }
  | { type: 'toastClear'; id: number };

const startedAt = Date.now();
/** Demo clock: the snapshot time plus the real time elapsed since the page opened. */
export const demoNow = () => getSnapshotMs() + (Date.now() - startedAt);

const initial = (threshold: number): State => ({
  threshold, unit: 'ALL', query: '', kpi: null, sort: { key: 'risk', dir: 'desc' }, alertTab: 'open', reviews: {}, audit: [],
  bundle: {}, toast: null, dialog: null, lastPid: null, backTo: 'census',
});

let seq = 0;
const nextId = () => ++seq;
const toast = (text: string): State['toast'] => ({ id: nextId(), text });

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'threshold': return { ...s, threshold: a.value };
    case 'unit': return { ...s, unit: a.value };
    case 'query': return { ...s, query: a.value };
    case 'kpi': return { ...s, kpi: s.kpi === a.value ? null : a.value };
    case 'clearFilters': return { ...s, unit: 'ALL', query: '', kpi: null };
    case 'sort':
      return { ...s, sort: s.sort.key === a.key
        ? { key: a.key, dir: s.sort.dir === 'asc' ? 'desc' : 'asc' }
        : { key: a.key, dir: a.key === 'risk' || a.key === 'change' || a.key === 'sofa' || a.key === 'qsofa' ? 'desc' : 'asc' } };
    case 'alertTab': return { ...s, alertTab: a.value };
    case 'openDialog': return { ...s, dialog: a.target };
    case 'visit': return { ...s, lastPid: a.pid, backTo: a.from };
    case 'reset': return { ...initial(s.threshold), toast: toast('Session data cleared') };
    case 'toastClear': return s.toast?.id === a.id ? { ...s, toast: null } : s;
    case 'review': {
      const status = a.mode === 'acknowledge' ? 'acknowledged' : a.mode === 'escalate' ? 'escalated' : 'dismissed';
      const at = demoNow();
      const review: Review = { key: a.key, pid: a.pid, status, reason: a.reason, note: a.note, at };
      const event: AuditEvent = { id: `A${nextId()}`, at, actor: ACTOR, action: a.mode, pid: a.pid, alertKey: a.key, reason: a.reason, note: a.note };
      const verb = a.mode === 'acknowledge' ? 'acknowledged' : a.mode === 'escalate' ? 'escalated' : 'dismissed';
      return { ...s, dialog: null, reviews: { ...s.reviews, [a.key]: review }, audit: [event, ...s.audit], toast: toast(`Alert for ${a.pid} ${verb}`) };
    }
    case 'bundle': {
      const label = BUNDLE_ITEMS.find((b) => b.id === a.item)?.label ?? a.item;
      const at = demoNow();
      const cur = { ...(s.bundle[a.pid] ?? {}) };
      if (a.on) cur[a.item] = at; else delete cur[a.item];
      const event: AuditEvent = { id: `A${nextId()}`, at, actor: ACTOR, action: a.on ? 'bundle-record' : 'bundle-undo', pid: a.pid, detail: label };
      return { ...s, bundle: { ...s.bundle, [a.pid]: cur }, audit: [event, ...s.audit],
        toast: toast(`${label}: ${a.on ? 'recorded' : 'undone'} for ${a.pid}`) };
    }
  }
}

interface Ctx {
  dataset: Dataset;
  state: State;
  dispatch: Dispatch<Action>;
  rows: Row[];
  alerts: AlertItem[];
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ dataset, children }: { dataset: Dataset; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, Math.round(dataset.meta.demoThreshold * 100), initial);
  const rows = useMemo(() => buildRows(dataset, state.threshold), [dataset, state.threshold]);
  const alerts = useMemo(() => buildAlerts(rows, state.reviews), [rows, state.reviews]);
  const value = useMemo(() => ({ dataset, state, dispatch, rows, alerts }), [dataset, state, rows, alerts]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
}

/** Rows after the unit filter and search, in table sort order. Shared by the table and both census charts. */
export function useVisibleRows(): { visible: Row[]; total: number; filtered: boolean } {
  const { rows, state, alerts } = useApp();
  return useMemo(() => {
    const q = state.query.trim().toLowerCase();
    const filtered = rows.filter((r) =>
      (state.unit === 'ALL' || r.patient.unit === state.unit) &&
      (!q || [r.patient.bed, r.patient.id, r.patient.diagnosis ?? ''].some((t) => t.toLowerCase().includes(q))) &&
      (!state.kpi || (state.kpi === 'issues' ? hasDataIssue(r) : toneOf(r) === state.kpi)));
    const statusRank = (r: Row) => { const a = alerts.find((x) => x.episode.pid === r.patient.id && x.episode.ongoing); return a ? ['awaiting', 'escalated', 'acknowledged', 'dismissed'].indexOf(a.status) : 9; };
    const val: Record<SortKey, (r: Row) => number | string> = {
      bed: (r) => r.patient.bed, id: (r) => r.patient.id, age: (r) => r.patient.age,
      dx: (r) => r.patient.diagnosis ?? '', los: (r) => r.patient.admitHoursBeforeSnapshot,
      risk: (r) => r.latest?.pts ?? -1, change: (r) => r.change ?? -999, sofa: (r) => r.sofa.total,
      qsofa: (r) => r.qsofa.met, data: (r) => (r.fresh.stale || r.fresh.noVitals ? 2 : 0) + (r.fresh.noLactate ? 1 : 0),
      status: statusRank,
    };
    const f = val[state.sort.key];
    const sign = state.sort.dir === 'asc' ? 1 : -1;
    const visible = [...filtered].sort((a, b) => {
      const x = f(a), y = f(b);
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
      return c * sign || (b.latest?.pts ?? -1) - (a.latest?.pts ?? -1);
    });
    return { visible, total: rows.length, filtered: state.unit !== 'ALL' || q.length > 0 || state.kpi !== null };
  }, [rows, alerts, state.unit, state.query, state.kpi, state.sort]);
}
