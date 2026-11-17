'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart3, Bookmark, Check, Clock, FileText, MessageCircle, Settings, SquareCheck } from 'lucide-react';
import { StateRegion, toast } from '@qsystem/ui';
import {
  formatNotifyStatus,
  markAllRead,
  markRead,
  notificationTitle,
  startPolling,
  type NotificationItem,
} from '../../../lib/adapters/notifications.adapter';
import { ApiError } from '../../../lib/api/client';
import { humanizeApiError } from '../../../lib/errors/humanize';
import '../../../components/notifications/notifications.css';

type Kind = 'clock' | 'mention' | 'task' | 'chart' | 'doc';

interface Row {
  id: string;
  kind: Kind;
  title: string;
  desc: string;
  time: string;
  unread: boolean;
  saved?: boolean;
  priority?: boolean;
  remote?: boolean;
  statusLabel?: string;
}

interface StoredNotificationsState {
  readIds?: string[];
  savedIds?: string[];
  prefs?: boolean[];
  olderLoaded?: boolean;
}

const NOTIFICATIONS_STORAGE_KEY = 'qsystem:notifications:v1';

const SAMPLE: Row[] = [
  { id: 's1', kind: 'clock', title: 'Công việc của bạn sắp đến hạn', desc: 'CV-1004 · Duyệt yêu cầu nghỉ phép, hạn hôm nay', time: '5 phút trước', unread: true, priority: true },
  { id: 's2', kind: 'mention', title: 'Lan Anh đã nhắc đến bạn', desc: '“Anh xem giúp em tiến độ dự án QHRM nhé.”', time: '26 phút trước', unread: true, priority: true },
  { id: 's3', kind: 'task', title: 'Bạn được giao công việc mới', desc: 'Kiểm tra phân quyền người dùng QSystem', time: '1 giờ trước', unread: true, priority: true },
  { id: 's4', kind: 'chart', title: 'Dự án QCRM V2 đạt mốc 30%', desc: 'Tiến độ dự án vừa được cập nhật', time: 'Hôm qua', unread: false, priority: true, saved: true },
  { id: 's5', kind: 'doc', title: 'Báo cáo tháng 11 đã được đăng', desc: 'Tài liệu mới trong thư mục dùng chung', time: 'Hôm qua', unread: false, priority: true },
];

const OLDER_SAMPLE: Row[] = [
  { id: 's6', kind: 'task', title: 'Hoàn tất đồng bộ danh mục khách hàng QCRM', desc: '124 hồ sơ đã được cập nhật tự động', time: '2 ngày trước', unread: false },
  { id: 's7', kind: 'mention', title: 'Hoàng Nam đã bình luận về kế hoạch Q4', desc: '“Mục tiêu doanh thu và nhân sự đã chốt xong.”', time: '3 ngày trước', unread: false, saved: true },
  { id: 's8', kind: 'doc', title: 'Quy chế bảo mật dữ liệu nội bộ v2.4', desc: 'Tài liệu đã được ban hành tới toàn bộ phòng ban', time: '5 ngày trước', unread: false },
];

const ICONS: Record<Kind, React.ReactNode> = {
  clock: <Clock size={17} strokeWidth={1.6} aria-hidden="true" />,
  mention: <MessageCircle size={17} strokeWidth={1.6} aria-hidden="true" />,
  task: <SquareCheck size={17} strokeWidth={1.6} aria-hidden="true" />,
  chart: <BarChart3 size={17} strokeWidth={1.6} aria-hidden="true" />,
  doc: <FileText size={17} strokeWidth={1.6} aria-hidden="true" />,
};

const TABS = [
  { id: 'priority', label: 'Ưu tiên' },
  { id: 'all', label: 'Tất cả' },
  { id: 'unread', label: 'Chưa đọc' },
  { id: 'saved', label: 'Đã lưu' },
] as const;

const PREFS = ['QTask · Công việc', 'QHRM · Nhân sự', 'QCRM · Khách hàng', 'QSocial · Bảng tin'];

