import { Activity, Bell, ChartLine, ClipboardPlus, LayoutGrid, Settings, UserRound, type LucideIcon } from 'lucide-react';
import { stamp, getSnapshotMs } from '../lib/time';
import { useApp } from '../lib/store';
import { hrefFor, type Route } from '../lib/router';

export function Header() {
  const { dataset } = useApp();
  const simulated = dataset.meta.dataSource !== 'project';
  return (
    <header className="app-header">
      <a className="wordmark" href={hrefFor({ page: 'census' })} aria-label="Sepsis Monitor home">
        <span className="logo-mark"><Activity size={16} strokeWidth={2.25} aria-hidden="true" /></span>
        <span className="logo-text">Sepsis Monitor</span>
      </a>
      {simulated
        ? <span className="badge-demo">DEMO · SIMULATED DATA</span>
        : <span className="badge-demo badge-replay">RETROSPECTIVE REPLAY · HELD-OUT RECORDS</span>}
      <div className="header-spacer" />
      <span className="header-meta">Snapshot <b>{stamp(getSnapshotMs())}</b></span>
    </header>
  );
}

export function Sidebar({ route, openAlerts }: { route: Route; openAlerts: number }) {
  const { state } = useApp();
  const items: { id: Route['page']; label: string; href: string; icon: LucideIcon; disabled?: boolean; badge?: number }[] = [
    { id: 'census', label: 'Unit Census', href: hrefFor({ page: 'census' }), icon: LayoutGrid },
    { id: 'alerts', label: 'Alert Queue', href: hrefFor({ page: 'alerts' }), icon: Bell, badge: openAlerts },
    { id: 'patient', label: 'Patient Investigation', href: state.lastPid ? hrefFor({ page: 'patient', pid: state.lastPid }) : '#', icon: UserRound, disabled: !state.lastPid },
    { id: 'assess', label: 'Assess Patient', href: hrefFor({ page: 'assess' }), icon: ClipboardPlus },
    { id: 'model', label: 'Model Performance', href: hrefFor({ page: 'model' }), icon: ChartLine },
    { id: 'settings', label: 'Settings', href: hrefFor({ page: 'settings' }), icon: Settings },
  ];
  return (
    <nav className="sidebar" aria-label="Primary">
      <ul>
        {items.map((t) => {
          const Icon = t.icon;
          const body = <><Icon size={17} strokeWidth={1.9} aria-hidden="true" /><span>{t.label}</span>{t.badge ? <span className="tab-badge">{t.badge}</span> : null}</>;
          return (
            <li key={t.id}>
              {t.disabled
                ? <span className="side-link is-disabled" aria-disabled="true" title="Choose a patient from the census or alert queue">{body}</span>
                : <a className={`side-link${route.page === t.id ? ' is-active' : ''}`} href={t.href} aria-current={route.page === t.id ? 'page' : undefined}>{body}</a>}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
