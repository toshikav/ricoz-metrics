'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BookOpen,
  ChevronRight,
  Code2,
  GitBranch,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react';
import { api } from './api/client';
import { useLoad } from './hooks/useLoad';
export default function Workspace({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(),
    [open, setOpen] = useState(false);
  const health = useLoad(api.health, [pathname]);
  const [mobile, setMobile] = useState(true);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 720px)');
    const change = () => setMobile(query.matches);
    change();
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (!open || !mobile) return;
    const previous = document.activeElement as HTMLElement;
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('keydown', escape);
      previous?.focus();
    };
  }, [open, mobile]);
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);
  const current = pathname.startsWith('/metrics')
    ? 'Metric catalogue'
    : pathname === '/sql'
      ? 'SQL workbench'
      : pathname === '/changes'
        ? 'Change review'
        : 'Overview';
  const nav = [
    { to: '/overview', text: 'Overview', icon: LayoutDashboard },
    { to: '/metrics', text: 'Metric catalogue', icon: BookOpen },
    { to: '/sql', text: 'SQL workbench', icon: Code2 },
    { to: '/changes', text: 'Change review', icon: GitBranch },
  ];
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="app-shell">
        <aside className={'sidebar ' + (open ? 'is-open' : '')} inert={mobile && !open}>
          <Link className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">
              rZ
            </span>
            <span>
              Ricoz<span className="brand-light">Metrics</span>
              <small>METRIC GOVERNANCE</small>
            </span>
          </Link>
          <button
            className="mobile-close icon-button"
            ref={closeButton}
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X />
          </button>
          <Link
            className="workspace"
            href="/overview"
            aria-label="Ricoz workspace overview"
            onClick={() => setOpen(false)}
          >
            <span className="workspace-avatar">R</span>
            <div>
              <strong>Ricoz workspace</strong>
              <small>Internal catalogue</small>
            </div>
            <ChevronRight size={15} />
          </Link>
          <div className="nav-caption">WORKSPACE</div>
          <nav aria-label="Main navigation">
            {nav.map(({ to, text, icon: Icon }) => (
              <Link
                key={to}
                href={to}
                className={
                  (to === '/metrics' ? pathname.startsWith(to) : pathname === to) ? 'active' : ''
                }
                aria-current={
                  (to === '/metrics' ? pathname.startsWith(to) : pathname === to)
                    ? 'page'
                    : undefined
                }
              >
                <Icon size={19} />
                {text}
              </Link>
            ))}
          </nav>
          <div className="sidebar-note">
            <ShieldCheck size={21} />
            <strong>
              One definition.
              <br />A shared understanding.
            </strong>
            <p>Define, review and trace the metrics your team depends on.</p>
          </div>
          <div className="sidebar-footer">
            <span className={'status-dot ' + (health.data ? 'online' : '')} />
            <div>
              {health.loading
                ? 'Checking connection'
                : health.data
                  ? 'API connected'
                  : 'API unavailable'}
              <small>Catalogue workspace · v1.1</small>
            </div>
            <Activity size={16} />
          </div>
        </aside>
        {open && (
          <button
            className="nav-backdrop"
            aria-label="Dismiss navigation"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
        )}
        <div className="main-shell" inert={mobile && open}>
          <div className="topbar">
            <div className="breadcrumb">
              <button
                className="mobile-menu icon-button"
                aria-label="Open navigation"
                aria-expanded={open}
                onClick={() => setOpen(true)}
              >
                <Menu />
              </button>
              <span>Workspace</span>
              <ChevronRight size={14} />
              <strong>{current}</strong>
            </div>
            <span className="workspace-label">
              <span className="status-dot online" />
              Internal workspace
            </span>
          </div>
          <main id="main">{children}</main>
          <footer className="app-footer">
            <span>RicozMetrics</span>
            <span>Definitions you can trace.</span>
          </footer>
        </div>
      </div>
    </>
  );
}
