'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Select,
  type SelectOption,
} from '@qsystem/ui';
import type { MeResponse } from '@qsystem/contracts';
import { formatDdMmYyyy, getLocalDateIso } from '../../lib/date';
import { formatRole } from '../../lib/adapters/notifications.adapter';
import { countInclusiveDays } from './qhrm.storage';
import type { LeaveType, OrgUser } from './qhrm.types';

const LEAVE_TYPE_OPTIONS: readonly SelectOption<LeaveType>[] = [
  { value: 'Phép năm', label: 'Phép năm', description: 'Trừ vào quỹ ngày phép năm' },
  { value: 'Nghỉ ốm', label: 'Nghỉ ốm', description: 'Nghỉ hưởng chế độ hoặc ốm đau' },
  { value: 'Việc riêng', label: 'Việc riêng', description: 'Giải quyết công việc cá nhân' },
  { value: 'Nghỉ bù', label: 'Nghỉ bù', description: 'Bù giờ làm thêm / trực ca' },
];

export interface CreateLeaveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  me: MeResponse;
  users: OrgUser[];
  remainingAnnualDays: number;
  onSubmit: (payload: {
    type: LeaveType;
    fromDate: string;
    toDate: string;
    days: number;
    reason: string;
    approverId: string | null;
    approverName: string;
  }) => void;
}

