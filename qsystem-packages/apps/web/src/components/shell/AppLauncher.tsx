'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Briefcase,
  LayoutGrid,
  MessageSquare,
  Pin,
  Search,
  SquareCheck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useFloatingLayer } from '@qsystem/ui';
import type { Role } from '@qsystem/contracts';

export type ModuleId = 'qtask' | 'qhrm' | 'qcrm' | 'qsocial';

export interface LauncherModule {
  id: ModuleId;
  name: string;
  home: string;
  description: string;
  keywords: string;
  subLabels: readonly string[];
  icon: LucideIcon;
}

export const LAUNCHER_FAVORITES_KEY = 'qsystem:launcher:favorites:v1';

export const APP_MODULES: readonly LauncherModule[] = [
  {
    id: 'qtask',
    name: 'QTask',
    home: '/tasks',
    description: 'Công việc, tiến độ & dự án',
    keywords: 'công việc giao việc dự án nhiệm vụ task project tiến độ quá hạn',
    subLabels: ['Tổng quan', 'Tất cả công việc', 'Công việc của tôi', 'Dự án'],
    icon: SquareCheck,
  },
  {
    id: 'qhrm',
    name: 'QHRM',
    home: '/org',
    description: 'Nhân sự, phòng ban & chấm công',
    keywords: 'nhân sự phòng ban chấm công nghỉ phép nhân viên tuyển dụng danh bạ org hr',
    subLabels: ['Tổng quan', 'Danh bạ nhân sự', 'Phòng ban', 'Chấm công', 'Nghỉ phép'],
    icon: Users,
  },
  {
    id: 'qcrm',
    name: 'QCRM',
    home: '/crm',
    description: 'Khách hàng, cơ hội & doanh thu',
    keywords: 'khách hàng cơ hội bán hàng liên hệ báo cáo doanh thu crm sales',
    subLabels: ['Tổng quan', 'Khách hàng', 'Cơ hội bán hàng', 'Liên hệ', 'Báo cáo'],
    icon: Briefcase,
  },
  {
    id: 'qsocial',
    name: 'QSocial',
    home: '/social',
    description: 'Bảng tin & truyền thông nội bộ',
    keywords: 'bảng tin thông báo chung nhóm chủ đề đã lưu giao tiếp nội bộ social',
    subLabels: ['Bảng tin', 'Thông báo chung', 'Nhóm & chủ đề', 'Đã lưu'],
    icon: MessageSquare,
  },
];

const ALL_MODULE_IDS: readonly ModuleId[] = APP_MODULES.map((entry) => entry.id);

const ROLE_MODULE_ALLOWLIST: Record<Role, readonly ModuleId[]> = {
  DIRECTOR: ALL_MODULE_IDS,
  MANAGER: ALL_MODULE_IDS,
  EMPLOYEE: ['qtask', 'qhrm', 'qsocial'],
};

/** Folds Vietnamese diacritics and case for forgiving search matching. */
export function foldVietnamese(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/** Returns whether a user role (or explicit allowlist) may access the module. */
export function canAccessModule(
  moduleId: string,
  role?: Role | string,
  allowedModuleIds?: readonly string[],
): boolean {
  if (allowedModuleIds) {
    return allowedModuleIds.includes(moduleId);
  }
  if (!role) {
    // Standalone shell harness omits `me` (defaults to Quản trị viên).
    return true;
  }
  const allowed = ROLE_MODULE_ALLOWLIST[role as Role];
  return allowed ? allowed.includes(moduleId as ModuleId) : false;
}

function readPinnedIds(): ModuleId[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LAUNCHER_FAVORITES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = new Set<ModuleId>(ALL_MODULE_IDS);
    const seen = new Set<ModuleId>();
    const result: ModuleId[] = [];
    for (const item of parsed) {
      if (typeof item === 'string' && valid.has(item as ModuleId) && !seen.has(item as ModuleId)) {
        seen.add(item as ModuleId);
        result.push(item as ModuleId);
      }
    }
    return result;
  } catch {
    return [];
  }
}

