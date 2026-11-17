import { test, type Page, type Route } from '@playwright/test';
import type { MeResponse, NotifyChannel, NotifyStatus, Role, SocialCategory } from '@qsystem/contracts';

export const MOCK_REFRESH_TOKEN = 'e2e-mock-refresh-token-qsystem-2026';

export type AvatarTone = 'plum' | 'indigo' | 'slate' | 'teal' | 'cyan';

export interface MockDepartment {
  id: string;
  name: string;
  sampleCount?: number;
}

export interface MockOrgUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  departmentId: string | null;
  reportsToId: string | null;
  jobTitle?: string;
  statusLabel?: 'Đang làm' | 'Nghỉ phép';
  avatarTone?: AvatarTone;
  employeeCode?: string;
}

export interface MockTaskRow {
  id: string;
  code: string;
  title: string;
  assigneeId?: string | null;
  assigneeName: string;
  dueDate: string;
  departmentId?: string | null;
  status: 'Đang làm' | 'Chờ duyệt' | 'Hoàn thành' | 'Quá hạn';
  version?: number;
  priority?: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  project?: string | null;
  description?: string | null;
}

export interface MockCustomerRow {
  id: string;
  code: string;
  name: string;
  email: string;
  industry: string;
  segment: 'enterprise' | 'individual';
  ownerInitials: string;
  ownerName: string;
  ownerTone: AvatarTone;
  stage: 'Mới' | 'Tiềm năng' | 'Đàm phán' | 'Đang chăm sóc';
  lastContact: string;
}

export interface MockSocialComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  content: string;
  createdAt: string;
}

export interface MockSocialPost {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  departmentId: string | null;
  departmentName: string | null;
  category: SocialCategory;
  content: string;
  pinned: boolean;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  comments: MockSocialComment[];
  createdAt: string;
  updatedAt: string;
}

export interface MockFileRow {
  id: string;
  key: string;
  displayName?: string;
  mimeType?: string;
  size?: number;
  uploaderName?: string;
  createdAt?: string;
}

export interface MockNotificationRow {
  id: string;
  channel: NotifyChannel;
  recipient: string;
  recipientId: string | null;
  payload: { title?: string; body?: string; [k: string]: unknown } | null;
  status: NotifyStatus;
  attempts: number;
  readAt?: string | null;
  createdAt: string;
}

export interface MockSearchHit {
  id: string;
  title: string;
  [k: string]: unknown;
}

export interface MockApiState {
  authenticated: boolean;
  me: MeResponse;
  departments: MockDepartment[];
  users: MockOrgUser[];
  tasks: MockTaskRow[];
  customers: MockCustomerRow[];
  posts: MockSocialPost[];
  files: MockFileRow[];
  notifications: MockNotificationRow[];
  searchHits: MockSearchHit[];
  searchCalls: number;
  nextId: number;
}

export interface MockApiOptions {
  role?: Role;
  unauthenticated?: boolean;
  failLogin401?: boolean;
  failSearch503Once?: boolean;
  state?: MockApiState;
}

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildMePreset(role: Role = 'DIRECTOR'): MeResponse {
  if (role === 'EMPLOYEE') {
    return {
      id: 'u-emp-01',
      email: 'nam.le@qsystem.vn',
      name: 'Lê Hoàng Nam',
      role: 'EMPLOYEE',
      departmentId: 'dept-tech',
      managedDepartmentIds: [],
    };
  }
  if (role === 'MANAGER') {
    return {
      id: 'u-mgr-01',
      email: 'anh.tran@qsystem.vn',
      name: 'Trần Lan Anh',
      role: 'MANAGER',
      departmentId: 'dept-tech',
      managedDepartmentIds: ['dept-tech'],
    };
  }
  return {
    id: 'u-dir-01',
    email: 'khoi.nguyen@qsystem.vn',
    name: 'Nguyễn Minh Khôi',
    role: 'DIRECTOR',
    departmentId: 'dept-exec',
    managedDepartmentIds: ['dept-exec', 'dept-tech', 'dept-hr', 'dept-sales'],
  };
}

