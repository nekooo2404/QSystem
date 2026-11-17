'use client';

import * as React from 'react';
import {
  Download,
  LogIn,
  LogOut,
  Search,
} from 'lucide-react';
import {
  AttributeRowList,
  ResponsiveDetailDrawer,
  Select,
  toast,
  type SelectOption,
} from '@qsystem/ui';
import type { MeResponse } from '@qsystem/contracts';
import { addLocalDaysIso, formatDdMmYyyy, getLocalDateIso } from '../../lib/date';
import {
  SHIFT_END_HM,
  SHIFT_START_HM,
  computeWorkedHours,
  deriveAttendanceStatus,
  formatDateTimeLabel,
  formatWorkedHours,
  formatWorkedHoursSum,
} from './qhrm.storage';
import type { AttendanceRecord, AttendanceStatus, Department, OrgUser } from './qhrm.types';

type PeriodFilter = 'today' | 'yesterday' | 'week' | 'all';

const STATUS_OPTIONS: readonly SelectOption<string>[] = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'Đúng giờ', label: 'Đúng giờ' },
  { value: 'Đi muộn', label: 'Đi muộn' },
  { value: 'Về sớm', label: 'Về sớm' },
  { value: 'Nghỉ phép', label: 'Nghỉ phép' },
  { value: 'Chưa chấm công', label: 'Chưa chấm công' },
];

const EDITABLE_STATUS_OPTIONS: readonly SelectOption<AttendanceStatus>[] = [
  { value: 'Đúng giờ', label: 'Đúng giờ' },
  { value: 'Đi muộn', label: 'Đi muộn' },
  { value: 'Về sớm', label: 'Về sớm' },
  { value: 'Nghỉ phép', label: 'Nghỉ phép' },
  { value: 'Chưa chấm công', label: 'Chưa chấm công' },
];

function statusBadgeClass(status: AttendanceStatus): string {
  switch (status) {
    case 'Đúng giờ':
      return 'qx-badge qx-badge--green';
    case 'Đi muộn':
      return 'qx-badge qx-badge--red';
    case 'Về sớm':
      return 'qx-badge qx-badge--amber';
    case 'Nghỉ phép':
      return 'qx-badge qx-badge--blue';
    default:
      return 'qx-badge hr-badge--muted';
  }
}