function writePinnedIds(ids: readonly ModuleId[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAUNCHER_FAVORITES_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage quota or private-mode errors.
  }
}

function matchesModuleQuery(mod: LauncherModule, query: string): boolean {
  const rawNeedle = query.trim().toLowerCase();
  if (!rawNeedle) return true;
  const hay = `${mod.name} ${mod.description} ${mod.keywords} ${mod.subLabels.join(' ')}`;
  if (hay.toLowerCase().includes(rawNeedle)) return true;
  const foldedHay = foldVietnamese(hay);
  const foldedNeedle = foldVietnamese(rawNeedle);
  if (foldedHay.includes(foldedNeedle)) return true;
  const tokens = foldedNeedle.split(/\s+/).filter(Boolean);
  return tokens.length > 1 && tokens.every((token) => foldedHay.includes(token));
}

function findMatchedSubLabel(mod: LauncherModule, query: string): string | undefined {
  const needle = foldVietnamese(query.trim());
  if (!needle) return undefined;
  return mod.subLabels.find((label) => {
    const foldedLabel = foldVietnamese(label);
    return foldedLabel.includes(needle) && !foldVietnamese(mod.description).includes(foldedLabel);
  });
}

export interface AppLauncherProps {
  activeModuleId: ModuleId | null;
  activeModuleName: string | null;
  role?: Role | string;
  allowedModuleIds?: readonly string[];
  onNavigate?: (module: LauncherModule) => void;
}

