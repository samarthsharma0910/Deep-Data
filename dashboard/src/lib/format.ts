export const fmt = (v: number | null | undefined, digits = 0): string =>
  v == null ? '—' : v.toFixed(digits);

export const signed = (v: number | null): string =>
  v == null ? '—' : v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0';

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
