import { Info } from 'lucide-react';
import { RISING_PTS, STATUS_LABEL } from '../config/clinical';
import { ScoreBar } from '../charts/ScoreBar';
import type { ToneName } from '../charts/shared';
import type { Freshness } from '../lib/derive';
import { signed } from '../lib/format';
import type { ReviewStatus } from '../types';

export function StatusPill({ status }: { status: ReviewStatus }) {
  return <span className={`pill pill-${status}`}>{STATUS_LABEL[status]}</span>;
}

/** V3 bar plus the number. */
export function ScoreCell({ pts, thr, tone }: { pts: number | null; thr: number; tone: ToneName }) {
  return (
    <span className="score-cell">
      <ScoreBar pts={pts} thr={thr} tone={tone} />
      <b className={`tone-${tone}`}>{pts ?? '—'}</b>
    </span>
  );
}

export function ChangeCell({ change }: { change: number | null }) {
  const rising = change != null && change >= RISING_PTS;
  return <span className={`num${rising ? ' is-rising' : ''}`} title={change == null ? 'No score 6 h earlier' : undefined}>{signed(change)}</span>;
}

export function FreshnessCell({ fresh }: { fresh: Freshness }) {
  const chips: { text: string; kind: 'watch' | 'outline' }[] = [];
  if (fresh.noVitals) chips.push({ text: 'No vitals', kind: 'watch' });
  else if (fresh.stale) chips.push({ text: `Vitals ${fresh.ageH} h old`, kind: 'watch' });
  if (fresh.noLactate) chips.push({ text: 'No lactate', kind: 'outline' });
  if (!chips.length) return <span className="muted">Current</span>;
  return <span className="chips">{chips.map((c) => <span key={c.text} className={`chip chip-${c.kind}`}>{c.text}</span>)}</span>;
}

/** Small (i) with a tooltip that opens on hover or keyboard focus. */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="infotip" tabIndex={0} role="note" aria-label={text}>
      <Info size={14} strokeWidth={1.75} aria-hidden="true" />
      <span className="infotip-bubble" aria-hidden="true">{text}</span>
    </span>
  );
}
