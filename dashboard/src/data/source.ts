import type { Dataset } from '../types';

/** Set to a base URL (e.g. "/api") to read from a service; null reads the bundled static JSON. */
export const apiBase: string | null = null;

export async function loadDataset(): Promise<Dataset> {
  const url = apiBase ? `${apiBase}/dataset` : `${import.meta.env.BASE_URL}data/dataset.json`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Dataset request failed (${res.status}) at ${url}`);
  const data = (await res.json()) as Dataset;
  if (!data?.meta || !Array.isArray(data.patients) || !Array.isArray(data.observations)) {
    throw new Error('Dataset is missing meta, patients or observations');
  }
  return { ...data, evaluation: data.evaluation ?? null, explanations: data.explanations ?? null };
}
