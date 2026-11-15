'use client';

import * as React from 'react';
import { Box, Check, ChevronDown, Contact, ListChecks, MessageSquare, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useFloatingLayer } from './layer';

export interface AppModuleItem {
  id: string;
  name: string;
  description: string;
  icon?: LucideIcon;
}

export interface ModuleSwitcherProps {
  activeModuleId: string;
  modules: AppModuleItem[];
  onSelectModule: (id: string) => void;
}

const fallbackIcons: Record<string, LucideIcon> = {
  qtask: ListChecks,
  qhrm: Users,
  qcrm: Contact,
  qsocial: MessageSquare,
};

/** Brand row + the module menu that sits under it in the sidebar. */
export function ModuleSwitcher({ activeModuleId, modules, onSelectModule }: ModuleSwitcherProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const active = modules.find((module) => module.id === activeModuleId) ?? modules[0];

  const close = React.useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useFloatingLayer(open, close, false, { root: wrapperRef });

  React.useEffect(() => {
    if (open) wrapperRef.current?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"], [role="menuitemradio"]')?.focus();
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    return () => document.removeEventListener('mousedown', handlePointer);
  }, [open]);

  return (
    <div className="qs-module-switcher" ref={wrapperRef}>
      <div className="qs-module-switcher__brand">
        <span className="qs-module-switcher__mark" aria-hidden="true">
          Q
        </span>
        <span className="qs-module-switcher__brand-name">QSystem</span>
      </div>
      <div className="qs-module-switcher__control">
        <button
          ref={triggerRef}
          type="button"
          className="qs-module-switcher__trigger"
          aria-expanded={open ? 'true' : 'false'}
          aria-haspopup="menu"
          onClick={() => setOpen((value) => !value)}
          onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); } }}
        >
          <span className="qs-module-switcher__trigger-name">{active?.name}</span>
          <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
        {open ? (
          <div role="menu" aria-label="Chọn ứng dụng" className="qs-switcher__menu" onKeyDown={(event) => {
            const items = Array.from(wrapperRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []);
            const index = items.indexOf(document.activeElement as HTMLElement);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (index + 1) % items.length : event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length : -1;
            if (next >= 0) { event.preventDefault(); items[next]?.focus(); }
            if (event.key === 'Tab') setTimeout(() => setOpen(false), 0);
          }}>
            {modules.map((module) => {
              const Icon = module.icon ?? fallbackIcons[module.id] ?? Box;
              const checked = module.id === activeModuleId;
              return (
                <button
                  key={module.id}
                  type="button"
                  role="menuitemradio"
                  tabIndex={-1}
                  aria-checked={checked ? 'true' : 'false'}
                  className={checked ? 'qs-switcher__item is-active' : 'qs-switcher__item'}
                  onClick={() => {
                    setOpen(false);
                    onSelectModule(module.id);
                  }}
                >
                  <Icon size={18} strokeWidth={1.5} aria-hidden="true" className="qs-switcher__icon" />
                  <span className="qs-switcher__text">
                    <span className="qs-switcher__name">{module.name}</span>
                    <span className="qs-switcher__description">{module.description}</span>
                  </span>
                  {checked ? <Check size={16} strokeWidth={1.5} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
