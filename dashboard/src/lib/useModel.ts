import { useEffect, useState } from 'react';
import type { Example, ModelFile } from './model';

interface Loaded { model: ModelFile; examples: Example[] }

let cache: Promise<Loaded> | null = null;

async function getJson<T>(name: string): Promise<T> {
  const url = `${import.meta.env.BASE_URL}data/${name}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name} not found (${res.status}). Run python scripts/03_train.py to create it.`);
  return (await res.json()) as T;
}

function load(): Promise<Loaded> {
  if (!cache) {
    cache = Promise.all([getJson<ModelFile>('model.json'), getJson<{ examples: Example[] }>('examples.json').catch(() => ({ examples: [] }))])
      .then(([model, ex]) => ({ model, examples: ex.examples }));
    cache.catch(() => { cache = null; });
  }
  return cache;
}

/** The trained model and example records, loaded once and shared by every component that asks. */
export function useModelFile(): { model: ModelFile | null; examples: Example[]; error: string | null; loading: boolean } {
  const [state, setState] = useState<{ data: Loaded | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  useEffect(() => {
    let live = true;
    load().then((data) => live && setState({ data, error: null, loading: false }))
      .catch((e: Error) => live && setState({ data: null, error: e.message, loading: false }));
    return () => { live = false; };
  }, []);
  return { model: state.data?.model ?? null, examples: state.data?.examples ?? [], error: state.error, loading: state.loading };
}
