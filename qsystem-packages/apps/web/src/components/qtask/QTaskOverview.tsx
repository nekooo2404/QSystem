'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  FolderKanban,
  Plus,
} from 'lucide-react';
import { getPriorityBadgeClass, getStatusBadgeClass, formatDueDate, initials, type TaskViewItem } from './TaskDetailContent';

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
  const pendingApproval = tasks.filter((t) => t.status === 'Chờ duyệt').length;
  const activeCount = tasks.filter((t) => t.status === 'Đang làm').length;
  const totalForRatio = Math.max(1, tasks.length);

  const statusBreakdown = [
    { label: 'Đang làm', count: activeCount, tone: 'brand' },
    { label: 'Chờ duyệt', count: pendingApproval, tone: 'warning' },
    { label: 'Hoàn thành', count: tasks.filter((t) => t.status === 'Hoàn thành').length, tone: 'success' },
    { label: 'Quá hạn', count: tasks.filter((t) => isOverdue(t)).length, tone: 'error' },
  ] as const;

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
    .filter((t) => t.status !== 'Hoàn thành' && (isOverdue(t) || t.status === 'Chờ duyệt' || t.priority === 'Ưu tiên cao'))
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

  return (
    <section className="qx-page" aria-label="Tổng quan QTask">
      <header className="qx-page-head">
        <div>
          <h1>Tổng quan công việc</h1>
          <p>Theo dõi tiến độ chung, phân bổ tải xử lý và các đầu việc cần ưu tiên</p>
        </div>
        <div className="qx-actions">
          <Link href="/" className="qx-btn">
            Tất cả công việc
            <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
          </Link>
          <button type="button" className="qx-btn qx-btn--primary" onClick={onCreateTask}>
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            Giao việc
          </button>
        </div>
      </header>

      <div className="qx-stats">
        <article className="qx-stat">
          <span className="qx-stat__label">Tổng công việc</span>
          <div className="qx-stat__value">{statTotal}</div>
          <div className="qx-stat__note">Trên toàn bộ dự án đang mở</div>
        </article>

        <article className="qx-stat">
          <span className="qx-stat__label">Đang thực hiện</span>
          <div className="qx-stat__value">{statInProgress}</div>
          <div className="qx-stat__note">Gồm {pendingApproval} việc đang chờ duyệt</div>
        </article>

        <article className="qx-stat">
          <span className="qx-stat__label">Hoàn thành</span>
          <div className="qx-stat__value">{statDone}</div>
          <div className="qx-stat__note">Đạt {completionPct}% khối lượng</div>
        </article>

        <article className="qx-stat">
          <span className="qx-stat__label">Quá hạn</span>
          <div className="qx-stat__value">{overdueNum}</div>
          <div className="qx-stat__note">
            {overdueNum > 0 ? 'Cần nhắc hạn hoặc điều phối lại' : 'Không có công việc trễ hạn'}
          </div>
        </article>
      </div>

      <div className="qtk-overview-grid">
        <div className="qtk-overview-primary">
          <article className="qx-card qtk-overview-card">
            <div className="qtk-overview-card__head">
              <div>
                <h2>Phân bổ theo trạng thái</h2>
                <p>Tỉ lệ xử lý trên {tasks.length} đầu việc hiện có</p>
              </div>
            </div>
            <div className="qtk-overview-bars">
              {statusBreakdown.map((item) => {
                const pct = Math.round((item.count / totalForRatio) * 100);
                return (
                  <div key={item.label} className="qtk-overview-bar-row">
                    <div className="qtk-overview-bar-meta">
                      <span>{item.label}</span>
                      <span>{item.count} ({pct}%)</span>
                    </div>
                    <div className="qtk-progress-track">
                      <div
                        className={`qtk-overview-fill qtk-overview-fill--${item.tone}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="qx-card qtk-overview-card">
            <div className="qtk-overview-card__head">
              <div>
                <h2>Tiến độ theo dự án</h2>
                <p>Tỉ lệ hoàn thành đầu việc của từng dự án</p>
              </div>
              <Link href="/projects" className="qtk-overview-link">
                <FolderKanban size={16} strokeWidth={1.5} aria-hidden="true" />
                Xem dự án
              </Link>
            </div>
            <div className="qtk-overview-bars">
              {projectsSummary.length > 0 ? (
                projectsSummary.map((proj) => (
                  <div key={proj.name} className="qtk-overview-bar-row">
                    <div className="qtk-overview-bar-meta">
                      <span>{proj.name}</span>
                      <span>{proj.done}/{proj.total} ({proj.pct}%)</span>
                    </div>
                    <div className="qtk-progress-track">
                      <div className="qtk-overview-fill qtk-overview-fill--brand" style={{ width: `${proj.pct}%` }} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="qtk-overview-empty">Chưa có dữ liệu dự án</p>
              )}
            </div>
          </article>
        </div>

        <div className="qtk-overview-secondary">
          <article className="qx-card qtk-overview-card">
            <div className="qtk-overview-card__head">
              <div>
                <h2>Việc cần chú ý</h2>
                <p>Ưu tiên cao, chờ duyệt hoặc quá hạn xử lý</p>
              </div>
              <Link href="/?view=overdue" className="qtk-overview-link">
                <AlertTriangle size={16} strokeWidth={1.5} aria-hidden="true" />
                Xem việc quá hạn
              </Link>
            </div>
            {attentionTasks.length > 0 ? (
              <ul className="qtk-overview-list">
                {attentionTasks.map((task) => (
                  <li key={task.id}>
                    <button type="button" className="qtk-overview-item" onClick={() => onSelectTask(task)}>
                      <div className="qtk-overview-item__main">
                        <span className="qtk-overview-item__title">{task.title}</span>
                        <span className="qtk-overview-item__sub">
                          {task.code} · {task.assigneeName} · Hạn {formatDueDate(task.dueDate)}
                        </span>
                      </div>
                      <div className="qtk-overview-item__badges">
                        <span className={getPriorityBadgeClass(task.priority)}>{task.priority}</span>
                        <span className={getStatusBadgeClass(task.displayStatus ?? task.status)}>
                          {task.displayStatus ?? task.status}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="qtk-overview-empty">Mọi đầu việc đang đi đúng tiến độ</p>
            )}
          </article>

          <article className="qx-card qtk-overview-card">
            <div className="qtk-overview-card__head">
              <div>
                <h2>Tải công việc theo phụ trách</h2>
                <p>Số đầu việc đang mở trên từng thành viên</p>
              </div>
            </div>
            {assigneeLoad.length > 0 ? (
              <ul className="qtk-overview-load">
                {assigneeLoad.map((person) => (
                  <li key={person.name} className="qtk-overview-load-row">
                    <span className="qx-avatar qx-avatar--sm" aria-hidden="true">
                      {initials(person.name)}
                    </span>
                    <span className="qtk-overview-load-name">{person.name}</span>
                    <span className="qtk-overview-load-count">
                      {person.active} đang mở / {person.total} tổng
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="qtk-overview-empty">Chưa có phân công nhân sự</p>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
