import { line } from 'd3-shape';
import { scaleLinear } from 'd3-scale';
import { LAST_HOUR, VITALS, type VitalSpec } from '../config/clinical';
import { latestOf } from '../lib/derive';
import { fmt } from '../lib/format';
import { hourStamp } from '../lib/time';
import type { Observation } from '../types';
import { C, Defs, GapBands, gapRuns, useHover, useSize, useTimeHover } from './shared';
import { timeScale } from './scales';

const TONE: Record<string, string> = {
  hr: 'var(--v-hr)', map: 'var(--v-map)', temp: 'var(--v-temp)', rr: 'var(--v-rr)', spo2: 'var(--v-spo2)',
};
const H = 64;
const PAD = 6;

function Plot({ obs, spec, width }: { obs: Observation[]; spec: VitalSpec; width: number }) {
  const tone = TONE[spec.key];
  const x = timeScale(2, width - 2);
  const y = scaleLinear().domain([spec.min, spec.max]).range([H - PAD, PAD]);
  const { svgRef, hv, handlers } = useTimeHover(`vital-${spec.key}`, x);
  const maxGap = spec.key === 'temp' ? 2 : 1;
  const meas = obs.filter((o) => o[spec.key] != null).map((o) => ({ h: o.h, v: o[spec.key] as number }));
  const segs: { h: number; v: number }[][] = [];
  meas.forEach((d, k) => {
    if (k > 0 && d.h - meas[k - 1].h <= maxGap) segs[segs.length - 1].push(d); else segs.push([d]);
  });
  const gen = line<{ h: number; v: number }>().x((d) => x(d.h)).y((d) => y(d.v));
  const gaps = gapRuns(obs.length, (h) => obs[h][spec.key] == null, spec.key === 'temp' ? 3 : 2);
  const latest = latestOf(obs, spec.key);
  const hp = hv.hour != null ? obs[hv.hour][spec.key] : null;
  return (
    <svg ref={svgRef} width={width} height={H} {...handlers} role="img" style={{ outline: 'none', cursor: 'crosshair' }}
      aria-label={`${spec.label} over 48 hours${latest ? `, latest ${fmt(latest.v, spec.digits)} ${spec.unit}` : ', no measurements'}`}>
      <Defs />
      {spec.band && (
        <rect x="0" y={y(spec.band.to)} width={width} height={y(spec.band.from) - y(spec.band.to)} fill={tone} opacity="0.1">
          <title>{`${spec.band.label} · ${spec.band.source}`}</title>
        </rect>
      )}
      <GapBands runs={gaps} x={x} top={PAD} height={H - 2 * PAD} />
      {segs.map((s, k) => s.length > 1
        ? <path key={k} d={gen(s) ?? ''} fill="none" stroke={tone} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
        : <circle key={k} cx={x(s[0].h)} cy={y(s[0].v)} r="2" fill={tone} />)}
      {latest && <circle cx={x(latest.h)} cy={y(latest.v)} r="3.5" fill={tone} stroke={C.surface} strokeWidth="1.5" />}
      {hv.hour != null && <line x1={x(hv.hour)} x2={x(hv.hour)} y1="0" y2={H} stroke={C.ink} strokeWidth="1" opacity="0.4" />}
      {hv.hour != null && hp != null && <circle cx={x(hv.hour)} cy={y(hp)} r="3" fill={C.surface} stroke={tone} strokeWidth="2" />}
    </svg>
  );
}

function Card({ obs, spec }: { obs: Observation[]; spec: VitalSpec }) {
  const [ref, width] = useSize<HTMLDivElement>();
  const latest = latestOf(obs, spec.key);
  const age = latest ? LAST_HOUR - latest.h : null;
  return (
    <article className="vital-card" style={{ ['--tone' as string]: TONE[spec.key] }}>
      <header>
        <span className="vital-name">{spec.short}</span>
        <span className="vital-label">{spec.label}</span>
      </header>
      <VitalValue obs={obs} spec={spec} latest={latest} age={age} />
      <div ref={ref} className="vital-plot">{width > 0 && <Plot obs={obs} spec={spec} width={width} />}</div>
      <span className="vital-crit"><span>Ref {spec.ref} {spec.unit}</span>{spec.band && <span>Shaded {spec.band.label}</span>}</span>
    </article>
  );
}

/** Shows the latest value, or the value at the hovered hour (shared across every chart on the page). */
function VitalValue({ obs, spec, latest, age }: { obs: Observation[]; spec: VitalSpec; latest: { h: number; v: number } | null; age: number | null }) {
  const hv = useHover(`vital-${spec.key}-read`);
  const hovering = hv.hour != null;
  const v = hovering ? obs[hv.hour as number][spec.key] : latest?.v ?? null;
  const sub = hovering ? hourStamp(hv.hour as number) : age == null ? 'Not measured' : age === 0 ? 'now' : `${age} h ago`;
  return (
    <div className="vital-read">
      <b>{v == null ? '—' : fmt(v, spec.digits)}</b>
      <span>{spec.unit}</span>
      <em className={!hovering && age != null && age > 2 ? 'is-watch' : ''}>{hovering && v == null ? `${sub} · not measured` : sub}</em>
    </div>
  );
}

/** V7 — five vital-sign cards, one colour each, sharing the page's hover hour. */
export function VitalCards({ obs }: { obs: Observation[] }) {
  return (
    <div className="vital-grid" role="group" aria-label="Vital signs over the last 48 hours">
      {VITALS.map((v) => <Card key={v.key} obs={obs} spec={v} />)}
    </div>
  );
}
