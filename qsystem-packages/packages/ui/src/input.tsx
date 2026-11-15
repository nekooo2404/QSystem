import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  controlSize?: 'md' | 'lg';
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { error, controlSize = 'md', className, ...rest },
  ref,
) {
  const classes = ['qs-input', `qs-input--${controlSize}`, className ?? ''].filter(Boolean).join(' ');
  return <input ref={ref} data-error={error ? 'true' : undefined} className={classes} {...rest} />;
});
