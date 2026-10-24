import { useState } from 'react';
import { area, line } from 'd3-shape';
import { scaleLinear } from 'd3-scale';
import { LAST_HOUR } from '../config/clinical';
import { scorePts } from '../lib/derive';
import { hourStamp } from '../lib/time';
import type { Observation } from '../types';
import { C, ChartFrame, Defs, GapBands, ThresholdLine, TimeAxis, Tooltip, gapRuns, useTimeHover } from './shared';
import { GUTTER, RIGHT } from './scales';

export interface Marker { hour: number; label: string; detail: string }

interface Props { obs: Observation[]; thr: number; markers: Marker[] }

const H = 176;
const TOP = 26;
const PLOT_B = H - 8;

type Pt = { h: number; v: number | null };

function History({ obs, thr, markers, width, from }: Props & { width: number; from: number }) {
  const x = scaleLinear().domain([from - 0.5, LAST_HOUR + 0.5]).range([GUTTER, width - RIGHT]);
  const y = scaleLinear().domain([0, 100]).range([PLOT_B, TOP]);
  const { svgRef, hv, handlers } = useTimeHover('risk', x);
  const data: Pt[] = obs.map((o) => ({ h: o.h, v: scorePts(o.score) }));
  const path = line<Pt>().defined((d) => d.v != null && d.h >= from).x((d) => x(d.h)).y((d) => y(d.v as number))(data);
  const fill = area<Pt>().defined((d) => d.v != null && d.h >= from).x((d) => x(d.h)).y0(PLOT_B).y1((d) => y(d.v as number))(data);
  const gaps = gapRuns(obs.length, (h) => h >= from && data[h].v == null);
  const measured = data.filter((d) => d.v != null && d.h >= from) as { h: number; v: number }[];
  const crossings = measured.filter((d, i) => i > 0 && d.v >= thr && measured[i - 1].v < thr);
  const latest = measured[measured.length - 1];
  const hp = hv.hour != null ? data[hv.hour] : null;
  const stacked = new Map<number, number>();

  return (
    <div style={{ position: 'relative' }}>
      <svg ref={svgRef} width={width} height={H + 34} {...handlers} role="img" aria-label="Risk score over the last 48 hours" style={{ outline: 'none' }}>
        <Defs />
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={GUTTER} x2={width - RIGHT} y1={y(t)} y2={y(t)} stroke={C.grid} strokeDasharray="2 3" />
            <text x={GUTTER - 8} y={y(t) + 3.5} textAnchor="end" className="axis-num">{t}</text>
          </g>
        ))}
        <GapBands runs={gaps} x={x} top={TOP} height={PLOT_B - TOP} />
        {fill && <path d={fill} fill="var(--blue)" opacity="0.11" />}
        <ThresholdLine y={y(thr)} x1={GUTTER} x2={width - RIGHT} thr={thr} />
        {path && <path d={path} fill="none" stroke={C.accent} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {measured.filter((d) => d.v >= thr).map((d) => <circle key={d.h} cx={x(d.h)} cy={y(d.v)} r="3" fill={C.alert} />)}
        {crossings.map((d) => <circle key={`c${d.h}`} cx={x(d.h)} cy={y(d.v)} r="7" fill="none" stroke={C.alert} strokeWidth="1.5" />)}
        {latest && <circle cx={x(latest.h)} cy={y(latest.v)} r="4.5" fill={latest.v >= thr ? C.alert : C.accent} stroke={C.surface} strokeWidth="2" />}
        {hv.hour != null && <line x1={x(hv.hour)} x2={x(hv.hour)} y1={TOP} y2={PLOT_B} stroke={C.ink} strokeWidth="1" opacity="0.4" />}
        {hp?.v != null && hv.hour != null && <circle cx={x(hv.hour)} cy={y(hp.v)} r="3.5" fill={C.surface} stroke={C.ink} strokeWidth="1.5" />}
        {markers.filter((m) => m.hour >= from).map((m, i) => {
          const n = stacked.get(Math.round(m.hour)) ?? 0;
          stacked.set(Math.round(m.hour), n + 1);
          const mx = x(Math.min(LAST_HOUR, m.hour));
          return (
            <g key={i}>
              <title>{`${m.label}: ${m.detail}`}</title>
              <line x1={mx - n * 4} x2={mx - n * 4} y1={PLOT_B - 12} y2={PLOT_B} stroke={C.ink} strokeWidth="1.5" />
              <text x={mx} y={PLOT_B - 15 - n * 11} textAnchor="end" className="marker-label">{m.label}</text>
            </g>
          );
        })}
        <TimeAxis x={x} y={H} from={from} />
        <text x={GUTTER - 8} y={10} textAnchor="end" className="axis-title">Risk score</text>
      </svg>
      {hv.mine && hv.hour != null && (
        <Tooltip x={x(hv.hour)} y={TOP} width={width} title={hourStamp(hv.hour)}
          rows={[{ label: 'Risk score', value: hp?.v == null ? 'Not measured' : String(hp.v) }]} />
      )}
    </div>
  );
}

/** V6 — how did this patient's risk evolve? */
const PERIODS = [12, 24, 48] as const;

export function RiskHistory(p: Props) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(48);
  const picker = (
    <div className="segmented segmented-sm" role="group" aria-label="Chart period">
      {PERIODS.map((n) => <button key={n} type="button" aria-pressed={period === n} onClick={() => setPeriod(n)}>{n} h</button>)}
    </div>
  );
  return (
    <ChartFrame title={`Risk score trend · Last ${period} hours`} question="Hourly risk score. Red dots are at or above the threshold."
      aria={`Risk score line chart over ${period} hours`} actions={picker}>
      {(w) => <History {...p} width={w} from={LAST_HOUR + 1 - period} />}
    </ChartFrame>
  );
}
