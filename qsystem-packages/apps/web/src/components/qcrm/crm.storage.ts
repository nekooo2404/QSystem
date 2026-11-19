import {
  addLocalDaysIso,
  diffCalendarDays,
  formatDdMmYyyy,
  formatRelativeViDate,
  getLocalDateIso,
} from '../../lib/date';

export type CrmMuc = 'tong-quan' | 'khach-hang' | 'co-hoi' | 'lien-he' | 'bao-cao';

export type OwnerTone = 'plum' | 'indigo' | 'slate' | 'teal' | 'cyan';

export type CustomerSegment = 'enterprise' | 'individual';
export type CustomerStage = 'Mới' | 'Tiềm năng' | 'Đàm phán' | 'Đang chăm sóc';

export interface CustomerRow {
  id: string;
  code: string;
  name: string;
  email: string;
  industry: string;
  segment: CustomerSegment;
  ownerInitials: string;
  ownerName: string;
  ownerTone: OwnerTone;
  stage: CustomerStage;
  lastContact: string;
}

export type OpportunityStage =
  | 'Tiếp cận'
  | 'Khảo sát'
  | 'Báo giá'
  | 'Đàm phán'
  | 'Chốt thành công'
  | 'Thất bại';

export interface OpportunityRow {
  id: string;
  code: string;
  name: string;
  customerId: string;
  customerName: string;
  amountVnd: number;
  expectedCloseIso: string;
  stage: OpportunityStage;
  probability: number;
  ownerName: string;
  ownerInitials: string;
  ownerTone: OwnerTone;
  createdAtIso: string;
  closedAtIso?: string;
  notes: string;
}

export type ContactRoleType =
  | 'Đầu mối chính'
  | 'Đầu mối kỹ thuật'
  | 'Đầu mối thanh toán'
  | 'Liên hệ phụ';

export type ContactChannel = 'Điện thoại' | 'Email' | 'Zalo' | 'Gặp trực tiếp';

export interface ContactInteraction {
  id: string;
  dateIso: string;
  channel: ContactChannel;
  note: string;
  by: string;
}

export interface ContactRow {
  id: string;
  fullName: string;
  jobTitle: string;
  customerId: string;
  customerName: string;
  phone: string;
  email: string;
  contactRole: ContactRoleType;
  channel: ContactChannel;
  lastInteractionIso: string;
  ownerName: string;
  ownerInitials: string;
  ownerTone: OwnerTone;
  interactions: ContactInteraction[];
}

export type ReportPeriod = 'this-month' | 'this-quarter' | 'this-year' | 'last-30-days';

export const CRM_CUSTOMERS_STORAGE_KEY = 'qsystem:crm:customers:v1';
export const CRM_OPPORTUNITIES_STORAGE_KEY = 'qsystem:crm:opportunities:v1';
export const CRM_CONTACTS_STORAGE_KEY = 'qsystem:crm:contacts:v1';

const CRM_STORE_VERSION = 1;

interface VersionedCollection<T> {
  version: number;
  items: T[];
}

export const CUSTOMER_STAGE_LIST: readonly CustomerStage[] = [
  'Mới',
  'Tiềm năng',
  'Đàm phán',
  'Đang chăm sóc',
];

export const CUSTOMER_STAGE_BADGE: Record<CustomerStage, string> = {
  'Đang chăm sóc': 'qx-badge--green',
  'Tiềm năng': 'qx-badge--amber',
  'Đàm phán': 'qx-badge--blue',
  Mới: '',
};

export const CUSTOMER_INDUSTRIES: readonly string[] = [
  'Công nghệ',
  'Y tế',
  'Nông nghiệp',
  'Thiết kế',
  'Dịch vụ',
  'Tài chính',
  'Sản xuất',
  'Giáo dục',
];

export const OPPORTUNITY_STAGES: readonly OpportunityStage[] = [
  'Tiếp cận',
  'Khảo sát',
  'Báo giá',
  'Đàm phán',
  'Chốt thành công',
  'Thất bại',
];

