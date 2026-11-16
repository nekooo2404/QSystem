import { LoadingSkeleton } from '@qsystem/ui';

export default function WorkspaceLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Đang tải không gian làm việc"
      style={{
        padding: '24px',
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'grid',
        gap: '16px',
        width: '100%',
      }}
    >
      <div
        style={{
          background: 'var(--qs-surface-1)',
          border: '1px solid var(--qs-border)',
          borderRadius: '10px',
          padding: '20px',
        }}
      >
        <LoadingSkeleton rows={6} label="Đang tải không gian làm việc" />
      </div>
    </div>
  );
}
