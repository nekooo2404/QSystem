'use client';

import * as React from 'react';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error' | 'default';
export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';
export type ToastTheme = 'light' | 'dark' | 'system';

export interface ToastOptions {
  duration?: number;
  variant?: ToastVariant;
}

export interface ToastItem {
  id: number;
  message: React.ReactNode;
  variant: ToastVariant;
  /** Unset means "use the ToastRegion duration prop". */
  duration?: number;
}

interface ResolvedToast extends ToastItem {
  duration: number;
  hidden: boolean;
}

type Listener = () => void;

let nextId = 1;
let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

function push(message: React.ReactNode, variant: ToastVariant, options?: ToastOptions): number {
  const id = nextId++;
  const item: ToastItem = { id, message, variant, duration: options?.duration };
  toasts = [...toasts, item];
  notify();
  return id;
}

export function dismissToast(id?: number) {
  if (id === undefined) {
    toasts = [];
  } else {
    toasts = toasts.filter((t) => t.id !== id);
  }
  notify();
}

export interface ToastApi {
  (message: React.ReactNode, options?: ToastOptions): number;
  success(message: React.ReactNode, options?: ToastOptions): number;
  info(message: React.ReactNode, options?: ToastOptions): number;
  warning(message: React.ReactNode, options?: ToastOptions): number;
  error(message: React.ReactNode, options?: ToastOptions): number;
  dismiss(id?: number): void;
}

export const toast: ToastApi = Object.assign(
  (message: React.ReactNode, options?: ToastOptions) =>
    push(message, options?.variant ?? 'default', options),
  {
    success: (message: React.ReactNode, options?: ToastOptions) => push(message, 'success', options),
    info: (message: React.ReactNode, options?: ToastOptions) => push(message, 'info', options),
    warning: (message: React.ReactNode, options?: ToastOptions) => push(message, 'warning', options),
    error: (message: React.ReactNode, options?: ToastOptions) => push(message, 'error', options),
    dismiss: dismissToast,
  },
);

function getSnapshot(): ToastItem[] {
  return toasts;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function roleFor(variant: ToastVariant): 'status' | 'alert' {
  return variant === 'success' || variant === 'default' ? 'status' : 'alert';
}

function ToastCard({ item }: { item: ResolvedToast }) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadline = React.useRef(0);
  const remaining = React.useRef(item.duration);
  // Hover and focus are tracked separately: leaving with the pointer must not
  // resume while the card (or its dismiss button) still holds focus.
  const hovering = React.useRef(false);
  const focused = React.useRef(false);

  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const start = React.useCallback(() => {
    clear();
    if (item.duration <= 0) return;
    deadline.current = Date.now() + remaining.current;
    timer.current = setTimeout(() => dismissToast(item.id), remaining.current);
  }, [item.duration, item.id]);

  // Re-running for a changed `duration` prop restarts from the new value, so
  // the region's `duration` prop takes effect on already-mounted toasts.
  React.useEffect(() => {
    remaining.current = item.duration;
    start();
    return clear;
  }, [item.duration, start]);

  // Hold/resume work off "is a timer running", so repeated enter/leave events
  // never hand the toast a fresh full duration.
  const syncHold = React.useCallback(() => {
    if (hovering.current || focused.current) {
      if (timer.current) {
        clear();
        remaining.current = Math.max(0, deadline.current - Date.now());
      }
      return;
    }
    if (!timer.current && remaining.current > 0) start();
  }, [start]);

  const onPointerEnter = React.useCallback(() => {
    hovering.current = true;
    syncHold();
  }, [syncHold]);
  const onPointerLeave = React.useCallback(() => {
    hovering.current = false;
    syncHold();
  }, [syncHold]);
  const onFocusIn = React.useCallback(() => {
    focused.current = true;
    syncHold();
  }, [syncHold]);
  const onFocusOut = React.useCallback((event: FocusEvent) => {
    if (cardRef.current?.contains(event.relatedTarget as Node)) return;
    focused.current = false;
    syncHold();
  }, [syncHold]);

  // Native listeners: pointerenter/pointerleave do not bubble, so React's
  // synthetic handlers (root-delegated) never see natively-dispatched events.
  React.useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    node.addEventListener('pointerenter', onPointerEnter);
    node.addEventListener('pointerleave', onPointerLeave);
    node.addEventListener('focusin', onFocusIn);
    node.addEventListener('focusout', onFocusOut);
    return () => {
      node.removeEventListener('pointerenter', onPointerEnter);
      node.removeEventListener('pointerleave', onPointerLeave);
      node.removeEventListener('focusin', onFocusIn);
      node.removeEventListener('focusout', onFocusOut);
    };
  }, [onPointerEnter, onPointerLeave, onFocusIn, onFocusOut]);

  return (
    <div
      ref={cardRef}
      role={roleFor(item.variant)}
      data-variant={item.variant}
      hidden={item.hidden}
      className="qs-toast"
    >
      <span className="qs-toast__message">{item.message}</span>
      <button type="button" aria-label="Đóng thông báo" onClick={() => dismissToast(item.id)}>
        ×
      </button>
    </div>
  );
}

export interface ToastRegionProps {
  position?: ToastPosition;
  theme?: ToastTheme;
  visibleToasts?: number;
  duration?: number;
  richColors?: boolean;
  closeButton?: boolean;
  expand?: boolean;
  className?: string;
}

export function ToastRegion({
  position = 'bottom-right',
  theme = 'system',
  visibleToasts = 3,
  duration = 4000,
  richColors,
  closeButton,
  expand,
  className,
}: ToastRegionProps) {
  const items = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const maxVisible = Math.max(1, visibleToasts);
  const hiddenCount = Math.max(0, items.length - maxVisible);
  // Render every toast so hidden ones keep their auto-dismiss timers running;
  // only the oldest `hiddenCount` are marked hidden (out of the visible window).
  const resolved: ResolvedToast[] = items.map((item, i) => ({
    ...item,
    duration: item.duration ?? duration,
    hidden: i < hiddenCount,
  }));

  return (
    <div
      role="region"
      aria-label="Thông báo"
      data-position={position}
      data-theme={theme}
      data-rich-colors={richColors ? 'true' : undefined}
      data-close-button={closeButton ? 'true' : undefined}
      data-expand={expand ? 'true' : undefined}
      className={['qs-toast-region', className ?? ''].filter(Boolean).join(' ')}
    >
      {resolved.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  );
}