export const OPEN_OPPORTUNITY_STAGES = new Set<OpportunityStage>([
  'Tiếp cận',
  'Khảo sát',
  'Báo giá',
  'Đàm phán',
]);

export const OPPORTUNITY_STAGE_PROBABILITY: Record<OpportunityStage, number> = {
  'Tiếp cận': 20,
  'Khảo sát': 35,
  'Báo giá': 55,
  'Đàm phán': 75,
  'Chốt thành công': 100,
  'Thất bại': 0,
};

export const OPPORTUNITY_STAGE_BADGE: Record<OpportunityStage, string> = {
  'Tiếp cận': '',
  'Khảo sát': 'qx-badge--blue',
  'Báo giá': 'qx-badge--amber',
  'Đàm phán': 'qx-badge--blue',
  'Chốt thành công': 'qx-badge--green',
  'Thất bại': 'qx-badge--red',
};

export const OPPORTUNITY_STAGE_BAR_TONE: Record<OpportunityStage, string> = {
  'Tiếp cận': 'stage-1',
  'Khảo sát': 'stage-2',
  'Báo giá': 'stage-3',
  'Đàm phán': 'brand',
  'Chốt thành công': 'won',
  'Thất bại': 'lost',
};

export const CONTACT_ROLES: readonly ContactRoleType[] = [
  'Đầu mối chính',
  'Đầu mối kỹ thuật',
  'Đầu mối thanh toán',
  'Liên hệ phụ',
];

export const CONTACT_ROLE_BADGE: Record<ContactRoleType, string> = {
  'Đầu mối chính': 'qx-badge--green',
  'Đầu mối kỹ thuật': 'qx-badge--blue',
  'Đầu mối thanh toán': 'qx-badge--amber',
  'Liên hệ phụ': '',
};

export const CONTACT_CHANNELS: readonly ContactChannel[] = [
  'Điện thoại',
  'Email',
  'Zalo',
  'Gặp trực tiếp',
];

export const REPORT_PERIOD_OPTIONS: ReadonlyArray<{ value: ReportPeriod; label: string }> = [
  { value: 'this-month', label: 'Tháng này' },
  { value: 'this-quarter', label: 'Quý này' },
  { value: 'this-year', label: 'Năm nay' },
  { value: 'last-30-days', label: '30 ngày gần nhất' },
];

export interface CrmOwnerOption {
  name: string;
  tone: OwnerTone;
}

export const DEFAULT_CRM_OWNERS: readonly CrmOwnerOption[] = [
  { name: 'Lan Anh', tone: 'indigo' },
  { name: 'Hà My', tone: 'slate' },
  { name: 'Đức Anh', tone: 'plum' },
  { name: 'Bảo Trâm', tone: 'teal' },
  { name: 'Minh Khôi', tone: 'cyan' },
];

export function isTestEnvironment(): boolean {
  return typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
}

export function isStrictProduction(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PUBLIC_DEMO_MODE !== 'true'
  );
}

/** Dev/demo fallback for API-backed Customer list (matches `qtask.storage.ts` & `QhrmDirectory.tsx`). */
export function canUseCrmApiFallback(): boolean {
  // Production is API-first: sample/localStorage CRM data only loads in
  // explicit demo mode (or tests with fixtures).
  return false;
}

/** Local client persistence for CRM modules that have no backend endpoints yet. */
export function canUseCrmLocalStore(): boolean {
  return false;
}

export function initialsOf(name: string): string {
  const letters = name.trim().replace(/[^a-zA-ZÀ-ỹ0-9]/g, '');
  return (letters.slice(0, 2) || 'KH').toUpperCase();
}

