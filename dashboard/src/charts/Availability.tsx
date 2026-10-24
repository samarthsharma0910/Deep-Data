import { HOURS, LAST_HOUR } from '../config/clinical';
import { hourStamp } from '../lib/time';
import type { Observation } from '../types';
import { C, ChartFrame, Tooltip, TimeAxis, useTimeHover } from './shared';
import { GUTTER, RIGHT, timeScale } from './scales';

const ROW = 18;
const ROWS: { label: string; has: (o: Observation) => boolean }[] = [
  { label: 'Vitals', has: (o) => [o.hr, o.sbp, o.map, o.rr, o.spo2].some((v) => v != null) },
  { label: 'Temperature', has: (o) => o.temp != null },
  { label: 'GCS', has: (o) => o.gcs != null },
  { label: 'Lactate', has: (o) => o.lactate != null },
  { label: 'WBC', has: (o) => o.wbc != null },
  { label: 'Creatinine', has: (o) => o.creatinine != null },
  { label: 'Platelets', has: (o) => o.platelets != null },
];

function Strip({ obs, width }: { obs: Observation[]; width: number }) {
  const x = timeScale(GUTTER, width - RIGHT);
  const { svgRef, hv, handlers } = useTimeHover('avail', x);
  const cw = (width - RIGHT - GUTTER) / HOURS;
  const height = ROWS.length * ROW + 34;
  return (
    <div style={{ position: 'relative' }}>
      <svg ref={svgRef} width={width} height={height} {...handlers} role="img" aria-label="Which measurements exist in each hour" style={{ outline: 'none' }}>
        <rect x={x(LAST_HOUR) - cw / 2} y="0" width={cw} height={ROWS.length * ROW} fill="var(--blue-weak)" />
        {ROWS.map((r, i) => (
          <g key={r.label}>
            <line x1={GUTTER} x2={width - RIGHT} y1={(i + 1) * ROW} y2={(i + 1) * ROW} stroke={C.grid} />
            <text x={GUTTER - 8} y={i * ROW + ROW / 2 + 4} textAnchor="end" className="gutter-name">{r.label}</text>
            {obs.map((o) => r.has(o) && <rect key={o.h} x={x(o.h) - cw * 0.35} y={i * ROW + 4} width={cw * 0.7} height={ROW - 8} rx="1.5" fill={C.accent} />)}
          </g>
        ))}
        {hv.hour != null && <line x1={x(hv.hour)} x2={x(hv.hour)} y1="0" y2={ROWS.length * ROW} stroke={C.ink} strokeWidth="1" opacity="0.4" />}
        <TimeAxis x={x} y={ROWS.length * ROW} />
      </svg>
      {hv.mine && hv.hour != null && (
        <Tooltip x={x(hv.hour)} y={0} width={width} title={hourStamp(hv.hour)}
          rows={ROWS.map((r) => ({ label: r.label, value: r.has(obs[hv.hour as number]) ? 'Measured' : 'Not measured' }))} />
      )}
    </div>
  );
}

/** V8 — what data does the score rest on, and what is missing? */
export function Availability({ obs }: { obs: Observation[] }) {
  return (
    <ChartFrame title="Measurement availability" question="What data does the score rest on, and what is missing? Latest hour highlighted."
      aria="Grid showing which measurements exist in each of the last 48 hours">
      {(w) => <Strip obs={obs} width={w} />}
    </ChartFrame>
  );
}
