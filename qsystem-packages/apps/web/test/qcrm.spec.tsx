import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastRegion } from '@qsystem/ui';
import { CrmWorkspace } from '../src/components/qcrm/CrmCustomers';
import { formatDdMmYyyy, getLocalDateIso } from '../src/lib/date';

const FORBIDDEN_TERMS =
  /4W|WHO|PENDING|SENT|FAILED|DEAD|DIRECTOR|MANAGER|EMPLOYEE|Presign|Audit trail|Win rate/i;

let searchParams = new URLSearchParams();
const replace = vi.fn((href: string) => {
  searchParams = new URLSearchParams(href.split('?')[1] ?? '');
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm',
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => searchParams,
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const API_CUSTOMERS = [
  {
    id: 'c-1',
    code: 'QT',
    name: 'QTS Group',
    email: 'qtsgroup@example.com',
    industry: 'Công nghệ',
    segment: 'enterprise',
    ownerInitials: 'LA',
    ownerName: 'Lan Anh',
    ownerTone: 'indigo',
    stage: 'Đang chăm sóc',
    lastContact: '17/11/2026',
  },
  {
    id: 'c-2',
    code: 'VI',
    name: 'VietHealth',
    email: 'viethealth@example.com',
    industry: 'Y tế',
    segment: 'enterprise',
    ownerInitials: 'HM',
    ownerName: 'Hà My',
    ownerTone: 'slate',
    stage: 'Tiềm năng',
    lastContact: '16/11/2026',
  },
  {
    id: 'c-4',
    code: 'NO',
    name: 'Nova Studio',
    email: 'novastudio@example.com',
    industry: 'Thiết kế',
    segment: 'individual',
    ownerInitials: 'BT',
    ownerName: 'Bảo Trâm',
    ownerTone: 'teal',
    stage: 'Mới',
    lastContact: '13/11/2026',
  },
];

let failCustomersApi = false;

function renderCrm(muc?: string) {
  searchParams = new URLSearchParams(muc ? `muc=${muc}` : '');
  return render(
    <>
      <CrmWorkspace />
      <ToastRegion position="bottom-right" />
    </>,
  );
}

async function selectCustomOption(
  user: ReturnType<typeof userEvent.setup>,
  combobox: HTMLElement,
  optionLabel: string | RegExp,
) {
  await user.click(combobox);
  const listbox = await screen.findByRole('listbox');
  const option = within(listbox).getByRole('option', { name: optionLabel });
  await user.click(option);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-17T09:00:00+07:00'));

  failCustomersApi = false;
  replace.mockClear();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/org/customers' || url === '/api/org/crm/customers') {
        if (failCustomersApi) {
          return jsonResponse(500, { code: 'INTERNAL', message: 'error' });
        }
        if (init?.method === 'POST') {
          const body = JSON.parse(String(init.body));
          return jsonResponse(201, {
            customer: {
              id: 'c-new',
              code: 'AC',
              name: body.name,
              email: body.email,
              industry: body.industry ?? 'Công nghệ',
              segment: body.segment ?? 'enterprise',
              ownerInitials: 'LA',
              ownerName: body.ownerName ?? 'Lan Anh',
              ownerTone: 'indigo',
              stage: body.stage ?? 'Mới',
              lastContact: body.lastContact ?? formatDdMmYyyy(getLocalDateIso()),
            },
          });
        }
        return jsonResponse(200, API_CUSTOMERS);
      }
      if (url.startsWith('/api/org/crm/customers/') && init?.method === 'PATCH') {
        return jsonResponse(200, { ok: true });
      }
      if (url.startsWith('/api/org/crm/customers/') && init?.method === 'DELETE') {
        return jsonResponse(200, { ok: true });
      }
      if (url === '/api/org/users') {
        return jsonResponse(200, [
          { id: 'u-1', name: 'Lan Anh' },
          { id: 'u-2', name: 'Hà My' },
          { id: 'u-3', name: 'Đức Anh' },
          { id: 'u-4', name: 'Bảo Trâm' },
          { id: 'u-5', name: 'Minh Khôi' },
        ]);
      }
      return jsonResponse(404, { code: 'NOT_FOUND', message: 'Not found' });
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('QCRM separated workspace suite', () => {
  it('renders Tổng quan (/crm?muc=tong-quan) with KPI cards, closing opportunities, contact interactions, and sub-tab links', async () => {
    const { container } = renderCrm('tong-quan');

    expect(await screen.findByRole('heading', { name: 'Tổng quan QCRM' })).toBeInTheDocument();
    expect(container.querySelectorAll('select')).toHaveLength(0);
    expect(container.querySelectorAll('.qx-btn--primary')).toHaveLength(1);

    const kpiRegion = screen.getByLabelText('Chỉ số tổng quan QCRM');
    expect(within(kpiRegion).getByText('Tổng khách hàng')).toBeInTheDocument();
    expect(within(kpiRegion).getByText('Giá trị pipeline đang mở')).toBeInTheDocument();
    expect(within(kpiRegion).getByText('Cơ hội chốt thành công')).toBeInTheDocument();
    expect(within(kpiRegion).getByText('Đầu mối liên hệ hoạt động')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Cơ hội sắp đến hạn chốt' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tương tác đầu mối gần đây' })).toBeInTheDocument();

    const quickNav = screen.getByRole('navigation', { name: 'Truy cập nhanh phân hệ QCRM' });
    expect(quickNav).toBeInTheDocument();
    expect(within(quickNav).getByRole('link', { name: /Khách hàng/ })).toHaveAttribute('href', '/crm');
    expect(within(quickNav).getByRole('link', { name: /Cơ hội bán hàng/ })).toHaveAttribute(
      'href',
      '/crm?muc=co-hoi',
    );
    expect(within(quickNav).getByRole('link', { name: /Liên hệ/ })).toHaveAttribute(
      'href',
      '/crm?muc=lien-he',
    );
    expect(within(quickNav).getByRole('link', { name: /Báo cáo/ })).toHaveAttribute(
      'href',
      '/crm?muc=bao-cao',
    );
    expect(document.body.textContent ?? '').not.toMatch(FORBIDDEN_TERMS);
  });

  it('renders Khách hàng (/crm), uses custom <Select>, creates customer, and opens detail drawer', async () => {
    const user = userEvent.setup();
    const { container } = renderCrm();

    expect(await screen.findByRole('heading', { name: 'Khách hàng' })).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Danh sách khách hàng' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((th) => th.textContent)
      .filter(Boolean);
    expect(headers).toEqual([
      'Khách hàng',
      'Loại',
      'Ngành',
      'Phụ trách',
      'Trạng thái',
      'Liên hệ gần nhất',
    ]);

    expect(container.querySelectorAll('select')).toHaveLength(0);
    expect(container.querySelectorAll('.qx-btn--primary')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Thêm khách hàng' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.querySelectorAll('select')).toHaveLength(0);

    await user.type(within(dialog).getByLabelText(/Tên khách hàng/), 'An Phát Logistics');
    await user.type(within(dialog).getByLabelText(/Email liên hệ/), 'lienhe@anphat.vn');
    await selectCustomOption(
      user,
      within(dialog).getByRole('combobox', { name: 'Loại khách hàng' }),
      'Cá nhân',
    );
    await selectCustomOption(
      user,
      within(dialog).getByRole('combobox', { name: 'Ngành' }),
      'Dịch vụ',
    );
    await selectCustomOption(
      user,
      within(dialog).getByRole('combobox', { name: 'Trạng thái' }),
      'Tiềm năng',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Lưu khách hàng' }));

    expect(await within(table).findByText('An Phát Logistics')).toBeInTheDocument();
    await user.click(within(table).getByText('An Phát Logistics'));
    const drawer = await screen.findByRole('region', { name: 'An Phát Logistics' });
    expect(within(drawer).getByText('lienhe@anphat.vn')).toBeInTheDocument();
    expect(within(drawer).getByText('Cá nhân')).toBeInTheDocument();
    expect(within(drawer).getByText('Dịch vụ')).toBeInTheDocument();
    await selectCustomOption(
      user,
      within(drawer).getByRole('combobox', { name: 'Cập nhật trạng thái khách hàng' }),
      'Đang chăm sóc',
    );
    expect(await screen.findByText('Đã chuyển An Phát Logistics sang Đang chăm sóc')).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toMatch(FORBIDDEN_TERMS);
  });

  it('shows Vietnamese error state on Khách hàng when API fails', async () => {
    failCustomersApi = true;
    renderCrm();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent ?? '').toContain('Không thể tải danh sách khách hàng');
    expect(within(alert).getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('renders Cơ hội bán hàng (/crm?muc=co-hoi) with separate table, + Thêm cơ hội CTA, and detail updates', async () => {
    const user = userEvent.setup();
    const { container } = renderCrm('co-hoi');

    expect(await screen.findByRole('heading', { name: 'Cơ hội bán hàng' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thêm khách hàng/ })).toBeNull();
    expect(container.querySelectorAll('.qx-btn--primary')).toHaveLength(1);
    expect(container.querySelectorAll('select')).toHaveLength(0);

    const addBtn = screen.getByRole('button', { name: 'Thêm cơ hội' });
    expect(addBtn).toBeInTheDocument();

    const table = screen.getByRole('table', { name: 'Danh sách cơ hội bán hàng' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((th) => th.textContent)
      .filter(Boolean);
    expect(headers).toEqual([
      'Mã cơ hội',
      'Tên cơ hội',
      'Khách hàng',
      'Giá trị dự kiến',
      'Ngày dự kiến chốt',
      'Giai đoạn',
      'Xác suất (%)',
      'Phụ trách',
    ]);

    // Check stage tabs exist
    expect(screen.getByRole('tab', { name: /^Tiếp cận/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Khảo sát/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Báo giá/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Đàm phán/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Chốt thành công/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Thất bại/ })).toBeInTheDocument();

    // Create a new Opportunity via custom <Select> controls
    await user.click(addBtn);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.querySelectorAll('select')).toHaveLength(0);

    await user.type(within(dialog).getByLabelText(/Tên cơ hội/), 'Hợp đồng mở rộng chi nhánh');
    await selectCustomOption(
      user,
      within(dialog).getByRole('combobox', { name: 'Khách hàng' }),
      /VietHealth/,
    );
    const amountInput = within(dialog).getByLabelText(/Giá trị dự kiến/);
    await user.clear(amountInput);
    await user.type(amountInput, '640000000');
    await selectCustomOption(
      user,
      within(dialog).getByRole('combobox', { name: 'Giai đoạn' }),
      'Báo giá',
    );
    await selectCustomOption(
      user,
      within(dialog).getByRole('combobox', { name: 'Phụ trách' }),
      'Hà My',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Lưu cơ hội' }));

    expect(await within(table).findByText('Hợp đồng mở rộng chi nhánh')).toBeInTheDocument();
    expect(within(table).getByText('CH-2009')).toBeInTheDocument();
    expect(within(table).getByText('640.000.000 đ')).toBeInTheDocument();

    // Open detail drawer, edit value & notes, save, and advance stage
    await user.click(within(table).getByText('Hợp đồng mở rộng chi nhánh'));
    const drawer = await screen.findByRole('region', { name: 'Hợp đồng mở rộng chi nhánh' });
    const editAmount = within(drawer).getByLabelText('Giá trị dự kiến (VNĐ)');
    await user.clear(editAmount);
    await user.type(editAmount, '720000000');
    await user.type(within(drawer).getByLabelText('Ghi chú trao đổi'), 'Đã xác nhận phạm vi kỹ thuật');
    await user.click(within(drawer).getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByText('Đã cập nhật cơ hội CH-2009')).toBeInTheDocument();
    expect(within(table).getByText('720.000.000 đ')).toBeInTheDocument();

    await user.click(within(drawer).getByRole('button', { name: 'Chuyển sang Đàm phán' }));
    expect(await screen.findByText('Đã chuyển CH-2009 sang Đàm phán')).toBeInTheDocument();
    expect(window.localStorage.getItem('qsystem:crm:opportunities:v1')).toContain('CH-2009');

    // Filter by stage tab
    await user.click(screen.getByRole('tab', { name: /^Chốt thành công/ }));
    expect(within(table).queryByText('Hợp đồng mở rộng chi nhánh')).toBeNull();
    expect(within(table).getByText('CH-2003')).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toMatch(FORBIDDEN_TERMS);
  });

  it('renders Liên hệ (/crm?muc=lien-he) with point-of-contact table, + Thêm liên hệ CTA, and Ghi nhận tương tác', async () => {
    const user = userEvent.setup();
    const { container } = renderCrm('lien-he');

    expect(await screen.findByRole('heading', { name: 'Liên hệ' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thêm khách hàng/ })).toBeNull();
    expect(container.querySelectorAll('.qx-btn--primary')).toHaveLength(1);
    expect(container.querySelectorAll('select')).toHaveLength(0);

    const table = screen.getByRole('table', { name: 'Danh sách đầu mối liên hệ' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((th) => th.textContent)
      .filter(Boolean);
    expect(headers).toEqual([
      'Họ tên đầu mối',
      'Vai trò / Chức vụ',
      'Khách hàng',
      'Số điện thoại',
      'Email',
      'Vai trò đầu mối',
      'Kênh chính',
      'Tương tác gần nhất',
      'Phụ trách',
    ]);

    // Create a new Contact
    await user.click(screen.getByRole('button', { name: 'Thêm liên hệ' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.querySelectorAll('select')).toHaveLength(0);

    await user.type(within(dialog).getByLabelText(/Họ tên đầu mối/), 'Trần Quốc Bảo');
    await user.type(within(dialog).getByLabelText(/Vai trò \/ Chức vụ/), 'Giám đốc vận hành');
    await selectCustomOption(
      user,
      within(dialog).getByRole('combobox', { name: 'Khách hàng' }),
      /QTS Group/,
    );
    await selectCustomOption(
      user,
      within(dialog).getByRole('combobox', { name: 'Vai trò đầu mối' }),
      'Đầu mối kỹ thuật',
    );
    await user.type(within(dialog).getByLabelText(/Số điện thoại/), '0909 555 888');
    await user.type(within(dialog).getByLabelText(/Email/), 'bao.tran@qts.vn');
    await selectCustomOption(
      user,
      within(dialog).getByRole('combobox', { name: 'Kênh liên hệ' }),
      'Zalo',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Lưu liên hệ' }));

    expect(await within(table).findByText('Trần Quốc Bảo')).toBeInTheDocument();

    // Open detail drawer for an older contact (Võ Gia Huy, last interacted 21 days ago) and log interaction -> Hôm nay
    await user.click(within(table).getByText('Võ Gia Huy'));
    await user.type(
      screen.getByLabelText('Nội dung trao đổi'),
      'Đã gửi báo giá cập nhật qua Zalo',
    );
    await user.click(screen.getByRole('button', { name: 'Ghi nhận tương tác' }));

    expect(await screen.findByText('Đã ghi nhận tương tác với Võ Gia Huy')).toBeInTheDocument();
    const row = within(table).getByText('Võ Gia Huy').closest('tr')!;
    expect(within(row).getByText('Hôm nay')).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toMatch(FORBIDDEN_TERMS);
  });

  it('renders Báo cáo (/crm?muc=bao-cao) without customer table/+ Thêm khách hàng, filters by period, and exports CSV', async () => {
    const user = userEvent.setup();
    const { container } = renderCrm('bao-cao');

    expect(await screen.findByRole('heading', { name: 'Báo cáo kinh doanh' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thêm khách hàng/ })).toBeNull();
    expect(screen.queryByRole('table', { name: 'Danh sách khách hàng' })).toBeNull();
    expect(container.querySelectorAll('select')).toHaveLength(0);
    expect(container.querySelectorAll('.qx-btn--primary')).toHaveLength(1);

    const kpiRegion = screen.getByLabelText('Chỉ số báo cáo theo kỳ');
    expect(within(kpiRegion).getByText('Giá trị pipeline đang mở')).toBeInTheDocument();
    expect(within(kpiRegion).getByText('Doanh thu đã chốt thành công')).toBeInTheDocument();
    expect(within(kpiRegion).getByText('Tỷ lệ thắng cơ hội')).toBeInTheDocument();
    expect(within(kpiRegion).getByText('Giá trị trung bình mỗi cơ hội')).toBeInTheDocument();
    expect(within(kpiRegion).getByText('Số lượt tương tác đầu mối')).toBeInTheDocument();

    // Verify dynamic values for "Tháng này" on 2026-11-17:
    // Open in Nov: CH-2001 (850M) + CH-2002 (420M) = 1.270.000.000 đ; Won in Nov: CH-2003 (680M) -> 100%
    expect(within(kpiRegion).getByText(/1\.270\.000\.000 đ/)).toBeInTheDocument();
    expect(within(kpiRegion).getByText(/680\.000\.000 đ/)).toBeInTheDocument();
    expect(within(kpiRegion).getByText('100%')).toBeInTheDocument();

    // Switch Kỳ lọc to "Quý này" via custom <Select> -> includes CH-2006 (Thất bại) & CH-2005 (Won)
    await selectCustomOption(
      user,
      screen.getByRole('combobox', { name: 'Kỳ lọc' }),
      'Quý này',
    );
    expect(within(kpiRegion).getByText(/1\.795\.000\.000 đ/)).toBeInTheDocument();
    expect(within(kpiRegion).getByText(/1\.190\.000\.000 đ/)).toBeInTheDocument();
    expect(within(kpiRegion).getByText('67%')).toBeInTheDocument();

    // Switch Kỳ lọc to "30 ngày gần nhất" -> CH-2001+2002+2004 = 1.455.000.000 đ; CH-2003+2005 = 1.190.000.000 đ
    await selectCustomOption(
      user,
      screen.getByRole('combobox', { name: 'Kỳ lọc' }),
      '30 ngày gần nhất',
    );
    expect(within(kpiRegion).getByText(/1\.455\.000\.000 đ/)).toBeInTheDocument();
    expect(within(kpiRegion).getByText(/1\.190\.000\.000 đ/)).toBeInTheDocument();

    // Switch Kỳ lọc to "Năm nay" -> includes CH-2008 (290M Won) -> 1.480.000.000 đ, 75%
    await selectCustomOption(
      user,
      screen.getByRole('combobox', { name: 'Kỳ lọc' }),
      'Năm nay',
    );
    expect(within(kpiRegion).getByText(/1\.480\.000\.000 đ/)).toBeInTheDocument();
    expect(within(kpiRegion).getByText('75%')).toBeInTheDocument();

    // Filter by Nhân viên phụ trách = Đức Anh (CH-2003 + CH-2008 = 970.000.000 đ won)
    await selectCustomOption(
      user,
      screen.getByRole('combobox', { name: 'Nhân viên phụ trách' }),
      'Đức Anh',
    );
    expect(within(kpiRegion).getByText(/970\.000\.000 đ/)).toBeInTheDocument();
    expect(within(kpiRegion).getByText('100%')).toBeInTheDocument();

    // Breakdown tables present
    expect(screen.getByRole('table', { name: 'Hiệu suất theo giai đoạn bán hàng' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Hiệu suất theo nhân viên phụ trách' })).toBeInTheDocument();

    // Export CSV action
    await user.click(screen.getByRole('button', { name: 'Xuất báo cáo CSV' }));
    expect(await screen.findByText('Đã xuất báo cáo CSV (Năm nay)')).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toMatch(FORBIDDEN_TERMS);
  });
});
