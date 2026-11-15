import { Suspense } from 'react';
import { MyTasksView } from '../../../components/qtask/MyTasksView';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MyTasksView />
    </Suspense>
  );
}
