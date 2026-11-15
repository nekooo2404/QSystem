'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { MeResponseSchema, type MeResponse } from '@qsystem/contracts';
import { apiFetch } from '../../lib/api/client';
import { AppWorkspaceShell } from './AppWorkspaceShell';

/**
 * Middleware only proves a cookie exists; this asks the API who the caller is
 * and bounces a dead session back to /login with a return path.
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = React.useState<MeResponse | null>(null);

  React.useEffect(() => {
    let active = true;
    apiFetch('/api/me', { schema: MeResponseSchema }).then(
      (response) => {
        if (active) setMe(response);
      },
      () => {
        if (!active) return;
        const next = window.location.pathname + window.location.search;
        router.replace(`/login?next=${encodeURIComponent(next)}`);
      },
    );
    return () => {
      active = false;
    };
  }, [router]);

  // Rendering the shell before the session lands would flash an empty account
  // menu; the page area stays empty for the one round-trip.
  if (!me) {
    return (
      <div role="status" aria-busy="true" aria-label="Đang xác nhận phiên đăng nhập" className="qs-session-loading" />
    );
  }

  return <AppWorkspaceShell me={me}>{children}</AppWorkspaceShell>;
}
