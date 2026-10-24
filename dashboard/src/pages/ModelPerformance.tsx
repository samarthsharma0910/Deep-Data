import { CalibrationChart, LeadTimeChart, PrChart, RocChart, ThresholdBurden } from '../charts/ModelCharts';
import { useApp } from '../lib/store';
import { useModelFile } from '../lib/useModel';

const SHAPES = `// public/data/dataset.json  (or GET {apiBase}/dataset)
{
  "meta": { "snapshotTime": "2026-10-23T09:00:00+05:30", "hours": 48,
            "demoThreshold": 0.60, "modelVersion": "v1.0", "dataSource": "project" },
  "patients": [ { "id": "P001", "bed": "MICU-01", "unit": "MICU", "age": 67, "sex": "M",
                  "diagnosis": null, "admitHoursBeforeSnapshot": 71 } ],
  "observations": [ { "pid": "P001", "h": 47, "hr": 118, "sbp": 92, "map": 61, "temp": 38.9,
                      "rr": 27, "spo2": 90, "gcs": null, "lactate": 4.1, "wbc": null,
                      "creatinine": null, "platelets": null, "score": 0.93 } ],
  "evaluation": {                      // null until held-out results exist
    "modelVersion": "v1.0", "cohort": "...", "splitMethod": "GroupKFold on Patient_ID",
    "partitions": [ { "name": "Test", "patients": 2812, "rows": 108704 } ],
    "auroc": 0.0, "auprc": 0.0, "sensitivity": 0.0, "specificity": 0.0, "precision": 0.0,
    "medianLeadTimeHours": 0.0,
    "roc": [ { "fpr": 0, "tpr": 0 } ], "pr": [ { "recall": 0, "precision": 1 } ],
    "calibration": [ { "predicted": 0.1, "observed": 0.08, "n": 120 } ], "leadTimes": [ 3, 7, 6 ]
  },
  "explanations": [ { "pid": "P001", "hour": 47, "method": "SHAP",
                      "attributions": [ { "feature": "Lactate", "value": 4.1, "contribution": 0.12 } ] } ]
}`;

const num = (v: number | undefined, d = 3) => (v == null ? null : v.toFixed(d));

interface Part { name: string; patients: number | null; rows: number | null; status?: string }

