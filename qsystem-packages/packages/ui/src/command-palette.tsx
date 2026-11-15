'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { Button } from './button';
import { LoadingSkeleton } from './state-region';
import { useFloatingLayer } from './layer';

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  onSelect?: () => void;
}

export interface CommandGroup {
  id: string;
  label: string;
  items: CommandItem[];
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
  groups: CommandGroup[];
  loading?: boolean;
  /** Shown when the query matches nothing. */
  emptyText?: string;
  errorText?: string;
  onRetry?: () => void;
}

const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/**
 * Global Ctrl+K / Cmd+K. Skipped for IME composing keydowns and while the user
 * types in a field, so Vietnamese input and table J/K never open the palette.
 */
export function useCommandPaletteHotkey({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return;
      const target = event.target as Element | null;
      if (target?.closest?.(EDITABLE_SELECTOR)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);
}

function matches(item: CommandItem, query: string) {
  if (!query) return true;
  const needle = query.trim().toLowerCase();
  return `${item.label} ${item.hint ?? ''}`.toLowerCase().includes(needle);
}

export function CommandPalette({
  open,
  onOpenChange,
  query,
  onQueryChange,
  groups,
  loading = false,
  emptyText = 'Không tìm thấy kết quả',
  errorText,
  onRetry,
}: CommandPaletteProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);

  const visibleGroups = React.useMemo(
    () =>
      groups
        .map((group) => ({ ...group, items: group.items.filter((item) => matches(item, query)) }))
        .filter((group) => group.items.length > 0),
    [groups, query],
  );
  const flat = visibleGroups.flatMap((group) => group.items);
  const currentIndex = Math.min(activeIndex, Math.max(0, flat.length - 1));

  React.useEffect(() => setActiveIndex(0), [query, open]);

  const closePalette = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  useFloatingLayer(open, closePalette, true, { root: panelRef, initialFocus: inputRef });

  if (!open) return null;

  const select = (item: CommandItem | undefined) => {
    if (!item) return;
    item.onSelect?.();
    onOpenChange(false);
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

  const headingId = 'qs-cmdk-title';
  let optionIndex = -1;

  return createPortal(
    <div
      className="qs-cmdk__overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={headingId} className="qs-cmdk__panel">
        <h2 id={headingId} className="qs-visually-hidden">
          Tìm nhanh
        </h2>
        <div className="qs-cmdk__search">
          <Search size={18} strokeWidth={1.5} aria-hidden="true" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls="qs-cmdk-list"
            aria-autocomplete="list"
            aria-label="Tìm việc, nhân sự, tài liệu"
            aria-activedescendant={!loading && flat[currentIndex] ? `qs-cmdk-option-${flat[currentIndex].id}` : undefined}
            className="qs-cmdk__input"
            placeholder="Tìm việc, nhân sự, tài liệu…"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={handleInputKeyDown}
          />
        </div>
        {errorText ? <div className="qs-cmdk__recovery"><p role="alert">{errorText}</p><Button variant="secondary" onClick={onRetry} disabled={loading}>Thử lại</Button></div> : null}
        <div id="qs-cmdk-list" role="listbox" aria-label="Kết quả tìm nhanh" className="qs-cmdk__results">
          {loading ? <LoadingSkeleton rows={3} /> : null}
          {!loading && !errorText && flat.length === 0 ? <p className="qs-cmdk__empty">{emptyText}</p> : null}
          {!loading
            ? visibleGroups.map((group) => (
                <div key={group.id} className="qs-cmdk__group">
                  <p className="qs-cmdk__group-label" aria-hidden="true">
                    {group.label}
                  </p>
                  {group.items.map((item) => {
                    optionIndex += 1;
                    const selected = optionIndex === currentIndex;
                    return (
                      <div
                        key={item.id}
                        id={`qs-cmdk-option-${item.id}`}
                        role="option"
                        aria-selected={selected ? 'true' : 'false'}
                        className={selected ? 'qs-cmdk__option is-active' : 'qs-cmdk__option'}
                        onMouseMove={() => setActiveIndex(flat.indexOf(item))}
                        onClick={() => select(item)}
                      >
                        {item.icon ? (
                          <span className="qs-cmdk__option-icon" aria-hidden="true">
                            {item.icon}
                          </span>
                        ) : null}
                        <span className="qs-cmdk__option-label">{item.label}</span>
                        {item.hint ? <span className="qs-cmdk__option-hint">{item.hint}</span> : null}
                      </div>
                    );
                  })}
                </div>
              ))
            : null}
        </div>
        <div className="qs-cmdk__footer" aria-hidden="true">
          <span>↑↓ di chuyển</span>
          <span>↵ mở</span>
          <span>Esc đóng</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
