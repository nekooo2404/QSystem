import * as React from 'react';

/**
 * One stack for every floating layer. Escape reaches only the top layer, and
 * the scroll lock lifts when the last locking layer closes — per-component
 * listeners both closed on one Escape and left `overflow: hidden` behind.
 */
interface LayerOptions {
  root?: React.RefObject<HTMLElement | null>;
  initialFocus?: React.RefObject<HTMLElement | null>;
  returnFocus?: React.RefObject<HTMLElement | null>;
  fallbackFocus?: () => HTMLElement | null;
}
interface Layer {
  onEscape: () => void;
  modal: boolean;
  options: React.MutableRefObject<LayerOptions>;
  invoker: HTMLElement | null;
  lastFocus: HTMLElement | null;
}

const stack: Layer[] = [];
let overflowBefore = '';
let hadLock = false;
const inerted = new Map<HTMLElement, { inert: string | null; hidden: string | null }>();
const selector = 'a[href],button,input,select,textarea,[tabindex]';

function usable(el: HTMLElement | null): el is HTMLElement {
  if (!el?.isConnected || el.closest('[inert],[hidden],[aria-hidden="true"]')) return false;
  for (let ancestor: HTMLElement | null = el; ancestor; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return !el.matches(':disabled');
}
function root(layer: Layer) { return layer.options.current.root?.current ?? null; }
function modal() { return [...stack].reverse().find(layer => layer.modal && root(layer)); }
function roots(layer: Layer) {
  return stack.slice(stack.indexOf(layer)).map(root).filter((el): el is HTMLElement => !!el);
}
function tabbables(layer: Layer) {
  return [...new Set(roots(layer).flatMap(el => Array.from(el.querySelectorAll<HTMLElement>(selector))))]
    .filter(el => usable(el) && el.tabIndex >= 0);
}
function focusInside(layer: Layer) {
  const target = [layer.lastFocus, layer.options.current.initialFocus?.current ?? null, ...tabbables(layer), root(layer)]
    .find(el => usable(el) && roots(layer).some(r => r === el || r.contains(el)));
  target?.focus();
}
function syncOverflow() {
  inerted.forEach((before, el) => {
    if (before.inert === null) el.removeAttribute('inert'); else el.setAttribute('inert', before.inert);
    if (before.hidden === null) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', before.hidden);
  });
  inerted.clear();
  const locking = stack.some(layer => layer.modal);
  if (locking && !hadLock) overflowBefore = document.body.style.overflow;
  if (locking || hadLock) document.body.style.overflow = locking ? 'hidden' : overflowBefore;
  hadLock = locking;
  const owner = modal();
  if (!owner) return;
  const allowed = roots(owner);
  const visit = (parent: HTMLElement) => {
    for (const child of Array.from(parent.children)) {
      if (!(child instanceof HTMLElement) || child.matches('script,style,link')) continue;
      if (allowed.includes(child)) continue;
      if (allowed.some(el => child.contains(el))) visit(child);
      else {
        inerted.set(child, { inert: child.getAttribute('inert'), hidden: child.getAttribute('aria-hidden') });
        child.setAttribute('inert', '');
        child.setAttribute('aria-hidden', 'true');
      }
    }
  };
  visit(document.body);
}
function handleFocus(event: FocusEvent) {
  const owner = modal();
  if (!owner) return;
  const target = event.target as HTMLElement;
  if (roots(owner).some(el => el.contains(target))) owner.lastFocus = target;
  else focusInside(owner);
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    const top = stack[stack.length - 1];
    if (!top) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    top.onEscape();
  } else if (event.key === 'Tab') {
    const owner = modal();
    if (!owner) return;
    const items = tabbables(owner);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (!items.length || index === -1 || (event.shiftKey ? index === 0 : index === items.length - 1)) {
      event.preventDefault();
      (event.shiftKey ? items[items.length - 1] : items[0])?.focus();
      if (!items.length) root(owner)?.focus();
    }
  }
}

export function useFloatingLayer(active: boolean, onEscape: () => void, lockScroll = false, options: LayerOptions = {}) {
  // The handler closes over state that changes every render; the stack keeps
  // a stable wrapper so a re-render never reshuffles layering order.
  const escapeRef = React.useRef(onEscape);
  escapeRef.current = onEscape;
  const optionsRef = React.useRef(options);
  optionsRef.current = options;
  // Effect replay can detach the root ref before cleanup. Keep the original
  // invoker for the entire opening, rather than recapturing a dialog control.
  const invokerRef = React.useRef<{ element: HTMLElement | null } | null>(null);
  if (!active) invokerRef.current = null;

  React.useEffect(() => {
    if (!active) return;
    if (stack.length === 0) {
      document.addEventListener('keydown', handleKeyDown, true);
      document.addEventListener('focusin', handleFocus, true);
    }
    invokerRef.current ??= { element: optionsRef.current.returnFocus?.current ?? document.activeElement as HTMLElement };
    const layer: Layer = { onEscape: () => escapeRef.current(), modal: lockScroll, options: optionsRef,
      invoker: invokerRef.current.element, lastFocus: null };
    stack.push(layer);
    stack.sort((a, b) => root(a) && root(b) && root(a) !== root(b)
      ? root(a)!.contains(root(b)) ? -1 : root(b)!.contains(root(a)) ? 1 : 0 : 0);
    syncOverflow();
    if (lockScroll && modal() === layer) focusInside(layer);

    return () => {
      const wasTop = stack[stack.length - 1] === layer;
      const focused = document.activeElement as HTMLElement;
      const ownedFocus = focused === document.body || !focused?.isConnected || !!root(layer)?.contains(focused);
      stack.splice(stack.indexOf(layer), 1);
      // A page unmounts its layers in any order, so always put the real
      // overflow back once the last lock is gone instead of trusting order.
      syncOverflow();
      if (wasTop && ownedFocus) {
        const target = usable(layer.invoker) ? layer.invoker : optionsRef.current.fallbackFocus?.();
        const owner = modal();
        if (owner && !roots(owner).some(el => target && el.contains(target))) focusInside(owner);
        else if (usable(target ?? null)) target!.focus();
      }
      if (!stack.length) {
        document.removeEventListener('keydown', handleKeyDown, true);
        document.removeEventListener('focusin', handleFocus, true);
      }
    };
  }, [active, lockScroll]);
}
