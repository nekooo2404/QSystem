'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button, Form, FormField, Input } from '@qsystem/ui';
import { LoginSchema } from '@qsystem/contracts';
import { apiFetch, setAccessToken, ApiError } from '../../lib/api/client';
import { humanizeApiError } from '../../lib/errors/humanize';
import { useTheme } from '../../lib/theme';

export default function LoginPage() {
  const { theme, toggle } = useTheme();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [revealed, setRevealed] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = LoginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError('Vui lòng nhập email hợp lệ và mật khẩu.');
      return;
    }
    setError(null);
    setPending(true);
    try {
      const { accessToken } = await apiFetch<{ accessToken: string }>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      setAccessToken(accessToken);
      const next = new URLSearchParams(window.location.search).get('next');
      // Only same-origin relative paths: an attacker-supplied absolute URL
      // here would turn the login page into an open redirect.
      window.location.assign(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
    } catch (err) {
      setError(humanizeApiError(err instanceof ApiError ? err.code : undefined, err instanceof ApiError ? err.status : undefined));
      setPending(false);
    }
  }

  return (
    <main className="qs-login">
      <section className="qs-login__brand">
        <div className="qs-login__brand-row">
          <span className="qs-login__mark" aria-hidden="true">
            Q
          </span>
          <span className="qs-login__wordmark">QSystem</span>
        </div>
        <p className="qs-login__tagline">Không gian làm việc của QSystem.</p>
      </section>

      <section className="qs-login__pane">
        <div className="qs-login__card">
          <div className="qs-login__card-head">
            <h1>Đăng nhập</h1>
            <button
              type="button"
              className="qs-login__theme"
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            >
              {theme === 'dark' ? <SunGlyph /> : <MoonGlyph />}
              <span aria-hidden="true">Sáng / Tối</span>
            </button>
          </div>

          <Form onSubmit={handleSubmit} noValidate>
            <FormField name="email" label="Email công việc">
              <Input
                type="email"
                autoComplete="username"
                controlSize="lg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>

            {/* FormField clones a single child, so the reveal button lives
                outside it; label/input are wired by hand here. */}
            <div className="qs-field">
              <label htmlFor="password" className="qs-field__label">
                Mật khẩu
              </label>
              <div className="qs-login__password">
                <Input
                  id="password"
                  name="password"
                  type={revealed ? 'text' : 'password'}
                  autoComplete="current-password"
                  controlSize="lg"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="qs-login__reveal"
                  onClick={() => setRevealed((v) => !v)}
                  aria-label={revealed ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {revealed ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            {error ? (
              <p role="alert" className="qs-field__error" style={{ marginBottom: 12 }}>
                {error}
              </p>
            ) : null}

            <Button type="submit" size="lg" className="qs-login__submit" loading={pending} loadingText="Đang đăng nhập…">
              Đăng nhập
            </Button>
          </Form>

          <a className="qs-login__support" href="mailto:hotro@qsystem.vn">
            Cần hỗ trợ đăng nhập?
          </a>
        </div>
      </section>
    </main>
  );
}

function SunGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  );
}

function MoonGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z" />
    </svg>
  );
}
