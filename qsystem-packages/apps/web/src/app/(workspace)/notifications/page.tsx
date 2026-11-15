'use client';

import * as React from 'react';
import { StateRegion } from '@qsystem/ui';
import { ApiError } from '../../../lib/api/client';
import { humanizeApiError } from '../../../lib/errors/humanize';
import {
  formatNotifyStatus,
  markAllRead,
  markRead,
  startPolling,
  type NotificationItem,
} from '../../../lib/adapters/notifications.adapter';

/** Payloads carry a free-form `title`; anything richer is not in the contract yet. */
function titleOf(item: NotificationItem): string {
  const payload = item.payload;
  if (payload && typeof payload === 'object' && typeof (payload as { title?: unknown }).title === 'string') {
    return (payload as { title: string }).title;
  }
  return 'Thông báo hệ thống';
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationsPage() {
  const [items, setItems] = React.useState<NotificationItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const [readError, setReadError] = React.useState<Record<string, string>>({});
  const [entryError, setEntryError] = React.useState<string | null>(null);
  const writes = React.useRef(new Set<string>());
  const [pendingIds, setPendingIds] = React.useState(new Set<string>());
  const acknowledged = React.useRef(new Map<string, string>());
  const readAll = React.useRef<{ cutoff: number; readAt: string } | null>(null);
  const alive = React.useRef(true);
  const reconcile = React.useCallback((rows: NotificationItem[]) => rows.map(row => {
    const readAt = acknowledged.current.get(row.id) ?? (readAll.current && new Date(row.createdAt).getTime() <= readAll.current.cutoff ? readAll.current.readAt : null);
    return row.readAt || !readAt ? row : { ...row, readAt };
  }), []);

  React.useEffect(() => {
    alive.current = true;
    let active = true;
    const enteredAt = Date.now();
    void markAllRead().then(res => {
      if (!active || !res.readAt) return;
      readAll.current = { cutoff: Math.min(enteredAt, new Date(res.readAt).getTime()), readAt: res.readAt };
      setItems(current => current ? reconcile(current) : current);
    }).catch(() => { if (active) setEntryError('Chưa đánh dấu được các thông báo đã đọc. Bạn có thể đánh dấu từng thông báo.'); });
    return () => { active = false; alive.current = false; };
  }, [reconcile]);

  React.useEffect(() => {
    let active = true;
    setError(null);
    const fail = (err: unknown) => {
      if (!active) return;
      setError(
        humanizeApiError(err instanceof ApiError ? err.code : undefined, err instanceof ApiError ? err.status : undefined),
      );
    };
    // Polling yields nothing while the tab is hidden (startPolling checks it),
    // so a background tab costs no requests.
    const stop = startPolling((next) => {
      if (!active) return;
      setItems(reconcile(next));
      setError(null);
    }, 30_000, fail);
    return () => {
      active = false;
      stop();
    };
  }, [attempt, reconcile]);

  async function read(id: string) {
    if (writes.current.has(id)) return;
    writes.current.add(id);
    setPendingIds(new Set(writes.current));
    setReadError(current => { const next = { ...current }; delete next[id]; return next; });
    try {
      const updated = await markRead(id);
      if (!alive.current) return;
      if (updated.readAt) acknowledged.current.set(id, updated.readAt);
      setItems(current => current ? reconcile(current) : current);
    } catch {
      if (alive.current) setReadError(current => ({ ...current, [id]: 'Chưa đánh dấu được đã đọc. Vui lòng thử lại.' }));
    } finally {
      writes.current.delete(id);
      if (alive.current) setPendingIds(new Set(writes.current));
    }
  }

  if (error && items === null) {
    return <StateRegion state="error" errorDescription={error} onRetry={() => setAttempt(value => value + 1)} />;
  }

  if (items === null) {
    return <StateRegion state="loading" rows={5} />;
  }

  return (
    <section className="qs-notifications qs-page" aria-label="Thông báo">
      <h1>Thông báo</h1>
      {error ? <StateRegion state="error" errorDescription={error} onRetry={() => setAttempt(value => value + 1)} /> : null}
      {entryError ? <p role="status" className="qs-page__note">{entryError}</p> : null}
      {items.length === 0 ? (
        <StateRegion state="empty" emptyTitle="Chưa có thông báo nào" emptyDescription="Thông báo mới sẽ xuất hiện ở đây." />
      ) : (
        <ul className="qs-notifications__list">
          {items.map((item) => (
            <li key={item.id} className="qs-notifications__item" data-unread={item.readAt ? 'false' : 'true'}>
              <div className="qs-notifications__main">
                <p className="qs-notifications__title">{titleOf(item)}</p>
                <time dateTime={item.createdAt} className="qs-notifications__time">
                  {formatTime(item.createdAt)}
                </time>
              </div>
              {!item.readAt ? (
                <button
                  type="button"
                  className="qs-btn qs-btn--secondary qs-btn--sm"
                  disabled={pendingIds.has(item.id)}
                  aria-busy={pendingIds.has(item.id)}
                  onClick={() => void read(item.id)}
                >
                  {pendingIds.has(item.id) ? 'Đang đánh dấu…' : 'Đánh dấu đã đọc'}
                </button>
              ) : null}
              {readError[item.id] ? <p role="alert" className="qs-field__error">{readError[item.id]}</p> : null}
              <span className="qs-notifications__status" data-status={formatNotifyStatus(item.status)}>
                {formatNotifyStatus(item.status)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
