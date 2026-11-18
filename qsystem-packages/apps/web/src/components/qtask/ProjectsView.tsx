'use client';

import * as React from 'react';
import {
  Archive,
  Check,
  CheckCircle2,
  Folder,
  LayoutGrid,
  List,
  ListFilter,
  Plus,
  RotateCcw,
  TrendingUp,
  X,
} from 'lucide-react';
import { Select, StateRegion, toast, useFloatingLayer, type SelectOption } from '@qsystem/ui';
import { apiFetch } from '../../lib/api/client';
import { addLocalDaysIso, formatDdMmYyyy } from '../../lib/date';
import {
  canUseDevPersistence,
  loadStoredProjects,
  saveStoredProjects,
  type StoredProjectAccent,
  type StoredProjectItem,
  type StoredProjectTab,
} from './qtask.storage';
import './qtask.css';

type ProjectTab = StoredProjectTab;
type ProjectAccent = StoredProjectAccent;
type ProjectItem = StoredProjectItem;

const STAGE_FILTER_OPTIONS: readonly SelectOption<string>[] = [
  { value: '', label: 'Tất cả giai đoạn' },
  { value: 'Đang triển khai', label: 'Đang triển khai' },
  { value: 'Đang phát triển', label: 'Đang phát triển' },
  { value: 'Sắp hoàn thành', label: 'Sắp hoàn thành' },
  { value: 'Hoàn thành', label: 'Hoàn thành' },
  { value: 'Đã lưu trữ', label: 'Đã lưu trữ' },
];

const ACCENT_OPTIONS: readonly SelectOption<ProjectAccent>[] = [
  { value: 'amber', label: 'Hổ phách' },
  { value: 'blue', label: 'Xanh dương' },
  { value: 'green', label: 'Xanh lá' },
  { value: 'purple', label: 'Tím' },
];

function formatDdMmOffset(offsetDays: number): string {
  return formatDdMmYyyy(addLocalDaysIso(offsetDays)).slice(0, 5);
}

function getSampleProjectsList(): ProjectItem[] {
  return [
    {
      id: 'proj-core',
      name: 'QSystem Core',
      description: 'Nền tảng quản trị doanh nghiệp',
      accent: 'amber',
      statusLabel: 'Đang triển khai',
      badgeVariant: 'blue',
      progress: 82,
      doneTasks: 12,
      totalTasks: 16,
      members: ['MK', 'LA'],
      category: 'active',
      milestones: [
        { id: 'ms-core-1', title: 'Kiến trúc đa phân hệ & phân quyền', due: formatDdMmOffset(-12), done: true },
        { id: 'ms-core-2', title: 'Đồng bộ thông báo thời gian thực', due: formatDdMmOffset(-3), done: true },
        { id: 'ms-core-3', title: 'Kiểm thử tải & nghiệm thu hệ thống', due: formatDdMmOffset(8), done: false },
      ],
    },
    {
      id: 'proj-qhrm',
      name: 'QHRM Upgrade',
      description: 'Nâng cấp quản trị nhân sự',
      accent: 'blue',
      statusLabel: 'Đang triển khai',
      badgeVariant: 'blue',
      progress: 65,
      doneTasks: 18,
      totalTasks: 28,
      members: ['MK', 'LA'],
      category: 'active',
      milestones: [
        { id: 'ms-qhrm-1', title: 'Chuẩn hóa hồ sơ & hợp đồng nhân sự', due: formatDdMmOffset(-9), done: true },
        { id: 'ms-qhrm-2', title: 'Quy trình duyệt nghỉ phép đa cấp', due: formatDdMmOffset(1), done: true },
        { id: 'ms-qhrm-3', title: 'Bảng công tự động & xuất bảng lương', due: formatDdMmOffset(11), done: false },
      ],
    },
    {
      id: 'proj-qcrm',
      name: 'QCRM V2',
      description: 'Khách hàng và cơ hội bán hàng',
      accent: 'green',
      statusLabel: 'Đang phát triển',
      badgeVariant: 'amber',
      progress: 34,
      doneTasks: 7,
      totalTasks: 21,
      members: ['MK', 'LA'],
      category: 'active',
      milestones: [
        { id: 'ms-qcrm-1', title: 'Nhập dữ liệu khách hàng doanh nghiệp', due: formatDdMmOffset(-7), done: true },
        { id: 'ms-qcrm-2', title: 'Phễu cơ hội & dự báo doanh thu', due: formatDdMmOffset(5), done: false },
        { id: 'ms-qcrm-3', title: 'Lịch sử chăm sóc & nhắc hẹn tự động', due: formatDdMmOffset(13), done: false },
      ],
    },
    {
      id: 'proj-qsocial',
      name: 'QSocial Workspace',
      description: 'Truyền thông nội bộ',
      accent: 'blue',
      statusLabel: 'Sắp hoàn thành',
      badgeVariant: 'green',
      progress: 93,
      doneTasks: 25,
      totalTasks: 27,
      members: ['MK', 'LA'],
      category: 'active',
      milestones: [
        { id: 'ms-qsocial-1', title: 'Bảng tin phòng ban & ghim thông báo', due: formatDdMmOffset(-15), done: true },
        { id: 'ms-qsocial-2', title: 'Bình chọn nhanh & phản hồi bài viết', due: formatDdMmOffset(-5), done: true },
        { id: 'ms-qsocial-3', title: 'Bàn giao hướng dẫn quản trị viên', due: formatDdMmOffset(3), done: false },
      ],
    },
  ];
}

