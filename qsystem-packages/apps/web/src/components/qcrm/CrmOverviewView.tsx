'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  CONTACT_ROLE_BADGE,
  formatCrmDate,
  formatCrmRelativeDate,
  formatViCount,
  formatVnd,
  formatVndCompact,
  OPEN_OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_BADGE,
  OPPORTUNITY_STAGE_BAR_TONE,
  OPPORTUNITY_STAGES,
  type ContactRow,
  type CustomerRow,
  type OpportunityRow,
} from './crm.storage';

export interface CrmOverviewViewProps {
  customers: CustomerRow[];
  opportunities: OpportunityRow[];
  contacts: ContactRow[];
}

export function CrmOverviewView({
  customers,
  opportunities,
  contacts,
}: CrmOverviewViewProps) {
  const openDeals = opportunities.filter((o) => OPEN_OPPORTUNITY_STAGES.has(o.stage));
  const wonDeals = opportunities.filter((o) => o.stage === 'Chốt thành công');
  const lostDeals = opportunities.filter((o) => o.stage === 'Thất bại');
  const openPipelineVnd = openDeals.reduce((sum, o) => sum + o.amountVnd, 0);
  const wonRevenueVnd = wonDeals.reduce((sum, o) => sum + o.amountVnd, 0);
  const lostValueVnd = lostDeals.reduce((sum, o) => sum + o.amountVnd, 0);
  const totalValueVnd = Math.max(1, openPipelineVnd + wonRevenueVnd + lostValueVnd);

  const openSharePct = Math.round((openPipelineVnd / totalValueVnd) * 100);
  const wonSharePct = Math.round((wonRevenueVnd / totalValueVnd) * 100);
  const lostSharePct = Math.max(0, 100 - openSharePct - wonSharePct);

  const enterpriseCount = customers.filter((c) => c.segment === 'enterprise').length;
  const primaryContactCount = contacts.filter((c) => c.contactRole === 'Đầu mối chính').length;

  const upcomingOpportunities = React.useMemo(
    () =>
      [...openDeals]
        .sort((a, b) => a.expectedCloseIso.localeCompare(b.expectedCloseIso))
        .slice(0, 5),
    [openDeals],
  );

  const recentContacts = React.useMemo(
    () =>
      [...contacts]
        .sort((a, b) => b.lastInteractionIso.localeCompare(a.lastInteractionIso))
        .slice(0, 5),
    [contacts],
  );

  const maxStageValue = Math.max(
    1,
    ...OPPORTUNITY_STAGES.map((stage) =>
      opportunities
        .filter((o) => o.stage === stage)
        .reduce((acc, o) => acc + o.amountVnd, 0),
    ),
  );

  return (
    <section className="qx-page crm-page" aria-label="Tổng quan QCRM">
      <header className="qx-page-head">
        <div>
          <h1>Tổng quan QCRM</h1>
          <p>Toàn cảnh khách hàng, giá trị pipeline đang mở, cơ hội sắp chốt và tương tác đầu mối</p>
        </div>
        <div className="qx-actions">
          <Link href="/crm" className="qx-btn">
            Khách hàng
          </Link>
          <Link href="/crm?muc=lien-he" className="qx-btn">
            Liên hệ
          </Link>
          <Link href="/crm?muc=bao-cao" className="qx-btn">
            Báo cáo
          </Link>
          <Link href="/crm?muc=co-hoi" className="qx-btn qx-btn--primary">
            Cơ hội bán hàng
          </Link>
        </div>
      </header>

      <div className="qx-stats" aria-label="Chỉ số tổng quan QCRM">
        <article className="qx-stat">
          <div className="qx-stat__label">Tổng khách hàng</div>
          <div className="qx-stat__value">{formatViCount(customers.length)}</div>
          <div className="qx-stat__note">
            {formatViCount(enterpriseCount)} doanh nghiệp ·{' '}
            {formatViCount(customers.length - enterpriseCount)} cá nhân
          </div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Giá trị pipeline đang mở</div>
          <div className="qx-stat__value crm-stat-value--compact">
            {formatVndCompact(openPipelineVnd)}
          </div>
          <div className="qx-stat__note crm-num">
            {formatViCount(openDeals.length)} cơ hội đang mở · {formatVnd(openPipelineVnd)}
          </div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Cơ hội chốt thành công</div>
          <div className="qx-stat__value">{formatViCount(wonDeals.length)}</div>
          <div className="qx-stat__note crm-num">Doanh thu: {formatVndCompact(wonRevenueVnd)}</div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Đầu mối liên hệ hoạt động</div>
          <div className="qx-stat__value">{formatViCount(contacts.length)}</div>
          <div className="qx-stat__note">
            Gồm {formatViCount(primaryContactCount)} đầu mối chính
          </div>
        </article>
      </div>

      <div className="crm-overview-hero-grid">
        <article className="qx-card crm-overview-card crm-pipeline-moment">
          <div className="crm-overview-card__head">
            <div>
              <h2>Phân bổ cơ hội theo giai đoạn</h2>
              <p>Cấu trúc giá trị dự kiến và tỷ trọng qua từng bước bán hàng</p>
            </div>
            <Link href="/crm?muc=bao-cao" className="crm-overview-link">
              Xem báo cáo chi tiết
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>

          <div className="crm-pipeline-summary">
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
                <span className="crm-pipeline-legend__copy">
                  <span className="crm-pipeline-legend__label">Đang mở</span>
                  <strong>{formatVndCompact(openPipelineVnd)}</strong>
                  <small>{openSharePct}% giá trị pipeline</small>
                </span>
              </span>
              <span className="crm-pipeline-legend__item">
                <span className="crm-legend-dot crm-funnel__fill--won" aria-hidden="true" />
                <span className="crm-pipeline-legend__copy">
                  <span className="crm-pipeline-legend__label">Chốt thành công</span>
                  <strong>{formatVndCompact(wonRevenueVnd)}</strong>
                  <small>{wonSharePct}% giá trị pipeline</small>
                </span>
              </span>
              <span className="crm-pipeline-legend__item">
                <span className="crm-legend-dot crm-funnel__fill--lost" aria-hidden="true" />
                <span className="crm-pipeline-legend__copy">
                  <span className="crm-pipeline-legend__label">Thất bại</span>
                  <strong>{formatVndCompact(lostValueVnd)}</strong>
                  <small>{lostSharePct}% giá trị pipeline</small>
                </span>
              </span>
            </div>
          </div>

          <ul className="crm-stage-bars">
            {OPPORTUNITY_STAGES.map((stage) => {
              const matched = opportunities.filter((o) => o.stage === stage);
              const sumVnd = matched.reduce((acc, o) => acc + o.amountVnd, 0);
              const widthPct =
                sumVnd === 0 ? 0 : Math.max(8, Math.round((sumVnd / maxStageValue) * 100));
              return (
                <li key={stage} className="crm-stage-bar-item">
                  <div className="crm-funnel__meta">
                    <span className="crm-funnel__label">{stage}</span>
                    <span className="crm-funnel__count crm-num">
                      {formatViCount(matched.length)} cơ hội · {formatVndCompact(sumVnd)}
                    </span>
                  </div>
                  <div className="crm-funnel__track" aria-hidden="true">
                    <div
                      className={`crm-funnel__fill crm-funnel__fill--${OPPORTUNITY_STAGE_BAR_TONE[stage]}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </article>

        <nav className="qx-card crm-quick-nav" aria-label="Truy cập nhanh phân hệ QCRM">
          <div className="crm-quick-nav__head">
            <h2>Phân mục nghiệp vụ</h2>
            <p>Đi tới danh sách chi tiết từng mảng</p>
          </div>

          <div className="crm-quick-nav__list">
            <Link href="/crm" className="crm-quick-card">
              <div className="crm-quick-card__main">
                <span className="crm-quick-card__title">Khách hàng</span>
                <p className="crm-quick-card__meta crm-num">{formatViCount(customers.length)} hồ sơ</p>
              </div>
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>

            <Link href="/crm?muc=co-hoi" className="crm-quick-card">
              <div className="crm-quick-card__main">
                <span className="crm-quick-card__title">Cơ hội bán hàng</span>
                <p className="crm-quick-card__meta crm-num">
                  {formatViCount(openDeals.length)} cơ hội đang mở
                </p>
              </div>
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>

            <Link href="/crm?muc=lien-he" className="crm-quick-card">
              <div className="crm-quick-card__main">
                <span className="crm-quick-card__title">Liên hệ</span>
                <p className="crm-quick-card__meta crm-num">{formatViCount(contacts.length)} đầu mối</p>
              </div>
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>

            <Link href="/crm?muc=bao-cao" className="crm-quick-card">
              <div className="crm-quick-card__main">
                <span className="crm-quick-card__title">Báo cáo</span>
                <p className="crm-quick-card__meta">Hiệu suất & xuất CSV</p>
              </div>
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>
        </nav>
      </div>

      <div className="crm-overview-grid">
        <article className="qx-card crm-overview-card">
          <div className="crm-overview-card__head">
            <div>
              <h2>Cơ hội sắp đến hạn chốt</h2>
              <p>Các cơ hội đang mở có ngày dự kiến chốt gần nhất</p>
            </div>
            <Link href="/crm?muc=co-hoi" className="crm-overview-link">
              Xem tất cả
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>

          {upcomingOpportunities.length === 0 ? (
            <div className="crm-empty">Chưa có cơ hội đang mở sắp đến hạn chốt</div>
          ) : (
            <ul className="crm-overview-list">
              {upcomingOpportunities.map((opp) => (
                <li key={opp.id} className="crm-overview-row">
                  <div className="crm-overview-row__main">
                    <span className="crm-overview-row__title">
                      <span className="crm-num crm-code">{opp.code}</span> · {opp.name}
                    </span>
                    <span className="crm-overview-row__sub crm-num">
                      {opp.customerName} · Chốt dự kiến: {formatCrmRelativeDate(opp.expectedCloseIso)} (
                      {formatCrmDate(opp.expectedCloseIso)})
                    </span>
                  </div>
                  <div className="crm-overview-row__right">
                    <span className="crm-num qx-table__strong">{formatVndCompact(opp.amountVnd)}</span>
                    <span className={`qx-badge ${OPPORTUNITY_STAGE_BADGE[opp.stage]}`}>
                      {opp.stage}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="qx-card crm-overview-card">
          <div className="crm-overview-card__head">
            <div>
              <h2>Tương tác đầu mối gần đây</h2>
              <p>Hoạt động trao đổi mới nhất theo đầu mối khách hàng</p>
            </div>
            <Link href="/crm?muc=lien-he" className="crm-overview-link">
              Xem liên hệ
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>

          {recentContacts.length === 0 ? (
            <div className="crm-empty">Chưa có tương tác đầu mối nào được ghi nhận</div>
          ) : (
            <ul className="crm-overview-list">
              {recentContacts.map((ct) => (
                <li key={ct.id} className="crm-overview-row">
                  <div className="crm-overview-row__main">
                    <span className="crm-overview-row__title">
                      {ct.fullName} · {ct.jobTitle}
                    </span>
                    <span className="crm-overview-row__sub crm-num">
                      {ct.customerName} · {ct.channel} · {formatCrmRelativeDate(ct.lastInteractionIso)}
                    </span>
                  </div>
                  <div className="crm-overview-row__right">
                    <span className={`qx-badge ${CONTACT_ROLE_BADGE[ct.contactRole]}`}>
                      {ct.contactRole}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
