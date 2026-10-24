import { line } from 'd3-shape';
import { scaleLinear } from 'd3-scale';
import { LAST_HOUR, SPARK_HOURS } from '../config/clinical';
import type { Observation } from '../types';
import { scorePts } from '../lib/derive';
import { C, TONE_COLOR, type ToneName } from './shared';

/** V4 — 72 × 20 px score sparkline over the last 12 h; gaps break the line. */
export function Sparkline({ obs, thr, tone }: { obs: Observation[]; thr: number; tone: ToneName }) {
  const W = 72, H = 20, pad = 3;
  const first = LAST_HOUR - SPARK_HOURS + 1;
  const x = scaleLinear().domain([first, LAST_HOUR]).range([pad, W - pad]);
  const y = scaleLinear().domain([0, 100]).range([H - pad, pad]);
  const pts = obs.slice(first).map((o) => ({ h: o.h, v: scorePts(o.score) }));
  const path = line<{ h: number; v: number | null }>().defined((d) => d.v != null).x((d) => x(d.h)).y((d) => y(d.v as number))(pts);
  const last = [...pts].reverse().find((p) => p.v != null);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="spark" role="img"
      aria-label={last ? `Last 12 hours, latest risk score ${last.v}` : 'No risk score in the last 12 hours'}>
      <line x1="0" x2={W} y1={y(thr)} y2={y(thr)} stroke={C.alert} strokeWidth="1" strokeDasharray="2 2" opacity="0.4" />
      {path && <path d={path} fill="none" stroke={C.accent} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />}
      {last && last.v != null && <circle cx={x(last.h)} cy={y(last.v)} r="2.75" fill={TONE_COLOR[tone]} />}
    </svg>
  );
}
