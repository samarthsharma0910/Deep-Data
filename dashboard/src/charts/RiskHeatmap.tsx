import { useState } from 'react';
import { HOURS, LAST_HOUR } from '../config/clinical';
import type { Row } from '../lib/derive';
import { scorePts } from '../lib/derive';
import { hourStamp } from '../lib/time';
import { C, Defs, HATCH_ID, TimeAxis, Tooltip, useSize } from './shared';
import { HEAT_STEPS, heatColor, timeScale } from './scales';

interface Props { rows: Row[]; thr: number; onOpen: (pid: string) => void }

const CH = 16;
const LEFT = 60;
const TOP = 4;

function Heat({ rows, thr, onOpen, width }: Props & { width: number }) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const right = width - 8;
  const x = timeScale(LEFT, right);
  const cw = (right - LEFT) / HOURS;
  const plotH = rows.length * CH;
  const axisY = TOP + plotH + 4;
  const height = axisY + 34 + 32;

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const b = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const c = Math.max(0, Math.min(LAST_HOUR, Math.round(x.invert(e.clientX - b.left))));
    const r = Math.max(0, Math.min(rows.length - 1, Math.floor((e.clientY - b.top - TOP) / CH)));
    setHover({ r, c });
  };
  const cell = hover ? rows[hover.r] : null;
  const pts = cell && hover ? scorePts(cell.obs[hover.c].score) : null;

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height} role="img" aria-label="Heatmap of risk score by patient and hour over 48 hours">
        <Defs />
        {rows.map((row, i) => (
          <g key={row.patient.id}>
            <text x={LEFT - 8} y={TOP + i * CH + CH / 2 + 3.5} textAnchor="end" className="heat-label"
              fontWeight={hover?.r === i ? 700 : 500}>{row.patient.bed}</text>
            {row.obs.map((o, h) => {
              const p = scorePts(o.score);
              const cx = x(h) - cw / 2;
              return p == null
                ? <g key={h}><rect x={cx} y={TOP + i * CH} width={cw} height={CH} fill="#eef1f7" /><rect x={cx} y={TOP + i * CH} width={cw} height={CH} fill={`url(#${HATCH_ID})`} /></g>
                : <rect key={h} x={cx + 0.5} y={TOP + i * CH + 0.5} width={cw - 1} height={CH - 1} rx="2" fill={heatColor(p)}
                  stroke={p >= thr ? C.alert : 'none'} strokeWidth="1.5" />;
            })}
          </g>
        ))}
        {hover && (
          <g pointerEvents="none">
            <rect x={LEFT} y={TOP + hover.r * CH} width={right - LEFT} height={CH} fill="none" stroke={C.ink} strokeWidth="1" opacity="0.5" />
            <rect x={x(hover.c) - cw / 2} y={TOP} width={cw} height={plotH} fill="none" stroke={C.ink} strokeWidth="1" opacity="0.5" />
          </g>
        )}
        <rect x={LEFT} y={TOP} width={right - LEFT} height={plotH} fill="transparent" style={{ cursor: 'pointer' }}
          onMouseMove={onMove} onMouseLeave={() => setHover(null)}
          onClick={() => hover && onOpen(rows[hover.r].patient.id)} />
        <TimeAxis x={x} y={axisY} />
        <g transform={`translate(${LEFT},${axisY + 36})`} className="axis" aria-hidden="true">
          <text y="9" fill={C.ink2}>Risk score</text>
          {HEAT_STEPS.map((c, i) => <rect key={c} x={62 + i * 24} y="0" width="24" height="10" fill={c} />)}
          {thr > 12 && <text x="62" y="21">0</text>}{thr < 88 && <text x={62 + 120} y="21" textAnchor="end">100</text>}
          <line x1={62 + 1.2 * thr} x2={62 + 1.2 * thr} y1="-2" y2="12" stroke={C.alert} strokeWidth="1.5" />
          <text x={62 + 1.2 * thr} y="21" textAnchor="middle" fill={C.alert}>{thr}</text>
          <rect x="226" y="0" width="14" height="10" rx="2" fill={HEAT_STEPS[3]} stroke={C.alert} strokeWidth="1.5" />
          <text x="246" y="9">At or above threshold</text>
          <rect x="360" y="0" width="14" height="10" fill="#eef1f7" /><rect x="360" y="0" width="14" height="10" fill={`url(#${HATCH_ID})`} />
          <text x="380" y="9">Not measured</text>
        </g>
      </svg>
      {hover && cell && (
        <Tooltip x={x(hover.c)} y={TOP + hover.r * CH + CH + 4} width={width}
          title={`${cell.patient.bed} · ${cell.patient.id}`}
          rows={[{ label: hourStamp(hover.c), value: pts == null ? 'Not measured' : `Score ${pts}` }]} />
      )}
    </div>
  );
}

/** V2 — who has been deteriorating over 48 h, and when? Sized to its container. */
export function HeatmapPlot(p: Props) {
  const [ref, width] = useSize<HTMLDivElement>();
  return <div ref={ref}>{width > 0 && (p.rows.length ? <Heat {...p} width={width} /> : <p className="chart-note">No patients to display.</p>)}</div>;
}
