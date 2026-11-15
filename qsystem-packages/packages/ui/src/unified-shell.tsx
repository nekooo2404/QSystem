'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Menu, Search, X } from 'lucide-react';
import { useFloatingLayer } from './layer';

export interface UnifiedShellProps {
  sidebarHeader?: React.ReactNode;
  sidebarNav: React.ReactNode;
  breadcrumb?: React.ReactNode;
  onOpenCommandPalette?: () => void;
  topActions?: React.ReactNode;
  children: React.ReactNode;
}

/** Desktop sidebar breakpoint; innerWidth covers mocked viewports and jsdom alike. */
function useDesktopSidebar() {
  const [desktop, setDesktop] = React.useState(() => typeof window === 'undefined' || window.innerWidth >= 1024);

  React.useEffect(() => {
    const update = () => setDesktop(window.innerWidth >= 1024);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return desktop;
}

/** 240px sidebar + 56px fixed top bar; below 1024px the sidebar becomes a drawer. */
export function UnifiedShell({
  sidebarHeader,
  sidebarNav,
  breadcrumb,
  onOpenCommandPalette,
  topActions,
  children,
}: UnifiedShellProps) {
  const desktop = useDesktopSidebar();
  const [navOpen, setNavOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // A breakpoint change always drops the mobile drawer; it also releases its scroll lock.
  React.useEffect(() => {
    if (desktop) setNavOpen(false);
  }, [desktop]);

  useFloatingLayer(navOpen && !desktop, () => setNavOpen(false), true, {
    root: panelRef,
    fallbackFocus: () => document.querySelector<HTMLElement>('.qs-shell__sidebar button, .qs-shell__content'),
  });

  const sidebarInner = (
    <>
      {sidebarHeader ? <div className="qs-shell__sidebar-header">{sidebarHeader}</div> : null}
      <div className="qs-shell__nav">{sidebarNav}</div>
    </>
  );

  return (
    <div className="qs-shell" data-sidebar={desktop ? 'fixed' : 'drawer'}>
      {desktop ? (
        <aside className="qs-shell__sidebar">{sidebarInner}</aside>
      ) : (
        <button
          type="button"
          className="qs-shell__nav-toggle"
          aria-label="Mở điều hướng"
          aria-expanded={navOpen ? 'true' : 'false'}
          onClick={() => setNavOpen(true)}
        >
          <Menu size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>
      )}

      <div className="qs-shell__main">
        <header className="qs-shell__topbar">
          {!desktop ? <span className="qs-shell__topbar-slot" aria-hidden="true" /> : null}
          <div className="qs-shell__breadcrumb">{breadcrumb}</div>
          {onOpenCommandPalette ? (
            // The label is display:none under 640px, so it must also be the accessible name.
            <button
              type="button"
              className="qs-shell__search"
              aria-label="Tìm việc, nhân sự, tài liệu…"
              onClick={onOpenCommandPalette}
            >
              <Search size={16} strokeWidth={1.5} aria-hidden="true" />
              <span className="qs-shell__search-text">Tìm việc, nhân sự, tài liệu…</span>
              <kbd className="qs-shell__kbd">Ctrl K</kbd>
            </button>
          ) : null}
          <div className="qs-shell__top-actions">{topActions}</div>
        </header>
        <main tabIndex={-1} className="qs-shell__content">{children}</main>
      </div>

      {!desktop && navOpen ? createPortal(
        <div className="qs-shell__nav-overlay">
          <div className="qs-shell__nav-backdrop" aria-hidden="true" onClick={() => setNavOpen(false)} />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Điều hướng"
            tabIndex={-1}
            className="qs-shell__sidebar qs-shell__sidebar--drawer"
          >
            <button type="button" className="qs-btn qs-btn--ghost qs-shell__nav-close" aria-label="Đóng điều hướng" onClick={() => setNavOpen(false)}><X size={18} strokeWidth={1.5} aria-hidden="true" /></button>
            <div onClick={(event) => { if ((event.target as Element).closest('a[href]')) setNavOpen(false); }}>{sidebarInner}</div>
          </div>
        </div>, document.body
      ) : null}
    </div>
  );
}
