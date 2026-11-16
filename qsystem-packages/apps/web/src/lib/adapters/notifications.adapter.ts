import type { NotifyChannel, NotifyStatus, Role } from '@qsystem/contracts';
import { apiFetch, getAccessToken } from '../api/client';

export interface NotificationItem {
  id: string;
  channel: NotifyChannel;
  recipient: string;
  recipientId: string | null;
  payload: Record<string, unknown> | null;
  status: NotifyStatus;
  attempts: number;
  readAt?: string | null;
  createdAt: string;
}

const ROLE_LABELS: Record<Role, string> = {
  DIRECTOR: 'Giám đốc',
  MANAGER: 'Quản lý',
  EMPLOYEE: 'Nhân viên',
};

export function formatRole(role: string): string {
  return ROLE_LABELS[role as Role] ?? role;
}

const STATUS_LABELS: Record<NotifyStatus, string> = {
  PENDING: 'Chờ gửi',
  SENT: 'Đã gửi',
  FAILED: 'Gửi lỗi',
  DEAD: 'Gửi lỗi',
};

export function formatNotifyStatus(status: NotifyStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function notificationTitle(item: NotificationItem): string {
  const payload = item.payload ?? {};
  for (const key of ['title', 'subject', 'message', 'text', 'body'] as const) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return 'Thông báo hệ thống';
}

export function countUnread(items: NotificationItem[]): number {
  return items.filter((item) => item.readAt === null || item.readAt === undefined).length;
}

export function list(): Promise<NotificationItem[]> {
  return apiFetch<NotificationItem[]>('/api/notifications');
}

export function markRead(id: string): Promise<NotificationItem> {
  return apiFetch<NotificationItem>(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
  });
}

export function markAllRead(): Promise<{ ok: true; count: number; readAt: string }> {
  return apiFetch<{ ok: true; count: number; readAt: string }>('/api/notifications/read-all', {
    method: 'POST',
  });
}

interface PollingSubscriber {
  onUpdate: (items: NotificationItem[]) => void;
  intervalMs: number;
  onError?: (err: unknown) => void;
}

const subscribers = new Set<PollingSubscriber>();
let sharedTimer: ReturnType<typeof setTimeout> | null = null;
let sharedStreamController: AbortController | null = null;
let sharedInFlight = false;
let sharedItems: NotificationItem[] | null = null;
let isListeningVisibility = false;

async function singletonPull() {
  if (subscribers.size === 0 || (typeof document !== 'undefined' && document.hidden) || sharedInFlight) return;
  sharedInFlight = true;
  try {
    const items = await list();
    sharedItems = items;
    for (const sub of Array.from(subscribers)) {
      try {
        sub.onUpdate(items);
      } catch {
        // ignore subscriber errors
      }
    }
  } catch (err) {
    for (const sub of Array.from(subscribers)) {
      try {
        sub.onError?.(err);
      } catch {
        // ignore subscriber errors
      }
    }
  } finally {
    sharedInFlight = false;
  }
}

function getMinInterval(): number {
  if (subscribers.size === 0) return 30_000;
  let min = 30_000;
  for (const sub of subscribers) {
    if (sub.intervalMs < min) min = sub.intervalMs;
  }
  return min;
}

function scheduleSingleton() {
  if (sharedTimer) clearTimeout(sharedTimer);
  if (subscribers.size === 0) return;
  const interval = getMinInterval();
  sharedTimer = setTimeout(() => {
    void singletonPull().then(scheduleSingleton);
  }, interval);
}

function startSingletonStream() {
  if (sharedStreamController || typeof AbortController === 'undefined') return;
  const token = getAccessToken();
  if (!token) return;
  const ctrl = new AbortController();
  sharedStreamController = ctrl;
  void fetch('/api/notifications/stream', {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
    signal: ctrl.signal,
  })
    .then(async (res) => {
      const reader = res.body?.getReader?.();
      if (!res.ok || !reader) return;
      const decoder = new TextDecoder();
      while (subscribers.size > 0 && !ctrl.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk.includes('event: notification')) {
          void singletonPull();
        }
      }
    })
    .catch(() => {
      // Fallback polling timer remains active.
    });
}

function stopSingletonStream() {
  if (sharedStreamController) {
    sharedStreamController.abort();
    sharedStreamController = null;
  }
}

function onVisibilityChange() {
  if (typeof document !== 'undefined' && document.hidden) {
    if (sharedTimer) {
      clearTimeout(sharedTimer);
      sharedTimer = null;
    }
    stopSingletonStream();
    return;
  }
  void singletonPull().then(scheduleSingleton);
  startSingletonStream();
}

export function startPolling(
  onUpdate: (items: NotificationItem[]) => void,
  intervalMs = 30_000,
  onError?: (err: unknown) => void,
): () => void {
  const subscriber: PollingSubscriber = { onUpdate, intervalMs, onError };
  subscribers.add(subscriber);

  if (subscribers.size === 1) {
    if (!isListeningVisibility && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
      isListeningVisibility = true;
    }
    void singletonPull().then(scheduleSingleton);
    if (typeof document !== 'undefined' && !document.hidden) {
      startSingletonStream();
    }
  } else {
    // Shared singleton: immediately deliver existing snapshot to new subscriber if present
    if (sharedItems) {
      onUpdate(sharedItems);
    }
    scheduleSingleton();
  }

  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0) {
      if (sharedTimer) {
        clearTimeout(sharedTimer);
        sharedTimer = null;
      }
      stopSingletonStream();
      if (isListeningVisibility && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        isListeningVisibility = false;
      }
      sharedItems = null;
    } else {
      scheduleSingleton();
    }
  };
}
