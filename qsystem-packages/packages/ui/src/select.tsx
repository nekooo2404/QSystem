'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { useFloatingLayer } from './layer';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string = string> {
  id?: string;
  name?: string;
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  controlSize?: 'sm' | 'md' | 'lg';
  className?: string;
  menuClassName?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

interface MenuPosition {
  placement: 'top' | 'bottom';
  top?: number;
  bottom?: number;
  left: number;
  minWidth?: number;
  maxHeight: number;
}

const VIEWPORT_PADDING = 8;
const MENU_OFFSET = 4;
const MAX_MENU_HEIGHT = 280;
const ESTIMATED_OPTION_HEIGHT = 40;
const TYPEAHEAD_TIMEOUT_MS = 500;

function normalizeTypeahead(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim()
    .toLowerCase();
}

function isBackdropTarget(target: Node): boolean {
  return (
    target instanceof Element &&
    target.matches('[data-qs-modal-overlay], .qs-drawer__backdrop, .qs-shell__nav-backdrop, .qs-cmdk__overlay')
  );
}

function suppressNextBackdropClick(originEvent: MouseEvent): void {
  const cleanup = (event?: Event) => {
    if (event === originEvent) return;
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('mousedown', cleanup, true);
    document.removeEventListener('keydown', cleanup, true);
  };

  const handleClick = (event: MouseEvent) => {
    const target = event.target as Node | null;
    if (target && isBackdropTarget(target)) {
      event.stopPropagation();
      event.preventDefault();
    }
    cleanup();
  };

  document.addEventListener('click', handleClick, true);
  document.addEventListener('mousedown', cleanup, true);
  document.addEventListener('keydown', cleanup, true);
}

