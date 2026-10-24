import { LAST_HOUR } from '../config/clinical';

const IST_OFFSET_MS = 330 * 60_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

let snapshotMs = Date.parse('2026-10-23T09:00:00+05:30');
export const setSnapshot = (iso: string) => { snapshotMs = Date.parse(iso); };
export const getSnapshotMs = () => snapshotMs;

export const hourToMs = (h: number) => snapshotMs + (h - LAST_HOUR) * 3_600_000;
export const msToHour = (ms: number) => LAST_HOUR + (ms - snapshotMs) / 3_600_000;

const parts = (ms: number) => new Date(ms + IST_OFFSET_MS);
export const clock = (ms: number) => { const d = parts(ms); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
export const dayLabel = (ms: number) => { const d = parts(ms); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
export const stamp = (ms: number) => `${dayLabel(ms)} ${clock(ms)}`;
export const hourClock = (h: number) => clock(hourToMs(h));
export const hourStamp = (h: number) => stamp(hourToMs(h));

export function formatLos(hours: number): string {
  if (hours < 24) return `${hours} h`;
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  return h ? `${d} d ${h} h` : `${d} d`;
}