function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test';
}

function allowDevOfflineFallback(): boolean {
  if (isTestEnvironment()) return false;
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') {
    return false;
  }
  return true;
}

function readStoredState(): StoredNotificationsState {
  if (typeof window === 'undefined' || !allowDevOfflineFallback()) return {};
  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredNotificationsState;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredState(patch: Partial<StoredNotificationsState>): void {
  if (typeof window === 'undefined' || !allowDevOfflineFallback()) return;
  try {
    const prev = readStoredState();
    window.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify({ ...prev, ...patch }));
  } catch {
    // Ignore storage quota errors in restricted environments.
  }
}

function buildFallbackRows(stored: StoredNotificationsState): Row[] {
  const readSet = new Set(Array.isArray(stored.readIds) ? stored.readIds : []);
  const savedSet = new Set(Array.isArray(stored.savedIds) ? stored.savedIds : []);
  const hasSavedOverride = Array.isArray(stored.savedIds);
  const base = stored.olderLoaded ? [...SAMPLE, ...OLDER_SAMPLE] : SAMPLE;
  return base.map((item) => ({
    ...item,
    unread: readSet.has(item.id) ? false : item.unread,
    saved: hasSavedOverride ? savedSet.has(item.id) : item.saved,
  }));
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 60) return `${min} phút trước`;
  if (min < 1440) return `${Math.round(min / 60)} giờ trước`;
  return min < 2880 ? 'Hôm qua' : `${Math.round(min / 1440)} ngày trước`;
}

function toRow(item: NotificationItem, savedSet?: Set<string>): Row {
  const p = (item.payload ?? {}) as { title?: unknown; body?: unknown };
  const title = notificationTitle(item);
  const body = typeof p.body === 'string' && p.body.trim() && p.body.trim() !== title ? p.body.trim() : '';
  return {
    id: item.id,
    kind: 'task',
    remote: true,
    priority: true,
    title,
    desc: body,
    time: relTime(item.createdAt),
    unread: !item.readAt,
    saved: savedSet ? savedSet.has(item.id) : false,
    statusLabel: formatNotifyStatus(item.status),
  };
}

function humanizeError(err: unknown): string {
  if (err instanceof ApiError) {
    return humanizeApiError(err.code, err.status);
  }
  const maybe = err as { code?: string; status?: number } | null;
  if (maybe && (typeof maybe.code === 'string' || typeof maybe.status === 'number')) {
    return humanizeApiError(maybe.code, maybe.status);
  }
  return humanizeApiError(undefined, undefined);
}

