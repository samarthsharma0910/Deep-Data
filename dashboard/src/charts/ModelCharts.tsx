import { line } from 'd3-shape';
import { scaleLinear } from 'd3-scale';
import { HOURS } from '../config/clinical';
import { alertBurden } from '../lib/alerts';
import { findEpisodes, type Row } from '../lib/derive';
import { C, ChartFrame } from './shared';

export const THRESHOLDS = Array.from({ length: 13 }, (_, i) => 30 + i * 5);

/** V12 — alert burden against threshold, computed from the loaded cohort. */
export function ThresholdBurden({ rows, thr }: { rows: Row[]; thr: number }) {
  const data = THRESHOLDS.map((t) => ({ t, ...alertBurden(rows, (r, th) => findEpisodes(r.obs, th), t, HOURS) }));
  const now = alertBurden(rows, (r, th) => findEpisodes(r.obs, th), thr, HOURS);
  return (
    <ChartFrame title="Threshold vs alert burden" question="How many alerts does each threshold generate for this cohort?"
      aria="Alerts per 10 bed-days against threshold">
      {(w) => {
        const H = 190, L = 44, R = 24, T = 26, B = 36;
        const x = scaleLinear().domain([30, 90]).range([L, w - R]);
        const maxY = Math.max(1, ...data.map((d) => d.per10));
        const y = scaleLinear().domain([0, maxY * 1.1]).nice().range([H - B, T]);
        const path = line<(typeof data)[number]>().x((d) => x(d.t)).y((d) => y(d.per10))(data);
        return (
          <div>
            <p className="readout"><b>{now.per10.toFixed(1)}</b> alerts per 10 bed-days · {now.episodes} episodes in 48 h · {now.above} patients above now</p>
            <svg width={w} height={H} role="img" aria-label="Alert burden by threshold">
              {y.ticks(4).map((t) => (
                <g key={t}><line x1={L} x2={w - R} y1={y(t)} y2={y(t)} stroke={C.grid} strokeDasharray="2 3" /><text x={L - 8} y={y(t) + 3.5} textAnchor="end" className="axis-num">{t}</text></g>
              ))}
              {THRESHOLDS.map((t) => <text key={t} x={x(t)} y={H - B + 16} textAnchor="middle" className="axis-num">{t}</text>)}
              <text x={(L + w - R) / 2} y={H - 4} textAnchor="middle" className="axis-title">Threshold (risk score)</text>
              <text x={L - 8} y={10} textAnchor="start" className="axis-title">Alerts per 10 bed-days</text>
              <path d={path ?? ''} fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {data.map((d) => <circle key={d.t} cx={x(d.t)} cy={y(d.per10)} r="2.5" fill={C.accent} />)}
              <line x1={x(thr)} x2={x(thr)} y1={T} y2={H - B} stroke={C.alert} strokeWidth="1.5" strokeDasharray="4 3" />
              <circle cx={x(thr)} cy={y(now.per10)} r="5" fill={C.alert} stroke={C.surface} strokeWidth="2" />
            </svg>
          </div>
        );
      }}
    </ChartFrame>
  );
}

interface CurveProps { title: string; question: string; points: [number, number][]; xLabel: string; yLabel: string; diagonal?: boolean; sizes?: number[] }

