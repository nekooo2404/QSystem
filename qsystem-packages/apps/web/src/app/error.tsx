'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

export interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RouteError({ error, reset }: RouteErrorProps) {
  React.useEffect(() => {
    // Emit structured metadata without exposing secrets or raw stack traces in UI.
    console.error('[qsystem:route-error]', {
      digest: error.digest ?? null,
      message: error.message,
    });
  }, [error]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background: 'var(--qs-bg)',
        color: 'var(--qs-fg)',
      }}
    >
      <section
        role="alert"
        aria-labelledby="route-error-title"
        style={{
          width: '100%',
          maxWidth: '500px',
          background: 'var(--qs-surface-1)',
          border: '1px solid var(--qs-border)',
          borderRadius: 'var(--qs-radius-card)',
          padding: '24px',
          display: 'grid',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            aria-hidden="true"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--qs-radius-control)',
              display: 'grid',
              placeItems: 'center',
              background: 'color-mix(in srgb, var(--qs-error) 16%, transparent)',
              color: 'var(--qs-error)',
            }}
          >
            <AlertTriangle size={18} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <span
            style={{
              fontFamily: 'var(--qs-font-heading)',
              fontWeight: 600,
              fontSize: '16px',
              letterSpacing: 0,
            }}
          >
            QSystem
          </span>
        </div>

        <div style={{ display: 'grid', gap: '8px' }}>
          <h1
            id="route-error-title"
            style={{
              fontSize: '24px',
              fontWeight: 500,
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Đã xảy ra sự cố ngoài ý muốn
          </h1>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: 'var(--qs-fg-secondary)' }}>
            Không gian làm việc gặp lỗi khi xử lý yêu cầu hiện tại. Vui lòng thử lại hoặc quay về trang chủ.
          </p>
          {error.digest ? (
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--qs-fg-muted)' }}>
              Mã tra cứu sự cố:{' '}
              <code
                style={{
                  fontFamily: 'var(--qs-font-code)',
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--qs-fg)',
                }}
              >
                {error.digest}
              </code>
            </p>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', paddingTop: '4px' }}>
          <button
            type="button"
            className="qs-btn qs-btn--primary qs-btn--md"
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => reset()}
          >
            <RotateCcw size={16} strokeWidth={1.5} aria-hidden="true" />
            Thử lại
          </button>
          <Link
            href="/"
            className="qs-btn qs-btn--secondary qs-btn--md"
            style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            <Home size={16} strokeWidth={1.5} aria-hidden="true" />
            Về trang chủ
          </Link>
        </div>
      </section>
    </main>
  );
}
