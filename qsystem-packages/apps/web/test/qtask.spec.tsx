import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastRegion } from '@qsystem/ui';
import { MyTasksView } from '../src/components/qtask/MyTasksView';
import { ProjectsView } from '../src/components/qtask/ProjectsView';
import { parseCalendarDateDdMmYyyy, sanitizeCsvCell } from '../src/components/qtask/qtask.storage';
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
    dueDate: '2099-11-20',
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
    expect(container.querySelectorAll('.qx-btn--primary')).toHaveLength(1);

    await user.click(ctas[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/Tên công việc/)).toBeInTheDocument();
  });

  it('labels the four underline views and syncs the chosen one into ?view=', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWorkspace();

    await screen.findByText('CV-1042');
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Tất cả',
      'Của tôi',
      'Quá hạn',
      'Hoàn thành',
    ]);

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

  it('closes the detail drawer from its × button so the table regains full width', async () => {
    renderWorkspace();
    const user = await openFirstTask();

    const panel = screen.getByRole('dialog', { name: 'Rà soát danh sách chi nhánh quý 4' });
    expect(within(panel).getByText(/CV-1042/)).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Đóng chi tiết' }));
    expect(screen.queryByRole('dialog', { name: 'Rà soát danh sách chi nhánh quý 4' })).toBeNull();
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
    const complete = screen.getByRole('button', { name: 'Hoàn thành công việc' });
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
    await user.click(screen.getByRole('button', { name: 'Hoàn thành công việc' }));
    expect(await screen.findByRole('button', { name: 'Đã hoàn thành' })).toBeDisabled();
    expect(tasksAdapter.updateTaskStatus).toHaveBeenCalledTimes(2);
  });

  it('rejects calendar rollover dates like 31/02/2026 and fails closed when createTask rejects', async () => {
    const user = userEvent.setup();
    vi.mocked(tasksAdapter.createTask).mockRejectedValueOnce(new Error('network down'));
    renderWorkspace();

    await screen.findByText('CV-1042');
    await user.click(screen.getByRole('button', { name: 'Giao việc' }));

    const dialog = screen.getByRole('dialog', { name: 'Giao việc mới' });
    const dueInput = within(dialog).getByLabelText('Ngày đến hạn');
    await user.clear(dueInput);
    await user.type(dueInput, '31/02/2026');
    await user.click(within(dialog).getByRole('button', { name: 'Giao việc' }));

    expect(within(dialog).getByText('Ngày hạn chót không hợp lệ.')).toBeInTheDocument();
    expect(tasksAdapter.createTask).not.toHaveBeenCalled();

    await user.clear(dueInput);
    await user.type(dueInput, '25/11/2026');
    await user.click(within(dialog).getByRole('button', { name: 'Giao việc' }));

    await waitFor(() => expect(tasksAdapter.createTask).toHaveBeenCalledTimes(1));
    expect(within(dialog).getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Giao việc mới' })).toBeInTheDocument();
  });

  it('adds a comment in the task detail drawer and logs it in Lịch sử', async () => {
    renderWorkspace();
    const user = await openFirstTask();
    const drawer = screen.getByRole('dialog', { name: 'Rà soát danh sách chi nhánh quý 4' });

    const commentInput = within(drawer).getByLabelText('Viết bình luận');
    await user.type(commentInput, 'Đã kiểm tra xong bảng đối soát');
    await user.click(within(drawer).getByRole('button', { name: 'Gửi bình luận' }));

    expect(within(drawer).getByRole('tab', { name: 'Trao đổi (3)' })).toBeInTheDocument();
    expect(within(drawer).getByText('Đã kiểm tra xong bảng đối soát')).toBeInTheDocument();

    await user.click(within(drawer).getByRole('tab', { name: 'Lịch sử' }));
    expect(within(drawer).getByText(/đã thêm bình luận mới/)).toBeInTheDocument();
  });

  it('neutralizes CSV spreadsheet formula prefixes and validates calendar dates strictly', () => {
    expect(parseCalendarDateDdMmYyyy('31/02/2026')).toBeNull();
    expect(parseCalendarDateDdMmYyyy('31/04/2026')).toBeNull();
    expect(parseCalendarDateDdMmYyyy('29/02/2024')).toBe('2024-02-29');

    expect(sanitizeCsvCell('=SUM(1,2)')).toBe('"\'=SUM(1,2)"');
    expect(sanitizeCsvCell('+cmd|"/c calc"')).toBe('"\'+cmd|""/c calc"""');
    expect(sanitizeCsvCell('-1+1')).toBe('"\'-1+1"');
    expect(sanitizeCsvCell('@HYPERLINK')).toBe('"\'@HYPERLINK"');
    expect(sanitizeCsvCell('\t=1+1')).toBe('"\'\t=1+1"');
    expect(sanitizeCsvCell('Báo cáo "Q4"')).toBe('"Báo cáo ""Q4"""');
  });

  it('renders MyTasksView cleanly, surfaces strict API errors, and completes a task', async () => {
    const user = userEvent.setup();
    const first = render(
      <>
        <MyTasksView />
        <ToastRegion position="bottom-right" />
      </>,
    );

    expect(await screen.findByText('Rà soát danh sách chi nhánh quý 4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Đánh dấu hoàn thành Rà soát danh sách chi nhánh quý 4/ }));
    await waitFor(() => expect(tasksAdapter.updateTaskStatus).toHaveBeenCalledWith('local-CV-1042', 'Hoàn thành'));
    first.unmount();

    vi.mocked(tasksAdapter.listTasks).mockRejectedValueOnce(new Error('offline'));
    render(<MyTasksView />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('renders ProjectsView, opens project detail via stretched button, and updates KPIs on create', async () => {
    const user = userEvent.setup();
    render(
      <>
        <ProjectsView />
        <ToastRegion position="bottom-right" />
      </>,
    );

    expect(screen.getByText('08')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'QSystem Core' }));
    const detailDialog = screen.getByRole('dialog');
    expect(within(detailDialog).getByText('Nền tảng quản trị doanh nghiệp')).toBeInTheDocument();
    await user.click(within(detailDialog).getByRole('button', { name: 'Đóng' }));

    await user.click(screen.getByRole('button', { name: 'Tạo dự án' }));
    const createDialog = screen.getByRole('dialog', { name: 'Tạo dự án mới' });
    await user.type(within(createDialog).getByLabelText(/Tên dự án/), 'QAudit Automation');
    await user.click(within(createDialog).getByRole('button', { name: 'Tạo dự án' }));

    expect(screen.getByText('QAudit Automation')).toBeInTheDocument();
    expect(screen.getByText('09')).toBeInTheDocument();
    expect(screen.getByText('136')).toBeInTheDocument();
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
