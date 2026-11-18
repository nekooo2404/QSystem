'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bell, KeyRound, Settings, ShieldCheck, User } from 'lucide-react';
import { StateRegion, toast } from '@qsystem/ui';
import { ChangePasswordSchema, type MeResponse } from '@qsystem/contracts';
import { ApiError, apiFetch, setAccessToken } from '../../../lib/api/client';
import { useSession } from '../../../lib/auth/session-context';
import { humanizeApiError } from '../../../lib/errors/humanize';
import '../../../components/account/account.css';

type NavKey = 'profile' | 'security' | 'notifications';

const FALLBACK_ME: MeResponse = {
  id: 'u-director-01',
  name: 'Minh Khôi',
  email: 'minhkhoi@qsystem.vn',
  role: 'DIRECTOR',
  departmentId: null,
  managedDepartmentIds: [],
};

const PROFILE_STORAGE_KEY = 'qsystem:account:profile:v1';

interface StoredAccountProfile {
  name?: string;
  email?: string;
  departmentName?: string;
  twoFactorEnabled?: boolean;
}

function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test';
}

function allowDevOfflineFallback(): boolean {
  if (isTestEnvironment()) return false;
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') {
    return false;
  }
  return true;
}

function readStoredProfile(): StoredAccountProfile {
  if (typeof window === 'undefined' || isTestEnvironment()) return {};
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredAccountProfile;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredProfile(next: StoredAccountProfile): void {
  if (typeof window === 'undefined' || !allowDevOfflineFallback()) return;
  try {
    const prev = readStoredProfile();
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ ...prev, ...next }));
  } catch {
    // Ignore storage quota errors in private mode.
  }
}

