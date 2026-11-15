import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeResponse } from '@qsystem/contracts';
import { QhrmDirectory } from '../src/components/qhrm/QhrmDirectory';

const FORBIDDEN = /4W|WHO|PENDING|Presign|Audit trail|DIRECTOR|MANAGER|EMPLOYEE/;

const me = (role: MeResponse['role']): MeResponse => ({
  id: 'u-1',
  email: 'minhtuan@qsystem.vn',
  name: 'Nguyễn Minh Tuấn',
  role,
  departmentId: 'd-1',
  managedDepartmentIds: role === 'MANAGER' ? ['d-1'] : [],
});

const DEPARTMENTS = [
  { id: 'd-1', name: 'Phòng Kỹ thuật' },
  { id: 'd-2', name: 'Phòng Sản phẩm' },
];

const USERS = [
  { id: 'u-1', email: 'minhtuan@qsystem.vn', name: 'Nguyễn Minh Tuấn', role: 'EMPLOYEE', departmentId: 'd-1', reportsToId: 'u-2' },
  { id: 'u-0', email: 'baochau@qsystem.vn', name: 'Phạm Bảo Châu', role: 'DIRECTOR', departmentId: 'd-1', reportsToId: null },
  { id: 'u-2', email: 'thilan@qsystem.vn', name: 'Trần Thị Lan', role: 'MANAGER', departmentId: 'd-1', reportsToId: 'u-0' },
  { id: 'u-3', email: 'quochung@qsystem.vn', name: 'Lê Quốc Hùng', role: 'EMPLOYEE', departmentId: 'd-2', reportsToId: 'u-2' },
];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

let fail = false;

beforeEach(() => {
  fail = false;
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
          reportsToId: null,
        });
      }
      if (url === '/api/org/users') return json(200, USERS);
      return json(404, { code: 'NOT_FOUND', message: 'unknown route' });
    }),
  );
});

describe('QhrmDirectory', () => {
  it('renders the five required columns and the dynamic heading', async () => {
    render(<QhrmDirectory me={me('DIRECTOR')} />);

    expect(await screen.findByRole('heading', { name: 'Nhân sự · Toàn công ty' })).toBeInTheDocument();
    const headers = screen.getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(headers).toEqual(['Họ tên', 'Chức danh', 'Vai trò', 'Quản lý trực tiếp', 'Tình trạng']);

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

  it('labels roles and managers in Vietnamese and never leaks internal codes', async () => {
    render(<QhrmDirectory me={me('DIRECTOR')} />);
    const table = await screen.findByRole('table');

    expect(within(table).getByText('Giám đốc')).toBeInTheDocument();
    expect(within(table).getByText('Quản lý')).toBeInTheDocument();
    const roleCells = within(table).getAllByRole('row').slice(1).map((row) => row.children[2].textContent);
    expect(roleCells).toEqual(['Nhân viên', 'Giám đốc', 'Quản lý', 'Nhân viên']);
    // reportsToId resolves to a real name instead of an id.
    expect(within(table).getAllByText('Trần Thị Lan').length).toBeGreaterThanOrEqual(2);
    expect(within(table).getAllByText('Phạm Bảo Châu').length).toBeGreaterThanOrEqual(2);

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

    // Chức danh / Tình trạng have no backing columns in schema.prisma yet.
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

    await user.type(screen.getByLabelText(/Họ tên/), 'Lê Minh Khôi');
    await user.type(screen.getByLabelText(/Email/), 'khoi@qsystem.vn');
    await user.type(screen.getByLabelText(/Mật khẩu tạm/), 'Secret-1234!');
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
});
