'use client';

import * as React from 'react';
import { MeResponseSchema, type MeResponse } from '@qsystem/contracts';
import { StateRegion } from '@qsystem/ui';
import { apiFetch } from '../../../lib/api/client';
import { QhrmDirectory } from '../../../components/qhrm/QhrmDirectory';

export default function OrgPage() {
  const [me, setMe] = React.useState<MeResponse | null>(null);

  // shortcut: the shell already asked GET /api/me; the page repeats it rather
  // than growing a context. Move `me` into a session context once a third
  // screen needs it.
  React.useEffect(() => {
    let active = true;
    apiFetch('/api/me', { schema: MeResponseSchema }).then(
      (response) => {
        if (active) setMe(response);
      },
      () => {
        /* SessionGuard already bounces a dead session; nothing to show here */
      },
    );
    return () => {
      active = false;
    };
  }, []);

  if (!me) return <StateRegion state="loading" rows={6} />;
  return <QhrmDirectory me={me} />;
}
