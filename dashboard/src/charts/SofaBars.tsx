import type { Qsofa, Sofa } from '../lib/derive';
import { C, ChartFrame } from './shared';

const TRACK = 132;

/** V10 — SOFA organ bars (0–4) and qSOFA criteria. */
export function SofaBars({ sofa, qsofa }: { sofa: Sofa; qsofa: Qsofa }) {
  return (
    <ChartFrame title="Organ severity" question={`Partial SOFA ${sofa.total}, ${sofa.scored} of 6 organs scorable · qSOFA ${qsofa.met} of ${qsofa.known} measurable criteria met`}
      aria={`Partial SOFA ${sofa.total} from ${sofa.scored} of 6 organs; qSOFA ${qsofa.met} criteria met`}>
      {() => (
        <div className="sofa">
          {sofa.organs.map((o) => (
            <div className="sofa-row" key={o.key} title={o.basis}>
              <span className="sofa-name">{o.label}</span>
              <svg width={TRACK} height="12" aria-hidden="true">
                {o.score == null
                  ? <rect x="0.5" y="2.5" width={TRACK - 1} height="7" rx="3.5" fill="none" stroke={C.border} strokeDasharray="3 3" />
                  : <>
                    <rect x="0" y="3" width={TRACK} height="6" rx="3" fill="var(--track)" />
                    {o.score > 0 && <rect x="0" y="3" width={(TRACK * o.score) / 4} height="6" rx="3" fill={o.score >= 2 ? C.alert : C.watch} />}
                  </>}
              </svg>
              <span className="sofa-val">{o.score ?? 'n/a'}</span>
            </div>
          ))}
          <div className="sofa-q">
            {qsofa.criteria.map((c) => (
              <div className="sofa-row" key={c.label}>
                <span className="sofa-name wide">{c.label}</span>
                <span className="sofa-val-wide" />
                <span className={`state state-${c.state === 'n/a' ? 'na' : c.state}`}>{c.state === 'met' ? 'Met' : c.state === 'no' ? 'No' : 'n/a'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartFrame>
  );
}