export function AppLauncher({
  activeModuleId,
  activeModuleName,
  role,
  allowedModuleIds,
  onNavigate,
}: AppLauncherProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [pinnedIds, setPinnedIds] = React.useState<ModuleId[]>(() => readPinnedIds());

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const closeLauncher = React.useCallback(() => {
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  }, []);

  useFloatingLayer(open, closeLauncher, false, {
    root: panelRef,
    returnFocus: triggerRef,
  });

  React.useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    setPinnedIds(readPinnedIds());
    searchInputRef.current?.focus();
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  const togglePin = React.useCallback((id: ModuleId) => {
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      writePinnedIds(next);
      return next;
    });
  }, []);

  const permittedModules = React.useMemo(
    () => APP_MODULES.filter((mod) => canAccessModule(mod.id, role, allowedModuleIds)),
    [role, allowedModuleIds],
  );

  const matchingModules = React.useMemo(
    () => permittedModules.filter((mod) => matchesModuleQuery(mod, query)),
    [permittedModules, query],
  );

  const pinnedSet = React.useMemo(() => new Set<ModuleId>(pinnedIds), [pinnedIds]);
  const pinnedModules = React.useMemo(
    () => matchingModules.filter((mod) => pinnedSet.has(mod.id)),
    [matchingModules, pinnedSet],
  );
  const unpinnedModules = React.useMemo(
    () => matchingModules.filter((mod) => !pinnedSet.has(mod.id)),
    [matchingModules, pinnedSet],
  );

  const renderModuleCard = (mod: LauncherModule) => {
    const Icon = mod.icon;
    const isActive = mod.id === activeModuleId;
    const isPinned = pinnedSet.has(mod.id);
    const matchedSub = findMatchedSubLabel(mod, query);

    return (
      <div
        key={mod.id}
        className="qx-launcher-item"
        data-module={mod.id}
        data-active={isActive ? 'true' : undefined}
      >
        <Link
          href={mod.home}
          prefetch={true}
          className="qx-launcher-item__link"
          aria-current={isActive ? 'page' : undefined}
          onClick={() => {
            setOpen(false);
            setQuery('');
            onNavigate?.(mod);
          }}
        >
          <span className="qx-launcher-tile" aria-hidden="true">
            <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <span className="qx-launcher-item__meta">
            <span className="qx-launcher-item__top">
              <span className="qx-launcher-item__name">{mod.name}</span>
              {isActive ? <span className="qx-launcher-item__badge">Đang mở</span> : null}
            </span>
            <span className="qx-launcher-item__desc">{mod.description}</span>
            {matchedSub ? (
              <span className="qx-launcher-item__match">Chức năng: {matchedSub}</span>
            ) : null}
          </span>
        </Link>
        <button
          type="button"
          className="qx-launcher-pin"
          aria-pressed={isPinned}
          aria-label={isPinned ? `Bỏ ghim ${mod.name}` : `Ghim ${mod.name}`}
          title={isPinned ? `Bỏ ghim ${mod.name}` : `Ghim ${mod.name}`}
          onClick={(event) => {
            event.stopPropagation();
            togglePin(mod.id);
          }}
        >
          <Pin size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
    );
  };

  return (
    <div className="qx-launcher-wrap">
      <button
        ref={triggerRef}
        type="button"
        className="qx-launcher-trigger"
        data-module={activeModuleId ?? 'system'}
        aria-label="Mở App Launcher"
        aria-haspopup="dialog"
        aria-expanded={open ? 'true' : 'false'}
        onClick={() => setOpen((prev) => !prev)}
      >
        <LayoutGrid size={18} strokeWidth={1.5} aria-hidden="true" />
        <span className="qx-launcher-trigger__badge">
          <span className="qx-launcher-trigger__name">{activeModuleName ?? 'QSystem'}</span>
        </span>
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="App Launcher"
          className="qx-launcher-panel"
        >
          <div className="qx-launcher-head">
            <div className="qx-launcher-head__top">
              <span className="qx-launcher-head__title">Không gian làm việc</span>
              <button
                type="button"
                className="qx-icon-btn qx-launcher-close"
                aria-label="Đóng App Launcher"
                onClick={closeLauncher}
              >
                <X size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
            <div className="qx-launcher-search">
              <Search size={16} strokeWidth={1.5} className="qx-launcher-search__icon" aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="search"
                className="qx-launcher-search__input"
                placeholder="Tìm ứng dụng hoặc chức năng"
                aria-label="Tìm ứng dụng hoặc chức năng"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.nativeEvent.isComposing && query.trim() && matchingModules.length > 0) {
                    event.preventDefault();
                    panelRef.current?.querySelector<HTMLAnchorElement>('.qx-launcher-item__link')?.click();
                  }
                }}
              />
              {query ? (
                <button
                  type="button"
                  className="qx-launcher-search__clear"
                  aria-label="Xóa tìm kiếm"
                  onClick={() => {
                    setQuery('');
                    searchInputRef.current?.focus();
                  }}
                >
                  <X size={16} strokeWidth={1.5} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="qx-launcher-body">
            {matchingModules.length === 0 ? (
              <div className="qx-launcher-empty" role="status">
                <Search size={18} strokeWidth={1.5} aria-hidden="true" />
                <p>Không tìm thấy ứng dụng phù hợp với “{query.trim()}”</p>
              </div>
            ) : (
              <>
                {pinnedModules.length > 0 ? (
                  <section className="qx-launcher-group" aria-labelledby="qx-launcher-pinned-heading">
                    <p id="qx-launcher-pinned-heading" className="qx-launcher-group__label">
                      Đã ghim
                    </p>
                    <div className="qx-launcher-list">
                      {pinnedModules.map(renderModuleCard)}
                    </div>
                  </section>
                ) : null}

                {unpinnedModules.length > 0 ? (
                  <section className="qx-launcher-group" aria-labelledby="qx-launcher-all-heading">
                    <p id="qx-launcher-all-heading" className="qx-launcher-group__label">
                      Tất cả ứng dụng
                    </p>
                    <div className="qx-launcher-list">
                      {unpinnedModules.map(renderModuleCard)}
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
