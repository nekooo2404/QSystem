import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import NotificationsPage from '../src/app/(workspace)/notifications/page';

const FORBIDDEN = /4W|WHO|PENDING|Presign|Audit trail|DIRECTOR|MANAGER|EMPLOYEE/;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const ROWS = [
  {
    id: 'n-1',
    channel: 'EMAIL',
    recipient: 'minhtuan@qsystem.vn',
    recipientId: 'u-1',
    payload: { title: 'Bạn có việc mới' },
    status: 'PENDING',
    attempts: 0,
    createdAt: '2020-01-15T08:00:00.000Z',
  },
  {
    id: 'n-2',
    channel: 'EMAIL',
    recipient: 'minhtuan@qsystem.vn',
    recipientId: 'u-1',
    payload: { title: 'Báo cáo đã duyệt' },
    status: 'SENT',
    attempts: 1,
    createdAt: '2026-11-14T07:00:00.000Z',
  },
  {
    id: 'n-3',
    channel: 'EMAIL',
    recipient: 'minhtuan@qsystem.vn',
    recipientId: 'u-1',
    payload: { title: 'Không gửi được' },
    status: 'FAILED',
    attempts: 3,
    createdAt: '2026-11-14T06:00:00.000Z',
  },
];

let hidden = false;
let calls = 0;
let readAllCalls = 0;

beforeEach(() => {
  calls = 0;
  readAllCalls = 0;
  hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/notifications') {
        calls += 1;
        return json(200, ROWS);
      }
      if (url === '/api/notifications/read-all' && init?.method === 'POST') {
        readAllCalls += 1;
        return json(200, { ok: true, count: ROWS.length, readAt: '2026-11-14T10:00:00.000Z' });
      }
      return json(200, { ok: true });
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe('/notifications', () => {
  it('renders every notification with a Vietnamese status label', async () => {
    render(<NotificationsPage />);

    expect(await screen.findByText('Bạn có việc mới')).toBeInTheDocument();
    expect(screen.getByText('Chờ gửi')).toBeInTheDocument();
    expect(screen.getByText('Đã gửi')).toBeInTheDocument();
    expect(screen.getByText('Gửi lỗi')).toBeInTheDocument();

    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(FORBIDDEN);
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(3);
  });

  it('clears the unread state on the server via POST /api/notifications/read-all on open', async () => {
    render(<NotificationsPage />);
    await screen.findByText('Bạn có việc mới');

    expect(readAllCalls).toBe(1);
    expect(window.localStorage.getItem('qsystem-notifications-seen-at')).toBeNull();
  });

  it('stops polling while the tab is hidden and resumes when it is visible again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<NotificationsPage />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const afterLoad = calls;

    hidden = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(calls).toBe(afterLoad);

    hidden = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(calls).toBeGreaterThan(afterLoad);
  });

  it('shows the server sentence when notifications cannot load', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(503, { code: 'UNAVAILABLE', message: 'down' })));
    render(<NotificationsPage />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alert').textContent ?? '').toMatch(/Hệ thống đang gặp sự cố/);
  });

  it('retries failed reads, retains rows on refresh failure, and settles per-item rejection', async () => {
    let listFailed = true;
    let rejectRead!: (error: Error) => void;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/notifications') return listFailed ? json(503, {}) : json(200, ROWS);
      if (url === '/api/notifications/read-all') return json(503, {});
      if (url.endsWith('/n-1/read')) return new Promise<Response>((_, reject) => { rejectRead = reject; });
      return json(200, {});
    });
    vi.stubGlobal('fetch', fetcher);
    const user = userEvent.setup();
    render(<NotificationsPage />);
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    await screen.findByRole('alert');
    listFailed = false;
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    const row = (await screen.findByText('Bạn có việc mới')).closest('li')!;
    const read = within(row).getByRole('button', { name: 'Đánh dấu đã đọc' });
    await user.dblClick(read);
    expect(fetcher.mock.calls.filter(call => String(call[0]).endsWith('/n-1/read'))).toHaveLength(1);
    expect(read).toBeDisabled();
    await act(async () => rejectRead(new Error('offline')));
    expect(await within(row).findByRole('alert')).toHaveTextContent('Vui lòng thử lại');
    expect(read).toBeEnabled();
    listFailed = true;
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(screen.getByText('Bạn có việc mới')).toBeInTheDocument();
    expect(row).toHaveAttribute('data-unread', 'true');
  });
});
