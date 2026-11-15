import { LoadingSkeleton } from '@qsystem/ui';

export default function WorkspaceLoading() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--qs-bg)',
        color: 'var(--qs-fg)',
        padding: '28px 24px',
      }}
    >
      <div
        style={{
          maxWidth: '1120px',
          margin: '0 auto',
          display: 'grid',
          gap: '16px',
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
    </main>
  );
}
