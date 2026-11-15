import * as React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
}

function variantClass(variant: ButtonVariant): string {
  switch (variant) {
    case 'secondary':
      return 'qs-btn qs-btn--secondary';
    case 'ghost':
      return 'qs-btn qs-btn--ghost';
    case 'danger':
      return 'qs-btn qs-btn--danger';
    case 'primary':
    default:
      return 'qs-btn qs-btn--primary';
  }
}

function sizeClass(size: ButtonSize): string {
  return `qs-btn--${size}`;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    type = 'button',
    disabled = false,
    loading = false,
    loadingText,
    children,
    onClick,
    className,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  const content = loading && loadingText ? loadingText : children;

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    if (isDisabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  const classes = [variantClass(variant), sizeClass(size), loading ? 'is-loading' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-disabled={isDisabled ? 'true' : undefined}
      aria-busy={loading ? 'true' : undefined}
      data-variant={variant}
      data-size={size}
      className={classes}
      onClick={handleClick}
      {...rest}
    >
      {loading ? <span aria-hidden="true" className="qs-btn__spinner" /> : null}
      <span className="qs-btn__label">{content}</span>
    </button>
  );
});
