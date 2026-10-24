import { useEffect, useRef, useState } from 'react';
import { ACTOR, DISMISS_REASONS, ESCALATE_REASONS } from '../config/clinical';
import { useApp } from '../lib/store';

const COPY = {
  acknowledge: { title: 'Acknowledge alert', cta: 'Acknowledge', hint: 'Records that the alert has been seen. The risk score stays visible.' },
  escalate: { title: 'Escalate alert', cta: 'Escalate', hint: 'Flags the alert for urgent clinical review. A reason is required.' },
  dismiss: { title: 'Dismiss alert', cta: 'Dismiss', hint: 'Closes the alert as not clinically actionable. A reason is required.' },
} as const;

export function ActionDialog() {
  const { state, dispatch, rows } = useApp();
  const t = state.dialog;
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!t) return;
    opener.current = document.activeElement;
    setReason(''); setNote(''); setTried(false);
    const first = ref.current?.querySelector<HTMLElement>('select, textarea, button');
    first?.focus();
    return () => { (opener.current as HTMLElement | null)?.focus?.(); };
  }, [t]);

  if (!t) return null;
  const copy = COPY[t.mode];
  const reasons = t.mode === 'escalate' ? ESCALATE_REASONS : t.mode === 'dismiss' ? DISMISS_REASONS : [];
  const row = rows.find((r) => r.patient.id === t.pid);
  const needReason = t.mode !== 'acknowledge';
  const reasonErr = needReason && !reason ? 'Choose a reason.' : '';
  const noteErr = reason === 'Other' && !note.trim() ? 'A note is required when the reason is Other.' : '';
  const close = () => dispatch({ type: 'openDialog', target: null });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (reasonErr || noteErr) return;
    dispatch({ type: 'review', mode: t.mode, key: t.key, pid: t.pid, reason: reason || undefined, note: note.trim() || undefined });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = Array.from(ref.current?.querySelectorAll<HTMLElement>('select, textarea, button, [href]') ?? []).filter((el) => !el.hasAttribute('disabled'));
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="dialog" ref={ref} role="dialog" aria-modal="true" aria-labelledby="dlg-title" onKeyDown={onKey}>
        <form onSubmit={submit} noValidate>
          <h2 id="dlg-title">{copy.title}</h2>
          <p className="dialog-sub">{row ? `${row.patient.bed} · ${row.patient.id} · Risk score ${row.latest?.pts ?? '—'}` : t.pid}</p>
          <p className="dialog-hint">{copy.hint}</p>
          {needReason && (
            <div className="field">
              <label htmlFor="dlg-reason">Reason <span className="req">required</span></label>
              <select id="dlg-reason" value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={tried && !!reasonErr}>
                <option value="">Select a reason</option>
                {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {tried && reasonErr && <span className="field-err" role="alert">{reasonErr}</span>}
            </div>
          )}
          <div className="field">
            <label htmlFor="dlg-note">Note {reason === 'Other' ? <span className="req">required</span> : <span className="opt">optional</span>}</label>
            <textarea id="dlg-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} aria-invalid={tried && !!noteErr} />
            {tried && noteErr && <span className="field-err" role="alert">{noteErr}</span>}
          </div>
          <p className="dialog-foot">Recorded as {ACTOR} · stored in this browser session only</p>
          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
            <button type="submit" className={`btn ${t.mode === 'escalate' ? 'btn-danger' : 'btn-primary'}`}>{copy.cta}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
