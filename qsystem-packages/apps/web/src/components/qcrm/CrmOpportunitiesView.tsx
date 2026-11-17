'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  ResponsiveDetailDrawer,
  Select,
  toast,
  useFloatingLayer,
  type SelectOption,
} from '@qsystem/ui';
import { addLocalDaysIso, getLocalDateIso } from '../../lib/date';
import { CrmRowMenu } from './CrmRowMenu';
import {
  formatCrmDate,
  formatCrmRelativeDate,
  formatViCount,
  formatVnd,
  formatVndCompact,
  getIsoDaysDiff,
  nextOpportunityCode,
  OPEN_OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_BADGE,
  OPPORTUNITY_STAGE_PROBABILITY,
  OPPORTUNITY_STAGES,
  ownerInitialsOf,
  sanitizeCrmCell,
  toneForOwner,
  type CustomerRow,
  type OpportunityRow,
  type OpportunityStage,
} from './crm.storage';

type StageTabFilter = 'all' | OpportunityStage;

const STAGE_OPTIONS: readonly SelectOption<OpportunityStage>[] = OPPORTUNITY_STAGES.map((stage) => ({
  value: stage,
  label: stage,
}));

const NEXT_OPEN_STAGE: Partial<Record<OpportunityStage, OpportunityStage>> = {
  'Tiếp cận': 'Khảo sát',
  'Khảo sát': 'Báo giá',
  'Báo giá': 'Đàm phán',
  'Đàm phán': 'Chốt thành công',
};

function CreateOpportunityModal({
  open,
  onOpenChange,
  customers,
  ownerNames,
  existingOpportunities,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: readonly CustomerRow[];
  ownerNames: readonly string[];
  existingOpportunities: readonly OpportunityRow[];
  onCreated: (opp: OpportunityRow) => void;
}) {
  if (!open) return null;
  return (
    <CreateOpportunityDialog
      onOpenChange={onOpenChange}
      customers={customers}
      ownerNames={ownerNames}
      existingOpportunities={existingOpportunities}
      onCreated={onCreated}
    />
  );
}

