import { useCallback, useEffect, useState } from 'react';
import { loadDataset } from './data/source';
import { ActionDialog } from './components/ActionDialog';
import { Header, Sidebar } from './components/Header';
import { Toast } from './components/Toast';
import { isOpenAlert } from './lib/alerts';
import { NavCtx } from './lib/nav';
import { useRoute } from './lib/router';
import { AppProvider, useApp } from './lib/store';
import { setSnapshot } from './lib/time';
import { AlertQueue } from './pages/AlertQueue';
import { Assess } from './pages/Assess';
import { Census } from './pages/Census';
import { ModelPerformance } from './pages/ModelPerformance';
import { PatientView } from './pages/PatientView';
import { Settings } from './pages/Settings';
import type { Dataset } from './types';

const TITLES = { census: 'Unit Census', alerts: 'Alert Queue', patient: 'Patient Investigation', model: 'Model Performance', assess: 'Assess Patient', settings: 'Settings' };

function Shell() {
  const [route, go] = useRoute();
  const { alerts } = useApp();
  useEffect(() => { document.title = `${TITLES[route.page]} · Sepsis Monitor`; }, [route]);
  useEffect(() => { window.scrollTo(0, 0); }, [route.page, route.page === 'patient' ? route.pid : '']);
  return (
    <NavCtx.Provider value={go}>
      <Header />
      <Sidebar route={route} openAlerts={alerts.filter(isOpenAlert).length} />
      <main id="main">
        {route.page === 'census' && <Census />}
        {route.page === 'alerts' && <AlertQueue />}
        {route.page === 'patient' && <PatientView pid={route.pid} />}
        {route.page === 'model' && <ModelPerformance />}
        {route.page === 'assess' && <Assess />}
        {route.page === 'settings' && <Settings />}
      </main>
      <ActionDialog />
      <Toast />
    </NavCtx.Provider>
  );
}

function Skeleton() {
  return (
    <div className="boot" aria-busy="true" aria-label="Loading data">
      <div className="app-header"><span className="wordmark"><span>SEPSIS MONITOR</span></span></div>
      <div className="page" style={{ marginLeft: 0 }}>
        <div className="skeleton sk-strip" />
        {Array.from({ length: 10 }, (_, i) => <div key={i} className="skeleton sk-row" />)}
      </div>
    </div>
  );
}

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    loadDataset().then((d) => { setSnapshot(d.meta.snapshotTime); setDataset(d); }).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  if (error) {
    return (
      <div className="boot-error" role="alert">
        <h1>Data could not be loaded</h1>
        <p>{error}</p>
        <button type="button" className="btn btn-primary" onClick={load}>Retry</button>
      </div>
    );
  }
  if (!dataset) return <Skeleton />;
  return <AppProvider dataset={dataset}><Shell /></AppProvider>;
}
