import { extent } from 'd3-array';
import { scaleLinear } from 'd3-scale';
import type { LabSpec } from '../config/clinical';
import { LAST_HOUR } from '../config/clinical';
import type { Observation } from '../types';
import { C } from './shared';

/** V9 — 96 × 24 px lab trend: measurements joined only between consecutive draws, dashed criterion line. */
export function LabSpark({ obs, lab }: { obs: Observation[]; lab: LabSpec }) {
  const W = 96, H = 24, pad = 4;
  const pts = obs.filter((o) => o[lab.key] != null).map((o) => ({ h: o.h, v: o[lab.key] as number }));
  if (!pts.length) return <span className="muted">No draws</span>;
  const [lo, hi] = extent([...pts.map((p) => p.v), lab.criterion]) as [number, number];
  const span = hi - lo || 1;
  const x = scaleLinear().domain([0, LAST_HOUR]).range([pad, W - pad]);
  const y = scaleLinear().domain([lo - span * 0.1, hi + span * 0.1]).range([H - pad, pad]);
  const last = pts[pts.length - 1];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="spark" role="img"
      aria-label={`${lab.label} over 48 hours, ${pts.length} measurements, latest ${last.v} ${lab.unit}`}>
      <line x1="0" x2={W} y1={y(lab.criterion)} y2={y(lab.criterion)} stroke={C.alert} strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
      <polyline points={pts.map((p) => `${x(p.h)},${y(p.v)}`).join(' ')} fill="none" stroke={C.ink} strokeWidth="1.25" strokeLinejoin="round" />
      {pts.slice(0, -1).map((p) => <circle key={p.h} cx={x(p.h)} cy={y(p.v)} r="1.75" fill={C.ink} />)}
      <circle cx={x(last.h)} cy={y(last.v)} r="3" fill={lab.flag(last.v) ? C.alert : C.ink} />
    </svg>
  );
}
