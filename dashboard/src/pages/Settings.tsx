import { useApp } from '../lib/store';
import { stamp, getSnapshotMs } from '../lib/time';
import { useModelFile } from '../lib/useModel';

export function Settings() {
  const { dataset, state, dispatch } = useApp();
  const { model } = useModelFile();
  const reviewed = Object.keys(state.reviews).length;
  const bundle = Object.values(state.bundle).reduce((n, b) => n + Object.keys(b).length, 0);

  const reset = () => {
    if (window.confirm('Clear review actions, audit log, bundle records and filters for this session?')) dispatch({ type: 'reset' });
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Settings</h1>
        <p>Display and session options for this browser. Nothing here is saved to a server.</p>
      </div>

      <div className="two-col">
        <section className="panel">
          <header className="panel-head"><h2>Alert threshold</h2><span className="sub">Demo setting, not clinically validated</span></header>
          <div className="slider-row">
            <label htmlFor="settings-thr">Risk score</label>
            <input id="settings-thr" type="range" min={1} max={90} step={1} value={state.threshold}
              onChange={(e) => dispatch({ type: 'threshold', value: Number(e.target.value) })} />
            <output htmlFor="settings-thr">{state.threshold}</output>
          </div>
          <p className="panel-foot">Scores at or above this value count as critical and raise alerts on the census, alert queue and patient pages.</p>
        </section>

        <section className="panel">
          <header className="panel-head"><h2>Session</h2><span className="sub">Stored in memory only</span></header>
          <dl className="kv">
            <div><dt>Review actions</dt><dd>{reviewed}</dd></div>
            <div><dt>Bundle items recorded</dt><dd>{bundle}</dd></div>
            <div><dt>Audit entries</dt><dd>{state.audit.length}</dd></div>
          </dl>
          <div className="panel-actions">
            <button type="button" className="btn btn-secondary" onClick={reset}
              disabled={!reviewed && !bundle && !state.audit.length && state.unit === 'ALL' && !state.query && !state.kpi}>Clear session data</button>
          </div>
        </section>
      </div>

      <section className="panel">
        <header className="panel-head"><h2>Data source and model</h2></header>
        <dl className="kv kv-wide">
          <div><dt>Census data</dt><dd>{dataset.meta.dataSource === 'project' ? 'Retrospective replay of held-out records' : 'Simulated demo cohort'}</dd></div>
          <div><dt>Census scores from</dt><dd>{dataset.meta.modelVersion ?? 'Simulation (no model feed)'}</dd></div>
          <div><dt>Assessment model</dt><dd>{model ? `${model.version} (loaded)` : 'Not loaded'}</dd></div>
          <div><dt>Snapshot</dt><dd>{stamp(getSnapshotMs())}</dd></div>
          <div><dt>Patients</dt><dd>{dataset.patients.length}</dd></div>
          <div><dt>Observation rows</dt><dd>{dataset.observations.length}</dd></div>
        </dl>
      </section>
    </div>
  );
}
