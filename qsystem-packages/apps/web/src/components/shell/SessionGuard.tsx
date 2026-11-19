'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { MeResponseSchema, type MeResponse } from '@qsystem/contracts';
import { apiFetch } from '../../lib/api/client';
import { AppWorkspaceShell } from './AppWorkspaceShell';
import { SessionProvider } from '../../lib/auth/session-context';

const PROFILE_STORAGE_KEY = 'qsystem:account:profile:v1';

const DEV_FALLBACK_ME: MeResponse = {
  id: 'u-director-01',
  email: 'minhkhoi@qsystem.vn',
  name: 'Minh Khôi',
  role: 'DIRECTOR',
  departmentId: 'dept-ops',
  managedDepartmentIds: [],
};

function isDemoMode(): boolean {
  return false;
}

function readDevFallbackMe(): MeResponse {
  if (typeof window === 'undefined') return DEV_FALLBACK_ME;
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return DEV_FALLBACK_ME;
    const parsed = JSON.parse(raw) as { name?: unknown; email?: unknown };
    return {
      ...DEV_FALLBACK_ME,
      name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : DEV_FALLBACK_ME.name,
      email: typeof parsed.email === 'string' && parsed.email.includes('@') ? parsed.email.trim() : DEV_FALLBACK_ME.email,
    };
  } catch {
    return DEV_FALLBACK_ME;
  }
}

function hasLoggedOutCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((entry) => entry.trim() === 'qsystem_logged_out=1');
}

/**
 * Middleware only verifies token shape; this resolves the real caller via API
 * and bounces back to /login when production fails closed, `?auth=required` is
 * set, user explicitly logged out, or API returns 401.
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = React.useState<MeResponse | null>(null);

  React.useEffect(() => {
    let active = true;
    const usingFallback = { current: false };

    apiFetch('/api/me', { schema: MeResponseSchema }).then(
      (response) => {
        if (active) setMe(response);
      },
      (err: unknown) => {
        if (!active) return;
        const status = (err as { status?: number } | null)?.status;
        const requireAuth = window.location.search.includes('auth=required');
        if (!isDemoMode() || requireAuth || status === 401 || hasLoggedOutCookie()) {
          const next = window.location.pathname + window.location.search;
          router.replace(`/login?next=${encodeURIComponent(next)}`);
          return;
        }
        usingFallback.current = true;
        setMe(readDevFallbackMe());
      },
    );

    const onProfileSync = () => {
      if (!active || !usingFallback.current) return;
      setMe(readDevFallbackMe());
    };
    window.addEventListener('storage', onProfileSync);
    window.addEventListener('qsystem:account-updated', onProfileSync);
    return () => {
      active = false;
      window.removeEventListener('storage', onProfileSync);
      window.removeEventListener('qsystem:account-updated', onProfileSync);
    };
  }, [router]);

  // Rendering the shell before the session lands would flash an empty account
  // menu; the page area stays empty for the one round-trip.
  if (!me) {
    return (
      <div role="status" aria-busy="true" aria-label="Đang xác nhận phiên đăng nhập" className="qs-session-loading" />
    );
  }

  return (
    <SessionProvider me={me}>
      <React.Suspense fallback={null}>
        <AppWorkspaceShell me={me}>{children}</AppWorkspaceShell>
      </React.Suspense>
    </SessionProvider>
  );
}
