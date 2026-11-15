'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Form, FormField, Input, StateRegion, toast } from '@qsystem/ui';
import { ChangePasswordSchema, MeResponseSchema, type MeResponse } from '@qsystem/contracts';
import { ApiError, apiFetch, setAccessToken } from '../../../lib/api/client';
import { humanizeApiError } from '../../../lib/errors/humanize';
import { formatRole } from '../../../lib/adapters/notifications.adapter';

function humanize(err: unknown): string {
  return humanizeApiError(err instanceof ApiError ? err.code : undefined, err instanceof ApiError ? err.status : undefined);
}

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = React.useState<MeResponse | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [attempt, setAttempt] = React.useState(0);
  const [oldPassword, setOldPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    apiFetch('/api/me', { schema: MeResponseSchema }).then(
      (response) => {
        if (active) { setMe(response); setLoading(false); }
      },
      (err) => {
        if (active) { setLoadError(humanize(err)); setLoading(false); }
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = ChangePasswordSchema.safeParse({ oldPassword, newPassword });
    if (!parsed.success) {
      setError('Mật khẩu mới cần ít nhất 8 ký tự.');
      return;
    }
    setError(null);
    setPending(true);
    try {
      await apiFetch('/api/me/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      setOldPassword('');
      setNewPassword('');
      toast.success('Đã đổi mật khẩu. Vui lòng đăng nhập lại.');
      // The API revokes every session on a password change.
      setAccessToken(null);
      router.push('/login');
    } catch (err) {
      setError(humanize(err));
      setPending(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken(null);
      router.push('/login');
    }
  }

  if (!me) return <StateRegion state={loading ? 'loading' : 'error'} rows={3} errorDescription={loadError ?? undefined} onRetry={() => setAttempt(value => value + 1)} />;

  return (
    <section className="qs-account-page qs-page" aria-label="Tài khoản">
      <h1>Tài khoản &amp; Bảo mật</h1>

      <div className="qs-account-page__card">
        <dl className="qs-account-page__profile">
          <div>
            <dt>Họ tên</dt>
            <dd>{me.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{me.email}</dd>
          </div>
          <div>
            <dt>Vai trò</dt>
            <dd>{formatRole(me.role)}</dd>
          </div>
        </dl>
      </div>

      <div className="qs-account-page__card">
        <h2>Đổi mật khẩu</h2>
        <Form onSubmit={handleSubmit} noValidate>
          <FormField name="oldPassword" label="Mật khẩu hiện tại">
            <Input
              type="password"
              autoComplete="current-password"
              value={oldPassword}
              disabled={pending}
              onChange={(event) => setOldPassword(event.target.value)}
            />
          </FormField>
          <FormField name="newPassword" label="Mật khẩu mới" helperText="Ít nhất 8 ký tự.">
            <Input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              disabled={pending}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </FormField>
          {error ? (
            <p role="alert" className="qs-field__error">
              {error}
            </p>
          ) : null}
          <Button type="submit" loading={pending} loadingText="Đang lưu…">
            Đổi mật khẩu
          </Button>
        </Form>
      </div>

      <div className="qs-account-page__card">
        <h2>Phiên đăng nhập</h2>
        <p className="qs-page__note">Đăng xuất khỏi thiết bị này. Bạn sẽ cần đăng nhập lại để tiếp tục.</p>
        <Button variant="secondary" onClick={handleLogout} loading={loggingOut} loadingText="Đang đăng xuất…">
          Đăng xuất
        </Button>
      </div>
    </section>
  );
}
