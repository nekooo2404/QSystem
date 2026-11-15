'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  ArrowUp,
  BarChart3,
  Building2,
  Check,
  ListFilter,
  MoreHorizontal,
  Plus,
  Search,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { StateRegion, toast, useFloatingLayer } from '@qsystem/ui';
import { ApiError, apiFetch } from '../../lib/api/client';
import './qcrm.css';

const CRM_STORAGE_KEY = 'qsystem:crm:customers:v1';
const MAX_IMPORT_ROWS = 500;

function canUseCrmLocalFallback(): boolean {
  return (
    process.env.NODE_ENV === 'development' ||
    (process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && process.env.NODE_ENV !== 'test')
  );
}

function readStoredCustomers(): CustomerRow[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CRM_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CustomerRow[]) : null;
  } catch {
    return null;
  }
}

function persistStoredCustomers(rows: CustomerRow[]) {
  if (!canUseCrmLocalFallback() || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CRM_STORAGE_KEY, JSON.stringify(rows));
  } catch {
    // Ignore storage quota errors
  }
}

function useSafeRouter() {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

function useSafePathname(): string | null {
  try {
    return usePathname();
  } catch {
    return null;
  }
}

function useSafeSearchParams() {
  try {
    return useSearchParams();
  } catch {
    return null;
  }
}

type CustomerSegment = 'enterprise' | 'individual';
type CustomerStage = 'Đang chăm sóc' | 'Tiềm năng' | 'Đàm phán' | 'Mới';
type OwnerTone = 'plum' | 'indigo' | 'slate' | 'teal' | 'cyan';

interface CustomerRow {
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

interface FunnelStage {
  id: string;
  label: string;
  count: number;
  widthPct: number;
  tone: 'amber' | 'indigo' | 'sky' | 'purple' | 'green';
}

const SAMPLE_CUSTOMERS: CustomerRow[] = [
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
    lastContact: '12/11/2026',
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
    lastContact: '13/11/2026',
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
    lastContact: '14/11/2026',
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
    lastContact: '15/11/2026',
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
    ownerTone: 'plum',
    stage: 'Đang chăm sóc',
    lastContact: '15/11/2026',
  },
];

type FunnelPeriod = 'Tháng 10' | 'Tháng 11' | 'Tháng 12';
type CrmMuc = 'tong-quan' | 'co-hoi' | 'lien-he' | 'bao-cao';

const PERIOD_CYCLE: FunnelPeriod[] = ['Tháng 10', 'Tháng 11', 'Tháng 12'];

const FUNNEL_BY_PERIOD: Record<
  FunnelPeriod,
  { stages: FunnelStage[]; pipelineValue: string; trend: string }
> = {
  'Tháng 10': {
    stages: [
      { id: 'lead', label: 'Khách hàng tiềm năng', count: 39, widthPct: 80, tone: 'amber' },
      { id: 'contacted', label: 'Đã liên hệ', count: 29, widthPct: 63, tone: 'indigo' },
      { id: 'proposal', label: 'Đề xuất', count: 18, widthPct: 46, tone: 'sky' },
      { id: 'negotiation', label: 'Đàm phán', count: 10, widthPct: 28, tone: 'purple' },
      { id: 'won', label: 'Thành công', count: 6, widthPct: 18, tone: 'green' },
    ],
    pipelineValue: '4,2 tỷ',
    trend: '9,6% so với tháng trước',
  },
  'Tháng 11': {
    stages: [
      { id: 'lead', label: 'Khách hàng tiềm năng', count: 46, widthPct: 87, tone: 'amber' },
      { id: 'contacted', label: 'Đã liên hệ', count: 34, widthPct: 70, tone: 'indigo' },
      { id: 'proposal', label: 'Đề xuất', count: 21, widthPct: 53, tone: 'sky' },
      { id: 'negotiation', label: 'Đàm phán', count: 12, widthPct: 32, tone: 'purple' },
      { id: 'won', label: 'Thành công', count: 8, widthPct: 22, tone: 'green' },
    ],
    pipelineValue: '4,8 tỷ',
    trend: '14,2% so với tháng trước',
  },
  'Tháng 12': {
    stages: [
      { id: 'lead', label: 'Khách hàng tiềm năng', count: 52, widthPct: 92, tone: 'amber' },
      { id: 'contacted', label: 'Đã liên hệ', count: 38, widthPct: 75, tone: 'indigo' },
      { id: 'proposal', label: 'Đề xuất', count: 25, widthPct: 59, tone: 'sky' },
      { id: 'negotiation', label: 'Đàm phán', count: 15, widthPct: 38, tone: 'purple' },
      { id: 'won', label: 'Thành công', count: 10, widthPct: 26, tone: 'green' },
    ],
    pipelineValue: '5,3 tỷ',
    trend: '18,5% so với tháng trước',
  },
};

const MUC_META: Record<CrmMuc, { heading: string; sub: string; cardTitle: string; badge: string }> = {
  'tong-quan': {
    heading: 'Tổng quan QCRM',
    sub: 'Bức tranh toàn cảnh khách hàng và phễu kinh doanh',
    cardTitle: 'Tổng quan khách hàng',
    badge: 'Tổng quan QCRM',
  },
  'co-hoi': {
    heading: 'Cơ hội bán hàng',
    sub: 'Theo dõi các cơ hội đang mở qua từng giai đoạn pipeline',
    cardTitle: 'Danh sách cơ hội',
    badge: 'Cơ hội đang mở',
  },
  'lien-he': {
    heading: 'Liên hệ khách hàng',
    sub: 'Danh bạ đầu mối liên hệ doanh nghiệp và cá nhân',
    cardTitle: 'Danh bạ liên hệ',
    badge: 'Đầu mối liên hệ',
  },
  'bao-cao': {
    heading: 'Báo cáo kinh doanh',
    sub: 'Hiệu suất chuyển đổi và giá trị pipeline theo tháng',
    cardTitle: 'Khách hàng theo kỳ',
    badge: 'Báo cáo hiệu suất',
  },
};

const STAGE_CYCLE: CustomerStage[] = ['Mới', 'Tiềm năng', 'Đàm phán', 'Đang chăm sóc'];
const OPPORTUNITY_STAGES = new Set<CustomerStage>(['Tiềm năng', 'Đàm phán', 'Mới']);

const STAGE_BADGE: Record<CustomerStage, string> = {
  'Đang chăm sóc': 'qx-badge--green',
  'Tiềm năng': 'qx-badge--amber',
  'Đàm phán': 'qx-badge--blue',
  Mới: 'qx-badge--purple',
};

const STAGE_OPTIONS: Array<'all' | CustomerStage> = [
  'all',
  'Đang chăm sóc',
  'Tiềm năng',
  'Đàm phán',
  'Mới',
];

function todayViDate(): string {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

function normalizeStage(value?: string): CustomerStage {
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

function sanitizeCrmCell(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed.replace(/^[=+\-@\t\r]+/, '').trim();
}

function parseCsvRecords(rawText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < rawText.length; i += 1) {
    const ch = rawText[i];
    if (inQuotes) {
      if (ch === '"' && rawText[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      if (rawText[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  return rows;
}

interface ParsedImportResult {
  rows: CustomerRow[];
  skipped: number;
  truncated: number;
  error?: string;
}

function parseImportedCustomers(
  fileName: string,
  rawText: string,
  existingEmails: Set<string>,
): ParsedImportResult {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    return {
      rows: [],
      skipped: 0,
      truncated: 0,
      error:
        'Định dạng Excel (.xlsx) chưa hỗ trợ nhập trực tiếp. Vui lòng xuất sang tệp .csv (UTF-8) hoặc .json.',
    };
  }

  const stamped = todayViDate();
  const baseStamp = Date.now();
  const trimmed = rawText.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return { rows: [], skipped: 0, truncated: 0, error: 'Tệp nhập dữ liệu trống.' };
  }

  const seenEmails = new Set(existingEmails);
  let skipped = 0;
  let truncated = 0;

  if (lowerName.endsWith('.json')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const validObjects = items.filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === 'object'),
      );
      if (validObjects.length > MAX_IMPORT_ROWS) {
        truncated = validObjects.length - MAX_IMPORT_ROWS;
      }
      const rows: CustomerRow[] = [];
      for (const [idx, item] of validObjects.slice(0, MAX_IMPORT_ROWS).entries()) {
        const name = sanitizeCrmCell(String(item.name ?? item.company ?? ''));
        const email = sanitizeCrmCell(String(item.email ?? '')).toLowerCase();
        if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seenEmails.has(email)) {
          skipped += 1;
          continue;
        }
        seenEmails.add(email);
        const owner = sanitizeCrmCell(String(item.ownerName ?? item.owner ?? 'Lan Anh')) || 'Lan Anh';
        const segment: CustomerSegment =
          item.segment === 'individual' || item.segment === 'Cá nhân' ? 'individual' : 'enterprise';
        rows.push({
          id: `c-imp-${baseStamp}-${idx}`,
          code: initialsOf(name),
          name,
          email,
          industry: sanitizeCrmCell(String(item.industry ?? 'Công nghệ')) || 'Công nghệ',
          segment,
          ownerInitials: ownerInitialsOf(owner),
          ownerName: owner,
          ownerTone: 'cyan',
          stage: normalizeStage(typeof item.stage === 'string' ? item.stage : undefined),
          lastContact: stamped,
        });
      }
      if (rows.length === 0) {
        return {
          rows: [],
          skipped,
          truncated,
          error: 'Không có khách hàng hợp lệ hoặc chưa trùng lặp trong tệp JSON.',
        };
      }
      return { rows, skipped, truncated };
    } catch {
      return { rows: [], skipped: 0, truncated: 0, error: 'Tệp JSON không đúng định dạng.' };
    }
  }

  if (lowerName.endsWith('.csv')) {
    const records = parseCsvRecords(trimmed);
    const hasHeader =
      records.length > 0 &&
      records[0].some((cell) => /name|email|khách hàng|tên/i.test(cell));
    const dataLines = hasHeader ? records.slice(1) : records;
    if (dataLines.length > MAX_IMPORT_ROWS) {
      truncated = dataLines.length - MAX_IMPORT_ROWS;
    }
    const rows: CustomerRow[] = [];
    for (const [idx, cols] of dataLines.slice(0, MAX_IMPORT_ROWS).entries()) {
      const name = sanitizeCrmCell(cols[0] ?? '');
      const email = sanitizeCrmCell(cols[1] ?? '').toLowerCase();
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seenEmails.has(email)) {
        skipped += 1;
        continue;
      }
      seenEmails.add(email);
      const industry = sanitizeCrmCell(cols[2] ?? '') || 'Công nghệ';
      const owner = sanitizeCrmCell(cols[3] ?? '') || 'Lan Anh';
      const stage = normalizeStage(sanitizeCrmCell(cols[4] ?? ''));
      const segRaw = sanitizeCrmCell(cols[5] ?? '').toLowerCase();
      const segment: CustomerSegment =
        segRaw === 'individual' || segRaw === 'cá nhân' ? 'individual' : 'enterprise';
      rows.push({
        id: `c-imp-${baseStamp}-${idx}`,
        code: initialsOf(name),
        name,
        email,
        industry,
        segment,
        ownerInitials: ownerInitialsOf(owner),
        ownerName: owner,
        ownerTone: 'teal',
        stage,
        lastContact: stamped,
      });
    }
    if (rows.length === 0) {
      return {
        rows: [],
        skipped,
        truncated,
        error: 'Không có dòng CSV hợp lệ (cần Tên khách hàng, Email hợp lệ và không trùng lặp).',
      };
    }
    return { rows, skipped, truncated };
  }

  return {
    rows: [],
    skipped: 0,
    truncated: 0,
    error: 'Chỉ hỗ trợ nhập tệp .csv hoặc .json.',
  };
}

function formatViNumber(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function initialsOf(name: string): string {
  const letters = name.trim().replace(/[^a-zA-ZÀ-ỹ0-9]/g, '');
  return (letters.slice(0, 2) || 'KH').toUpperCase();
}

function ownerInitialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'MK';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function CreateCustomerModal({
  open,
  onOpenChange,
  existingEmails,
  isDemoFallback,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingEmails: Set<string>;
  isDemoFallback: boolean;
  onCreated: (row: CustomerRow) => void;
}) {
  if (!open) return null;
  return (
    <CreateCustomerDialog
      onOpenChange={onOpenChange}
      existingEmails={existingEmails}
      isDemoFallback={isDemoFallback}
      onCreated={onCreated}
    />
  );
}

function CreateCustomerDialog({
  onOpenChange,
  existingEmails,
  isDemoFallback,
  onCreated,
}: {
  onOpenChange: (open: boolean) => void;
  existingEmails: Set<string>;
  isDemoFallback: boolean;
  onCreated: (row: CustomerRow) => void;
}) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [industry, setIndustry] = React.useState('Công nghệ');
  const [segment, setSegment] = React.useState<CustomerSegment>('enterprise');
  const [ownerName, setOwnerName] = React.useState('Lan Anh');
  const [stage, setStage] = React.useState<CustomerStage>('Mới');
  const [errors, setErrors] = React.useState<{ name?: string; email?: string; form?: string }>({});
  const [saving, setSaving] = React.useState(false);

  const modalRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descId = React.useId();
  const close = React.useCallback(() => {
    if (!saving) onOpenChange(false);
  }, [onOpenChange, saving]);
  useFloatingLayer(true, close, true, { root: modalRef });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedName = sanitizeCrmCell(name);
    const normalizedEmail = sanitizeCrmCell(email).toLowerCase();
    const nextErrors: typeof errors = {};
    if (!trimmedName) nextErrors.name = 'Vui lòng nhập tên khách hàng.';
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = 'Vui lòng nhập email hợp lệ.';
    } else if (existingEmails.has(normalizedEmail)) {
      nextErrors.email = 'Email khách hàng này đã tồn tại.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const lastContact = todayViDate();
    const payload = {
      name: trimmedName,
      email: normalizedEmail,
      industry: sanitizeCrmCell(industry) || 'Dịch vụ',
      segment,
      ownerName: sanitizeCrmCell(ownerName) || 'Minh Khôi',
      stage,
      lastContact,
    };

    setSaving(true);
    try {
      const response = await apiFetch<{ customer?: CustomerRow } | CustomerRow>(
        '/api/org/crm/customers',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const created =
        response && typeof response === 'object' && 'customer' in response && response.customer
          ? response.customer
          : (response as CustomerRow);
      onCreated(created);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'CONFLICT' || err.status === 409)) {
        setErrors({ email: 'Email khách hàng này đã tồn tại.' });
        return;
      }
      if (err instanceof ApiError && err.status === 400) {
        setErrors({ form: err.message || 'Thông tin khách hàng chưa hợp lệ.' });
        return;
      }
      const allowLocal =
        canUseCrmLocalFallback() &&
        (isDemoFallback ||
          !(err instanceof ApiError) ||
          err.status === 404 ||
          err.status >= 500);
      if (allowLocal) {
        onCreated({
          id: `c-${Date.now()}`,
          code: initialsOf(payload.name),
          name: payload.name,
          email: payload.email,
          industry: payload.industry,
          segment: payload.segment,
          ownerInitials: ownerInitialsOf(payload.ownerName),
          ownerName: payload.ownerName,
          ownerTone: 'indigo',
          stage: payload.stage,
          lastContact,
        });
        onOpenChange(false);
        return;
      }
      setErrors({ form: 'Không lưu được khách hàng, vui lòng thử lại.' });
    } finally {
      setSaving(false);
    }
  }

  const dialog = (
    <div
      className="crm-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={modalRef}
        className="crm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
      >
        <div className="crm-modal__head">
          <h2 id={titleId}>Thêm khách hàng mới</h2>
          <p id={descId}>Tạo hồ sơ khách hàng mới vào danh sách theo dõi QCRM.</p>
          <button type="button" className="crm-modal__close" aria-label="Đóng hộp thoại" onClick={close}>
            <X size={18} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="crm-modal__body">
            <div className="crm-field">
              <label htmlFor="crm-name">Tên khách hàng *</label>
              <input
                id="crm-name"
                className="crm-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Công ty Cổ phần QTS"
              />
              {errors.name ? (
                <p className="crm-error" role="alert">
                  {errors.name}
                </p>
              ) : null}
            </div>

            <div className="crm-field">
              <label htmlFor="crm-email">Email liên hệ *</label>
              <input
                id="crm-email"
                type="email"
                className="crm-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@example.com"
              />
              {errors.email ? (
                <p className="crm-error" role="alert">
                  {errors.email}
                </p>
              ) : null}
            </div>

            <div className="crm-field">
              <label htmlFor="crm-industry">Lĩnh vực</label>
              <input
                id="crm-industry"
                className="crm-input"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
            </div>

            <div className="crm-field">
              <label htmlFor="crm-segment">Phân loại</label>
              <select
                id="crm-segment"
                className="crm-input"
                value={segment}
                onChange={(e) => setSegment(e.target.value as CustomerSegment)}
              >
                <option value="enterprise">Doanh nghiệp</option>
                <option value="individual">Cá nhân</option>
              </select>
            </div>

            <div className="crm-field">
              <label htmlFor="crm-owner">Phụ trách</label>
              <input
                id="crm-owner"
                className="crm-input"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
              />
            </div>

            <div className="crm-field">
              <label htmlFor="crm-stage">Giai đoạn</label>
              <select
                id="crm-stage"
                className="crm-input"
                value={stage}
                onChange={(e) => setStage(e.target.value as CustomerStage)}
              >
                <option value="Mới">Mới</option>
                <option value="Tiềm năng">Tiềm năng</option>
                <option value="Đàm phán">Đàm phán</option>
                <option value="Đang chăm sóc">Đang chăm sóc</option>
              </select>
            </div>
          </div>

          {errors.form ? (
            <p className="crm-error" role="alert">
              {errors.form}
            </p>
          ) : null}

          <div className="crm-modal__foot">
            <button type="button" className="qx-btn" onClick={close} disabled={saving}>
              Hủy
            </button>
            <button type="submit" className="qx-btn qx-btn--primary" disabled={saving}>
              <Plus size={15} strokeWidth={2} aria-hidden="true" />
              {saving ? 'Đang lưu…' : 'Lưu khách hàng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(dialog, document.body);
}

function CustomerDetailDialog({
  row,
  onClose,
  onAdvanceStage,
  onCopyEmail,
}: {
  row: CustomerRow;
  onClose: () => void;
  onAdvanceStage: (customerId: string) => void;
  onCopyEmail: (email: string) => void;
}) {
  const modalRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  useFloatingLayer(true, onClose, true, { root: modalRef });

  const dialog = (
    <div
      className="crm-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="crm-modal crm-modal--detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="crm-modal__head">
          <h2 id={titleId}>Hồ sơ khách hàng</h2>
          <p>Chi tiết liên hệ và giai đoạn bán hàng hiện tại</p>
          <button
            type="button"
            className="crm-modal__close"
            aria-label="Đóng hồ sơ khách hàng"
            onClick={onClose}
          >
            <X size={18} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </div>

        <div className="crm-detail-body">
          <div className="crm-detail-hero">
            <span className="qx-avatar" aria-hidden="true">
              {row.code}
            </span>
            <div className="crm-detail-hero__meta">
              <p className="crm-detail-hero__name">{row.name}</p>
              <p className="crm-detail-hero__mail">{row.email}</p>
            </div>
          </div>

          <dl className="crm-detail-grid">
            <div className="crm-detail-item">
              <dt>Lĩnh vực</dt>
              <dd>{row.industry}</dd>
            </div>
            <div className="crm-detail-item">
              <dt>Phân loại</dt>
              <dd>{row.segment === 'enterprise' ? 'Doanh nghiệp' : 'Cá nhân'}</dd>
            </div>
            <div className="crm-detail-item">
              <dt>Phụ trách</dt>
              <dd>{row.ownerName}</dd>
            </div>
            <div className="crm-detail-item">
              <dt>Liên hệ gần nhất</dt>
              <dd>{row.lastContact}</dd>
            </div>
            <div className="crm-detail-item">
              <dt>Giai đoạn</dt>
              <dd>
                <span className={`qx-badge ${STAGE_BADGE[row.stage]}`}>{row.stage}</span>
              </dd>
            </div>
          </dl>
        </div>

        <div className="crm-modal__foot">
          <button type="button" className="qx-btn" onClick={() => onCopyEmail(row.email)}>
            Sao chép email
          </button>
          <button
            type="button"
            className="qx-btn qx-btn--primary"
            onClick={() => onAdvanceStage(row.id)}
          >
            Chuyển giai đoạn tiếp theo
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(dialog, document.body);
}

export function CrmCustomers() {
  const router = useSafeRouter();
  const pathname = useSafePathname();
  const searchParams = useSafeSearchParams();

  const [customers, setCustomers] = React.useState<CustomerRow[] | null>(null);
  const [isDemoFallback, setIsDemoFallback] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<'all' | CustomerSegment>('all');
  const [stageFilter, setStageFilter] = React.useState<'all' | CustomerStage>('all');
  const [search, setSearch] = React.useState('');
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [openRowMenuId, setOpenRowMenuId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [period, setPeriod] = React.useState<FunnelPeriod>('Tháng 11');
  const [detailCustomerId, setDetailCustomerId] = React.useState<string | null>(null);

  const importInputRef = React.useRef<HTMLInputElement>(null);
  const pageRef = React.useRef<HTMLElement>(null);

  const rawMuc = searchParams?.get('muc');
  const activeMuc: CrmMuc | null =
    rawMuc === 'tong-quan' ||
    rawMuc === 'co-hoi' ||
    rawMuc === 'lien-he' ||
    rawMuc === 'bao-cao'
      ? rawMuc
      : null;

  const hydrateDevCrm = React.useCallback(() => {
    const stored = readStoredCustomers();
    const initial = stored ?? SAMPLE_CUSTOMERS;
    setCustomers(initial);
    setIsDemoFallback(true);
    setLoadError(null);
    persistStoredCustomers(initial);
  }, []);

  const loadCustomers = React.useCallback(() => {
    let active = true;
    const allowLocal = canUseCrmLocalFallback();
    setLoadError(null);
    apiFetch<{ items?: CustomerRow[] } | CustomerRow[]>('/api/org/crm/customers').then(
      (res) => {
        if (!active) return;
        const list = Array.isArray(res) ? res : (res.items ?? []);
        if (allowLocal && list.length === 0) {
          hydrateDevCrm();
          return;
        }
        setCustomers(list);
        setIsDemoFallback(false);
        setLoadError(null);
      },
      () => {
        if (!active) return;
        if (allowLocal) {
          hydrateDevCrm();
          return;
        }
        setCustomers([]);
        setIsDemoFallback(false);
        setLoadError('Không thể tải danh sách khách hàng. Vui lòng thử lại.');
      },
    );
    return () => {
      active = false;
    };
  }, [hydrateDevCrm]);

  React.useEffect(() => {
    return loadCustomers();
  }, [loadCustomers]);

  React.useEffect(() => {
    if (!filterOpen && !openRowMenuId) return;
    function onDocClick(event: MouseEvent) {
      if (!pageRef.current?.contains(event.target as Node)) {
        setFilterOpen(false);
        setOpenRowMenuId(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setFilterOpen(false);
        setOpenRowMenuId(null);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [filterOpen, openRowMenuId]);

  if (loadError) {
    return (
      <section className="qx-page" aria-label="Khách hàng" ref={pageRef}>
        <div role="alert" className="crm-alert">
          <span>{loadError}</span>
          <button type="button" className="qx-btn qx-btn--sm" onClick={() => loadCustomers()}>
            Thử lại
          </button>
        </div>
      </section>
    );
  }

  if (customers === null) {
    return (
      <section className="qx-page" aria-label="Khách hàng" ref={pageRef}>
        <StateRegion state="loading" rows={5} />
      </section>
    );
  }

  const existingEmails = new Set(customers.map((c) => c.email.trim().toLowerCase()));
  const newStageCount = customers.filter((c) => c.stage === 'Mới').length;
  const potentialCount = customers.filter((c) => c.stage === 'Tiềm năng').length;
  const negCount = customers.filter((c) => c.stage === 'Đàm phán').length;
  const wonCount = customers.filter((c) => c.stage === 'Đang chăm sóc').length;
  const openStageCount = newStageCount + potentialCount + negCount;

  const totalCustomers = isDemoFallback ? Math.max(0, 1243 + customers.length) : customers.length;
  const newCustomersStat = isDemoFallback ? Math.max(0, 85 + newStageCount) : newStageCount;
  const openOpportunitiesStat = isDemoFallback ? Math.max(0, 21 + openStageCount) : openStageCount;
  const conversionPct = isDemoFallback
    ? Math.min(100, Math.round(((6 + wonCount) / Math.max(1, 20 + openStageCount + wonCount)) * 100))
    : customers.length > 0
      ? Math.round((wonCount / customers.length) * 100)
      : 0;

  const normalizedQuery = search.trim().toLowerCase();

  const visibleCustomers = customers.filter((item) => {
    if (tab !== 'all' && item.segment !== tab) return false;
    if (stageFilter !== 'all' && item.stage !== stageFilter) return false;
    if (activeMuc === 'co-hoi' && !OPPORTUNITY_STAGES.has(item.stage)) return false;
    if (!normalizedQuery) return true;
    return (
      item.name.toLowerCase().includes(normalizedQuery) ||
      item.email.toLowerCase().includes(normalizedQuery) ||
      item.industry.toLowerCase().includes(normalizedQuery) ||
      item.ownerName.toLowerCase().includes(normalizedQuery)
    );
  });

  function handleClearMuc() {
    if (!pathname || !router) return;
    const nextParams = new URLSearchParams(searchParams?.toString() ?? '');
    nextParams.delete('muc');
    const qs = nextParams.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function cyclePeriod() {
    setPeriod((current) => {
      const idx = PERIOD_CYCLE.indexOf(current);
      return PERIOD_CYCLE[(idx + 1) % PERIOD_CYCLE.length];
    });
  }

  async function handleAdvanceStage(customerId: string) {
    const target = customers?.find((c) => c.id === customerId);
    if (!target || !customers) return;
    const idx = STAGE_CYCLE.indexOf(target.stage);
    const nextStage = STAGE_CYCLE[(idx + 1) % STAGE_CYCLE.length];
    const stamped = todayViDate();

    const applyUpdate = () => {
      const nextList = customers.map((c) =>
        c.id === customerId ? { ...c, stage: nextStage, lastContact: stamped } : c,
      );
      setCustomers(nextList);
      persistStoredCustomers(nextList);
      setOpenRowMenuId(null);
      toast.success(`Đã chuyển ${target.name} sang ${nextStage}`);
    };

    try {
      await apiFetch(`/api/org/crm/customers/${encodeURIComponent(customerId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: nextStage, lastContact: stamped }),
      });
      applyUpdate();
    } catch {
      if (canUseCrmLocalFallback()) {
        applyUpdate();
        return;
      }
      toast.error('Không cập nhật được giai đoạn khách hàng.');
    }
  }

  async function handleDeleteCustomer(customerId: string) {
    const target = customers?.find((c) => c.id === customerId);
    if (!target || !customers) return;

    const applyDelete = () => {
      const nextList = customers.filter((c) => c.id !== customerId);
      setCustomers(nextList);
      persistStoredCustomers(nextList);
      setOpenRowMenuId(null);
      if (detailCustomerId === customerId) setDetailCustomerId(null);
      toast.success(`Đã xóa khách hàng ${target.name}`);
    };

    try {
      await apiFetch(`/api/org/crm/customers/${encodeURIComponent(customerId)}`, {
        method: 'DELETE',
      });
      applyDelete();
    } catch {
      if (canUseCrmLocalFallback()) {
        applyDelete();
        return;
      }
      toast.error('Không xóa được khách hàng, vui lòng thử lại.');
    }
  }

  function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !customers) return;

    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      toast.error(
        'Định dạng Excel (.xlsx) chưa hỗ trợ nhập trực tiếp. Vui lòng xuất tệp sang .csv (UTF-8) hoặc .json.',
      );
      return;
    }

    void file.text().then(
      async (text) => {
        const result = parseImportedCustomers(file.name, text, existingEmails);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        const persistedRows: CustomerRow[] = [];
        for (const row of result.rows) {
          try {
            const res = await apiFetch<{ customer?: CustomerRow } | CustomerRow>(
              '/api/org/crm/customers',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: row.name,
                  email: row.email,
                  industry: row.industry,
                  segment: row.segment,
                  ownerName: row.ownerName,
                  stage: row.stage,
                  lastContact: row.lastContact,
                }),
              },
            );
            const created =
              res && typeof res === 'object' && 'customer' in res && res.customer
                ? res.customer
                : (res as CustomerRow);
            persistedRows.push(created);
          } catch {
            if (canUseCrmLocalFallback()) {
              persistedRows.push(row);
            }
          }
        }
        if (persistedRows.length === 0) {
          toast.error('Không nhập được khách hàng lên máy chủ, vui lòng thử lại.');
          return;
        }
        const nextList = [...persistedRows, ...customers];
        setCustomers(nextList);
        persistStoredCustomers(nextList);
        const notes: string[] = [];
        if (result.skipped > 0) notes.push(`bỏ qua ${result.skipped} dòng trùng/lỗi`);
        if (result.truncated > 0) notes.push(`giới hạn ${MAX_IMPORT_ROWS} dòng/lần`);
        const suffix = notes.length > 0 ? ` (${notes.join(', ')})` : '';
        toast.success(`Đã nhập ${persistedRows.length} khách hàng từ ${file.name}${suffix}`);
      },
      () => {
        toast.error(`Không đọc được nội dung tệp ${file.name}.`);
      },
    );
  }

  function handleCopyEmail(email: string) {
    setOpenRowMenuId(null);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(email).then(
        () => toast.success(`Đã sao chép ${email}`),
        () => toast.info(email),
      );
      return;
    }
    toast.info(email);
  }

  const activeMeta = activeMuc ? MUC_META[activeMuc] : null;
  const pageHeading = activeMeta ? activeMeta.heading : 'Khách hàng';
  const pageSub = activeMeta
    ? activeMeta.sub
    : 'Không gian quản lý quan hệ khách hàng và cơ hội kinh doanh';
  const cardHeading = activeMeta ? activeMeta.cardTitle : 'Danh sách khách hàng';

  const baseFunnel = FUNNEL_BY_PERIOD[period];
  const stageDeltas: Record<string, number> = isDemoFallback
    ? {
        lead: newStageCount - 1,
        contacted: newStageCount + potentialCount - 2,
        proposal: potentialCount - 1,
        negotiation: negCount - 1,
        won: wonCount - 2,
      }
    : {
        lead: newStageCount,
        contacted: newStageCount + potentialCount,
        proposal: potentialCount,
        negotiation: negCount,
        won: wonCount,
      };
  const rawStageCounts = baseFunnel.stages.map((st) => ({
    ...st,
    count: isDemoFallback ? Math.max(0, st.count + (stageDeltas[st.id] ?? 0)) : (stageDeltas[st.id] ?? 0),
  }));
  const maxStageCount = Math.max(1, ...rawStageCounts.map((s) => s.count));
  const funnelStages = rawStageCounts.map((st, idx) => ({
    ...st,
    widthPct:
      st.count === 0
        ? 0
        : isDemoFallback && (stageDeltas[st.id] ?? 0) === 0
          ? baseFunnel.stages[idx].widthPct
          : Math.max(12, Math.min(96, Math.round((st.count / maxStageCount) * 87))),
  }));
  const baseBillion = Number.parseFloat(baseFunnel.pipelineValue.replace(',', '.')) || 4.8;
  const deltaDeals = customers.length - SAMPLE_CUSTOMERS.length;
  const adjustedBillion = isDemoFallback
    ? Math.max(0.1, baseBillion + deltaDeals * 0.15)
    : Math.max(0, (openStageCount + wonCount) * 0.15);
  const dynamicPipelineValue = `${adjustedBillion.toFixed(1).replace('.', ',')} tỷ`;
  const funnelData = {
    ...baseFunnel,
    stages: funnelStages,
    pipelineValue: dynamicPipelineValue,
  };

  const detailRow = detailCustomerId
    ? (customers.find((c) => c.id === detailCustomerId) ?? null)
    : null;

  return (
    <section className="qx-page" aria-label={pageHeading} ref={pageRef}>
      <header className="qx-page-head">
        <div>
          <h1>{pageHeading}</h1>
          <p>{pageSub}</p>
        </div>
        <div className="qx-actions">
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.xlsx,.json"
            hidden
            aria-label="Chọn tệp dữ liệu khách hàng"
            onChange={handleImportFile}
          />
          <button
            type="button"
            className="qx-btn"
            onClick={() => importInputRef.current?.click()}
          >
            <Upload size={15} strokeWidth={1.6} aria-hidden="true" />
            Nhập dữ liệu
          </button>
          <button
            type="button"
            className="qx-btn qx-btn--primary"
            onClick={() => setCreating(true)}
          >
            <Plus size={15} strokeWidth={2} aria-hidden="true" />
            Thêm khách hàng
          </button>
        </div>
      </header>

      <div className="qx-stats" aria-label="Thống kê khách hàng">
        <article className="qx-stat">
          <div className="qx-stat__label">Tổng khách hàng</div>
          <Building2 className="qx-stat__icon" size={16} strokeWidth={1.6} aria-hidden="true" />
          <div className="qx-stat__value">
            <span>{formatViNumber(totalCustomers)}</span>
            <span className="qx-stat__delta">
              <ArrowUp size={11} strokeWidth={2.4} aria-hidden="true" />
              <span>12.8%</span>
            </span>
          </div>
          <div className="qx-stat__note">Tăng trưởng 12,8%</div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Khách hàng mới</div>
          <Users className="qx-stat__icon" size={16} strokeWidth={1.6} aria-hidden="true" />
          <div className="qx-stat__value">
            <span>{newCustomersStat}</span>
            <span className="qx-stat__delta">
              <ArrowUp size={11} strokeWidth={2.4} aria-hidden="true" />
              <span>6.4%</span>
            </span>
          </div>
          <div className="qx-stat__note">Trong 30 ngày</div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Cơ hội đang mở</div>
          <BarChart3 className="qx-stat__icon" size={16} strokeWidth={1.6} aria-hidden="true" />
          <div className="qx-stat__value">
            <span>{openOpportunitiesStat}</span>
          </div>
          <div className="qx-stat__note">Qua 5 giai đoạn</div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Tỷ lệ chuyển đổi</div>
          <Activity className="qx-stat__icon" size={16} strokeWidth={1.6} aria-hidden="true" />
          <div className="qx-stat__value">
            <span>{conversionPct}%</span>
            <span className="qx-stat__delta">
              <ArrowUp size={11} strokeWidth={2.4} aria-hidden="true" />
              <span>4%</span>
            </span>
          </div>
          <div className="qx-stat__note">So với 28% kỳ trước</div>
        </article>
      </div>

      <div className="crm-body">
        <div className="qx-card crm-list">
          <div className="qx-card__head">
            <div className="crm-head-meta">
              <h2 className="qx-card__title">{cardHeading}</h2>
              {activeMeta ? (
                <span className="crm-context-pill">
                  <span>{activeMeta.badge}</span>
                  <button
                    type="button"
                    className="crm-context-reset"
                    onClick={handleClearMuc}
                  >
                    Xem tất cả
                  </button>
                </span>
              ) : null}
            </div>
            <div className="crm-filter-wrap">
              <button
                type="button"
                className="qx-btn qx-btn--sm crm-filter-btn"
                aria-haspopup="menu"
                aria-expanded={filterOpen}
                data-active={stageFilter !== 'all'}
                onClick={() => {
                  setFilterOpen((prev) => !prev);
                  setOpenRowMenuId(null);
                }}
              >
                <ListFilter size={14} strokeWidth={1.6} aria-hidden="true" />
                Lọc
              </button>
              {filterOpen ? (
                <div className="crm-filter-menu" role="menu" aria-label="Lọc theo giai đoạn">
                  <p className="crm-filter-menu__title">Giai đoạn</p>
                  {STAGE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="menuitemradio"
                      aria-checked={stageFilter === option}
                      className="crm-filter-menu__item"
                      onClick={() => {
                        setStageFilter(option);
                        setFilterOpen(false);
                      }}
                    >
                      <span>{option === 'all' ? 'Tất cả giai đoạn' : option}</span>
                      {stageFilter === option ? <Check size={13} aria-hidden="true" /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="crm-toolbar">
            <div className="qx-tabs" role="tablist" aria-label="Loại khách hàng">
              <button
                type="button"
                role="tab"
                className="qx-tab"
                aria-selected={tab === 'all'}
                onClick={() => setTab('all')}
              >
                Tất cả ({formatViNumber(totalCustomers)})
              </button>
              <button
                type="button"
                role="tab"
                className="qx-tab"
                aria-selected={tab === 'enterprise'}
                onClick={() => setTab('enterprise')}
              >
                Doanh nghiệp
              </button>
              <button
                type="button"
                role="tab"
                className="qx-tab"
                aria-selected={tab === 'individual'}
                onClick={() => setTab('individual')}
              >
                Cá nhân
              </button>
            </div>

            <label className="qx-field-search">
              <Search size={14} strokeWidth={1.6} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm khách hàng..."
                aria-label="Tìm khách hàng"
              />
            </label>
          </div>

          <div className="crm-table-wrap">
            {visibleCustomers.length === 0 ? (
              <div className="crm-empty">Không tìm thấy khách hàng phù hợp.</div>
            ) : (
              <table className="qx-table" aria-label={cardHeading}>
                <thead>
                  <tr>
                    <th scope="col">Khách hàng</th>
                    <th scope="col">Lĩnh vực</th>
                    <th scope="col">Phụ trách</th>
                    <th scope="col">Giai đoạn</th>
                    <th scope="col">Gần nhất</th>
                    <th scope="col" aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {visibleCustomers.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="crm-customer">
                          <span className="qx-avatar" aria-hidden="true">
                            {row.code}
                          </span>
                          <span className="crm-customer__text">
                            <span className="crm-customer__name">{row.name}</span>
                            <span className="crm-customer__mail">{row.email}</span>
                          </span>
                        </div>
                      </td>
                      <td>{row.industry}</td>
                      <td>
                        <span className="qx-person crm-owner">
                          <span
                            className={`qx-avatar qx-avatar--sm crm-avatar--${row.ownerTone}`}
                            aria-hidden="true"
                          >
                            {row.ownerInitials}
                          </span>
                          <span>{row.ownerName}</span>
                        </span>
                      </td>
                      <td>
                        <span className={`qx-badge ${STAGE_BADGE[row.stage]}`}>{row.stage}</span>
                      </td>
                      <td>{row.lastContact}</td>
                      <td className="crm-row-actions">
                        <button
                          type="button"
                          className="crm-row-more"
                          aria-label={`Thao tác với ${row.name}`}
                          aria-expanded={openRowMenuId === row.id}
                          aria-haspopup="menu"
                          onClick={() => {
                            setFilterOpen(false);
                            setOpenRowMenuId((prev) => (prev === row.id ? null : row.id));
                          }}
                        >
                          <MoreHorizontal size={16} strokeWidth={1.6} aria-hidden="true" />
                        </button>
                        {openRowMenuId === row.id ? (
                          <div className="crm-row-menu" role="menu" aria-label={`Thao tác ${row.name}`}>
                            <button
                              type="button"
                              role="menuitem"
                              className="crm-row-menu__item"
                              onClick={() => {
                                setOpenRowMenuId(null);
                                setDetailCustomerId(row.id);
                              }}
                            >
                              Xem chi tiết KH
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="crm-row-menu__item"
                              onClick={() => handleAdvanceStage(row.id)}
                            >
                              Chuyển giai đoạn tiếp theo
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="crm-row-menu__item"
                              onClick={() => handleCopyEmail(row.email)}
                            >
                              Sao chép email
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="crm-row-menu__item crm-row-menu__item--danger"
                              onClick={() => handleDeleteCustomer(row.id)}
                            >
                              Xóa khách hàng
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <aside className="qx-card crm-funnel" aria-label="Phễu kinh doanh">
          <div className="crm-funnel__head">
            <div>
              <h2 className="crm-funnel__title">Phễu kinh doanh</h2>
              <p className="crm-funnel__sub">Phân bổ cơ hội theo giai đoạn</p>
            </div>
            <button
              type="button"
              className="crm-period"
              aria-label={`Kỳ báo cáo: ${period}. Nhấn để đổi tháng`}
              onClick={cyclePeriod}
            >
              {period}
            </button>
          </div>

          <ul className="crm-funnel__list">
            {funnelData.stages.map((stage) => (
              <li key={stage.id}>
                <div className="crm-funnel__meta">
                  <span className="crm-funnel__label">{stage.label}</span>
                  <span className="crm-funnel__count">{String(stage.count).padStart(2, '0')}</span>
                </div>
                <div className="crm-funnel__track" aria-hidden="true">
                  <div
                    className={`crm-funnel__fill crm-funnel__fill--${stage.tone}`}
                    style={{ width: `${stage.widthPct}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="crm-funnel__summary">
            <p className="crm-funnel__sum-label">Giá trị pipeline dự kiến</p>
            <p className="crm-funnel__sum-value">
              {funnelData.pipelineValue} <span className="crm-dong">đ</span>
            </p>
            <p className="crm-funnel__trend">
              <ArrowUp size={11} strokeWidth={2.4} aria-hidden="true" />
              <span>{funnelData.trend}</span>
            </p>
          </div>
        </aside>
      </div>

      {detailRow ? (
        <CustomerDetailDialog
          row={detailRow}
          onClose={() => setDetailCustomerId(null)}
          onAdvanceStage={handleAdvanceStage}
          onCopyEmail={handleCopyEmail}
        />
      ) : null}

      <CreateCustomerModal
        open={creating}
        onOpenChange={setCreating}
        existingEmails={existingEmails}
        isDemoFallback={isDemoFallback}
        onCreated={(created) => {
          const nextList = [created, ...(customers ?? []).filter((c) => c.id !== created.id)];
          setCustomers(nextList);
          persistStoredCustomers(nextList);
          toast.success(`Đã thêm khách hàng ${created.name}`);
        }}
      />
    </section>
  );
}
