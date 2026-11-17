'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Clock, Plus } from 'lucide-react';
import { formatDdMmYyyy, getLocalDateIso } from '../../lib/date';
import { formatLeaveDateRange, formatWorkedHoursSum } from './qhrm.storage';
import type { AttendanceRecord, Department, LeaveRequest, OrgUser } from './qhrm.types';

export interface QhrmOverviewProps {
  totalStaffStat: number;
  departments: Department[];
  users: OrgUser[];
  attendance: AttendanceRecord[];
  leaves: LeaveRequest[];
  canManage: boolean;
  isSampleMode: boolean;
  extraDeptCounts: Record<string, number>;
  onCreateUser: () => void;
}

export function QhrmOverview({
  totalStaffStat,
  departments,
  users,
  attendance,
  leaves,
  canManage,
  isSampleMode,
  extraDeptCounts,
  onCreateUser,
}: QhrmOverviewProps) {
  const todayIso = getLocalDateIso();
  const todayRecords = attendance.filter((r) => r.dateIso === todayIso);

  const onTimeToday = todayRecords.filter((r) => r.status === 'Đúng giờ').length;
  const lateToday = todayRecords.filter((r) => r.status === 'Đi muộn').length;
  const earlyToday = todayRecords.filter((r) => r.status === 'Về sớm').length;
  const leaveToday = todayRecords.filter((r) => r.status === 'Nghỉ phép').length;
  const unrecordedToday = todayRecords.filter((r) => r.status === 'Chưa chấm công').length;
  const presentToday = onTimeToday + lateToday + earlyToday;
  const totalHoursToday = todayRecords.reduce((sum, r) => sum + (r.workedHours || 0), 0);

  const pendingLeaves = leaves.filter((l) => l.status === 'Chờ duyệt');
  const approvedLeaves = leaves.filter((l) => l.status === 'Đã duyệt');

  const totalAttBase = Math.max(1, todayRecords.length);
  const attBreakdown = [
    { label: 'Đúng giờ', count: onTimeToday, tone: 'brand' },
    { label: 'Đi muộn', count: lateToday, tone: 'amber' },
    { label: 'Về sớm', count: earlyToday, tone: 'amber' },
    { label: 'Nghỉ phép', count: leaveToday, tone: 'muted' },
    { label: 'Chưa chấm công', count: unrecordedToday, tone: 'muted' },
  ];

  const deptBreakdown = departments.map((dept) => {
    const count =
      isSampleMode && typeof dept.sampleCount === 'number'
        ? Math.max(0, dept.sampleCount + (extraDeptCounts[dept.id] ?? 0))
        : users.filter((u) => u.departmentId === dept.id).length;
    return { id: dept.id, name: dept.name, count };
  });
  const maxDeptCount = Math.max(1, ...deptBreakdown.map((d) => d.count));

  return (
    <section className="qx-page" aria-label="Tổng quan nhân sự">
      <header className="qx-page-head">
        <div>
          <h1>Tổng quan nhân sự</h1>
          <p>
            Chỉ số nhân sự, chấm công hôm nay (
            <span className="qs-numeric">{formatDdMmYyyy(todayIso)}</span>) và đơn nghỉ phép chờ xử lý
          </p>
        </div>
        <div className="qx-actions">
          <Link href="/org" className="qx-btn">
            Danh bạ nhân sự
            <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
          </Link>
          {canManage ? (
            <button type="button" className="qx-btn qx-btn--primary" onClick={onCreateUser}>
              <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
              Thêm nhân sự
            </button>
          ) : (
            <Link href="/org?muc=cham-cong" className="qx-btn qx-btn--primary">
              <Clock size={16} strokeWidth={1.5} aria-hidden="true" />
              Chấm công hôm nay
            </Link>
          )}
        </div>
      </header>

      <div className="qx-stats" aria-label="Chỉ số tổng quan nhân sự">
        <article className="qx-stat">
          <div className="qx-stat__label">Tổng nhân sự</div>
          <div className="qx-stat__value">
            <span className="qs-numeric">{totalStaffStat}</span>
          </div>
          <div className="qx-stat__note qs-numeric">
            Trên {departments.length} phòng ban đang hoạt động
          </div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Hiện diện hôm nay</div>
          <div className="qx-stat__value">
            <span className="qs-numeric">{presentToday}</span>
          </div>
          <div className="qx-stat__note qs-numeric">
            Tổng {formatWorkedHoursSum(totalHoursToday)} đã ghi nhận
          </div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Đang nghỉ phép</div>
          <div className="qx-stat__value">
            <span className="qs-numeric">{leaveToday}</span>
          </div>
          <div className="qx-stat__note qs-numeric">
            {approvedLeaves.length} đơn phép đã duyệt trong kỳ
          </div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Đơn phép chờ duyệt</div>
          <div className="qx-stat__value">
            <span className="qs-numeric">{pendingLeaves.length}</span>
          </div>
          <div className="qx-stat__note">Cần quản lý xem xét phê duyệt</div>
        </article>
      </div>

      <div className="hr-overview-grid">
        <article className="qx-card hr-overview-card hr-overview-card--primary">
          <div className="hr-overview-card__head">
            <div>
              <h2>Chấm công hôm nay</h2>
              <p className="qs-numeric">
                Phân bổ trên {todayRecords.length} nhân sự theo giờ địa phương ({formatDdMmYyyy(todayIso)})
              </p>
            </div>
            <Link href="/org?muc=cham-cong" className="hr-overview-link">
              Mở chấm công
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>
          <div className="hr-overview-bars">
            {attBreakdown.map((item) => {
              const pct = Math.round((item.count / totalAttBase) * 100);
              return (
                <div key={item.label} className="hr-overview-bar-row">
                  <div className="hr-overview-bar-meta">
                    <span>{item.label}</span>
                    <span className="qs-numeric">
                      {item.count} ({pct}%)
                    </span>
                  </div>
                  <div className="hr-progress-track">
                    <div
                      className={`hr-progress-fill hr-progress-fill--${item.tone}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="qx-card hr-overview-card">
          <div className="hr-overview-card__head">
            <div>
              <h2>Đơn nghỉ phép chờ duyệt</h2>
              <p>Các đơn mới gửi đang chờ phản hồi phê duyệt</p>
            </div>
            <Link href="/org?muc=nghi-phep" className="hr-overview-link">
              Xử lý đơn phép
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>
          {pendingLeaves.length === 0 ? (
            <p className="hr-overview-empty">Không có đơn nghỉ phép nào đang chờ duyệt</p>
          ) : (
            <ul className="hr-overview-list">
              {pendingLeaves.slice(0, 5).map((item) => (
                <li key={item.id} className="hr-overview-list-item">
                  <div className="hr-overview-list-item__main">
                    <div className="hr-overview-list-item__title">
                      <span className="qs-numeric">{item.code}</span> · {item.employeeName}
                    </div>
                    <div className="hr-overview-list-item__sub qs-numeric">
                      {item.type} · {formatLeaveDateRange(item.fromDate, item.toDate)} ({item.days} ngày)
                    </div>
                  </div>
                  <span className="qx-badge qx-badge--amber">{item.status}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="qx-card hr-overview-card hr-overview-card--wide">
          <div className="hr-overview-card__head">
            <div>
              <h2>Cơ cấu nhân sự theo phòng ban</h2>
              <p>Phân bổ nhân sự hiện tại trên toàn công ty</p>
            </div>
            <Link href="/org?muc=phong-ban" className="hr-overview-link">
              Xem phòng ban
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>
          <div className="hr-overview-bars hr-overview-bars--grid">
            {deptBreakdown.map((dept) => {
              const pct = Math.round((dept.count / maxDeptCount) * 100);
              return (
                <div key={dept.id} className="hr-overview-bar-row">
                  <div className="hr-overview-bar-meta">
                    <span>{dept.name}</span>
                    <span className="qs-numeric">{dept.count} nhân sự</span>
                  </div>
                  <div className="hr-progress-track">
                    <div
                      className="hr-progress-fill hr-progress-fill--brand"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </div>
    </section>
  );
}
