import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ScaleLinear } from 'd3-scale';
import { LAST_HOUR } from '../config/clinical';
import { dayLabel, hourClock, hourToMs } from '../lib/time';

export const C = {
  ink: 'var(--ink)', ink2: 'var(--text-2)', ink3: 'var(--text-3)', grid: 'var(--grid)', border: 'var(--border)',
  accent: 'var(--blue)', alert: 'var(--alert)', alertDeep: 'var(--alert-deep)', watch: 'var(--watch)', ok: 'var(--ok)',
  cyan: 'var(--cyan)', violet: 'var(--violet)', surface: 'var(--surface)', neutral: 'var(--neutral-mark)',
};

export type ToneName = 'critical' | 'rising' | 'stable';
export const TONE_COLOR: Record<ToneName, string> = { critical: C.alert, rising: C.watch, stable: C.ok };

/* ---------- size ---------- */
export function useSize<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    setW(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/* ---------- frame ---------- */
interface FrameProps {
  title: string;
  question?: string;
  aria: string;
  actions?: ReactNode;
  children: (width: number) => ReactNode;
}

export function ChartFrame({ title, question, aria, actions, children }: FrameProps) {
  const [ref, width] = useSize<HTMLDivElement>();
  return (
    <section className="chart-frame" aria-label={aria}>
      <header className="chart-head">
        <div>
          <h3>{title}</h3>
          {question && <p>{question}</p>}
        </div>
        {actions && <div className="chart-actions">{actions}</div>}
      </header>
      <div className="chart-body" ref={ref}>{width > 0 ? children(width) : null}</div>
    </section>
  );
}

/* ---------- tooltip ---------- */
export interface TipRow { label: string; value: string; color?: string }

export function Tooltip({ x, y, width, title, rows }: { x: number; y: number; width: number; title: string; rows: TipRow[] }) {
  const flip = x > width - 200;
  return (
    <div className="tooltip" role="status" style={{ left: flip ? undefined : x + 12, right: flip ? width - x + 12 : undefined, top: Math.max(0, y) }}>
      <div className="tooltip-title">{title}</div>
      {rows.map((r) => (
        <div className="tooltip-row" key={r.label}>
          <span>{r.color && <i style={{ background: r.color }} />}{r.label}</span>
          <b>{r.value}</b>
        </div>
      ))}
    </div>
  );
}

/* ---------- synced hover ---------- */
interface HoverState { hour: number | null; source: string | null }
const HoverCtx = createContext<{ state: HoverState; set: (h: number | null, src: string | null) => void } | null>(null);

export function HoverProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HoverState>({ hour: null, source: null });
  const set = useCallback((hour: number | null, source: string | null) => setState({ hour, source }), []);
  return <HoverCtx.Provider value={{ state, set }}>{children}</HoverCtx.Provider>;
}

/** Shared hover hour across the patient charts; falls back to local state outside a provider. */
export function useHover(id: string) {
  const ctx = useContext(HoverCtx);
  const [local, setLocal] = useState<HoverState>({ hour: null, source: null });
  const state = ctx ? ctx.state : local;
  const set = ctx ? ctx.set : (hour: number | null, source: string | null) => setLocal({ hour, source });
  return {
    hour: state.hour,
    mine: state.source === id,
    set: (h: number) => set(h, id),
    clear: () => set(null, null),
  };
}

/** Pointer + keyboard handlers for a plot area that maps x to an hour. */
export function useTimeHover(id: string, x: ScaleLinear<number, number>) {
  const hv = useHover(id);
  const svgRef = useRef<SVGSVGElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    const h = Math.round(x.invert(e.clientX - r.left));
    hv.set(Math.max(0, Math.min(LAST_HOUR, h)));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const cur = hv.hour ?? LAST_HOUR;
    hv.set(Math.max(0, Math.min(LAST_HOUR, cur + (e.key === 'ArrowLeft' ? -1 : 1))));
  };
  return { svgRef, hv, handlers: { onMouseMove: onMove, onMouseLeave: hv.clear, onKeyDown: onKey, onBlur: hv.clear, tabIndex: 0 } };
}

/* ---------- axes and marks ---------- */
export const HATCH_ID = 'hatch-gap';

export function Defs() {
  return (
    <defs>
      <pattern id={HATCH_ID} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="5" stroke="var(--hatch)" strokeWidth="1.2" />
      </pattern>
    </defs>
  );
}

export const tickHours = (): number[] => {
  const out: number[] = [];
  for (let h = LAST_HOUR; h >= 0; h -= 6) out.unshift(h);
  return out;
};

/** Time axis: real clock times every 6 h counted back from the snapshot, with the date where it changes. */
export function TimeAxis({ x, y, from = 0 }: { x: ScaleLinear<number, number>; y: number; from?: number }) {
  const hours = tickHours().filter((h) => h >= from);
  let prevDay = '';
  return (
    <g className="axis" transform={`translate(0,${y})`}>
      {hours.map((h) => {
        const day = dayLabel(hourToMs(h));
        const showDay = day !== prevDay;
        prevDay = day;
        return (
          <g key={h} transform={`translate(${x(h)},0)`}>
            <line y2="4" stroke={C.border} />
            <text y="16" textAnchor="middle">{hourClock(h)}</text>
            {showDay && <text y="28" textAnchor="middle" className="axis-day">{day}</text>}
          </g>
        );
      })}
    </g>
  );
}

/** Runs of ≥ minRun consecutive hours where `missing(h)` is true. */
export function gapRuns(len: number, missing: (h: number) => boolean, minRun = 2): [number, number][] {
  const runs: [number, number][] = [];
  let start = -1;
  for (let h = 0; h <= len; h++) {
    const m = h < len && missing(h);
    if (m && start < 0) start = h;
    if (!m && start >= 0) { if (h - start >= minRun) runs.push([start, h - 1]); start = -1; }
  }
  return runs;
}

export function GapBands({ runs, x, top, height }: { runs: [number, number][]; x: ScaleLinear<number, number>; top: number; height: number }) {
  return <g>{runs.map(([a, b]) => <rect key={a} x={x(a - 0.5)} y={top} width={Math.max(2, x(b + 0.5) - x(a - 0.5))} height={height} fill={`url(#${HATCH_ID})`} />)}</g>;
}

export function ThresholdLine({ y, x1, x2, thr }: { y: number; x1: number; x2: number; thr: number }) {
  return (
    <g>
      <line x1={x1} x2={x2} y1={y} y2={y} stroke={C.alert} strokeWidth="1" strokeDasharray="4 3" />
      <text x={x2} y={y - 4} textAnchor="end" className="thr-label">Thr {thr}</text>
    </g>
  );
}
