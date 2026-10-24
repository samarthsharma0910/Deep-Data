import { scaleLinear } from 'd3-scale';
import { TYPICAL_SD, VAR_LABEL, VAR_UNIT } from '../config/clinical';
import { baselineShift } from '../lib/derive';
import type { Observation, ModelExplanation } from '../types';
import { C, ChartFrame } from './shared';

const digitsOf = (k: string) => (k === 'creatinine' ? 2 : k === 'temp' || k === 'lactate' || k === 'wbc' ? 1 : 0);
const signedNum = (v: number, d: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`;

interface Bar { label: string; value: number; text: string }

function Bars({ bars, width, unit }: { bars: Bar[]; width: number; unit: string }) {
  const ROW = 36, LEFT = 136, RIGHT = 6;
  const max = Math.max(1e-9, ...bars.map((b) => Math.abs(b.value)));
  const x = scaleLinear().domain([-max, max]).range([LEFT, width - RIGHT]);
  const h = bars.length * ROW + 20;
  return (
    <svg width={width} height={h} role="img" aria-label="Diverging bar chart of top contributing features">
      <line x1={x(0)} x2={x(0)} y1="0" y2={bars.length * ROW} stroke={C.ink2} />
      {bars.map((b, i) => {
        const y = i * ROW;
        const up = b.value >= 0;
        return (
          <g key={b.label}>
            <text x="0" y={y + 15} className="gutter-name">{b.label}</text>
            <text x="0" y={y + 29} className="bar-label">{b.text}</text>
            <rect x={up ? x(0) : x(b.value)} y={y + 9} width={Math.max(1, Math.abs(x(b.value) - x(0)))} height="16" rx="3" fill={up ? C.accent : C.cyan} />
          </g>
        );
      })}
      <text x={(LEFT + width) / 2} y={bars.length * ROW + 14} textAnchor="middle" className="axis-day">{unit}</text>
    </svg>
  );
}

/** V11 — model attribution when supplied, otherwise an illustrative change-from-baseline chart. */
export function Explain({ obs, explanation }: { obs: Observation[]; explanation: ModelExplanation | null }) {
  if (explanation) {
    const top = [...explanation.attributions].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 6);
    const bars = top.map((a) => ({ label: a.feature, value: a.contribution, text: signedNum(a.contribution, 2) }));
    return (
      <ChartFrame title="Why this score" question={`Top contributions at the selected hour · method: ${explanation.method}. Right of zero raises risk. Describes the model, not clinical causes.`}
        aria="Diverging bar chart of top six feature contributions">
        {(w) => <Bars bars={bars} width={w} unit="contribution to risk score" />}
      </ChartFrame>
    );
  }
  const shifts = baselineShift(obs)
    .map((s) => ({ ...s, z: s.delta / (TYPICAL_SD[s.key] ?? 1) }))
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).slice(0, 6);
  const bars = shifts.map((s) => ({
    label: VAR_LABEL[s.key], value: s.z,
    text: `${signedNum(s.delta, digitsOf(s.key))} ${VAR_UNIT[s.key]} vs first 12 h`.trim(),
  }));
  return (
    <ChartFrame title="Illustrative — not model attribution"
      question="Change from this patient's own first-12-hour mean, in typical-SD units. No model explanation is connected."
      aria="Diverging bar chart of change from baseline for six measurements">
      {(w) => (bars.length ? <Bars bars={bars} width={w} unit="typical-SD units from baseline" /> : <p className="chart-note">Not enough measurements.</p>)}
    </ChartFrame>
  );
}
