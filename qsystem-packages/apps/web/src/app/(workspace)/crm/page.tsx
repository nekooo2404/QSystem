import { Suspense } from 'react';
import { CrmWorkspace } from '../../../components/qcrm/CrmCustomers';

export default function CrmPage() {
  return (
    <Suspense fallback={null}>
      <CrmWorkspace />
    </Suspense>
  );
}
