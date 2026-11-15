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

export function startPolling(
  onUpdate: (items: NotificationItem[]) => void,
  intervalMs = 30_000,
  onError?: (err: unknown) => void,
): () => void {
  let active = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let streamController: AbortController | null = null;
  let inFlight = false;

  async function pull() {
    if (!active || document.hidden || inFlight) return;
    inFlight = true;
    try {
      const items = await list();
      if (active) onUpdate(items);
    } catch (err) {
      if (active) onError?.(err);
    } finally {
      inFlight = false;
    }
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    if (!active) return;
    timer = setTimeout(() => {
      void pull().then(schedule);
    }, intervalMs);
  }

  function startStream() {
    if (streamController || typeof AbortController === 'undefined') return;
    const token = getAccessToken();
    if (!token) return;
    const ctrl = new AbortController();
    streamController = ctrl;
    void fetch('/api/notifications/stream', {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
      signal: ctrl.signal,
    })
      .then(async (res) => {
        const reader = res.body?.getReader?.();
        if (!res.ok || !reader) return;
        const decoder = new TextDecoder();
        while (active && !ctrl.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (chunk.includes('event: notification')) {
            void pull();
          }
        }
      })
      .catch(() => {
        // Fallback polling timer remains active.
      });
  }

  function stopStream() {
    if (streamController) {
      streamController.abort();
      streamController = null;
    }
  }

  function onVisibilityChange() {
    if (document.hidden) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      stopStream();
      return;
    }
    void pull().then(schedule);
    startStream();
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  void pull().then(schedule);
  if (!document.hidden) startStream();

  return () => {
    active = false;
    document.removeEventListener('visibilitychange', onVisibilityChange);
    if (timer) clearTimeout(timer);
    stopStream();
  };
}
