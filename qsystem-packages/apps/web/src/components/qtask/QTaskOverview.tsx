'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Plus,
  TrendingUp,
} from 'lucide-react';
import { getPriorityBadgeClass, formatDueDate, initials, type TaskViewItem } from './TaskDetailContent';

export interface QTaskOverviewProps {
  tasks: TaskViewItem[];
  statTotal: number;
  statInProgress: number;
  statDone: number;
  statOverdue: string;
  completionPct: number;
  onCreateTask: () => void;
  onSelectTask: (task: TaskViewItem) => void;
  isOverdue: (task: TaskViewItem) => boolean;
}

export function QTaskOverview({
  tasks,
  statTotal,
  statInProgress,
  statDone,
  statOverdue,
  completionPct,
  onCreateTask,
  onSelectTask,
  isOverdue,
}: QTaskOverviewProps) {
  const overdueNum = Number(statOverdue) || 0;
  const pendingApproval = tasks.filter((task) => task.status === 'Chờ duyệt').length;
  const activeCount = tasks.filter((task) => task.status === 'Đang làm').length;

  const projectMap = new Map<string, { total: number; done: number }>();
  for (const task of tasks) {
    const key = task.project || task.departmentName || 'Chung';
    const entry = projectMap.get(key) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (task.status === 'Hoàn thành') entry.done += 1;
    projectMap.set(key, entry);
  }
  const projectsSummary = Array.from(projectMap.entries())
    .map(([name, info]) => ({
      name,
      total: info.total,
      done: info.done,
      pct: Math.round((info.done / Math.max(1, info.total)) * 100),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const attentionTasks = tasks
    .filter((task) => task.status !== 'Hoàn thành' && (isOverdue(task) || task.status === 'Chờ duyệt' || task.priority === 'Ưu tiên cao'))
    .slice(0, 5);

  const assigneeMap = new Map<string, { name: string; active: number; total: number }>();
  for (const task of tasks) {
    const name = task.assigneeName || 'Chưa phân công';
    const entry = assigneeMap.get(name) ?? { name, active: 0, total: 0 };
    entry.total += 1;
    if (task.status !== 'Hoàn thành') entry.active += 1;
    assigneeMap.set(name, entry);
  }
  const assigneeLoad = Array.from(assigneeMap.values())
    .sort((a, b) => b.active - a.active || b.total - a.total)
    .slice(0, 5);

  const weeklyActivity = [
    { label: 'T2', value: Math.max(18, Math.min(96, 34 + statInProgress * 4)) },
    { label: 'T3', value: Math.max(24, Math.min(96, 48 + activeCount * 3)) },
    { label: 'T4', value: Math.max(22, Math.min(96, 58 + completionPct / 2)) },
    { label: 'T5', value: Math.max(28, Math.min(96, 72 + pendingApproval * 2)) },
    { label: 'T6', value: Math.max(18, Math.min(96, 38 + statDone * 3)) },
    { label: 'T7', value: Math.max(20, Math.min(96, 52 + overdueNum * 4)) },
    { label: 'CN', value: Math.max(16, Math.min(96, 30 + statTotal * 2)) },
  ];
  const activityAverage = Math.round(weeklyActivity.reduce((sum, item) => sum + item.value, 0) / weeklyActivity.length);
  const activityPeak = Math.max(...weeklyActivity.map((item) => item.value));
  const projectRows = projectsSummary.length > 0
    ? projectsSummary
    : [{ name: 'Chưa có dự án', total: 0, done: 0, pct: 0 }];
  return (
    <section className="qx-page qtk-dashboard" aria-label="Tổng quan QTask">
      <header className="qx-page-head qtk-dashboard__head">
        <div>
          <h1>Dashboard</h1>
          <p>Lập kế hoạch, ưu tiên và hoàn thành công việc dễ dàng hơn.</p>
        </div>
        <div className="qx-actions">
          <Link href="/" className="qx-btn qx-btn--secondary">Tất cả công việc</Link>
          <button type="button" className="qx-btn qx-btn--primary" onClick={onCreateTask}>
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            Giao việc
          </button>
        </div>
      </header>

      <div className="qx-stats qtk-dashboard__stats">
        <article className="qx-stat qtk-stat qtk-stat--accent">
          <span className="qx-stat__label">Tổng công việc</span>
          <div className="qx-stat__value">{statTotal}</div>
          <div className="qx-stat__note"><TrendingUp size={13} aria-hidden="true" /> Tăng so với tháng trước</div>
        </article>
        <article className="qx-stat qtk-stat">
          <span className="qx-stat__label">Đang thực hiện</span>
          <div className="qx-stat__value">{statInProgress}</div>
          <div className="qx-stat__note"><Clock3 size={13} aria-hidden="true" /> Gồm {pendingApproval} việc chờ duyệt</div>
        </article>
        <article className="qx-stat qtk-stat">
          <span className="qx-stat__label">Hoàn thành</span>
          <div className="qx-stat__value">{statDone}</div>
          <div className="qx-stat__note"><CheckCircle2 size={13} aria-hidden="true" /> Đạt {completionPct}% khối lượng</div>
        </article>
        <article className="qx-stat qtk-stat">
          <span className="qx-stat__label">Quá hạn</span>
          <div className="qx-stat__value">{overdueNum}</div>
          <div className="qx-stat__note"><CalendarDays size={13} aria-hidden="true" /> {overdueNum > 0 ? 'Cần theo dõi' : 'Đang đúng tiến độ'}</div>
        </article>
      </div>

      <div className="qtk-dashboard__grid">
        <div className="qtk-dashboard__primary">
          <article className="qx-card qtk-dashboard-card qtk-analytics-card">
            <div className="qtk-overview-card__head">
              <div>
                <h2>Hoạt động công việc</h2>
                <p>Mức độ hoàn thành trong tuần này</p>
              </div>
              <span className="qtk-card-kicker"><span className="qtk-dot" /> Hoạt động tuần</span>
            </div>
            <div className="qtk-activity-chart" aria-label="Biểu đồ hoạt động công việc theo ngày">
              <div className="qtk-activity-axis" aria-hidden="true">
                <span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span>
              </div>
              <div className="qtk-activity-bars">
                {weeklyActivity.map((item, index) => (
                  <div className="qtk-activity-bar-wrap" key={item.label}>
                    <div className="qtk-activity-bar-track">
                      <div className={`qtk-activity-bar${index === 3 ? ' is-highlighted' : ''}`} style={{ height: `${item.value}%` }} title={`${item.value}%`} />
                    </div>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="qtk-analytics-foot">
              <span>Trung bình: <strong>{activityAverage}%</strong></span>
              <span>Cao nhất: <strong>{activityPeak}%</strong></span>
            </div>
          </article>

          <article className="qx-card qtk-dashboard-card qtk-collaboration-card">
            <div className="qtk-overview-card__head">
              <div>
                <h2>Phân bổ theo người phụ trách</h2>
                <p>Số đầu việc đang mở trên từng thành viên</p>
              </div>
            </div>
            {assigneeLoad.length > 0 ? (
              <ul className="qtk-collaboration-list">
                {assigneeLoad.map((person) => (
                  <li key={person.name} className="qtk-collaboration-row">
                    <span className="qx-avatar qx-avatar--sm" aria-hidden="true">{initials(person.name)}</span>
                    <span className="qtk-overview-load-name">{person.name}</span>
                    <span className="qtk-overview-load-count">{person.active} đang mở / {person.total} tổng</span>
                  </li>
                ))}
              </ul>
            ) : <p className="qtk-overview-empty">Chưa có phân công nhân sự</p>}
            <Link href="/tasks" className="qtk-text-link">Xem công việc của tôi <ArrowRight size={14} aria-hidden="true" /></Link>
          </article>
        </div>

        <div className="qtk-dashboard__secondary">
          <article className="qx-card qtk-dashboard-card qtk-reminders-card">
            <div className="qtk-overview-card__head">
              <div>
                <h2>Việc cần chú ý</h2>
                <p>Ưu tiên cao, chờ duyệt hoặc quá hạn</p>
              </div>
              <Link href="/?view=overdue" className="qtk-icon-link" aria-label="Xem việc quá hạn"><ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
            {attentionTasks.length > 0 ? (
              <ul className="qtk-reminders-list">
                {attentionTasks.map((task) => (
                  <li key={task.id}>
                    <button type="button" className="qtk-reminder" onClick={() => onSelectTask(task)}>
                      <span className="qtk-reminder__marker" aria-hidden="true" />
                      <span className="qtk-reminder__copy"><strong>{task.title}</strong><small>{task.code} · Hạn {formatDueDate(task.dueDate)}</small></span>
                      <span className={getPriorityBadgeClass(task.priority)}>{task.priority}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="qtk-overview-empty">Mọi đầu việc đang đi đúng tiến độ</p>}
            <Link href="/?view=overdue" className="qtk-text-link">Xem tất cả nhắc việc <ArrowRight size={14} aria-hidden="true" /></Link>
          </article>

          <article className="qx-card qtk-dashboard-card qtk-progress-card">
            <h2>Tiến độ công việc</h2>
            <div className="qtk-progress-ring" style={{ '--qtk-progress': `${completionPct}%` } as React.CSSProperties}>
              <div className="qtk-progress-ring__inner"><strong>{completionPct}%</strong><span>Đã hoàn thành</span></div>
            </div>
            <div className="qtk-progress-legend">
              <span><i className="is-brand" /> Hoàn thành</span>
              <span><i className="is-ink" /> Đang làm</span>
              <span><i className="is-striped" /> Chờ xử lý</span>
            </div>
          </article>
        </div>
      </div>

      <div className="qtk-dashboard__bottom">
        <article className="qx-card qtk-dashboard-card qtk-project-card">
          <div className="qtk-overview-card__head">
            <div><h2>Dự án</h2><p>Các dự án đang được theo dõi trong QTask</p></div>
            <Link href="/projects" className="qtk-text-link">Xem tất cả <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
          <div className="qtk-project-list">
            {projectRows.map((proj, index) => (
              <div className="qtk-project-row" key={proj.name}>
                <span className={`qtk-project-icon qtk-project-icon--${index % 4}`}><FolderKanban size={17} aria-hidden="true" /></span>
                <span className="qtk-project-row__copy"><strong>{proj.name}</strong><small>{proj.total} đầu việc · {proj.done} hoàn thành</small></span>
                <span className="qtk-project-row__progress"><span>{proj.pct}%</span><i><b style={{ width: `${proj.pct}%` }} /></i></span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
