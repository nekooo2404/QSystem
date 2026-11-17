'use client';

import * as React from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import {
  AttributeRowList,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ResponsiveDetailDrawer,
  Select,
  UnderlineTabs,
  type SelectOption,
  type UnderlineTab,
} from '@qsystem/ui';
import type { MeResponse } from '@qsystem/contracts';
import { formatRole } from '../../lib/adapters/notifications.adapter';
import { CreateLeaveModal } from './CreateLeaveModal';
import { formatLeaveDateRange } from './qhrm.storage';
import type {
  LeaveBalanceSummary,
  LeaveRequest,
  LeaveStatus,
  LeaveType,
  OrgUser,
} from './qhrm.types';

type LeaveTabId = 'all' | 'pending' | 'approved' | 'rejected' | 'mine';

const LEAVE_TYPE_FILTER_OPTIONS: readonly SelectOption<string>[] = [
  { value: 'all', label: 'Tất cả loại phép' },
  { value: 'Phép năm', label: 'Phép năm' },
  { value: 'Nghỉ ốm', label: 'Nghỉ ốm' },
  { value: 'Việc riêng', label: 'Việc riêng' },
  { value: 'Nghỉ bù', label: 'Nghỉ bù' },
];

const DEMO_VIEW_OPTIONS: readonly SelectOption<'self' | 'approver'>[] = [
  { value: 'self', label: 'Góc nhìn: Nhân viên' },
  { value: 'approver', label: 'Góc nhìn: Quản lý duyệt đơn' },
];

function leaveStatusBadgeClass(status: LeaveStatus): string {
  switch (status) {
    case 'Đã duyệt':
      return 'qx-badge qx-badge--green';
    case 'Từ chối':
      return 'qx-badge qx-badge--red';
    default:
      return 'qx-badge qx-badge--amber';
  }
}

export interface QhrmLeaveProps {
  me: MeResponse;
  users: OrgUser[];
  leaves: LeaveRequest[];
  balances: LeaveBalanceSummary[];
  isSampleMode: boolean;
  onCreateLeave: (payload: {
    type: LeaveType;
    fromDate: string;
    toDate: string;
    days: number;
    reason: string;
    approverId: string | null;
    approverName: string;
  }) => void;
  onApproveLeave: (leaveId: string, reviewerName: string) => void;
  onRejectLeave: (leaveId: string, reviewerName: string, reason: string) => void;
}

