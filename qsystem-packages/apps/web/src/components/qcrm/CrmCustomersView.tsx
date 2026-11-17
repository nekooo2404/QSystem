'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Search,
  Upload,
  X,
} from 'lucide-react';
import {
  ResponsiveDetailDrawer,
  Select,
  StateRegion,
  toast,
  useFloatingLayer,
  type SelectOption,
} from '@qsystem/ui';
import { ApiError, apiFetch, invalidateApiCache } from '../../lib/api/client';
import { CrmRowMenu } from './CrmRowMenu';
import {
  canUseCrmApiFallback,
  CUSTOMER_INDUSTRIES,
  CUSTOMER_STAGE_BADGE,
  CUSTOMER_STAGE_LIST,
  formatViCount,
  initialsOf,
  normalizeCustomerStage,
  ownerInitialsOf,
  sanitizeCrmCell,
  todayViDisplay,
  toneForOwner,
  type ContactRow,
  type CustomerRow,
  type CustomerSegment,
  type CustomerStage,
  type OpportunityRow,
} from './crm.storage';

const MAX_IMPORT_ROWS = 500;
const STAGE_CYCLE: CustomerStage[] = ['Mới', 'Tiềm năng', 'Đàm phán', 'Đang chăm sóc'];

const SEGMENT_OPTIONS: readonly SelectOption<CustomerSegment>[] = [
  { value: 'enterprise', label: 'Doanh nghiệp' },
  { value: 'individual', label: 'Cá nhân' },
];

const INDUSTRY_OPTIONS: readonly SelectOption<string>[] = CUSTOMER_INDUSTRIES.map((item) => ({
  value: item,
  label: item,
}));

const CUSTOMER_STAGE_OPTIONS: readonly SelectOption<CustomerStage>[] = CUSTOMER_STAGE_LIST.map((stage) => ({
  value: stage,
  label: stage,
}));

const CUSTOMER_STAGE_FILTER_OPTIONS: readonly SelectOption<'all' | CustomerStage>[] = [
  { value: 'all', label: 'Tất cả trạng thái' },
  ...CUSTOMER_STAGE_OPTIONS,
];

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

  const stamped = todayViDisplay();
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
          ownerTone: toneForOwner(owner),
          stage: normalizeCustomerStage(typeof item.stage === 'string' ? item.stage : undefined),
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
      const stage = normalizeCustomerStage(sanitizeCrmCell(cols[4] ?? ''));
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
        ownerTone: toneForOwner(owner),
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

function CreateCustomerModal({
  open,
  onOpenChange,
  existingEmails,
  ownerNames,
  isDemoFallback,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingEmails: Set<string>;
  ownerNames: readonly string[];
  isDemoFallback: boolean;
  onCreated: (row: CustomerRow) => void;
}) {
  if (!open) return null;
  return (
    <CreateCustomerDialog
      onOpenChange={onOpenChange}
      existingEmails={existingEmails}
      ownerNames={ownerNames}
      isDemoFallback={isDemoFallback}
      onCreated={onCreated}
    />
  );
}

