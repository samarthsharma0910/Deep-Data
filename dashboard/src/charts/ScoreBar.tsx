import { C, TONE_COLOR, type ToneName } from './shared';

/** V3 — inline score bar: 56 px track filled to the score in the patient's status colour, tick at the threshold. */
export function ScoreBar({ pts, thr, tone, width = 56 }: { pts: number | null; thr: number; tone: ToneName; width?: number }) {
  return (
    <svg width={width} height="10" viewBox={`0 0 ${width} 10`} aria-hidden="true" className="scorebar">
      <rect x="0" y="2" width={width} height="6" rx="3" fill="var(--track)" />
      {pts != null && <rect x="0" y="2" width={Math.max(4, (width * pts) / 100)} height="6" rx="3" fill={TONE_COLOR[tone]} />}
      <line x1={(width * thr) / 100} x2={(width * thr) / 100} y1="0" y2="10" stroke={C.ink2} strokeWidth="1" opacity="0.55" />
    </svg>
  );
}
