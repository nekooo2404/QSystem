import { Suspense } from 'react';
import { ProjectsView } from '../../../components/qtask/ProjectsView';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProjectsView />
    </Suspense>
  );
}