function Curve({ title, question, points, xLabel, yLabel, diagonal, sizes }: CurveProps) {
  return (
    <ChartFrame title={title} question={question} aria={`${title} plot`}>
      {(w) => {
        const S = Math.min(w, 300), L = 40, T = 10, B = 34;
        const side = S - L - 10;
        const x = scaleLinear().domain([0, 1]).range([L, L + side]);
        const y = scaleLinear().domain([0, 1]).range([T + side, T]);
        const maxN = Math.max(1, ...(sizes ?? [1]));
        return (
          <svg width={S} height={T + side + B} role="img" aria-label={`${title}, ${points.length} points`}>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <line x1={L} x2={L + side} y1={y(t)} y2={y(t)} stroke={C.grid} strokeDasharray="2 3" />
                <text x={L - 6} y={y(t) + 3.5} textAnchor="end" className="axis-num">{t}</text>
                <text x={x(t)} y={T + side + 14} textAnchor="middle" className="axis-num">{t}</text>
              </g>
            ))}
            <rect x={L} y={T} width={side} height={side} fill="none" stroke={C.border} />
            {diagonal && <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke={C.ink3} strokeDasharray="4 3" />}
            <path d={line<[number, number]>().x((d) => x(d[0])).y((d) => y(d[1]))(points) ?? ''} fill="none" stroke={C.accent} strokeWidth="2" strokeLinejoin="round" />
            {sizes && points.map((p, i) => <circle key={i} cx={x(p[0])} cy={y(p[1])} r={2.5 + 3.5 * Math.sqrt(sizes[i] / maxN)} fill={C.accent} opacity="0.8" />)}
            <text x={L + side / 2} y={T + side + 30} textAnchor="middle" className="axis-title">{xLabel}</text>
            <text transform={`translate(10,${T + side / 2}) rotate(-90)`} textAnchor="middle" className="axis-title">{yLabel}</text>
          </svg>
        );
      }}
    </ChartFrame>
  );
}

export const RocChart = ({ data }: { data: { fpr: number; tpr: number }[] }) =>
  <Curve title="ROC curve" question="How well does the score separate sepsis from non-sepsis hours?" diagonal
    points={data.map((p) => [p.fpr, p.tpr])} xLabel="False positive rate" yLabel="True positive rate" />;

export const PrChart = ({ data }: { data: { recall: number; precision: number }[] }) =>
  <Curve title="Precision–recall curve" question="What share of alerts are true, at each level of recall?"
    points={data.map((p) => [p.recall, p.precision])} xLabel="Recall" yLabel="Precision" />;

export const CalibrationChart = ({ data }: { data: { predicted: number; observed: number; n: number }[] }) =>
  <Curve title="Calibration" question="Does a predicted risk match the observed rate? Marker size shows bin count." diagonal
    points={data.map((p) => [p.predicted, p.observed])} sizes={data.map((p) => p.n)} xLabel="Predicted risk" yLabel="Observed rate" />;

export function LeadTimeChart({ data }: { data: number[] }) {
  const bins = Array.from({ length: 13 }, (_, i) => i);
  const counts = bins.map((b) => data.filter((v) => Math.min(12, Math.max(0, Math.floor(v))) === b).length);
  return (
    <ChartFrame title="Lead-time distribution" question="Hours before onset when the first alert was raised. Target 6 h."
      aria="Histogram of alert lead time in hours">
      {(w) => {
        const H = 200, L = 40, R = 14, T = 26, B = 36;
        const x = scaleLinear().domain([0, 13]).range([L, w - R]);
        const y = scaleLinear().domain([0, Math.max(1, ...counts)]).nice().range([H - B, T]);
        return (
          <svg width={w} height={H} role="img" aria-label="Lead time histogram">
            {y.ticks(4).map((t) => <g key={t}><line x1={L} x2={w - R} y1={y(t)} y2={y(t)} stroke={C.grid} strokeDasharray="2 3" /><text x={L - 8} y={y(t) + 3.5} textAnchor="end" className="axis-num">{t}</text></g>)}
            {bins.map((b, i) => <rect key={b} x={x(b) + 1} y={y(counts[i])} width={x(1) - x(0) - 2} height={y(0) - y(counts[i])} rx="2" fill={C.accent} />)}
            {bins.map((b) => <text key={b} x={x(b) + (x(1) - x(0)) / 2} y={H - B + 14} textAnchor="middle" className="axis-num">{b === 12 ? '12+' : b}</text>)}
            <line x1={x(6)} x2={x(6)} y1={T} y2={H - B} stroke={C.alert} strokeDasharray="4 3" />
            <text x={x(6) + 4} y={T - 8} className="thr-label">Target 6 h</text>
            <text x={(L + w - R) / 2} y={H - 4} textAnchor="middle" className="axis-title">Hours before onset</text>
          </svg>
        );
      }}
    </ChartFrame>
  );
}
