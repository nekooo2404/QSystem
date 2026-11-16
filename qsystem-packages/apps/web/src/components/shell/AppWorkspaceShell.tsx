'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Bell,
  Bookmark,
  Building2,
  CalendarCheck,
  Check,
  ChevronDown,
  Clock,
  FileText,
  Folder,
  Hash,
  Home,
  LineChart,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  MoreHorizontal,
  Newspaper,
  Phone,
  Plus,
  Search,
  Settings,
  SquareCheck,
  Sun,
  Target,
  User,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useFloatingLayer } from '@qsystem/ui';
import type { MeResponse } from '@qsystem/contracts';
import { GlobalCommandHost } from '../search/GlobalCommandHost';
import { CreateTaskModal, type AssigneeOption } from '../qtask/CreateTaskModal';
import {
  canUseDevPersistence,
  loadStoredWorkspaceId,
  recordCreatedTaskInStorage,
  saveStoredWorkspaceId,
} from '../qtask/qtask.storage';
import { SAMPLE_PEOPLE } from '../qtask/TaskDetailContent';
import { countUnread, formatRole, startPolling, type NotificationItem } from '../../lib/adapters/notifications.adapter';
import { apiFetch, setAccessToken } from '../../lib/api/client';
import { useTheme } from '../../lib/theme';
import './shell.css';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** `pathname` or `pathname?muc` key that marks this entry as current. */
  match?: string;
  count?: number;
}

interface ModuleDef {
  id: string;
  name: string;
  home: string;
  navLabel: string;
  nav: NavItem[];
}

interface WorkspaceProfile {
  id: string;
  name: string;
  plan: string;
}

const WORKSPACES: WorkspaceProfile[] = [
  { id: 'qts', name: 'QTS Workspace', plan: 'Gói doanh nghiệp' },
];

const MODULES: ModuleDef[] = [
  {
    id: 'qtask',
    name: 'QTask',
    home: '/tasks',
    navLabel: 'QTask / Điều hướng',
    nav: [
      { label: 'Tổng quan', href: '/?muc=tong-quan', icon: Home, match: '/?tong-quan' },
      { label: 'Tất cả công việc', href: '/', icon: SquareCheck, match: '/' },
      { label: 'Công việc của tôi', href: '/tasks', icon: Check, match: '/tasks', count: 3 },
      { label: 'Dự án', href: '/projects', icon: Folder, match: '/projects' },
    ],
  },
  {
    id: 'qhrm',
    name: 'QHRM',
    home: '/org',
    navLabel: 'QHRM / Điều hướng',
    nav: [
      { label: 'Tổng quan', href: '/org?muc=tong-quan', icon: Home, match: '/org?tong-quan' },
      { label: 'Danh bạ nhân sự', href: '/org', icon: UserRound, match: '/org' },
      { label: 'Phòng ban', href: '/org?muc=phong-ban', icon: Building2, match: '/org?phong-ban' },
      { label: 'Chấm công', href: '/org?muc=cham-cong', icon: Clock, match: '/org?cham-cong' },
      { label: 'Nghỉ phép', href: '/org?muc=nghi-phep', icon: CalendarCheck, match: '/org?nghi-phep' },
    ],
  },
  {
    id: 'qcrm',
    name: 'QCRM',
    home: '/crm',
    navLabel: 'QCRM / Điều hướng',
    nav: [
      { label: 'Tổng quan', href: '/crm?muc=tong-quan', icon: Home, match: '/crm?tong-quan' },
      { label: 'Khách hàng', href: '/crm', icon: Building2, match: '/crm' },
      { label: 'Cơ hội bán hàng', href: '/crm?muc=co-hoi', icon: Target, match: '/crm?co-hoi' },
      { label: 'Liên hệ', href: '/crm?muc=lien-he', icon: Phone, match: '/crm?lien-he' },
      { label: 'Báo cáo', href: '/crm?muc=bao-cao', icon: LineChart, match: '/crm?bao-cao' },
    ],
  },
  {
    id: 'qsocial',
    name: 'QSocial',
    home: '/social',
    navLabel: 'QSocial / Điều hướng',
    nav: [
      { label: 'Bảng tin', href: '/social', icon: Newspaper, match: '/social' },
      { label: 'Thông báo chung', href: '/social?muc=thong-bao', icon: Megaphone, match: '/social?thong-bao' },
      { label: 'Nhóm & chủ đề', href: '/social?muc=nhom', icon: Hash, match: '/social?nhom' },
      { label: 'Đã lưu', href: '/social?muc=da-luu', icon: Bookmark, match: '/social?da-luu' },
    ],
  },
];