function CreateCustomerDialog({
  onOpenChange,
  existingEmails,
  ownerNames,
  isDemoFallback,
  onCreated,
}: {
  onOpenChange: (open: boolean) => void;
  existingEmails: Set<string>;
  ownerNames: readonly string[];
  isDemoFallback: boolean;
  onCreated: (row: CustomerRow) => void;
}) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [industry, setIndustry] = React.useState<string>(CUSTOMER_INDUSTRIES[0]);
  const [segment, setSegment] = React.useState<CustomerSegment>('enterprise');
  const [ownerName, setOwnerName] = React.useState<string>(ownerNames[0] ?? 'Lan Anh');
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

  const ownerOptions = React.useMemo<SelectOption<string>[]>(
    () => ownerNames.map((owner) => ({ value: owner, label: owner })),
    [ownerNames],
  );

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

    const lastContact = todayViDisplay();
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
        canUseCrmApiFallback() &&
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
          ownerTone: toneForOwner(payload.ownerName),
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
          <p id={descId}>Tạo hồ sơ khách hàng mới vào danh sách theo dõi QCRM</p>
          <button type="button" className="crm-modal__close" aria-label="Đóng hộp thoại" onClick={close}>
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
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
                placeholder="lienhe@congty.vn"
              />
              {errors.email ? (
                <p className="crm-error" role="alert">
                  {errors.email}
                </p>
              ) : null}
            </div>

            <div className="crm-field">
              <label htmlFor="crm-segment">Loại khách hàng</label>
              <Select<CustomerSegment>
                id="crm-segment"
                value={segment}
                onValueChange={setSegment}
                options={SEGMENT_OPTIONS}
                aria-label="Loại khách hàng"
              />
            </div>

            <div className="crm-field">
              <label htmlFor="crm-industry">Ngành</label>
              <Select<string>
                id="crm-industry"
                value={industry}
                onValueChange={setIndustry}
                options={INDUSTRY_OPTIONS}
                aria-label="Ngành"
              />
            </div>

            <div className="crm-field">
              <label htmlFor="crm-owner">Phụ trách</label>
              <Select<string>
                id="crm-owner"
                value={ownerName}
                onValueChange={setOwnerName}
                options={ownerOptions}
                aria-label="Phụ trách"
              />
            </div>

            <div className="crm-field">
              <label htmlFor="crm-stage">Trạng thái</label>
              <Select<CustomerStage>
                id="crm-stage"
                value={stage}
                onValueChange={setStage}
                options={CUSTOMER_STAGE_OPTIONS}
                aria-label="Trạng thái"
              />
            </div>
          </div>

          {errors.form ? (
            <p className="crm-error crm-error--banner" role="alert">
              {errors.form}
            </p>
          ) : null}

          <div className="crm-modal__foot">
            <button type="button" className="qx-btn" onClick={close} disabled={saving}>
              Hủy
            </button>
            <button type="submit" className="qx-btn qx-btn--primary" disabled={saving}>
              <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
              {saving ? 'Đang lưu' : 'Lưu khách hàng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(dialog, document.body);
}

export interface CrmCustomersViewProps {
  customers: CustomerRow[] | null;
  opportunities: OpportunityRow[];
  contacts: ContactRow[];
  ownerNames: readonly string[];
  isDemoFallback: boolean;
  loadError: string | null;
  initialSearch?: string;
  onRetry: () => void;
  onUpdateCustomers: (next: CustomerRow[]) => void;
}

