import { createContext, useContext } from 'react';
import type { Route } from './router';
import { useApp } from './store';

export const NavCtx = createContext<(r: Route) => void>(() => {});

/** Opens a patient and remembers which page to return to. */
export function useOpenPatient(from: 'census' | 'alerts') {
  const go = useContext(NavCtx);
  const { dispatch } = useApp();
  return (pid: string) => {
    dispatch({ type: 'visit', pid, from });
    go({ page: 'patient', pid });
  };
}

export const useGo = () => useContext(NavCtx);
