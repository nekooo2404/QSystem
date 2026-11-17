'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import { useFloatingLayer } from '@qsystem/ui';

export interface CrmRowMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerLabel: string;
  menuLabel: string;
  children: React.ReactNode;
}

const MENU_WIDTH = 208;
const MENU_EST_HEIGHT = 160;
const VIEWPORT_PAD = 8;

export function CrmRowMenu({
  open,
  onOpenChange,
  triggerLabel,
  menuLabel,
  children,
}: CrmRowMenuProps) {
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [coords, setCoords] = React.useState<{ top: number; left: number }>({
    top: VIEWPORT_PAD,
    left: VIEWPORT_PAD,
  });

  const closeMenu = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  useFloatingLayer(open, closeMenu, false, {
    root: menuRef,
    returnFocus: triggerRef,
  });

  const updateCoords = React.useCallback(() => {
    const btn = triggerRef.current;
    if (!btn || typeof window === 'undefined') return;
    const rect = btn.getBoundingClientRect();
    const vw = window.innerWidth || 1024;
    const vh = window.innerHeight || 768;
    const actualHeight = menuRef.current?.offsetHeight || MENU_EST_HEIGHT;

    const left = Math.max(
      VIEWPORT_PAD,
      Math.min(vw - MENU_WIDTH - VIEWPORT_PAD, Math.round(rect.right - MENU_WIDTH)),
    );

    const spaceBelow = vh - rect.bottom - VIEWPORT_PAD;
    const spaceAbove = rect.top - VIEWPORT_PAD;
    const placeAbove = spaceBelow < actualHeight && spaceAbove >= actualHeight;

    const rawTop = placeAbove ? rect.top - actualHeight - 4 : rect.bottom + 4;
    const top = Math.max(
      VIEWPORT_PAD,
      Math.min(vh - actualHeight - VIEWPORT_PAD, Math.round(rawTop)),
    );

    setCoords({ top, left });
  }, []);

  React.useLayoutEffect(() => {
    if (!open) return;
    updateCoords();
  }, [open, updateCoords]);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      onOpenChange(false);
    }
    function onViewportChange() {
      updateCoords();
    }
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open, onOpenChange, updateCoords]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="crm-row-more"
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => onOpenChange(!open)}
      >
        <MoreHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              className="crm-row-menu"
              role="menu"
              aria-label={menuLabel}
              style={{
                position: 'fixed',
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                width: `${MENU_WIDTH}px`,
              }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
