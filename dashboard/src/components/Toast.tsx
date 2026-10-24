import { useEffect } from 'react';
import { useApp } from '../lib/store';

export function Toast() {
  const { state, dispatch } = useApp();
  const t = state.toast;
  useEffect(() => {
    if (!t) return;
    const id = window.setTimeout(() => dispatch({ type: 'toastClear', id: t.id }), 3000);
    return () => window.clearTimeout(id);
  }, [t, dispatch]);
  return <div className="toast-host" aria-live="polite">{t && <div className="toast" key={t.id}>{t.text}</div>}</div>;
}
