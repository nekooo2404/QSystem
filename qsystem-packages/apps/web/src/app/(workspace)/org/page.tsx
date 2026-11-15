'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { MeResponse } from '@qsystem/contracts';
import { StateRegion } from '@qsystem/ui';
import { apiFetch } from '../../../lib/api/client';
import { QhrmDirectory } from '../../../components/qhrm/QhrmDirectory';

const FALLBACK_ME: MeResponse = {
  id: 'u-1',
  email: 'minhkhoi@qsystem.vn',
  name: 'Minh Khôi',
  role: 'DIRECTOR',
  departmentId: null,
  managedDepartmentIds: [],
};

const PROFILE_STORAGE_KEY = 'qsystem:account:profile:v1';

function readSyncedDevProfile(): MeResponse {
  if (typeof window === 'undefined') return FALLBACK_ME;
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return FALLBACK_ME;
    const parsed = JSON.parse(raw) as Partial<MeResponse>;
    return {
      id: typeof parsed.id === 'string' && parsed.id ? parsed.id : FALLBACK_ME.id,
      email: typeof parsed.email === 'string' && parsed.email ? parsed.email : FALLBACK_ME.email,
      name: typeof parsed.name === 'string' && parsed.name ? parsed.name : FALLBACK_ME.name,
      role:
        parsed.role === 'DIRECTOR' || parsed.role === 'MANAGER' || parsed.role === 'EMPLOYEE'
          ? parsed.role
          : FALLBACK_ME.role,
      departmentId: parsed.departmentId ?? null,
      managedDepartmentIds: Array.isArray(parsed.managedDepartmentIds)
        ? parsed.managedDepartmentIds
        : [],
    };
  } catch {
    return FALLBACK_ME;
  }
}

function OrgPageContent() {
  const router = useRouter();
  const [me, setMe] = React.useState<MeResponse | null>(null);
  const [authError, setAuthError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    const allowDevFallback =
      process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
    const authRequired =
      typeof window !== 'undefined' && window.location.search.includes('auth=required');

    apiFetch<Partial<MeResponse>>('/api/me').then(
      (response) => {
        if (!active) return;
        setMe({
          id: response.id ?? FALLBACK_ME.id,
          email: response.email ?? FALLBACK_ME.email,
          name: response.name ?? FALLBACK_ME.name,
          role: response.role ?? FALLBACK_ME.role,
          departmentId: response.departmentId ?? null,
          managedDepartmentIds: Array.isArray(response.managedDepartmentIds)
            ? response.managedDepartmentIds
            : [],
        });
      },
      () => {
        if (!active) return;
        if (!allowDevFallback || authRequired) {
          setAuthError('Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Đang chuyển tới trang đăng nhập…');
          router.replace('/login?next=%2Forg');
          return;
        }
        setMe(readSyncedDevProfile());
      },
    );
    return () => {
      active = false;
    };
  }, [router]);

  if (authError) {
    return (
      <section className="qx-page" aria-label="Danh bạ nhân sự">
        <div role="alert" className="hr-alert">
          <span>{authError}</span>
        </div>
      </section>
    );
  }
  if (!me) return <StateRegion state="loading" rows={6} />;
  return <QhrmDirectory me={me} />;
}

export default function OrgPage() {
  return (
    <React.Suspense fallback={<StateRegion state="loading" rows={6} />}>
      <OrgPageContent />
    </React.Suspense>
  );
}
