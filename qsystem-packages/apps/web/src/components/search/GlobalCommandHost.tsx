'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Contact, FileText, ListChecks, MessageSquare, Moon, Plus, Users } from 'lucide-react';
import { CommandPalette, useCommandPaletteHotkey, type CommandGroup } from '@qsystem/ui';
import { SearchResultSchema } from '@qsystem/contracts';
import { STATIC_MODULES } from '../../lib/adapters/registry.adapter';
import { apiFetch } from '../../lib/api/client';
import { useTheme } from '../../lib/theme';

const MODULE_HOME: Record<string, string> = { qtask: '/', qhrm: '/org', qcrm: '/crm', qsocial: '/social' };

const MODULE_ICONS: Record<string, React.ReactNode> = {
  qtask: <ListChecks size={16} strokeWidth={1.5} />,
  qhrm: <Users size={16} strokeWidth={1.5} />,
  qcrm: <Contact size={16} strokeWidth={1.5} />,
  qsocial: <MessageSquare size={16} strokeWidth={1.5} />,
};

const DEBOUNCE_MS = 250;

/** The `documents` Meili index carries exactly id + title. */
interface Hit {
  id: string;
  title: string;
}

function toHits(hits: Array<Record<string, unknown>>): Hit[] {
  return hits.flatMap((hit) =>
    typeof hit.id === 'string' && typeof hit.title === 'string' ? [{ id: hit.id, title: hit.title }] : [],
  );
}

export interface GlobalCommandHostProps {
  /** Palette visibility is shared with the shell's top bar search button. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalCommandHost({ open, onOpenChange }: GlobalCommandHostProps) {
  const router = useRouter();
  const { toggle: toggleTheme } = useTheme();
  const [query, setQuery] = React.useState('');
  const [hits, setHits] = React.useState<Hit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [attempt, setAttempt] = React.useState(0);

  useCommandPaletteHotkey({ open, onOpenChange });

  const close = React.useCallback(
    (next: boolean) => {
      onOpenChange(next);
      if (!next) {
        setQuery('');
        setHits([]);
        setLoading(false);
      }
    },
    [onOpenChange],
  );

  React.useEffect(() => {
    const needle = query.trim();
    setError(undefined);
    setHits([]);
    if (!open || !needle) {
      setHits([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    // One request per typing burst, not per keystroke.
    const timer = setTimeout(() => {
      apiFetch(`/api/search?q=${encodeURIComponent(needle)}`, { schema: SearchResultSchema }).then(
        (result) => {
          if (!active) return;
          setHits(toHits(result.hits));
          setLoading(false);
        },
        () => {
          if (!active) return;
          setHits([]);
          setError('Chưa tìm được tài liệu. Vui lòng thử lại.');
          setLoading(false);
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, open, attempt]);

  const go = React.useCallback(
    (href: string) => {
      close(false);
      router.push(href);
    },
    [close, router],
  );

  const groups: CommandGroup[] = [
    {
      id: 'go',
      label: 'Đi tới',
      items: [
        { id: 'go-org', label: 'Danh bạ nhân sự', icon: <Users size={16} strokeWidth={1.5} />, onSelect: () => go('/org') },
        { id: 'go-tasks', label: 'Tất cả công việc', icon: <ListChecks size={16} strokeWidth={1.5} />, onSelect: () => go('/') },
        { id: 'go-files', label: 'Tài liệu', icon: <FileText size={16} strokeWidth={1.5} />, onSelect: () => go('/files') },
        { id: 'go-account', label: 'Tài khoản', icon: <Users size={16} strokeWidth={1.5} />, onSelect: () => go('/account') },
      ],
    },
    {
      id: 'apps',
      label: 'Chuyển ứng dụng',
      items: STATIC_MODULES.map((module) => ({
        id: `app-${module.id}`,
        label: module.name,
        hint: module.description,
        icon: MODULE_ICONS[module.id],
        onSelect: () => go(MODULE_HOME[module.id] ?? '/'),
      })),
    },
    {
      id: 'actions',
      label: 'Thao tác nhanh',
      items: [
        { id: 'action-add-person', label: 'Thêm nhân sự', icon: <Plus size={16} strokeWidth={1.5} />, onSelect: () => go('/org') },
        { id: 'action-add-task', label: 'Giao việc mới', icon: <Plus size={16} strokeWidth={1.5} />, onSelect: () => go('/') },
        {
          id: 'action-theme',
          label: 'Chuyển giao diện sáng/tối',
          icon: <Moon size={16} strokeWidth={1.5} />,
          onSelect: toggleTheme,
        },
      ],
    },
  ];

  if (hits.length > 0) {
    groups.unshift({
      id: 'documents',
      label: 'Tài liệu',
      items: hits.map((hit) => ({
        id: `hit-${hit.id}`,
        label: hit.title,
        icon: <FileText size={16} strokeWidth={1.5} />,
        onSelect: () => go('/files'),
      })),
    });
  }

  return (
    <CommandPalette
      open={open}
      onOpenChange={close}
      query={query}
      onQueryChange={setQuery}
      groups={groups}
      loading={loading}
      errorText={error}
      onRetry={() => { if (!loading) setAttempt(value => value + 1); }}
    />
  );
}