export function ownerInitialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'MK';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function toneForOwner(name: string): OwnerTone {
  const match = DEFAULT_CRM_OWNERS.find((o) => o.name.toLowerCase() === name.trim().toLowerCase());
  if (match) return match.tone;
  const tones: OwnerTone[] = ['indigo', 'slate', 'plum', 'teal', 'cyan'];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return tones[hash % tones.length];
}

export function sanitizeCrmCell(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed.replace(/^[=+\-@\t\r]+/, '').trim();
}

export function sanitizeCsvCell(value: unknown): string {
  const raw = String(value ?? '');
  const trimmedStart = raw.trimStart();
  const safe = /^[=+\-@\t\r]/.test(raw) || /^[=+\-@]/.test(trimmedStart) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function normalizeCustomerStage(value?: string): CustomerStage {
  if (
    value === 'Đang chăm sóc' ||
    value === 'Tiềm năng' ||
    value === 'Đàm phán' ||
    value === 'Mới'
  ) {
    return value;
  }
  return 'Mới';
}

export function formatVnd(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  const sign = safe < 0 ? '-' : '';
  const digits = Math.abs(safe)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${digits} đ`;
}

export function formatVndCompact(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  if (Math.abs(safe) >= 1_000_000_000) {
    const billions = (safe / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
    return `${billions} tỷ đ`;
  }
  if (Math.abs(safe) >= 1_000_000) {
    const millions = Math.round(safe / 1_000_000);
    return `${millions} tr đ`;
  }
  return formatVnd(safe);
}

export function formatViCount(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function todayViDisplay(baseDate?: Date): string {
  return formatDdMmYyyy(getLocalDateIso(baseDate));
}

export function formatCrmDate(iso: string): string {
  return formatDdMmYyyy(iso);
}

export function formatCrmRelativeDate(iso: string, baseDate?: Date): string {
  return formatRelativeViDate(iso, baseDate);
}

export function getIsoDaysDiff(iso: string, baseDate?: Date): number {
  return diffCalendarDays(iso, baseDate);
}

export function buildSampleCustomers(baseDate: Date = new Date()): CustomerRow[] {
  return [
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
      lastContact: formatDdMmYyyy(addLocalDaysIso(0, baseDate)),
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
      lastContact: formatDdMmYyyy(addLocalDaysIso(-1, baseDate)),
    },
    {
      id: 'c-3',
      code: 'GR',
      name: 'GreenFarm',
      email: 'greenfarm@example.com',
      industry: 'Nông nghiệp',
      segment: 'enterprise',
      ownerInitials: 'ĐA',
      ownerName: 'Đức Anh',
      ownerTone: 'plum',
      stage: 'Đàm phán',
      lastContact: formatDdMmYyyy(addLocalDaysIso(-2, baseDate)),
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
      lastContact: formatDdMmYyyy(addLocalDaysIso(-4, baseDate)),
    },
    {
      id: 'c-5',
      code: 'EA',
      name: 'EastBridge',
      email: 'eastbridge@example.com',
      industry: 'Dịch vụ',
      segment: 'enterprise',
      ownerInitials: 'MK',
      ownerName: 'Minh Khôi',
      ownerTone: 'cyan',
      stage: 'Đang chăm sóc',
      lastContact: formatDdMmYyyy(addLocalDaysIso(-6, baseDate)),
    },
  ];
}

export function buildSampleOpportunities(baseDate: Date = new Date()): OpportunityRow[] {
  return [
    {
      id: 'opp-2001',
      code: 'CH-2001',
      name: 'Triển khai hệ thống quản trị QTS',
      customerId: 'c-1',
      customerName: 'QTS Group',
      amountVnd: 850_000_000,
      expectedCloseIso: addLocalDaysIso(4, baseDate),
      stage: 'Đàm phán',
      probability: 75,
      ownerName: 'Lan Anh',
      ownerInitials: 'LA',
      ownerTone: 'indigo',
      createdAtIso: addLocalDaysIso(-3, baseDate),
      notes: 'Đã thống nhất phạm vi triển khai giai đoạn 1 và lịch đào tạo.',
    },
    {
      id: 'opp-2002',
      code: 'CH-2002',
      name: 'Gói mở rộng cổng dữ liệu Y tế',
      customerId: 'c-2',
      customerName: 'VietHealth',
      amountVnd: 420_000_000,
      expectedCloseIso: addLocalDaysIso(9, baseDate),
      stage: 'Báo giá',
      probability: 55,
      ownerName: 'Hà My',
      ownerInitials: 'HM',
      ownerTone: 'slate',
      createdAtIso: addLocalDaysIso(-1, baseDate),
      notes: 'Đang rà soát phụ lục SLA và tích hợp phân quyền phòng khám.',
    },
    {
      id: 'opp-2003',
      code: 'CH-2003',
      name: 'Phần mềm quản lý chuỗi cung ứng nông sản',
      customerId: 'c-3',
      customerName: 'GreenFarm',
      amountVnd: 680_000_000,
      expectedCloseIso: addLocalDaysIso(-2, baseDate),
      stage: 'Chốt thành công',
      probability: 100,
      ownerName: 'Đức Anh',
      ownerInitials: 'ĐA',
      ownerTone: 'plum',
      createdAtIso: addLocalDaysIso(-12, baseDate),
      closedAtIso: addLocalDaysIso(-2, baseDate),
      notes: 'Đã ký hợp đồng và bàn giao kế hoạch khởi động.',
    },
    {
      id: 'opp-2004',
      code: 'CH-2004',
      name: 'Nâng cấp không gian cộng tác thiết kế',
      customerId: 'c-4',
      customerName: 'Nova Studio',
      amountVnd: 185_000_000,
      expectedCloseIso: addLocalDaysIso(24, baseDate),
      stage: 'Khảo sát',
      probability: 35,
      ownerName: 'Bảo Trâm',
      ownerInitials: 'BT',
      ownerTone: 'teal',
      createdAtIso: addLocalDaysIso(-22, baseDate),
      notes: 'Đang thu thập quy trình duyệt mẫu thiết kế của 3 nhóm sáng tạo.',
    },
    {
      id: 'opp-2005',
      code: 'CH-2005',
      name: 'Hợp đồng số hóa vận hành EastBridge',
      customerId: 'c-5',
      customerName: 'EastBridge',
      amountVnd: 510_000_000,
      expectedCloseIso: addLocalDaysIso(-21, baseDate),
      stage: 'Chốt thành công',
      probability: 100,
      ownerName: 'Minh Khôi',
      ownerInitials: 'MK',
      ownerTone: 'cyan',
      createdAtIso: addLocalDaysIso(-36, baseDate),
      closedAtIso: addLocalDaysIso(-21, baseDate),
      notes: 'Hoàn tất nghiệm thu giai đoạn 1 đúng tiến độ.',
    },
    {
      id: 'opp-2006',
      code: 'CH-2006',
      name: 'Tích hợp đặt lịch khám tự động',
      customerId: 'c-2',
      customerName: 'VietHealth',
      amountVnd: 260_000_000,
      expectedCloseIso: addLocalDaysIso(-32, baseDate),
      stage: 'Thất bại',
      probability: 0,
      ownerName: 'Hà My',
      ownerInitials: 'HM',
      ownerTone: 'slate',
      createdAtIso: addLocalDaysIso(-48, baseDate),
      closedAtIso: addLocalDaysIso(-32, baseDate),
      notes: 'Khách hàng tạm hoãn ngân sách chuyển đổi sang năm sau.',
    },
    {
      id: 'opp-2007',
      code: 'CH-2007',
      name: 'Tự động hóa đối soát thanh toán',
      customerId: 'c-1',
      customerName: 'QTS Group',
      amountVnd: 340_000_000,
      expectedCloseIso: addLocalDaysIso(40, baseDate),
      stage: 'Tiếp cận',
      probability: 20,
      ownerName: 'Lan Anh',
      ownerInitials: 'LA',
      ownerTone: 'indigo',
      createdAtIso: addLocalDaysIso(-70, baseDate),
      notes: 'Đã trao đổi sơ bộ yêu cầu kết nối ngân hàng nội bộ.',
    },
    {
      id: 'opp-2008',
      code: 'CH-2008',
      name: 'Gói đào tạo quản trị dữ liệu nông trại',
      customerId: 'c-3',
      customerName: 'GreenFarm',
      amountVnd: 290_000_000,
      expectedCloseIso: addLocalDaysIso(-68, baseDate),
      stage: 'Chốt thành công',
      probability: 100,
      ownerName: 'Đức Anh',
      ownerInitials: 'ĐA',
      ownerTone: 'plum',
      createdAtIso: addLocalDaysIso(-90, baseDate),
      closedAtIso: addLocalDaysIso(-68, baseDate),
      notes: 'Đã hoàn thành đào tạo cho 45 quản lý vùng.',
    },
  ];
}

export function buildSampleContacts(baseDate: Date = new Date()): ContactRow[] {
  return [
    {
      id: 'ct-1',
      fullName: 'Nguyễn Hoàng Long',
      jobTitle: 'Giám đốc CNTT',
      customerId: 'c-1',
      customerName: 'QTS Group',
      phone: '0903 456 781',
      email: 'long.nguyen@qtsgroup.example.com',
      contactRole: 'Đầu mối chính',
      channel: 'Điện thoại',
      lastInteractionIso: addLocalDaysIso(0, baseDate),
      ownerName: 'Lan Anh',
      ownerInitials: 'LA',
      ownerTone: 'indigo',
      interactions: [
        {
          id: 'int-101',
          dateIso: addLocalDaysIso(0, baseDate),
          channel: 'Điện thoại',
          note: 'Chốt lịch họp rà soát điều khoản thương mại.',
          by: 'Lan Anh',
        },
        {
          id: 'int-102',
          dateIso: addLocalDaysIso(-5, baseDate),
          channel: 'Email',
          note: 'Gửi đề xuất kiến trúc triển khai.',
          by: 'Lan Anh',
        },
      ],
    },
    {
      id: 'ct-2',
      fullName: 'Trần Thu Phương',
      jobTitle: 'Trưởng dự án kỹ thuật',
      customerId: 'c-1',
      customerName: 'QTS Group',
      phone: '0912 334 890',
      email: 'phuong.tran@qtsgroup.example.com',
      contactRole: 'Đầu mối kỹ thuật',
      channel: 'Zalo',
      lastInteractionIso: addLocalDaysIso(-2, baseDate),
      ownerName: 'Lan Anh',
      ownerInitials: 'LA',
      ownerTone: 'indigo',
      interactions: [
        {
          id: 'int-201',
          dateIso: addLocalDaysIso(-2, baseDate),
          channel: 'Zalo',
          note: 'Xác nhận danh sách phân quyền người dùng thử nghiệm.',
          by: 'Lan Anh',
        },
        {
          id: 'int-202',
          dateIso: addLocalDaysIso(-18, baseDate),
          channel: 'Gặp trực tiếp',
          note: 'Khảo sát hạ tầng máy chủ tại văn phòng.',
          by: 'Lan Anh',
        },
      ],
    },
    {
      id: 'ct-3',
      fullName: 'Lê Minh Hải',
      jobTitle: 'Giám đốc mua hàng',
      customerId: 'c-2',
      customerName: 'VietHealth',
      phone: '0988 214 550',
      email: 'hai.le@viethealth.example.com',
      contactRole: 'Đầu mối chính',
      channel: 'Gặp trực tiếp',
      lastInteractionIso: addLocalDaysIso(-1, baseDate),
      ownerName: 'Hà My',
      ownerInitials: 'HM',
      ownerTone: 'slate',
      interactions: [
        {
          id: 'int-301',
          dateIso: addLocalDaysIso(-1, baseDate),
          channel: 'Gặp trực tiếp',
          note: 'Trình bày phương án báo giá gói mở rộng.',
          by: 'Hà My',
        },
        {
          id: 'int-302',
          dateIso: addLocalDaysIso(-25, baseDate),
          channel: 'Điện thoại',
          note: 'Trao đổi nhu cầu kết nối dữ liệu chi nhánh.',
          by: 'Hà My',
        },
      ],
    },
    {
      id: 'ct-4',
      fullName: 'Phạm Ngọc Quỳnh',
      jobTitle: 'Kế toán trưởng',
      customerId: 'c-3',
      customerName: 'GreenFarm',
      phone: '0934 778 129',
      email: 'quynh.pham@greenfarm.example.com',
      contactRole: 'Đầu mối thanh toán',
      channel: 'Email',
      lastInteractionIso: addLocalDaysIso(-6, baseDate),
      ownerName: 'Đức Anh',
      ownerInitials: 'ĐA',
      ownerTone: 'plum',
      interactions: [
        {
          id: 'int-401',
          dateIso: addLocalDaysIso(-6, baseDate),
          channel: 'Email',
          note: 'Đối chiếu hóa đơn đợt 1 và lịch thanh toán.',
          by: 'Đức Anh',
        },
        {
          id: 'int-402',
          dateIso: addLocalDaysIso(-35, baseDate),
          channel: 'Email',
          note: 'Cập nhật thông tin xuất hóa đơn điện tử.',
          by: 'Đức Anh',
        },
      ],
    },
    {
      id: 'ct-5',
      fullName: 'Võ Gia Huy',
      jobTitle: 'Nhà sáng lập',
      customerId: 'c-4',
      customerName: 'Nova Studio',
      phone: '0975 612 304',
      email: 'huy.vo@novastudio.example.com',
      contactRole: 'Đầu mối chính',
      channel: 'Zalo',
      lastInteractionIso: addLocalDaysIso(-21, baseDate),
      ownerName: 'Bảo Trâm',
      ownerInitials: 'BT',
      ownerTone: 'teal',
      interactions: [
        {
          id: 'int-501',
          dateIso: addLocalDaysIso(-21, baseDate),
          channel: 'Zalo',
          note: 'Gửi tài liệu khảo sát quy trình duyệt mẫu.',
          by: 'Bảo Trâm',
        },
      ],
    },
    {
      id: 'ct-6',
      fullName: 'Đặng Thảo Vy',
      jobTitle: 'Điều phối viên hợp đồng',
      customerId: 'c-5',
      customerName: 'EastBridge',
      phone: '0909 882 415',
      email: 'vy.dang@eastbridge.example.com',
      contactRole: 'Liên hệ phụ',
      channel: 'Email',
      lastInteractionIso: addLocalDaysIso(-42, baseDate),
      ownerName: 'Minh Khôi',
      ownerInitials: 'MK',
      ownerTone: 'cyan',
      interactions: [
        {
          id: 'int-601',
          dateIso: addLocalDaysIso(-42, baseDate),
          channel: 'Email',
          note: 'Xác nhận biên bản nghiệm thu đợt đầu.',
          by: 'Minh Khôi',
        },
        {
          id: 'int-602',
          dateIso: addLocalDaysIso(-72, baseDate),
          channel: 'Điện thoại',
          note: 'Hỗ trợ kiểm tra tài khoản quản trị.',
          by: 'Minh Khôi',
        },
      ],
    },
  ];
}

export function readStoredCustomers(): CustomerRow[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CRM_CUSTOMERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CustomerRow[]) : null;
  } catch {
    return null;
  }
}

export function persistStoredCustomers(rows: CustomerRow[]): void {
  if (!canUseCrmApiFallback() || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CRM_CUSTOMERS_STORAGE_KEY, JSON.stringify(rows));
  } catch {
    // Ignore storage quota errors
  }
}

function readVersionedItems<T>(key: string): T[] | null {
  if (!canUseCrmLocalStore() || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VersionedCollection<T>> | T[];
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object' && parsed.version === CRM_STORE_VERSION && Array.isArray(parsed.items)) {
      return parsed.items;
    }
    return null;
  } catch {
    return null;
  }
}

function writeVersionedItems<T>(key: string, items: T[]): void {
  if (!canUseCrmLocalStore() || typeof window === 'undefined') return;
  try {
    const payload: VersionedCollection<T> = { version: CRM_STORE_VERSION, items };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadStoredOpportunities(): OpportunityRow[] {
  const stored = readVersionedItems<OpportunityRow>(CRM_OPPORTUNITIES_STORAGE_KEY);
  if (stored && stored.length > 0) return stored;
  return buildSampleOpportunities();
}

export function persistStoredOpportunities(items: OpportunityRow[]): void {
  writeVersionedItems(CRM_OPPORTUNITIES_STORAGE_KEY, items);
}

export function loadStoredContacts(): ContactRow[] {
  const stored = readVersionedItems<ContactRow>(CRM_CONTACTS_STORAGE_KEY);
  if (stored && stored.length > 0) return stored;
  return buildSampleContacts();
}

export function persistStoredContacts(items: ContactRow[]): void {
  writeVersionedItems(CRM_CONTACTS_STORAGE_KEY, items);
}

export function nextOpportunityCode(items: readonly OpportunityRow[]): string {
  let maxNum = 2000;
  for (const item of items) {
    const match = /^CH-(\d+)$/.exec(item.code);
    if (match) maxNum = Math.max(maxNum, Number(match[1]));
  }
  return `CH-${maxNum + 1}`;
}

export interface PeriodRange {
  startIso: string;
  endIso: string;
  label: string;
}

function daysInCalendarMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function getReportPeriodRange(period: ReportPeriod, baseDate: Date = new Date()): PeriodRange {
  const todayIso = getLocalDateIso(baseDate);
  const [yearStr, monthStr] = todayIso.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);

  if (period === 'this-month') {
    const lastDay = String(daysInCalendarMonth(year, month)).padStart(2, '0');
    return {
      startIso: `${yearStr}-${monthStr}-01`,
      endIso: `${yearStr}-${monthStr}-${lastDay}`,
      label: 'Tháng này',
    };
  }

  if (period === 'this-quarter') {
    const qStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
    const qEndMonth = qStartMonth + 2;
    const lastDay = String(daysInCalendarMonth(year, qEndMonth)).padStart(2, '0');
    return {
      startIso: `${yearStr}-${String(qStartMonth).padStart(2, '0')}-01`,
      endIso: `${yearStr}-${String(qEndMonth).padStart(2, '0')}-${lastDay}`,
      label: 'Quý này',
    };
  }

  if (period === 'this-year') {
    return {
      startIso: `${yearStr}-01-01`,
      endIso: `${yearStr}-12-31`,
      label: 'Năm nay',
    };
  }

  return {
    startIso: addLocalDaysIso(-29, baseDate),
    endIso: todayIso,
    label: '30 ngày gần nhất',
  };
}

export function isIsoWithinRange(iso: string | undefined, range: PeriodRange): boolean {
  if (!iso) return false;
  const clean = iso.slice(0, 10);
  return clean >= range.startIso && clean <= range.endIso;
}

export function isOpportunityInPeriod(opp: OpportunityRow, range: PeriodRange): boolean {
  if (OPEN_OPPORTUNITY_STAGES.has(opp.stage)) {
    return isIsoWithinRange(opp.createdAtIso, range) || isIsoWithinRange(opp.expectedCloseIso, range);
  }
  const closedRef = opp.closedAtIso || opp.expectedCloseIso || opp.createdAtIso;
  return isIsoWithinRange(closedRef, range);
}
