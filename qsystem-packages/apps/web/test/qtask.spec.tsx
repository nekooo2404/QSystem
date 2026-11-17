import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastRegion } from '@qsystem/ui';
import FilesPage from '../src/app/(workspace)/files/page';
import { MyTasksView } from '../src/components/qtask/MyTasksView';
import { ProjectsView } from '../src/components/qtask/ProjectsView';
import { parseCalendarDateDdMmYyyy, sanitizeCsvCell } from '../src/components/qtask/qtask.storage';
import { QTaskWorkspace } from '../src/components/qtask/QTaskWorkspace';
import { getSampleTasks } from '../src/components/qtask/TaskDetailContent';
import * as tasksAdapter from '../src/lib/adapters/tasks.adapter';
import type { Task } from '../src/lib/adapters/tasks.adapter';
import {
  addLocalDaysIso,
  diffCalendarDays,
  formatDdMmYyyy,
  formatRelativeViDate,
  getLocalDateIso,
  getUserTimeZone,
} from '../src/lib/date';

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
  vi.useRealTimers();
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

    await user.click(screen.getByRole('combobox', { name: 'Trạng thái' }));
    await user.click(await screen.findByRole('option', { name: 'Hoàn thành' }));

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

    await user.click(status);
    const pendingOption = await screen.findByRole('option', { name: 'Chờ duyệt' });
    act(() => {
      fireEvent.click(pendingOption);
      fireEvent.click(complete);
      fireEvent.click(complete);
    });
    expect(tasksAdapter.updateTaskStatus).toHaveBeenCalledTimes(1);
    expect(status).toBeDisabled();
    expect(complete).toBeDisabled();
    await act(async () => reject(new Error('offline')));
    expect(await screen.findByText(/Chưa cập nhật được công việc/)).toBeInTheDocument();
    expect(status).toHaveTextContent('Đang làm');
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

  it('computes relative dates and calendar days accurately across midnight UTC+7 vs UTC', () => {
    expect(getUserTimeZone().length).toBeGreaterThan(0);

    // 2026-11-16T18:00:00Z is already 2026-11-17 01:00 in Asia/Ho_Chi_Minh (+07:00).
    const earlyMorningVn = new Date('2026-11-16T18:00:00.000Z');
    expect(getLocalDateIso(earlyMorningVn, 'UTC')).toBe('2026-11-16');
    expect(getLocalDateIso(earlyMorningVn, 'Asia/Ho_Chi_Minh')).toBe('2026-11-17');

    expect(addLocalDaysIso(0, earlyMorningVn, 'Asia/Ho_Chi_Minh')).toBe('2026-11-17');
    expect(addLocalDaysIso(1, earlyMorningVn, 'Asia/Ho_Chi_Minh')).toBe('2026-11-18');
    expect(addLocalDaysIso(-1, earlyMorningVn, 'Asia/Ho_Chi_Minh')).toBe('2026-11-16');
    expect(addLocalDaysIso(15, earlyMorningVn, 'Asia/Ho_Chi_Minh')).toBe('2026-12-02');

    expect(formatDdMmYyyy('2026-11-17')).toBe('17/11/2026');
    expect(formatDdMmYyyy('2026-11-16T18:00:00.000Z', 'Asia/Ho_Chi_Minh')).toBe('17/11/2026');

    expect(diffCalendarDays('2026-11-17', earlyMorningVn, 'Asia/Ho_Chi_Minh')).toBe(0);
    expect(diffCalendarDays('2026-11-18', earlyMorningVn, 'Asia/Ho_Chi_Minh')).toBe(1);
    expect(diffCalendarDays('2026-11-16', earlyMorningVn, 'Asia/Ho_Chi_Minh')).toBe(-1);
    expect(diffCalendarDays('2026-11-12', earlyMorningVn, 'Asia/Ho_Chi_Minh')).toBe(-5);

    expect(formatRelativeViDate('2026-11-17', earlyMorningVn, 'Asia/Ho_Chi_Minh')).toBe('Hôm nay');
    expect(formatRelativeViDate('2026-11-18', earlyMorningVn, 'Asia/Ho_Chi_Minh')).toBe('Ngày mai');
    expect(formatRelativeViDate('2026-11-16', earlyMorningVn, 'Asia/Ho_Chi_Minh')).toBe('Hôm qua');
    expect(formatRelativeViDate('2026-11-12', earlyMorningVn, 'Asia/Ho_Chi_Minh')).toBe('12/11/2026');
    // 23:30 on 16/11 (+07) is only 1.5h before 01:00 on 17/11 (+07) yet is still "Hôm qua".
    expect(formatRelativeViDate('2026-11-16T16:30:00.000Z', earlyMorningVn, 'Asia/Ho_Chi_Minh')).toBe('Hôm qua');
  });

  it('aligns CreateTaskModal default due date and MyTasksView "Hôm nay" + calendar default to 17/11/2026', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-17T09:00:00+07:00'));

    const user = userEvent.setup();
    vi.mocked(tasksAdapter.listTasks).mockResolvedValueOnce([
      {
        id: 't-today',
        code: 'CV-2001',
        title: 'Việc đến hạn hôm nay',
        assigneeId: 'u-1',
        assigneeName: 'Nguyễn Minh Tuấn',
        dueDate: '2026-11-17',
        departmentId: 'd-1',
        status: 'Đang làm',
      },
      {
        id: 't-tomorrow',
        code: 'CV-2002',
        title: 'Việc đến hạn ngày mai',
        assigneeId: 'u-1',
        assigneeName: 'Nguyễn Minh Tuấn',
        dueDate: '2026-11-18',
        departmentId: 'd-1',
        status: 'Đang làm',
      },
    ]);

    const { container, unmount } = render(
      <>
        <MyTasksView />
        <ToastRegion position="bottom-right" />
      </>,
    );

    expect(await screen.findByText('Việc đến hạn hôm nay')).toBeInTheDocument();
    expect(container.querySelectorAll('select')).toHaveLength(0);

    // Sample tasks also compute relative to mocked date (2026-11-17).
    expect(getSampleTasks().find((t) => t.id === 'sample-CV-1006')?.dueDate).toBe('2026-11-17');

    // Calendar defaults to today (17), NOT 18.
    const day17 = screen.getByRole('button', { name: /T3\s*17/ });
    const day18 = screen.getByRole('button', { name: /T4\s*18/ });
    expect(day17).toHaveAttribute('aria-pressed', 'true');
    expect(day17).toHaveAttribute('aria-current', 'date');
    expect(day18).toHaveAttribute('aria-pressed', 'false');

    // "Hôm nay" task displays Hôm nay in the list and 17/11/2026 in the drawer.
    expect(screen.getByText('Hôm nay')).toBeInTheDocument();
    expect(screen.getByText('Ngày mai')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Việc đến hạn hôm nay' }));
    const drawer = screen.getByRole('dialog', { name: 'Việc đến hạn hôm nay' });
    expect(within(drawer).getByText('17/11/2026')).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Đóng chi tiết' }));

    // Tab Hôm nay shows only today's task.
    await user.click(screen.getByRole('tab', { name: /Hôm nay/ }));
    expect(screen.getByText('Việc đến hạn hôm nay')).toBeInTheDocument();
    expect(screen.queryByText('Việc đến hạn ngày mai')).toBeNull();

    // CreateTaskModal defaults Ngày đến hạn to 17/11/2026.
    await user.click(screen.getByRole('button', { name: 'Tạo công việc' }));
    const modal = screen.getByRole('dialog', { name: 'Giao việc mới' });
    expect(within(modal).getByLabelText('Ngày đến hạn')).toHaveValue('17/11/2026');
    expect(modal.querySelectorAll('select')).toHaveLength(0);
    unmount();
  });

  it('uses custom @qsystem/ui <Select> across CreateTaskModal, filter popovers, and ProjectsView without closing parent modals on Escape', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-17T09:00:00+07:00'));

    const user = userEvent.setup();
    vi.mocked(tasksAdapter.createTask).mockImplementationOnce(async (input) => ({
      id: 'created-1',
      code: 'CV-3001',
      title: input.title,
      assigneeId: input.assigneeId,
      assigneeName: input.assigneeName,
      dueDate: input.dueDate,
      status: 'Đang làm',
      project: input.project,
      priority: input.priority,
    }));

    const { container, unmount } = renderWorkspace();
    await screen.findByText('CV-1042');
    expect(container.querySelectorAll('select')).toHaveLength(0);

    // Filter popover <Select> keeps popover open while selecting an option.
    await user.click(screen.getByRole('button', { name: 'Lọc' }));
    const statusFilter = screen.getByRole('combobox', { name: 'Trạng thái' });
    await user.click(statusFilter);
    await user.click(await screen.findByRole('option', { name: 'Quá hạn' }));
    expect(screen.getByRole('region', { name: 'Bộ lọc bảng công việc' })).toBeInTheDocument();
    expect(screen.queryByText('CV-1042')).toBeNull();
    expect(screen.getByText('CV-1039')).toBeInTheDocument();

    // Open CreateTaskModal and interact with all 3 custom <Select> controls.
    await user.click(screen.getByRole('button', { name: 'Giao việc' }));
    const dialog = screen.getByRole('dialog', { name: 'Giao việc mới' });

    const priorityTrigger = within(dialog).getByRole('combobox', { name: 'Mức độ ưu tiên' });
    await user.click(priorityTrigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    // Pressing Escape closes ONLY the open Select listbox, keeping the modal open.
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Giao việc mới' })).toBeInTheDocument();

    await user.click(priorityTrigger);
    await user.click(await screen.findByRole('option', { name: 'Trung bình' }));
    expect(priorityTrigger).toHaveTextContent('Trung bình');

    const assigneeTrigger = within(dialog).getByRole('combobox', { name: 'Người phụ trách' });
    await user.click(assigneeTrigger);
    await user.click(await screen.findByRole('option', { name: 'Lê Hoàng Nam' }));
    expect(assigneeTrigger).toHaveTextContent('Lê Hoàng Nam');

    await user.click(within(dialog).getByRole('button', { name: 'Giao việc' }));
    await waitFor(() =>
      expect(tasksAdapter.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          assigneeId: 'u-2',
          assigneeName: 'Lê Hoàng Nam',
          dueDate: '2026-11-17',
          priority: 'Trung bình',
        }),
      ),
    );
    unmount();

    // ProjectsView also uses custom <Select> for stage filter and accent picker.
    const projView = render(
      <>
        <ProjectsView />
        <ToastRegion position="bottom-right" />
      </>,
    );
    expect(projView.container.querySelectorAll('select')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Tạo dự án' }));
    const createProj = screen.getByRole('dialog', { name: 'Tạo dự án mới' });
    await user.type(within(createProj).getByLabelText(/Tên dự án/), 'QTask Custom Select');
    await user.click(within(createProj).getByRole('combobox', { name: 'Màu nhận diện' }));
    await user.click(await screen.findByRole('option', { name: 'Xanh lá' }));
    await user.click(within(createProj).getByRole('button', { name: 'Tạo dự án' }));
    expect(screen.getByText('QTask Custom Select')).toBeInTheDocument();
  });

  it('keeps MyTasksView filter popover open on <Select> choice, resets Xem lịch to today, and computes FilesPage local dates', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-17T09:00:00+07:00'));

    const user = userEvent.setup();
    vi.mocked(tasksAdapter.listTasks).mockResolvedValueOnce([
      {
        id: 't-doing',
        code: 'CV-4001',
        title: 'Việc đang làm hôm nay',
        assigneeId: 'u-1',
        assigneeName: 'Nguyễn Minh Tuấn',
        dueDate: '2026-11-17',
        departmentId: 'd-1',
        status: 'Đang làm',
      },
      {
        id: 't-done',
        code: 'CV-4002',
        title: 'Việc đã hoàn thành',
        assigneeId: 'u-1',
        assigneeName: 'Nguyễn Minh Tuấn',
        dueDate: '2026-11-16',
        departmentId: 'd-1',
        status: 'Hoàn thành',
      },
    ]);

    const { unmount } = render(
      <>
        <MyTasksView />
        <ToastRegion position="bottom-right" />
      </>,
    );

    expect(await screen.findByText('Việc đang làm hôm nay')).toBeInTheDocument();

    // Click another calendar day (19), then Xem lịch should jump back to today (17).
    await user.click(screen.getByRole('button', { name: /T5\s*19/ }));
    expect(screen.getByRole('button', { name: /T5\s*19/ })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Xem lịch' }));
    expect(screen.getByRole('button', { name: /T3\s*17/ })).toHaveAttribute('aria-pressed', 'true');

    // Filter popover uses custom <Select> and stays open when picking an option.
    await user.click(screen.getByRole('button', { name: 'Bộ lọc' }));
    await user.click(screen.getByRole('combobox', { name: 'Trạng thái' }));
    await user.click(await screen.findByRole('option', { name: 'Hoàn thành' }));
    expect(screen.getByRole('region', { name: 'Bộ lọc công việc' })).toBeInTheDocument();
    expect(screen.queryByText('Việc đang làm hôm nay')).toBeNull();
    expect(screen.getByText('Việc đã hoàn thành')).toBeInTheDocument();
    unmount();

    // FilesPage computes relative local calendar days rather than rough ms/86400000.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === '/api/files') {
          return json([
            { id: 'f-today', key: 'uploads/Bao-cao-hom-nay.pdf', size: 1024, createdAt: '2026-11-16T18:00:00.000Z' },
            { id: 'f-yesterday', key: 'uploads/Bien-ban-hom-qua.pdf', size: 2048, createdAt: '2026-11-16T16:30:00.000Z' },
            { id: 'f-unknown', key: 'uploads/Tai-lieu-khong-ngay.pdf', size: 4096 },
          ]);
        }
        return json({ ok: true });
      }),
    );
    render(<FilesPage />);
    expect(await screen.findByText('Bao-cao-hom-nay.pdf')).toBeInTheDocument();
    const todayRow = screen.getByText('Bao-cao-hom-nay.pdf').closest('tr')!;
    const yesterdayRow = screen.getByText('Bien-ban-hom-qua.pdf').closest('tr')!;
    const unknownRow = screen.getByText('Tai-lieu-khong-ngay.pdf').closest('tr')!;
    expect(within(todayRow).getByText('Hôm nay')).toBeInTheDocument();
    expect(within(yesterdayRow).getByText('Hôm qua')).toBeInTheDocument();
    expect(within(unknownRow).queryByText('Hôm nay')).toBeNull();
    expect(within(unknownRow).getByText('—')).toBeInTheDocument();
  });
});
