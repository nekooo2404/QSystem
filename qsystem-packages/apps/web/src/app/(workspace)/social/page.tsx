'use client';

import * as React from 'react';
import { MeResponseSchema, type MeResponse } from '@qsystem/contracts';
import { StateRegion } from '@qsystem/ui';
import { QSocialWorkspace } from '../../../components/qsocial/QSocialWorkspace';
import { apiFetch } from '../../../lib/api/client';
import { useSession } from '../../../lib/auth/session-context';

const FALLBACK_ME: MeResponse = {
  id: 'u-director-01',
  name: 'Minh Khôi',
  email: 'minhkhoi@qsystem.vn',
  role: 'DIRECTOR',
  departmentId: null,
  managedDepartmentIds: [],
};

const isStrictProd =
  process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_DEMO_MODE !== 'true';

function resolveLocalFallbackMe(): MeResponse {
  if (typeof window === 'undefined') return FALLBACK_ME;
  try {
    const raw = window.localStorage.getItem('qsystem:account:profile:v1');
    if (!raw) return FALLBACK_ME;
    const parsed = JSON.parse(raw) as Partial<MeResponse>;
    return {
      ...FALLBACK_ME,
      ...(typeof parsed.name === 'string' && parsed.name.trim() ? { name: parsed.name.trim() } : {}),
      ...(typeof parsed.email === 'string' && parsed.email.trim() ? { email: parsed.email.trim() } : {}),
    };
  } catch {
    return FALLBACK_ME;
  }
}

export default function SocialPage() {
  const { me: sessionMe } = useSession();
  const [me, setMe] = React.useState<MeResponse | null>(sessionMe);
  const [failed, setFailed] = React.useState(false);

  const loadMe = React.useCallback(() => {
    setFailed(false);
    apiFetch('/api/me', { schema: MeResponseSchema }).then(
      (response) => {
        setMe(response);
      },
      () => {
        if (isStrictProd) {
          setFailed(true);
        } else {
          setMe(resolveLocalFallbackMe());
        }
      },
    );
  }, []);

  React.useEffect(() => {
    if (sessionMe) {
      setMe(sessionMe);
      return;
    }
    loadMe();
  }, [sessionMe, loadMe]);

  if (failed) {
    return <StateRegion state="error" onRetry={loadMe} />;
  }
  if (!me) return <StateRegion state="loading" rows={6} />;
  return <QSocialWorkspace me={me} />;
}