function CreateOpportunityDialog({
  onOpenChange,
  customers,
  ownerNames,
  existingOpportunities,
  onCreated,
}: {
  onOpenChange: (open: boolean) => void;
  customers: readonly CustomerRow[];
  ownerNames: readonly string[];
  existingOpportunities: readonly OpportunityRow[];
  onCreated: (opp: OpportunityRow) => void;
}) {
  const defaultCustomerId = customers[0]?.id ?? '';
  const defaultOwner = ownerNames[0] ?? 'Lan Anh';

  const [name, setName] = React.useState('');
  const [customerId, setCustomerId] = React.useState(defaultCustomerId);
  const [amountInput, setAmountInput] = React.useState('250000000');
  const [expectedCloseIso, setExpectedCloseIso] = React.useState(() => addLocalDaysIso(14));
  const [stage, setStage] = React.useState<OpportunityStage>('Tiếp cận');
  const [probabilityInput, setProbabilityInput] = React.useState(
    String(OPPORTUNITY_STAGE_PROBABILITY['Tiếp cận']),
  );
  const [probabilityTouched, setProbabilityTouched] = React.useState(false);
  const [ownerName, setOwnerName] = React.useState(defaultOwner);
  const [notes, setNotes] = React.useState('');
  const [errors, setErrors] = React.useState<{
    name?: string;
    customerId?: string;
    amount?: string;
    expectedCloseIso?: string;
    probability?: string;
  }>({});

  const modalRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descId = React.useId();
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  useFloatingLayer(true, close, true, { root: modalRef });

  const customerOptions = React.useMemo<SelectOption<string>[]>(
    () => customers.map((c) => ({ value: c.id, label: c.name, description: c.industry })),
    [customers],
  );

  const ownerOptions = React.useMemo<SelectOption<string>[]>(
    () => ownerNames.map((o) => ({ value: o, label: o })),
    [ownerNames],
  );

  function handleStageChange(nextStage: OpportunityStage) {
    setStage(nextStage);
    if (!probabilityTouched) {
      setProbabilityInput(String(OPPORTUNITY_STAGE_PROBABILITY[nextStage]));
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedName = sanitizeCrmCell(name);
    const parsedAmount = Number(amountInput.replace(/[^\d]/g, ''));
    const parsedProb = Number(probabilityInput);
    const nextErrors: typeof errors = {};

    if (!trimmedName) nextErrors.name = 'Vui lòng nhập tên cơ hội.';
    if (!customerId) nextErrors.customerId = 'Vui lòng chọn khách hàng.';
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      nextErrors.amount = 'Giá trị dự kiến phải lớn hơn 0 VNĐ.';
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expectedCloseIso)) {
      nextErrors.expectedCloseIso = 'Vui lòng chọn ngày dự kiến chốt hợp lệ.';
    }
    if (!Number.isFinite(parsedProb) || parsedProb < 0 || parsedProb > 100) {
      nextErrors.probability = 'Xác suất phải từ 0% đến 100%.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const customer = customers.find((c) => c.id === customerId);
    const todayIso = getLocalDateIso();
    const code = nextOpportunityCode(existingOpportunities);
    const finalOwner = sanitizeCrmCell(ownerName) || 'Lan Anh';
    const isClosed = stage === 'Chốt thành công' || stage === 'Thất bại';

    onCreated({
      id: `opp-${Date.now()}`,
      code,
      name: trimmedName,
      customerId,
      customerName: customer?.name ?? 'Khách hàng mới',
      amountVnd: Math.round(parsedAmount),
      expectedCloseIso,
      stage,
      probability: Math.round(parsedProb),
      ownerName: finalOwner,
      ownerInitials: ownerInitialsOf(finalOwner),
      ownerTone: toneForOwner(finalOwner),
      createdAtIso: todayIso,
      closedAtIso: isClosed ? todayIso : undefined,
      notes: sanitizeCrmCell(notes),
    });
    onOpenChange(false);
  }

  const dialog = (
    <div
      className="crm-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={modalRef}
        className="crm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
      >
        <div className="crm-modal__head">
          <h2 id={titleId}>Thêm cơ hội bán hàng</h2>
          <p id={descId}>Ghi nhận cơ hội mới kèm giá trị dự kiến, ngày chốt và giai đoạn</p>
          <button type="button" className="crm-modal__close" aria-label="Đóng hộp thoại" onClick={close}>
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="crm-modal__body">
            <div className="crm-field crm-field--full">
              <label htmlFor="opp-name">Tên cơ hội *</label>
              <input
                id="opp-name"
                className="crm-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Triển khai gói quản trị doanh nghiệp"
              />
              {errors.name ? (
                <p className="crm-error" role="alert">
                  {errors.name}
                </p>
              ) : null}
            </div>

            <div className="crm-field">
              <label htmlFor="opp-customer">Khách hàng *</label>
              <Select<string>
                id="opp-customer"
                value={customerId}
                onValueChange={setCustomerId}
                options={customerOptions}
                placeholder="Chọn khách hàng"
                error={Boolean(errors.customerId)}
                aria-label="Khách hàng"
              />
              {errors.customerId ? (
                <p className="crm-error" role="alert">
                  {errors.customerId}
                </p>
              ) : null}
            </div>

            <div className="crm-field">
              <label htmlFor="opp-amount">Giá trị dự kiến (VNĐ) *</label>
              <input
                id="opp-amount"
                type="number"
                min={0}
                step={1000000}
                className="crm-input crm-num"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
              />
              {errors.amount ? (
                <p className="crm-error" role="alert">
                  {errors.amount}
                </p>
              ) : null}
            </div>

            <div className="crm-field">
              <label htmlFor="opp-close-date">Ngày dự kiến chốt *</label>
              <input
                id="opp-close-date"
                type="date"
                className="crm-input crm-num"
                value={expectedCloseIso}
                onChange={(e) => setExpectedCloseIso(e.target.value)}
              />
              {errors.expectedCloseIso ? (
                <p className="crm-error" role="alert">
                  {errors.expectedCloseIso}
                </p>
              ) : null}
            </div>

            <div className="crm-field">
              <label htmlFor="opp-stage">Giai đoạn</label>
              <Select<OpportunityStage>
                id="opp-stage"
                value={stage}
                onValueChange={handleStageChange}
                options={STAGE_OPTIONS}
                aria-label="Giai đoạn"
              />
            </div>

            <div className="crm-field">
              <label htmlFor="opp-prob">Xác suất (%)</label>
              <input
                id="opp-prob"
                type="number"
                min={0}
                max={100}
                className="crm-input crm-num"
                value={probabilityInput}
                onChange={(e) => {
                  setProbabilityTouched(true);
                  setProbabilityInput(e.target.value);
                }}
              />
              {errors.probability ? (
                <p className="crm-error" role="alert">
                  {errors.probability}
                </p>
              ) : null}
            </div>

            <div className="crm-field">
              <label htmlFor="opp-owner">Phụ trách</label>
              <Select<string>
                id="opp-owner"
                value={ownerName}
                onValueChange={setOwnerName}
                options={ownerOptions}
                aria-label="Phụ trách"
              />
            </div>

            <div className="crm-field crm-field--full">
              <label htmlFor="opp-notes">Ghi chú</label>
              <textarea
                id="opp-notes"
                rows={3}
                className="crm-textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Bối cảnh nhu cầu, hạng mục trọng tâm hoặc bước tiếp theo"
              />
            </div>
          </div>

          <div className="crm-modal__foot">
            <button type="button" className="qx-btn" onClick={close}>
              Hủy
            </button>
            <button type="submit" className="qx-btn qx-btn--primary">
              <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
              Lưu cơ hội
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(dialog, document.body);
}

function OpportunityDetailContent({
  opportunity,
  ownerOptions,
  onSave,
  onAdvanceStage,
}: {
  opportunity: OpportunityRow;
  ownerOptions: readonly SelectOption<string>[];
  onSave: (patch: Partial<OpportunityRow>) => void;
  onAdvanceStage: () => void;
}) {
  const [stage, setStage] = React.useState<OpportunityStage>(opportunity.stage);
  const [amountInput, setAmountInput] = React.useState(String(opportunity.amountVnd));
  const [expectedCloseIso, setExpectedCloseIso] = React.useState(opportunity.expectedCloseIso);
  const [probabilityInput, setProbabilityInput] = React.useState(String(opportunity.probability));
  const [ownerName, setOwnerName] = React.useState(opportunity.ownerName);
  const [notes, setNotes] = React.useState(opportunity.notes);

  React.useEffect(() => {
    setStage(opportunity.stage);
    setAmountInput(String(opportunity.amountVnd));
    setExpectedCloseIso(opportunity.expectedCloseIso);
    setProbabilityInput(String(opportunity.probability));
    setOwnerName(opportunity.ownerName);
    setNotes(opportunity.notes);
  }, [opportunity]);

  const nextStage = NEXT_OPEN_STAGE[opportunity.stage];

  function handleStageChange(next: OpportunityStage) {
    setStage(next);
    setProbabilityInput(String(OPPORTUNITY_STAGE_PROBABILITY[next]));
    const todayIso = getLocalDateIso();
    const isClosed = next === 'Chốt thành công' || next === 'Thất bại';
    onSave({
      stage: next,
      probability: OPPORTUNITY_STAGE_PROBABILITY[next],
      closedAtIso: isClosed ? todayIso : undefined,
    });
  }

  function handleSaveDetails(event: React.FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(amountInput.replace(/[^\d]/g, ''));
    const parsedProb = Math.max(0, Math.min(100, Number(probabilityInput) || 0));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Giá trị dự kiến phải lớn hơn 0 VNĐ.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expectedCloseIso)) {
      toast.error('Ngày dự kiến chốt chưa hợp lệ.');
      return;
    }
    const todayIso = getLocalDateIso();
    const isClosed = stage === 'Chốt thành công' || stage === 'Thất bại';
    onSave({
      amountVnd: Math.round(parsedAmount),
      expectedCloseIso,
      stage,
      probability: Math.round(parsedProb),
      ownerName,
      ownerInitials: ownerInitialsOf(ownerName),
      ownerTone: toneForOwner(ownerName),
      closedAtIso: isClosed ? (opportunity.closedAtIso ?? todayIso) : undefined,
      notes: sanitizeCrmCell(notes),
    });
  }

  return (
    <form className="crm-drawer-stack" onSubmit={handleSaveDetails}>
      <dl className="qs-attribute-list">
        <div className="qs-attribute-list__row">
          <dt className="qs-attribute-list__label">Mã cơ hội</dt>
          <dd className="qs-attribute-list__value crm-num">{opportunity.code}</dd>
        </div>
        <div className="qs-attribute-list__row">
          <dt className="qs-attribute-list__label">Khách hàng</dt>
          <dd className="qs-attribute-list__value">{opportunity.customerName}</dd>
        </div>
        <div className="qs-attribute-list__row">
          <dt className="qs-attribute-list__label">Ngày tạo</dt>
          <dd className="qs-attribute-list__value crm-num">
            {formatCrmDate(opportunity.createdAtIso)}
          </dd>
        </div>
      </dl>

      <div className="crm-field">
        <label htmlFor="opp-detail-stage">Giai đoạn bán hàng</label>
        <Select<OpportunityStage>
          id="opp-detail-stage"
          value={stage}
          onValueChange={handleStageChange}
          options={STAGE_OPTIONS}
          aria-label="Giai đoạn bán hàng"
        />
      </div>

      <div className="crm-drawer-grid">
        <div className="crm-field">
          <label htmlFor="opp-detail-amount">Giá trị dự kiến (VNĐ)</label>
          <input
            id="opp-detail-amount"
            type="number"
            min={0}
            step={1000000}
            className="crm-input crm-num"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
          />
        </div>

        <div className="crm-field">
          <label htmlFor="opp-detail-prob">Xác suất (%)</label>
          <input
            id="opp-detail-prob"
            type="number"
            min={0}
            max={100}
            className="crm-input crm-num"
            value={probabilityInput}
            onChange={(e) => setProbabilityInput(e.target.value)}
          />
        </div>
      </div>

      <div className="crm-drawer-grid">
        <div className="crm-field">
          <label htmlFor="opp-detail-close">Ngày dự kiến chốt</label>
          <input
            id="opp-detail-close"
            type="date"
            className="crm-input crm-num"
            value={expectedCloseIso}
            onChange={(e) => setExpectedCloseIso(e.target.value)}
          />
        </div>

        <div className="crm-field">
          <label htmlFor="opp-detail-owner">Phụ trách</label>
          <Select<string>
            id="opp-detail-owner"
            value={ownerName}
            onValueChange={setOwnerName}
            options={ownerOptions}
            aria-label="Phụ trách"
          />
        </div>
      </div>

      <div className="crm-field">
        <label htmlFor="opp-detail-notes">Ghi chú trao đổi</label>
        <textarea
          id="opp-detail-notes"
          rows={3}
          className="crm-textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Cập nhật diễn biến thương lượng"
        />
      </div>

      <div className="crm-drawer-actions">
        {nextStage ? (
          <button type="button" className="qx-btn qx-btn--sm" onClick={onAdvanceStage}>
            Chuyển sang {nextStage}
          </button>
        ) : null}
        <button type="submit" className="qx-btn qx-btn--sm">
          Lưu thay đổi
        </button>
      </div>
    </form>
  );
}

