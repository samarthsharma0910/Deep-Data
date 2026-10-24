import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { HeatmapPlot } from '../charts/RiskHeatmap';
import type { Row } from '../lib/derive';

interface Props { rows: Row[]; thr: number; onOpen: (pid: string) => void; onClose: () => void }

/** Risk heatmap over the census: Esc, the close button or a click outside closes it; focus returns to the opener. */
export function HeatmapModal({ rows, thr, onOpen, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    return () => { (opener.current as HTMLElement | null)?.focus?.(); };
  }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab') return;
    const f = Array.from(ref.current?.querySelectorAll<HTMLElement>('button, [href], [tabindex="0"]') ?? []);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-heat" ref={ref} role="dialog" aria-modal="true" aria-labelledby="heat-title" onKeyDown={onKey}>
        <header>
          <div>
            <h2 id="heat-title">Risk heatmap · Last 48 hours</h2>
            <p>Each row is a patient, each column an hour. Click a row to open the patient.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close heatmap"><X size={18} strokeWidth={2} /></button>
        </header>
        <div className="modal-body">
          <HeatmapPlot rows={rows} thr={thr} onOpen={(pid) => { onClose(); onOpen(pid); }} />
        </div>
      </div>
    </div>
  );
}
