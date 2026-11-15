'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFloatingLayer } from './layer';

export type ResponsiveDetailDrawerMode = 'auto' | 'inline' | 'overlay';

export interface ResponsiveDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** `auto` = inline at >= 1280px, overlay below that. */
  mode?: ResponsiveDetailDrawerMode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Split viewport: innerWidth covers the media-query change, mocked viewports and jsdom alike. */
function useSplitViewport() {
  const [wide, setWide] = React.useState(() => typeof window === 'undefined' || window.innerWidth >= 1280);

  React.useEffect(() => {
    const update = () => setWide(window.innerWidth >= 1280);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return wide;
}

export function ResponsiveDetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  mode = 'auto',
  children,
  footer,
}: ResponsiveDetailDrawerProps) {
  const wide = useSplitViewport();
  const overlay = open && (mode === 'overlay' || (mode === 'auto' && !wide));
  const panelRef = React.useRef<HTMLElement>(null);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    if (open) previouslyFocused.current = document.activeElement as HTMLElement | null;
  }, [open]);
  const handleClose = React.useCallback(() => {
    onClose();
    if (!overlay) previouslyFocused.current?.focus();
  }, [onClose, overlay]);
  useFloatingLayer(overlay, onClose, true, { root: panelRef, returnFocus: previouslyFocused,
    fallbackFocus: () => document.querySelector<HTMLElement>('[aria-selected="true"], main') });

  if (!open) return null;

  const body = (
    <>
      <header className="qs-drawer__header">
        <div className="qs-drawer__heading">
          {subtitle ? <p className="qs-drawer__subtitle">{subtitle}</p> : null}
          <h2 className="qs-drawer__title" id={titleId}>
            {title}
          </h2>
        </div>
        <button type="button" className="qs-drawer__close" aria-label="Đóng chi tiết" onClick={handleClose}>
          <X size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </header>
      <div className="qs-drawer__body">{children}</div>
      {footer ? <footer className="qs-drawer__footer">{footer}</footer> : null}
    </>
  );

  if (!overlay) {
    return (
      <section
        ref={panelRef as React.RefObject<HTMLElement>}
        role="region"
        aria-labelledby={titleId}
        className="qs-drawer qs-drawer--inline"
      >
        {body}
      </section>
    );
  }

  return createPortal(
    <div className="qs-drawer__overlay">
      <div className="qs-drawer__backdrop" aria-hidden="true" onClick={handleClose} />
      <section
        ref={panelRef as React.RefObject<HTMLElement>}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="qs-drawer qs-drawer--overlay"
      >
        {body}
      </section>
    </div>,
    document.body,
  );
}
