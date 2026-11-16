'use client';

import * as React from 'react';
import type { MeResponse } from '@qsystem/contracts';

export interface SessionContextValue {
  me: MeResponse | null;
  updateMe: (me: MeResponse | null) => void;
}

const SessionContext = React.createContext<SessionContextValue>({
  me: null,
  updateMe: () => {},
});

export function SessionProvider({
  me,
  children,
}: {
  me: MeResponse | null;
  children: React.ReactNode;
}): JSX.Element {
  const [currentMe, setCurrentMe] = React.useState<MeResponse | null>(me);

  React.useEffect(() => {
    setCurrentMe(me);
  }, [me]);

  const value = React.useMemo<SessionContextValue>(
    () => ({
      me: currentMe,
      updateMe: setCurrentMe,
    }),
    [currentMe],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  return React.useContext(SessionContext);
}
