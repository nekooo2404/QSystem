import { Suspense } from 'react';
import { QTaskWorkspace } from '../../components/qtask/QTaskWorkspace';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <QTaskWorkspace />
    </Suspense>
  );
}
