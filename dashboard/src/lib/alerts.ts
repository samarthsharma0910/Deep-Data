import { LAST_HOUR } from '../config/clinical';
import type { AuditEvent, Episode, ReviewStatus } from '../types';
import type { Row } from './derive';

export interface Review {
  key: string;
  pid: string;
  status: Exclude<ReviewStatus, 'awaiting'>;
  reason?: string;
  note?: string;
  at: number;
}

export interface AlertItem {
  episode: Episode;
  row: Row;
  status: ReviewStatus;
  review?: Review;
  hoursOpen: number;
  priority: number;
  basis: string;
}

export const statusOf = (key: string, reviews: Record<string, Review>): ReviewStatus => reviews[key]?.status ?? 'awaiting';

/** Priority = pts + 0.5×positive change + 1.5×hours open (cap 12, awaiting only) + 8 stale + 4 missing + 5 escalated. */
export function priorityOf(row: Row, ep: Episode, status: ReviewStatus): { value: number; basis: string } {
  const pts = row.latest?.pts ?? ep.peak;
  const pos = Math.max(0, row.change ?? 0);
  const hoursOpen = LAST_HOUR - ep.startHour;
  const open = status === 'awaiting' ? Math.min(hoursOpen, 12) : 0;
  const stale = row.fresh.stale || row.fresh.noVitals ? 8 : 0;
  const missing = row.fresh.noLactate ? 4 : 0;
  const esc = status === 'escalated' ? 5 : 0;
  const value = pts + 0.5 * pos + 1.5 * open + stale + missing + esc;
  const parts = [`score ${pts}`];
  if (pos) parts.push(`+${(0.5 * pos).toFixed(1)} change`);
  if (open) parts.push(`+${(1.5 * open).toFixed(1)} open ${Math.min(hoursOpen, 12)} h`);
  if (stale) parts.push('+8 stale vitals');
  if (missing) parts.push('+4 no lactate');
  if (esc) parts.push('+5 escalated');
  return { value, basis: parts.join(' · ') };
}

export function buildAlerts(rows: Row[], reviews: Record<string, Review>): AlertItem[] {
  const items: AlertItem[] = [];
  for (const row of rows) {
    for (const episode of row.episodes) {
      const status = statusOf(episode.key, reviews);
      const { value, basis } = priorityOf(row, episode, status);
      items.push({ episode, row, status, review: reviews[episode.key], hoursOpen: LAST_HOUR - episode.startHour, priority: value, basis });
    }
  }
  return items.sort((a, b) => b.priority - a.priority);
}

export const isOpenAlert = (a: AlertItem) => a.episode.ongoing && (a.status === 'awaiting' || a.status === 'escalated');
export const isReviewed = (a: AlertItem) => a.status === 'acknowledged' || a.status === 'dismissed';

export const ACTION_LABEL: Record<AuditEvent['action'], string> = {
  acknowledge: 'Acknowledged', escalate: 'Escalated', dismiss: 'Dismissed',
  'bundle-record': 'Bundle item recorded', 'bundle-undo': 'Bundle item undone',
};

/** Alerts per 10 bed-days across the loaded cohort at a given threshold. */
export function alertBurden(rows: Row[], findEp: (row: Row, thr: number) => Episode[], thr: number, hours: number) {
  let episodes = 0;
  let above = 0;
  for (const r of rows) {
    const eps = findEp(r, thr);
    episodes += eps.length;
    if (eps.some((e) => e.ongoing)) above++;
  }
  const bedDays = (rows.length * hours) / 24;
  return { per10: bedDays ? (episodes / bedDays) * 10 : 0, episodes, above };
}
