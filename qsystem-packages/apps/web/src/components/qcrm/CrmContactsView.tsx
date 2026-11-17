'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  MessageSquare,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  ResponsiveDetailDrawer,
  Select,
  toast,
  useFloatingLayer,
  type SelectOption,
} from '@qsystem/ui';
import { getLocalDateIso } from '../../lib/date';
import { CrmRowMenu } from './CrmRowMenu';
import {
  CONTACT_CHANNELS,
  CONTACT_ROLE_BADGE,
  CONTACT_ROLES,
  formatCrmDate,
  formatCrmRelativeDate,
  formatViCount,
  getIsoDaysDiff,
  ownerInitialsOf,
  sanitizeCrmCell,
  toneForOwner,
  type ContactChannel,
  type ContactRoleType,
  type ContactRow,
  type CustomerRow,
} from './crm.storage';

type RoleTabFilter = 'all' | ContactRoleType;

const ROLE_OPTIONS: readonly SelectOption<ContactRoleType>[] = CONTACT_ROLES.map((role) => ({
  value: role,
  label: role,
}));

const CHANNEL_OPTIONS: readonly SelectOption<ContactChannel>[] = CONTACT_CHANNELS.map((channel) => ({
  value: channel,
  label: channel,
}));

const CHANNEL_FILTER_OPTIONS: readonly SelectOption<'all' | ContactChannel>[] = [
  { value: 'all', label: 'Tất cả kênh' },
  ...CHANNEL_OPTIONS,
];

function CreateContactModal({
  open,
  onOpenChange,
  customers,
  ownerNames,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: readonly CustomerRow[];
  ownerNames: readonly string[];
  onCreated: (contact: ContactRow) => void;
}) {
  if (!open) return null;
  return (
    <CreateContactDialog
      onOpenChange={onOpenChange}
      customers={customers}
      ownerNames={ownerNames}
      onCreated={onCreated}
    />
  );
}