const SHORTCUTS: NavItem[] = [
  { label: 'Tìm kiếm', href: '#search', icon: Search },
  { label: 'Tài liệu', href: '/files', icon: FileText, match: '/files' },
  { label: 'Thông báo', href: '/notifications', icon: Bell, match: '/notifications' },
];

const PAGE_TITLES: Record<string, [string, string]> = {
  '/files': ['QTask', 'Tài liệu'],
  '/notifications': ['QTask', 'Thông báo'],
  '/account': ['QTask', 'Tài khoản & bảo mật'],
};

interface ToastEntry {
  id: string;
  message: string;
}

function activeModule(pathname: string): ModuleDef {
  return MODULES.find((entry) => entry.id !== 'qtask' && pathname.startsWith(entry.home)) ?? MODULES[0];
}

function initials(name?: string): string {
  if (!name) return 'MK';
  const parts = name.trim().split(/\s+/);
  const letters = parts.length > 1 ? parts[parts.length - 2][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2);
  return letters.toUpperCase();
}

export interface AppWorkspaceShellProps {
  children: React.ReactNode;
  /** Confirmed session from SessionGuard; the account menu shows its role. */
  me?: MeResponse;
}

export function AppWorkspaceShell({ children, me }: AppWorkspaceShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, toggle } = useTheme();
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [wsMenuOpen, setWsMenuOpen] = React.useState(false);
  const [workspace, setWorkspace] = React.useState<WorkspaceProfile>(WORKSPACES[0]);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [quickTaskOpen, setQuickTaskOpen] = React.useState(false);
  const [quickPeople, setQuickPeople] = React.useState<AssigneeOption[]>(() =>
    canUseDevPersistence() ? SAMPLE_PEOPLE : [],
  );
  const [navOpen, setNavOpen] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastEntry[]>([]);

  const menuRef = React.useRef<HTMLDivElement>(null);
  const wsMenuRef = React.useRef<HTMLDivElement>(null);
  const accountTrigger = React.useRef<HTMLButtonElement>(null);
  const wsTrigger = React.useRef<HTMLButtonElement>(null);

  const module = activeModule(pathname);
  const section = searchParams?.get('muc');
  const matchKey = section ? `${pathname}?${section}` : pathname;

  const pushToast = React.useCallback((message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-2), { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  React.useEffect(() => startPolling(setItems), []);
  React.useEffect(() => setNavOpen(false), [pathname, section]);

  React.useEffect(() => {
    const idlePrefetch = () => {
      const routes = ['/tasks', '/', '/org', '/crm', '/social', '/projects'];
      routes.forEach((route) => {
        try {
          router.prefetch(route);
        } catch {
          // prefetch is best-effort
        }
      });
    };
    if (typeof window !== 'undefined') {
      const win = window as unknown as {
        requestIdleCallback?: (cb: () => void) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      if (typeof win.requestIdleCallback === 'function') {
        const handle = win.requestIdleCallback(idlePrefetch);
        return () => {
          if (typeof win.cancelIdleCallback === 'function') {
            win.cancelIdleCallback(handle);
          }
        };
      } else {
        const timeout = setTimeout(idlePrefetch, 200);
        return () => clearTimeout(timeout);
      }
    }
  }, [router]);

  React.useEffect(() => {
    const savedId = loadStoredWorkspaceId();
    if (!savedId) return;
    const match = WORKSPACES.find((item) => item.id === savedId);
    if (match) setWorkspace(match);
  }, []);

  React.useEffect(() => {
    if (!quickTaskOpen) return;
    let active = true;
    void apiFetch<Array<{ id?: string; name?: string }>>('/api/org/users')
      .then((rows) => {
        if (!active || !Array.isArray(rows) || rows.length === 0) return;
        const mapped = rows
          .filter((row): row is { id: string; name: string } => Boolean(row.id && row.name))
          .map((row) => ({ id: row.id, name: row.name }));
        if (mapped.length > 0) setQuickPeople(mapped);
      })
      .catch(() => {
        // Keep environment-appropriate fallback assignees.
      });
    return () => {
      active = false;
    };
  }, [quickTaskOpen]);

  React.useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (typeof detail === 'string' && detail.trim()) {
        pushToast(detail);
      }
    };
    window.addEventListener('qsystem:toast', onToast);
    return () => window.removeEventListener('qsystem:toast', onToast);
  }, [pushToast]);

  useFloatingLayer(menuOpen, () => { setMenuOpen(false); accountTrigger.current?.focus(); }, false, { root: menuRef });
  useFloatingLayer(wsMenuOpen, () => { setWsMenuOpen(false); wsTrigger.current?.focus(); }, false, { root: wsMenuRef });

  React.useEffect(() => {
    if (menuOpen) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [menuOpen]);

  React.useEffect(() => {
    if (!menuOpen && !wsMenuOpen) return;
    const close = (event: MouseEvent) => {
      if (menuOpen && !menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
      if (wsMenuOpen && !wsMenuRef.current?.contains(event.target as Node)) setWsMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen, wsMenuOpen]);

  function menuKey(event: React.KeyboardEvent) {
    const entries = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = entries.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 : event.key === 'ArrowDown' ? (index + 1) % entries.length : event.key === 'ArrowUp' ? (index - 1 + entries.length) % entries.length : -1;
    if (next >= 0) { event.preventDefault(); entries[next]?.focus(); }
    if (event.key === 'Tab') setTimeout(() => setMenuOpen(false), 0);
  }

  async function handleLogout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Redirect cleanly to login even if API is offline in preview.
    } finally {
      setAccessToken(null);
      if (typeof document !== 'undefined') {
        document.cookie = 'refresh_token=; path=/; max-age=0; SameSite=Lax';
        document.cookie = 'refresh_token=; path=/api/auth; max-age=0; SameSite=Lax';
        document.cookie = 'refresh_token=; path=/auth; max-age=0; SameSite=Lax';
        document.cookie = 'qsystem_logged_out=1; path=/; max-age=86400; SameSite=Lax';
      }
      window.location.assign('/login');
    }
  }

  const unread = countUnread(items);
  const current = module.nav.find((item) => item.match === matchKey);
  const crumb = PAGE_TITLES[pathname] ?? [module.name, current?.label ?? module.nav[0].label];
  const userName = me?.name ?? 'Minh Khôi';
  const userRole = me ? formatRole(me.role) : 'Quản trị viên';
  const userInitials = initials(me?.name);

  const renderLink = (item: NavItem) => {
    const Icon = item.icon;
    if (item.href === '#search') {
      return (
        <button key={item.label} type="button" className="qx-nav__link qx-nav__link--button" onClick={() => setPaletteOpen(true)}>
          <Icon size={17} strokeWidth={1.6} aria-hidden="true" />
          {item.label}
        </button>
      );
    }
    return (
      <Link
        key={item.label}
        href={item.href}
        prefetch={true}
        className="qx-nav__link"
        aria-current={item.match === matchKey ? 'page' : undefined}
      >
        <Icon size={17} strokeWidth={1.6} aria-hidden="true" />
        {item.label}
        {item.count ? <span className="qx-nav__count">{item.count}</span> : null}
      </Link>
    );
  };

  return (
    <div className="qx-shell" data-nav={navOpen ? 'open' : 'closed'}>
      <div className="qx-backdrop" aria-hidden="true" onClick={() => setNavOpen(false)} />
      <aside className="qx-sidebar" aria-label="Điều hướng chính">
        <div className="qx-brand">
          <span className="qx-brand__mark" aria-label="Logo QTS">
            Q
            <img src="/qts-logo.png" alt="" onError={(event) => { event.currentTarget.hidden = true; }} />
          </span>
          <span className="qx-brand__name">QSystem</span>
          <span className="qx-brand__tag">WORKSPACE</span>
        </div>

        <div className="qx-ws-wrap" ref={wsMenuRef}>
          <button
            ref={wsTrigger}
            type="button"
            className="qx-ws"
            aria-label={`Chọn không gian làm việc: ${workspace.name}`}
            aria-haspopup="menu"
            aria-expanded={wsMenuOpen ? 'true' : 'false'}
            onClick={() => setWsMenuOpen((open) => !open)}
          >
            <Building2 className="qx-ws__icon" size={18} strokeWidth={1.5} aria-hidden="true" />
            <span className="qx-ws__text">
              <span className="qx-ws__name">{workspace.name}</span>
              <span className="qx-ws__plan">{workspace.plan}</span>
            </span>
            <ChevronDown size={15} strokeWidth={1.6} aria-hidden="true" />
          </button>

          {wsMenuOpen ? (
            <div role="menu" aria-label="Không gian làm việc" className="qx-ws-popover">
              <span className="qx-ws-popover__label">Không gian làm việc</span>
              {WORKSPACES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={workspace.id === item.id}
                  className="qx-menu__item"
                  onClick={() => {
                    setWorkspace(item);
                    saveStoredWorkspaceId(item.id);
                    setWsMenuOpen(false);
                    pushToast(`Đã chuyển sang ${item.name}`);
                  }}
                >
                  <Building2 size={14} strokeWidth={1.6} aria-hidden="true" />
                  <span>{item.name}</span>
                  {workspace.id === item.id ? (
                    <Check size={14} strokeWidth={2} className="qx-ws-popover__check" aria-hidden="true" />
                  ) : null}
                </button>
              ))}
              <div className="qx-ws-popover__sep" aria-hidden="true" />
              <button
                type="button"
                role="menuitem"
                className="qx-menu__item"
                onClick={() => {
                  setWsMenuOpen(false);
                  setPaletteOpen(true);
                }}
              >
                <Search size={14} strokeWidth={1.6} aria-hidden="true" />
                Tìm nhanh (Ctrl K)
              </button>
              <button
                type="button"
                role="menuitem"
                className="qx-menu__item"
                onClick={() => {
                  setWsMenuOpen(false);
                  router.push('/account');
                }}
              >
                <Settings size={14} strokeWidth={1.6} aria-hidden="true" />
                Cài đặt không gian
              </button>
            </div>
          ) : null}
        </div>

        <p className="qx-label">Không gian làm việc</p>
        <nav className="qx-modules" aria-label="Phân hệ">
          {MODULES.map((entry) => (
            <Link
              key={entry.id}
              href={entry.home}
              prefetch={true}
              className="qx-chip"
              aria-current={entry.id === module.id ? 'true' : undefined}
            >
              {entry.name}
            </Link>
          ))}
        </nav>

        <p className="qx-label">{module.navLabel}</p>
        <nav className="qx-nav" aria-label={module.name}>
          {module.nav.map(renderLink)}
        </nav>

        <div className="qx-sidebar__spacer" />

        <p className="qx-label">Lối tắt</p>
        <nav className="qx-nav" aria-label="Lối tắt">
          {SHORTCUTS.map(renderLink)}
        </nav>

        <div className="qx-user">
          <span className="qx-avatar" aria-hidden="true">{userInitials}</span>
          <span className="qx-user__text">
            <span className="qx-user__name">{userName}</span>
            <span className="qx-user__role">{userRole}</span>
          </span>
          <Link href="/account" prefetch={true} className="qx-icon-btn" aria-label="Tài khoản của tôi">
            <MoreHorizontal size={17} strokeWidth={1.6} aria-hidden="true" />
          </Link>
        </div>
      </aside>

      <div className="qx-main">
        <header className="qx-topbar">
          <button type="button" className="qx-icon-btn qx-burger" aria-label="Mở điều hướng" aria-expanded={navOpen} onClick={() => setNavOpen(true)}>
            <Menu size={18} strokeWidth={1.6} aria-hidden="true" />
          </button>
          <nav className="qx-crumb" aria-label="Breadcrumb">
            <span>{crumb[0]}</span>
            <span className="qx-crumb__sep" aria-hidden="true">/</span>
            <span className="qx-crumb__current" aria-current="page">{crumb[1]}</span>
          </nav>

          <div className="qx-topbar__right">
            <button type="button" className="qx-search" aria-label="Tìm mọi thứ trong QSystem" onClick={() => setPaletteOpen(true)}>
              <Search size={15} strokeWidth={1.6} aria-hidden="true" />
              <span className="qx-search__text">Tìm mọi thứ trong QSystem...</span>
              <kbd className="qx-kbd">Ctrl K</kbd>
            </button>
            <button
              type="button"
              className="qx-icon-btn"
              aria-label="Giao việc mới"
              onClick={() => setQuickTaskOpen(true)}
            >
              <Plus size={18} strokeWidth={1.6} aria-hidden="true" />
            </button>
            <button type="button" className="qx-icon-btn" onClick={toggle} aria-label="Chuyển giao diện Sáng/Tối" aria-pressed={theme === 'dark'}>
              {theme === 'dark' ? <Sun size={17} strokeWidth={1.6} aria-hidden="true" /> : <Moon size={17} strokeWidth={1.6} aria-hidden="true" />}
            </button>
            <Link href="/notifications" prefetch={true} className="qx-icon-btn" aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}>
              <Bell size={17} strokeWidth={1.6} aria-hidden="true" />
              {unread > 0 ? <span className="qx-icon-btn__dot" aria-hidden="true" /> : null}
            </Link>
            <div className="qx-account" ref={menuRef}>
              <button
                ref={accountTrigger}
                type="button"
                aria-label="Tài khoản"
                aria-haspopup="menu"
                aria-expanded={menuOpen ? 'true' : 'false'}
                onClick={() => setMenuOpen((open) => !open)}
                onKeyDown={(event) => {
                  if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !menuOpen) {
                    event.preventDefault();
                    setMenuOpen(true);
                  }
                }}
              >
                <span className="qx-avatar" aria-hidden="true">{userInitials}</span>
              </button>
              {menuOpen ? (
                <div role="menu" aria-label="Tài khoản" className="qx-menu" onKeyDown={menuKey}>
                  <div className="qx-menu__identity">
                    <span className="qx-user__name">{userName}</span>
                    <span className="qx-user__role">{userRole}</span>
                  </div>
                  <Link href="/account" prefetch={true} className="qx-menu__item" role="menuitem" tabIndex={-1} onClick={() => setMenuOpen(false)}>
                    <User size={15} strokeWidth={1.6} aria-hidden="true" />
                    Trang tài khoản
                  </Link>
                  <button type="button" className="qx-menu__item" role="menuitem" tabIndex={-1} onClick={handleLogout}>
                    <LogOut size={15} strokeWidth={1.6} aria-hidden="true" />
                    Đăng xuất
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main tabIndex={-1} className="qx-content">{children}</main>
      </div>

      <GlobalCommandHost open={paletteOpen} onOpenChange={setPaletteOpen} />

      <CreateTaskModal
        open={quickTaskOpen}
        onOpenChange={setQuickTaskOpen}
        people={quickPeople}
        onCreated={(task) => {
          recordCreatedTaskInStorage(task, 'both');
          window.dispatchEvent(new CustomEvent('qsystem:task-created', { detail: task }));
          pushToast(`Đã giao việc "${task.title}"`);
        }}
      />

      {toasts.length > 0 ? (
        <div className="qx-toast-stack" role="region" aria-live="polite" aria-label="Thông báo hệ thống">
          {toasts.map((item) => (
            <div key={item.id} className="qx-toast-item">
              <span>{item.message}</span>
              <button
                type="button"
                className="qx-icon-btn"
                aria-label="Đóng thông báo"
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== item.id))}
              >
                <X size={14} strokeWidth={1.6} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
