import { useMemo, useState } from 'react';
import { CLINICAL_KEYS, GROUPS, LABEL, UNIT, type Field } from '../config/assess';
import { contributions, nearestCalibration, predict, type Inputs, type ModelFile } from '../lib/model';
import { useModelFile } from '../lib/useModel';

type Sex = '' | '0' | '1';
type UnitChoice = '' | 'MICU' | 'SICU';

const pct = (p: number, d = 1) => `${(p * 100).toFixed(d)}%`;
const signedPp = (d: number) => `${d >= 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(1)} pp`;

function FieldInput({ field, value, onChange, warn }: { field: Field; value: string; onChange: (v: string) => void; warn?: string }) {
  return (
    <div className={`input-field${warn ? ' has-warn' : ''}`}>
      <label htmlFor={`f-${field.key}`}>{field.label}</label>
      <div className="input-wrap">
        <input id={`f-${field.key}`} type="number" inputMode="decimal" step={field.step ?? '1'} value={value}
          onChange={(e) => onChange(e.target.value)} placeholder="Not measured" />
        {field.unit && <span className="input-unit">{field.unit}</span>}
      </div>
      {warn && <span className="input-warn">{warn}</span>}
    </div>
  );
}

function Result({ model, inputs, provided, warnings }: { model: ModelFile; inputs: Inputs; provided: number; warnings: string[] }) {
  const ev = model.evaluation;
  const r = useMemo(() => {
    const p = predict(model, inputs);
    return { p, contrib: contributions(model, inputs).slice(0, 6), cal: nearestCalibration(model, p) };
  }, [model, inputs]);
  const flagged = r.p >= ev.operatingThreshold;
  const maxDelta = Math.max(1e-9, ...r.contrib.map((c) => Math.abs(c.delta)));
  const fmtVal = (k: string) => { const v = inputs[k]; return v == null ? '' : `${v}${UNIT[k] ? ' ' + UNIT[k] : ''}`; };

  return (
    <>
      <div className={`res-flag ${flagged ? 'res-high' : 'res-low'}`}>{flagged ? 'Above the model alert threshold' : 'Below the model alert threshold'}</div>
      <div className="res-main">
        <b>{pct(r.p)}</b>
        <span>Estimated probability that this hour is labelled sepsis</span>
      </div>
      <dl className="kv res-compare">
        <div><dt>This patient</dt><dd className={flagged ? 'tone-critical' : 'tone-stable'}>{pct(r.p)}</dd></div>
        <div><dt>Model alert threshold</dt><dd>{pct(ev.operatingThreshold)}</dd></div>
        <div><dt>Average ICU hour in the training data</dt><dd>{pct(ev.baselineAuprc)}</dd></div>
      </dl>
      {r.cal && (
        <p className="res-note">In held-out patients, hours that scored like this were labelled sepsis {pct(r.cal.observed)} of the time (n = {r.cal.n.toLocaleString()}).</p>
      )}

      <h3 className="res-title">What drives this estimate</h3>
      <ul className="drivers">
        {r.contrib.map((c) => (
          <li key={c.feature}>
            <div className="driver-top"><span>{LABEL[c.feature] ?? c.feature} <i>{fmtVal(c.feature)}</i></span><b className={c.delta >= 0 ? 'up' : 'down'}>{signedPp(c.delta)}</b></div>
            <div className="driver-track"><span className={c.delta >= 0 ? 'up' : 'down'} style={{ width: `${(Math.abs(c.delta) / maxDelta) * 100}%` }} /></div>
          </li>
        ))}
      </ul>
      <p className="res-note">Change in probability compared with a typical (median) value for each entered input. Describes the model, not clinical causes.</p>

      {provided < 5 && <div className="res-warn">Only {provided} of {CLINICAL_KEYS.length} measurements entered. With few inputs the estimate leans on population averages.</div>}
      {warnings.length > 0 && <div className="res-warn">Outside the range seen in training: {warnings.join(', ')}. The estimate may be unreliable.</div>}
    </>
  );
}