export default function NotificationsPage() {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [refreshError, setRefreshError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const [tab, setTab] = React.useState<(typeof TABS)[number]['id']>('priority');
  const [prefs, setPrefs] = React.useState<boolean[]>(() => {
    const stored = readStoredState();
    return Array.isArray(stored.prefs) && stored.prefs.length === PREFS.length
      ? stored.prefs.map(Boolean)
      : PREFS.map(() => true);
  });
  const [olderLoaded, setOlderLoaded] = React.useState(() => Boolean(readStoredState().olderLoaded));
  const [status, setStatus] = React.useState('');
  const [pendingReadIds, setPendingReadIds] = React.useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = React.useState<Record<string, string>>({});
  const [markingAll, setMarkingAll] = React.useState(false);

  const firstPrefRef = React.useRef<HTMLButtonElement>(null);
  const rowsRef = React.useRef<Row[]>(rows);
  rowsRef.current = rows;

  React.useEffect(() => {
    let active = true;
    if (rowsRef.current.length === 0) {
      setLoading(true);
    }
    setLoadError(null);
    setRefreshError(null);

    const stop = startPolling(
      (next) => {
        if (!active) return;
        const stored = readStoredState();
        const savedSet = allowDevOfflineFallback() && Array.isArray(stored.savedIds) ? new Set(stored.savedIds) : undefined;
        setRows(next.map((item) => toRow(item, savedSet)));
        setLoading(false);
        setLoadError(null);
        setRefreshError(null);
      },
      30_000,
      (err) => {
        if (!active) return;
        if (allowDevOfflineFallback()) {
          if (rowsRef.current.length === 0) {
            const stored = readStoredState();
            setRows(buildFallbackRows(stored));
            if (stored.olderLoaded) setOlderLoaded(true);
          }
          setLoading(false);
          return;
        }
        const message = humanizeError(err);
        setLoading(false);
        if (rowsRef.current.length > 0) {
          setRefreshError(message);
        } else {
          setLoadError(message);
        }
      },
    );
    return () => {
      active = false;
      stop();
    };
  }, [attempt]);

  const unreadCount = rows.filter((r) => r.unread).length;
  const visible = rows.filter((r) =>
    tab === 'all' ? true : tab === 'unread' ? r.unread : tab === 'saved' ? r.saved : r.priority,
  );

  function persistDevRows(nextRows: Row[], extra?: Partial<StoredNotificationsState>) {
    if (!allowDevOfflineFallback()) return;
    writeStoredState({
      readIds: nextRows.filter((r) => !r.unread).map((r) => r.id),
      savedIds: nextRows.filter((r) => r.saved).map((r) => r.id),
      ...extra,
    });
  }

  async function readOne(row: Row) {
    if (!row.unread || pendingReadIds[row.id]) return;
    setRowErrors((prev) => {
      if (!prev[row.id]) return prev;
      const next = { ...prev };
      delete next[row.id];
      return next;
    });

    if (row.remote) {
      setPendingReadIds((prev) => ({ ...prev, [row.id]: true }));
      try {
        await markRead(row.id);
        setRows((cur) => {
          const next = cur.map((r) => (r.id === row.id ? { ...r, unread: false } : r));
          persistDevRows(next);
          return next;
        });
        setStatus(`Đã đọc: ${row.title}`);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? humanizeError(err)
            : 'Chưa đánh dấu được đã đọc. Vui lòng thử lại.';
        setRowErrors((prev) => ({ ...prev, [row.id]: message }));
      } finally {
        setPendingReadIds((prev) => {
          const next = { ...prev };
          delete next[row.id];
          return next;
        });
      }
      return;
    }

    setRows((cur) => {
      const next = cur.map((r) => (r.id === row.id ? { ...r, unread: false } : r));
      persistDevRows(next);
      return next;
    });
    setStatus(`Đã đọc: ${row.title}`);
  }

  async function readEverything() {
    if (markingAll) return;
    const hasRemote = rows.some((r) => r.remote);
    if (hasRemote) {
      setMarkingAll(true);
      setRefreshError(null);
      try {
        await markAllRead();
        setRows((cur) => {
          const next = cur.map((r) => ({ ...r, unread: false }));
          persistDevRows(next);
          return next;
        });
        const msg = 'Đã đánh dấu tất cả là đã đọc.';
        setStatus(msg);
        toast.success(msg);
      } catch (err) {
        setRefreshError(humanizeError(err));
      } finally {
        setMarkingAll(false);
      }
      return;
    }

    setRows((cur) => {
      const next = cur.map((r) => ({ ...r, unread: false }));
      persistDevRows(next);
      return next;
    });
    const msg = 'Đã đánh dấu tất cả là đã đọc.';
    setStatus(msg);
    toast.success(msg);
  }

  function toggleSaved(row: Row) {
    const nextSaved = !row.saved;
    setRows((cur) => {
      const next = cur.map((r) => (r.id === row.id ? { ...r, saved: nextSaved } : r));
      persistDevRows(next);
      return next;
    });
    const msg = nextSaved ? 'Đã lưu thông báo vào mục Đã lưu.' : 'Đã bỏ lưu thông báo.';
    setStatus(msg);
    toast.success(msg);
  }

  function loadOlder() {
    if (olderLoaded || !allowDevOfflineFallback()) return;
    setRows((cur) => {
      const seen = new Set(cur.map((item) => item.id));
      const stored = readStoredState();
      const readSet = new Set(Array.isArray(stored.readIds) ? stored.readIds : []);
      const savedSet = new Set(Array.isArray(stored.savedIds) ? stored.savedIds : []);
      const hasSavedOverride = Array.isArray(stored.savedIds);
      const additions = OLDER_SAMPLE.filter((item) => !seen.has(item.id)).map((item) => ({
        ...item,
        unread: readSet.has(item.id) ? false : item.unread,
        saved: hasSavedOverride ? savedSet.has(item.id) : item.saved,
      }));
      const next = [...cur, ...additions];
      persistDevRows(next, { olderLoaded: true });
      return next;
    });
    setOlderLoaded(true);
    setTab('all');
    const msg = 'Đã tải thêm 3 thông báo trước đó.';
    setStatus(msg);
    toast.success(msg);
  }

  function focusPrefs() {
    firstPrefRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    firstPrefRef.current?.focus();
    setStatus('Đang chuyển tới cài đặt kênh thông báo.');
  }

  function retryLoad() {
    setAttempt((value) => value + 1);
  }

  return (
    <section className="qx-page" aria-label="Trung tâm thông báo">
      <header className="qx-page-head">
        <div>
          <h1>Trung tâm thông báo</h1>
          <p>Không bỏ lỡ những cập nhật quan trọng từ QSystem</p>
        </div>
        <div className="qx-actions">
          <button type="button" className="qx-btn" disabled={markingAll} onClick={() => void readEverything()}>
            <Check size={15} aria-hidden="true" />
            <span>Đánh dấu đã đọc</span>
          </button>
          <button type="button" className="qx-btn" onClick={focusPrefs}>
            <Settings size={15} aria-hidden="true" />
            <span>Cài đặt</span>
          </button>
        </div>
      </header>
      <p
        role="status"
        className="sr-only"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
      >
        {status}
      </p>

      <div className="qn-grid">
        <div className="qx-card qn-list">
          <div className="qx-tabs" role="tablist" aria-label="Lọc thông báo">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                className="qx-tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.id === 'priority' ? ` (${unreadCount})` : ''}
              </button>
            ))}
          </div>

          <div role="tabpanel">
            {refreshError ? (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '12px 20px',
                  borderBottom: '1px solid var(--qs-border)',
                  background: 'color-mix(in srgb, var(--qs-error) 10%, var(--qs-surface-1))',
                  color: 'var(--qs-fg)',
                  fontSize: '12.5px',
                }}
              >
                <span>{refreshError}</span>
                <button type="button" className="qx-btn qx-btn--sm" onClick={retryLoad}>
                  Thử lại
                </button>
              </div>
            ) : null}

            {loading && rows.length === 0 ? (
              <div style={{ padding: '20px' }}>
                <StateRegion state="loading" rows={4} />
              </div>
            ) : loadError && rows.length === 0 ? (
              <div style={{ padding: '20px' }}>
                <StateRegion state="error" errorDescription={loadError} onRetry={retryLoad} />
              </div>
            ) : (
              <ul className="qn-items" aria-label="Danh sách thông báo">
                {visible.length === 0 ? (
                  <li className="qn-empty">Không có thông báo nào trong mục này.</li>
                ) : (
                  visible.map((row) => {
                    const rowPending = Boolean(pendingReadIds[row.id]);
                    const rowErr = rowErrors[row.id];
                    return (
                      <li key={row.id} className="qn-item" data-unread={row.unread}>
                        <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: '6px' }}>
                          <button
                            type="button"
                            disabled={rowPending}
                            onClick={() => void readOne(row)}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '16px',
                              padding: 0,
                              border: 0,
                              background: 'transparent',
                              textAlign: 'left',
                              font: 'inherit',
                              color: 'inherit',
                              cursor: rowPending ? 'wait' : 'pointer',
                            }}
                          >
                            <span
                              className={`qn-icon${row.kind === 'clock' ? ' qn-icon--amber' : ''}`}
                              aria-hidden="true"
                            >
                              {ICONS[row.kind]}
                            </span>
                            <div className="qn-main">
                              <p className="qn-title">{row.title}</p>
                              {row.desc ? <p className="qn-desc">{row.desc}</p> : null}
                            </div>
                          </button>
                          {rowErr ? (
                            <p
                              role="alert"
                              style={{
                                margin: '0 0 0 53px',
                                fontSize: '12px',
                                color: 'var(--qs-error)',
                              }}
                            >
                              {rowErr}
                            </p>
                          ) : null}
                        </div>

                        <div className="qn-meta">
                          {row.statusLabel ? (
                            <span
                              className="qx-badge"
                              style={{
                                fontSize: '11px',
                                padding: '2px 8px',
                                borderRadius: 'var(--qs-radius-sm)',
                                border: '1px solid var(--qs-border)',
                                color: 'var(--qs-fg-muted)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {row.statusLabel}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            className="qn-save-btn"
                            aria-pressed={Boolean(row.saved)}
                            aria-label={row.saved ? 'Bỏ lưu thông báo' : 'Lưu thông báo'}
                            title={row.saved ? 'Bỏ lưu' : 'Lưu thông báo'}
                            onClick={() => toggleSaved(row)}
                          >
                            <Bookmark size={14} strokeWidth={1.7} aria-hidden="true" />
                          </button>
                          <span className="qn-time">{row.time}</span>
                          {row.unread ? (
                            <button
                              type="button"
                              aria-label="Đánh dấu đã đọc"
                              title="Đánh dấu đã đọc"
                              disabled={rowPending}
                              onClick={() => void readOne(row)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '28px',
                                height: '28px',
                                border: '1px solid transparent',
                                borderRadius: '6px',
                                background: 'transparent',
                                padding: 0,
                                cursor: rowPending ? 'not-allowed' : 'pointer',
                                opacity: rowPending ? 0.5 : 1,
                              }}
                            >
                              <span className="qn-dot" aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>

          {allowDevOfflineFallback() ? (
            <div className="qn-more">
              <button type="button" className="qn-more-btn" disabled={olderLoaded} onClick={loadOlder}>
                <span>{olderLoaded ? 'Đã hiển thị toàn bộ thông báo trước đó' : 'Xem các thông báo trước đó'}</span>
                {olderLoaded ? null : <ArrowRight size={13} aria-hidden="true" />}
              </button>
            </div>
          ) : null}
        </div>

        <aside className="qn-side">
          <div className="qx-card">
            <h2>Quản lý thông báo</h2>
            <p>Chọn các cập nhật bạn muốn nhận từ từng phân hệ.</p>
            <ul className="qn-pref">
              {PREFS.map((label, i) => (
                <li key={label}>
                  <span>{label}</span>
                  <button
                    ref={i === 0 ? firstPrefRef : undefined}
                    type="button"
                    aria-pressed={prefs[i]}
                    aria-label={`${label}: ${prefs[i] ? 'Bật' : 'Tắt'}`}
                    onClick={() => {
                      const nextOn = !prefs[i];
                      setPrefs((cur) => {
                        const next = cur.map((v, j) => (j === i ? nextOn : v));
                        writeStoredState({ prefs: next });
                        return next;
                      });
                      setStatus(`${label}: ${nextOn ? 'Đã bật' : 'Đã tắt'}.`);
                    }}
                  >
                    {prefs[i] ? 'Bật' : 'Tắt'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="qx-card">
            <h2>Cần chú ý</h2>
            <Link href="/?view=overdue" className="qn-warn-link">
              Công việc quá hạn
            </Link>
            <p>Hoàn thành hoặc cập nhật thời hạn để không bỏ lỡ tiến độ.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

