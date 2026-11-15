import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastRegion } from '@qsystem/ui';
import { QTaskWorkspace } from '../src/components/qtask/QTaskWorkspace';
import * as tasksAdapter from '../src/lib/adapters/tasks.adapter';
import type { Task } from '../src/lib/adapters/tasks.adapter';

// The real router re-renders the page from the new URL; the mock keeps the
// search string in a module variable so `?view=` round-trips like it does live.
let searchParams = new URLSearchParams();
const replace = vi.fn((href: string) => {
  searchParams = new URLSearchParams(href.split('?')[1] ?? '');
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => searchParams,
}));

vi.mock('../src/lib/adapters/tasks.adapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/adapters/tasks.adapter')>();
  return { ...actual, listTasks: vi.fn(), createTask: vi.fn(), updateTaskStatus: vi.fn() };
});

const TASKS: Task[] = [
  {
    id: 'local-CV-1042',
    code: 'CV-1042',
    title: 'Rà soát danh sách chi nhánh quý 4',
    assigneeId: 'u-1',
    assigneeName: 'Nguyễn Minh Tuấn',
    dueDate: '2026-11-15',
    departmentId: 'd-1',
    status: 'Đang làm',
  },
  {
    id: 'local-CV-1039',
    code: 'CV-1039',
    title: 'Hoàn thiện báo giá khách hàng mới',
    assigneeId: 'u-2',
    assigneeName: 'Lê Hoàng Nam',
    dueDate: '2026-11-12',
    departmentId: 'd-1',
    status: 'Quá hạn',
  },
];

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  // jsdom defaults to 1024px wide, where the drawer is an overlay; the console
  // layout under test is the >= 1280px split view.
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  searchParams = new URLSearchParams();
  replace.mockClear();
  vi.mocked(tasksAdapter.updateTaskStatus).mockClear();
  vi.mocked(tasksAdapter.listTasks).mockResolvedValue(TASKS.map((task) => ({ ...task })));
  vi.mocked(tasksAdapter.updateTaskStatus).mockImplementation(async (id, status) => ({
    ...TASKS.find((task) => task.id === id)!,
    status,
  }));
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/me') {
        return json({
          id: 'u-1',
          email: 'minhtuan@qsystem.vn',
          name: 'Nguyễn Minh Tuấn',
          role: 'MANAGER',
          departmentId: 'd-1',
          managedDepartmentIds: ['d-1'],
        });
      }
      if (url === '/api/org/departments') return json([{ id: 'd-1', name: 'Phòng Kỹ thuật' }]);
      if (url === '/api/org/users') {
        return json([
          { id: 'u-1', name: 'Nguyễn Minh Tuấn' },
          { id: 'u-2', name: 'Lê Hoàng Nam' },
        ]);
      }
      return json({ ok: true });
    }),
  );
});

function renderWorkspace() {
  return render(
    <>
      <QTaskWorkspace />
      <ToastRegion position="bottom-right" />
    </>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openFirstTask() {
  const user = userEvent.setup();
  await screen.findByText('CV-1042');
  await user.click(screen.getByText('Rà soát danh sách chi nhánh quý 4'));
  return user;
}

describe('QTask workspace', () => {
  it('shows one amber Giao việc CTA that opens the create form', async () => {
    const user = userEvent.setup();
    const { container } = renderWorkspace();

    const ctas = await screen.findAllByRole('button', { name: 'Giao việc' });
    expect(ctas).toHaveLength(1);
    expect(container.querySelectorAll('.qs-btn--primary')).toHaveLength(1);

    await user.click(ctas[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/Tên công việc/)).toBeInTheDocument();
  });

  it('labels the three underline views exactly and syncs the chosen one into ?view=', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWorkspace();

    await screen.findByText('CV-1042');
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Tất cả', 'Của tôi', 'Quá hạn']);

    await user.click(screen.getByRole('tab', { name: 'Quá hạn' }));
    expect(replace).toHaveBeenCalledWith('/?view=overdue', { scroll: false });

    rerender(
      <>
        <QTaskWorkspace />
        <ToastRegion position="bottom-right" />
      </>,
    );
    expect(screen.getByRole('tab', { name: 'Quá hạn' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('CV-1042')).toBeNull();
    expect(screen.getByText('CV-1039')).toBeInTheDocument();
  });

  it('closes the detail panel from its × button so the table regains full width', async () => {
    renderWorkspace();
    const user = await openFirstTask();

    const panel = screen.getByRole('region', { name: 'Rà soát danh sách chi nhánh quý 4' });
    expect(within(panel).getByText('CV-1042')).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Đóng chi tiết' }));
    expect(screen.queryByRole('region', { name: 'Rà soát danh sách chi nhánh quý 4' })).toBeNull();
  });

  it('changes Trạng thái inline through the adapter and confirms with a toast', async () => {
    renderWorkspace();
    const user = await openFirstTask();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Trạng thái' }), 'Hoàn thành');

    await waitFor(() => expect(tasksAdapter.updateTaskStatus).toHaveBeenCalledWith('local-CV-1042', 'Hoàn thành'));
    expect(await screen.findByText(/Đã hoàn thành việc CV-1042/)).toBeInTheDocument();
  });

  it('serializes status and completion writes for one task and recovers after rejection', async () => {
    let reject!: (error: Error) => void;
    vi.mocked(tasksAdapter.updateTaskStatus).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    renderWorkspace();
    const user = await openFirstTask();
    const status = screen.getByRole('combobox', { name: 'Trạng thái' });
    const complete = screen.getByRole('button', { name: 'Hoàn thành việc' });
    act(() => {
      fireEvent.change(status, { target: { value: 'Chờ duyệt' } });
      fireEvent.click(complete);
      fireEvent.click(complete);
    });
    expect(tasksAdapter.updateTaskStatus).toHaveBeenCalledTimes(1);
    expect(status).toBeDisabled();
    expect(complete).toBeDisabled();
    await act(async () => reject(new Error('offline')));
    expect(await screen.findByText(/Chưa cập nhật được công việc/)).toBeInTheDocument();
    expect(status).toHaveValue('Đang làm');
    expect(status).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Hoàn thành việc' }));
    expect(await screen.findByRole('button', { name: 'Đã hoàn thành' })).toBeDisabled();
    expect(tasksAdapter.updateTaskStatus).toHaveBeenCalledTimes(2);
  });

  it('keeps developer jargon off the screen', async () => {
    renderWorkspace();
    await openFirstTask();

    expect(document.body.textContent ?? '').not.toMatch(/4W|WHO|Audit trail|Presign|DIRECTOR/);
  });

  it('never wraps the task-name column on desktop', () => {
    const css = readFileSync(resolve(__dirname, '../src/app/globals.css'), 'utf8');
    expect(css).toMatch(
      /@media \(min-width: 1280px\)[\s\S]{0,400}td:nth-child\(2\)[\s\S]{0,160}white-space:\s*nowrap/,
    );
  });
});