function humanize(err: unknown): string {
  return humanizeApiError(err instanceof ApiError ? err.code : undefined, err instanceof ApiError ? err.status : undefined);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'MK';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatAccountRole(role?: string): string {
  if (role === 'MANAGER') return 'Quản lý';
  if (role === 'EMPLOYEE') return 'Nhân viên';
  return 'Quản trị viên';
}

function useSafeSearchParams() {
  try {
    return useSearchParams();
  } catch {
    return null;
  }
}

function navKeyFromMuc(muc: string | null | undefined): 'profile' | 'security' {
  if (muc === 'bao-mat') return 'security';
  return 'profile';
}

function hrefForNavKey(key: 'profile' | 'security'): string {
  if (key === 'security') return '/account?muc=bao-mat';
  return '/account';
}

function AccountPageContent() {
  const router = useRouter();
  const searchParams = useSafeSearchParams();
  const mucParam = searchParams?.get('muc');
  const { me: sessionMe, updateMe } = useSession();
  const [me, setMe] = React.useState<MeResponse | null>(sessionMe);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(!sessionMe);
  const [attempt, setAttempt] = React.useState(0);

  const [activeNav, setActiveNav] = React.useState<NavKey>(() => navKeyFromMuc(mucParam));
  const [editingProfile, setEditingProfile] = React.useState(false);
  const [displayName, setDisplayName] = React.useState(sessionMe?.name ?? 'Minh Khôi');
  const [savedDepartment, setSavedDepartment] = React.useState('Ban Giám đốc');
  const [departmentName, setDepartmentName] = React.useState('Ban Giám đốc');

  const [showPasswordForm, setShowPasswordForm] = React.useState(false);
  const [oldPassword, setOldPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  // MFA and remote session management are intentionally unavailable until
  // their server-backed flows exist; never present a localStorage toggle as
  // account security.
  const [twoFactorEnabled] = React.useState(false);
  const profileRef = React.useRef<HTMLDivElement>(null);
  const securityRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let active = true;
    if (sessionMe && attempt === 0) {
      setMe(sessionMe);
      setDisplayName(sessionMe.name);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const stored = readStoredProfile();
    if (allowDevOfflineFallback()) {
      if (typeof stored.departmentName === 'string' && stored.departmentName.trim()) {
        setDepartmentName(stored.departmentName.trim());
        setSavedDepartment(stored.departmentName.trim());
      }
    }

    apiFetch<Partial<MeResponse>>('/api/me').then(
      (response) => {
        if (!active) return;
        const resolved: MeResponse = {
          id: response?.id ?? 'u1',
          name: response?.name || 'Minh Khôi',
          email: response?.email || 'minhkhoi@qsystem.vn',
          role: response?.role ?? 'DIRECTOR',
          departmentId: response?.departmentId ?? null,
          managedDepartmentIds: Array.isArray(response?.managedDepartmentIds) ? response.managedDepartmentIds : [],
        };
        setMe(resolved);
        setDisplayName(resolved.name);
        setLoading(false);
      },
      (err) => {
        if (!active) return;
        const requireAuth =
          typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).get('auth') === 'required';
        const isUnauthorized = err instanceof ApiError && err.status === 401;
        if (!allowDevOfflineFallback() || (requireAuth && isUnauthorized)) {
          setLoadError(humanize(err));
          setLoading(false);
          return;
        }
        const fallbackMe: MeResponse = {
          ...FALLBACK_ME,
          name: typeof stored.name === 'string' && stored.name.trim() ? stored.name.trim() : FALLBACK_ME.name,
          email: typeof stored.email === 'string' && stored.email.includes('@') ? stored.email.trim() : FALLBACK_ME.email,
        };
        setMe(fallbackMe);
        setDisplayName(fallbackMe.name);
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = ChangePasswordSchema.safeParse({ oldPassword, newPassword });
    if (!parsed.success) {
      setPasswordError('Mật khẩu mới cần ít nhất 8 ký tự.');
      return;
    }
    setPasswordError(null);
    setPending(true);
    try {
      await apiFetch('/api/me/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      setOldPassword('');
      setNewPassword('');
      setShowPasswordForm(false);
      toast.success('Đã đổi mật khẩu. Vui lòng đăng nhập lại.');
      // The API revokes every session on a password change.
      setAccessToken(null);
      router.push('/login');
    } catch (err) {
      const isClientError = err instanceof ApiError && err.status >= 400 && err.status < 500;
      if (!allowDevOfflineFallback() || isClientError) {
        setPasswordError(humanize(err));
        setPending(false);
        return;
      }
      setOldPassword('');
      setNewPassword('');
      setShowPasswordForm(false);
      setPending(false);
      toast.success('Đã cập nhật mật khẩu trong chế độ xem thử ngoại tuyến.');
    }
  }

  const hasMe = Boolean(me);
  React.useEffect(() => {
    const nextKey = navKeyFromMuc(mucParam);
    setActiveNav(nextKey);
    if (!hasMe) return;
    const target =
      nextKey === 'security'
        ? securityRef.current
        : mucParam === 'ho-so'
          ? profileRef.current
          : null;
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [mucParam, hasMe]);

  function handleNavClick(key: NavKey) {
    if (key === 'notifications') {
      router.push('/notifications');
      return;
    }
    setActiveNav(key);
    if (typeof (router as { replace?: unknown }).replace === 'function') {
      router.replace(hrefForNavKey(key), { scroll: false });
    }
    const target = key === 'profile' ? profileRef.current : securityRef.current;
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!me) return;
    const trimmed = displayName.trim() || me.name;
    const nextDepartment = departmentName.trim() || 'Ban Giám đốc';
    setMe({ ...me, name: trimmed });
    updateMe({ ...me, name: trimmed });
    setDisplayName(trimmed);
    setDepartmentName(nextDepartment);
    setSavedDepartment(nextDepartment);
    writeStoredProfile({
      name: trimmed,
      email: me.email,
      departmentName: nextDepartment,
      twoFactorEnabled,
    });
    setEditingProfile(false);
    toast.success('Đã cập nhật thông tin cá nhân.');
  }

  if (!me) {
    return (
      <StateRegion
        state={loading ? 'loading' : 'error'}
        rows={3}
        errorDescription={loadError ?? undefined}
        onRetry={() => setAttempt((value) => value + 1)}
      />
    );
  }

  const roleLabel = formatAccountRole(me.role);
  const avatarText = initials(me.name);

  return (
    <section className="qx-page" aria-label="Tài khoản và bảo mật">
      <header className="qx-page-head">
        <div>
          <h1>Tài khoản &amp; bảo mật</h1>
          <p>Quản lý hồ sơ, đăng nhập và quyền riêng tư của bạn</p>
        </div>
      </header>

      <div className="qa-grid">
        <aside className="qx-card qa-profile" aria-label="Hồ sơ cá nhân">
          <div className="qa-profile__head">
            <span className="qa-avatar" aria-hidden="true">{avatarText}</span>
            <p className="qa-profile__name">{me.name}</p>
            <p className="qa-profile__email">{me.email}</p>
            <span className="qx-badge qx-badge--amber qa-profile__badge">{roleLabel}</span>
          </div>

          <div className="qa-divider" role="separator" />

          <nav className="qa-nav" aria-label="Điều hướng tài khoản">
            <button
              type="button"
              className="qa-nav__item"
              data-active={activeNav === 'profile'}
              aria-current={activeNav === 'profile' ? 'page' : undefined}
              onClick={() => handleNavClick('profile')}
            >
              <User size={16} strokeWidth={1.6} aria-hidden="true" />
              <span>Thông tin cá nhân</span>
            </button>
            <button
              type="button"
              className="qa-nav__item"
              data-active={activeNav === 'security'}
              aria-current={activeNav === 'security' ? 'page' : undefined}
              onClick={() => handleNavClick('security')}
            >
              <ShieldCheck size={16} strokeWidth={1.6} aria-hidden="true" />
              <span>Bảo mật &amp; đăng nhập</span>
            </button>
            <button
              type="button"
              className="qa-nav__item"
              data-active={activeNav === 'notifications'}
              onClick={() => handleNavClick('notifications')}
            >
              <Bell size={16} strokeWidth={1.6} aria-hidden="true" />
              <span>Thông báo</span>
            </button>
          </nav>
        </aside>

        <div className="qa-stack">
          <div id="qa-profile" ref={profileRef} className="qx-card qa-card">
            <div className="qa-card__head">
              <h2>Thông tin cá nhân</h2>
              <button
                type="button"
                className="qx-btn qx-btn--sm"
                aria-expanded={editingProfile}
                onClick={() => {
                  if (editingProfile) {
                    setDisplayName(me.name);
                    setDepartmentName(savedDepartment);
                  }
                  setEditingProfile((prev) => !prev);
                }}
              >
                <Settings size={14} strokeWidth={1.6} aria-hidden="true" />
                {editingProfile ? 'Đóng' : 'Chỉnh sửa'}
              </button>
            </div>

            <form onSubmit={handleSaveProfile}>
              <div className="qa-form-grid">
                <div className="qa-field">
                  <label htmlFor="qa-name">Họ và tên</label>
                  <input
                    id="qa-name"
                    className="qa-input"
                    type="text"
                    readOnly={!editingProfile}
                    value={editingProfile ? displayName : me.name}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </div>
                <div className="qa-field">
                  <label htmlFor="qa-email">Email công việc</label>
                  <input
                    id="qa-email"
                    className="qa-input"
                    type="email"
                    readOnly
                    value={me.email}
                  />
                </div>
                <div className="qa-field">
                  <label htmlFor="qa-role">Vai trò</label>
                  <input
                    id="qa-role"
                    className="qa-input"
                    type="text"
                    readOnly
                    value={roleLabel}
                  />
                </div>
                <div className="qa-field">
                  <label htmlFor="qa-department">Phòng ban</label>
                  <input
                    id="qa-department"
                    className="qa-input"
                    type="text"
                    readOnly={!editingProfile}
                    value={departmentName}
                    onChange={(event) => setDepartmentName(event.target.value)}
                  />
                </div>
              </div>

              {editingProfile ? (
                <div className="qa-edit-actions">
                  <button
                    type="button"
                    className="qx-btn qx-btn--sm"
                    onClick={() => {
                      setDisplayName(me.name);
                      setDepartmentName(savedDepartment);
                      setEditingProfile(false);
                    }}
                  >
                    Hủy
                  </button>
                  <button type="submit" className="qx-btn qx-btn--primary qx-btn--sm">
                    Lưu thay đổi
                  </button>
                </div>
              ) : null}
            </form>
          </div>

          <div id="qa-security" ref={securityRef} className="qx-card qa-card">
            <div className="qa-card__head">
              <h2>Bảo mật tài khoản</h2>
              <span className={`qx-badge ${twoFactorEnabled ? 'qx-badge--green' : 'qx-badge--amber'} qa-sec-badge`}>
                {twoFactorEnabled ? 'Bảo vệ tốt' : 'Cần bổ sung'}
              </span>
            </div>

            <div className="qa-sec-list">
              <div className="qa-sec-item">
                <div className="qa-sec-row">
                  <span className="qa-sec-icon" aria-hidden="true">
                    <KeyRound size={17} strokeWidth={1.7} aria-hidden="true" />
                  </span>
                  <div className="qa-sec-main">
                    <p className="qa-sec-title">Mật khẩu</p>
                    <p className="qa-sec-desc">Cập nhật gần đây · 30 ngày trước</p>
                  </div>
                  <button
                    type="button"
                    className="qx-btn qx-btn--sm"
                    aria-expanded={showPasswordForm}
                    onClick={() => {
                      setPasswordError(null);
                      setShowPasswordForm((prev) => !prev);
                    }}
                  >
                    Đổi mật khẩu
                  </button>
                </div>

                {showPasswordForm ? (
                  <form className="qa-pw-panel" onSubmit={handlePasswordSubmit} noValidate>
                    <div className="qa-pw-fields">
                      <div className="qa-field">
                        <label htmlFor="qa-old-password">Mật khẩu hiện tại</label>
                        <input
                          id="qa-old-password"
                          className="qa-input"
                          type="password"
                          autoComplete="current-password"
                          value={oldPassword}
                          disabled={pending}
                          onChange={(event) => setOldPassword(event.target.value)}
                        />
                      </div>
                      <div className="qa-field">
                        <label htmlFor="qa-new-password">Mật khẩu mới</label>
                        <input
                          id="qa-new-password"
                          className="qa-input"
                          type="password"
                          autoComplete="new-password"
                          value={newPassword}
                          disabled={pending}
                          onChange={(event) => setNewPassword(event.target.value)}
                        />
                        <p className="qa-helper">Ít nhất 8 ký tự.</p>
                      </div>
                    </div>
                    {passwordError ? (
                      <p role="alert" className="qa-error">
                        {passwordError}
                      </p>
                    ) : null}
                    <div className="qa-pw-actions">
                      <button
                        type="button"
                        className="qx-btn qx-btn--sm"
                        disabled={pending}
                        onClick={() => {
                          setShowPasswordForm(false);
                          setPasswordError(null);
                          setOldPassword('');
                          setNewPassword('');
                        }}
                      >
                        Hủy
                      </button>
                      <button type="submit" className="qx-btn qx-btn--primary qx-btn--sm" disabled={pending}>
                        {pending ? 'Đang lưu…' : 'Cập nhật mật khẩu'}
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>

              <div className="qa-sec-item">
                <div className="qa-sec-row">
                  <span className="qa-sec-icon" aria-hidden="true">
                    <ShieldCheck size={17} strokeWidth={1.7} aria-hidden="true" />
                  </span>
                  <div className="qa-sec-main">
                    <p className="qa-sec-title">Xác thực hai yếu tố</p>
                    <p className="qa-sec-desc">Thêm một lớp bảo mật cho tài khoản</p>
                  </div>
                  <button
                    type="button"
                    className="qa-sec-toggle qs-switch"
                    disabled
                    aria-disabled="true"
                    aria-pressed={twoFactorEnabled}
                  >
                    {twoFactorEnabled ? 'Đã bật' : 'Đang tắt'}
                  </button>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

export default function AccountPage() {
  return (
    <React.Suspense fallback={<StateRegion state="loading" rows={3} />}>
      <AccountPageContent />
    </React.Suspense>
  );
}
