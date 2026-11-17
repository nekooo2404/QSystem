'use client';

import * as React from 'react';
import { CheckCircle2, Clock3, Target, TrendingDown, TrendingUp, Users } from 'lucide-react';
import './qtask.css';

const MONTHLY_DATA = [
  { month: 'T1', tasks: 45 },
  { month: 'T2', tasks: 52 },
  { month: 'T3', tasks: 48 },
  { month: 'T4', tasks: 61 },
  { month: 'T5', tasks: 55 },
  { month: 'T6', tasks: 67 },
];

const DISTRIBUTION = [
  { label: 'Đang làm', count: 8, tone: 'blue' },
  { label: 'Hoàn thành', count: 15, tone: 'green' },
  { label: 'Chờ duyệt', count: 5, tone: 'amber' },
  { label: 'Tạm dừng', count: 2, tone: 'gray' },
];

export function QTaskAnalyticsView() {
  const maxValue = Math.max(...MONTHLY_DATA.map((item) => item.tasks));
  const stats = [
    { title: 'Task hoàn thành', value: '247', change: '+12%', trend: 'up', icon: CheckCircle2 },
    { title: 'Dự án đang chạy', value: '12', change: '+3', trend: 'up', icon: Target },
    { title: 'Thành viên', value: '24', change: '-2', trend: 'down', icon: Users },
    { title: 'Thời gian hoàn thành', value: '2.3', unit: 'ngày', change: '-0.5', trend: 'up', icon: Clock3 },
  ] as const;

  return (
    <section className="qx-page qtk-subpage" aria-label="QTask Analytics">
      <header className="qx-page-head qtk-dashboard__head">
        <div>
          <h1>Analytics</h1>
          <p>Đo lường tiến độ, hiệu suất và tải công việc của QTask.</p>
        </div>
      </header>

      <div className="qtk-analytics-stats">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const Trend = stat.trend === 'up' ? TrendingUp : TrendingDown;
          return (
            <article className="qx-card qtk-analytics-stat" key={stat.title}>
              <div className="qtk-analytics-stat__head">
                <span className="qtk-analytics-stat__icon"><Icon size={16} /></span>
                <span className="qtk-analytics-stat__label">{stat.title}</span>
              </div>
              <strong>{stat.value}{'unit' in stat && stat.unit ? <small>{stat.unit}</small> : null}</strong>
              <span className={`qtk-analytics-stat__change is-${stat.trend}`}><Trend size={13} /> {stat.change}</span>
            </article>
          );
        })}
      </div>

      <div className="qtk-analytics-grid">
        <article className="qx-card qtk-dashboard-card">
          <div className="qtk-overview-card__head">
            <div><h2>Monthly Task Completion</h2><p>Số task hoàn thành theo tháng</p></div>
          </div>
          <div className="qtk-monthly-list">
            {MONTHLY_DATA.map((item) => (
              <div className="qtk-monthly-row" key={item.month}>
                <div><span>{item.month}</span><strong>{item.tasks} tasks</strong></div>
                <i><b style={{ width: `${(item.tasks / maxValue) * 100}%` }} /></i>
              </div>
            ))}
          </div>
        </article>

        <article className="qx-card qtk-dashboard-card">
          <div className="qtk-overview-card__head">
            <div><h2>Project Distribution</h2><p>Phân bổ trạng thái dự án</p></div>
          </div>
          <div className="qtk-distribution-list">
            {DISTRIBUTION.map((item) => (
              <div className="qtk-distribution-row" key={item.label}>
                <span><i className={`qtk-distribution-dot is-${item.tone}`} />{item.label}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