export function ModelPerformance() {
  const { dataset, state, dispatch, rows } = useApp();
  const { model } = useModelFile();
  // Evaluation shipped with the dataset wins; otherwise use the held-out evaluation of the trained assessment model.
  const ev = dataset.evaluation ?? model?.evaluation ?? null;
  const modelName = dataset.meta.modelVersion ?? model?.version ?? null;
  const scoresSimulated = dataset.meta.dataSource !== 'project';
  const metrics: [string, string | null, string][] = [
    ['AUROC', num(ev?.auroc), 'Ranking quality across all thresholds'],
    ['AUPRC', num(ev?.auprc), ev?.baselineAuprc != null ? `Average hour: ${ev.baselineAuprc.toFixed(3)}` : ''],
    ['Sensitivity', num(ev?.sensitivity), ev?.operatingThreshold != null ? `At alert threshold ${ev.operatingThreshold.toFixed(3)}` : ''],
    ['Specificity', num(ev?.specificity), ev?.operatingThreshold != null ? `At alert threshold ${ev.operatingThreshold.toFixed(3)}` : ''],
    ['Precision', num(ev?.precision), ev?.operatingThreshold != null ? `At alert threshold ${ev.operatingThreshold.toFixed(3)}` : ''],
    ['Median lead time', ev?.medianLeadTimeHours == null ? null : `${ev.medianLeadTimeHours.toFixed(1)} h`,
      ev?.patientsDetected != null ? `First alert before onset, ${ev.patientsDetected} of ${ev.sepsisPatients} sepsis patients detected` : ''],
  ];
  const parts: Part[] = ev?.partitions?.length ? (ev.partitions as Part[]) : [
    { name: 'Training', patients: null, rows: null }, { name: 'Validation', patients: null, rows: null },
    { name: 'Test', patients: null, rows: null },
  ];
  const sim: Part = { name: 'Simulated demo cohort', patients: dataset.patients.length, rows: dataset.observations.length, status: 'Census and Alert Queue data' };
  const hasCurves = ev && (ev.roc || ev.pr || ev.calibration || ev.leadTimes);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Model Performance</h1>
        <p>{ev ? `${ev.modelVersion} · ${ev.cohort} · ${ev.splitMethod}` : 'No model is connected. Evaluation results appear here once held-out output exists.'}</p>
      </div>

      {model && scoresSimulated && (
        <div className="banner" role="note">
          <b>Two separate things.</b> The trained model below powers <a href="#assess">Assess Patient</a>. The scores on Unit Census, Alert Queue and Patient Investigation are still simulated demo data, not output of this model.
        </div>
      )}

      <div className="two-col">
        <section className="panel">
          <header className="panel-head"><h2>Data partitions</h2></header>
          <table className="data-table"><thead><tr><th>Partition</th><th className="r">Patients</th><th className="r">Rows</th><th>Status</th></tr></thead>
            <tbody>{[...parts, ...(scoresSimulated ? [sim] : [])].map((p) => (
              <tr key={p.name} className="row-static"><td className="strong">{p.name}</td>
                <td className="r">{p.patients ?? <span className="muted">Not connected</span>}</td>
                <td className="r">{p.rows ?? <span className="muted">Not connected</span>}</td>
                <td className="sub">{p.status ?? ''}</td></tr>
            ))}</tbody></table>
        </section>
        <section className="panel">
          <header className="panel-head"><h2>Metrics</h2><span className="sub">{ev ? 'Held-out patients only' : 'Target lead time: 6 h before onset'}</span></header>
          <table className="data-table"><thead><tr><th>Metric</th><th className="r">Value</th><th>Note</th></tr></thead>
            <tbody>{metrics.map(([m, v, note]) => (
              <tr key={m} className="row-static"><td className="strong">{m}</td>
                <td className="r num">{v ?? <span className="muted">Not available</span>}</td>
                <td className="sub">{note}</td></tr>
            ))}</tbody></table>
          {modelName && <p className="panel-foot">Model {modelName}. Snapshot model: it sees one set of values per hour, not the history.</p>}
        </section>
      </div>

      <section className="panel">
        <header className="panel-head">
          <h2>Alert threshold</h2><span className="sub">Applies to the simulated census scores · demo setting, not clinically validated</span>
        </header>
        <div className="slider-row">
          <label htmlFor="thr">Threshold</label>
          <input id="thr" type="range" min={1} max={90} step={1} value={state.threshold}
            onChange={(e) => dispatch({ type: 'threshold', value: Number(e.target.value) })} />
          <output htmlFor="thr">{state.threshold}</output>
        </div>
        <ThresholdBurden rows={rows} thr={state.threshold} />
      </section>

      {hasCurves && (
        <div className="grid-4">
          {ev.roc && <RocChart data={ev.roc} />}
          {ev.pr && <PrChart data={ev.pr} />}
          {ev.calibration && <CalibrationChart data={ev.calibration} />}
          {ev.leadTimes && <LeadTimeChart data={ev.leadTimes} />}
        </div>
      )}

      <details className="panel integration">
        <summary>Connecting a model</summary>
        <ol className="steps">
          <li>Write <code>dataset.json</code> to <code>public/data/</code> with <code>python scripts/export_from_project.py</code>, or serve the same shape at <code>GET {'{apiBase}'}/dataset</code> after setting <code>apiBase</code> in <code>src/data/source.ts</code>.</li>
          <li>Fill <code>score</code> (0–1) per patient-hour and set <code>meta.modelVersion</code> and <code>meta.dataSource</code> to <code>"project"</code>.</li>
          <li>Add <code>evaluation</code> and <code>explanations</code> when held-out results exist; the metrics, curves and patient explanation appear on their own.</li>
          <li>The Assess Patient page reads <code>public/data/model.json</code>, written by <code>python scripts/03_train.py</code>.</li>
        </ol>
        <pre className="code" tabIndex={0}>{SHAPES}</pre>
      </details>
    </div>
  );
}