export function CrmCustomersView({
  customers,
  opportunities,
  contacts,
  ownerNames,
  isDemoFallback,
  loadError,
  initialSearch = '',
  onRetry,
  onUpdateCustomers,
}: CrmCustomersViewProps) {
  const [tab, setTab] = React.useState<'all' | CustomerSegment>('all');
  const [stageFilter, setStageFilter] = React.useState<'all' | CustomerStage>('all');
  const [ownerFilter, setOwnerFilter] = React.useState<string>('all');
  const [search, setSearch] = React.useState(initialSearch);
  const prevInitialSearch = React.useRef(initialSearch);
  React.useEffect(() => {
    if (prevInitialSearch.current !== initialSearch) {
      prevInitialSearch.current = initialSearch;
      setSearch(initialSearch);
    }
  }, [initialSearch]);
  const [openRowMenuId, setOpenRowMenuId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [detailCustomerId, setDetailCustomerId] = React.useState<string | null>(null);

  const importInputRef = React.useRef<HTMLInputElement>(null);
  const pageRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (!openRowMenuId) return;
    function onDocClick(event: MouseEvent) {
      if (!pageRef.current?.contains(event.target as Node)) {
        setOpenRowMenuId(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenRowMenuId(null);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openRowMenuId]);

  const ownerFilterOptions = React.useMemo<SelectOption<string>[]>(
    () => [
      { value: 'all', label: 'Tất cả phụ trách' },
      ...ownerNames.map((name) => ({ value: name, label: name })),
    ],
    [ownerNames],
  );

  if (loadError) {
    return (
      <section className="qx-page crm-page" aria-label="Khách hàng" ref={pageRef}>
        <div role="alert" className="crm-alert">
          <span>{loadError}</span>
          <button type="button" className="qx-btn qx-btn--sm" onClick={onRetry}>
            Thử lại
          </button>
        </div>
      </section>
    );
  }

  if (customers === null) {
    return (
      <section className="qx-page crm-page" aria-label="Khách hàng" ref={pageRef}>
        <StateRegion state="loading" rows={5} />
      </section>
    );
  }

  const existingEmails = new Set(customers.map((c) => c.email.trim().toLowerCase()));
  const enterpriseCount = customers.filter((c) => c.segment === 'enterprise').length;
  const individualCount = customers.filter((c) => c.segment === 'individual').length;
  const activeCareCount = customers.filter((c) => c.stage === 'Đang chăm sóc').length;
  const normalizedQuery = search.trim().toLowerCase();

  const visibleCustomers = customers.filter((item) => {
    if (tab !== 'all' && item.segment !== tab) return false;
    if (stageFilter !== 'all' && item.stage !== stageFilter) return false;
    if (ownerFilter !== 'all' && item.ownerName !== ownerFilter) return false;
    if (!normalizedQuery) return true;
    return (
      item.name.toLowerCase().includes(normalizedQuery) ||
      item.email.toLowerCase().includes(normalizedQuery) ||
      item.industry.toLowerCase().includes(normalizedQuery) ||
      item.ownerName.toLowerCase().includes(normalizedQuery)
    );
  });

  async function handleUpdateStage(customerId: string, nextStage: CustomerStage) {
    if (!customers) return;
    const target = customers.find((c) => c.id === customerId);
    if (!target) return;
    const stamped = todayViDisplay();

    const applyUpdate = () => {
      const nextList = customers.map((c) =>
        c.id === customerId ? { ...c, stage: nextStage, lastContact: stamped } : c,
      );
      onUpdateCustomers(nextList);
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
      if (canUseCrmApiFallback() || isDemoFallback) {
        applyUpdate();
        return;
      }
      toast.error('Không cập nhật được trạng thái khách hàng.');
    }
  }

  async function handleAdvanceStage(customerId: string) {
    const target = customers?.find((c) => c.id === customerId);
    if (!target) return;
    const idx = STAGE_CYCLE.indexOf(target.stage);
    const nextStage = STAGE_CYCLE[(idx + 1) % STAGE_CYCLE.length];
    await handleUpdateStage(customerId, nextStage);
  }

  async function handleDeleteCustomer(customerId: string) {
    if (!customers) return;
    const target = customers.find((c) => c.id === customerId);
    if (!target) return;

    const applyDelete = () => {
      const nextList = customers.filter((c) => c.id !== customerId);
      onUpdateCustomers(nextList);
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
      if (canUseCrmApiFallback() || isDemoFallback) {
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
            if (canUseCrmApiFallback() || isDemoFallback) {
              persistedRows.push(row);
            }
          }
        }
        if (persistedRows.length === 0) {
          toast.error('Không nhập được khách hàng lên máy chủ, vui lòng thử lại.');
          return;
        }
        onUpdateCustomers([...persistedRows, ...customers]);
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

  const detailRow = detailCustomerId
    ? (customers.find((c) => c.id === detailCustomerId) ?? null)
    : null;
  const detailOppsCount = detailRow
    ? opportunities.filter((o) => o.customerId === detailRow.id || o.customerName === detailRow.name).length
    : 0;
  const detailContactsCount = detailRow
    ? contacts.filter((c) => c.customerId === detailRow.id || c.customerName === detailRow.name).length
    : 0;

  return (
    <section className="qx-page crm-page" aria-label="Khách hàng" ref={pageRef}>
      <header className="qx-page-head">
        <div>
          <h1>Khách hàng</h1>
          <p>Quản lý hồ sơ khách hàng doanh nghiệp và cá nhân đang theo dõi</p>
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
            <Upload size={16} strokeWidth={1.5} aria-hidden="true" />
            Nhập dữ liệu
          </button>
          <button
            type="button"
            className="qx-btn qx-btn--primary"
            onClick={() => setCreating(true)}
          >
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            Thêm khách hàng
          </button>
        </div>
      </header>

      <div className="qx-stats" aria-label="Thống kê khách hàng">
        <article className="qx-stat">
          <div className="qx-stat__label">Tổng khách hàng</div>
          <div className="qx-stat__value">{formatViCount(customers.length)}</div>
          <div className="qx-stat__note">Hồ sơ đang lưu trong hệ thống</div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Doanh nghiệp</div>
          <div className="qx-stat__value">{formatViCount(enterpriseCount)}</div>
          <div className="qx-stat__note">Khách hàng tổ chức</div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Cá nhân</div>
          <div className="qx-stat__value">{formatViCount(individualCount)}</div>
          <div className="qx-stat__note">Khách hàng cá nhân</div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Đang chăm sóc</div>
          <div className="qx-stat__value">{formatViCount(activeCareCount)}</div>
          <div className="qx-stat__note">Khách hàng đã ký hoặc duy trì</div>
        </article>
      </div>

      <div className="crm-split-layout">
        <div className="qx-card crm-list crm-split-main">
          <div className="qx-card__head">
            <h2 className="qx-card__title">
              Danh sách khách hàng
              <span className="qx-count">{formatViCount(visibleCustomers.length)}</span>
            </h2>
            <div className="crm-filter-controls">
              <div className="crm-select-inline">
                <Select<'all' | CustomerStage>
                  value={stageFilter}
                  onValueChange={setStageFilter}
                  options={CUSTOMER_STAGE_FILTER_OPTIONS}
                  controlSize="sm"
                  aria-label="Lọc theo trạng thái khách hàng"
                />
              </div>
              <div className="crm-select-inline">
                <Select<string>
                  value={ownerFilter}
                  onValueChange={setOwnerFilter}
                  options={ownerFilterOptions}
                  controlSize="sm"
                  aria-label="Lọc theo phụ trách"
                />
              </div>
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
                Tất cả ({formatViCount(customers.length)})
              </button>
              <button
                type="button"
                role="tab"
                className="qx-tab"
                aria-selected={tab === 'enterprise'}
                onClick={() => setTab('enterprise')}
              >
                Doanh nghiệp ({formatViCount(enterpriseCount)})
              </button>
              <button
                type="button"
                role="tab"
                className="qx-tab"
                aria-selected={tab === 'individual'}
                onClick={() => setTab('individual')}
              >
                Cá nhân ({formatViCount(individualCount)})
              </button>
            </div>

            <label className="qx-field-search">
              <Search size={16} strokeWidth={1.5} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm khách hàng"
                aria-label="Tìm khách hàng"
              />
            </label>
          </div>

          <div className="crm-table-wrap">
            {visibleCustomers.length === 0 ? (
              <div className="crm-empty">Không tìm thấy khách hàng phù hợp với bộ lọc hiện tại</div>
            ) : (
              <table className="qx-table" aria-label="Danh sách khách hàng">
                <thead>
                  <tr>
                    <th scope="col">Khách hàng</th>
                    <th scope="col">Loại</th>
                    <th scope="col">Ngành</th>
                    <th scope="col">Phụ trách</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Liên hệ gần nhất</th>
                    <th scope="col" aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {visibleCustomers.map((row) => (
                    <tr
                      key={row.id}
                      className="is-clickable"
                      aria-selected={detailCustomerId === row.id ? 'true' : undefined}
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest('button, a, input, [role="menu"]')) {
                          return;
                        }
                        setDetailCustomerId(row.id);
                      }}
                    >
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
                      <td>{row.segment === 'enterprise' ? 'Doanh nghiệp' : 'Cá nhân'}</td>
                      <td>{row.industry}</td>
                      <td>
                        <span className="qx-person crm-owner">
                          <span className="qx-avatar qx-avatar--sm" aria-hidden="true">
                            {row.ownerInitials}
                          </span>
                          <span>{row.ownerName}</span>
                        </span>
                      </td>
                      <td>
                        <span className={`qx-badge ${CUSTOMER_STAGE_BADGE[row.stage]}`}>
                          {row.stage}
                        </span>
                      </td>
                      <td className="crm-num">{row.lastContact}</td>
                      <td className="crm-row-actions">
                        <CrmRowMenu
                          open={openRowMenuId === row.id}
                          onOpenChange={(nextOpen) => setOpenRowMenuId(nextOpen ? row.id : null)}
                          triggerLabel={`Thao tác với ${row.name}`}
                          menuLabel={`Thao tác ${row.name}`}
                        >
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
                            Chuyển trạng thái tiếp theo
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
                        </CrmRowMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <ResponsiveDetailDrawer
          open={Boolean(detailRow)}
          onClose={() => setDetailCustomerId(null)}
          title={detailRow?.name ?? ''}
          subtitle={detailRow ? `${detailRow.segment === 'enterprise' ? 'Doanh nghiệp' : 'Cá nhân'} · ${detailRow.industry}` : ''}
          footer={
            detailRow ? (
              <>
                <button type="button" className="qx-btn qx-btn--sm" onClick={() => handleCopyEmail(detailRow.email)}>
                  Sao chép email
                </button>
                <button
                  type="button"
                  className="qx-btn qx-btn--sm"
                  onClick={() => handleAdvanceStage(detailRow.id)}
                >
                  Chuyển trạng thái tiếp theo
                </button>
              </>
            ) : null
          }
        >
          {detailRow ? (
            <div className="crm-drawer-stack">
              <dl className="qs-attribute-list">
                <div className="qs-attribute-list__row">
                  <dt className="qs-attribute-list__label">Email liên hệ</dt>
                  <dd className="qs-attribute-list__value">{detailRow.email}</dd>
                </div>
                <div className="qs-attribute-list__row">
                  <dt className="qs-attribute-list__label">Loại</dt>
                  <dd className="qs-attribute-list__value">
                    {detailRow.segment === 'enterprise' ? 'Doanh nghiệp' : 'Cá nhân'}
                  </dd>
                </div>
                <div className="qs-attribute-list__row">
                  <dt className="qs-attribute-list__label">Ngành</dt>
                  <dd className="qs-attribute-list__value">{detailRow.industry}</dd>
                </div>
                <div className="qs-attribute-list__row">
                  <dt className="qs-attribute-list__label">Phụ trách</dt>
                  <dd className="qs-attribute-list__value">{detailRow.ownerName}</dd>
                </div>
                <div className="qs-attribute-list__row">
                  <dt className="qs-attribute-list__label">Liên hệ gần nhất</dt>
                  <dd className="qs-attribute-list__value">{detailRow.lastContact}</dd>
                </div>
                <div className="qs-attribute-list__row">
                  <dt className="qs-attribute-list__label">Cơ hội liên quan</dt>
                  <dd className="qs-attribute-list__value">{detailOppsCount} cơ hội</dd>
                </div>
                <div className="qs-attribute-list__row">
                  <dt className="qs-attribute-list__label">Đầu mối liên hệ</dt>
                  <dd className="qs-attribute-list__value">{detailContactsCount} đầu mối</dd>
                </div>
              </dl>

              <div className="crm-field">
                <label htmlFor="crm-detail-stage">Cập nhật trạng thái</label>
                <Select<CustomerStage>
                  id="crm-detail-stage"
                  value={detailRow.stage}
                  onValueChange={(next) => {
                    void handleUpdateStage(detailRow.id, next);
                  }}
                  options={CUSTOMER_STAGE_OPTIONS}
                  aria-label="Cập nhật trạng thái khách hàng"
                />
              </div>
            </div>
          ) : null}
        </ResponsiveDetailDrawer>
      </div>

      <CreateCustomerModal
        open={creating}
        onOpenChange={setCreating}
        existingEmails={existingEmails}
        ownerNames={ownerNames}
        isDemoFallback={isDemoFallback}
        onCreated={(created) => {
          invalidateApiCache('/api/org/crm');
          const nextList = [created, ...customers.filter((c) => c.id !== created.id)];
          onUpdateCustomers(nextList);
          toast.success(`Đã thêm khách hàng ${created.name}`);
        }}
      />
    </section>
  );
}