export function Assess() {
  const { model, examples, error, loading } = useModelFile();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [sex, setSex] = useState<Sex>('');
  const [unit, setUnit] = useState<UnitChoice>('');

  const toNum = (s: string | undefined): number | null => {
    if (s == null || s.trim() === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const inputs = useMemo<Inputs>(() => {
    const o: Inputs = {};
    for (const k of [...CLINICAL_KEYS, 'Age', 'HospAdmTime', 'ICULOS']) o[k] = toNum(vals[k]);
    o.Gender = sex === '' ? null : Number(sex);
    o.Unit1 = unit === 'MICU' ? 1 : 0;
    o.Unit2 = unit === 'SICU' ? 1 : 0;
    return o;
  }, [vals, sex, unit]);

  const provided = CLINICAL_KEYS.filter((k) => inputs[k] != null).length;
  const warnFor = (k: string): string | undefined => {
    const v = inputs[k], m = model?.meta[k];
    if (v == null || !m) return undefined;
    return v < m.min || v > m.max ? `Outside the range seen in training (${m.min}–${m.max})` : undefined;
  };
  const warnings = [...CLINICAL_KEYS, 'Age', 'HospAdmTime', 'ICULOS'].filter((k) => warnFor(k)).map((k) => LABEL[k] ?? k);

  const set = (k: string) => (v: string) => setVals((s) => ({ ...s, [k]: v }));
  const clear = () => { setVals({}); setSex(''); setUnit(''); };
  const load = (id: string) => {
    const ex = examples.find((e) => e.id === id);
    if (!ex) return;
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(ex.values)) next[k] = String(v);
    setVals(next);
    setSex(ex.values.Gender === 1 ? '1' : ex.values.Gender === 0 ? '0' : '');
    setUnit(ex.values.Unit1 === 1 ? 'MICU' : ex.values.Unit2 === 1 ? 'SICU' : '');
  };
  const demoProvided = ['Age', 'HospAdmTime', 'ICULOS'].filter((k) => inputs[k] != null).length + (sex ? 1 : 0) + (unit ? 1 : 0);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Assess Patient</h1>
        <p>Enter a patient's latest values and the trained model estimates the chance that this hour is labelled sepsis. Leave unmeasured values blank.</p>
      </div>
      {error && <div className="banner" role="alert"><b>The model could not be loaded.</b> {error}</div>}

      <div className="assess-layout">
        <div className="assess-form">
          <div className="toolbar">
            <span className="label">Load a real held-out record</span>
            {examples.map((e) => (
              <button key={e.id} type="button" className="btn btn-secondary btn-sm" onClick={() => load(e.id)} title={e.note}>{e.title}</button>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={clear} disabled={!provided && !demoProvided}>Clear all</button>
            <span className="count">{provided} of {CLINICAL_KEYS.length} measurements · {demoProvided} of 5 patient details</span>
          </div>

          <section className="panel">
            <header className="panel-head"><h2>Patient</h2><span className="sub">Optional, but they improve the estimate</span></header>
            <div className="assess-grid">
              <FieldInput field={{ key: 'Age', label: 'Age', unit: 'years' }} value={vals.Age ?? ''} onChange={set('Age')} warn={warnFor('Age')} />
              <div className="input-field">
                <label htmlFor="f-sex">Sex</label>
                <select id="f-sex" value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
                  <option value="">Not specified</option><option value="0">Female</option><option value="1">Male</option>
                </select>
              </div>
              <div className="input-field">
                <label htmlFor="f-unit">ICU type</label>
                <select id="f-unit" value={unit} onChange={(e) => setUnit(e.target.value as UnitChoice)}>
                  <option value="">Not specified</option><option value="MICU">Medical ICU</option><option value="SICU">Surgical ICU</option>
                </select>
              </div>
              <FieldInput field={{ key: 'ICULOS', label: 'ICU stay so far', unit: 'hours' }} value={vals.ICULOS ?? ''} onChange={set('ICULOS')} warn={warnFor('ICULOS')} />
              <FieldInput field={{ key: 'HospAdmTime', label: 'Hospital admission to ICU admission', unit: 'hours', step: '0.1' }} value={vals.HospAdmTime ?? ''} onChange={set('HospAdmTime')} warn={warnFor('HospAdmTime')} />
            </div>
            <p className="panel-foot">Hospital admission to ICU admission is negative when the patient was admitted to the hospital before the ICU (for example −12 means 12 hours earlier).</p>
          </section>

          {GROUPS.map((g) => (
            <section className="panel" key={g.id}>
              <header className="panel-head">
                <h2>{g.title}</h2>
                <span className="sub">{g.fields.filter((f) => inputs[f.key] != null).length} of {g.fields.length} entered</span>
              </header>
              <div className="assess-grid">
                {g.fields.map((f) => <FieldInput key={f.key} field={f} value={vals[f.key] ?? ''} onChange={set(f.key)} warn={warnFor(f.key)} />)}
              </div>
              {g.note && <p className="panel-foot">{g.note}</p>}
            </section>
          ))}
        </div>

        <aside className="assess-result panel" aria-label="Prediction" aria-live="polite">
          <header className="panel-head"><h2>Prediction</h2>{model && <span className="sub">{model.version}</span>}</header>
          <div className="res-body">
            {loading && <p className="muted">Loading the model…</p>}
            {!loading && model && provided === 0 && <p className="res-empty">Enter at least one vital sign or laboratory value to see a prediction, or load a real held-out record.</p>}
            {model && provided > 0 && <Result model={model} inputs={inputs} provided={provided} warnings={warnings} />}
          </div>
          {model && (
            <div className="res-foot">
              <p>Held-out validation: AUROC {model.evaluation.auroc.toFixed(2)}, AUPRC {model.evaluation.auprc.toFixed(3)} (average hour {pct(model.evaluation.baselineAuprc)}). <a href="#model">Model Performance</a></p>
              <p>Research demonstration trained on public PhysioNet/CinC 2019 ICU data. Not a medical device and not for clinical decisions.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
