import { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Availability } from '../charts/Availability';
import { Explain } from '../charts/Explain';
import { RiskHistory, type Marker } from '../charts/RiskHistory';
import { SofaBars } from '../charts/SofaBars';
import { VitalCards } from '../charts/VitalCards';
import { HoverProvider } from '../charts/shared';
import { ChangeCell, StatusPill } from '../components/cells';
import { BundleChecklist, LabTable, PatientDetails } from '../components/PatientPanels';
import { BUNDLE_ITEMS, LAST_HOUR } from '../config/clinical';
import { hourStamp, hourToMs, msToHour, stamp } from '../lib/time';
import { toneOf } from '../lib/derive';
import { useGo } from '../lib/nav';
import { useApp, type ReviewMode } from '../lib/store';

const REVIEW_TAG: Record<string, string> = { acknowledged: 'Ack', escalated: 'Esc', dismissed: 'Dis' };
const BUNDLE_TAG: Record<string, string> = { cultures: 'Cx', antibiotics: 'Abx', lactate: 'Lac', fluids: 'Fl' };
const TONE_LABEL = { critical: 'Critical', rising: 'Rising', stable: 'Stable' } as const;

export function PatientView({ pid }: { pid: string }) {
  const { rows, alerts, state, dispatch, dataset } = useApp();
  const go = useGo();
  const row = rows.find((r) => r.patient.id === pid);
  const thr = state.threshold;

  const markers = useMemo<Marker[]>(() => {
    const out: Marker[] = [];
    for (const r of Object.values(state.reviews)) {
      if (r.pid === pid) out.push({ hour: msToHour(r.at), label: REVIEW_TAG[r.status], detail: r.reason ?? 'Acknowledged' });
    }
    for (const [item, at] of Object.entries(state.bundle[pid] ?? {})) {
      out.push({ hour: msToHour(at), label: BUNDLE_TAG[item] ?? 'Bundle', detail: BUNDLE_ITEMS.find((b) => b.id === item)?.label ?? item });
    }
    return out;
  }, [state.reviews, state.bundle, pid]);

  if (!row) {
    return <div className="page"><div className="empty"><p>No patient with ID {pid}.</p><a className="btn btn-primary" href="#census">Back to census</a></div></div>;
  }
  const { patient: p, obs, fresh } = row;
  const tone = toneOf(row);
  const active = alerts.find((a) => a.episode.pid === pid && a.episode.ongoing) ?? null;
  const explanation = dataset.explanations?.filter((x) => x.pid === pid).sort((a, b) => b.hour - a.hour)[0] ?? null;
  const act = (mode: ReviewMode) => active && dispatch({ type: 'openDialog', target: { mode, key: active.episode.key, pid } });
  const back = state.backTo === 'alerts' ? 'alerts' : 'census';
  const ordered = [...rows].sort((a, b) => a.patient.bed.localeCompare(b.patient.bed));
  const finalReview = active && (active.status === 'acknowledged' || active.status === 'dismissed');
  const admitted = stamp(hourToMs(LAST_HOUR) - p.admitHoursBeforeSnapshot * 3_600_000);

  return (
    <div className="page">
      <section className="patient-head">
        <div className="ph-top">
          <a className="back-light" href={`#${back}`}><ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />Back to {back === 'alerts' ? 'alert queue' : 'census'}</a>
          <label className="switcher switcher-light"><span>Patient</span>
            <select value={pid} onChange={(e) => go({ page: 'patient', pid: e.target.value })}>
              {ordered.map((r) => <option key={r.patient.id} value={r.patient.id}>{r.patient.bed} · {r.patient.id}</option>)}
            </select>
          </label>
        </div>
        <div className="ph-main">
          <div className="ph-id">
            <h1>{p.bed} <span className="mono">{p.id}</span></h1>
            <p>{p.age} years · {p.sex === 'M' ? 'Male' : 'Female'} · {p.diagnosis ?? 'Diagnosis not recorded'}</p>
            <p className="ph-admit">Admitted {admitted}{p.unit === 'Unspecified' ? '' : ` · ${p.unit}`}</p>
          </div>
          <dl className="ph-metrics">
            <div><dt>Risk score</dt><dd><span className={`big tone-on-dark-${tone}`}>{row.latest?.pts ?? '—'}</span><span className={`ph-tone ph-tone-${tone}`}>{TONE_LABEL[tone]}</span></dd></div>
            <div><dt>Change (6 h)</dt><dd className="mid"><ChangeCell change={row.change} /></dd></div>
            <div><dt>Alert</dt><dd>{active ? <><StatusPill status={active.status} /><span className="sub block">since {hourStamp(active.episode.startHour)}</span></> : <span className="ph-none">None open</span>}</dd></div>
          </dl>
          <div className="ph-actions">
            <button type="button" className="btn btn-light" disabled={!active || !!finalReview} onClick={() => act('acknowledge')}>Acknowledge</button>
            <button type="button" className="btn btn-outline-light" disabled={!active || !!finalReview || active.status === 'escalated'} onClick={() => act('escalate')}>Escalate</button>
            <button type="button" className="btn btn-link-light" disabled={!active || !!finalReview} onClick={() => act('dismiss')}>Dismiss</button>
          </div>
        </div>
      </section>

      {(fresh.stale || fresh.noVitals) && (
        <div className="banner" role="status">
          <b>{fresh.noVitals ? 'No vital signs recorded.' : `Vitals are ${fresh.ageH} h old.`}</b>{' '}
          {fresh.noVitals ? 'The risk score cannot be updated.' : `Last vitals ${hourStamp(fresh.lastVitalsH as number)}. The risk score shown is from that hour and may not reflect the patient now.`}
        </div>
      )}

      <HoverProvider>
        <div className="patient-grid">
          <div className="pg-main">
            <RiskHistory obs={obs} thr={thr} markers={markers} />
            <section>
              <h2 className="section-title">Vital signs</h2>
              <VitalCards obs={obs} />
            </section>
            <Availability obs={obs} />
            <Explain obs={obs} explanation={explanation} />
          </div>
          <div className="pg-side">
            <PatientDetails row={row} />
            <LabTable obs={obs} />
            <SofaBars sofa={row.sofa} qsofa={row.qsofa} />
            <BundleChecklist pid={pid} />
          </div>
        </div>
      </HoverProvider>
    </div>
  );
}
