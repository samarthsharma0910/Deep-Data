import { useState } from 'react';
import { ArrowDown, ArrowUp, Grid3x3, Search } from 'lucide-react';
import { Sparkline } from '../charts/Sparkline';
import { HeatmapModal } from '../components/HeatmapModal';
import { ChangeCell, FreshnessCell, ScoreCell, StatusPill } from '../components/cells';
import { formatLos } from '../lib/time';
import { hasDataIssue, toneOf } from '../lib/derive';
import { useOpenPatient } from '../lib/nav';
import { useApp, useVisibleRows, type Kpi, type SortKey } from '../lib/store';
import { UNIT_ORDER } from '../types';

const COLS: { key: SortKey; label: string; w: number; align?: 'right'; title?: string }[] = [
  { key: 'bed', label: 'Bed', w: 86 }, { key: 'id', label: 'Patient ID', w: 80 }, { key: 'age', label: 'Age/sex', w: 66 },
  { key: 'dx', label: 'Diagnosis', w: 156 }, { key: 'los', label: 'Length of stay', w: 108 }, { key: 'risk', label: 'Risk score', w: 108 },
  { key: 'risk', label: '12 h trend', w: 90 }, { key: 'change', label: 'Change (6 h)', w: 96, align: 'right' },
  { key: 'sofa', label: 'SOFA', w: 58, align: 'right', title: 'Partial SOFA: counts only the organs this dataset can score (cardiovascular, renal, coagulation, CNS)' },
  { key: 'qsofa', label: 'qSOFA', w: 62, align: 'right' }, { key: 'data', label: 'Data', w: 118 }, { key: 'status', label: 'Alert status', w: 132 },
];

export function Census() {
  const { rows, alerts, state, dispatch, dataset } = useApp();
  const { visible, total, filtered } = useVisibleRows();
  const open = useOpenPatient('census');
  const [showHeat, setShowHeat] = useState(false);
  const thr = state.threshold;
  const units = UNIT_ORDER.filter((u) => dataset.patients.some((p) => p.unit === u));

  const scoped = rows.filter((r) => state.unit === 'ALL' || r.patient.unit === state.unit);
  const kpis: { id: Kpi; label: string; value: number; sub: string }[] = [
    { id: 'critical', label: 'Critical', value: scoped.filter((r) => toneOf(r) === 'critical').length, sub: `Risk score ${thr} or higher` },
    { id: 'rising', label: 'Rising', value: scoped.filter((r) => toneOf(r) === 'rising').length, sub: 'Up 15+ points in 6 h' },
    { id: 'issues', label: 'Data issues', value: scoped.filter(hasDataIssue).length, sub: 'Stale vitals or no lactate' },
    { id: 'stable', label: 'Stable', value: scoped.filter((r) => toneOf(r) === 'stable').length, sub: 'Below threshold, not rising' },
  ];
  const statusFor = (pid: string) => alerts.find((a) => a.episode.pid === pid && a.episode.ongoing);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Unit Census</h1>
        <p>Current risk, trend and data quality for every occupied bed, most urgent first.</p>
      </div>
      <div className="kpi-row" role="group" aria-label="Filter patients by status">
        {kpis.map((k) => (
          <button key={k.id} type="button" className={`kpi kpi-${k.id}`} aria-pressed={state.kpi === k.id} onClick={() => dispatch({ type: 'kpi', value: k.id })}>
            <span className="kpi-label">{k.label}</span>
            <b>{k.value}</b>
            <span className="kpi-sub">{k.sub}</span>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Filter by unit">
          {(['ALL', ...units] as const).map((u) => (
            <button key={u} type="button" aria-pressed={state.unit === u} onClick={() => dispatch({ type: 'unit', value: u })}>
              {u === 'ALL' ? 'All Units' : u}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={15} strokeWidth={1.75} aria-hidden="true" />
          <input type="search" placeholder="Search bed, ID or diagnosis" value={state.query} aria-label="Search patients"
            onChange={(e) => dispatch({ type: 'query', value: e.target.value })} />
        </label>
        <button type="button" className="btn btn-secondary" aria-haspopup="dialog" onClick={() => setShowHeat(true)}>
          <Grid3x3 size={15} strokeWidth={1.9} aria-hidden="true" />Show heatmap
        </button>
        <span className="count">{visible.length} of {total} shown</span>
      </div>

      {showHeat && <HeatmapModal rows={visible} thr={thr} onOpen={open} onClose={() => setShowHeat(false)} />}

      <div className="table-wrap">
        <table className="data-table census" style={{ minWidth: COLS.reduce((s, c) => s + c.w, 0) }}>
          <colgroup>{COLS.map((c, i) => <col key={i} style={{ width: c.w }} />)}</colgroup>
          <thead>
            <tr>
              {COLS.map((c, i) => {
                const sortable = i !== 6;
                const active = sortable && state.sort.key === c.key;
                return (
                  <th key={i} className={c.align === 'right' ? 'r' : ''} title={c.title} aria-sort={active ? (state.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    {sortable
                      ? <button type="button" className="th-btn" onClick={() => dispatch({ type: 'sort', key: c.key })}>
                        {c.label}{active && (state.sort.dir === 'asc' ? <ArrowUp size={12} strokeWidth={2} /> : <ArrowDown size={12} strokeWidth={2} />)}
                      </button>
                      : c.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => {
              const a = statusFor(r.patient.id);
              const tone = toneOf(r);
              return (
                <tr key={r.patient.id} className={`row stripe-${tone}${state.lastPid === r.patient.id ? ' is-selected' : ''}`} tabIndex={0}
                  style={{ animationDelay: `${Math.min(i, 12) * 18}ms` }}
                  onClick={() => open(r.patient.id)} onKeyDown={(e) => { if (e.key === 'Enter') open(r.patient.id); }}
                  aria-label={`${r.patient.bed}, ${r.patient.id}, risk score ${r.latest?.pts ?? 'not measured'}`}>
                  <td className="strong">{r.patient.bed}</td>
                  <td className="mono">{r.patient.id}</td>
                  <td>{r.patient.age} {r.patient.sex}</td>
                  <td className="ellipsis" title={r.patient.diagnosis ?? undefined}>{r.patient.diagnosis ?? '—'}</td>
                  <td className="num-l">{formatLos(r.patient.admitHoursBeforeSnapshot)}</td>
                  <td><ScoreCell pts={r.latest?.pts ?? null} thr={thr} tone={tone} /></td>
                  <td><Sparkline obs={r.obs} thr={thr} tone={tone} /></td>
                  <td className="r"><ChangeCell change={r.change} /></td>
                  <td className="r num" title={`${r.sofa.scored} of 6 organs scored`}>{r.sofa.total}</td>
                  <td className={`r num${r.qsofa.met >= 2 ? ' strong' : ''}`} title={`${r.qsofa.known} of 3 criteria measurable`}>{r.qsofa.met}</td>
                  <td><FreshnessCell fresh={r.fresh} /></td>
                  <td>{a ? <StatusPill status={a.status} /> : <span className="muted">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div className="empty">
            <p>No patients match {state.query ? `"${state.query}"` : 'the current filters'}.</p>
            {filtered && <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: 'clearFilters' })}>Clear filters</button>}
          </div>
        )}
      </div>
    </div>
  );
}
