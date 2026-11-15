import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskPayload4WSchema } from '@qsystem/contracts';
import { setAccessToken } from '../src/lib/api/client';
import { createTask, listTasks } from '../src/lib/adapters/tasks.adapter';
import {
  countUnread,
  formatNotifyStatus,
  formatRole,
  list as listNotifications,
  startPolling,
} from '../src/lib/adapters/notifications.adapter';
import { STATIC_MODULES, listModules } from '../src/lib/adapters/registry.adapter';

type Call = { url: string; init: RequestInit };

let calls: Call[];
let hidden = false;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function callsTo(url: string): Call[] {
  return calls.filter((call) => call.url === url);
}

beforeEach(() => {
  calls = [];
  hidden = false;
  setAccessToken(null);
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init: init ?? {} });
      if (url === '/api/notifications') {
        return json(200, [
          {
            id: 'n-1',
            channel: 'EMAIL',
            recipient: 'minhtuan@qsystem.vn',
            recipientId: 'u-1',
            payload: { title: 'Bạn có việc mới' },
            status: 'SENT',
            attempts: 1,
            createdAt: '2026-11-13T08:00:00.000Z',
          },
        ]);
      }
      if (url.startsWith('/api/org/tasks')) {
        if (init?.method === 'POST') {
          const body = JSON.parse(String(init.body));
          return json(201, {
            ok: true,
            task: {
              id: 't-1',
              code: 'CV-1001',
              title: body.title ?? body.what,
              assigneeId: body.assigneeId ?? null,
              assigneeName: body.assigneeName ?? body.who,
              dueDate: body.dueDate ?? body.when,
              departmentId: body.departmentId ?? null,
              status: 'Đang làm',
            },
          });
        }
        return json(200, {
          items: [
            {
              id: 't-1',
              code: 'CV-1001',
              title: 'Việc của Tuấn',
              assigneeId: 'u-1',
              assigneeName: 'Nguyễn Minh Tuấn',
              dueDate: '2026-11-20',
              departmentId: 'd-1',
              status: 'Đang làm',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        });
      }
      if (url === '/api/registry') return json(404, { code: 'NOT_FOUND', message: 'unknown route' });
      return json(200, { ok: true });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('registryAdapter', () => {
  it('falls back to the four built-in modules with Vietnamese descriptions when /api/registry is absent', async () => {
    const modules = await listModules();

    expect(modules.map((module) => module.id)).toEqual(['qtask', 'qhrm', 'qcrm', 'qsocial']);
    expect(modules).toEqual(STATIC_MODULES);
    for (const module of modules) expect(module.description.trim().length).toBeGreaterThan(0);
    expect(callsTo('/api/registry')).toHaveLength(1);
  });
});

describe('tasksAdapter', () => {
  it('maps Vietnamese task fields onto a payload the server 4W guard accepts', async () => {
    const task = await createTask({
      title: 'Soạn báo cáo quý IV',
      assigneeId: 'u-1',
      assigneeName: 'Nguyễn Minh Tuấn',
      dueDate: '2026-11-20',
      departmentId: 'd-1',
    });

    const [post] = callsTo('/api/org/tasks');
    expect(post.init.method).toBe('POST');
    const payload = TaskPayload4WSchema.parse(JSON.parse(String(post.init.body)));
    expect(payload).toMatchObject({
      what: 'Soạn báo cáo quý IV',
      who: 'u-1',
      when: '2026-11-20',
      where: 'd-1',
    });
    expect(task.code).toMatch(/^CV-\d{4}$/);
  });

  it('keeps developer jargon out of what the screen renders', async () => {
    const task = await createTask({
      title: 'Chuẩn bị tài liệu họp',
      assigneeName: 'Trần Thu Hà',
      dueDate: '2026-11-21',
    });

    expect(JSON.stringify(task)).not.toMatch(/4W|WHO|WHAT|WHEN|WHERE|QT-/i);
    expect(task.status).toBe('Đang làm');
  });

  it('refuses an incomplete task before touching the network', async () => {
    await expect(
      createTask({ title: '   '.trim(), assigneeName: 'Nguyễn Minh Tuấn', dueDate: '2026-11-20' }),
    ).rejects.toBeTruthy();
    expect(callsTo('/api/org/tasks')).toHaveLength(0);
  });

  it('lists tasks via GET /api/org/tasks with query filters', async () => {
    const mine = await listTasks({ assigneeId: 'u-1' });
    expect(mine.map((task) => task.title)).toEqual(['Việc của Tuấn']);
    expect(callsTo('/api/org/tasks?assigneeId=u-1')).toHaveLength(1);
    expect((await listTasks()).length).toBeGreaterThanOrEqual(1);
  });
});

describe('notificationsAdapter', () => {
  it('reads the caller notifications with their status intact', async () => {
    const items = await listNotifications();
    expect(items).toHaveLength(1);
    expect(formatNotifyStatus(items[0].status)).toBe('Đã gửi');
  });

  it('never shows a raw delivery status to the user', () => {
    expect(formatNotifyStatus('PENDING')).toBe('Chờ gửi');
    expect(formatNotifyStatus('SENT')).toBe('Đã gửi');
    expect(formatNotifyStatus('FAILED')).toBe('Gửi lỗi');
    expect(formatNotifyStatus('DEAD')).toBe('Gửi lỗi');
  });

  it('labels every role in Vietnamese', () => {
    expect(formatRole('DIRECTOR')).toBe('Giám đốc');
    expect(formatRole('MANAGER')).toBe('Quản lý');
    expect(formatRole('EMPLOYEE')).toBe('Nhân viên');
  });

  it('pauses polling while the tab is hidden and resumes when it is visible again', async () => {
    hidden = true;
    vi.useFakeTimers();
    const onUpdate = vi.fn();

    const stop = startPolling(onUpdate, 1000);
    await vi.advanceTimersByTimeAsync(3000);
    expect(callsTo('/api/notifications')).toHaveLength(0);
    expect(onUpdate).not.toHaveBeenCalled();

    hidden = false;
    await vi.advanceTimersByTimeAsync(1000);
    expect(callsTo('/api/notifications').length).toBeGreaterThan(0);
    expect(onUpdate).toHaveBeenCalled();

    stop();
    const seen = callsTo('/api/notifications').length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(callsTo('/api/notifications')).toHaveLength(seen);
  });

  it('counts unread notifications based on server readAt state', () => {
    expect(
      countUnread([
        {
          id: 'n-1',
          channel: 'EMAIL',
          recipient: 'a@b.vn',
          recipientId: 'u-1',
          payload: null,
          status: 'SENT',
          attempts: 1,
          readAt: null,
          createdAt: '2026-11-14T00:00:00.000Z',
        },
        {
          id: 'n-2',
          channel: 'EMAIL',
          recipient: 'a@b.vn',
          recipientId: 'u-1',
          payload: null,
          status: 'SENT',
          attempts: 1,
          readAt: '2026-11-14T01:00:00.000Z',
          createdAt: '2026-11-14T00:00:00.000Z',
        },
      ]),
    ).toBe(1);
  });
});