function CreateLeaveDialogBody({
  onOpenChange,
  me,
  users,
  remainingAnnualDays,
  onSubmit,
}: Omit<CreateLeaveModalProps, 'open'>) {
  const todayIso = getLocalDateIso();

  const approverChoices = React.useMemo(() => {
    const candidates = users.filter(
      (u) => (u.role === 'DIRECTOR' || u.role === 'MANAGER') && u.id !== me.id,
    );
    if (candidates.length > 0) return candidates;
    return users.filter((u) => u.role === 'DIRECTOR' || u.role === 'MANAGER');
  }, [users, me.id]);

  const currentOrgUser = users.find((u) => u.id === me.id);
  const defaultApproverId = React.useMemo(() => {
    if (
      currentOrgUser?.reportsToId &&
      approverChoices.some((c) => c.id === currentOrgUser.reportsToId)
    ) {
      return currentOrgUser.reportsToId;
    }
    return approverChoices[0]?.id ?? '';
  }, [approverChoices, currentOrgUser?.reportsToId]);

  const approverOptions = React.useMemo<SelectOption<string>[]>(() => {
    if (approverChoices.length === 0) {
      return [{ value: '', label: 'Quản lý trực tiếp' }];
    }
    return approverChoices.map((person) => ({
      value: person.id,
      label: person.name,
      description: formatRole(person.role),
    }));
  }, [approverChoices]);

  const [type, setType] = React.useState<LeaveType>('Phép năm');
  const [approverId, setApproverId] = React.useState<string>(defaultApproverId);
  const [fromDate, setFromDate] = React.useState<string>(todayIso);
  const [toDate, setToDate] = React.useState<string>(todayIso);
  const [reason, setReason] = React.useState('');
  const [errors, setErrors] = React.useState<{
    dates?: string;
    reason?: string;
    balance?: string;
  }>({});

  const computedDays = countInclusiveDays(fromDate, toDate);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!fromDate || !toDate || computedDays <= 0) {
      nextErrors.dates = 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.';
    }
    if (!reason.trim()) {
      nextErrors.reason = 'Vui lòng nhập lý do xin nghỉ phép.';
    }
    if (type === 'Phép năm' && computedDays > remainingAnnualDays) {
      nextErrors.balance = `Số ngày phép năm (${computedDays} ngày) vượt quá số ngày phép còn lại (${remainingAnnualDays} ngày).`;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const chosen = approverChoices.find((c) => c.id === approverId);
    onSubmit({
      type,
      fromDate,
      toDate,
      days: computedDays,
      reason: reason.trim(),
      approverId: chosen?.id ?? null,
      approverName: chosen?.name ?? 'Quản lý trực tiếp',
    });
    onOpenChange(false);
  }

  return (
    <ModalContent>
      <ModalHeader>
        <ModalTitle>Gửi đơn nghỉ phép</ModalTitle>
        <ModalDescription>
          Đơn sẽ được gửi tới người duyệt và cập nhật ngay vào quỹ phép chờ duyệt
        </ModalDescription>
      </ModalHeader>

      <form onSubmit={handleSubmit} noValidate>
        <div className="hr-leave-form-grid">
          <div className="hr-field">
            <label id="leave-type-label" htmlFor="leave-type">
              Loại phép *
            </label>
            <Select
              id="leave-type"
              aria-labelledby="leave-type-label"
              value={type}
              onValueChange={(value) => {
                setType(value as LeaveType);
                setErrors((prev) => ({ ...prev, balance: undefined }));
              }}
              options={LEAVE_TYPE_OPTIONS}
              controlSize="md"
            />
          </div>

          <div className="hr-field">
            <label id="leave-approver-label" htmlFor="leave-approver">
              Người duyệt *
            </label>
            <Select
              id="leave-approver"
              aria-labelledby="leave-approver-label"
              value={approverId}
              onValueChange={setApproverId}
              options={approverOptions}
              controlSize="md"
            />
          </div>

          <div className="hr-field">
            <label htmlFor="leave-from-date">Từ ngày *</label>
            <input
              id="leave-from-date"
              type="date"
              className="hr-input"
              value={fromDate}
              onChange={(event) => {
                const nextFrom = event.target.value;
                setFromDate(nextFrom);
                if (toDate < nextFrom) setToDate(nextFrom);
                setErrors((prev) => ({ ...prev, dates: undefined, balance: undefined }));
              }}
            />
          </div>

          <div className="hr-field">
            <label htmlFor="leave-to-date">Đến ngày *</label>
            <input
              id="leave-to-date"
              type="date"
              className="hr-input"
              value={toDate}
              min={fromDate}
              onChange={(event) => {
                setToDate(event.target.value);
                setErrors((prev) => ({ ...prev, dates: undefined, balance: undefined }));
              }}
            />
          </div>

          {errors.dates ? (
            <p className="hr-error hr-field--full" role="alert">
              {errors.dates}
            </p>
          ) : null}

          <div className="hr-leave-summary hr-field--full">
            <div>
              <span>Số ngày nghỉ dự kiến: </span>
              <strong className="qs-numeric">{computedDays} ngày</strong>
              {computedDays > 0 ? (
                <span className="hr-leave-summary__range qs-numeric">
                  {' '}
                  ({formatDdMmYyyy(fromDate)}
                  {fromDate !== toDate ? ` – ${formatDdMmYyyy(toDate)}` : ''})
                </span>
              ) : null}
            </div>
            <div className="hr-leave-summary__balance qs-numeric">
              {type === 'Phép năm'
                ? `Phép năm còn lại: ${remainingAnnualDays} ngày`
                : 'Loại phép này không trừ vào quỹ phép năm'}
            </div>
          </div>

          {errors.balance ? (
            <p className="hr-error hr-field--full" role="alert">
              {errors.balance}
            </p>
          ) : null}

          <div className="hr-field hr-field--full">
            <label htmlFor="leave-reason">Lý do nghỉ phép *</label>
            <textarea
              id="leave-reason"
              className="hr-input hr-textarea"
              rows={3}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                if (errors.reason) setErrors((prev) => ({ ...prev, reason: undefined }));
              }}
              placeholder="Ví dụ: Nghỉ phép năm giải quyết việc gia đình"
              aria-invalid={Boolean(errors.reason)}
            />
            {errors.reason ? (
              <p className="hr-error" role="alert">
                {errors.reason}
              </p>
            ) : null}
          </div>
        </div>

        <ModalFooter>
          <button
            type="button"
            className="qx-btn"
            onClick={() => onOpenChange(false)}
          >
            Hủy
          </button>
          <button type="submit" className="qx-btn qx-btn--primary">
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            Gửi đơn nghỉ phép
          </button>
        </ModalFooter>
      </form>
    </ModalContent>
  );
}

export function CreateLeaveModal({
  open,
  onOpenChange,
  me,
  users,
  remainingAnnualDays,
  onSubmit,
}: CreateLeaveModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      {open ? (
        <CreateLeaveDialogBody
          onOpenChange={onOpenChange}
          me={me}
          users={users}
          remainingAnnualDays={remainingAnnualDays}
          onSubmit={onSubmit}
        />
      ) : null}
    </Modal>
  );
}
