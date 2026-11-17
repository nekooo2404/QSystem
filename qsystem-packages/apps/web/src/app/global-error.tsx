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
        <meta name="color-scheme" content="dark light" />
        <title>QSystem — Khôi phục hệ thống</title>
        <script dangerouslySetInnerHTML={{ __html: THEME_RESTORE }} />
        <style>{`
          :root, [data-theme='dark'] {
            --qs-bg: #111317;
            --qs-surface-1: #171a20;
            --qs-border: rgb(238 240 245 / 0.09);
            --qs-border-strong: rgb(238 240 245 / 0.16);
            --qs-fg: #eef0f5;
            --qs-fg-secondary: #a3a9b8;
            --qs-fg-muted: #8c95ab;
            --qs-brand: #618dc9;
            --qs-brand-hover: #759ed4;
            --qs-on-brand: #091423;
            --qs-focus: #7ba2d6;
            --qs-error: #f06469;
            --qs-state-hover: #1f242c;
            --qs-state-selected: #252b35;
            --qs-highlight-top: inset 0 1px 0 rgb(255 255 255 / 0.12);
            color-scheme: dark;
          }
          [data-theme='light'] {
            --qs-bg: #f6f8fb;
            --qs-surface-1: #ffffff;
            --qs-border: rgb(17 24 39 / 0.09);
            --qs-border-strong: rgb(17 24 39 / 0.16);
            --qs-fg: #111827;
            --qs-fg-secondary: #4b5565;
            --qs-fg-muted: #596377;
            --qs-brand: #2c568f;
            --qs-brand-hover: #234675;
            --qs-on-brand: #ffffff;
            --qs-focus: #1f406e;
            --qs-error: #b91c1c;
            --qs-state-hover: #eaeff5;
            --qs-state-selected: #e1e8f0;
            --qs-highlight-top: inset 0 1px 0 rgb(255 255 255 / 0.65);
            color-scheme: light;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
            background: var(--qs-bg);
            color: var(--qs-fg);
            font-family: 'IBM Plex Sans', system-ui, -apple-system, sans-serif;
            font-size: 14px;
            line-height: 1.5;
          }
          .qg-card {
            width: 100%;
            max-width: 500px;
            background: var(--qs-surface-1);
            border: 1px solid var(--qs-border);
            border-radius: 12px;
            padding: 24px;
            display: grid;
            gap: 16px;
          }
          .qg-actions { display: flex; flex-wrap: wrap; gap: 12px; padding-top: 4px; }
          .qg-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            height: 40px;
            padding: 0 16px;
            border-radius: 8px;
            font: inherit;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            text-decoration: none;
            white-space: nowrap;
            border: 1px solid transparent;
            transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1),
              border-color 150ms cubic-bezier(0.22, 1, 0.36, 1),
              color 150ms cubic-bezier(0.22, 1, 0.36, 1),
              transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
          }
          .qg-btn--primary {
            background: var(--qs-brand);
            color: var(--qs-on-brand);
            box-shadow: var(--qs-highlight-top);
          }
          .qg-btn--primary:hover { background: var(--qs-brand-hover); }
          .qg-btn--secondary {
            background: var(--qs-surface-1);
            border-color: var(--qs-border);
            color: var(--qs-fg);
            box-shadow: var(--qs-highlight-top);
          }
          .qg-btn--secondary:hover {
            background: var(--qs-state-hover);
            border-color: var(--qs-border-strong);
          }
          .qg-btn:active { transform: translateY(1px); }
          .qg-btn:focus-visible { outline: 2px solid var(--qs-focus); outline-offset: 2px; }
          @media (prefers-reduced-motion: reduce) {
            .qg-btn { transition: none; }
            .qg-btn:active { transform: none; }
          }
        `}</style>
      </head>
      <body>
        <main className="qg-card" role="alert" aria-labelledby="global-error-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              aria-hidden="true"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
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
                fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, sans-serif",
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
              id="global-error-title"
              style={{
                margin: 0,
                fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, sans-serif",
                fontSize: '24px',
                fontWeight: 500,
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
              }}
            >
              Hệ thống đang khôi phục
            </h1>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: 'var(--qs-fg-secondary)' }}>
              Ứng dụng vừa gặp lỗi nghiêm trọng ở lớp gốc. Vui lòng tải lại ứng dụng hoặc quay về trang đăng nhập.
            </p>
            {error.digest ? (
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--qs-fg-muted)' }}>
                Mã tra cứu sự cố:{' '}
                <code
                  style={{
                    fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--qs-fg)',
                  }}
                >
                  {error.digest}
                </code>
              </p>
            ) : null}
          </div>

          <div className="qg-actions">
            <button type="button" className="qg-btn qg-btn--primary" onClick={() => reset()}>
              <RotateCcw size={16} strokeWidth={1.5} aria-hidden="true" />
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
