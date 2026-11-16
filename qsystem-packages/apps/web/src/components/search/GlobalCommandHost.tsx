'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ChevronRight, FileText, Folder, Plus, Search, SquareCheck, Sun, Users } from 'lucide-react';
import { toast, useCommandPaletteHotkey, useFloatingLayer } from '@qsystem/ui';
import { SearchResultSchema } from '@qsystem/contracts';
import { apiFetch } from '../../lib/api/client';
import './palette.css';

const DEBOUNCE_MS = 250;

interface Hit {
  id: string;
  title: string;
}

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  keywords?: string;
  icon: React.ReactNode;
  boldLabel?: boolean;
  hasChevron?: boolean;
  onSelect: () => void;
}

interface PaletteGroup {
  id: string;
  label: string;
  items: PaletteItem[];
}

function toHits(hits: Array<Record<string, unknown>>): Hit[] {
  return hits.flatMap((hit) =>
    typeof hit.id === 'string' && typeof hit.title === 'string' ? [{ id: hit.id, title: hit.title }] : [],
  );
}

function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function matchesText(hay: string, query: string): boolean {
  const needle = query.trim();
  if (!needle) return true;
  return hay.toLowerCase().includes(needle.toLowerCase()) || fold(hay).includes(fold(needle));
}

function matches(item: PaletteItem, query: string): boolean {
  return matchesText(`${item.label} ${item.hint ?? ''} ${item.keywords ?? ''}`, query);
}

interface LocalStoreConfig {
  key: string;
  hint: string;
  href: (label: string) => string;
  kind: 'task' | 'folder' | 'user' | 'doc';
}

const LOCAL_STORE_CONFIGS: readonly LocalStoreConfig[] = [
  { key: 'qsystem:tasks:v1', hint: 'QTask', href: (q) => `/?q=${encodeURIComponent(q)}`, kind: 'task' },
  { key: 'qsystem:projects:v1', hint: 'Dự án', href: (q) => `/projects?q=${encodeURIComponent(q)}`, kind: 'folder' },
  { key: 'qsystem:org:users:v1', hint: 'Nhân sự', href: (q) => `/org?q=${encodeURIComponent(q)}`, kind: 'user' },
  { key: 'qsystem:org:depts:v1', hint: 'Phòng ban', href: (q) => `/org?q=${encodeURIComponent(q)}`, kind: 'folder' },
  { key: 'qsystem:crm:customers:v1', hint: 'QCRM', href: (q) => `/crm?q=${encodeURIComponent(q)}`, kind: 'user' },
  { key: 'qsystem:files:list:v1', hint: 'Tài liệu', href: (q) => `/files?q=${encodeURIComponent(q)}`, kind: 'doc' },
  { key: 'qsystem:files:folders:v1', hint: 'Thư mục', href: (q) => `/files?q=${encodeURIComponent(q)}`, kind: 'folder' },
  { key: 'qsystem:social:posts:v1', hint: 'QSocial', href: (q) => `/social?q=${encodeURIComponent(q)}`, kind: 'doc' },
];

function extractRecordItems(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
  }
  if (raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items)) {
    return ((raw as { items: unknown[] }).items).filter(
      (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object',
    );
  }
  return [];
}