export interface CrmOpportunitiesViewProps {
  opportunities: OpportunityRow[];
  customers: CustomerRow[];
  ownerNames: readonly string[];
  initialSelectedId?: string | null;
  onUpdateOpportunities: (next: OpportunityRow[]) => void;
}

export function CrmOpportunitiesView({
  opportunities,
  customers,
  ownerNames,
  initialSelectedId = null,
  onUpdateOpportunities,
}: CrmOpportunitiesViewProps) {
  const [stageTab, setStageTab] = React.useState<StageTabFilter>('all');
  const [ownerFilter, setOwnerFilter] = React.useState<string>('all');
  const [search, setSearch] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [detailOppId, setDetailOppId] = React.useState<string | null>(initialSelectedId);
  const [openRowMenuId, setOpenRowMenuId] = React.useState<string | null>(null);
  const pageRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (initialSelectedId) setDetailOppId(initialSelectedId);
  }, [initialSelectedId]);

  React.useEffect(() => {
    if (!openRowMenuId) return;
    function onDocClick(event: MouseEvent) {
      if (!pageRef.current?.contains(event.target as Node)) setOpenRowMenuId(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenRowMenuId(null);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openRowMenuId]);

  const ownerFilterOptions = React.useMemo<SelectOption<string>[]>(
    () => [
      { value: 'all', label: 'Tất cả phụ trách' },
      ...ownerNames.map((name) => ({ value: name, label: name })),
    ],
    [ownerNames],
  );

  const ownerSelectOptions = React.useMemo<SelectOption<string>[]>(
    () => ownerNames.map((name) => ({ value: name, label: name })),
    [ownerNames],
  );

  const openDeals = opportunities.filter((o) => OPEN_OPPORTUNITY_STAGES.has(o.stage));
  const wonDeals = opportunities.filter((o) => o.stage === 'Chốt thành công');
  const openPipelineVnd = openDeals.reduce((sum, o) => sum + o.amountVnd, 0);
  const weightedPipelineVnd = openDeals.reduce(
    (sum, o) => sum + Math.round((o.amountVnd * o.probability) / 100),
    0,
  );
  const wonRevenueVnd = wonDeals.reduce((sum, o) => sum + o.amountVnd, 0);

  const normalizedQuery = search.trim().toLowerCase();
  const visibleOpportunities = opportunities.filter((opp) => {
    if (stageTab !== 'all' && opp.stage !== stageTab) return false;
    if (ownerFilter !== 'all' && opp.ownerName !== ownerFilter) return false;
    if (!normalizedQuery) return true;
    return (
      opp.code.toLowerCase().includes(normalizedQuery) ||
      opp.name.toLowerCase().includes(normalizedQuery) ||
      opp.customerName.toLowerCase().includes(normalizedQuery) ||
      opp.ownerName.toLowerCase().includes(normalizedQuery)
    );
  });

  function updateOpportunity(id: string, patch: Partial<OpportunityRow>, toastMsg?: string) {
    const next = opportunities.map((item) => (item.id === id ? { ...item, ...patch } : item));
    onUpdateOpportunities(next);
    if (toastMsg) toast.success(toastMsg);
  }

  function advanceOpportunityStage(opp: OpportunityRow) {
    const nextStage = NEXT_OPEN_STAGE[opp.stage];
    if (!nextStage) return;
    const todayIso = getLocalDateIso();
    const isClosed = nextStage === 'Chốt thành công' || nextStage === 'Thất bại';
    updateOpportunity(
      opp.id,
      {
        stage: nextStage,
        probability: OPPORTUNITY_STAGE_PROBABILITY[nextStage],
        closedAtIso: isClosed ? todayIso : undefined,
      },
      `Đã chuyển ${opp.code} sang ${nextStage}`,
    );
    setOpenRowMenuId(null);
  }

  function deleteOpportunity(opp: OpportunityRow) {
    const next = opportunities.filter((item) => item.id !== opp.id);
    onUpdateOpportunities(next);
    setOpenRowMenuId(null);
    if (detailOppId === opp.id) setDetailOppId(null);
    toast.success(`Đã xóa cơ hội ${opp.code}`);
  }

  const detailOpportunity = detailOppId
    ? (opportunities.find((o) => o.id === detailOppId) ?? null)
    : null;

  return (
    <section className="qx-page crm-page" aria-label="Cơ hội bán hàng" ref={pageRef}>
      <header className="qx-page-head">
        <div>
          <h1>Cơ hội bán hàng</h1>
          <p>Theo dõi giá trị dự kiến, ngày chốt và xác suất qua từng giai đoạn bán hàng</p>
        </div>
        <div className="qx-actions">
          <button
            type="button"
            className="qx-btn qx-btn--primary"
            onClick={() => setCreating(true)}
          >
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            Thêm cơ hội
          </button>
        </div>
      </header>

      <div className="qx-stats" aria-label="Thống kê cơ hội bán hàng">
        <article className="qx-stat">
          <div className="qx-stat__label">Cơ hội đang mở</div>
          <div className="qx-stat__value">{formatViCount(openDeals.length)}</div>
          <div className="qx-stat__note">Trên 4 giai đoạn đang xử lý</div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Giá trị pipeline đang mở</div>
          <div className="qx-stat__value crm-stat-value--compact">{formatVndCompact(openPipelineVnd)}</div>
          <div className="qx-stat__note crm-num">{formatVnd(openPipelineVnd)}</div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Giá trị theo xác suất</div>
          <div className="qx-stat__value crm-stat-value--compact">{formatVndCompact(weightedPipelineVnd)}</div>
          <div className="qx-stat__note crm-num">{formatVnd(weightedPipelineVnd)}</div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Chốt thành công</div>
          <div className="qx-stat__value">{formatViCount(wonDeals.length)}</div>
          <div className="qx-stat__note crm-num">{formatVndCompact(wonRevenueVnd)}</div>
        </article>
      </div>

      <div className="crm-split-layout">
        <div className="qx-card crm-list crm-split-main">
          <div className="qx-card__head">
            <h2 className="qx-card__title">
              Danh sách cơ hội
              <span className="qx-count">{formatViCount(visibleOpportunities.length)}</span>
            </h2>
            <div className="crm-filter-controls">
              <div className="crm-select-inline">
                <Select<string>
                  value={ownerFilter}
                  onValueChange={setOwnerFilter}
                  options={ownerFilterOptions}
                  controlSize="sm"
                  aria-label="Lọc cơ hội theo phụ trách"
                />
              </div>
            </div>
          </div>

          <div className="crm-toolbar">
            <div className="qx-tabs crm-tabs--scroll" role="tablist" aria-label="Giai đoạn cơ hội">
              <button
                type="button"
                role="tab"
                className="qx-tab"
                aria-selected={stageTab === 'all'}
                onClick={() => setStageTab('all')}
              >
                Tất cả ({formatViCount(opportunities.length)})
              </button>
              {OPPORTUNITY_STAGES.map((stageName) => {
                const count = opportunities.filter((o) => o.stage === stageName).length;
                return (
                  <button
                    key={stageName}
                    type="button"
                    role="tab"
                    className="qx-tab"
                    aria-selected={stageTab === stageName}
                    onClick={() => setStageTab(stageName)}
                  >
                    {stageName} ({formatViCount(count)})
                  </button>
                );
              })}
            </div>

            <label className="qx-field-search">
              <Search size={16} strokeWidth={1.5} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm mã, tên cơ hội, khách hàng"
                aria-label="Tìm cơ hội bán hàng"
              />
            </label>
          </div>

          <div className="crm-table-wrap">
            {visibleOpportunities.length === 0 ? (
              <div className="crm-empty">Chưa có cơ hội nào khớp với bộ lọc hiện tại</div>
            ) : (
              <table className="qx-table" aria-label="Danh sách cơ hội bán hàng">
                <thead>
                  <tr>
                    <th scope="col">Mã cơ hội</th>
                    <th scope="col">Tên cơ hội</th>
                    <th scope="col">Khách hàng</th>
                    <th scope="col">Giá trị dự kiến</th>
                    <th scope="col">Ngày dự kiến chốt</th>
                    <th scope="col">Giai đoạn</th>
                    <th scope="col">Xác suất (%)</th>
                    <th scope="col">Phụ trách</th>
                    <th scope="col" aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {visibleOpportunities.map((opp) => {
                    const isOpen = OPEN_OPPORTUNITY_STAGES.has(opp.stage);
                    const daysLeft = getIsoDaysDiff(opp.expectedCloseIso);
                    const overdueOpen = isOpen && Number.isFinite(daysLeft) && daysLeft < 0;
                    const relativeText = formatCrmRelativeDate(opp.expectedCloseIso);
                    const dateDisplay = formatCrmDate(opp.expectedCloseIso);
                    return (
                      <tr
                        key={opp.id}
                        className="is-clickable"
                        aria-selected={detailOppId === opp.id ? 'true' : undefined}
                        onClick={(event) => {
                          if ((event.target as HTMLElement).closest('button, a, input, [role="menu"]')) {
                            return;
                          }
                          setDetailOppId(opp.id);
                        }}
                      >
                        <td className="crm-num crm-code">{opp.code}</td>
                        <td>
                          <span className="qx-table__strong">{opp.name}</span>
                        </td>
                        <td>{opp.customerName}</td>
                        <td className="crm-num qx-table__strong">{formatVnd(opp.amountVnd)}</td>
                        <td className="crm-num">
                          <span className={overdueOpen ? 'crm-date--overdue' : undefined}>
                            {dateDisplay}
                          </span>
                          {relativeText !== dateDisplay ? (
                            <span className="crm-date-hint"> · {relativeText}</span>
                          ) : null}
                        </td>
                        <td>
                          <span className={`qx-badge ${OPPORTUNITY_STAGE_BADGE[opp.stage]}`}>
                            {opp.stage}
                          </span>
                        </td>
                        <td className="crm-num">{opp.probability}%</td>
                        <td>
                          <span className="qx-person crm-owner">
                            <span className="qx-avatar qx-avatar--sm" aria-hidden="true">
                              {opp.ownerInitials}
                            </span>
                            <span>{opp.ownerName}</span>
                          </span>
                        </td>
                        <td className="crm-row-actions">
                          <CrmRowMenu
                            open={openRowMenuId === opp.id}
                            onOpenChange={(nextOpen) => setOpenRowMenuId(nextOpen ? opp.id : null)}
                            triggerLabel={`Thao tác với ${opp.code}`}
                            menuLabel={`Thao tác ${opp.code}`}
                          >
                            <button
                              type="button"
                              role="menuitem"
                              className="crm-row-menu__item"
                              onClick={() => {
                                setOpenRowMenuId(null);
                                setDetailOppId(opp.id);
                              }}
                            >
                              Xem chi tiết cơ hội
                            </button>
                            {NEXT_OPEN_STAGE[opp.stage] ? (
                              <button
                                type="button"
                                role="menuitem"
                                className="crm-row-menu__item"
                                onClick={() => advanceOpportunityStage(opp)}
                              >
                                Chuyển sang {NEXT_OPEN_STAGE[opp.stage]}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              role="menuitem"
                              className="crm-row-menu__item crm-row-menu__item--danger"
                              onClick={() => deleteOpportunity(opp)}
                            >
                              Xóa cơ hội
                            </button>
                          </CrmRowMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <ResponsiveDetailDrawer
          open={Boolean(detailOpportunity)}
          onClose={() => setDetailOppId(null)}
          title={detailOpportunity?.name ?? ''}
          subtitle={
            detailOpportunity
              ? `${detailOpportunity.code} · ${detailOpportunity.customerName}`
              : ''
          }
        >
          {detailOpportunity ? (
            <OpportunityDetailContent
              opportunity={detailOpportunity}
              ownerOptions={ownerSelectOptions}
              onSave={(patch) =>
                updateOpportunity(
                  detailOpportunity.id,
                  patch,
                  `Đã cập nhật cơ hội ${detailOpportunity.code}`,
                )
              }
              onAdvanceStage={() => advanceOpportunityStage(detailOpportunity)}
            />
          ) : null}
        </ResponsiveDetailDrawer>
      </div>

      <CreateOpportunityModal
        open={creating}
        onOpenChange={setCreating}
        customers={customers}
        ownerNames={ownerNames}
        existingOpportunities={opportunities}
        onCreated={(created) => {
          onUpdateOpportunities([created, ...opportunities]);
          toast.success(`Đã thêm cơ hội ${created.code}`);
        }}
      />
    </section>
  );
}
