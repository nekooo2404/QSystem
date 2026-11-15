import * as React from 'react';

export interface LoadingSkeletonProps {
  /** Number of placeholder rows; match the table density you are standing in for. */
  rows?: number;
  label?: string;
}

export function LoadingSkeleton({ rows = 5, label = 'Đang tải dữ liệu' }: LoadingSkeletonProps) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="qs-skeleton-region">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="qs-skeleton" aria-hidden="true" />
      ))}
    </div>
  );
}

export interface EmptyStateProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="qs-state-region qs-state-region--empty" data-state="empty">
      <p className="qs-state-region__title">{title}</p>
      {description ? <p className="qs-state-region__description">{description}</p> : null}
      {action ? <div className="qs-state-region__action">{action}</div> : null}
    </div>
  );
}

export interface ErrorStateProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = 'Không tải được nội dung',
  description,
  onRetry,
  retryLabel = 'Thử lại',
}: ErrorStateProps) {
  return (
    <div role="alert" className="qs-state-region qs-state-region--error" data-state="error">
      <p className="qs-state-region__title">{title}</p>
      {description ? <p className="qs-state-region__description">{description}</p> : null}
      {onRetry ? (
        <button type="button" className="qs-btn qs-btn--secondary qs-btn--sm" onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

export type StateRegionState = 'loading' | 'empty' | 'error' | 'ready';

export interface StateRegionProps {
  state: StateRegionState;
  rows?: number;
  emptyTitle?: React.ReactNode;
  emptyDescription?: React.ReactNode;
  errorDescription?: React.ReactNode;
  onRetry?: () => void;
  children?: React.ReactNode;
}

/** One switch for the four states every data region has, so screens never invent their own. */
export function StateRegion({
  state,
  rows,
  emptyTitle = 'Chưa có dữ liệu',
  emptyDescription,
  errorDescription,
  onRetry,
  children,
}: StateRegionProps) {
  if (state === 'loading') return <LoadingSkeleton rows={rows} />;
  if (state === 'empty') return <EmptyState title={emptyTitle} description={emptyDescription} />;
  if (state === 'error') return <ErrorState description={errorDescription} onRetry={onRetry} />;
  return <>{children}</>;
}
