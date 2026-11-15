'use client';

import * as React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const THEME_RESTORE = `(function(){try{if(localStorage.getItem('qsystem-theme')==='light')document.documentElement.setAttribute('data-theme','light');else document.documentElement.setAttribute('data-theme','dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  React.useEffect(() => {
    console.error('[qsystem:global-error]', {
      digest: error.digest ?? null,
      message: error.message,
    });
  }, [error]);

  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <title>QSystem — Khôi phục hệ thống</title>
        <script dangerouslySetInnerHTML={{ __html: THEME_RESTORE }} />
        <style>{`
          :root, [data-theme='dark'] {
            --qg-bg: #111418;
            --qg-card: #191d23;
            --qg-border: #30363d;
            --qg-fg: #f3f4f6;
            --qg-muted: #9ca3af;
            --qg-brand: #e8ad45;
            --qg-on-brand: #201708;
            --qg-focus: #e8ad45;
            --qg-error: #f85149;
            --qg-hover: #222731;
          }
          [data-theme='light'] {
            --qg-bg: #faf8f4;
            --qg-card: #ffffff;
            --qg-border: #dedad0;
            --qg-fg: #18181b;
            --qg-muted: #52525b;
            --qg-brand: #e8ad45;
            --qg-on-brand: #201708;
            --qg-focus: #8a6000;
            --qg-error: #b91c1c;
            --qg-hover: #efece4;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
            background: var(--qg-bg);
            color: var(--qg-fg);
            font-family: Inter, system-ui, -apple-system, sans-serif;
          }
          .qg-card {
            width: 100%;
            max-width: 500px;
            background: var(--qg-card);
            border: 1px solid var(--qg-border);
            border-radius: 12px;
            padding: 28px;
            display: grid;
            gap: 16px;
          }
          .qg-actions { display: flex; flex-wrap: wrap; gap: 10px; padding-top: 4px; }
          .qg-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            height: 40px;
            padding: 0 16px;
            border-radius: 6px;
            font: inherit;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            text-decoration: none;
            white-space: nowrap;
            border: 1px solid transparent;
          }
          .qg-btn--primary { background: var(--qg-brand); color: var(--qg-on-brand); }
          .qg-btn--secondary { background: transparent; border-color: var(--qg-border); color: var(--qg-fg); }
          .qg-btn--secondary:hover { background: var(--qg-hover); }
          .qg-btn:focus-visible { outline: 2px solid var(--qg-focus); outline-offset: 2px; }
        `}</style>
      </head>
      <body>
        <main className="qg-card" role="alert" aria-labelledby="global-error-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              aria-hidden="true"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                display: 'grid',
                placeItems: 'center',
                background: 'color-mix(in srgb, var(--qg-error) 16%, transparent)',
                color: 'var(--qg-error)',
              }}
            >
              <AlertTriangle size={18} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span style={{ fontWeight: 600, fontSize: '15px' }}>QSystem</span>
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            <h1 id="global-error-title" style={{ margin: 0, fontSize: '21px', fontWeight: 600 }}>
              Hệ thống đang khôi phục
            </h1>
            <p style={{ margin: 0, fontSize: '13.5px', lineHeight: '20px', color: 'var(--qg-muted)' }}>
              Ứng dụng vừa gặp lỗi nghiêm trọng ở lớp gốc. Vui lòng tải lại ứng dụng hoặc quay về trang đăng nhập.
            </p>
            {error.digest ? (
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--qg-muted)' }}>
                Mã tra cứu sự cố:{' '}
                <code style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--qg-fg)' }}>{error.digest}</code>
              </p>
            ) : null}
          </div>

          <div className="qg-actions">
            <button type="button" className="qg-btn qg-btn--primary" onClick={() => reset()}>
              <RotateCcw size={15} strokeWidth={1.8} aria-hidden="true" />
              Tải lại ứng dụng
            </button>
            <a href="/login" className="qg-btn qg-btn--secondary">
              Về trang đăng nhập
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
