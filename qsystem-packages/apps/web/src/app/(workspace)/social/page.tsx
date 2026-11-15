'use client';

import * as React from 'react';
import { MeResponseSchema, type MeResponse } from '@qsystem/contracts';
import { StateRegion } from '@qsystem/ui';
import { QSocialWorkspace } from '../../../components/qsocial/QSocialWorkspace';
import { apiFetch } from '../../../lib/api/client';

export default function SocialPage() {
  const [me, setMe] = React.useState<MeResponse | null>(null);

  React.useEffect(() => {
    let active = true;
    apiFetch('/api/me', { schema: MeResponseSchema }).then(
      (response) => {
        if (active) setMe(response);
      },
      () => {
        /* SessionGuard already bounces an unauthenticated session */
      },
    );
    return () => {
      active = false;
    };
  }, []);

  if (!me) return <StateRegion state="loading" rows={6} />;
  return <QSocialWorkspace me={me} />;
}
