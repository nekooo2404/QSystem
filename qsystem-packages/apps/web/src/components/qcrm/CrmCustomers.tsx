'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { cachedApiFetch } from '../../lib/api/client';
import { getCachedEntry } from '../../lib/api/cache';
import {
  buildSampleCustomers,
  canUseCrmApiFallback,
  DEFAULT_CRM_OWNERS,
  loadStoredContacts,
  loadStoredOpportunities,
  persistStoredContacts,
  persistStoredCustomers,
  persistStoredOpportunities,
  readStoredCustomers,
  type ContactRow,
  type CrmMuc,
  type CustomerRow,
  type OpportunityRow,
} from './crm.storage';
import { CrmContactsView } from './CrmContactsView';
import { CrmCustomersView } from './CrmCustomersView';
import { CrmOpportunitiesView } from './CrmOpportunitiesView';
import { CrmOverviewView } from './CrmOverviewView';
import { CrmReportsView } from './CrmReportsView';
import './qcrm.css';

function useSafeSearchParams() {
  try {
    return useSearchParams();
  } catch {
    return null;
  }
}

export function CrmWorkspace() {
  const searchParams = useSafeSearchParams();
  const rawMuc = searchParams?.get('muc');
  const activeMuc: CrmMuc =
    rawMuc === 'tong-quan' ||
    rawMuc === 'co-hoi' ||
    rawMuc === 'lien-he' ||
    rawMuc === 'bao-cao'
      ? rawMuc
      : 'khach-hang';
  const initialQuery = searchParams?.get('q') ?? '';

  const [customers, setCustomers] = React.useState<CustomerRow[] | null>(() => {
    const cached = getCachedEntry<{ items?: CustomerRow[] } | CustomerRow[]>(
      '/api/org/crm/customers',
    );
    if (cached) {
      return Array.isArray(cached) ? cached : (cached.items ?? null);
    }
    if (canUseCrmApiFallback()) {
      return readStoredCustomers() ?? buildSampleCustomers();
    }
    return null;
  });
  const [isDemoFallback, setIsDemoFallback] = React.useState<boolean>(() => {
    const cached = getCachedEntry<{ items?: CustomerRow[] } | CustomerRow[]>(
      '/api/org/crm/customers',
    );
    return !cached;
  });
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [opportunities, setOpportunities] = React.useState<OpportunityRow[]>(() =>
    loadStoredOpportunities(),
  );
  const [contacts, setContacts] = React.useState<ContactRow[]>(() => loadStoredContacts());
  const [apiUsers, setApiUsers] = React.useState<string[]>([]);

  const hydrateDevCrm = React.useCallback(() => {
    const stored = readStoredCustomers();
    const initial = stored ?? buildSampleCustomers();
    setCustomers(initial);
    setIsDemoFallback(true);
    setLoadError(null);
    persistStoredCustomers(initial);
  }, []);

  const loadCustomers = React.useCallback(() => {
    let active = true;
    const allowLocal = canUseCrmApiFallback();
    setLoadError(null);

    cachedApiFetch<{ items?: CustomerRow[] } | CustomerRow[]>('/api/org/crm/customers').then(
      (res) => {
        if (!active) return;
        const list = Array.isArray(res) ? res : (res.items ?? []);
        if (allowLocal && list.length === 0) {
          hydrateDevCrm();
          return;
        }
        setCustomers(list);
        setIsDemoFallback(false);
        setLoadError(null);
      },
      () => {
        if (!active) return;
        if (allowLocal) {
          hydrateDevCrm();
          return;
        }
        setCustomers([]);
        setIsDemoFallback(false);
        setLoadError('Không thể tải danh sách khách hàng. Vui lòng thử lại.');
      },
    );

    cachedApiFetch<Array<{ name?: string }>>('/api/org/users').then(
      (rows) => {
        if (!active || !Array.isArray(rows)) return;
        const names = rows
          .map((row) => (typeof row.name === 'string' ? row.name.trim() : ''))
          .filter(Boolean);
        if (names.length > 0) setApiUsers(names);
      },
      () => {
        // Ignore optional user directory error
      },
    );

    return () => {
      active = false;
    };
  }, [hydrateDevCrm]);

  React.useEffect(() => {
    return loadCustomers();
  }, [loadCustomers]);

  // API-first: an empty or failed backend response renders as empty/loading,
  // never as fabricated sample customers (demo mode hydrates elsewhere).
  const effectiveCustomers = customers ?? [];

  const ownerNames = React.useMemo(() => {
    const set = new Set<string>(DEFAULT_CRM_OWNERS.map((o) => o.name));
    for (const u of apiUsers) set.add(u);
    for (const c of effectiveCustomers) {
      if (c.ownerName) set.add(c.ownerName);
    }
    return Array.from(set);
  }, [apiUsers, effectiveCustomers]);

  const handleUpdateCustomers = React.useCallback((next: CustomerRow[]) => {
    setCustomers(next);
    persistStoredCustomers(next);
  }, []);

  const handleUpdateOpportunities = React.useCallback((next: OpportunityRow[]) => {
    setOpportunities(next);
    persistStoredOpportunities(next);
  }, []);

  const handleUpdateContacts = React.useCallback((next: ContactRow[]) => {
    setContacts(next);
    persistStoredContacts(next);
  }, []);

  if (activeMuc === 'tong-quan') {
    return (
      <CrmOverviewView
        customers={effectiveCustomers}
        opportunities={opportunities}
        contacts={contacts}
      />
    );
  }

  if (activeMuc === 'co-hoi') {
    return (
      <CrmOpportunitiesView
        opportunities={opportunities}
        customers={effectiveCustomers}
        ownerNames={ownerNames}
        onUpdateOpportunities={handleUpdateOpportunities}
      />
    );
  }

  if (activeMuc === 'lien-he') {
    return (
      <CrmContactsView
        contacts={contacts}
        customers={effectiveCustomers}
        ownerNames={ownerNames}
        onUpdateContacts={handleUpdateContacts}
      />
    );
  }

  if (activeMuc === 'bao-cao') {
    return (
      <CrmReportsView
        customers={effectiveCustomers}
        opportunities={opportunities}
        contacts={contacts}
        ownerNames={ownerNames}
      />
    );
  }

  return (
    <CrmCustomersView
      customers={customers}
      opportunities={opportunities}
      contacts={contacts}
      ownerNames={ownerNames}
      isDemoFallback={isDemoFallback}
      loadError={loadError}
      initialSearch={initialQuery}
      onRetry={loadCustomers}
      onUpdateCustomers={handleUpdateCustomers}
    />
  );
}

/** Backward-compatible named export used by `app/(workspace)/crm/page.tsx`. */
export function CrmCustomers() {
  return <CrmWorkspace />;
}
