import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeResponse } from '@qsystem/contracts';
import { ToastRegion, dismissToast } from '@qsystem/ui';
import { QhrmDirectory } from '../src/components/qhrm/QhrmDirectory';

let mockSearchParams = new URLSearchParams();
const mockReplace = vi.fn((href: string) => {
  mockSearchParams = new URLSearchParams(href.split('?')[1] ?? '');
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/org',
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  useSearchParams: () => mockSearchParams,
}));

const FORBIDDEN = /4W|WHO|PENDING|Presign|Audit trail|DIRECTOR|MANAGER|EMPLOYEE/;

const me = (role: MeResponse['role'], id = 'u-1'): MeResponse => ({
  id,
  email: id === 'u-0' ? 'baochau@qsystem.vn' : 'minhtuan@qsystem.vn',
  name: id === 'u-0' ? 'Phạm Bảo Châu' : 'Nguyễn Minh Tuấn',
  role,
  departmentId: 'd-1',
  managedDepartmentIds: role === 'MANAGER' ? ['d-1'] : [],
});

const DEPARTMENTS = [
  { id: 'd-1', name: 'Phòng Kỹ thuật' },
  { id: 'd-2', name: 'Phòng Sản phẩm' },
];

const USERS = [
  {
    id: 'u-1',
    email: 'minhtuan@qsystem.vn',
    name: 'Nguyễn Minh Tuấn',
    role: 'EMPLOYEE',
    departmentId: 'd-1',
    reportsToId: 'u-2',
  },
  {
    id: 'u-0',
    email: 'baochau@qsystem.vn',
    name: 'Phạm Bảo Châu',
    role: 'DIRECTOR',
    departmentId: 'd-1',
    reportsToId: null,
  },
  {
    id: 'u-2',
    email: 'thilan@qsystem.vn',
    name: 'Trần Thị Lan',
    role: 'MANAGER',
    departmentId: 'd-1',
    reportsToId: 'u-0',
  },
  {
    id: 'u-3',
    email: 'quochung@qsystem.vn',
    name: 'Lê Quốc Hùng',
    role: 'EMPLOYEE',
    departmentId: 'd-2',
    reportsToId: 'u-2',
  },
];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let fail = false;

beforeEach(() => {
  fail = false;
  mockSearchParams = new URLSearchParams();
  mockReplace.mockClear();
  dismissToast();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (fail) return json(500, { code: 'INTERNAL', message: 'boom' });
      if (url === '/api/org/departments') return json(200, DEPARTMENTS);
      if (url === '/api/org/users' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        return json(201, {
          id: 'u-new',
          email: body.email,
          name: body.name,
          role: body.role ?? 'EMPLOYEE',
          departmentId: body.departmentId ?? null,
          reportsToId: body.reportsToId ?? null,
        });
      }
      if (url === '/api/org/users') return json(200, USERS);
      return json(404, { code: 'NOT_FOUND', message: 'unknown route' });
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  dismissToast();
});