function searchWorkspaceRecords(query: string, go: (href: string) => void): PaletteItem[] {
  const needle = query.trim();
  const demoMode = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  if (!needle || typeof window === 'undefined' || process.env.NODE_ENV === 'test' || !demoMode) return [];
  const matchesList: PaletteItem[] = [];
  const seen = new Set<string>();

  for (const cfg of LOCAL_STORE_CONFIGS) {
    let parsed: unknown;
    try {
      const raw = window.localStorage.getItem(cfg.key);
      if (!raw) continue;
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    for (const rec of extractRecordItems(parsed)) {
      const titleRaw =
        rec.title ?? rec.name ?? rec.fullName ?? rec.companyName ?? rec.filename ?? rec.content ?? '';
      if (typeof titleRaw !== 'string' || !titleRaw.trim()) continue;
      const baseTitle = titleRaw.trim().slice(0, 72);
      const code = typeof rec.code === 'string' && rec.code.trim() ? rec.code.trim() : '';
      const label = code ? `${code} · ${baseTitle}` : baseTitle;
      const extra = [rec.email, rec.assigneeName, rec.department, rec.description, rec.owner]
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .join(' ');
      if (!matchesText(`${label} ${cfg.hint} ${extra}`, needle)) continue;

      const recId = typeof rec.id === 'string' ? rec.id : label;
      const itemId = `local-${cfg.key}-${recId}`;
      if (seen.has(itemId)) continue;
      seen.add(itemId);

      const iconNode =
        cfg.kind === 'task' ? (
          <SquareCheck size={16} strokeWidth={1.7} aria-hidden="true" />
        ) : cfg.kind === 'folder' ? (
          <Folder size={16} strokeWidth={1.7} aria-hidden="true" />
        ) : cfg.kind === 'user' ? (
          <Users size={16} strokeWidth={1.7} aria-hidden="true" />
        ) : (
          <FileText size={16} strokeWidth={1.7} aria-hidden="true" />
        );

      matchesList.push({
        id: itemId,
        label,
        hint: cfg.hint,
        icon: <span className="qp-row__icon qp-row__icon--amber">{iconNode}</span>,
        onSelect: () => go(cfg.href(baseTitle)),
      });

      if (matchesList.length >= 8) return matchesList;
    }
  }
  return matchesList;
}

export interface GlobalCommandHostProps {
  /** Palette visibility is shared with the shell's top bar search button. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalCommandHost({ open, onOpenChange }: GlobalCommandHostProps) {
  const router = useRouter();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState('');
  const [hits, setHits] = React.useState<Hit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [attempt, setAttempt] = React.useState(0);
  const [activeIndex, setActiveIndex] = React.useState(0);

  useCommandPaletteHotkey({ open, onOpenChange });

  const close = React.useCallback(
    (next: boolean) => {
      onOpenChange(next);
      if (!next) {
        setQuery('');
        setHits([]);
        setLoading(false);
        setError(undefined);
        setActiveIndex(0);
      }
    },
    [onOpenChange],
  );

  const closePalette = React.useCallback(() => close(false), [close]);
  useFloatingLayer(open, closePalette, true, { root: panelRef, initialFocus: inputRef });

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  React.useEffect(() => {
    const needle = query.trim();
    setError(undefined);
    setHits([]);
    if (!open || !needle) {
      setHits([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    // One request per typing burst, not per keystroke.
    const timer = setTimeout(() => {
      apiFetch(`/api/search?q=${encodeURIComponent(needle)}`, { schema: SearchResultSchema }).then(
        (result) => {
          if (!active) return;
          setHits(toHits(result.hits));
          setLoading(false);
        },
        () => {
          if (!active) return;
          setHits([]);
          setError('Chưa tìm được tài liệu từ máy chủ — vẫn hiển thị lối tắt nhanh.');
          setLoading(false);
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, open, attempt]);

  const go = React.useCallback(
    (href: string) => {
      close(false);
      router.push(href);
    },
    [close, router],
  );

  const toggleTheme = React.useCallback(() => {
    const currentTheme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    const nextLabel = currentTheme === 'dark' ? 'Sáng' : 'Tối';
    close(false);
    const toggleBtn = document.querySelector<HTMLButtonElement>('button[aria-label="Chuyển giao diện Sáng/Tối"]');
    if (toggleBtn) {
      toggleBtn.click();
    } else {
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = nextTheme;
      try {
        localStorage.setItem('qsystem-theme', nextTheme);
      } catch {}
    }
    toast.success(`Đã chuyển sang giao diện ${nextLabel}.`);
  }, [close]);

  const groups = React.useMemo<PaletteGroup[]>(() => {
    const base: PaletteGroup[] = [
      {
        id: 'recent',
        label: 'GẦN ĐÂY',
        items: [
          {
            id: 'recent-org',
            label: 'Danh bạ nhân sự',
            hint: 'QHRM',
            icon: <span className="qp-row__icon qp-row__icon--amber"><Users size={16} strokeWidth={1.7} aria-hidden="true" /></span>,
            onSelect: () => go('/org'),
          },
          {
            id: 'recent-tasks',
            label: 'Tất cả công việc',
            hint: 'QTask',
            icon: <span className="qp-row__icon qp-row__icon--amber"><SquareCheck size={16} strokeWidth={1.7} aria-hidden="true" /></span>,
            onSelect: () => go('/'),
          },
          {
            id: 'recent-project',
            label: 'Dự án QSystem Core',
            hint: 'Dự án',
            icon: <span className="qp-row__icon qp-row__icon--amber"><Folder size={16} strokeWidth={1.7} aria-hidden="true" /></span>,
            onSelect: () => go('/projects'),
          },
        ],
      },
      {
        id: 'apps',
        label: 'CHUYỂN ỨNG DỤNG',
        items: [
          {
            id: 'app-qtask',
            label: 'QTask',
            hint: 'Công việc & dự án',
            boldLabel: true,
            hasChevron: true,
            icon: <span className="qp-app-badge">k</span>,
            onSelect: () => go('/'),
          },
          {
            id: 'app-qhrm',
            label: 'QHRM',
            hint: 'Nhân sự & tổ chức',
            boldLabel: true,
            hasChevron: true,
            icon: <span className="qp-app-badge">M</span>,
            onSelect: () => go('/org'),
          },
          {
            id: 'app-qcrm',
            label: 'QCRM',
            hint: 'Khách hàng & bán hàng',
            boldLabel: true,
            hasChevron: true,
            icon: <span className="qp-app-badge">M</span>,
            onSelect: () => go('/crm'),
          },
          {
            id: 'app-qsocial',
            label: 'QSocial',
            hint: 'Giao tiếp nội bộ',
            boldLabel: true,
            hasChevron: true,
            icon: <span className="qp-app-badge">I</span>,
            onSelect: () => go('/social'),
          },
        ],
      },
      {
        id: 'actions',
        label: 'THAO TÁC NHANH',
        items: [
          {
            id: 'action-add-task',
            label: 'Tạo công việc mới',
            keywords: 'giao việc mới tạo công việc',
            icon: <span className="qp-row__icon"><Plus size={16} strokeWidth={1.7} aria-hidden="true" /></span>,
            onSelect: () => go('/?giao-viec=1'),
          },
          {
            id: 'action-add-person',
            label: 'Thêm nhân sự',
            keywords: 'thêm nhân sự mới nhân viên',
            icon: <span className="qp-row__icon"><Users size={16} strokeWidth={1.7} aria-hidden="true" /></span>,
            onSelect: () => go('/org?them-nhan-su=1'),
          },
          {
            id: 'action-toggle-theme',
            label: 'Chuyển giao diện Sáng / Tối',
            keywords: 'theme dark light sáng tối giao diện',
            icon: <span className="qp-row__icon qp-row__icon--amber"><Sun size={16} strokeWidth={1.7} aria-hidden="true" /></span>,
            onSelect: toggleTheme,
          },
        ],
      },
    ];

    if (hits.length > 0) {
      base.unshift({
        id: 'documents',
        label: 'TÀI LIỆU',
        items: hits.map((hit) => ({
          id: `hit-${hit.id}`,
          label: hit.title,
          hint: 'Tài liệu',
          icon: <span className="qp-row__icon qp-row__icon--amber"><FileText size={16} strokeWidth={1.7} aria-hidden="true" /></span>,
          onSelect: () => go(`/files?q=${encodeURIComponent(hit.title)}`),
        })),
      });
    }

    const localHits = searchWorkspaceRecords(query, go);
    if (localHits.length > 0) {
      base.unshift({
        id: 'workspace-local',
        label: 'DỮ LIỆU WORKSPACE',
        items: localHits,
      });
    }

    return base
      .map((group) => ({
        ...group,
        items:
          group.id === 'documents' || group.id === 'workspace-local'
            ? group.items
            : group.items.filter((item) => matches(item, query)),
      }))
      .filter((group) => group.items.length > 0);
  }, [go, hits, query, toggleTheme]);

  const flat = React.useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const currentIndex = Math.min(activeIndex, Math.max(0, flat.length - 1));

  if (!open || typeof document === 'undefined') return null;

  const select = (item: PaletteItem | undefined) => {
    if (!item) return;
    item.onSelect();
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (flat.length === 0) return;
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((index) => (index + delta + flat.length) % flat.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      select(flat[currentIndex]);
    }
  };

  const headingId = 'qp-cmdk-title';
  let optionIndex = -1;

  return createPortal(
    <div
      className="qp-overlay animate__animated animate__fadeIn animate__faster"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close(false);
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="qp-modal animate__animated animate__fadeIn animate__faster"
      >
        <h2 id={headingId} className="qp-visually-hidden">
          Tìm nhanh
        </h2>

        <div className="qp-search">
          <Search className="qp-search__icon" size={17} strokeWidth={1.7} aria-hidden="true" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls="qp-cmdk-list"
            aria-autocomplete="list"
            aria-label="Tìm công việc, nhân sự, tài liệu hoặc ứng dụng"
            aria-activedescendant={flat[currentIndex] ? `qp-cmdk-option-${flat[currentIndex].id}` : undefined}
            className="qp-input"
            placeholder="Tìm công việc, nhân sự, tài liệu hoặc ứng dụng..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          <span className="qp-esc" aria-hidden="true">ESC</span>
        </div>

        {error ? (
          <div className="qp-recovery animate__animated animate__shakeX animate__faster">
            <p role="alert">{error}</p>
            <button
              type="button"
              className="qx-btn qx-btn--sm"
              disabled={loading}
              onClick={() => { if (!loading) setAttempt((value) => value + 1); }}
            >
              Thử lại
            </button>
          </div>
        ) : null}

        <div id="qp-cmdk-list" role="listbox" aria-label="Kết quả tìm nhanh" className="qp-results">
          {loading ? <p className="qp-status">Đang tìm kiếm…</p> : null}
          {!loading && !error && flat.length === 0 ? (
            <p className="qp-status">Không tìm thấy kết quả</p>
          ) : null}
          {groups.map((group) => (
            <div key={group.id} className="qp-group" role="group" aria-labelledby={`qp-group-${group.id}`}>
              <p id={`qp-group-${group.id}`} className="qp-group__label">
                {group.label}
              </p>
              {group.items.map((item) => {
                optionIndex += 1;
                const selected = optionIndex === currentIndex;
                return (
                  <div
                    key={item.id}
                    id={`qp-cmdk-option-${item.id}`}
                    role="option"
                    aria-selected={selected ? 'true' : 'false'}
                    className={selected ? 'qp-row is-active' : 'qp-row'}
                    onMouseMove={() => setActiveIndex(flat.indexOf(item))}
                    onClick={() => select(item)}
                  >
                    <span className="qp-row__slot" aria-hidden="true">{item.icon}</span>
                    <span className={item.boldLabel ? 'qp-row__label qp-row__label--bold' : 'qp-row__label'}>
                      {item.label}
                    </span>
                    {item.hint || item.hasChevron ? (
                      <span className="qp-row__hint">
                        {item.hint}
                        {item.hasChevron ? <ChevronRight size={14} strokeWidth={1.6} aria-hidden="true" /> : null}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="qp-footer" aria-hidden="true">
          <div className="qp-footer__hints">
            <span>↑ ↓ Di chuyển</span>
            <span>Enter để mở</span>
            <span>ESC để đóng</span>
          </div>
          <span className="qp-footer__brand">QSystem Command</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
