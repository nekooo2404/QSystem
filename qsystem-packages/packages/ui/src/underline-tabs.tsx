'use client';

import * as React from 'react';

export interface UnderlineTab {
  id: string;
  label: React.ReactNode;
  /** Optional trailing count, rendered with tabular numerals. */
  count?: number;
}

export interface UnderlineTabsProps {
  tabs: UnderlineTab[];
  activeId: string;
  onChange: (id: string) => void;
  'aria-label'?: string;
}

export function UnderlineTabs({ tabs, activeId, onChange, 'aria-label': ariaLabel = 'Bộ lọc' }: UnderlineTabsProps) {
  const listRef = React.useRef<HTMLDivElement>(null);

  const focusTab = (index: number) => {
    const nodes = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    nodes?.[index]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = tabs.findIndex((tab) => tab.id === activeId);
    if (current === -1) return;
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    onChange(tabs[next].id);
    focusTab(next);
  };

  return (
    <div ref={listRef} role="tablist" aria-label={ariaLabel} className="qs-tabs" onKeyDown={handleKeyDown}>
      {tabs.map((tab) => {
        const selected = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`qs-tab-${tab.id}`}
            aria-selected={selected ? 'true' : 'false'}
            tabIndex={selected ? 0 : -1}
            className={selected ? 'qs-tabs__tab is-active' : 'qs-tabs__tab'}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {tab.count !== undefined ? <span className="qs-tabs__count">{tab.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
