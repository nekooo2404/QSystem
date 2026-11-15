import * as React from 'react';

export interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {}

export function Form({ children, ...rest }: FormProps) {
  return <form {...rest}>{children}</form>;
}

export interface FormFieldProps {
  name: string;
  label: React.ReactNode;
  error?: string | boolean;
  helperText?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactElement;
}

function useFieldId(name: string): string {
  const raw = React.useId();
  const clean = React.useMemo(() => raw.replace(/[^a-zA-Z0-9_-]/g, ''), [raw]);
  return `${name}-field-${clean}`;
}

export function FormField({
  name,
  label,
  error,
  helperText,
  required = false,
  disabled = false,
  className,
  children,
}: FormFieldProps) {
  const inputId = useFieldId(name);
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  const errorMessage = typeof error === 'string' ? error : undefined;
  const hasError = Boolean(errorMessage ?? (error === true ? true : false));

  const child = React.Children.only(children) as React.ReactElement<Record<string, unknown>>;
  // Merge, never overwrite: a child that already points at its own hint keeps it.
  const describedBy = [
    child.props['aria-describedby'],
    helperText ? helperId : null,
    errorMessage ? errorId : null,
  ]
    .filter(Boolean)
    .join(' ');

  // Honor an id the child already set: label htmlFor must match it.
  const resolvedId = (child.props.id as string | undefined) || inputId;
  const injected = React.isValidElement(child)
    ? React.cloneElement(child, {
        id: resolvedId,
        name: child.props.name ?? name,
        required: required || Boolean(child.props.required),
        disabled: disabled || Boolean(child.props.disabled),
        'aria-invalid': hasError ? 'true' : undefined,
        'aria-describedby': describedBy || undefined,
      })
    : child;

  return (
    <div className={['qs-field', className ?? ''].filter(Boolean).join(' ')}>
      <label htmlFor={resolvedId} className="qs-field__label">
        {label}
        {required ? (
          <span aria-hidden="true" className="qs-field__required">
            {' *'}
          </span>
        ) : null}
      </label>
      {injected}
      {helperText ? (
        <p id={helperId} className="qs-field__helper">
          {helperText}
        </p>
      ) : null}
      {errorMessage ? (
        <p id={errorId} role="alert" className="qs-field__error">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