export function createMockApiState(options?: { role?: Role; unauthenticated?: boolean }): MockApiState {
  const role = options?.role ?? 'DIRECTOR';
  const me = buildMePreset(role);
  const today = isoDateOffset(0);
  const tomorrow = isoDateOffset(1);
  const nextWeek = isoDateOffset(5);
  const lastWeek = isoDateOffset(-4);

  const departments: MockDepartment[] = [
    { id: 'dept-exec', name: 'Ban điều hành', sampleCount: 1 },
    { id: 'dept-tech', name: 'Công nghệ', sampleCount: 3 },
    { id: 'dept-hr', name: 'Nhân sự', sampleCount: 1 },
    { id: 'dept-sales', name: 'Kinh doanh', sampleCount: 1 },
  ];

  const users: MockOrgUser[] = [
    {
      id: 'u-dir-01',
      email: 'khoi.nguyen@qsystem.vn',
      name: 'Nguyễn Minh Khôi',
      role: 'DIRECTOR',
      departmentId: 'dept-exec',
      reportsToId: null,
      jobTitle: 'Giám đốc điều hành',
      statusLabel: 'Đang làm',
      avatarTone: 'indigo',
      employeeCode: 'NV-001',
    },
    {
      id: 'u-mgr-01',
      email: 'anh.tran@qsystem.vn',
      name: 'Trần Lan Anh',
      role: 'MANAGER',
      departmentId: 'dept-tech',
      reportsToId: 'u-dir-01',
      jobTitle: 'Trưởng phòng Công nghệ',
      statusLabel: 'Đang làm',
      avatarTone: 'teal',
      employeeCode: 'NV-002',
    },
    {
      id: 'u-emp-01',
      email: 'nam.le@qsystem.vn',
      name: 'Lê Hoàng Nam',
      role: 'EMPLOYEE',
      departmentId: 'dept-tech',
      reportsToId: 'u-mgr-01',
      jobTitle: 'Kỹ sư hệ thống',
      statusLabel: 'Đang làm',
      avatarTone: 'slate',
      employeeCode: 'NV-003',
    },
    {
      id: 'u-hr-01',
      email: 'huong.pham@qsystem.vn',
      name: 'Phạm Thu Hương',
      role: 'MANAGER',
      departmentId: 'dept-hr',
      reportsToId: 'u-dir-01',
      jobTitle: 'Trưởng phòng Nhân sự',
      statusLabel: 'Đang làm',
      avatarTone: 'plum',
      employeeCode: 'NV-004',
    },
    {
      id: 'u-sales-01',
      email: 'tuan.vu@qsystem.vn',
      name: 'Vũ Quốc Tuấn',
      role: 'EMPLOYEE',
      departmentId: 'dept-sales',
      reportsToId: 'u-dir-01',
      jobTitle: 'Chuyên viên kinh doanh',
      statusLabel: 'Nghỉ phép',
      avatarTone: 'cyan',
      employeeCode: 'NV-005',
    },
  ];

  const tasks: MockTaskRow[] = [
    {
      id: 't-101',
      code: 'CV-1041',
      title: 'Rà soát quy trình vận hành quý IV',
      assigneeId: me.id,
      assigneeName: me.name,
      dueDate: today,
      departmentId: 'dept-exec',
      status: 'Đang làm',
      version: 1,
      priority: 'HIGH',
      project: 'Chuẩn hóa vận hành',
      description: 'Kiểm tra biểu mẫu bàn giao và tổng hợp báo cáo khối vận hành.',
    },
    {
      id: 't-102',
      code: 'CV-1042',
      title: 'Cập nhật phân quyền truy cập hệ thống',
      assigneeId: 'u-mgr-01',
      assigneeName: 'Trần Lan Anh',
      dueDate: tomorrow,
      departmentId: 'dept-tech',
      status: 'Chờ duyệt',
      version: 1,
      priority: 'URGENT',
      project: 'Hạ tầng bảo mật',
      description: 'Xác minh ma trận phân quyền phòng ban trước kỳ kiểm toán.',
    },
    {
      id: 't-103',
      code: 'CV-1043',
      title: 'Tổng hợp bảng công tháng hiện tại',
      assigneeId: 'u-hr-01',
      assigneeName: 'Phạm Thu Hương',
      dueDate: lastWeek,
      departmentId: 'dept-hr',
      status: 'Quá hạn',
      version: 1,
      priority: 'HIGH',
      project: 'Quản trị nhân sự',
      description: 'Đối chiếu dữ liệu chấm công và đơn xin nghỉ phép.',
    },
    {
      id: 't-104',
      code: 'CV-1044',
      title: 'Chuẩn bị tài liệu đào tạo hội nhập',
      assigneeId: me.id,
      assigneeName: me.name,
      dueDate: nextWeek,
      departmentId: 'dept-hr',
      status: 'Đang làm',
      version: 1,
      priority: 'NORMAL',
      project: 'Đào tạo nội bộ',
      description: 'Hoàn thiện bộ slide hướng dẫn công cụ nội bộ cho nhân sự mới.',
    },
    {
      id: 't-105',
      code: 'CV-1045',
      title: 'Kiểm thử sao lưu cơ sở dữ liệu định kỳ',
      assigneeId: me.id,
      assigneeName: me.name,
      dueDate: lastWeek,
      departmentId: 'dept-tech',
      status: 'Hoàn thành',
      version: 2,
      priority: 'LOW',
      project: 'Hạ tầng bảo mật',
      description: 'Hoàn tất diễn tập khôi phục dữ liệu trên môi trường dự phòng.',
    },
  ];

  const customers: MockCustomerRow[] = [
    {
      id: 'cust-1',
      code: 'KH-201',
      name: 'Công ty Cổ phần Công nghệ Ánh Dương',
      email: 'lienhe@anhduongtech.vn',
      industry: 'Phần mềm',
      segment: 'enterprise',
      ownerInitials: 'MK',
      ownerName: 'Nguyễn Minh Khôi',
      ownerTone: 'indigo',
      stage: 'Đàm phán',
      lastContact: today,
    },
    {
      id: 'cust-2',
      code: 'KH-202',
      name: 'Tập đoàn Logistics Đông Nam',
      email: 'hopdong@dongnamlog.vn',
      industry: 'Vận tải',
      segment: 'enterprise',
      ownerInitials: 'LA',
      ownerName: 'Trần Lan Anh',
      ownerTone: 'teal',
      stage: 'Tiềm năng',
      lastContact: lastWeek,
    },
    {
      id: 'cust-3',
      code: 'KH-203',
      name: 'Hoàng Gia Bảo',
      email: 'giabao.hoang@gmail.com',
      industry: 'Tư vấn',
      segment: 'individual',
      ownerInitials: 'QT',
      ownerName: 'Vũ Quốc Tuấn',
      ownerTone: 'cyan',
      stage: 'Đang chăm sóc',
      lastContact: today,
    },
    {
      id: 'cust-4',
      code: 'KH-204',
      name: 'Công ty TNHH Thực phẩm Xanh Việt',
      email: 'muahang@xanhvietfood.vn',
      industry: 'Bán lẻ',
      segment: 'enterprise',
      ownerInitials: 'MK',
      ownerName: 'Nguyễn Minh Khôi',
      ownerTone: 'plum',
      stage: 'Mới',
      lastContact: today,
    },
  ];

  const posts: MockSocialPost[] = [
    {
      id: 'post-1',
      authorId: 'u-dir-01',
      authorName: 'Nguyễn Minh Khôi',
      authorRole: 'DIRECTOR',
      departmentId: 'dept-exec',
      departmentName: 'Ban điều hành',
      category: 'ANNOUNCEMENT',
      content: 'Thông báo lịch rà soát mục tiêu vận hành quý IV cho toàn thể các phòng ban vào sáng thứ Năm.',
      pinned: true,
      likeCount: 4,
      likedByMe: false,
      commentCount: 1,
      comments: [
        {
          id: 'cmt-1',
          postId: 'post-1',
          authorId: 'u-mgr-01',
          authorName: 'Trần Lan Anh',
          authorRole: 'MANAGER',
          content: 'Khối Công nghệ đã sẵn sàng số liệu báo cáo.',
          createdAt: '2026-11-15T03:00:00Z',
        },
      ],
      createdAt: '2026-11-15T02:00:00Z',
      updatedAt: '2026-11-15T03:00:00Z',
    },
    {
      id: 'post-2',
      authorId: 'u-mgr-01',
      authorName: 'Trần Lan Anh',
      authorRole: 'MANAGER',
      departmentId: 'dept-tech',
      departmentName: 'Công nghệ',
      category: 'SHARING',
      content: 'Chia sẻ danh sách kiểm tra bảo mật trước khi phát hành phiên bản mới lên hệ thống.',
      pinned: false,
      likeCount: 2,
      likedByMe: true,
      commentCount: 0,
      comments: [],
      createdAt: '2026-11-14T08:00:00Z',
      updatedAt: '2026-11-14T08:00:00Z',
    },
    {
      id: 'post-3',
      authorId: 'u-hr-01',
      authorName: 'Phạm Thu Hương',
      authorRole: 'MANAGER',
      departmentId: 'dept-hr',
      departmentName: 'Nhân sự',
      category: 'KUDOS',
      content: 'Cảm ơn nhóm hạ tầng đã hỗ trợ xử lý kịp thời sự cố mạng nội bộ sáng nay.',
      pinned: false,
      likeCount: 3,
      likedByMe: false,
      commentCount: 0,
      comments: [],
      createdAt: '2026-11-13T09:00:00Z',
      updatedAt: '2026-11-13T09:00:00Z',
    },
  ];

  const files: MockFileRow[] = [
    {
      id: 'f-1',
      key: 'uploads/Hop-dong-dich-vu-2026.pdf',
      displayName: 'Hợp đồng dịch vụ 2026.pdf',
      mimeType: 'application/pdf',
      size: 245_760,
      uploaderName: 'Nguyễn Minh Khôi',
      createdAt: '2026-11-10T04:00:00Z',
    },
    {
      id: 'f-2',
      key: 'uploads/Bang-du-toan-quy-IV.xlsx',
      displayName: 'Bảng dự toán quý IV.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 128_000,
      uploaderName: 'Phạm Thu Hương',
      createdAt: '2026-11-11T04:00:00Z',
    },
    {
      id: 'f-3',
      key: 'uploads/Quy-trinh-ban-giao.docx',
      displayName: 'Quy trình bàn giao.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 86_400,
      uploaderName: 'Trần Lan Anh',
      createdAt: '2026-11-12T04:00:00Z',
    },
    {
      id: 'f-4',
      key: 'uploads/Cau-hinh-tich-hop.json',
      displayName: 'Cấu hình tích hợp.json',
      mimeType: 'application/json',
      size: 14_336,
      uploaderName: 'Lê Hoàng Nam',
      createdAt: '2026-11-13T04:00:00Z',
    },
  ];

  const notifications: MockNotificationRow[] = [
    {
      id: 'n-1',
      channel: 'SOCKET',
      recipient: me.email,
      recipientId: me.id,
      payload: {
        title: 'Công việc của bạn sắp đến hạn xử lý hôm nay',
        body: 'CV-1041 · Rà soát quy trình vận hành quý IV cần hoàn thành trước 17:30.',
      },
      status: 'SENT',
      attempts: 1,
      readAt: null,
      createdAt: '2026-11-17T02:00:00Z',
    },
    {
      id: 'n-2',
      channel: 'EMAIL',
      recipient: me.email,
      recipientId: me.id,
      payload: {
        title: 'Yêu cầu phê duyệt phân quyền hệ thống',
        body: 'Trần Lan Anh đã gửi yêu cầu duyệt công việc CV-1042.',
      },
      status: 'SENT',
      attempts: 1,
      readAt: null,
      createdAt: '2026-11-16T07:30:00Z',
    },
    {
      id: 'n-3',
      channel: 'VIBER',
      recipient: me.email,
      recipientId: me.id,
      payload: {
        title: 'Cập nhật lịch họp giao ban đầu tuần',
        body: 'Phòng họp A1 lúc 09:00 ngày mai.',
      },
      status: 'SENT',
      attempts: 1,
      readAt: '2026-11-16T08:00:00Z',
      createdAt: '2026-11-15T10:00:00Z',
    },
  ];

  const searchHits: MockSearchHit[] = [
    { id: 'doc-1', title: 'Báo cáo tài chính quý IV', kind: 'Tài liệu', href: '/files' },
    { id: 'doc-2', title: 'Quy trình chấm công nội bộ', kind: 'Quy định', href: '/org?muc=cham-cong' },
    { id: 'doc-3', title: 'Kế hoạch triển khai khách hàng doanh nghiệp', kind: 'Kinh doanh', href: '/crm' },
  ];

  return {
    authenticated: !options?.unauthenticated,
    me,
    departments,
    users,
    tasks,
    customers,
    posts,
    files,
    notifications,
    searchHits,
    searchCalls: 0,
    nextId: 1,
  };
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'NV';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

async function readJsonBody<T>(route: Route): Promise<T> {
  const raw = route.request().postData();
  if (!raw) return {} as T;
  return JSON.parse(raw) as T;
}

export async function installApiMocks(page: Page, options: MockApiOptions = {}): Promise<MockApiState> {
  const state =
    options.state ??
    createMockApiState({
      role: options.role,
      unauthenticated: options.unauthenticated,
    });

  const baseUrl = test.info().project.use.baseURL || 'http://127.0.0.1:3100';

  if (options.unauthenticated) {
    await page.context().clearCookies();
  } else {
    await page.context().addCookies([
      {
        name: 'refresh_token',
        value: MOCK_REFRESH_TOKEN,
        url: baseUrl,
      },
    ]);
  }

  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const method = req.method().toUpperCase();
    const url = new URL(req.url());
    const pathname = url.pathname;

    if (pathname === '/api/notifications/stream' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        body: ': keepalive\n\n',
      });
      return;
    }

    if (pathname === '/api/me' && method === 'GET') {
      if (!state.authenticated) {
        await route.fulfill({
          status: 401,
          json: { code: 'UNAUTHORIZED', message: 'Phiên đăng nhập đã hết hạn.' },
        });
        return;
      }
      await route.fulfill({ status: 200, json: state.me });
      return;
    }

    if (pathname === '/api/me/password' && method === 'PATCH') {
      const body = await readJsonBody<{ oldPassword?: string; newPassword?: string }>(route);
      if (!body.oldPassword || !body.newPassword || body.newPassword.length < 8) {
        await route.fulfill({
          status: 400,
          json: { code: 'INVALID_INPUT', message: 'Mật khẩu mới cần ít nhất 8 ký tự.' },
        });
        return;
      }
      await route.fulfill({ status: 200, json: { ok: true } });
      return;
    }

    if (pathname === '/api/auth/login' && method === 'POST') {
      if (options.failLogin401) {
        await route.fulfill({
          status: 401,
          json: { code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không đúng.' },
        });
        return;
      }
      state.authenticated = true;
      await route.fulfill({
        status: 200,
        headers: {
          'Set-Cookie': `refresh_token=${MOCK_REFRESH_TOKEN}; Path=/; SameSite=Lax`,
        },
        json: { accessToken: 'e2e-access-token-2026' },
      });
      return;
    }

    if (pathname === '/api/auth/refresh' && method === 'POST') {
      if (!state.authenticated) {
        await route.fulfill({
          status: 401,
          json: { code: 'UNAUTHORIZED', message: 'Phiên đăng nhập đã hết hạn.' },
        });
        return;
      }
      await route.fulfill({ status: 200, json: { accessToken: 'e2e-access-token-2026' } });
      return;
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      state.authenticated = false;
      await route.fulfill({ status: 200, json: { ok: true } });
      return;
    }

    if (pathname === '/api/registry' && method === 'GET') {
      await route.fulfill({
        status: 200,
        json: [
          { id: 'qtask', name: 'QTask', description: 'Giao việc và theo dõi tiến độ' },
          { id: 'qhrm', name: 'QHRM', description: 'Nhân sự, phòng ban và chấm công' },
          { id: 'qcrm', name: 'QCRM', description: 'Khách hàng và cơ hội bán hàng' },
          { id: 'qsocial', name: 'QSocial', description: 'Tin tức và trao đổi nội bộ' },
        ],
      });
      return;
    }

    if (pathname === '/api/search' && method === 'GET') {
      state.searchCalls += 1;
      if (options.failSearch503Once && state.searchCalls === 1) {
        await route.fulfill({
          status: 503,
          json: { code: 'SERVICE_UNAVAILABLE', message: 'Dịch vụ tìm kiếm tạm gián đoạn.' },
        });
        return;
      }
      const q = (url.searchParams.get('q') || '').trim().toLowerCase();
      const limit = Number(url.searchParams.get('limit') || 20);
      const offset = Number(url.searchParams.get('offset') || 0);
      const filtered = q
        ? state.searchHits.filter((h) => h.title.toLowerCase().includes(q))
        : state.searchHits;
      await route.fulfill({
        status: 200,
        json: {
          hits: filtered.slice(offset, offset + limit),
          total: filtered.length,
          limit,
          offset,
        },
      });
      return;
    }

    if (pathname === '/api/org/tasks' && method === 'GET') {
      const status = url.searchParams.get('status');
      const departmentId = url.searchParams.get('departmentId');
      const assigneeId = url.searchParams.get('assigneeId');
      const q = (url.searchParams.get('q') || '').trim().toLowerCase();
      const pageNum = Math.max(1, Number(url.searchParams.get('page') || 1));
      const pageSize = Math.max(1, Number(url.searchParams.get('pageSize') || 50));

      let items = [...state.tasks];
      if (status) items = items.filter((t) => t.status === status);
      if (departmentId) items = items.filter((t) => t.departmentId === departmentId);
      if (assigneeId) items = items.filter((t) => t.assigneeId === assigneeId);
      if (q) {
        items = items.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.code.toLowerCase().includes(q) ||
            t.assigneeName.toLowerCase().includes(q),
        );
      }

      const start = (pageNum - 1) * pageSize;
      await route.fulfill({
        status: 200,
        json: {
          items: items.slice(start, start + pageSize),
          total: items.length,
          page: pageNum,
          pageSize,
        },
      });
      return;
    }

    if (pathname === '/api/org/tasks' && method === 'POST') {
      const body = await readJsonBody<Record<string, unknown>>(route);
      const seq = 1050 + state.nextId++;
      const newTask: MockTaskRow = {
        id: `t-${seq}`,
        code: `CV-${seq}`,
        title: String(body.title || body.what || 'Công việc mới'),
        assigneeId: typeof body.assigneeId === 'string' ? body.assigneeId : state.me.id,
        assigneeName: String(body.assigneeName || body.who || state.me.name),
        dueDate: String(body.dueDate || body.when || isoDateOffset(2)),
        departmentId: typeof body.departmentId === 'string' ? body.departmentId : state.me.departmentId,
        status: 'Đang làm',
        version: 1,
        priority: (body.priority as MockTaskRow['priority']) || 'NORMAL',
        project: typeof body.project === 'string' ? body.project : null,
        description: typeof body.description === 'string' ? body.description : null,
      };
      state.tasks.unshift(newTask);
      await route.fulfill({ status: 201, json: { ok: true, task: newTask } });
      return;
    }

    if (pathname.startsWith('/api/org/tasks/') && method === 'PATCH') {
      const id = decodeURIComponent(pathname.slice('/api/org/tasks/'.length));
      const body = await readJsonBody<{ status?: MockTaskRow['status']; version?: number }>(route);
      const found = state.tasks.find((t) => t.id === id);
      if (!found) {
        await route.fulfill({ status: 404, json: { code: 'NOT_FOUND', message: 'Không tìm thấy công việc.' } });
        return;
      }
      if (body.status) found.status = body.status;
      found.version = (found.version ?? 1) + 1;
      await route.fulfill({ status: 200, json: { ok: true, task: found } });
      return;
    }

    if (pathname === '/api/org/departments' && method === 'GET') {
      await route.fulfill({ status: 200, json: state.departments });
      return;
    }

    if (pathname === '/api/org/departments' && method === 'POST') {
      const body = await readJsonBody<{ name?: string }>(route);
      const id = `dept-${state.nextId++}`;
      const dept: MockDepartment = {
        id,
        name: String(body.name || 'Phòng ban mới').trim(),
        sampleCount: 0,
      };
      state.departments.push(dept);
      await route.fulfill({ status: 201, json: dept });
      return;
    }

    if (pathname === '/api/org/users' && method === 'GET') {
      await route.fulfill({ status: 200, json: state.users });
      return;
    }

    if (pathname === '/api/org/users' && method === 'POST') {
      const body = await readJsonBody<Partial<MockOrgUser>>(route);
      const seq = state.nextId++;
      const created: MockOrgUser = {
        id: `u-new-${seq}`,
        email: String(body.email || `user${seq}@qsystem.vn`),
        name: String(body.name || 'Nhân sự mới'),
        role: (body.role as Role) || 'EMPLOYEE',
        departmentId: body.departmentId ?? null,
        reportsToId: body.reportsToId ?? null,
        jobTitle: body.jobTitle || 'Chuyên viên',
        statusLabel: 'Đang làm',
        avatarTone: 'indigo',
        employeeCode: `NV-${100 + seq}`,
      };
      state.users.unshift(created);
      await route.fulfill({ status: 201, json: created });
      return;
    }

    if (pathname === '/api/org/crm/customers' && method === 'GET') {
      await route.fulfill({ status: 200, json: { items: state.customers } });
      return;
    }

    if (pathname === '/api/org/crm/customers' && method === 'POST') {
      const body = await readJsonBody<Partial<MockCustomerRow>>(route);
      const seq = 200 + state.nextId++;
      const ownerName = String(body.ownerName || state.me.name);
      const customer: MockCustomerRow = {
        id: `cust-${seq}`,
        code: `KH-${seq}`,
        name: String(body.name || 'Khách hàng mới'),
        email: String(body.email || `contact${seq}@partner.vn`),
        industry: String(body.industry || 'Phần mềm'),
        segment: body.segment === 'individual' ? 'individual' : 'enterprise',
        ownerInitials: initialsOf(ownerName),
        ownerName,
        ownerTone: 'teal',
        stage: body.stage || 'Mới',
        lastContact: body.lastContact || isoDateOffset(0),
      };
      state.customers.unshift(customer);
      await route.fulfill({ status: 201, json: { customer } });
      return;
    }

    if (pathname.startsWith('/api/org/crm/customers/') && method === 'PATCH') {
      const id = decodeURIComponent(pathname.slice('/api/org/crm/customers/'.length));
      const body = await readJsonBody<Partial<MockCustomerRow>>(route);
      const found = state.customers.find((c) => c.id === id);
      if (found) {
        if (body.stage) found.stage = body.stage;
        if (body.lastContact) found.lastContact = body.lastContact;
      }
      await route.fulfill({ status: 200, json: { ok: true } });
      return;
    }

    if (pathname.startsWith('/api/org/crm/customers/') && method === 'DELETE') {
      const id = decodeURIComponent(pathname.slice('/api/org/crm/customers/'.length));
      state.customers = state.customers.filter((c) => c.id !== id);
      await route.fulfill({ status: 200, json: { ok: true } });
      return;
    }

    if (pathname === '/api/social/posts' && method === 'GET') {
      const category = url.searchParams.get('category');
      const departmentId = url.searchParams.get('departmentId');
      const authorId = url.searchParams.get('authorId');
      const pinnedOnly = url.searchParams.get('pinnedOnly') === 'true';
      const q = (url.searchParams.get('q') || '').trim().toLowerCase();

      let items = [...state.posts];
      if (category) items = items.filter((p) => p.category === category);
      if (departmentId) items = items.filter((p) => p.departmentId === departmentId);
      if (authorId) items = items.filter((p) => p.authorId === authorId);
      if (pinnedOnly) items = items.filter((p) => p.pinned);
      if (q) items = items.filter((p) => p.content.toLowerCase().includes(q) || p.authorName.toLowerCase().includes(q));

      await route.fulfill({
        status: 200,
        json: { items, total: items.length, page: 1, pageSize: 20 },
      });
      return;
    }

    if (pathname === '/api/social/posts' && method === 'POST') {
      const body = await readJsonBody<{ content?: string; category?: SocialCategory; departmentId?: string | null; pinned?: boolean }>(route);
      const seq = state.nextId++;
      const dept = state.departments.find((d) => d.id === body.departmentId);
      const now = new Date().toISOString();
      const post: MockSocialPost = {
        id: `post-new-${seq}`,
        authorId: state.me.id,
        authorName: state.me.name,
        authorRole: state.me.role,
        departmentId: body.departmentId ?? state.me.departmentId,
        departmentName: dept?.name ?? 'Toàn công ty',
        category: body.category ?? 'SHARING',
        content: String(body.content || ''),
        pinned: Boolean(body.pinned),
        likeCount: 0,
        likedByMe: false,
        commentCount: 0,
        comments: [],
        createdAt: now,
        updatedAt: now,
      };
      state.posts.unshift(post);
      await route.fulfill({ status: 201, json: { ok: true, post } });
      return;
    }

    if (pathname.startsWith('/api/social/posts/') && pathname.endsWith('/like') && method === 'POST') {
      const id = decodeURIComponent(pathname.slice('/api/social/posts/'.length, -'/like'.length));
      const post = state.posts.find((p) => p.id === id);
      if (!post) {
        await route.fulfill({ status: 404, json: { code: 'NOT_FOUND', message: 'Không tìm thấy bài viết.' } });
        return;
      }
      post.likedByMe = !post.likedByMe;
      post.likeCount = Math.max(0, post.likeCount + (post.likedByMe ? 1 : -1));
      await route.fulfill({ status: 200, json: { ok: true, liked: post.likedByMe, post } });
      return;
    }

    if (pathname.startsWith('/api/social/posts/') && pathname.endsWith('/comments') && method === 'POST') {
      const id = decodeURIComponent(pathname.slice('/api/social/posts/'.length, -'/comments'.length));
      const body = await readJsonBody<{ content?: string }>(route);
      const post = state.posts.find((p) => p.id === id);
      if (!post) {
        await route.fulfill({ status: 404, json: { code: 'NOT_FOUND', message: 'Không tìm thấy bài viết.' } });
        return;
      }
      const comment: MockSocialComment = {
        id: `cmt-${state.nextId++}`,
        postId: post.id,
        authorId: state.me.id,
        authorName: state.me.name,
        authorRole: state.me.role,
        content: String(body.content || ''),
        createdAt: new Date().toISOString(),
      };
      post.comments.push(comment);
      post.commentCount = post.comments.length;
      post.updatedAt = comment.createdAt;
      await route.fulfill({ status: 201, json: { ok: true, comment, post } });
      return;
    }

    if (pathname.startsWith('/api/social/posts/') && method === 'PATCH') {
      const id = decodeURIComponent(pathname.slice('/api/social/posts/'.length));
      const body = await readJsonBody<{ content?: string; category?: SocialCategory; pinned?: boolean }>(route);
      const post = state.posts.find((p) => p.id === id);
      if (!post) {
        await route.fulfill({ status: 404, json: { code: 'NOT_FOUND', message: 'Không tìm thấy bài viết.' } });
        return;
      }
      if (body.content !== undefined) post.content = body.content;
      if (body.category !== undefined) post.category = body.category;
      if (body.pinned !== undefined) post.pinned = body.pinned;
      post.updatedAt = new Date().toISOString();
      await route.fulfill({ status: 200, json: { ok: true, post } });
      return;
    }

    if (pathname.startsWith('/api/social/posts/') && method === 'DELETE') {
      const id = decodeURIComponent(pathname.slice('/api/social/posts/'.length));
      state.posts = state.posts.filter((p) => p.id !== id);
      await route.fulfill({ status: 200, json: { ok: true, id } });
      return;
    }

    if (pathname === '/api/files' && method === 'GET') {
      await route.fulfill({ status: 200, json: state.files });
      return;
    }

    if (pathname === '/api/files/presign' && method === 'POST') {
      const body = await readJsonBody<{ key?: string; mimeType?: string; size?: number }>(route);
      const fileId = `f-up-${state.nextId++}`;
      const key = String(body.key || `uploads/tep-${fileId}.pdf`);
      state.files.unshift({
        id: fileId,
        key,
        displayName: key.split('/').pop() || key,
        mimeType: body.mimeType || 'application/octet-stream',
        size: body.size ?? 1024,
        uploaderName: state.me.name,
        createdAt: new Date().toISOString(),
      });
      await route.fulfill({
        status: 200,
        json: { fileId, uploadUrl: `/api/files/mock-upload/${fileId}` },
      });
      return;
    }

    if (pathname.startsWith('/api/files/mock-upload/') && method === 'PUT') {
      await route.fulfill({ status: 200, json: { ok: true } });
      return;
    }

    if (pathname.startsWith('/api/files/mock-download/') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'text/plain', body: 'mock-file-content' });
      return;
    }

    if (pathname.startsWith('/api/files/') && method === 'GET') {
      const id = decodeURIComponent(pathname.slice('/api/files/'.length));
      await route.fulfill({ status: 200, json: { id, url: `/api/files/mock-download/${encodeURIComponent(id)}` } });
      return;
    }

    if (pathname.startsWith('/api/files/') && method === 'PATCH') {
      const id = decodeURIComponent(pathname.slice('/api/files/'.length));
      const body = await readJsonBody<{ displayName?: string }>(route);
      const found = state.files.find((f) => f.id === id);
      if (found && body.displayName) {
        found.displayName = body.displayName;
      }
      await route.fulfill({ status: 200, json: { ok: true } });
      return;
    }

    if (pathname.startsWith('/api/files/') && method === 'DELETE') {
      const id = decodeURIComponent(pathname.slice('/api/files/'.length));
      state.files = state.files.filter((f) => f.id !== id);
      await route.fulfill({ status: 200, json: { ok: true } });
      return;
    }

    if (pathname === '/api/notifications' && method === 'GET') {
      await route.fulfill({ status: 200, json: state.notifications });
      return;
    }

    if (pathname === '/api/notifications/read-all' && method === 'POST') {
      const readAt = new Date().toISOString();
      let count = 0;
      for (const item of state.notifications) {
        if (!item.readAt) {
          item.readAt = readAt;
          count += 1;
        }
      }
      await route.fulfill({ status: 200, json: { ok: true, count, readAt } });
      return;
    }

    if (pathname.startsWith('/api/notifications/') && pathname.endsWith('/read') && method === 'PATCH') {
      const id = decodeURIComponent(pathname.slice('/api/notifications/'.length, -'/read'.length));
      const item = state.notifications.find((n) => n.id === id);
      if (!item) {
        await route.fulfill({ status: 404, json: { code: 'NOT_FOUND', message: 'Không tìm thấy thông báo.' } });
        return;
      }
      item.readAt = new Date().toISOString();
      await route.fulfill({ status: 200, json: item });
      return;
    }

    await route.fulfill({
      status: 404,
      json: { code: 'NOT_FOUND', message: `Unhandled mock API route: ${method} ${pathname}` },
    });
  });

  return state;
}