export function QhrmLeave({
  me,
  users,
  leaves,
  balances,
  isSampleMode,
  onCreateLeave,
  onApproveLeave,
  onRejectLeave,
}: QhrmLeaveProps) {
  const [activeTab, setActiveTab] = React.useState<LeaveTabId>('all');
  const [typeFilter, setTypeFilter] = React.useState<string>('all');
  const [search, setSearch] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [showTeamBalances, setShowTeamBalances] = React.useState(false);
  const [selectedLeaveId, setSelectedLeaveId] = React.useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = React.useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState('');
  const [rejectionError, setRejectionError] = React.useState<string | null>(null);
  const [demoViewMode, setDemoViewMode] = React.useState<'self' | 'approver'>('self');

  const isNaturalApprover = me.role === 'DIRECTOR' || me.role === 'MANAGER';
  const canSwitchDemoView =
    !isNaturalApprover && isSampleMode && process.env.NODE_ENV !== 'test';
  const canApprove = isNaturalApprover || (canSwitchDemoView && demoViewMode === 'approver');
  const effectiveRoleLabel = isNaturalApprover
    ? formatRole(me.role)
    : canApprove
      ? 'Quản lý'
      : 'Nhân viên';

  const myBalance: LeaveBalanceSummary = React.useMemo(() => {
    return (
      balances.find((b) => b.employeeId === me.id) ?? {
        employeeId: me.id,
        employeeCode: 'NV-0001',
        employeeName: me.name,
        departmentId: me.departmentId,
        departmentName: 'Toàn công ty',
        entitledDays: 12,
        usedDays: 0,
        pendingDays: 0,
        remainingDays: 12,
      }
    );
  }, [balances, me.departmentId, me.id, me.name]);

  const counts = React.useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let mine = 0;
    for (const item of leaves) {
      if (item.status === 'Chờ duyệt') pending += 1;
      else if (item.status === 'Đã duyệt') approved += 1;
      else if (item.status === 'Từ chối') rejected += 1;
      if (item.employeeId === me.id) mine += 1;
    }
    return {
      all: leaves.length,
      pending,
      approved,
      rejected,
      mine,
    };
  }, [leaves, me.id]);

  const tabs = React.useMemo<UnderlineTab[]>(
    () => [
      { id: 'all', label: 'Tất cả', count: counts.all },
      { id: 'pending', label: 'Chờ duyệt', count: counts.pending },
      { id: 'approved', label: 'Đã duyệt', count: counts.approved },
      { id: 'rejected', label: 'Từ chối', count: counts.rejected },
      { id: 'mine', label: 'Đơn của tôi', count: counts.mine },
    ],
    [counts],
  );

  const filteredLeaves = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return leaves.filter((item) => {
      if (activeTab === 'pending' && item.status !== 'Chờ duyệt') return false;
      if (activeTab === 'approved' && item.status !== 'Đã duyệt') return false;
      if (activeTab === 'rejected' && item.status !== 'Từ chối') return false;
      if (activeTab === 'mine' && item.employeeId !== me.id) return false;
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (!needle) return true;
      return (
        item.code.toLowerCase().includes(needle) ||
        item.employeeName.toLowerCase().includes(needle) ||
        item.departmentName.toLowerCase().includes(needle) ||
        item.reason.toLowerCase().includes(needle)
      );
    });
  }, [leaves, activeTab, typeFilter, search, me.id]);

  const selectedLeave = selectedLeaveId
    ? (leaves.find((item) => item.id === selectedLeaveId) ?? null)
    : null;

  function openRejectModal(request: LeaveRequest) {
    setRejectTarget(request);
    setRejectionReason('');
    setRejectionError(null);
  }

  function handleConfirmReject(event: React.FormEvent) {
    event.preventDefault();
    if (!rejectTarget) return;
    if (!rejectionReason.trim()) {
      setRejectionError('Vui lòng nhập lý do từ chối đơn.');
      return;
    }
    onRejectLeave(rejectTarget.id, me.name, rejectionReason.trim());
    setRejectTarget(null);
    setRejectionReason('');
    setRejectionError(null);
  }

  return (
    <section className="qx-page" aria-label="Nghỉ phép">
      <header className="qx-page-head">
        <div>
          <h1>Nghỉ phép</h1>
          <p>
            Quản lý quỹ ngày phép, gửi đơn xin nghỉ và theo dõi tiến trình phê duyệt · Vai trò:{' '}
            <strong>{effectiveRoleLabel}</strong>
          </p>
        </div>
        <div className="qx-actions">
          {canSwitchDemoView ? (
            <div className="hr-role-preview">
              <Select
                id="leave-demo-role"
                aria-label="Chọn góc nhìn xử lý đơn"
                controlSize="sm"
                value={demoViewMode}
                onValueChange={(value) => setDemoViewMode(value as 'self' | 'approver')}
                options={DEMO_VIEW_OPTIONS}
              />
            </div>
          ) : null}
          <button
            type="button"
            className="qx-btn"
            aria-expanded={showTeamBalances}
            onClick={() => setShowTeamBalances((prev) => !prev)}
          >
            <Users size={16} strokeWidth={1.5} aria-hidden="true" />
            Quỹ phép nhân sự
            {showTeamBalances ? (
              <ChevronUp size={16} strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className="qx-btn qx-btn--primary"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            Gửi đơn nghỉ phép
          </button>
        </div>
      </header>

      <div className="qx-stats" aria-label="Quỹ ngày phép của bạn">
        <article className="qx-stat">
          <div className="qx-stat__label">Phép năm được cấp</div>
          <div className="qx-stat__value">
            <span className="qs-numeric">{myBalance.entitledDays} ngày</span>
          </div>
          <div className="qx-stat__note">Định mức phép năm hiện hành</div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Đã sử dụng</div>
          <div className="qx-stat__value">
            <span className="qs-numeric">{myBalance.usedDays} ngày</span>
          </div>
          <div className="qx-stat__note">Đơn phép năm đã được duyệt</div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Đang chờ duyệt</div>
          <div className="qx-stat__value">
            <span className="qs-numeric">{myBalance.pendingDays} ngày</span>
          </div>
          <div className="qx-stat__note">Tạm giữ cho đơn chờ xử lý</div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Còn lại</div>
          <div className="qx-stat__value">
            <span className="qs-numeric">{myBalance.remainingDays} ngày</span>
          </div>
          <div className="qx-stat__note">Số ngày phép năm có thể đăng ký</div>
        </article>
      </div>

      {showTeamBalances ? (
        <section className="qx-card hr-team-balances" aria-label="Quỹ phép theo nhân sự">
          <div className="qx-card__head">
            <h2 className="qx-card__title">Quỹ phép năm theo nhân sự</h2>
            <span className="hr-team-balances__count qs-numeric">
              {balances.length} nhân sự
            </span>
          </div>
          <div className="hr-table-wrap">
            <table className="qx-table" aria-label="Bảng quỹ ngày phép nhân sự">
              <thead>
                <tr>
                  <th scope="col">Mã NV</th>
                  <th scope="col">Nhân sự</th>
                  <th scope="col">Phòng ban</th>
                  <th scope="col">Được cấp</th>
                  <th scope="col">Đã sử dụng</th>
                  <th scope="col">Đang chờ duyệt</th>
                  <th scope="col">Còn lại</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((item) => (
                  <tr key={item.employeeId}>
                    <td className="qs-numeric hr-code-cell">{item.employeeCode}</td>
                    <td className="qx-table__strong">{item.employeeName}</td>
                    <td>{item.departmentName}</td>
                    <td className="qs-numeric">{item.entitledDays} ngày</td>
                    <td className="qs-numeric">{item.usedDays} ngày</td>
                    <td className="qs-numeric">{item.pendingDays} ngày</td>
                    <td className="qs-numeric qx-table__strong">{item.remainingDays} ngày</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="hr-split-layout">
        <div className="qx-card hr-list hr-split-layout__main">
          <div className="hr-leave-toolbar">
            <UnderlineTabs
              tabs={tabs}
              activeId={activeTab}
              onChange={(id) => setActiveTab(id as LeaveTabId)}
              aria-label="Lọc trạng thái đơn nghỉ phép"
            />
            <div className="hr-leave-filters">
              <div className="hr-leave-filter-select">
                <Select
                  id="leave-type-filter"
                  aria-label="Lọc theo loại phép"
                  controlSize="sm"
                  value={typeFilter}
                  onValueChange={setTypeFilter}
                  options={LEAVE_TYPE_FILTER_OPTIONS}
                />
              </div>
              <label className="qx-field-search">
                <Search size={16} strokeWidth={1.5} aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm mã đơn, nhân sự"
                  aria-label="Tìm đơn nghỉ phép"
                />
              </label>
            </div>
          </div>

          <div className="hr-table-wrap">
            {filteredLeaves.length === 0 ? (
              <div className="hr-empty">
                Không có đơn nghỉ phép nào trong mục này
              </div>
            ) : (
              <table className="qx-table" aria-label="Danh sách đơn xin nghỉ phép">
                <thead>
                  <tr>
                    <th scope="col">Mã đơn</th>
                    <th scope="col">Nhân sự</th>
                    <th scope="col">Phòng ban</th>
                    <th scope="col">Loại phép</th>
                    <th scope="col">Từ ngày – Đến ngày</th>
                    <th scope="col">Số ngày</th>
                    <th scope="col">Lý do</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaves.map((row) => {
                    const selected = row.id === selectedLeaveId;
                    const showDecisionButtons = row.status === 'Chờ duyệt' && canApprove;
                    return (
                      <tr
                        key={row.id}
                        className="is-clickable"
                        aria-selected={selected ? 'true' : undefined}
                        tabIndex={0}
                        onClick={() => setSelectedLeaveId(row.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedLeaveId(row.id);
                          }
                        }}
                      >
                        <td className="qs-numeric hr-code-cell">{row.code}</td>
                        <td>
                          <div className="hr-person__text">
                            <span className="hr-person__name">{row.employeeName}</span>
                            <span className="hr-person__mail qs-numeric">{row.employeeCode}</span>
                          </div>
                        </td>
                        <td>{row.departmentName}</td>
                        <td>{row.type}</td>
                        <td className="qs-numeric">
                          {formatLeaveDateRange(row.fromDate, row.toDate)}
                        </td>
                        <td className="qs-numeric">{row.days} ngày</td>
                        <td className="hr-reason-cell" title={row.reason}>
                          {row.reason}
                        </td>
                        <td>
                          <span className={leaveStatusBadgeClass(row.status)}>{row.status}</span>
                        </td>
                        <td className="hr-leave-actions-cell">
                          <div
                            className="hr-leave-row-actions"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {showDecisionButtons ? (
                              <>
                                <button
                                  type="button"
                                  className="qx-btn qx-btn--sm hr-btn-approve"
                                  aria-label={`Duyệt đơn ${row.code}`}
                                  onClick={() => onApproveLeave(row.id, me.name)}
                                >
                                  <Check size={16} strokeWidth={1.5} aria-hidden="true" />
                                  Duyệt
                                </button>
                                <button
                                  type="button"
                                  className="qx-btn qx-btn--sm hr-btn-reject"
                                  aria-label={`Từ chối đơn ${row.code}`}
                                  onClick={() => openRejectModal(row)}
                                >
                                  <X size={16} strokeWidth={1.5} aria-hidden="true" />
                                  Từ chối
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="qx-btn qx-btn--sm qx-btn--ghost"
                                onClick={() => setSelectedLeaveId(row.id)}
                              >
                                Chi tiết
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="qx-card__foot hr-foot">
            <span>
              Hiển thị <strong className="qs-numeric">{filteredLeaves.length}</strong> đơn nghỉ phép
            </span>
            {!canApprove ? (
              <span className="hr-foot__hint">
                Quyền duyệt đơn chỉ áp dụng cho vai trò Quản lý hoặc Giám đốc
              </span>
            ) : (
              <span className="hr-foot__hint">
                Đơn được duyệt sẽ tự động cập nhật quỹ phép và bảng chấm công
              </span>
            )}
          </div>
        </div>

        <ResponsiveDetailDrawer
          open={Boolean(selectedLeave)}
          onClose={() => setSelectedLeaveId(null)}
          title={selectedLeave ? `Đơn nghỉ phép ${selectedLeave.code}` : ''}
          subtitle={
            selectedLeave
              ? `${selectedLeave.employeeName} · ${selectedLeave.departmentName}`
              : undefined
          }
          footer={
            selectedLeave && selectedLeave.status === 'Chờ duyệt' && canApprove ? (
              <>
                <button
                  type="button"
                  className="qx-btn hr-btn-reject"
                  onClick={() => openRejectModal(selectedLeave)}
                >
                  Từ chối
                </button>
                <button
                  type="button"
                  className="qx-btn hr-btn-approve"
                  onClick={() => onApproveLeave(selectedLeave.id, me.name)}
                >
                  Duyệt đơn
                </button>
              </>
            ) : (
              <button
                type="button"
                className="qx-btn"
                onClick={() => setSelectedLeaveId(null)}
              >
                Đóng
              </button>
            )
          }
        >
          {selectedLeave ? (
            <div className="hr-drawer-stack">
              <AttributeRowList
                items={[
                  {
                    id: 'code',
                    label: 'Mã đơn',
                    value: <span className="qs-numeric">{selectedLeave.code}</span>,
                  },
                  {
                    id: 'employee',
                    label: 'Nhân sự',
                    value: `${selectedLeave.employeeName} (${selectedLeave.employeeCode})`,
                  },
                  {
                    id: 'dept',
                    label: 'Phòng ban',
                    value: selectedLeave.departmentName,
                  },
                  {
                    id: 'type',
                    label: 'Loại phép',
                    value: selectedLeave.type,
                  },
                  {
                    id: 'range',
                    label: 'Từ ngày – Đến ngày',
                    value: (
                      <span className="qs-numeric">
                        {formatLeaveDateRange(selectedLeave.fromDate, selectedLeave.toDate)}
                      </span>
                    ),
                  },
                  {
                    id: 'days',
                    label: 'Số ngày nghỉ',
                    value: <span className="qs-numeric">{selectedLeave.days} ngày</span>,
                  },
                  {
                    id: 'approver',
                    label: 'Người duyệt',
                    value: selectedLeave.approverName,
                  },
                  {
                    id: 'createdAt',
                    label: 'Thời gian gửi',
                    value: <span className="qs-numeric">{selectedLeave.createdAtLabel}</span>,
                  },
                  {
                    id: 'status',
                    label: 'Trạng thái',
                    value: (
                      <span className={leaveStatusBadgeClass(selectedLeave.status)}>
                        {selectedLeave.status}
                      </span>
                    ),
                  },
                  ...(selectedLeave.reviewedByName
                    ? [
                        {
                          id: 'reviewedBy',
                          label: 'Người xử lý',
                          value: selectedLeave.reviewedByName,
                        },
                        {
                          id: 'reviewedAt',
                          label: 'Thời gian xử lý',
                          value: (
                            <span className="qs-numeric">
                              {selectedLeave.reviewedAtLabel ?? '—'}
                            </span>
                          ),
                        },
                      ]
                    : []),
                ]}
              />

              <div className="hr-drawer-note-box">
                <h3>Lý do xin nghỉ phép</h3>
                <p>{selectedLeave.reason}</p>
              </div>

              {selectedLeave.status === 'Từ chối' && selectedLeave.rejectionReason ? (
                <div className="hr-drawer-note-box hr-drawer-note-box--danger">
                  <h3>Lý do từ chối</h3>
                  <p>{selectedLeave.rejectionReason}</p>
                </div>
              ) : null}

              {selectedLeave.status === 'Đã duyệt' ? (
                <div className="hr-drawer-note-box hr-drawer-note-box--success">
                  <h3>Kết quả đồng bộ</h3>
                  <p>
                    Đã cập nhật trạng thái Nghỉ phép trên bảng chấm công cho{' '}
                    <span className="qs-numeric">
                      {formatLeaveDateRange(selectedLeave.fromDate, selectedLeave.toDate)}
                    </span>
                    .
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </ResponsiveDetailDrawer>
      </div>

      <CreateLeaveModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        me={me}
        users={users}
        remainingAnnualDays={myBalance.remainingDays}
        onSubmit={onCreateLeave}
      />

      <Modal
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectionReason('');
            setRejectionError(null);
          }
        }}
      >
        {rejectTarget ? (
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Từ chối đơn {rejectTarget.code}</ModalTitle>
              <ModalDescription>
                Nhân sự: {rejectTarget.employeeName} ·{' '}
                <span className="qs-numeric">
                  {formatLeaveDateRange(rejectTarget.fromDate, rejectTarget.toDate)} ({rejectTarget.days} ngày)
                </span>
              </ModalDescription>
            </ModalHeader>
            <form onSubmit={handleConfirmReject} noValidate>
              <div className="hr-field">
                <label htmlFor="leave-reject-reason">Lý do từ chối *</label>
                <textarea
                  id="leave-reject-reason"
                  className="hr-input hr-textarea"
                  rows={3}
                  value={rejectionReason}
                  onChange={(event) => {
                    setRejectionReason(event.target.value);
                    if (rejectionError) setRejectionError(null);
                  }}
                  placeholder="Nhập lý do từ chối để nhân sự nắm rõ và sắp xếp lại lịch"
                  aria-invalid={Boolean(rejectionError)}
                />
                {rejectionError ? (
                  <p className="hr-error" role="alert">
                    {rejectionError}
                  </p>
                ) : null}
              </div>

              <ModalFooter>
                <button
                  type="button"
                  className="qx-btn"
                  onClick={() => setRejectTarget(null)}
                >
                  Hủy
                </button>
                <button type="submit" className="qx-btn hr-btn-reject-solid">
                  Xác nhận từ chối
                </button>
              </ModalFooter>
            </form>
          </ModalContent>
        ) : null}
      </Modal>
    </section>
  );
}