function CreateContactDialog({
  onOpenChange,
  customers,
  ownerNames,
  onCreated,
}: {
  onOpenChange: (open: boolean) => void;
  customers: readonly CustomerRow[];
  ownerNames: readonly string[];
  onCreated: (contact: ContactRow) => void;
}) {
  const [fullName, setFullName] = React.useState('');
  const [jobTitle, setJobTitle] = React.useState('');
  const [customerId, setCustomerId] = React.useState(customers[0]?.id ?? '');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [contactRole, setContactRole] = React.useState<ContactRoleType>('Đầu mối chính');
  const [channel, setChannel] = React.useState<ContactChannel>('Điện thoại');
  const [ownerName, setOwnerName] = React.useState(ownerNames[0] ?? 'Lan Anh');
  const [initialNote, setInitialNote] = React.useState('');
  const [errors, setErrors] = React.useState<{
    fullName?: string;
    jobTitle?: string;
    customerId?: string;
    phone?: string;
    email?: string;
  }>({});

  const modalRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descId = React.useId();
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  useFloatingLayer(true, close, true, { root: modalRef });

  const customerOptions = React.useMemo<SelectOption<string>[]>(
    () => customers.map((c) => ({ value: c.id, label: c.name, description: c.industry })),
    [customers],
  );

  const ownerOptions = React.useMemo<SelectOption<string>[]>(
    () => ownerNames.map((o) => ({ value: o, label: o })),
    [ownerNames],
  );

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedName = sanitizeCrmCell(fullName);
    const trimmedTitle = sanitizeCrmCell(jobTitle);
    const trimmedPhone = sanitizeCrmCell(phone);
    const trimmedEmail = sanitizeCrmCell(email).toLowerCase();

    const nextErrors: typeof errors = {};
    if (!trimmedName) nextErrors.fullName = 'Vui lòng nhập họ tên đầu mối.';
    if (!trimmedTitle) nextErrors.jobTitle = 'Vui lòng nhập vai trò hoặc chức vụ.';
    if (!customerId) nextErrors.customerId = 'Vui lòng chọn khách hàng.';
    if (!trimmedPhone || trimmedPhone.replace(/\D/g, '').length < 8) {
      nextErrors.phone = 'Vui lòng nhập số điện thoại hợp lệ.';
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = 'Vui lòng nhập email hợp lệ.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const customer = customers.find((c) => c.id === customerId);
    const todayIso = getLocalDateIso();
    const finalOwner = sanitizeCrmCell(ownerName) || 'Lan Anh';
    const noteText = sanitizeCrmCell(initialNote) || 'Khởi tạo hồ sơ đầu mối liên hệ.';

    onCreated({
      id: `ct-${Date.now()}`,
      fullName: trimmedName,
      jobTitle: trimmedTitle,
      customerId,
      customerName: customer?.name ?? 'Khách hàng mới',
      phone: trimmedPhone,
      email: trimmedEmail,
      contactRole,
      channel,
      lastInteractionIso: todayIso,
      ownerName: finalOwner,
      ownerInitials: ownerInitialsOf(finalOwner),
      ownerTone: toneForOwner(finalOwner),
      interactions: [
        {
          id: `int-${Date.now()}`,
          dateIso: todayIso,
          channel,
          note: noteText,
          by: finalOwner,
        },
      ],
    });
    onOpenChange(false);
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
          <h2 id={titleId}>Thêm đầu mối liên hệ</h2>
          <p id={descId}>Lưu thông tin đầu mối phụ trách phía khách hàng và kênh làm việc chính</p>
          <button type="button" className="crm-modal__close" aria-label="Đóng hộp thoại" onClick={close}>
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="crm-modal__body">
            <div className="crm-field">
              <label htmlFor="ct-fullname">Họ tên đầu mối *</label>
              <input
                id="ct-fullname"
                className="crm-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nguyễn Văn An"
              />
              {errors.fullName ? (
                <p className="crm-error" role="alert">
                  {errors.fullName}
                </p>
              ) : null}
            </div>

            <div className="crm-field">
              <label htmlFor="ct-jobtitle">Vai trò / Chức vụ *</label>
              <input
                id="ct-jobtitle"
                className="crm-input"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Giám đốc vận hành"
              />
              {errors.jobTitle ? (
                <p className="crm-error" role="alert">
                  {errors.jobTitle}
                </p>
              ) : null}
            </div>

            <div className="crm-field">
              <label htmlFor="ct-customer">Khách hàng *</label>
              <Select<string>
                id="ct-customer"
                value={customerId}
                onValueChange={setCustomerId}
                options={customerOptions}
                placeholder="Chọn khách hàng"
                error={Boolean(errors.customerId)}
                aria-label="Khách hàng"
              />
              {errors.customerId ? (
                <p className="crm-error" role="alert">
                  {errors.customerId}
                </p>
              ) : null}
            </div>

            <div className="crm-field">
              <label htmlFor="ct-role">Vai trò đầu mối</label>
              <Select<ContactRoleType>
                id="ct-role"
                value={contactRole}
                onValueChange={setContactRole}
                options={ROLE_OPTIONS}
                aria-label="Vai trò đầu mối"
              />
            </div>

            <div className="crm-field">
              <label htmlFor="ct-phone">Số điện thoại *</label>
              <input
                id="ct-phone"
                type="tel"
                className="crm-input crm-num"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0903 123 456"
              />
              {errors.phone ? (
                <p className="crm-error" role="alert">
                  {errors.phone}
                </p>
              ) : null}
            </div>

            <div className="crm-field">
              <label htmlFor="ct-email">Email *</label>
              <input
                id="ct-email"
                type="email"
                className="crm-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="an.nguyen@congty.vn"
              />
              {errors.email ? (
                <p className="crm-error" role="alert">
                  {errors.email}
                </p>
              ) : null}
            </div>

            <div className="crm-field">
              <label htmlFor="ct-channel">Kênh liên hệ</label>
              <Select<ContactChannel>
                id="ct-channel"
                value={channel}
                onValueChange={setChannel}
                options={CHANNEL_OPTIONS}
                aria-label="Kênh liên hệ"
              />
            </div>

            <div className="crm-field">
              <label htmlFor="ct-owner">Phụ trách</label>
              <Select<string>
                id="ct-owner"
                value={ownerName}
                onValueChange={setOwnerName}
                options={ownerOptions}
                aria-label="Phụ trách"
              />
            </div>

            <div className="crm-field crm-field--full">
              <label htmlFor="ct-note">Ghi chú tương tác ban đầu</label>
              <textarea
                id="ct-note"
                rows={2}
                className="crm-textarea"
                value={initialNote}
                onChange={(e) => setInitialNote(e.target.value)}
                placeholder="Nội dung trao đổi gần nhất với đầu mối"
              />
            </div>
          </div>

          <div className="crm-modal__foot">
            <button type="button" className="qx-btn" onClick={close}>
              Hủy
            </button>
            <button type="submit" className="qx-btn qx-btn--primary">
              <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
              Lưu liên hệ
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(dialog, document.body);
}

function ContactDetailContent({
  contact,
  onLogInteraction,
  onUpdateRole,
}: {
  contact: ContactRow;
  onLogInteraction: (channel: ContactChannel, note: string) => void;
  onUpdateRole: (role: ContactRoleType) => void;
}) {
  const [logChannel, setLogChannel] = React.useState<ContactChannel>(contact.channel);
  const [logNote, setLogNote] = React.useState('');

  React.useEffect(() => {
    setLogChannel(contact.channel);
    setLogNote('');
  }, [contact.id, contact.channel]);

  function handleRecordClick() {
    onLogInteraction(
      logChannel,
      sanitizeCrmCell(logNote) || `Trao đổi với ${contact.fullName} qua ${logChannel}.`,
    );
    setLogNote('');
  }

  return (
    <div className="crm-drawer-stack">
      <dl className="qs-attribute-list">
        <div className="qs-attribute-list__row">
          <dt className="qs-attribute-list__label">Khách hàng</dt>
          <dd className="qs-attribute-list__value">{contact.customerName}</dd>
        </div>
        <div className="qs-attribute-list__row">
          <dt className="qs-attribute-list__label">Chức vụ</dt>
          <dd className="qs-attribute-list__value">{contact.jobTitle}</dd>
        </div>
        <div className="qs-attribute-list__row">
          <dt className="qs-attribute-list__label">Số điện thoại</dt>
          <dd className="qs-attribute-list__value crm-num">{contact.phone}</dd>
        </div>
        <div className="qs-attribute-list__row">
          <dt className="qs-attribute-list__label">Email</dt>
          <dd className="qs-attribute-list__value">{contact.email}</dd>
        </div>
        <div className="qs-attribute-list__row">
          <dt className="qs-attribute-list__label">Kênh chính</dt>
          <dd className="qs-attribute-list__value">{contact.channel}</dd>
        </div>
        <div className="qs-attribute-list__row">
          <dt className="qs-attribute-list__label">Tương tác gần nhất</dt>
          <dd className="qs-attribute-list__value crm-num">
            {formatCrmRelativeDate(contact.lastInteractionIso)} ({formatCrmDate(contact.lastInteractionIso)})
          </dd>
        </div>
        <div className="qs-attribute-list__row">
          <dt className="qs-attribute-list__label">Phụ trách</dt>
          <dd className="qs-attribute-list__value">{contact.ownerName}</dd>
        </div>
      </dl>

      <div className="crm-field">
        <label htmlFor="ct-detail-role">Vai trò đầu mối</label>
        <Select<ContactRoleType>
          id="ct-detail-role"
          value={contact.contactRole}
          onValueChange={onUpdateRole}
          options={ROLE_OPTIONS}
          aria-label="Vai trò đầu mối"
        />
      </div>

      <div className="crm-interaction-box">
        <h3 className="crm-drawer-section-title">Cập nhật tương tác mới</h3>
        <div className="crm-field">
          <label htmlFor="ct-log-channel">Kênh tương tác</label>
          <Select<ContactChannel>
            id="ct-log-channel"
            value={logChannel}
            onValueChange={setLogChannel}
            options={CHANNEL_OPTIONS}
            controlSize="sm"
            aria-label="Kênh tương tác"
          />
        </div>
        <div className="crm-field">
          <label htmlFor="ct-log-note">Nội dung trao đổi</label>
          <textarea
            id="ct-log-note"
            rows={2}
            className="crm-textarea"
            value={logNote}
            onChange={(e) => setLogNote(e.target.value)}
            placeholder="Ghi chú ngắn gọn kết quả cuộc gọi, email hoặc buổi gặp"
          />
        </div>
        <button type="button" className="qx-btn qx-btn--sm" onClick={handleRecordClick}>
          <MessageSquare size={16} strokeWidth={1.5} aria-hidden="true" />
          Ghi nhận tương tác
        </button>
      </div>

      <div className="crm-interaction-history">
        <h3 className="crm-drawer-section-title">
          Lịch sử tương tác ({formatViCount(contact.interactions.length)})
        </h3>
        <ul className="crm-history-list">
          {contact.interactions.map((entry) => (
            <li key={entry.id} className="crm-history-item">
              <div className="crm-history-item__meta">
                <span className="qx-badge">{entry.channel}</span>
                <span className="crm-num">{formatCrmRelativeDate(entry.dateIso)}</span>
              </div>
              <p className="crm-history-item__note">{entry.note}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export interface CrmContactsViewProps {
  contacts: ContactRow[];
  customers: CustomerRow[];
  ownerNames: readonly string[];
  onUpdateContacts: (next: ContactRow[]) => void;
}

export function CrmContactsView({
  contacts,
  customers,
  ownerNames,
  onUpdateContacts,
}: CrmContactsViewProps) {
  const [roleTab, setRoleTab] = React.useState<RoleTabFilter>('all');
  const [customerFilter, setCustomerFilter] = React.useState<string>('all');
  const [channelFilter, setChannelFilter] = React.useState<'all' | ContactChannel>('all');
  const [search, setSearch] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [detailContactId, setDetailContactId] = React.useState<string | null>(null);
  const [openRowMenuId, setOpenRowMenuId] = React.useState<string | null>(null);
  const pageRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (!openRowMenuId) return;
    function onDocClick(event: MouseEvent) {
      if (!pageRef.current?.contains(event.target as Node)) setOpenRowMenuId(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenRowMenuId(null);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openRowMenuId]);

  const customerFilterOptions = React.useMemo<SelectOption<string>[]>(
    () => [
      { value: 'all', label: 'Tất cả khách hàng' },
      ...customers.map((c) => ({ value: c.id, label: c.name })),
    ],
    [customers],
  );

  const primaryContactsCount = contacts.filter((c) => c.contactRole === 'Đầu mối chính').length;
  const interactedLast7Days = contacts.filter((c) => {
    const diff = getIsoDaysDiff(c.lastInteractionIso);
    return Number.isFinite(diff) && diff >= -7 && diff <= 0;
  }).length;
  const totalInteractionsCount = contacts.reduce((sum, c) => sum + c.interactions.length, 0);

  const normalizedQuery = search.trim().toLowerCase();
  const visibleContacts = contacts.filter((ct) => {
    if (roleTab !== 'all' && ct.contactRole !== roleTab) return false;
    if (customerFilter !== 'all' && ct.customerId !== customerFilter) return false;
    if (channelFilter !== 'all' && ct.channel !== channelFilter) return false;
    if (!normalizedQuery) return true;
    return (
      ct.fullName.toLowerCase().includes(normalizedQuery) ||
      ct.jobTitle.toLowerCase().includes(normalizedQuery) ||
      ct.customerName.toLowerCase().includes(normalizedQuery) ||
      ct.phone.toLowerCase().includes(normalizedQuery) ||
      ct.email.toLowerCase().includes(normalizedQuery) ||
      ct.ownerName.toLowerCase().includes(normalizedQuery)
    );
  });

  function handleRecordInteraction(contactId: string, channel: ContactChannel, note: string) {
    const target = contacts.find((c) => c.id === contactId);
    if (!target) return;
    const todayIso = getLocalDateIso();
    const newEntry = {
      id: `int-${Date.now()}`,
      dateIso: todayIso,
      channel,
      note,
      by: target.ownerName,
    };
    const next = contacts.map((item) =>
      item.id === contactId
        ? {
            ...item,
            lastInteractionIso: todayIso,
            interactions: [newEntry, ...item.interactions],
          }
        : item,
    );
    onUpdateContacts(next);
    setOpenRowMenuId(null);
    toast.success(`Đã ghi nhận tương tác với ${target.fullName}`);
  }

  function handleDeleteContact(contactId: string) {
    const target = contacts.find((c) => c.id === contactId);
    if (!target) return;
    onUpdateContacts(contacts.filter((c) => c.id !== contactId));
    setOpenRowMenuId(null);
    if (detailContactId === contactId) setDetailContactId(null);
    toast.success(`Đã xóa đầu mối ${target.fullName}`);
  }

  const detailContact = detailContactId
    ? (contacts.find((c) => c.id === detailContactId) ?? null)
    : null;

  return (
    <section className="qx-page crm-page" aria-label="Liên hệ" ref={pageRef}>
      <header className="qx-page-head">
        <div>
          <h1>Liên hệ</h1>
          <p>Quản lý đầu mối liên hệ theo khách hàng, vai trò phụ trách và lịch sử tương tác</p>
        </div>
        <div className="qx-actions">
          <button
            type="button"
            className="qx-btn qx-btn--primary"
            onClick={() => setCreating(true)}
          >
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            Thêm liên hệ
          </button>
        </div>
      </header>

      <div className="qx-stats" aria-label="Thống kê đầu mối liên hệ">
        <article className="qx-stat">
          <div className="qx-stat__label">Tổng đầu mối liên hệ</div>
          <div className="qx-stat__value">{formatViCount(contacts.length)}</div>
          <div className="qx-stat__note">Gắn với {formatViCount(customers.length)} khách hàng</div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Đầu mối chính</div>
          <div className="qx-stat__value">{formatViCount(primaryContactsCount)}</div>
          <div className="qx-stat__note">Người quyết định và phê duyệt chính</div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Tương tác 7 ngày qua</div>
          <div className="qx-stat__value">{formatViCount(interactedLast7Days)}</div>
          <div className="qx-stat__note">Đầu mối vừa có trao đổi gần đây</div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Tổng lượt tương tác</div>
          <div className="qx-stat__value">{formatViCount(totalInteractionsCount)}</div>
          <div className="qx-stat__note">Lịch sử trao đổi đã ghi nhận</div>
        </article>
      </div>

      <div className="crm-split-layout">
        <div className="qx-card crm-list crm-split-main">
          <div className="qx-card__head">
            <h2 className="qx-card__title">
              Danh sách đầu mối liên hệ
              <span className="qx-count">{formatViCount(visibleContacts.length)}</span>
            </h2>
            <div className="crm-filter-controls">
              <div className="crm-select-inline">
                <Select<string>
                  value={customerFilter}
                  onValueChange={setCustomerFilter}
                  options={customerFilterOptions}
                  controlSize="sm"
                  aria-label="Lọc theo khách hàng"
                />
              </div>
              <div className="crm-select-inline">
                <Select<'all' | ContactChannel>
                  value={channelFilter}
                  onValueChange={setChannelFilter}
                  options={CHANNEL_FILTER_OPTIONS}
                  controlSize="sm"
                  aria-label="Lọc theo kênh chính"
                />
              </div>
            </div>
          </div>

          <div className="crm-toolbar">
            <div className="qx-tabs crm-tabs--scroll" role="tablist" aria-label="Vai trò đầu mối">
              <button
                type="button"
                role="tab"
                className="qx-tab"
                aria-selected={roleTab === 'all'}
                onClick={() => setRoleTab('all')}
              >
                Tất cả ({formatViCount(contacts.length)})
              </button>
              {CONTACT_ROLES.map((roleName) => {
                const count = contacts.filter((c) => c.contactRole === roleName).length;
                return (
                  <button
                    key={roleName}
                    type="button"
                    role="tab"
                    className="qx-tab"
                    aria-selected={roleTab === roleName}
                    onClick={() => setRoleTab(roleName)}
                  >
                    {roleName} ({formatViCount(count)})
                  </button>
                );
              })}
            </div>

            <label className="qx-field-search">
              <Search size={16} strokeWidth={1.5} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm tên đầu mối, SĐT, email"
                aria-label="Tìm đầu mối liên hệ"
              />
            </label>
          </div>

          <div className="crm-table-wrap">
            {visibleContacts.length === 0 ? (
              <div className="crm-empty">Không tìm thấy đầu mối liên hệ phù hợp</div>
            ) : (
              <table className="qx-table" aria-label="Danh sách đầu mối liên hệ">
                <thead>
                  <tr>
                    <th scope="col">Họ tên đầu mối</th>
                    <th scope="col">Vai trò / Chức vụ</th>
                    <th scope="col">Khách hàng</th>
                    <th scope="col">Số điện thoại</th>
                    <th scope="col">Email</th>
                    <th scope="col">Vai trò đầu mối</th>
                    <th scope="col">Kênh chính</th>
                    <th scope="col">Tương tác gần nhất</th>
                    <th scope="col">Phụ trách</th>
                    <th scope="col" aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {visibleContacts.map((ct) => {
                    const badgeCls = CONTACT_ROLE_BADGE[ct.contactRole];
                    const relativeDate = formatCrmRelativeDate(ct.lastInteractionIso);
                    return (
                      <tr
                        key={ct.id}
                        className="is-clickable"
                        aria-selected={detailContactId === ct.id ? 'true' : undefined}
                        onClick={(event) => {
                          if ((event.target as HTMLElement).closest('button, a, input, [role="menu"]')) {
                            return;
                          }
                          setDetailContactId(ct.id);
                        }}
                      >
                        <td>
                          <span className="qx-table__strong">{ct.fullName}</span>
                        </td>
                        <td>{ct.jobTitle}</td>
                        <td>{ct.customerName}</td>
                        <td className="crm-num">{ct.phone}</td>
                        <td>{ct.email}</td>
                        <td>
                          <span className={`qx-badge ${badgeCls}`}>{ct.contactRole}</span>
                        </td>
                        <td>{ct.channel}</td>
                        <td className="crm-num">{relativeDate}</td>
                        <td>
                          <span className="qx-person crm-owner">
                            <span className="qx-avatar qx-avatar--sm" aria-hidden="true">
                              {ct.ownerInitials}
                            </span>
                            <span>{ct.ownerName}</span>
                          </span>
                        </td>
                        <td className="crm-row-actions">
                          <CrmRowMenu
                            open={openRowMenuId === ct.id}
                            onOpenChange={(nextOpen) => setOpenRowMenuId(nextOpen ? ct.id : null)}
                            triggerLabel={`Thao tác với ${ct.fullName}`}
                            menuLabel={`Thao tác ${ct.fullName}`}
                          >
                            <button
                              type="button"
                              role="menuitem"
                              className="crm-row-menu__item"
                              onClick={() => {
                                setOpenRowMenuId(null);
                                setDetailContactId(ct.id);
                              }}
                            >
                              Xem chi tiết đầu mối
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="crm-row-menu__item"
                              onClick={() =>
                                handleRecordInteraction(
                                  ct.id,
                                  ct.channel,
                                  `Trao đổi nhanh với ${ct.fullName} qua ${ct.channel}.`,
                                )
                              }
                            >
                              Ghi nhận tương tác
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="crm-row-menu__item crm-row-menu__item--danger"
                              onClick={() => handleDeleteContact(ct.id)}
                            >
                              Xóa đầu mối
                            </button>
                          </CrmRowMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <ResponsiveDetailDrawer
          open={Boolean(detailContact)}
          onClose={() => setDetailContactId(null)}
          title={detailContact?.fullName ?? ''}
          subtitle={
            detailContact ? `${detailContact.jobTitle} · ${detailContact.customerName}` : ''
          }
        >
          {detailContact ? (
            <ContactDetailContent
              contact={detailContact}
              onLogInteraction={(channel, note) =>
                handleRecordInteraction(detailContact.id, channel, note)
              }
              onUpdateRole={(nextRole) => {
                onUpdateContacts(
                  contacts.map((c) =>
                    c.id === detailContact.id ? { ...c, contactRole: nextRole } : c,
                  ),
                );
                toast.success(`Đã cập nhật vai trò cho ${detailContact.fullName}`);
              }}
            />
          ) : null}
        </ResponsiveDetailDrawer>
      </div>

      <CreateContactModal
        open={creating}
        onOpenChange={setCreating}
        customers={customers}
        ownerNames={ownerNames}
        onCreated={(created) => {
          onUpdateContacts([created, ...contacts]);
          toast.success(`Đã thêm đầu mối ${created.fullName}`);
        }}
      />
    </section>
  );
}
