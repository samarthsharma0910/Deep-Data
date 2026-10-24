import { BUNDLE_ITEMS, LABS, LAST_HOUR } from '../config/clinical';
import { LabSpark } from '../charts/LabSpark';
import { latestOf, type Row } from '../lib/derive';
import { fmt } from '../lib/format';
import { useApp } from '../lib/store';
import { clock, formatLos, hourStamp } from '../lib/time';
import type { Observation } from '../types';

export function LabTable({ obs }: { obs: Observation[] }) {
  return (
    <section className="panel">
      <header className="panel-head"><h2>Laboratory values</h2><span className="sub">Dashed line = criterion</span></header>
      <table className="data-table labs">
        <colgroup><col style={{ width: 68 }} /><col style={{ width: 100 }} /><col style={{ width: 86 }} /><col style={{ width: 108 }} /></colgroup>
        <thead><tr><th>Lab</th><th>Latest</th><th>Criterion</th><th>48 h</th></tr></thead>
        <tbody>
          {LABS.map((lab) => {
            const m = latestOf(obs, lab.key);
            const flagged = m ? lab.flag(m.v) : false;
            return (
              <tr key={lab.key} className="row-static">
                <td className="strong">{lab.label}</td>
                <td>
                  {m ? <><b className={flagged ? 'tone-critical' : ''}>{fmt(m.v, lab.digits)}</b> <span className="sub">{lab.unit}</span>
                    <div className="sub">{hourStamp(m.h)}</div></> : <span className="chip chip-outline">Not measured</span>}
                </td>
                <td><span className={flagged ? 'tone-critical' : ''}>{lab.criterionText}</span><div className="sub">{lab.source}</div></td>
                <td><LabSpark obs={obs} lab={lab} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export function BundleChecklist({ pid }: { pid: string }) {
  const { state, dispatch } = useApp();
  const done = state.bundle[pid] ?? {};
  return (
    <section className="panel">
      <header className="panel-head"><h2>Sepsis bundle checklist</h2><span className="sub">Documentation only</span></header>
      <ul className="bundle">
        {BUNDLE_ITEMS.map((b) => {
          const at = done[b.id];
          return (
            <li key={b.id} className={at ? 'is-done' : ''}>
              <div>
                <span>{b.label}</span>
                <span className="sub">{at ? `Recorded ${clock(at)}` : 'Not recorded'}</span>
              </div>
              <button type="button" className={`btn btn-sm ${at ? 'btn-ghost' : 'btn-secondary'}`}
                onClick={() => dispatch({ type: 'bundle', pid, item: b.id, on: !at })}>{at ? 'Undo' : 'Record'}</button>
            </li>
          );
        })}
      </ul>
      <p className="panel-foot">No orders are placed. Items are never completed automatically and each record is logged.</p>
    </section>
  );
}

export const lastMeasuredText = (h: number | null): string =>
  h == null ? 'never' : `${hourStamp(h)}${LAST_HOUR - h > 0 ? ` (${LAST_HOUR - h} h ago)` : ' (now)'}`;

export function PatientDetails({ row }: { row: Row }) {
  const { obs, fresh, patient } = row;
  const vitalsHours = obs.filter((o) => [o.hr, o.sbp, o.map, o.rr, o.spo2].some((v) => v != null)).length;
  const labsOnFile = LABS.filter((l) => obs.some((o) => o[l.key] != null)).length;
  return (
    <section className="panel">
      <header className="panel-head"><h2>Patient details</h2><span className="sub">{patient.unit === 'Unspecified' ? 'Unit not recorded' : patient.unit}</span></header>
      <dl className="kv">
        <div><dt>Length of stay</dt><dd>{formatLos(patient.admitHoursBeforeSnapshot)}</dd></div>
        <div><dt>Vitals coverage</dt><dd>{vitalsHours} of {obs.length} h</dd></div>
        <div><dt>Last vitals</dt><dd>{lastMeasuredText(fresh.lastVitalsH)}</dd></div>
        <div><dt>Lab panels on file</dt><dd>{labsOnFile} of {LABS.length}</dd></div>
      </dl>
    </section>
  );
}
