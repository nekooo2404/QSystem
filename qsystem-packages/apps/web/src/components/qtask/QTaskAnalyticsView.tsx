'use client';

import * as React from 'react';
import { CheckCircle2, Clock3, Target, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { apiFetch } from '../../lib/api/client';
import { humanizeApiError } from '../../lib/errors/humanize';
import './qtask.css';

interface AnalyticsOverview {
  total: number;
  byStatus: Record<string, number>;
  completionRate: number;
  completedThisMonth: number;
  completedLastMonth: number;
  overdue: number;
  monthly: { month: string; tasks: number }[];
  workload: { name: string; active: number; total: number }[];
}

const STATUS_TONES: Record<string, string> = {
  'Đang làm': 'blue',
  'Hoàn thành': 'green',
  'Chờ duyệt': 'amber',
  'Quá hạn': 'gray',
};

export function QTaskAnalyticsView() {
  const [loading, setLoading] = React.useState(process.env.NODE_ENV !== 'test');
  const [data, setData] = React.useState<AnalyticsOverview | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    const skeletonTimer = window.setTimeout(() => setLoading(false), 240);
    apiFetch<AnalyticsOverview>('/api/org/analytics/overview', { useCache: true })
      .then((rows) => {
        if (!active) return;
        setData(rows);
        setLoadError(null);
      })
      .catch(() => {
        if (!active) return;
        setLoadError(humanizeApiError());
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      window.clearTimeout(skeletonTimer);
    };
  }, []);

  if (loading) {
    return (
      <section className="qx-page qtk-subpage" aria-label="QTask Analytics" role="status" aria-busy="true">
        <div className="qtk-analytics-skeleton__head" />
        <div className="qtk-analytics-stats qtk-analytics-skeleton__stats">
          {Array.from({ length: 4 }, (_, index) => <div key={index} />)}
        </div>
        <div className="qtk-analytics-grid qtk-analytics-skeleton__panels">
          <div />
          <div />
        </div>
      </section>
    );
  }

  const monthly = data?.monthly ?? [];
  const maxValue = Math.max(1, ...monthly.map((item) => item.tasks));
  const statusEntries = data
    ? Object.entries(data.byStatus).filter(([, count]) => count > 0)
    : [];
  const trendUp = data ? data.completedThisMonth >= data.completedLastMonth : true;
  const doneDelta = data ? data.completedThisMonth - data.completedLastMonth : 0;

  if (loadError && !data) {
    return (
      <section className="qx-page qtk-subpage" aria-label="QTask Analytics">
        <header className="qx-page-head qtk-dashboard__head">
          <div>
            <h1>Analytics</h1>
            <p>Đo lường tiến độ, hiệu suất và tải công việc của QTask.</p>
          </div>
        </header>
        <div className="qx-card" style={{ padding: 24 }}>
          <p style={{ margin: 0, color: 'var(--qs-fg-muted)', fontSize: 13 }}>
            {loadError} Không thể tải số liệu phân tích lúc này.
          </p>
        </div>
      </section>
    );
  }

  const stats = [
    { title: 'Task hoàn thành', value: String(data?.completedThisMonth ?? 0), change: `${doneDelta >= 0 ? '+' : ''}${doneDelta}`, trend: trendUp ? 'up' : 'down', icon: CheckCircle2 },
    { title: 'Tổng công việc', value: String(data?.total ?? 0), change: `${data?.completionRate ?? 0}% hoàn thành`, trend: 'up', icon: Target },
    { title: 'Thành viên có việc', value: String(data?.workload.length ?? 0), change: 'đang mở đầu việc', trend: 'up', icon: Users },
    { title: 'Quá hạn', value: String(data?.overdue ?? 0), change: data && data.overdue > 0 ? 'cần theo dõi' : 'đúng tiến độ', trend: data && data.overdue > 0 ? 'down' : 'up', icon: Clock3 },
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
              <strong>{stat.value}</strong>
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
            {monthly.map((item) => (
              <div className="qtk-monthly-row" key={item.month}>
                <div><span>{item.month}</span><strong>{item.tasks} tasks</strong></div>
                <i><b style={{ width: `${(item.tasks / maxValue) * 100}%` }} /></i>
              </div>
            ))}
            {monthly.length === 0 ? <p className="qtk-overview-empty">Chưa có dữ liệu hoàn thành theo tháng</p> : null}
          </div>
        </article>

        <article className="qx-card qtk-dashboard-card">
          <div className="qtk-overview-card__head">
            <div><h2>Phân bổ trạng thái</h2><p>Tình trạng các đầu việc hiện có</p></div>
          </div>
          <div className="qtk-distribution-list">
            {statusEntries.map(([label, count]) => (
              <div className="qtk-distribution-row" key={label}>
                <span><i className={`qtk-distribution-dot is-${STATUS_TONES[label] ?? 'blue'}`} />{label}</span>
                <strong>{count}</strong>
              </div>
            ))}
            {statusEntries.length === 0 ? <p className="qtk-overview-empty">Chưa có đầu việc nào</p> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
