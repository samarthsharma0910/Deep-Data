import { ChangeCell, FreshnessCell, InfoTip, StatusPill } from '../components/cells';
import { Sparkline } from '../charts/Sparkline';
import { ACTION_LABEL, isOpenAlert, isReviewed, type AlertItem } from '../lib/alerts';
import { latestOf, toneOf, type Tone } from '../lib/derive';
import { fmt } from '../lib/format';
import { LABS } from '../config/clinical';
import { hrefFor } from '../lib/router';
import { useOpenPatient } from '../lib/nav';
import { useApp, type AlertTab, type ReviewMode } from '../lib/store';
import { hourStamp, stamp } from '../lib/time';

const TONE_EDGE: Record<Tone, string> = { critical: 'var(--alert)', rising: 'var(--watch)', stable: 'var(--neutral-mark)' };
const TONE_LABEL: Record<Tone, string> = { critical: 'Critical', rising: 'Rising', stable: 'Below threshold' };
const CARD_LABS = LABS.filter((l) => l.key === 'lactate' || l.key === 'wbc' || l.key === 'creatinine');

function Actions({ item }: { item: AlertItem }) {
  const { dispatch } = useApp();
  const act = (mode: ReviewMode) => dispatch({ type: 'openDialog', target: { mode, key: item.episode.key, pid: item.episode.pid } });
  if (item.status === 'acknowledged' || item.status === 'dismissed') {
    return <span className="muted">{item.review?.reason ?? 'Reviewed'}</span>;
  }
  return (
    <span className="row-actions">
      <button type="button" className="btn btn-primary btn-sm" onClick={() => act('acknowledge')}>Acknowledge</button>
      <button type="button" className="btn btn-secondary btn-sm" disabled={item.status === 'escalated'} onClick={() => act('escalate')}>Escalate</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => act('dismiss')}>Dismiss</button>
    </span>
  );
}

function Card({ item, index }: { item: AlertItem; index: number }) {
  const { state } = useApp();
  const open = useOpenPatient('alerts');
  const r = item.row;
  const tone = toneOf(r);
  return (
    <article className="alert-card" style={{ ['--edge' as string]: TONE_EDGE[tone], animationDelay: `${Math.min(index, 8) * 30}ms` }}>
      <div className="ac-who">
        <a className="link ac-name" href={hrefFor({ page: 'patient', pid: r.patient.id })} onClick={(e) => { e.preventDefault(); open(r.patient.id); }}>
          <b>{r.patient.bed}</b> <span className="mono">{r.patient.id}</span>
        </a>
        <span className={`tone-badge tone-badge-${tone}`}>{TONE_LABEL[tone]}</span>
        <StatusPill status={item.status} />
        <InfoTip text={`Priority ${item.priority.toFixed(1)} = ${item.basis}`} />
      </div>
      <div className="ac-score">
        <div className={`big-score tone-${tone}`}><b>{r.latest?.pts ?? '—'}</b><span>Risk score</span></div>
        <div className="ac-trend">
          <Sparkline obs={r.obs} thr={state.threshold} tone={tone} />
          <span className="ac-change"><ChangeCell change={r.change} /> <i>6 h</i></span>
        </div>
      </div>
      <dl className="ac-labs">
        {CARD_LABS.map((lab) => {
          const m = latestOf(r.obs, lab.key);
          const flagged = m ? lab.flag(m.v) : false;
          return (
            <div key={lab.key} className={flagged ? 'is-flagged' : ''}>
              <dt>{lab.label}</dt>
              <dd>{m ? <>{fmt(m.v, lab.digits)} <span>{lab.unit}</span></> : <span className="muted">Not measured</span>}</dd>
            </div>
          );
        })}
      </dl>
      <div className="ac-meta">
        <span><b>{hourStamp(item.episode.startHour)}</b></span>
        <span>{item.episode.ongoing ? `Open for ${item.hoursOpen} h` : `Ended ${hourStamp(item.episode.endHour)}`}</span>
        <FreshnessCell fresh={r.fresh} />
      </div>
      <div className="ac-actions"><Actions item={item} /></div>
    </article>
  );
}

export function AlertQueue() {
  const { alerts, state, dispatch } = useApp();
  const shown = alerts.filter((a) => (state.alertTab === 'open' ? isOpenAlert(a) : state.alertTab === 'reviewed' ? isReviewed(a) : true));
  const tabs: { id: AlertTab; label: string }[] = [{ id: 'open', label: 'Open' }, { id: 'reviewed', label: 'Reviewed' }, { id: 'all', label: 'All' }];

  return (
    <div className="page">
      <div className="page-head">
        <h1>Alert Queue</h1>
        <p>Patients with sustained elevated risk, sorted by urgency.</p>
      </div>
      <div className="queue-layout">
        <div className="queue-main">
          <div className="segmented" role="group" aria-label="Alert filter">
            {tabs.map((t) => (
              <button key={t.id} type="button" aria-pressed={state.alertTab === t.id}
                onClick={() => dispatch({ type: 'alertTab', value: t.id })}>{t.label}</button>
            ))}
          </div>
          <div className="alert-list">
            {shown.map((it, i) => <Card key={it.episode.key} item={it} index={i} />)}
            {shown.length === 0 && (
              <div className="empty card-empty"><p>{state.alertTab === 'open' ? 'No open alerts at this threshold.' : state.alertTab === 'reviewed' ? 'No alerts have been reviewed in this session.' : 'No alert episodes at this threshold.'}</p></div>
            )}
          </div>
        </div>
        <aside className="audit-panel" aria-label="Audit history">
          <header><h2>Audit log</h2><span className="sub">This session only</span></header>
          {state.audit.length === 0 ? <p className="audit-empty">No actions recorded yet.</p> : (
            <ol className="audit-list">
              {state.audit.map((a) => (
                <li key={a.id}>
                  <div className="audit-top"><b>{ACTION_LABEL[a.action]}</b><span className="mono">{a.pid}</span></div>
                  {(a.detail || a.reason) && <div className="audit-line">{a.detail ?? a.reason}</div>}
                  {a.note && <div className="audit-line audit-note">{a.note}</div>}
                  <div className="audit-meta">{stamp(a.at)} · {a.actor}</div>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </div>
  );
}
