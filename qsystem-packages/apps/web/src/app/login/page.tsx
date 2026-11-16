'use client';

import * as React from 'react';
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  LogIn,
  Sun,
  Moon,
  SquareCheck,
  Users,
  Layers,
  MessageSquareMore,
  Home,
  ChevronRight,
  ChevronDown,
  Check,
  X,
} from 'lucide-react';
import { LoginSchema } from '@qsystem/contracts';
import { apiFetch, setAccessToken, ApiError } from '../../lib/api/client';
import { humanizeApiError } from '../../lib/errors/humanize';
import { useTheme } from '../../lib/theme';
import '../../components/shell/shell.css';
import './login.css';

const MODULES = [
  { icon: SquareCheck, name: 'QTask', desc: 'Quản lý công việc & dự án' },
  { icon: Users, name: 'QHRM', desc: 'Nhân sự & tổ chức' },
  { icon: Layers, name: 'QCRM', desc: 'Khách hàng & kinh doanh' },
  { icon: MessageSquareMore, name: 'QSocial', desc: 'Kết nối & chia sẻ nội bộ' },
];

function isDemoModeEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}

export default function LoginPage() {
  const { theme, setTheme } = useTheme();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [revealed, setRevealed] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [forgotOpen, setForgotOpen] = React.useState(false);
  const [forgotEmail, setForgotEmail] = React.useState('');
  const [forgotStatus, setForgotStatus] = React.useState<{
    kind: 'error' | 'success';
    message: string;
  } | null>(null);
  const forgotTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const forgotInputRef = React.useRef<HTMLInputElement | null>(null);
  const wasForgotOpenRef = React.useRef(false);

  const closeForgotDialog = React.useCallback(() => {
    setForgotOpen(false);
    setForgotStatus(null);
  }, []);

  React.useEffect(() => {
    if (forgotOpen) {
      wasForgotOpenRef.current = true;
      forgotInputRef.current?.focus();
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeForgotDialog();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
    if (wasForgotOpenRef.current) {
      wasForgotOpenRef.current = false;
      forgotTriggerRef.current?.focus();
    }
  }, [forgotOpen, closeForgotDialog]);

  function openForgotDialog() {
    setForgotEmail((prev) => prev || email);
    setForgotStatus(null);
    setForgotOpen(true);
  }

  function handleForgotSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedEmail = LoginSchema.shape.email.safeParse(forgotEmail.trim());
    if (!parsedEmail.success) {
      setForgotStatus({
        kind: 'error',
        message: 'Vui lòng nhập địa chỉ email công việc hợp lệ.',
      });
      return;
    }
    setForgotStatus({
      kind: 'success',
      message:
        'Yêu cầu khôi phục mật khẩu đã được ghi nhận. Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại sẽ được gửi tới hộp thư của bạn.',
    });
  }

  function clearLoggedOutCookie() {
    document.cookie = 'qsystem_logged_out=; path=/; max-age=0; SameSite=Lax';
  }

  function redirectAfterLogin() {
    const next = new URLSearchParams(window.location.search).get('next');
    // Only same-origin relative paths: an attacker-supplied absolute URL or
    // backslash-prefixed path would turn the login page into an open redirect.
    const safeNext =
      next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/';
    window.location.assign(safeNext);
  }

  function completeDevSessionRedirect() {
    if (!isDemoModeEnabled()) {
      setError('Không thể kết nối đến máy chủ xác thực. Vui lòng thử lại sau.');
      setPending(false);
      return;
    }
    clearLoggedOutCookie();
    const cookieParts = ['refresh_token=dev-session', 'path=/', 'SameSite=Lax'];
    if (remember) {
      cookieParts.push('max-age=604800');
    }
    document.cookie = cookieParts.join('; ');
    setAccessToken('dev-session');
    redirectAfterLogin();
  }

  function handleSsoLogin(provider: string) {
    if (!isDemoModeEnabled()) {
      setError(
        `Đăng nhập bằng ${provider} yêu cầu cấu hình nhà cung cấp định danh (IdP) cho không gian làm việc.`,
      );
      return;
    }
    completeDevSessionRedirect();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = LoginSchema.safeParse({ email, password, remember });
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
      clearLoggedOutCookie();
      setAccessToken(accessToken);
      redirectAfterLogin();
    } catch (err) {
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        setError(humanizeApiError(err.code, err.status));
        setPending(false);
        return;
      }
      if (isDemoModeEnabled() && process.env.NODE_ENV !== 'test') {
        completeDevSessionRedirect();
        return;
      }
      setError(
        err instanceof ApiError
          ? humanizeApiError(err.code, err.status)
          : humanizeApiError('NETWORK', 0),
      );
      setPending(false);
    }
  }

  return (
    <main className="lg-root">
      <div className="lg-theme" role="group" aria-label="Chuyển giao diện">
        <button
          type="button"
          aria-pressed={theme === 'light'}
          aria-label="Chuyển giao diện sáng"
          onClick={() => setTheme('light')}
        >
          <Sun size={17} strokeWidth={1.6} aria-hidden="true" />
          <span>Sáng</span>
        </button>
        <button
          type="button"
          aria-pressed={theme === 'dark'}
          aria-label="Chuyển giao diện tối"
          onClick={() => setTheme('dark')}
        >
          <Moon size={17} strokeWidth={1.6} aria-hidden="true" />
          <span>Tối</span>
        </button>
      </div>

      <section className="lg-brand animate__animated animate__fadeIn">
        <div className="lg-logo">
          <span className="lg-logo__mark" aria-label="Logo QTS">
            Q
            <img src="/qts-logo.png" alt="" onError={(event) => { event.currentTarget.hidden = true; }} />
          </span>
          <span className="lg-logo__word">QSystem</span>
        </div>
        <h2 className="lg-headline">
          Không gian làm việc
          <br />
          <span>thống nhất</span>
        </h2>
        <p className="lg-sub">
          Kết nối công việc, con người và dữ liệu trong một{' '}
          <br />
          nền tảng duy nhất cho doanh nghiệp.
        </p>
        <ul className="lg-modules">
          {MODULES.map(({ icon: Icon, name, desc }) => (
            <li key={name}>
              <span className="lg-modules__tile" aria-hidden="true">
                <Icon size={18} strokeWidth={1.6} />
              </span>
              <span>
                <b>{name}</b> — {desc}
              </span>
            </li>
          ))}
        </ul>
        <DashboardMockup />
      </section>

      <section className="lg-card animate__animated animate__fadeIn" aria-labelledby="lg-title">
        <h1 id="lg-title">Chào mừng trở lại</h1>
        <p className="lg-card__sub">Đăng nhập vào QSystem để tiếp tục làm việc.</p>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="email" className="lg-label">Email công việc</label>
          <div className="lg-input">
            <Mail size={20} strokeWidth={1.5} aria-hidden="true" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="Nhập email của bạn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <label htmlFor="password" className="lg-label">Mật khẩu</label>
          <div className="lg-input">
            <Lock size={20} strokeWidth={1.5} aria-hidden="true" />
            <input
              id="password"
              name="password"
              type={revealed ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="lg-reveal"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {revealed ? <EyeOff size={20} strokeWidth={1.5} /> : <Eye size={20} strokeWidth={1.5} />}
            </button>
          </div>

          <div className="lg-row">
            <label className="lg-check">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span className="lg-check__box" aria-hidden="true">
                <Check size={14} strokeWidth={3} />
              </span>
              Ghi nhớ đăng nhập
            </label>
            <button
              ref={forgotTriggerRef}
              type="button"
              className="lg-link lg-link--btn"
              onClick={openForgotDialog}
            >
              Quên mật khẩu?
            </button>
          </div>

          {error ? (
            <p role="alert" className="lg-error animate__animated animate__shakeX animate__faster">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="lg-submit"
            data-variant="primary"
            disabled={pending}
            aria-busy={pending}
          >
            <LogIn size={22} strokeWidth={1.8} aria-hidden="true" />
            {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>

        <div className="lg-divider"><span>Hoặc đăng nhập bằng</span></div>

        <div className="lg-sso">
          <button type="button" onClick={() => handleSsoLogin('Google Workspace')}>
            <GoogleLogo />
            Google Workspace
          </button>
          <button type="button" onClick={() => handleSsoLogin('Microsoft 365')}>
            <MicrosoftLogo />
            Microsoft 365
          </button>
        </div>

        <p className="lg-foot">
          Cần hỗ trợ đăng nhập? Liên hệ <a className="lg-link" href="mailto:hotro@qsystem.vn">Quản trị hệ thống</a>
        </p>
      </section>

      {forgotOpen ? (
        <div className="lg-forgot-backdrop" role="presentation" onClick={closeForgotDialog}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="lg-forgot-title"
            className="lg-forgot-dialog animate__animated animate__fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lg-forgot-head">
              <h2 id="lg-forgot-title" className="lg-forgot-title">
                Khôi phục mật khẩu
              </h2>
              <button
                type="button"
                className="lg-forgot-close"
                aria-label="Đóng hộp thoại khôi phục mật khẩu"
                onClick={closeForgotDialog}
              >
                <X size={18} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>
            <p className="lg-forgot-desc">
              Nhập email công việc của bạn. Nếu tài khoản tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu sẽ được gửi tới hộp thư này.
            </p>
            <form onSubmit={handleForgotSubmit} noValidate>
              <label htmlFor="lg-forgot-email" className="lg-label">
                Email nhận hướng dẫn
              </label>
              <div className="lg-input">
                <Mail size={20} strokeWidth={1.5} aria-hidden="true" />
                <input
                  ref={forgotInputRef}
                  id="lg-forgot-email"
                  name="forgotEmail"
                  type="email"
                  autoComplete="email"
                  placeholder="ten@congty.vn"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                />
              </div>

              {forgotStatus ? (
                <p
                  role={forgotStatus.kind === 'error' ? 'alert' : 'status'}
                  className={
                    forgotStatus.kind === 'error'
                      ? 'lg-error animate__animated animate__shakeX animate__faster'
                      : 'lg-forgot-status animate__animated animate__fadeIn'
                  }
                >
                  {forgotStatus.message}
                </p>
              ) : null}

              <div className="lg-forgot-actions">
                <button type="button" className="lg-forgot-cancel" onClick={closeForgotDialog}>
                  Đóng
                </button>
                <button type="submit" className="lg-forgot-submit">
                  Gửi yêu cầu
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function DashboardMockup() {
  return (
    <div className="lg-mock" aria-hidden="true">
      <div className="lg-mock__ghost lg-mock__ghost--2" />
      <div className="lg-mock__ghost lg-mock__ghost--1" />
      <div className="lg-mock__win">
        <div className="lg-mock__dots"><i /><i /><i /></div>
        <aside className="lg-mock__side">
          <div className="lg-mock__brand"><span>Q</span>QSystem</div>
          <div className="lg-mock__nav is-active"><Home size={13} />Trang chủ</div>
          <div className="lg-mock__nav"><SquareCheck size={13} />QTask<ChevronRight size={11} /></div>
          <div className="lg-mock__nav"><Users size={13} />QHRM<ChevronRight size={11} /></div>
          <div className="lg-mock__nav"><Layers size={13} />QCRM</div>
          <div className="lg-mock__nav"><MessageSquareMore size={13} />QSocial</div>
        </aside>
        <div className="lg-mock__main">
          <div className="lg-mock__pill"><i />Summary<ChevronDown size={10} /></div>
          <div className="lg-mock__hello">Xin chào, Director 👋</div>
          <div className="lg-mock__hint">Cùng tiếp tục công việc hôm nay.</div>
          <div className="lg-mock__stats">
            <MockStat label="Công việc đang làm" value="24" color="var(--qx-amber)" />
            <MockStat label="Dự án" value="6" color="#3DBE6E" />
            <MockStat label="Nhân sự" value="128" color="var(--qx-amber)" />
          </div>
          <div className="lg-mock__panel">
            <div className="lg-mock__panel-head">Tiến độ công việc<span>Tháng này</span></div>
            <div className="lg-mock__hint">Đang thực hiện</div>
            <div className="lg-mock__bar"><i style={{ width: '62%' }} /></div>
            <div className="lg-mock__bar"><i style={{ width: '78%' }} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="lg-mock__stat">
      <div>{label}</div>
      <b>{value}</b>
      <span className="lg-mock__spark" style={{ color }}>
        <i style={{ height: 6 }} /><i style={{ height: 10 }} /><i style={{ height: 14 }} /><i style={{ height: 19 }} />
      </span>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <rect x="0" y="0" width="10.5" height="10.5" fill="#F25022" />
      <rect x="11.5" y="0" width="10.5" height="10.5" fill="#7FBA00" />
      <rect x="0" y="11.5" width="10.5" height="10.5" fill="#00A4EF" />
      <rect x="11.5" y="11.5" width="10.5" height="10.5" fill="#FFB900" />
    </svg>
  );
}
