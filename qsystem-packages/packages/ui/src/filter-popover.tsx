'use client';

import * as React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useFloatingLayer } from './layer';

export interface FilterPopoverProps {
  children: React.ReactNode;
  label?: string;
}

/** Filter trigger + floating panel. Elevation only — the panel is a floating layer. */
export function FilterPopover({ children, label = 'Bộ lọc' }: FilterPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const close = React.useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useFloatingLayer(open, close, false, { root: wrapperRef });

  React.useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    return () => document.removeEventListener('mousedown', handlePointer);
  }, [open]);

  return (
    <div className="qs-filter-popover-anchor" ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        className="qs-btn qs-btn--secondary qs-btn--sm qs-filter-popover__trigger"
        aria-expanded={open ? 'true' : 'false'}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <SlidersHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
        {label}
      </button>
      {open ? (
        <div role="dialog" aria-label={label} className="qs-filter-popover">
          {children}
        </div>
      ) : null}
    </div>
  );
}
