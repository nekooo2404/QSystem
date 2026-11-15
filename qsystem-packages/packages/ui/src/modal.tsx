'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useFloatingLayer } from './layer';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modal?: boolean;
  children: React.ReactNode;
}

const ModalContext = React.createContext<{ close: () => void; modal: boolean }>({
  close: () => {},
  modal: true,
});

function useModalContext() {
  return React.useContext(ModalContext);
}

let dialogIdCounter = 0;
function useDialogIds() {
  const ref = React.useRef<string | null>(null);
  if (!ref.current) {
    dialogIdCounter += 1;
    ref.current = `qs-dialog-${dialogIdCounter}`;
  }
  return ref.current;
}

export function Modal({ open, onOpenChange, modal = true, children }: ModalProps) {
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  const value = React.useMemo(() => ({ close, modal }), [close, modal]);
  if (!open) return null;
  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
}

export function ModalContent({ children }: { children: React.ReactNode }) {
  const ctx = useModalContext();
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const dialogBaseId = useDialogIds();
  const close = ctx.close;
  const modal = ctx.modal;

  // A stacked dialog must not steal Escape from the one on top of it.
  useFloatingLayer(true, () => close?.(), modal, { root: dialogRef });

  React.useEffect(() => {

    const title = dialogRef.current?.querySelector('[data-qs-modal-title]');
    const description = dialogRef.current?.querySelector('[data-qs-modal-description]');
    if (title && dialogRef.current) {
      if (!title.id) title.id = `${dialogBaseId}-title`;
      dialogRef.current.setAttribute('aria-labelledby', title.id);
    }
    if (description && dialogRef.current) {
      if (!description.id) description.id = `${dialogBaseId}-description`;
      dialogRef.current.setAttribute('aria-describedby', description.id);
    }

  }, [dialogBaseId]);

  const overlay = (
    <div
      className="qs-modal__overlay"
      data-qs-modal-overlay=""
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close?.();
      }}
    >
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal={modal ? 'true' : 'false'} className="qs-modal__dialog">
        <button type="button" data-qs-modal-close="" aria-label="Đóng hộp thoại" onClick={() => close?.()}>
          ×
        </button>
        {children}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

export function ModalHeader({ children }: { children: React.ReactNode }) {
  return <div className="qs-modal__header">{children}</div>;
}

export function ModalTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 data-qs-modal-title="" className="qs-modal__title">
      {children}
    </h2>
  );
}

export function ModalDescription({ children }: { children: React.ReactNode }) {
  return (
    <p data-qs-modal-description="" className="qs-modal__description">
      {children}
    </p>
  );
}

export function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="qs-modal__footer">{children}</div>;
}
