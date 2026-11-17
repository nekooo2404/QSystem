import Link from 'next/link';
import { ArrowLeft, Compass } from 'lucide-react';

export default function NotFound() {
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
        aria-labelledby="not-found-title"
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'var(--qs-surface-1)',
          border: '1px solid var(--qs-border)',
          borderRadius: 'var(--qs-radius-card)',
          padding: '24px',
          display: 'grid',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span
              aria-hidden="true"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--qs-radius-control)',
                display: 'grid',
                placeItems: 'center',
                background: 'var(--qs-brand)',
                color: 'var(--qs-on-brand)',
                fontFamily: 'var(--qs-font-heading)',
                fontWeight: 600,
                fontSize: '16px',
              }}
            >
              Q
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
          <span
            className="qs-numeric"
            style={{
              fontFamily: 'var(--qs-font-code)',
              fontSize: '12px',
              fontWeight: 500,
              padding: '4px 8px',
              borderRadius: 'var(--qs-radius-sm)',
              background: 'var(--qs-bg-inverse)',
              border: '1px solid var(--qs-border)',
              color: 'var(--qs-fg-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            404
          </span>
        </div>

        <div style={{ display: 'grid', gap: '8px' }}>
          <h1
            id="not-found-title"
            style={{
              fontSize: '24px',
              fontWeight: 500,
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Không tìm thấy trang
          </h1>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: 'var(--qs-fg-secondary)' }}>
            Đường dẫn bạn truy cập không tồn tại, đã được di chuyển hoặc không còn hiệu lực.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', paddingTop: '4px' }}>
          <Link
            href="/"
            className="qs-btn qs-btn--primary qs-btn--md"
            style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            Về không gian làm việc
          </Link>
          <Link
            href="/login"
            className="qs-btn qs-btn--secondary qs-btn--md"
            style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            <Compass size={16} strokeWidth={1.5} aria-hidden="true" />
            Đăng nhập
          </Link>
        </div>
      </section>
    </main>
  );
}
