'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, LogOut, Moon, Sun, User } from 'lucide-react';
import { ModuleSwitcher, UnifiedShell, useFloatingLayer, type AppModuleItem } from '@qsystem/ui';
import type { MeResponse } from '@qsystem/contracts';
import { listModules, STATIC_MODULES } from '../../lib/adapters/registry.adapter';
import { GlobalCommandHost } from '../search/GlobalCommandHost';
import {
  countUnread,
  formatRole,
  list as listNotifications,
  startPolling,
  type NotificationItem,
} from '../../lib/adapters/notifications.adapter';
import { apiFetch } from '../../lib/api/client';
import { useTheme } from '../../lib/theme';

interface NavItem {
  label: string;
  href: string;
}

const MODULE_HOME: Record<string, string> = { qtask: '/', qhrm: '/org', qcrm: '/crm', qsocial: '/social' };

/** Each module owns its navigation; the sidebar only ever shows the active one. */
const MODULE_NAV: Record<string, NavItem[]> = {
  qtask: [
    { label: 'Tất cả công việc', href: '/' },
    { label: 'Công việc của tôi', href: '/tasks' },
    { label: 'Dự án', href: '/projects' },
  ],
  qhrm: [
    { label: 'Danh bạ nhân sự', href: '/org' },
    { label: 'Phòng ban', href: '/org?muc=phong-ban' },
    { label: 'Chấm công', href: '/org?muc=cham-cong' },
  ],
  qcrm: [{ label: 'Khách hàng', href: '/crm' }],
  qsocial: [{ label: 'Bảng tin', href: '/social' }],
};

const MODULES: AppModuleItem[] = STATIC_MODULES.map(({ id, name, description }) => ({ id, name, description }));

function activeModule(pathname: string): string {
  return Object.keys(MODULE_HOME).find((id) => id !== 'qtask' && pathname.startsWith(MODULE_HOME[id])) ?? 'qtask';
}

export interface AppWorkspaceShellProps {
  children: React.ReactNode;
  /** Confirmed session from SessionGuard; the account menu shows its role. */
  me?: MeResponse;
}

export function AppWorkspaceShell({ children, me }: AppWorkspaceShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [modules, setModules] = React.useState<AppModuleItem[]>(MODULES);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const accountTrigger = React.useRef<HTMLButtonElement>(null);

  const moduleId = activeModule(pathname);
  const module = modules.find((entry) => entry.id === moduleId) ?? modules[0] ?? MODULES[0];
  const nav = MODULE_NAV[moduleId];

  React.useEffect(() => startPolling(setItems), []);

  React.useEffect(() => {
    let active = true;
    void listModules().then((rows) => {
      if (!active || rows.length === 0) return;
      setModules(rows.map(({ id, name, description }) => ({ id, name, description })));
    });
    return () => {
      active = false;
    };
  }, []);

  useFloatingLayer(menuOpen, () => { setMenuOpen(false); accountTrigger.current?.focus(); }, false, { root: menuRef });

  React.useEffect(() => {
    if (menuOpen) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [menuOpen]);

  function menuKey(event: React.KeyboardEvent) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (index + 1) % items.length : event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length : -1;
    if (next >= 0) { event.preventDefault(); items[next]?.focus(); }
    if (event.key === 'Tab') {
      // Keep the native Tab destination; close after focus has left the menu.
      setTimeout(() => setMenuOpen(false), 0);
    }
    if (event.key === ' ') { event.preventDefault(); (event.target as HTMLElement).click(); }
  }

  React.useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  async function handleLogout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.assign('/login');
    }
  }

  const unread = countUnread(items);
  const currentItem = nav.find((item) => item.href.split('?')[0] === pathname) ?? nav[0];

  const topActions = (
    <>
      <button
        type="button"
        className="qs-topbar__icon"
        onClick={toggle}
        aria-label="Chuyển giao diện Sáng/Tối"
        aria-pressed={theme === 'dark'}
        title={theme === 'dark' ? 'Đang dùng giao diện tối' : 'Đang dùng giao diện sáng'}
      >
        {theme === 'dark' ? <Sun size={18} strokeWidth={1.5} aria-hidden="true" /> : <Moon size={18} strokeWidth={1.5} aria-hidden="true" />}
      </button>

      <Link
        href="/notifications"
        className="qs-topbar__icon"
        aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
      >
        <Bell size={18} strokeWidth={1.5} aria-hidden="true" />
        {unread > 0 ? (
          <span className="qs-topbar__badge" aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </Link>

      <div className="qs-account" ref={menuRef}>
        <button
          ref={accountTrigger}
          type="button"
          className="qs-topbar__icon"
          aria-label="Tài khoản"
          aria-haspopup="menu"
          aria-expanded={menuOpen ? 'true' : 'false'}
          onClick={() => setMenuOpen((open) => !open)}
          onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setMenuOpen(true); } }}
        >
          <User size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>
        {menuOpen ? (
          <div role="menu" aria-label="Tài khoản" className="qs-account__menu" onKeyDown={menuKey}>
            {me ? (
              <div className="qs-account__identity">
                <span className="qs-account__name">{me.name}</span>
                <span className="qs-account__role">{formatRole(me.role)}</span>
              </div>
            ) : null}
            <Link href="/account" className="qs-account__item" role="menuitem" tabIndex={-1} onClick={() => setMenuOpen(false)}>
              Trang tài khoản
            </Link>
            <button type="button" className="qs-account__item" role="menuitem" tabIndex={-1} onClick={handleLogout}>
              <LogOut size={16} strokeWidth={1.5} aria-hidden="true" />
              Đăng xuất
            </button>
          </div>
        ) : null}
      </div>
    </>
  );

  return (
    <UnifiedShell
      sidebarHeader={
        <ModuleSwitcher
          activeModuleId={moduleId}
          modules={modules}
          onSelectModule={(id) => router.push(MODULE_HOME[id] ?? '/')}
        />
      }
      sidebarNav={
        <nav aria-label={module.name}>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="qs-nav-link"
              aria-current={item === currentItem ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      }
      breadcrumb={
        <span>
          {module.name} / {currentItem.label}
        </span>
      }
      topActions={topActions}
      onOpenCommandPalette={() => setPaletteOpen(true)}
    >
      {children}
      <GlobalCommandHost open={paletteOpen} onOpenChange={setPaletteOpen} />
    </UnifiedShell>
  );
}
