'use client';

import * as React from 'react';
import { Download } from 'lucide-react';
import { Select, toast, type SelectOption } from '@qsystem/ui';
import {
  formatCrmDate,
  formatViCount,
  formatVnd,
  formatVndCompact,
  getReportPeriodRange,
  isIsoWithinRange,
  isOpportunityInPeriod,
  OPEN_OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_BADGE,
  OPPORTUNITY_STAGE_BAR_TONE,
  OPPORTUNITY_STAGES,
  ownerInitialsOf,
  REPORT_PERIOD_OPTIONS,
  sanitizeCsvCell,
  toneForOwner,
  type ContactRow,
  type CustomerRow,
  type OpportunityRow,
  type ReportPeriod,
} from './crm.storage';

const PERIOD_SELECT_OPTIONS: readonly SelectOption<ReportPeriod>[] = REPORT_PERIOD_OPTIONS.map(
  (opt) => ({
    value: opt.value,
    label: opt.label,
  }),
);

export interface CrmReportsViewProps {
  customers: CustomerRow[];
  opportunities: OpportunityRow[];
  contacts: ContactRow[];
  ownerNames: readonly string[];
}

export function CrmReportsView({
  customers,
  opportunities,
  contacts,
  ownerNames,
}: CrmReportsViewProps) {
  const [period, setPeriod] = React.useState<ReportPeriod>('this-month');
  const [ownerFilter, setOwnerFilter] = React.useState<string>('all');

  const ownerFilterOptions = React.useMemo<SelectOption<string>[]>(() => {
    const names = new Set<string>(ownerNames);
    for (const o of opportunities) names.add(o.ownerName);
    for (const c of contacts) names.add(c.ownerName);
    return [
      { value: 'all', label: 'Tất cả phụ trách' },
      ...Array.from(names).map((name) => ({ value: name, label: name })),
    ];
  }, [ownerNames, opportunities, contacts]);

  const periodRange = React.useMemo(() => getReportPeriodRange(period), [period]);

  const scopedOpportunities = React.useMemo(
    () =>
      opportunities.filter((opp) => {
        if (ownerFilter !== 'all' && opp.ownerName !== ownerFilter) return false;
        return isOpportunityInPeriod(opp, periodRange);
      }),
    [opportunities, ownerFilter, periodRange],
  );

  const scopedContacts = React.useMemo(
    () =>
      contacts.filter((ct) => (ownerFilter === 'all' ? true : ct.ownerName === ownerFilter)),
    [contacts, ownerFilter],
  );

  const openOpps = scopedOpportunities.filter((o) => OPEN_OPPORTUNITY_STAGES.has(o.stage));
  const wonOpps = scopedOpportunities.filter((o) => o.stage === 'Chốt thành công');
  const lostOpps = scopedOpportunities.filter((o) => o.stage === 'Thất bại');

  const openPipelineVnd = openOpps.reduce((sum, o) => sum + o.amountVnd, 0);
  const wonRevenueVnd = wonOpps.reduce((sum, o) => sum + o.amountVnd, 0);
  const lostValueVnd = lostOpps.reduce((sum, o) => sum + o.amountVnd, 0);
  const closedCount = wonOpps.length + lostOpps.length;
  const winRatePct = closedCount > 0 ? Math.round((wonOpps.length / closedCount) * 100) : 0;
  const totalScopedAmountVnd = scopedOpportunities.reduce((sum, o) => sum + o.amountVnd, 0);
  const avgDealValueVnd =
    scopedOpportunities.length > 0
      ? Math.round(totalScopedAmountVnd / scopedOpportunities.length)
      : 0;
  const safeTotalVnd = Math.max(1, totalScopedAmountVnd);
  const openSharePct = totalScopedAmountVnd > 0 ? Math.round((openPipelineVnd / safeTotalVnd) * 100) : 0;
  const wonSharePct = totalScopedAmountVnd > 0 ? Math.round((wonRevenueVnd / safeTotalVnd) * 100) : 0;
  const lostSharePct = totalScopedAmountVnd > 0 ? Math.max(0, 100 - openSharePct - wonSharePct) : 0;

  const interactionCount = React.useMemo(() => {
    let count = 0;
    for (const ct of scopedContacts) {
      const matchedEntries = ct.interactions.filter((item) =>
        isIsoWithinRange(item.dateIso, periodRange),
      );
      if (matchedEntries.length > 0) {
        count += matchedEntries.length;
      } else if (isIsoWithinRange(ct.lastInteractionIso, periodRange)) {
        count += 1;
      }
    }
    return count;
  }, [scopedContacts, periodRange]);

  const stageBreakdown = React.useMemo(() => {
    const totalValue = Math.max(1, totalScopedAmountVnd);
    const totalCount = Math.max(1, scopedOpportunities.length);
    return OPPORTUNITY_STAGES.map((stage) => {
      const rows = scopedOpportunities.filter((o) => o.stage === stage);
      const valueVnd = rows.reduce((sum, o) => sum + o.amountVnd, 0);
      const sharePct =
        scopedOpportunities.length === 0
          ? 0
          : totalScopedAmountVnd > 0
            ? Math.round((valueVnd / totalValue) * 100)
            : Math.round((rows.length / totalCount) * 100);
      return {
        stage,
        count: rows.length,
        valueVnd,
        sharePct,
      };
    });
  }, [scopedOpportunities, totalScopedAmountVnd]);

  const ownerPerformance = React.useMemo(() => {
    const allOwners = new Set<string>(
      ownerFilter === 'all' ? ownerNames : [ownerFilter],
    );
    if (ownerFilter === 'all') {
      for (const opp of scopedOpportunities) allOwners.add(opp.ownerName);
      for (const ct of scopedContacts) allOwners.add(ct.ownerName);
    }

    return Array.from(allOwners)
      .map((name) => {
        const ownerOpps = scopedOpportunities.filter((o) => o.ownerName === name);
        const ownerOpen = ownerOpps.filter((o) => OPEN_OPPORTUNITY_STAGES.has(o.stage));
        const ownerWon = ownerOpps.filter((o) => o.stage === 'Chốt thành công');
        const ownerLost = ownerOpps.filter((o) => o.stage === 'Thất bại');
        const ownerClosed = ownerWon.length + ownerLost.length;
        const ownerWinRate =
          ownerClosed > 0 ? Math.round((ownerWon.length / ownerClosed) * 100) : 0;
        const ownerPipelineVnd = ownerOpen.reduce((sum, o) => sum + o.amountVnd, 0);
        const ownerWonVnd = ownerWon.reduce((sum, o) => sum + o.amountVnd, 0);

        let ownerInteractions = 0;
        for (const ct of scopedContacts) {
          if (ct.ownerName !== name) continue;
          const entries = ct.interactions.filter((entry) =>
            isIsoWithinRange(entry.dateIso, periodRange),
          );
          if (entries.length > 0) ownerInteractions += entries.length;
          else if (isIsoWithinRange(ct.lastInteractionIso, periodRange)) ownerInteractions += 1;
        }

        const customerCount = customers.filter((c) => c.ownerName === name).length;

        return {
          name,
          initials: ownerInitialsOf(name),
          tone: toneForOwner(name),
          customerCount,
          openCount: ownerOpen.length,
          wonCount: ownerWon.length,
          wonVnd: ownerWonVnd,
          pipelineVnd: ownerPipelineVnd,
          winRatePct: ownerWinRate,
          interactions: ownerInteractions,
        };
      })
      .sort(
        (a, b) =>
          b.wonVnd - a.wonVnd || b.pipelineVnd - a.pipelineVnd || b.interactions - a.interactions,
      );
  }, [ownerFilter, ownerNames, scopedOpportunities, scopedContacts, periodRange, customers]);

  function handleExportCsv() {
    const lines: string[] = [];
    lines.push(
      [
        'Báo cáo hiệu suất QCRM',
        periodRange.label,
        `${formatCrmDate(periodRange.startIso)} - ${formatCrmDate(periodRange.endIso)}`,
        ownerFilter === 'all' ? 'Tất cả phụ trách' : ownerFilter,
      ]
        .map(sanitizeCsvCell)
        .join(','),
    );
    lines.push('');
    lines.push(['Chỉ số tổng hợp', 'Giá trị'].map(sanitizeCsvCell).join(','));
    lines.push(['Giá trị pipeline đang mở', formatVnd(openPipelineVnd)].map(sanitizeCsvCell).join(','));
    lines.push(['Doanh thu đã chốt thành công', formatVnd(wonRevenueVnd)].map(sanitizeCsvCell).join(','));
    lines.push(['Tỷ lệ thắng cơ hội (%)', `${winRatePct}%`].map(sanitizeCsvCell).join(','));
    lines.push(['Giá trị trung bình mỗi cơ hội', formatVnd(avgDealValueVnd)].map(sanitizeCsvCell).join(','));
    lines.push(['Số lượt tương tác đầu mối', formatViCount(interactionCount)].map(sanitizeCsvCell).join(','));
    lines.push('');
    lines.push(['Giai đoạn bán hàng', 'Số cơ hội', 'Tổng giá trị (VNĐ)', 'Tỷ trọng (%)'].map(sanitizeCsvCell).join(','));
    for (const row of stageBreakdown) {
      lines.push(
        [row.stage, row.count, formatVnd(row.valueVnd), `${row.sharePct}%`]
          .map(sanitizeCsvCell)
          .join(','),
      );
    }
    lines.push('');
    lines.push(
      [
        'Nhân viên phụ trách',
        'Cơ hội đang mở',
        'Đã chốt thành công',
        'Doanh thu chốt (VNĐ)',
        'Pipeline đang mở (VNĐ)',
        'Tỷ lệ thắng (%)',
        'Tương tác đầu mối',
      ]
        .map(sanitizeCsvCell)
        .join(','),
    );
    for (const row of ownerPerformance) {
      lines.push(
        [
          row.name,
          row.openCount,
          row.wonCount,
          formatVnd(row.wonVnd),
          formatVnd(row.pipelineVnd),
          `${row.winRatePct}%`,
          row.interactions,
        ]
          .map(sanitizeCsvCell)
          .join(','),
      );
    }

    const csvContent = `\uFEFF${lines.join('\r\n')}`;
    if (typeof window !== 'undefined' && typeof Blob !== 'undefined') {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : '';
      if (url) {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `bao-cao-qcrm-${period}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
      }
    }
    toast.success(`Đã xuất báo cáo CSV (${periodRange.label})`);
  }

  return (
    <section className="qx-page crm-page" aria-label="Báo cáo">
      <header className="qx-page-head">
        <div>
          <h1>Báo cáo kinh doanh</h1>
          <p>
            Tổng hợp giá trị pipeline, doanh thu chốt, tỷ lệ thắng và tương tác đầu mối theo{' '}
            <span className="crm-num">
              {periodRange.label} ({formatCrmDate(periodRange.startIso)} –{' '}
              {formatCrmDate(periodRange.endIso)})
            </span>
          </p>
        </div>
        <div className="qx-actions">
          <div className="crm-report-filter">
            <label htmlFor="report-period" className="crm-sr-only">
              Kỳ lọc báo cáo
            </label>
            <Select<ReportPeriod>
              id="report-period"
              value={period}
              onValueChange={setPeriod}
              options={PERIOD_SELECT_OPTIONS}
              aria-label="Kỳ lọc"
            />
          </div>
          <div className="crm-report-filter">
            <label htmlFor="report-owner" className="crm-sr-only">
              Lọc theo nhân viên phụ trách
            </label>
            <Select<string>
              id="report-owner"
              value={ownerFilter}
              onValueChange={setOwnerFilter}
              options={ownerFilterOptions}
              aria-label="Nhân viên phụ trách"
            />
          </div>
          <button type="button" className="qx-btn qx-btn--primary" onClick={handleExportCsv}>
            <Download size={16} strokeWidth={1.5} aria-hidden="true" />
            Xuất báo cáo CSV
          </button>
        </div>
      </header>

      <div className="crm-report-stats" aria-label="Chỉ số báo cáo theo kỳ">
        <article className="qx-stat">
          <div className="qx-stat__label">Giá trị pipeline đang mở</div>
          <div className="qx-stat__value crm-stat-value--compact">
            {formatVndCompact(openPipelineVnd)}
          </div>
          <div className="qx-stat__note crm-num">
            {formatViCount(openOpps.length)} cơ hội đang mở · {formatVnd(openPipelineVnd)}
          </div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Doanh thu đã chốt thành công</div>
          <div className="qx-stat__value crm-stat-value--compact">
            {formatVndCompact(wonRevenueVnd)}
          </div>
          <div className="qx-stat__note crm-num">
            {formatViCount(wonOpps.length)} cơ hội chốt · {formatVnd(wonRevenueVnd)}
          </div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Tỷ lệ thắng cơ hội</div>
          <div className="qx-stat__value">{winRatePct}%</div>
          <div className="qx-stat__note crm-num">
            {formatViCount(wonOpps.length)} thắng / {formatViCount(closedCount)} đã đóng
          </div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Giá trị trung bình mỗi cơ hội</div>
          <div className="qx-stat__value crm-stat-value--compact">
            {formatVndCompact(avgDealValueVnd)}
          </div>
          <div className="qx-stat__note crm-num">
            Trên {formatViCount(scopedOpportunities.length)} cơ hội trong kỳ
          </div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Số lượt tương tác đầu mối</div>
          <div className="qx-stat__value">{formatViCount(interactionCount)}</div>
          <div className="qx-stat__note crm-num">
            Trên {formatViCount(scopedContacts.length)} đầu mối theo dõi
          </div>
        </article>
      </div>

      <div className="crm-report-grid">
        <article className="qx-card crm-report-card crm-pipeline-moment">
          <div className="qx-card__head">
            <div>
              <h2 className="qx-card__title">Hiệu suất theo giai đoạn bán hàng</h2>
              <p className="crm-card-sub">
                Phân bổ số cơ hội, tổng giá trị dự kiến và tỷ trọng trong {periodRange.label.toLowerCase()}
              </p>
            </div>
          </div>

          <div className="crm-report-moment-bar">
            <div className="crm-pipeline-stacked" aria-hidden="true">
              <div
                className="crm-pipeline-stacked__seg crm-funnel__fill--brand"
                style={{ width: `${openSharePct}%` }}
              />
              <div
                className="crm-pipeline-stacked__seg crm-funnel__fill--won"
                style={{ width: `${wonSharePct}%` }}
              />
              <div
                className="crm-pipeline-stacked__seg crm-funnel__fill--lost"
                style={{ width: `${lostSharePct}%` }}
              />
            </div>
            <div className="crm-pipeline-legend">
              <span className="crm-pipeline-legend__item">
                <span className="crm-legend-dot crm-funnel__fill--brand" aria-hidden="true" />
                <span>Pipeline mở: {formatVndCompact(openPipelineVnd)} ({openSharePct}%)</span>
              </span>
              <span className="crm-pipeline-legend__item">
                <span className="crm-legend-dot crm-funnel__fill--won" aria-hidden="true" />
                <span>Đã chốt thắng: {formatVndCompact(wonRevenueVnd)} ({wonSharePct}%)</span>
              </span>
              <span className="crm-pipeline-legend__item">
                <span className="crm-legend-dot crm-funnel__fill--lost" aria-hidden="true" />
                <span>Thất bại: {formatVndCompact(lostValueVnd)} ({lostSharePct}%)</span>
              </span>
            </div>
          </div>

          <div className="crm-table-wrap">
            <table className="qx-table" aria-label="Hiệu suất theo giai đoạn bán hàng">
              <thead>
                <tr>
                  <th scope="col">Giai đoạn</th>
                  <th scope="col">Số cơ hội</th>
                  <th scope="col">Tổng giá trị</th>
                  <th scope="col">Tỷ trọng</th>
                </tr>
              </thead>
              <tbody>
                {stageBreakdown.map((item) => (
                  <tr key={item.stage}>
                    <td>
                      <span className={`qx-badge ${OPPORTUNITY_STAGE_BADGE[item.stage]}`}>
                        {item.stage}
                      </span>
                    </td>
                    <td className="crm-num">{formatViCount(item.count)}</td>
                    <td className="crm-num qx-table__strong">{formatVnd(item.valueVnd)}</td>
                    <td>
                      <div className="crm-share-cell">
                        <div className="crm-funnel__track" aria-hidden="true">
                          <div
                            className={`crm-funnel__fill crm-funnel__fill--${OPPORTUNITY_STAGE_BAR_TONE[item.stage]}`}
                            style={{ width: `${item.sharePct}%` }}
                          />
                        </div>
                        <span className="crm-num crm-share-pct">{item.sharePct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="qx-card crm-report-card">
          <div className="qx-card__head">
            <div>
              <h2 className="qx-card__title">Hiệu suất theo nhân viên phụ trách</h2>
              <p className="crm-card-sub">
                Đối chiếu kết quả chốt doanh thu, pipeline mở và tần suất chăm sóc đầu mối
              </p>
            </div>
          </div>

          <div className="crm-table-wrap">
            {ownerPerformance.length === 0 ? (
              <div className="crm-empty">Chưa có dữ liệu hiệu suất trong kỳ lọc đã chọn</div>
            ) : (
              <table className="qx-table" aria-label="Hiệu suất theo nhân viên phụ trách">
                <thead>
                  <tr>
                    <th scope="col">Nhân viên phụ trách</th>
                    <th scope="col">Cơ hội mở</th>
                    <th scope="col">Đã chốt</th>
                    <th scope="col">Doanh thu chốt</th>
                    <th scope="col">Pipeline mở</th>
                    <th scope="col">Tỷ lệ thắng</th>
                    <th scope="col">Tương tác</th>
                  </tr>
                </thead>
                <tbody>
                  {ownerPerformance.map((row) => (
                    <tr key={row.name}>
                      <td>
                        <span className="qx-person crm-owner">
                          <span className="qx-avatar qx-avatar--sm" aria-hidden="true">
                            {row.initials}
                          </span>
                          <span className="qx-table__strong">{row.name}</span>
                        </span>
                      </td>
                      <td className="crm-num">{formatViCount(row.openCount)}</td>
                      <td className="crm-num">{formatViCount(row.wonCount)}</td>
                      <td className="crm-num qx-table__strong">{formatVnd(row.wonVnd)}</td>
                      <td className="crm-num">{formatVnd(row.pipelineVnd)}</td>
                      <td className="crm-num">{row.winRatePct}%</td>
                      <td className="crm-num">{formatViCount(row.interactions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