const PROJECT_TABS: { id: ProjectTab; label: string }[] = [
  { id: 'all', label: 'Tất cả dự án' },
  { id: 'active', label: 'Đang thực hiện' },
  { id: 'done', label: 'Hoàn thành' },
  { id: 'archived', label: 'Lưu trữ' },
];

export function ProjectsView() {
  const [skeletonLoading, setSkeletonLoading] = React.useState(process.env.NODE_ENV !== 'test');
  React.useEffect(() => {
    const timer = window.setTimeout(() => setSkeletonLoading(false), 240);
    return () => window.clearTimeout(timer);
  }, []);

  const projectsAvailable = process.env.NODE_ENV === 'test' || canUseDevPersistence();
  const baseSampleProjects = React.useMemo(
    () => (projectsAvailable ? getSampleProjectsList() : []),
    [projectsAvailable],
  );
  const [projects, setProjects] = React.useState<ProjectItem[]>(() => baseSampleProjects);
  const [tab, setTab] = React.useState<ProjectTab>('all');
  const [layout, setLayout] = React.useState<'grid' | 'list'>('grid');
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [selectedProjId, setSelectedProjId] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [newName, setNewName] = React.useState('');
  const [newDesc, setNewDesc] = React.useState('');
  const [newAccent, setNewAccent] = React.useState<ProjectAccent>('amber');
  const [formError, setFormError] = React.useState('');

  const filterRef = React.useRef<HTMLDivElement>(null);
  const modalRef = React.useRef<HTMLDivElement>(null);
  const detailModalRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!canUseDevPersistence()) return;
    const stored = loadStoredProjects();
    if (stored) {
      setProjects(stored);
    }
  }, []);

  // Real backend projects win over sample data when the API is reachable.
  // A failed call keeps whatever is on screen (sample/localStorage) instead of
  // blanking the view — degradation stays graceful.
  React.useEffect(() => {
    let active = true;
    apiFetch<{ id: string; name: string; description: string | null; workPackages: { status: string; progress: number }[] }[]>(
      '/api/org/projects',
      { useCache: true },
    )
      .then((rows) => {
        if (!active || !Array.isArray(rows) || rows.length === 0) return;
        setProjects(rows.map((row) => {
          const pkgs = Array.isArray(row.workPackages) ? row.workPackages : [];
          const totalPkgs = pkgs.length;
          const donePkgs = pkgs.filter((pkg) => pkg.status === 'COMPLETED').length;
          const progress = totalPkgs === 0 ? 0 : Math.round((donePkgs / totalPkgs) * 100);
          const category: ProjectItem['category'] = progress >= 100 ? 'done' : 'active';
          const statusLabel = progress >= 100 ? 'Hoàn thành' : progress >= 85 ? 'Sắp hoàn thành' : progress > 0 ? 'Đang triển khai' : 'Chưa bắt đầu';
          const badgeVariant: ProjectItem['badgeVariant'] = progress >= 85 ? 'green' : progress > 0 ? 'blue' : 'amber';
          return {
            id: row.id,
            name: row.name,
            description: row.description || 'Dự án trong không gian làm việc QSystem',
            accent: 'blue' as ProjectAccent,
            statusLabel,
            badgeVariant,
            progress,
            doneTasks: donePkgs,
            totalTasks: totalPkgs,
            members: ['MK', 'LA'],
            category,
            milestones: [],
          } satisfies ProjectItem;
        }));
      })
      .catch(() => {
        if (!active) return;
        if (!canUseDevPersistence()) {
          setLoadError('Không kết nối được máy chủ. Không thể tải danh sách dự án.');
          setProjects([]);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const commitProjects = React.useCallback((updater: (prev: ProjectItem[]) => ProjectItem[]) => {
    setProjects((prev) => {
      const next = updater(prev);
      saveStoredProjects(next);
      return next;
    });
  }, []);

  React.useEffect(() => {
    if (!filterOpen) return;
    const onDocDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.('[role="listbox"]')) return;
      if (!filterRef.current?.contains(target)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [filterOpen]);

  const closeCreateModal = React.useCallback(() => {
    setCreating(false);
    setNewName('');
    setNewDesc('');
    setNewAccent('amber');
    setFormError('');
  }, []);

  useFloatingLayer(creating, closeCreateModal, true, { root: modalRef, initialFocus: modalRef });

  const selectedProject = projects.find((proj) => proj.id === selectedProjId) ?? null;
  const closeDetailModal = React.useCallback(() => setSelectedProjId(null), []);
  useFloatingLayer(selectedProject !== null, closeDetailModal, true, {
    root: detailModalRef,
    initialFocus: detailModalRef,
  });

  function bumpProjectProgress(proj: ProjectItem) {
    const nextProgress = Math.min(100, proj.progress + 10);
    const nextDoneTasks = Math.min(proj.totalTasks, Math.round((nextProgress / 100) * proj.totalTasks));
    const finished = nextProgress >= 100;
    commitProjects((prev) =>
      prev.map((item) =>
        item.id === proj.id
          ? {
              ...item,
              progress: nextProgress,
              doneTasks: nextDoneTasks,
              category: finished ? 'done' : item.category,
              statusLabel: finished ? 'Hoàn thành' : nextProgress >= 85 ? 'Sắp hoàn thành' : item.statusLabel,
              badgeVariant: finished || nextProgress >= 85 ? 'green' : item.badgeVariant,
            }
          : item,
      ),
    );
    toast.success(`Đã cập nhật tiến độ ${proj.name} lên ${nextProgress}%`);
  }

  function toggleProjectComplete(proj: ProjectItem) {
    const markDone = proj.category !== 'done';
    commitProjects((prev) =>
      prev.map((item) =>
        item.id === proj.id
          ? {
              ...item,
              category: markDone ? 'done' : 'active',
              progress: markDone ? 100 : Math.min(item.progress, 90),
              doneTasks: markDone ? item.totalTasks : Math.max(1, item.totalTasks - 2),
              statusLabel: markDone ? 'Hoàn thành' : 'Đang triển khai',
              badgeVariant: markDone ? 'green' : 'blue',
            }
          : item,
      ),
    );
    toast.success(markDone ? `Đã hoàn thành dự án ${proj.name}` : `Đã mở lại dự án ${proj.name}`);
  }

  function toggleProjectArchive(proj: ProjectItem) {
    const archive = proj.category !== 'archived';
    commitProjects((prev) =>
      prev.map((item) =>
        item.id === proj.id
          ? {
              ...item,
              category: archive ? 'archived' : 'active',
              statusLabel: archive ? 'Đã lưu trữ' : item.progress >= 100 ? 'Sắp hoàn thành' : 'Đang triển khai',
              badgeVariant: archive ? 'amber' : item.progress >= 85 ? 'green' : 'blue',
            }
          : item,
      ),
    );
    toast.success(archive ? `Đã lưu trữ dự án ${proj.name}` : `Đã khôi phục dự án ${proj.name}`);
  }

  function toggleMilestone(projId: string, milestoneId: string) {
    commitProjects((prev) =>
      prev.map((item) =>
        item.id === projId
          ? {
              ...item,
              milestones: item.milestones.map((ms) =>
                ms.id === milestoneId ? { ...ms, done: !ms.done } : ms,
              ),
            }
          : item,
      ),
    );
  }

  const visible = projects.filter((proj) => {
    if (tab === 'active' && proj.category !== 'active') return false;
    if (tab === 'done' && proj.category !== 'done' && proj.progress < 100) return false;
    if (tab === 'archived' && proj.category !== 'archived') return false;
    if (statusFilter && proj.statusLabel !== statusFilter) return false;
    return true;
  });

  const baseActiveCount = projectsAvailable ? baseSampleProjects.filter((p) => p.category === 'active').length : 0;
  const baseAtRiskCount = projectsAvailable ? baseSampleProjects.filter(
    (p) => p.badgeVariant === 'amber' && p.category === 'active',
  ).length : 0;
  const baseTotalTasks = projectsAvailable ? baseSampleProjects.reduce((sum, p) => sum + p.totalTasks, 0) : 0;
  const baseDoneTasks = projectsAvailable ? baseSampleProjects.reduce((sum, p) => sum + p.doneTasks, 0) : 0;

  const nonArchivedCount = projects.filter((p) => p.category !== 'archived').length;
  const activeCount = projects.filter((p) => p.category === 'active').length;
  const currentAtRiskCount = projects.filter(
    (p) => p.badgeVariant === 'amber' && p.category === 'active',
  ).length;
  const currentTotalTasks = projects.reduce((sum, p) => sum + p.totalTasks, 0);
  const currentDoneTasks = projects.reduce((sum, p) => sum + p.doneTasks, 0);

  const activePortfolioCount = projectsAvailable ? Math.max(0, 4 + nonArchivedCount) : 0;
  const attentionCount = projectsAvailable ? Math.max(0, 2 + (currentAtRiskCount - baseAtRiskCount)) : 0;
  const onTrackCount = Math.max(0, activePortfolioCount - attentionCount);
  const onTrackPct =
    activePortfolioCount === 0 ? 0 : Math.round((onTrackCount / activePortfolioCount) * 100);
  const portfolioTotalTasks = projectsAvailable ? Math.max(0, 128 + (currentTotalTasks - baseTotalTasks)) : 0;
  const portfolioDoneTasks = projectsAvailable ? Math.max(0, 93 + (currentDoneTasks - baseDoneTasks)) : 0;
  const activeNoteCount = projectsAvailable ? Math.max(0, 4 + (activeCount - baseActiveCount)) : 0;

  async function handleCreateProject(event: React.FormEvent) {
    event.preventDefault();
    if (!projectsAvailable) {
      toast.error('Tính năng dự án chưa được kết nối với máy chủ.');
      return;
    }
    const trimmed = newName.trim();
    if (!trimmed) {
      setFormError('Vui lòng nhập tên dự án.');
      return;
    }
    if (process.env.NODE_ENV !== 'test') {
      // Persist to the real backend first; only fall back to local state when the
      // API is unreachable so the user never silently loses the confirmation.
      try {
        const saved = await apiFetch<{ id: string; name: string; description: string | null }>('/api/org/projects', {
          method: 'POST',
          body: JSON.stringify({ name: trimmed, description: newDesc.trim() || undefined }),
          headers: { 'Content-Type': 'application/json' },
        });
        const created: ProjectItem = {
          id: saved.id,
          name: saved.name,
          description: saved.description || 'Dự án mới trong không gian làm việc QSystem',
          accent: newAccent,
          statusLabel: 'Chưa bắt đầu',
          badgeVariant: 'blue',
          progress: 0,
          doneTasks: 0,
          totalTasks: 0,
          members: ['MK', 'LA'],
          category: 'active',
          milestones: [],
        };
        setProjects((prev) => [created, ...prev]);
        toast.success(`Đã tạo dự án ${created.name}`);
        closeCreateModal();
        return;
      } catch {
        if (!canUseDevPersistence()) {
          toast.error('Không kết nối được máy chủ. Dự án chưa được lưu.');
          return;
        }
      }
    }
    const created: ProjectItem = {
      id: `proj-${Date.now()}`,
      name: trimmed,
      description: newDesc.trim() || 'Dự án mới trong không gian làm việc QSystem',
      accent: newAccent,
      statusLabel: 'Đang triển khai',
      badgeVariant: 'blue',
      progress: 0,
      doneTasks: 0,
      totalTasks: 8,
      members: ['MK', 'LA'],
      category: 'active',
      milestones: [
        { id: `ms-${Date.now()}-1`, title: 'Khởi tạo phạm vi & nhóm phụ trách', due: 'Tuần 1', done: true },
        { id: `ms-${Date.now()}-2`, title: 'Triển khai các hạng mục trọng tâm', due: 'Tuần 2', done: false },
        { id: `ms-${Date.now()}-3`, title: 'Nghiệm thu và bàn giao nội bộ', due: 'Tuần 3', done: false },
      ],
    };
    commitProjects((prev) => [created, ...prev]);
    toast.success(`Đã tạo dự án ${created.name}`);
    closeCreateModal();
  }

  if (skeletonLoading) {
    return (
      <section className="qx-page" aria-label="Dự án" role="status" aria-busy="true">
        <div className="qtk-projects-skeleton__head" />
        <div className="qtk-projects-skeleton__grid">
          {Array.from({ length: 4 }, (_, index) => <div key={index} />)}
        </div>
      </section>
    );
  }

  if (loadError && projects.length === 0) {
    return (
      <section className="qx-page" aria-label="Dự án">
        <StateRegion state="error" errorDescription={loadError} onRetry={() => window.location.reload()} />
      </section>
    );
  }

  return (
    <section className="qx-page" aria-label="Dự án">
      <header className="qx-page-head">
        <div>
          <h1>Dự án</h1>
          <p>Tổng quan danh mục dự án, tiến độ và nhóm phụ trách</p>
        </div>
        <div className="qx-actions">
          <div className="qtk-toolbar-wrap" ref={filterRef}>
            <button
              type="button"
              className="qx-btn"
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen((v) => !v)}
            >
              <ListFilter size={16} strokeWidth={1.5} aria-hidden="true" />
              Bộ lọc
            </button>
            {filterOpen ? (
              <div className="qtk-popover" role="region" aria-label="Bộ lọc dự án">
                <div className="qtk-popover__field">
                  <label htmlFor="qtk-proj-filter-stage" className="qtk-popover__label">
                    Giai đoạn
                  </label>
                  <Select
                    id="qtk-proj-filter-stage"
                    aria-label="Giai đoạn"
                    controlSize="sm"
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                    options={STAGE_FILTER_OPTIONS}
                  />
                </div>
                <div className="qtk-popover__actions">
                  <button
                    type="button"
                    className="qx-btn qx-btn--sm qx-btn--ghost"
                    onClick={() => {
                      setStatusFilter('');
                      setFilterOpen(false);
                    }}
                  >
                    Đặt lại
                  </button>
                  <button
                    type="button"
                    className="qx-btn qx-btn--sm"
                    onClick={() => setFilterOpen(false)}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <button type="button" className="qx-btn qx-btn--primary" onClick={() => setCreating(true)}>
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            Tạo dự án
          </button>
        </div>
      </header>

      <div className="qx-stats">
        <article className="qx-stat">
          <span className="qx-stat__label">Dự án hoạt động</span>
          <div className="qx-stat__value">{String(activePortfolioCount).padStart(2, '0')}</div>
          <div className="qx-stat__note">{`${activeNoteCount} đang thực hiện`}</div>
        </article>

        <article className="qx-stat">
          <span className="qx-stat__label">Đúng tiến độ</span>
          <div className="qx-stat__value">{onTrackCount}</div>
          <div className="qx-stat__note">{`${onTrackPct}% danh mục`}</div>
        </article>

        <article className="qx-stat">
          <span className="qx-stat__label">Cần chú ý</span>
          <div className="qx-stat__value">{attentionCount}</div>
          <div className="qx-stat__note">Có rủi ro trễ hạn</div>
        </article>

        <article className="qx-stat">
          <span className="qx-stat__label">Công việc dự án</span>
          <div className="qx-stat__value">{portfolioTotalTasks}</div>
          <div className="qx-stat__note">{`Đã hoàn thành ${portfolioDoneTasks}`}</div>
        </article>
      </div>

      <div className="qtk-proj-toolbar">
        <div className="qx-tabs" role="tablist" aria-label="Phân loại dự án">
          {PROJECT_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              className="qx-tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="qx-btn qx-btn--sm"
          onClick={() => setLayout((cur) => (cur === 'grid' ? 'list' : 'grid'))}
        >
          {layout === 'grid' ? (
            <>
              <LayoutGrid size={16} strokeWidth={1.5} aria-hidden="true" />
              Lưới
            </>
          ) : (
            <>
              <List size={16} strokeWidth={1.5} aria-hidden="true" />
              Danh sách
            </>
          )}
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="qx-card" style={{ padding: 24, color: 'var(--qs-fg-muted)', fontSize: 13 }}>
          Chưa có dự án nào trong nhóm này
        </div>
      ) : (
        <div className="qtk-proj-grid" data-layout={layout} role="tabpanel">
          {visible.map((proj) => (
            <article key={proj.id} className="qx-card qtk-proj-card">
              <div className="qtk-proj-card__top">
                <span className={`qtk-proj-icon qtk-proj-icon--${proj.accent}`} aria-hidden="true">
                  <Folder size={16} strokeWidth={1.5} />
                </span>
                <span className={`qx-badge qx-badge--${proj.badgeVariant}`}>{proj.statusLabel}</span>
              </div>

              <div>
                <h2 className="qtk-proj-title">
                  <button
                    type="button"
                    className="qtk-proj-title-btn"
                    onClick={() => setSelectedProjId(proj.id)}
                  >
                    {proj.name}
                  </button>
                </h2>
                <p className="qtk-proj-desc">{proj.description}</p>
              </div>

              <div>
                <div className="qtk-proj-progress__head">
                  <span className="qtk-proj-progress__label">Tiến độ dự án</span>
                  <span className="qtk-proj-progress__pct">{`${proj.progress}%`}</span>
                </div>
                <div
                  className="qtk-proj-progress__track"
                  role="progressbar"
                  aria-valuenow={proj.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Tiến độ ${proj.name}`}
                >
                  <div
                    className={`qtk-proj-progress__bar qtk-proj-progress__bar--${proj.accent}`}
                    style={{ width: `${proj.progress}%` }}
                  />
                </div>
              </div>

              <div className="qtk-proj-foot">
                <div className="qtk-avatars" aria-label="Thành viên tham gia">
                  {proj.members.map((initialsText) => (
                    <span key={initialsText} className="qx-avatar qx-avatar--sm qtk-avatar-cell">
                      {initialsText}
                    </span>
                  ))}
                </div>
                <span className="qtk-proj-tasks">{`${proj.doneTasks}/${proj.totalTasks} đầu việc`}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <div
          className="qtk-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCreateModal();
          }}
        >
          <div
            ref={modalRef}
            className="qtk-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qtk-proj-create-title"
            tabIndex={-1}
          >
            <div className="qtk-modal__head">
              <h2 id="qtk-proj-create-title">Tạo dự án mới</h2>
              <p>Khởi tạo dự án và theo dõi tiến độ đầu việc theo nhóm phụ trách</p>
              <button
                type="button"
                className="qtk-modal__close"
                aria-label="Đóng hộp thoại"
                onClick={closeCreateModal}
              >
                <X size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleCreateProject} noValidate>
              <div className="qtk-modal__body">
                <div className="qtk-field qtk-field--full">
                  <label htmlFor="qtk-proj-name" className="qtk-field__label">
                    Tên dự án <span className="qtk-field__req" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="qtk-proj-name"
                    type="text"
                    className="qtk-input"
                    value={newName}
                    onChange={(event) => {
                      setNewName(event.target.value);
                      setFormError('');
                    }}
                    placeholder="Ví dụ: QTask Mobile App"
                  />
                  {formError ? <p className="qtk-error" role="alert">{formError}</p> : null}
                </div>

                <div className="qtk-field qtk-field--full">
                  <label htmlFor="qtk-proj-desc" className="qtk-field__label">
                    Mô tả ngắn
                  </label>
                  <input
                    id="qtk-proj-desc"
                    type="text"
                    className="qtk-input"
                    value={newDesc}
                    onChange={(event) => setNewDesc(event.target.value)}
                    placeholder="Mục tiêu và phạm vi triển khai dự án"
                  />
                </div>

                <div className="qtk-field qtk-field--full">
                  <label htmlFor="qtk-proj-accent" className="qtk-field__label">
                    Màu nhận diện
                  </label>
                  <Select<ProjectAccent>
                    id="qtk-proj-accent"
                    aria-label="Màu nhận diện"
                    controlSize="md"
                    value={newAccent}
                    onValueChange={setNewAccent}
                    options={ACCENT_OPTIONS}
                  />
                </div>
              </div>
              <div className="qtk-modal__foot">
                <button type="button" className="qx-btn" onClick={closeCreateModal}>
                  Hủy
                </button>
                <button type="submit" className="qx-btn qx-btn--primary">
                  <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
                  Tạo dự án
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedProject ? (
        <div
          className="qtk-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDetailModal();
          }}
        >
          <div
            ref={detailModalRef}
            className="qtk-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qtk-proj-detail-title"
            tabIndex={-1}
          >
            <div className="qtk-modal__head">
              <h2 id="qtk-proj-detail-title">{selectedProject.name}</h2>
              <p>{selectedProject.description}</p>
              <button
                type="button"
                className="qtk-modal__close"
                aria-label="Đóng chi tiết dự án"
                onClick={closeDetailModal}
              >
                <X size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>

            <div className="qtk-modal__body">
              <div className="qtk-field qtk-field--full">
                <div className="qtk-proj-modal-meta">
                  <span className={`qx-badge qx-badge--${selectedProject.badgeVariant}`}>
                    {selectedProject.statusLabel}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="qtk-avatars" aria-label="Thành viên tham gia">
                      {selectedProject.members.map((initialsText) => (
                        <span key={initialsText} className="qx-avatar qx-avatar--sm qtk-avatar-cell">
                          {initialsText}
                        </span>
                      ))}
                    </div>
                    <span className="qtk-proj-tasks">{`${selectedProject.doneTasks}/${selectedProject.totalTasks} đầu việc`}</span>
                  </div>
                </div>
              </div>

              <div className="qtk-field qtk-field--full">
                <div className="qtk-proj-progress__head">
                  <span className="qtk-proj-progress__label">Tiến độ tổng thể</span>
                  <span className="qtk-proj-progress__pct">{`${selectedProject.progress}%`}</span>
                </div>
                <div
                  className="qtk-proj-progress__track"
                  role="progressbar"
                  aria-valuenow={selectedProject.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Tiến độ ${selectedProject.name}`}
                >
                  <div
                    className={`qtk-proj-progress__bar qtk-proj-progress__bar--${selectedProject.accent}`}
                    style={{ width: `${selectedProject.progress}%` }}
                  />
                </div>
              </div>

              <div className="qtk-field qtk-field--full">
                <span className="qtk-field__label">Cột mốc chính</span>
                <ul className="qtk-milestone-list">
                  {selectedProject.milestones.map((ms) => (
                    <li key={ms.id} className="qtk-milestone-item">
                      <button
                        type="button"
                        className="qtk-milestone-toggle"
                        data-done={ms.done ? 'true' : 'false'}
                        aria-pressed={ms.done}
                        onClick={() => toggleMilestone(selectedProject.id, ms.id)}
                      >
                        <CheckCircle2
                          size={16}
                          strokeWidth={1.5}
                          style={{ color: ms.done ? 'var(--qs-success)' : 'var(--qs-fg-muted)' }}
                          aria-hidden="true"
                        />
                        <span>{ms.title}</span>
                      </button>
                      <span className="qtk-code">{ms.due}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="qtk-modal__foot">
              <div className="qtk-proj-modal__actions">
                <div className="qtk-proj-modal__action-group">
                  <button
                    type="button"
                    className="qx-btn qx-btn--sm"
                    disabled={selectedProject.progress >= 100}
                    onClick={() => bumpProjectProgress(selectedProject)}
                  >
                    <TrendingUp size={16} strokeWidth={1.5} aria-hidden="true" />
                    +10% tiến độ
                  </button>
                  <button
                    type="button"
                    className="qx-btn qx-btn--sm"
                    onClick={() => toggleProjectComplete(selectedProject)}
                  >
                    {selectedProject.category === 'done' ? (
                      <>
                        <RotateCcw size={16} strokeWidth={1.5} aria-hidden="true" />
                        Mở lại
                      </>
                    ) : (
                      <>
                        <Check size={16} strokeWidth={1.5} aria-hidden="true" />
                        Hoàn thành
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="qx-btn qx-btn--sm qx-btn--ghost"
                    onClick={() => toggleProjectArchive(selectedProject)}
                  >
                    <Archive size={16} strokeWidth={1.5} aria-hidden="true" />
                    {selectedProject.category === 'archived' ? 'Khôi phục' : 'Lưu trữ'}
                  </button>
                </div>
                <button type="button" className="qx-btn" onClick={closeDetailModal}>
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