describe('QhrmDirectory & QHRM modules', () => {
  it('renders the five required columns and the dynamic heading', async () => {
    render(<QhrmDirectory me={me('DIRECTOR')} />);

    expect(await screen.findByRole('heading', { name: 'Nhân sự · Toàn công ty' })).toBeInTheDocument();
    const headers = screen
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent)
      .filter(Boolean);
    expect(headers).toEqual(['Nhân sự', 'Chức danh', 'Phòng ban', 'Quản lý', 'Trạng thái']);

    const table = screen.getByRole('table');
    expect(within(table).getByText('Nguyễn Minh Tuấn')).toBeInTheDocument();
    expect(within(table).getAllByText('Trần Thị Lan').length).toBeGreaterThanOrEqual(1);
    expect(within(table).getByText('Lê Quốc Hùng')).toBeInTheDocument();
  });

  it('shows department counts and filters the table when a department is picked', async () => {
    const user = userEvent.setup();
    render(<QhrmDirectory me={me('DIRECTOR')} />);
    await screen.findByRole('heading', { name: 'Nhân sự · Toàn công ty' });

    const all = screen.getByRole('button', { name: /Toàn công ty/ });
    expect(all.textContent).toContain('4');
    expect(screen.getByRole('button', { name: /Phòng Kỹ thuật/ }).textContent).toContain('3');

    await user.click(screen.getByRole('button', { name: /Phòng Sản phẩm/ }));

    expect(screen.getByRole('heading', { name: 'Nhân sự · Phòng Sản phẩm' })).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Lê Quốc Hùng')).toBeInTheDocument();
    expect(within(table).queryByText('Phạm Bảo Châu')).toBeNull();
  });

  it('gates + Thêm nhân sự on Giám đốc / Quản lý only', async () => {
    const { unmount } = render(<QhrmDirectory me={me('EMPLOYEE')} />);
    await screen.findByRole('heading', { name: 'Nhân sự · Toàn công ty' });
    expect(screen.queryByRole('button', { name: /Thêm nhân sự/ })).toBeNull();
    unmount();

    render(<QhrmDirectory me={me('DIRECTOR')} />);
    expect(await screen.findByRole('button', { name: /Thêm nhân sự/ })).toBeInTheDocument();
  });

  it('uses custom Select in CreateUserModal, labels roles in Vietnamese, and never leaks internal codes', async () => {
    const user = userEvent.setup();
    render(<QhrmDirectory me={me('DIRECTOR')} />);
    const table = await screen.findByRole('table');

    expect(within(table).getAllByText('Trần Thị Lan').length).toBeGreaterThanOrEqual(2);
    expect(within(table).getAllByText('Phạm Bảo Châu').length).toBeGreaterThanOrEqual(2);

    await user.click(screen.getByRole('button', { name: 'Thao tác với Phạm Bảo Châu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Xem hồ sơ chi tiết' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Giám đốc')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Đóng hồ sơ nhân sự' }));

    await user.click(screen.getByRole('button', { name: /Thêm nhân sự/ }));
    const modal = await screen.findByRole('dialog');
    expect(document.querySelectorAll('select')).toHaveLength(0);

    const roleCombobox = within(modal).getByRole('combobox', { name: 'Vai trò truy cập' });
    await user.click(roleCombobox);
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByRole('option', { name: 'Nhân viên' })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: 'Quản lý' })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: 'Giám đốc' })).toBeInTheDocument();

    expect(document.body.textContent ?? '').not.toMatch(FORBIDDEN);
    expect(document.body.textContent ?? '').not.toContain('u-2');
  });

  it('does not invent a job title or employment status the API lacks', async () => {
    render(<QhrmDirectory me={me('DIRECTOR')} />);
    const table = await screen.findByRole('table');
    const cells = within(table).getAllByRole('row').slice(1).map((row) => ({
      title: row.children[1].textContent,
      status: row.children[4].textContent,
    }));

    for (const cell of cells) {
      expect(cell.title).toBe('Chưa có dữ liệu');
      expect(cell.status).toBe('Chưa có dữ liệu');
    }
  });

  it('creates a new staff member via Thêm nhân sự modal and POST /api/org/users', async () => {
    const user = userEvent.setup();
    render(<QhrmDirectory me={me('DIRECTOR')} />);

    const addBtn = await screen.findByRole('button', { name: /Thêm nhân sự/ });
    await user.click(addBtn);

    await user.type(screen.getByLabelText(/Họ và tên/), 'Lê Minh Khôi');
    await user.type(screen.getByLabelText(/Email/), 'khoi@qsystem.vn');
    await user.type(screen.getByLabelText(/Mật khẩu tạm/), 'Secret-1234!');

    const deptCombobox = screen.getByRole('combobox', { name: 'Phòng ban' });
    await user.click(deptCombobox);
    await user.click(screen.getByRole('option', { name: 'Phòng Kỹ thuật' }));

    await user.click(screen.getByRole('button', { name: 'Tạo nhân sự' }));

    const table = await screen.findByRole('table');
    expect(await within(table).findByText('Lê Minh Khôi')).toBeInTheDocument();
  });

  it('shows a Vietnamese sentence, not the backend code, when the directory fails', async () => {
    fail = true;
    render(<QhrmDirectory me={me('DIRECTOR')} />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent ?? '').toMatch(/Hệ thống đang gặp sự cố/);
    expect(alert.textContent ?? '').not.toMatch(/INTERNAL|INTERNAL_SERVER_ERROR|500/);
  });

  it('renders dedicated Chấm công view with check-in/check-out flow, local dates, KPIs, and detail drawer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 10, 17, 8, 15, 0));
    mockSearchParams = new URLSearchParams('muc=cham-cong');

    const user = userEvent.setup();
    render(
      <>
        <QhrmDirectory me={me('EMPLOYEE', 'u-1')} />
        <ToastRegion position="bottom-right" />
      </>,
    );

    expect(await screen.findByRole('heading', { name: 'Chấm công' })).toBeInTheDocument();
    expect(document.querySelectorAll('select')).toHaveLength(0);

    // Verify 9 Attendance table columns
    const headers = screen
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent)
      .filter(Boolean);
    expect(headers).toEqual([
      'Mã NV',
      'Nhân sự',
      'Phòng ban',
      'Ngày',
      'Giờ vào',
      'Giờ ra',
      'Tổng giờ',
      'Trạng thái',
      'Ghi chú',
    ]);

    // Today's local date 17/11/2026 appears and custom Select filters are mounted
    expect(screen.getAllByText(/17\/11\/2026/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('combobox', { name: 'Chọn ngày hoặc kỳ chấm công' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Lọc theo phòng ban' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Lọc theo trạng thái chấm công' })).toBeInTheDocument();

    // Check in at 08:15 (Đúng giờ)
    await user.click(screen.getByRole('button', { name: 'Chấm công vào ca' }));
    expect(await screen.findByText(/Đã chấm công vào ca lúc 08:15/)).toBeInTheDocument();
    const checkInCard = screen.getByLabelText('Chấm công cá nhân hôm nay');
    expect(within(checkInCard).getByText('08:15')).toBeInTheDocument();
    expect(within(checkInCard).getByText('Đúng giờ')).toBeInTheDocument();

    // Check out at 17:45 (9,5 giờ)
    vi.setSystemTime(new Date(2026, 10, 17, 17, 45, 0));
    await user.click(screen.getByRole('button', { name: 'Chấm công ra ca' }));
    expect(await screen.findByText(/Đã chấm công ra ca lúc 17:45/)).toBeInTheDocument();
    expect(within(checkInCard).getByText('17:45')).toBeInTheDocument();
    expect(within(checkInCard).getAllByText('9,5 giờ').length).toBeGreaterThanOrEqual(1);

    // Open row detail drawer & save note, then close drawer
    const table = screen.getByRole('table');
    await user.click(within(table).getByText('Nguyễn Minh Tuấn'));
    const noteBox = await screen.findByLabelText('Ghi chú');
    await user.clear(noteBox);
    await user.type(noteBox, 'Hoàn thành sprint Q4');
    await user.click(screen.getByRole('button', { name: 'Lưu cập nhật' }));
    await user.click(screen.getByRole('button', { name: 'Đóng chi tiết' }));
    expect(within(table).getByText('Hoàn thành sprint Q4')).toBeInTheDocument();

    // Verify Select filters work on Attendance table
    await user.click(screen.getByRole('combobox', { name: 'Lọc theo phòng ban' }));
    await user.click(await screen.findByRole('option', { name: 'Phòng Sản phẩm' }));
    expect(within(table).getByText('Lê Quốc Hùng')).toBeInTheDocument();
    expect(within(table).queryByText('Nguyễn Minh Tuấn')).toBeNull();

    await user.click(screen.getByRole('combobox', { name: 'Chọn ngày hoặc kỳ chấm công' }));
    await user.click(await screen.findByRole('option', { name: /Hôm qua/ }));
    expect(within(table).getByText(/16\/11\/2026/)).toBeInTheDocument();

    expect(document.body.textContent ?? '').not.toMatch(FORBIDDEN);
  });

  it('renders dedicated Nghỉ phép view, submits leave with validation, and updates balance & attendance on approve/reject', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 10, 17, 9, 0, 0));
    mockSearchParams = new URLSearchParams('muc=nghi-phep');

    const user = userEvent.setup();
    const { unmount } = render(
      <>
        <QhrmDirectory me={me('EMPLOYEE', 'u-1')} />
        <ToastRegion position="bottom-right" />
      </>,
    );

    expect(await screen.findByRole('heading', { name: 'Nghỉ phép' })).toBeInTheDocument();
    expect(document.querySelectorAll('select')).toHaveLength(0);

    // Verify Employee cannot approve/reject directly
    expect(screen.queryByRole('button', { name: /^Duyệt đơn/ })).toBeNull();

    // Verify leave balance cards (initial seed: 12 entitled, 2 used, 0 pending, 10 remaining)
    const balanceRegion = screen.getByLabelText('Quỹ ngày phép của bạn');
    expect(within(balanceRegion).getByText('12 ngày')).toBeInTheDocument();
    expect(within(balanceRegion).getByText('2 ngày')).toBeInTheDocument();
    expect(within(balanceRegion).getByText('0 ngày')).toBeInTheDocument();
    expect(within(balanceRegion).getByText('10 ngày')).toBeInTheDocument();

    // Expand team leave balances
    await user.click(screen.getByRole('button', { name: /Quỹ phép nhân sự/ }));
    expect(await screen.findByRole('table', { name: 'Bảng quỹ ngày phép nhân sự' })).toBeInTheDocument();

    // Open + Gửi đơn nghỉ phép modal
    await user.click(screen.getByRole('button', { name: /Gửi đơn nghỉ phép/ }));
    const modal = await screen.findByRole('dialog');
    expect(document.querySelectorAll('select')).toHaveLength(0);

    const fromInput = within(modal).getByLabelText(/Từ ngày/) as HTMLInputElement;
    const toInput = within(modal).getByLabelText(/Đến ngày/) as HTMLInputElement;
    expect(fromInput.value).toBe('2026-11-17');
    expect(toInput.value).toBe('2026-11-17');

    // Validation: requesting 15 days exceeds remaining 10 days
    fireEvent.change(toInput, { target: { value: '2026-12-01' } });
    await user.type(within(modal).getByLabelText(/Lý do nghỉ phép/), 'Nghỉ dài ngày');
    await user.click(within(modal).getByRole('button', { name: 'Gửi đơn nghỉ phép' }));
    expect(await within(modal).findByText(/vượt quá số ngày phép còn lại/i)).toBeInTheDocument();

    // Submit valid 1-day request for today (2026-11-17)
    fireEvent.change(toInput, { target: { value: '2026-11-17' } });
    await user.clear(within(modal).getByLabelText(/Lý do nghỉ phép/));
    await user.type(within(modal).getByLabelText(/Lý do nghỉ phép/), 'Nghỉ phép khám sức khỏe');
    await user.click(within(modal).getByRole('button', { name: 'Gửi đơn nghỉ phép' }));

    // Pending days incremented from 0 -> 1, remaining 10 -> 9
    expect(within(balanceRegion).getByText('1 ngày')).toBeInTheDocument();
    expect(within(balanceRegion).getByText('9 ngày')).toBeInTheDocument();
    expect(await screen.findByText(/Đã gửi đơn nghỉ phép NP-1005/)).toBeInTheDocument();
    unmount();

    // Now render as DIRECTOR to reject NP-1002 (restoring balance) and approve NP-1005 (updating attendance & balance)
    const { unmount: unmountDirector } = render(
      <>
        <QhrmDirectory me={me('DIRECTOR', 'u-0')} />
        <ToastRegion position="bottom-right" />
      </>,
    );
    await screen.findByRole('heading', { name: 'Nghỉ phép' });

    // Reject NP-1002 -> requires reason
    await user.click(screen.getByRole('button', { name: 'Từ chối đơn NP-1002' }));
    const rejectModal = await screen.findByRole('dialog');
    await user.click(within(rejectModal).getByRole('button', { name: 'Xác nhận từ chối' }));
    expect(await within(rejectModal).findByText('Vui lòng nhập lý do từ chối đơn.')).toBeInTheDocument();
    await user.type(within(rejectModal).getByLabelText(/Lý do từ chối/), 'Cần hoàn tất bàn giao');
    await user.click(within(rejectModal).getByRole('button', { name: 'Xác nhận từ chối' }));
    expect(await screen.findByText(/Đã từ chối đơn NP-1002/)).toBeInTheDocument();

    // Approve NP-1005 (Nguyễn Minh Tuấn's today leave)
    await user.click(screen.getByRole('button', { name: 'Duyệt đơn NP-1005' }));
    expect(await screen.findByText(/Đã duyệt đơn NP-1005 và cập nhật bảng chấm công/)).toBeInTheDocument();

    // Filter using UnderlineTabs ("Đã duyệt" and "Từ chối") and Loại phép custom Select
    await user.click(screen.getByRole('tab', { name: /Đã duyệt/ }));
    const leaveTable = screen.getByRole('table', { name: 'Danh sách đơn xin nghỉ phép' });
    expect(within(leaveTable).getByText('NP-1005')).toBeInTheDocument();
    expect(within(leaveTable).queryByText('NP-1002')).toBeNull();

    await user.click(screen.getByRole('tab', { name: /Từ chối/ }));
    expect(within(leaveTable).getByText('NP-1002')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Tất cả/ }));
    await user.click(screen.getByRole('combobox', { name: 'Lọc theo loại phép' }));
    await user.click(await screen.findByRole('option', { name: 'Nghỉ bù' }));
    expect(within(leaveTable).getByText('NP-1003')).toBeInTheDocument();
    expect(within(leaveTable).queryByText('NP-1005')).toBeNull();

    // Verify balances updated: Nguyễn Minh Tuấn (used = 3, pending = 0, remaining = 9)
    // and Phạm Bảo Châu (NP-1002 rejected -> pending restored to 0, remaining restored to 12)
    await user.click(screen.getByRole('button', { name: /Quỹ phép nhân sự/ }));
    const teamTable = await screen.findByRole('table', { name: 'Bảng quỹ ngày phép nhân sự' });
    const tuanBalanceRow = within(teamTable).getByText('Nguyễn Minh Tuấn').closest('tr');
    expect(tuanBalanceRow).not.toBeNull();
    expect(tuanBalanceRow?.textContent).toContain('3 ngày');
    expect(tuanBalanceRow?.textContent).toContain('0 ngày');
    expect(tuanBalanceRow?.textContent).toContain('9 ngày');

    const chauBalanceRow = within(teamTable).getByText('Phạm Bảo Châu').closest('tr');
    expect(chauBalanceRow).not.toBeNull();
    expect(chauBalanceRow?.textContent).toContain('0 ngày');
    expect(chauBalanceRow?.textContent).toContain('12 ngày');
    unmountDirector();

    // Switch to Chấm công and verify Nguyễn Minh Tuấn's today attendance is synced to Nghỉ phép!
    mockSearchParams = new URLSearchParams('muc=cham-cong');
    render(<QhrmDirectory me={me('DIRECTOR', 'u-0')} />);
    const attTable = await screen.findByRole('table', { name: 'Bảng chấm công nhân sự' });
    const tuanAttRow = within(attTable).getByText('Nguyễn Minh Tuấn').closest('tr');
    expect(tuanAttRow).not.toBeNull();
    expect(tuanAttRow?.textContent).toContain('Nghỉ phép');
    expect(tuanAttRow?.textContent).toContain('NP-1005');
    expect(document.body.textContent ?? '').not.toMatch(FORBIDDEN);
  });

  it('renders Tổng quan (/org?muc=tong-quan) with live Attendance and Leave summary metrics', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 10, 17, 9, 30, 0));
    mockSearchParams = new URLSearchParams('muc=tong-quan');

    render(<QhrmDirectory me={me('DIRECTOR', 'u-0')} />);
    expect(await screen.findByRole('heading', { name: 'Tổng quan nhân sự' })).toBeInTheDocument();
    expect(screen.getByText('Hiện diện hôm nay')).toBeInTheDocument();
    expect(screen.getByText('Đơn phép chờ duyệt')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Chấm công hôm nay' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Đơn nghỉ phép chờ duyệt' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cơ cấu nhân sự theo phòng ban' })).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toMatch(FORBIDDEN);
  });
});