export function Select<T extends string = string>({
  id,
  name,
  value,
  onValueChange,
  options,
  placeholder,
  disabled = false,
  error = false,
  controlSize = 'md',
  className,
  menuClassName,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  ...rest
}: SelectProps<T>) {
  // Support FormField cloneElement injections without widening the public prop contract.
  const injected = rest as {
    required?: boolean;
    'aria-invalid'?: boolean | 'true' | 'false';
  };
  const isError = Boolean(error) || injected['aria-invalid'] === true || injected['aria-invalid'] === 'true';
  const isRequired = Boolean(injected.required);

  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [position, setPosition] = React.useState<MenuPosition | null>(null);

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const typeaheadRef = React.useRef<{ buffer: string; timer: ReturnType<typeof setTimeout> | null }>({
    buffer: '',
    timer: null,
  });

  const clearTypeahead = React.useCallback(() => {
    if (typeaheadRef.current.timer) {
      clearTimeout(typeaheadRef.current.timer);
      typeaheadRef.current.timer = null;
    }
    typeaheadRef.current.buffer = '';
  }, []);

  React.useEffect(() => clearTypeahead, [clearTypeahead]);

  const rawUid = React.useId();
  const cleanUid = React.useMemo(() => rawUid.replace(/[^a-zA-Z0-9_-]/g, ''), [rawUid]);
  const listboxId = `${id ?? `qs-select-${cleanUid}`}-listbox`;
  const getOptionId = React.useCallback((index: number) => `${listboxId}-option-${index}`, [listboxId]);

  const selectedIndex = React.useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value],
  );
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const enabledIndices = React.useMemo(
    () =>
      options.reduce<number[]>((acc, option, index) => {
        if (!option.disabled) acc.push(index);
        return acc;
      }, []),
    [options],
  );

  const resolvedActiveIndex = React.useMemo(() => {
    if (!open) return -1;
    if (activeIndex >= 0 && activeIndex < options.length && !options[activeIndex]?.disabled) {
      return activeIndex;
    }
    if (selectedIndex >= 0 && !options[selectedIndex]?.disabled) {
      return selectedIndex;
    }
    return enabledIndices[0] ?? -1;
  }, [open, activeIndex, options, selectedIndex, enabledIndices]);

  const getInitialActiveIndex = React.useCallback(
    (preferLast = false) => {
      if (selectedIndex >= 0 && !options[selectedIndex]?.disabled) {
        return selectedIndex;
      }
      if (enabledIndices.length === 0) return -1;
      return preferLast ? enabledIndices[enabledIndices.length - 1] : enabledIndices[0];
    },
    [selectedIndex, options, enabledIndices],
  );

  const openMenu = React.useCallback(
    (preferLast = false) => {
      if (disabled) return;
      setActiveIndex(getInitialActiveIndex(preferLast));
      setOpen(true);
    },
    [disabled, getInitialActiveIndex],
  );

  const closeMenu = React.useCallback(
    (restoreFocus = false) => {
      clearTypeahead();
      setOpen(false);
      setPosition(null);
      if (restoreFocus) {
        triggerRef.current?.focus();
      }
    },
    [clearTypeahead],
  );

  const closeFromEscape = React.useCallback(() => {
    closeMenu(true);
  }, [closeMenu]);

  useFloatingLayer(open, closeFromEscape, false, {
    root: menuRef,
    returnFocus: triggerRef,
  });

  React.useEffect(() => {
    if (disabled && open) {
      closeMenu(false);
    }
  }, [disabled, open, closeMenu]);

  const updatePosition = React.useCallback(() => {
    const triggerEl = triggerRef.current;
    if (!triggerEl || typeof window === 'undefined') return;

    const rect = triggerEl.getBoundingClientRect();
    const menuEl = menuRef.current;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 768;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;

    const spaceBelow = Math.max(0, viewportHeight - rect.bottom - VIEWPORT_PADDING - MENU_OFFSET);
    const spaceAbove = Math.max(0, rect.top - VIEWPORT_PADDING - MENU_OFFSET);

    const measuredHeight = menuEl ? menuEl.scrollHeight : 0;
    const fallbackHeight = Math.min(MAX_MENU_HEIGHT, Math.max(options.length, 1) * ESTIMATED_OPTION_HEIGHT + 8);
    const desiredHeight = Math.min(MAX_MENU_HEIGHT, measuredHeight > 0 ? measuredHeight : fallbackHeight);

    const shouldFlip = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
    const placement: 'top' | 'bottom' = shouldFlip ? 'top' : 'bottom';
    const availableSpace = placement === 'top' ? spaceAbove : spaceBelow;
    const maxHeight = Math.min(MAX_MENU_HEIGHT, Math.max(80, Math.round(availableSpace)));

    const triggerWidth = Math.round(rect.width);
    const measuredWidth = menuEl ? Math.ceil(menuEl.getBoundingClientRect().width) : 0;
    const effectiveWidth = Math.max(triggerWidth, measuredWidth, 160);
    const maxLeft = Math.max(VIEWPORT_PADDING, viewportWidth - effectiveWidth - VIEWPORT_PADDING);
    const left = Math.round(Math.max(VIEWPORT_PADDING, Math.min(rect.left, maxLeft)));

    if (placement === 'top') {
      setPosition({
        placement: 'top',
        bottom: Math.round(viewportHeight - rect.top + MENU_OFFSET),
        left,
        minWidth: triggerWidth > 0 ? triggerWidth : undefined,
        maxHeight,
      });
    } else {
      setPosition({
        placement: 'bottom',
        top: Math.round(rect.bottom + MENU_OFFSET),
        left,
        minWidth: triggerWidth > 0 ? triggerWidth : undefined,
        maxHeight,
      });
    }
  }, [options.length]);

  React.useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  // Keep the highlighted option visible within the listbox without scrolling outer containers.
  React.useEffect(() => {
    if (!open || resolvedActiveIndex < 0) return;
    const menuEl = menuRef.current;
    if (!menuEl) return;
    const optionEl = document.getElementById(getOptionId(resolvedActiveIndex));
    if (!optionEl || !menuEl.contains(optionEl)) return;

    const menuRect = menuEl.getBoundingClientRect();
    const optionRect = optionEl.getBoundingClientRect();
    if (optionRect.height === 0 && menuEl.clientHeight === 0) return;

    if (optionRect.top < menuRect.top) {
      menuEl.scrollTop -= menuRect.top - optionRect.top + 4;
    } else if (optionRect.bottom > menuRect.bottom) {
      menuEl.scrollTop += optionRect.bottom - menuRect.bottom + 4;
    }
  }, [open, resolvedActiveIndex, getOptionId]);

  React.useEffect(() => {
    if (!open) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      if (isBackdropTarget(target)) {
        event.stopPropagation();
        suppressNextBackdropClick(event);
      }
      closeMenu(false);
    };

    const handleScroll = (event: Event) => {
      const target = event.target;
      if (
        menuRef.current &&
        (target === menuRef.current || (target instanceof Node && menuRef.current.contains(target)))
      ) {
        return;
      }
      closeMenu(false);
    };

    const handleResize = () => {
      closeMenu(false);
    };

    document.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [open, closeMenu]);

  const selectOptionAt = React.useCallback(
    (index: number) => {
      const option = options[index];
      if (!option || option.disabled) return;
      onValueChange(option.value);
      closeMenu(true);
    },
    [options, onValueChange, closeMenu],
  );

  const stepActiveIndex = React.useCallback(
    (delta: 1 | -1) => {
      if (enabledIndices.length === 0) return;
      const currentPos = enabledIndices.indexOf(resolvedActiveIndex);
      if (currentPos === -1) {
        setActiveIndex(delta === 1 ? enabledIndices[0] : enabledIndices[enabledIndices.length - 1]);
        return;
      }
      const nextPos = (currentPos + delta + enabledIndices.length) % enabledIndices.length;
      setActiveIndex(enabledIndices[nextPos]);
    },
    [enabledIndices, resolvedActiveIndex],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (disabled) return;

    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openMenu(false);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        openMenu(true);
      } else if (event.key === 'Home') {
        event.preventDefault();
        setActiveIndex(enabledIndices[0] ?? -1);
        setOpen(true);
      } else if (event.key === 'End') {
        event.preventDefault();
        setActiveIndex(enabledIndices[enabledIndices.length - 1] ?? -1);
        setOpen(true);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      clearTypeahead();
      stepActiveIndex(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      clearTypeahead();
      stepActiveIndex(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      clearTypeahead();
      if (enabledIndices.length > 0) setActiveIndex(enabledIndices[0]);
    } else if (event.key === 'End') {
      event.preventDefault();
      clearTypeahead();
      if (enabledIndices.length > 0) setActiveIndex(enabledIndices[enabledIndices.length - 1]);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (resolvedActiveIndex >= 0) {
        selectOptionAt(resolvedActiveIndex);
      }
    } else if (event.key === 'Tab') {
      closeMenu(false);
    } else {
      if (event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing) {
        return;
      }
      if (event.key.length !== 1 || event.key === ' ') {
        return;
      }
      const ch = normalizeTypeahead(event.key);
      if (!ch) return;

      event.preventDefault();
      if (typeaheadRef.current.timer) {
        clearTimeout(typeaheadRef.current.timer);
      }
      typeaheadRef.current.buffer += ch;
      typeaheadRef.current.timer = setTimeout(() => {
        typeaheadRef.current.buffer = '';
        typeaheadRef.current.timer = null;
      }, TYPEAHEAD_TIMEOUT_MS);

      if (enabledIndices.length === 0) return;

      const buffer = typeaheadRef.current.buffer;
      const allSameChar = buffer.length > 1 && new Set(buffer).size === 1;
      const query = allSameChar ? buffer[0] : buffer;
      const currentPos = enabledIndices.indexOf(resolvedActiveIndex);
      const startPos =
        allSameChar || buffer.length === 1
          ? (currentPos + 1) % enabledIndices.length
          : Math.max(0, currentPos);

      for (let offset = 0; offset < enabledIndices.length; offset += 1) {
        const optionIndex = enabledIndices[(startPos + offset) % enabledIndices.length];
        const option = options[optionIndex];
        if (option && normalizeTypeahead(option.label).startsWith(query)) {
          setActiveIndex(optionIndex);
          break;
        }
      }
    }
  };

  const triggerClasses = [
    'qs-select',
    `qs-select--${controlSize}`,
    open ? 'is-open' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const menuClasses = ['qs-select__menu', menuClassName ?? ''].filter(Boolean).join(' ');

  const menuStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        top: position.top,
        bottom: position.bottom,
        left: position.left,
        minWidth: position.minWidth,
        maxHeight: position.maxHeight,
      }
    : {
        position: 'fixed',
        top: 0,
        left: 0,
        maxHeight: MAX_MENU_HEIGHT,
        visibility: 'hidden',
      };

  const menuNode =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            data-placement={position?.placement ?? 'bottom'}
            className={menuClasses}
            style={menuStyle}
            onMouseDown={(event) => {
              // Keep focus on the combobox trigger and stop outside-click listeners
              // on parent popovers (e.g. FilterPopover) from treating menu clicks as outside.
              event.preventDefault();
              event.stopPropagation();
            }}
            onKeyDown={handleKeyDown}
          >
            {options.length === 0 ? (
              <div className="qs-select__empty" role="presentation">
                Không có lựa chọn
              </div>
            ) : (
              options.map((option, index) => {
                const isSelected = option.value === value;
                const isActive = index === resolvedActiveIndex;
                const optionClasses = [
                  'qs-select__option',
                  isSelected ? 'is-selected' : '',
                  isActive ? 'is-active' : '',
                  option.disabled ? 'is-disabled' : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <div
                    key={option.value}
                    id={getOptionId(index)}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled ? true : undefined}
                    data-active={isActive ? 'true' : undefined}
                    className={optionClasses}
                    onMouseMove={() => {
                      if (!option.disabled && activeIndex !== index) {
                        setActiveIndex(index);
                      }
                    }}
                    onClick={() => selectOptionAt(index)}
                  >
                    <span className="qs-select__option-content">
                      <span className="qs-select__option-label">{option.label}</span>
                      {option.description ? (
                        <span className="qs-select__option-description">{option.description}</span>
                      ) : null}
                    </span>
                    {isSelected ? (
                      <Check size={16} strokeWidth={1.5} aria-hidden="true" className="qs-select__check" />
                    ) : null}
                  </div>
                );
              })
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && resolvedActiveIndex >= 0 ? getOptionId(resolvedActiveIndex) : undefined}
        aria-invalid={isError ? true : undefined}
        aria-required={isRequired ? true : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        data-error={isError ? 'true' : undefined}
        data-state={open ? 'open' : 'closed'}
        data-size={controlSize}
        className={triggerClasses}
        onClick={() => {
          if (disabled) return;
          if (open) closeMenu(false);
          else openMenu(false);
        }}
        onKeyDown={handleKeyDown}
      >
        <span className={selectedOption ? 'qs-select__value' : 'qs-select__value qs-select__placeholder'}>
          {selectedOption ? selectedOption.label : (placeholder ?? '')}
        </span>
        <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" className="qs-select__chevron" />
      </button>
      {name ? <input type="hidden" name={name} value={value} disabled={disabled} /> : null}
      {menuNode}
    </>
  );
}