function csvEscape(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export interface QhrmAttendanceProps {
  me: MeResponse;
  users: OrgUser[];
  departments: Department[];
  records: AttendanceRecord[];
  onCheckIn: () => void;
  onCheckOut: () => void;
  onUpdateRecord: (
    recordId: string,
    patch: {
      checkIn: string | null;
      checkOut: string | null;
      status: AttendanceStatus;
      note: string;
    },
  ) => void;
}

export function QhrmAttendance({
  me,
  users,
  departments,
  records,
  onCheckIn,
  onCheckOut,
  onUpdateRecord,
}: QhrmAttendanceProps) {
  const todayIso = getLocalDateIso();
  const yesterdayIso = addLocalDaysIso(-1);
  const weekStartIso = addLocalDaysIso(-6);

  const [period, setPeriod] = React.useState<PeriodFilter>('today');
  const [deptFilter, setDeptFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [search, setSearch] = React.useState('');
  const [selectedRecordId, setSelectedRecordId] = React.useState<string | null>(null);

  const canManage = me.role === 'DIRECTOR' || me.role === 'MANAGER';
  const myTodayRecord = records.find((r) => r.employeeId === me.id && r.dateIso === todayIso) ?? null;

  const periodOptions = React.useMemo<SelectOption<PeriodFilter>[]>(
    () => [
      { value: 'today', label: `Hôm nay (${formatDdMmYyyy(todayIso)})` },
      { value: 'yesterday', label: `Hôm qua (${formatDdMmYyyy(yesterdayIso)})` },
      { value: 'week', label: '7 ngày gần nhất' },
      { value: 'all', label: 'Tất cả ngày công' },
    ],
    [todayIso, yesterdayIso],
  );

  const deptOptions = React.useMemo<SelectOption<string>[]>(
    () => [
      { value: 'all', label: 'Tất cả phòng ban' },
      ...departments.map((dept) => ({ value: dept.id, label: dept.name })),
    ],
    [departments],
  );

  const periodRecords = React.useMemo(() => {
    return records.filter((rec) => {
      if (period === 'today') return rec.dateIso === todayIso;
      if (period === 'yesterday') return rec.dateIso === yesterdayIso;
      if (period === 'week') return rec.dateIso >= weekStartIso && rec.dateIso <= todayIso;
      return true;
    });
  }, [records, period, todayIso, yesterdayIso, weekStartIso]);

  const filteredRecords = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return periodRecords.filter((rec) => {
      if (deptFilter !== 'all' && rec.departmentId !== deptFilter) return false;
      if (statusFilter !== 'all' && rec.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        rec.employeeCode.toLowerCase().includes(needle) ||
        rec.employeeName.toLowerCase().includes(needle) ||
        rec.departmentName.toLowerCase().includes(needle) ||
        rec.note.toLowerCase().includes(needle)
      );
    });
  }, [periodRecords, deptFilter, statusFilter, search]);

  // KPI metrics reflect the selected period + department scope
  const kpiScopeRecords = React.useMemo(() => {
    if (deptFilter === 'all') return periodRecords;
    return periodRecords.filter((r) => r.departmentId === deptFilter);
  }, [periodRecords, deptFilter]);

  const onTimeCount = kpiScopeRecords.filter((r) => r.status === 'Đúng giờ').length;
  const lateCount = kpiScopeRecords.filter((r) => r.status === 'Đi muộn').length;
  const leaveCount = kpiScopeRecords.filter((r) => r.status === 'Nghỉ phép').length;
  const unrecordedCount = kpiScopeRecords.filter((r) => r.status === 'Chưa chấm công').length;
  const totalHours = kpiScopeRecords.reduce((sum, r) => sum + (r.workedHours || 0), 0);

  const selectedRecord = selectedRecordId
    ? (records.find((r) => r.id === selectedRecordId) ?? null)
    : null;

  const [draftCheckIn, setDraftCheckIn] = React.useState('');
  const [draftCheckOut, setDraftCheckOut] = React.useState('');
  const [draftStatus, setDraftStatus] = React.useState<AttendanceStatus>('Đúng giờ');
  const [draftNote, setDraftNote] = React.useState('');

  React.useEffect(() => {
    if (!selectedRecord) return;
    setDraftCheckIn(selectedRecord.checkIn ?? '');
    setDraftCheckOut(selectedRecord.checkOut ?? '');
    setDraftStatus(selectedRecord.status);
    setDraftNote(selectedRecord.note);
  }, [selectedRecord]);

  function handleSaveAdjustment(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedRecord) return;
    const normalizedIn = draftCheckIn.trim() ? draftCheckIn.trim() : null;
    const normalizedOut = draftCheckOut.trim() ? draftCheckOut.trim() : null;
    const nextStatus = canManage
      ? draftStatus
      : selectedRecord.status;
    onUpdateRecord(selectedRecord.id, {
      checkIn: canManage ? normalizedIn : selectedRecord.checkIn,
      checkOut: canManage ? normalizedOut : selectedRecord.checkOut,
      status: nextStatus,
      note: draftNote.trim(),
    });
    toast.success(`Đã cập nhật chấm công của ${selectedRecord.employeeName}`);
  }

  function handleExportCsv() {
    const headers = [
      'Mã NV',
      'Nhân sự',
      'Phòng ban',
      'Ngày',
      'Giờ vào',
      'Giờ ra',
      'Tổng giờ',
      'Trạng thái',
      'Ghi chú',
    ];
    const lines = [
      headers.map(csvEscape).join(','),
      ...filteredRecords.map((row) =>
        [
          row.employeeCode,
          row.employeeName,
          row.departmentName,
          formatDdMmYyyy(row.dateIso),
          row.checkIn ?? '—',
          row.checkOut ?? '—',
          formatWorkedHours(row.workedHours),
          row.status,
          row.note || '—',
        ]
          .map(csvEscape)
          .join(','),
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cham-cong-${todayIso}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success('Đã xuất bảng chấm công.');
  }

  const currentEmployeeObj = users.find((u) => u.id === me.id);
  const myDeptName =
    departments.find((d) => d.id === (currentEmployeeObj?.departmentId ?? me.departmentId))?.name ??
    'Toàn công ty';

  const hasCheckedIn = Boolean(myTodayRecord?.checkIn);
  const hasCheckedOut = Boolean(myTodayRecord?.checkOut);
  const isOnLeaveToday = myTodayRecord?.status === 'Nghỉ phép';

  return (
    <section className="qx-page" aria-label="Chấm công">
      <header className="qx-page-head">
        <div>
          <h1>Chấm công</h1>
          <p>
            Theo dõi giờ vào/ra, tổng giờ công và trạng thái làm việc theo giờ địa phương (
            <span className="qs-numeric">{formatDdMmYyyy(todayIso)}</span>)
          </p>
        </div>
        <div className="qx-actions">
          <button type="button" className="qx-btn" onClick={handleExportCsv}>
            <Download size={16} strokeWidth={1.5} aria-hidden="true" />
            Xuất bảng công
          </button>
        </div>
      </header>

      <section className="qx-card hr-checkin-card" aria-label="Chấm công cá nhân hôm nay">
        <div className="hr-checkin-card__info">
          <div className="hr-checkin-card__title-row">
            <h2>Chấm công của bạn hôm nay</h2>
            <span className={statusBadgeClass(myTodayRecord?.status ?? 'Chưa chấm công')}>
              {myTodayRecord?.status ?? 'Chưa chấm công'}
            </span>
          </div>
          <p className="hr-checkin-card__meta">
            {me.name} · {myDeptName} · Ca hành chính ({SHIFT_START_HM} – {SHIFT_END_HM}) · Ngày{' '}
            <span className="qs-numeric">{formatDdMmYyyy(todayIso)}</span>
          </p>
        </div>

        <div className="hr-checkin-card__metrics">
          <div className="hr-checkin-metric">
            <span className="hr-checkin-metric__label">Giờ vào</span>
            <strong className="hr-checkin-metric__val qs-numeric">
              {myTodayRecord?.checkIn ?? '—'}
            </strong>
          </div>
          <div className="hr-checkin-metric">
            <span className="hr-checkin-metric__label">Giờ ra</span>
            <strong className="hr-checkin-metric__val qs-numeric">
              {myTodayRecord?.checkOut ?? '—'}
            </strong>
          </div>
          <div className="hr-checkin-metric">
            <span className="hr-checkin-metric__label">Tổng giờ</span>
            <strong className="hr-checkin-metric__val qs-numeric">
              {myTodayRecord && myTodayRecord.workedHours > 0
                ? formatWorkedHours(myTodayRecord.workedHours)
                : '—'}
            </strong>
          </div>
        </div>

        <div className="hr-checkin-card__action">
          {isOnLeaveToday ? (
            <span className="hr-checkin-note">Đang nghỉ phép theo đơn đã duyệt</span>
          ) : !hasCheckedIn ? (
            <button type="button" className="qx-btn qx-btn--primary" onClick={onCheckIn}>
              <LogIn size={16} strokeWidth={1.5} aria-hidden="true" />
              Chấm công vào ca
            </button>
          ) : !hasCheckedOut ? (
            <button type="button" className="qx-btn qx-btn--primary" onClick={onCheckOut}>
              <LogOut size={16} strokeWidth={1.5} aria-hidden="true" />
              Chấm công ra ca
            </button>
          ) : (
            <button
              type="button"
              className="qx-btn"
              onClick={() => {
                if (myTodayRecord) setSelectedRecordId(myTodayRecord.id);
              }}
            >
              Đã hoàn thành ca · Ghi chú
            </button>
          )}
        </div>
      </section>

      <div className="qx-stats hr-stats--five" aria-label="Thống kê chấm công">
        <article className="qx-stat">
          <div className="qx-stat__label">Đúng giờ</div>
          <div className="qx-stat__value">
            <span className="qs-numeric">{onTimeCount}</span>
          </div>
          <div className="qx-stat__note qs-numeric">Vào ca trước {SHIFT_START_HM}</div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Đi muộn</div>
          <div className="qx-stat__value">
            <span className="qs-numeric">{lateCount}</span>
          </div>
          <div className="qx-stat__note qs-numeric">Ghi nhận sau {SHIFT_START_HM}</div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Đang nghỉ phép</div>
          <div className="qx-stat__value">
            <span className="qs-numeric">{leaveCount}</span>
          </div>
          <div className="qx-stat__note">Đồng bộ từ đơn đã duyệt</div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Chưa chấm công</div>
          <div className="qx-stat__value">
            <span className="qs-numeric">{unrecordedCount}</span>
          </div>
          <div className="qx-stat__note">Chưa ghi nhận giờ vào</div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Tổng giờ công</div>
          <div className="qx-stat__value">
            <span className="qs-numeric">{formatWorkedHoursSum(totalHours)}</span>
          </div>
          <div className="qx-stat__note">Trong kỳ đang chọn</div>
        </article>
      </div>

      <div className="hr-split-layout">
        <div className="qx-card hr-list hr-split-layout__main">
          <div className="qx-card__head hr-att-toolbar">
            <h2 className="qx-card__title">Bảng chấm công</h2>
            <div className="hr-att-filters">
              <div className="hr-att-filter">
                <Select
                  id="att-period-filter"
                  aria-label="Chọn ngày hoặc kỳ chấm công"
                  controlSize="sm"
                  value={period}
                  onValueChange={(value) => setPeriod(value as PeriodFilter)}
                  options={periodOptions}
                />
              </div>
              <div className="hr-att-filter">
                <Select
                  id="att-dept-filter"
                  aria-label="Lọc theo phòng ban"
                  controlSize="sm"
                  value={deptFilter}
                  onValueChange={setDeptFilter}
                  options={deptOptions}
                />
              </div>
              <div className="hr-att-filter">
                <Select
                  id="att-status-filter"
                  aria-label="Lọc theo trạng thái chấm công"
                  controlSize="sm"
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                  options={STATUS_OPTIONS}
                />
              </div>
              <label className="qx-field-search">
                <Search size={16} strokeWidth={1.5} aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm mã NV, nhân sự"
                  aria-label="Tìm nhân sự chấm công"
                />
              </label>
            </div>
          </div>

          <div className="hr-table-wrap">
            {filteredRecords.length === 0 ? (
              <div className="hr-empty">
                Không có dữ liệu chấm công khớp với bộ lọc hiện tại
              </div>
            ) : (
              <table className="qx-table" aria-label="Bảng chấm công nhân sự">
                <thead>
                  <tr>
                    <th scope="col">Mã NV</th>
                    <th scope="col">Nhân sự</th>
                    <th scope="col">Phòng ban</th>
                    <th scope="col">Ngày</th>
                    <th scope="col">Giờ vào</th>
                    <th scope="col">Giờ ra</th>
                    <th scope="col">Tổng giờ</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((row) => {
                    const selected = row.id === selectedRecordId;
                    return (
                      <tr
                        key={row.id}
                        className="is-clickable"
                        aria-selected={selected ? 'true' : undefined}
                        tabIndex={0}
                        onClick={() => setSelectedRecordId(row.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedRecordId(row.id);
                          }
                        }}
                      >
                        <td className="qs-numeric hr-code-cell">{row.employeeCode}</td>
                        <td>
                          <div className="hr-person__text">
                            <span className="hr-person__name">{row.employeeName}</span>
                            <span className="hr-person__mail">{row.employeeEmail}</span>
                          </div>
                        </td>
                        <td>{row.departmentName}</td>
                        <td className="qs-numeric">{formatDdMmYyyy(row.dateIso)}</td>
                        <td className="qs-numeric">{row.checkIn ?? '—'}</td>
                        <td className="qs-numeric">{row.checkOut ?? '—'}</td>
                        <td className="qs-numeric">{formatWorkedHours(row.workedHours)}</td>
                        <td>
                          <span className={statusBadgeClass(row.status)}>{row.status}</span>
                        </td>
                        <td className="hr-note-cell">{row.note || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="qx-card__foot hr-foot">
            <span>
              Hiển thị <strong className="qs-numeric">{filteredRecords.length}</strong> bản ghi chấm công
            </span>
            <span className="hr-foot__hint">Chọn một dòng để xem nhật ký vào/ra và ghi chú</span>
          </div>
        </div>

        <ResponsiveDetailDrawer
          open={Boolean(selectedRecord)}
          onClose={() => setSelectedRecordId(null)}
          title={selectedRecord?.employeeName ?? ''}
          subtitle={
            selectedRecord
              ? `${selectedRecord.employeeCode} · ${selectedRecord.departmentName}`
              : undefined
          }
        >
          {selectedRecord ? (
            <div className="hr-drawer-stack">
              <AttributeRowList
                items={[
                  {
                    id: 'date',
                    label: 'Ngày làm việc',
                    value: (
                      <span className="qs-numeric">{formatDdMmYyyy(selectedRecord.dateIso)}</span>
                    ),
                  },
                  {
                    id: 'shift',
                    label: 'Lịch ca tiêu chuẩn',
                    value: (
                      <span className="qs-numeric">
                        {SHIFT_START_HM} – {SHIFT_END_HM}
                      </span>
                    ),
                  },
                  {
                    id: 'checkIn',
                    label: 'Giờ vào',
                    value: (
                      <span className="qs-numeric">
                        {selectedRecord.checkIn ?? 'Chưa ghi nhận'}
                      </span>
                    ),
                  },
                  {
                    id: 'checkOut',
                    label: 'Giờ ra',
                    value: (
                      <span className="qs-numeric">
                        {selectedRecord.checkOut ?? 'Chưa ghi nhận'}
                      </span>
                    ),
                  },
                  {
                    id: 'hours',
                    label: 'Tổng giờ công',
                    value: (
                      <span className="qs-numeric">
                        {formatWorkedHours(selectedRecord.workedHours)}
                      </span>
                    ),
                  },
                  {
                    id: 'status',
                    label: 'Trạng thái',
                    value: (
                      <span className={statusBadgeClass(selectedRecord.status)}>
                        {selectedRecord.status}
                      </span>
                    ),
                  },
                ]}
              />

              <form className="hr-drawer-form" onSubmit={handleSaveAdjustment}>
                <h3 className="hr-drawer-section-title">
                  {canManage ? 'Điều chỉnh & ghi chú chấm công' : 'Ghi chú chấm công'}
                </h3>

                {canManage ? (
                  <>
                    <div className="hr-drawer-grid-2">
                      <div className="hr-field">
                        <label htmlFor="att-edit-in">Giờ vào</label>
                        <input
                          id="att-edit-in"
                          type="time"
                          className="hr-input"
                          value={draftCheckIn}
                          onChange={(event) => {
                            const nextIn = event.target.value;
                            setDraftCheckIn(nextIn);
                            setDraftStatus(
                              deriveAttendanceStatus(
                                nextIn || null,
                                draftCheckOut || null,
                              ),
                            );
                          }}
                        />
                      </div>
                      <div className="hr-field">
                        <label htmlFor="att-edit-out">Giờ ra</label>
                        <input
                          id="att-edit-out"
                          type="time"
                          className="hr-input"
                          value={draftCheckOut}
                          onChange={(event) => {
                            const nextOut = event.target.value;
                            setDraftCheckOut(nextOut);
                            setDraftStatus(
                              deriveAttendanceStatus(
                                draftCheckIn || null,
                                nextOut || null,
                              ),
                            );
                          }}
                        />
                      </div>
                    </div>

                    <div className="hr-field">
                      <label id="att-edit-status-label" htmlFor="att-edit-status">
                        Trạng thái chấm công
                      </label>
                      <Select
                        id="att-edit-status"
                        aria-labelledby="att-edit-status-label"
                        value={draftStatus}
                        onValueChange={(value) => setDraftStatus(value as AttendanceStatus)}
                        options={EDITABLE_STATUS_OPTIONS}
                        controlSize="md"
                      />
                    </div>
                  </>
                ) : null}

                <div className="hr-field">
                  <label htmlFor="att-edit-note">Ghi chú</label>
                  <textarea
                    id="att-edit-note"
                    className="hr-input hr-textarea"
                    rows={3}
                    value={draftNote}
                    onChange={(event) => setDraftNote(event.target.value)}
                    placeholder="Nhập lý do đi muộn, về sớm hoặc ghi chú công tác"
                  />
                </div>

                <div className="hr-drawer-actions">
                  <button type="submit" className="qx-btn">
                    Lưu cập nhật
                  </button>
                </div>
              </form>

              <div className="hr-drawer-logs">
                <h3 className="hr-drawer-section-title">Nhật ký vào / ra</h3>
                {selectedRecord.logs.length === 0 ? (
                  <p className="hr-drawer-empty">
                    Chưa có nhật ký chấm công nào cho ngày{' '}
                    <span className="qs-numeric">{formatDdMmYyyy(selectedRecord.dateIso)}</span>.
                  </p>
                ) : (
                  <ul className="hr-log-list">
                    {selectedRecord.logs.map((entry) => (
                      <li key={entry.id} className="hr-log-item">
                        <div className="hr-log-item__action">{entry.action}</div>
                        <div className="hr-log-item__meta qs-numeric">
                          {entry.time || formatDateTimeLabel()} · {entry.actor}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {selectedRecord.checkIn && selectedRecord.checkOut ? (
                <p className="hr-drawer-calc-note qs-numeric">
                  Thời gian làm việc tính toán:{' '}
                  {formatWorkedHours(computeWorkedHours(draftCheckIn || selectedRecord.checkIn, draftCheckOut || selectedRecord.checkOut))}
                </p>
              ) : null}
            </div>
          ) : null}
        </ResponsiveDetailDrawer>
      </div>
    </section>
  );
}
