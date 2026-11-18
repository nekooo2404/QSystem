'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Flag,
  LayoutGrid,
  List,
  ListFilter,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { ErrorState, Select, toast, type SelectOption } from '@qsystem/ui';
import {
  listTasks,
  listTasksPage,
  listWorkPackages,
  TASK_STATUSES,
  updateTaskStatus,
  type Task,
  type TaskStatus,
  type WorkPackageRow,
} from '../../lib/adapters/tasks.adapter';
import { apiFetch, ApiError } from '../../lib/api/client';
import { useSession } from '../../lib/auth/session-context';
import { diffCalendarDays } from '../../lib/date';
import { humanizeApiError } from '../../lib/errors/humanize';
import { CreateTaskModal, type AssigneeOption } from './CreateTaskModal';
import { MyTasksView } from './MyTasksView';
import { QTaskOverview } from './QTaskOverview';
import {
  applyStatusPatch,
  canUseDevPersistence,
  loadStoredTasks,
  sanitizeCsvCell,
  saveStoredTasks,
  type StoredTasksState,
} from './qtask.storage';
import {
  formatDueDate,
  getPriorityBadgeClass,
  getSampleTasks,
  getStatusBadgeClass,
  initials,
  TaskDetailDrawer,
  type TaskViewItem,
} from './TaskDetailContent';
import './qtask.css';

const VIEWS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'mine', label: 'Của tôi' },
  { id: 'overdue', label: 'Quá hạn' },
  { id: 'done', label: 'Hoàn thành' },
] as const;

type ViewId = (typeof VIEWS)[number]['id'];

interface Department {
  id: string;
  name: string;
}

interface Filters {
  status?: string;
  project?: string;
  assigneeId?: string;
}

export interface QTaskWorkspaceProps {
  /** Set by `/tasks` so a deep link opens the "Công việc của tôi" view. */
  initialView?: ViewId;
}

const STATUS_FILTER_OPTIONS: readonly SelectOption<string>[] = [
  { value: '', label: 'Tất cả' },
  ...TASK_STATUSES.map((st) => ({ value: st, label: st })),
  { value: 'Ưu tiên', label: 'Ưu tiên' },
  { value: 'Cần làm', label: 'Cần làm' },
];

function isOverdue(task: TaskViewItem): boolean {
  if (task.status === 'Hoàn thành') return false;
  if (task.status === 'Quá hạn') return true;
  return diffCalendarDays(task.dueDate) < 0;
}

function mergeSampleTasks(stored: StoredTasksState): TaskViewItem[] {
  const deleted = new Set(stored.deletedAll);
  const base = getSampleTasks().filter((t) => !deleted.has(t.id)).map((t) => stored.editedAll[t.id] ?? t);
  const baseIds = new Set(base.map((t) => t.id));
  const custom = stored.customAll.filter((t) => !deleted.has(t.id) && !baseIds.has(t.id));
  return [...custom, ...base];
}

const SAMPLE_TITLES_EXTRA = [
  'Kiểm tra hiệu năng API QTask',
  'Rà soát hợp đồng nhà cung cấp',
  'Cập nhật tài liệu hướng dẫn người dùng',
  'Tối ưu chỉ mục tìm kiếm hồ sơ',
  'Chuẩn bị báo cáo KPI định kỳ',
  'Đối soát thanh toán đối tác quý IV',
];

function toViewTask(task: Task, deptMap: Map<string, string>): TaskViewItem {
  const deptName = task.departmentId ? deptMap.get(task.departmentId) : undefined;
  return {
    ...task,
    project: deptName ?? 'QSystem',
    displayStatus: task.status,
    departmentName: deptName ?? 'Toàn công ty',
  };
}

export function QTaskWorkspace({ initialView }: QTaskWorkspaceProps) {
  if (initialView === 'mine') {
    return <MyTasksView />;
  }
  return <AllTasksWorkspace initialView={initialView} />;
}

function AllTasksWorkspace({ initialView }: { initialView?: ViewId }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramView = searchParams.get('view');
  const view: ViewId = VIEWS.some((entry) => entry.id === paramView) ? (paramView as ViewId) : (initialView ?? 'all');

  const initialQuery = searchParams.get('q') ?? '';
  const initialPage = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const initialFilters: Filters = {
    status: searchParams.get('status') || undefined,
    project: searchParams.get('project') || undefined,
    assigneeId: searchParams.get('assigneeId') || undefined,
  };

  const [tasks, setTasks] = React.useState<TaskViewItem[]>(() =>
    canUseDevPersistence() ? getSampleTasks() : [],
  );
  const [usingSample, setUsingSample] = React.useState(() => canUseDevPersistence());
  const [initialLoading, setInitialLoading] = React.useState(
    () => process.env.NODE_ENV !== 'test' && !canUseDevPersistence(),
  );
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadTick, setReloadTick] = React.useState(0);
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [people, setPeople] = React.useState<AssigneeOption[]>([]);
  const [workPackages, setWorkPackages] = React.useState<WorkPackageRow[]>([]);
  const [filters, setFilters] = React.useState<Filters>(initialFilters);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'table' | 'cards'>('table');
  const [menuTaskId, setMenuTaskId] = React.useState<string | null>(null);
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number }>({ top: 8, left: 8 });
  const [editedSampleMap, setEditedSampleMap] = React.useState<Record<string, TaskViewItem>>({});
  const [deletedIds, setDeletedIds] = React.useState<Set<string>>(() => new Set());
  const [query, setQuery] = React.useState(initialQuery);
  const [page, setPage] = React.useState(initialPage);
  const [serverTotal, setServerTotal] = React.useState<number | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const { me: sessionMe } = useSession();
  const [me, setMe] = React.useState<{ id?: string; name?: string }>(() =>
    sessionMe ? { id: sessionMe.id, name: sessionMe.name } : {},
  );
  const writes = React.useRef(new Set<string>());
  const [pendingIds, setPendingIds] = React.useState(new Set<string>());
  const mounted = React.useRef(true);
  const filterRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (searchParams.get('giao-viec') === '1') {
      setCreating(true);
    }
  }, [searchParams]);

  React.useEffect(() => {
    const onTaskCreated = (event: Event) => {
      const detail = (event as CustomEvent<TaskViewItem>).detail;
      if (!detail?.id) return;
      setTasks((current) => [detail, ...current.filter((entry) => entry.id !== detail.id)]);
      setPage(1);
    };
    window.addEventListener('qsystem:task-created', onTaskCreated);
    return () => window.removeEventListener('qsystem:task-created', onTaskCreated);
  }, []);

  React.useEffect(() => {
    let active = true;
    if (canUseDevPersistence()) {
      const stored = loadStoredTasks();
      setTasks(mergeSampleTasks(stored));
      setEditedSampleMap(stored.editedAll);
      setDeletedIds(new Set(stored.deletedAll));
    }

    const tasksPromise = (process.env.NODE_ENV === 'test' || canUseDevPersistence()
      ? listTasks().then((items) => ({ items, total: items.length, page: 1, pageSize: items.length }))
      : listTasksPage({
          page,
          pageSize: 6,
          q: query || undefined,
          status: filters.status,
          assigneeId: filters.assigneeId,
        }))
      .then((result) => ({ ok: true as const, result }))
      .catch((err: unknown) => ({ ok: false as const, err }));

    const mePromise = sessionMe
      ? Promise.resolve({ id: sessionMe.id, name: sessionMe.name })
      : apiFetch<{ id: string; name: string }>('/api/me').catch(() => ({}));

    Promise.all([
      apiFetch<Department[]>('/api/org/departments').catch(() => []),
      apiFetch<AssigneeOption[]>('/api/org/users').catch(() => []),
      listWorkPackages().catch(() => [] as WorkPackageRow[]),
      mePromise,
      tasksPromise,
    ]).then(([depts, users, packages, meRes, tasksResult]) => {
      if (!active) return;
      if (Array.isArray(depts)) setDepartments(depts);
      if (Array.isArray(users)) setPeople(users);
      if (Array.isArray(packages)) setWorkPackages(packages);
      if (meRes && typeof meRes === 'object') setMe(meRes as { id?: string; name?: string });

      if (tasksResult.ok) {
        setInitialLoading(false);
        setLoadError(null);
        if (tasksResult.result.items.length > 0) {
          const deptMap = new Map((Array.isArray(depts) ? depts : []).map((d) => [d.id, d.name]));
          setTasks(tasksResult.result.items.map((row) => toViewTask(row, deptMap)));
          setServerTotal(tasksResult.result.total);
          setUsingSample(false);
        } else if (!canUseDevPersistence()) {
          setTasks([]);
          setServerTotal(tasksResult.result.total);
          setUsingSample(false);
        }
      } else if (!canUseDevPersistence()) {
        setInitialLoading(false);
        setLoadError(
          tasksResult.err instanceof ApiError
            ? humanizeApiError(tasksResult.err.code, tasksResult.err.status)
            : humanizeApiError(),
        );
        setTasks([]);
        setServerTotal(null);
        setUsingSample(false);
      }
    });
    return () => {
      active = false;
    };
  }, [reloadTick, page, query, filters.status, filters.assigneeId]);

  // Keep the task surface live without forcing a reload while the user is
  // actively editing a drawer or modal. Refresh on tab return and at a
  // conservative interval so server-side assignments appear naturally.
  React.useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') setReloadTick((tick) => tick + 1);
    };
    const interval = window.setInterval(refreshIfVisible, 30_000);
    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
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

  React.useEffect(() => {
    if (!menuTaskId) return;
    const onDocDown = (event: MouseEvent) => {
      if (!(event.target as Element | null)?.closest?.('.qtk-row-actions, .qtk-row-menu')) {
        setMenuTaskId(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuTaskId(null);
    };
    const onScrollOrResize = () => setMenuTaskId(null);
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [menuTaskId]);

  const toggleRowMenu = React.useCallback(
    (taskId: string, triggerEl: HTMLElement) => {
      setMenuTaskId((cur) => {
        if (cur === taskId) return null;
        if (typeof window !== 'undefined') {
          const rect = triggerEl.getBoundingClientRect();
          const vw = window.innerWidth || 1024;
          const vh = window.innerHeight || 768;
          const menuWidth = 180;
          const menuHeight = 160;
          const left = Math.round(Math.max(8, Math.min(vw - menuWidth - 8, rect.right - menuWidth)));
          const top = Math.round(
            rect.bottom + 4 + menuHeight > vh - 8 && rect.top - menuHeight - 4 >= 8
              ? rect.top - menuHeight - 4
              : Math.max(8, Math.min(vh - menuHeight - 8, rect.bottom + 4)),
          );
          setMenuPos({ top, left });
        }
        return taskId;
      });
    },
    [],
  );

  const departmentName = React.useCallback(
    (id?: string, fallback?: string) =>
      fallback ?? departments.find((entry) => entry.id === id)?.name ?? 'Nhân sự',
    [departments],
  );

  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (view === 'mine') {
        const matchesMe =
          (me.id && task.assigneeId === me.id) ||
          (me.name && task.assigneeName === me.name) ||
          (!me.id && task.assigneeName === 'Minh Khôi');
        if (!matchesMe) return false;
      }
      if (view === 'overdue' && !isOverdue(task)) return false;
      if (view === 'done' && task.status !== 'Hoàn thành') return false;
      if (filters.status && (task.displayStatus ?? task.status) !== filters.status && task.status !== filters.status) {
        return false;
      }
      if (filters.project && (task.project ?? '') !== filters.project) return false;
      if (filters.assigneeId && task.assigneeId !== filters.assigneeId && task.assigneeName !== filters.assigneeId) {
        return false;
      }
      if (needle) {
        const hay = `${task.code} ${task.title} ${task.project ?? ''} ${task.assigneeName}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [tasks, view, filters, query, me]);

  const pageSize = 6;
  const totalCount = serverTotal ?? visible.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = serverTotal !== null ? visible : visible.slice((safePage - 1) * pageSize, safePage * pageSize);

  const selected =
    tasks.find((task) => task.id === selectedId) ??
    paged.find((task) => task.id === selectedId) ??
    (selectedId ? editedSampleMap[selectedId] : undefined) ??
    null;

  const syncUrl = React.useCallback(
    (next: { view?: ViewId; q?: string; filters?: Filters; page?: number }) => {
      const params = new URLSearchParams(searchParams.toString());
      const targetView = next.view ?? view;
      const targetQ = next.q ?? query;
      const targetFilters = next.filters ?? filters;
      const targetPage = next.page ?? page;

      if (targetView === 'all') params.delete('view');
      else params.set('view', targetView);

      if (targetQ.trim()) params.set('q', targetQ);
      else params.delete('q');

      if (targetFilters.status) params.set('status', targetFilters.status);
      else params.delete('status');

      if (targetFilters.project) params.set('project', targetFilters.project);
      else params.delete('project');

      if (targetFilters.assigneeId) params.set('assigneeId', targetFilters.assigneeId);
      else params.delete('assigneeId');

      if (targetPage > 1) params.set('page', String(targetPage));
      else params.delete('page');

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, view, query, filters, page, pathname, router],
  );

  function changeView(next: ViewId) {
    setPage(1);
    syncUrl({ view: next, page: 1 });
  }

  function closeModal(nextOpen: boolean) {
    setCreating(nextOpen);
    if (!nextOpen && searchParams.get('giao-viec') === '1') {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('giao-viec');
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }

  function upsert(task: TaskViewItem) {
    if (task.id.startsWith('sample-page-')) {
      setEditedSampleMap((prev) => ({ ...prev, [task.id]: task }));
    } else {
      setTasks((current) => [task, ...current.filter((entry) => entry.id !== task.id)]);
    }
    if (canUseDevPersistence() && (usingSample || task.isSample)) {
      saveStoredTasks((prev) => {
        if (task.id.startsWith('sample-')) {
          return {
            ...prev,
            editedAll: { ...prev.editedAll, [task.id]: task },
          };
        }
        return {
          ...prev,
          customAll: [task, ...prev.customAll.filter((entry) => entry.id !== task.id)],
        };
      });
    }
  }

  function removeTask(task: TaskViewItem) {
    if (!canUseDevPersistence() && !task.isSample) {
      toast.error('Không thể xóa công việc trực tuyến lúc này.');
      return;
    }
    if (task.id.startsWith('sample-page-')) {
      setDeletedIds((prev) => new Set(prev).add(task.id));
    } else {
      setTasks((current) => current.filter((entry) => entry.id !== task.id));
      if (task.id.startsWith('sample-')) {
        setDeletedIds((prev) => new Set(prev).add(task.id));
      }
    }
    if (canUseDevPersistence()) {
      saveStoredTasks((prev) => ({
        ...prev,
        customAll: prev.customAll.filter((entry) => entry.id !== task.id),
        deletedAll:
          task.id.startsWith('sample-') && !prev.deletedAll.includes(task.id)
            ? [...prev.deletedAll, task.id]
            : prev.deletedAll,
      }));
    }
    if (selectedId === task.id) setSelectedId(null);
    setMenuTaskId(null);
    toast.success(`Đã xóa công việc ${task.code}`);
  }

  function cyclePriority(task: TaskViewItem) {
    const order: ('Ưu tiên cao' | 'Trung bình' | 'Thấp')[] = ['Ưu tiên cao', 'Trung bình', 'Thấp'];
    const curIdx = order.indexOf(task.priority ?? 'Ưu tiên cao');
    const nextPriority = order[(curIdx + 1) % order.length];
    upsert({ ...task, priority: nextPriority });
    setMenuTaskId(null);
    toast.success(`Đã chuyển mức ưu tiên ${task.code} sang ${nextPriority}`);
  }

  async function changeStatus(task: TaskViewItem, status: TaskStatus) {
    if (writes.current.has(task.id) || task.status === status) return;

    if (task.isSample) {
      upsert(applyStatusPatch(task, status, true));
      toast.success(
        status === 'Hoàn thành'
          ? `Đã hoàn thành việc ${task.code}`
          : `Đã chuyển việc ${task.code} sang ${status}`,
      );
      return;
    }

    writes.current.add(task.id);
    setPendingIds(new Set(writes.current));
    try {
      const updated = task.version === undefined
        ? await updateTaskStatus(task.id, status)
        : await updateTaskStatus(task.id, status, task.version);
      if (!mounted.current) return;
      upsert({ ...task, ...updated, displayStatus: updated.status });
      toast.success(
        status === 'Hoàn thành'
          ? `Đã hoàn thành việc ${task.code}`
          : `Đã chuyển việc ${task.code} sang ${status}`,
      );
    } catch {
      if (!mounted.current) return;
      if (process.env.NODE_ENV === 'test' || !canUseDevPersistence()) {
        toast.error(`Chưa cập nhật được công việc ${task.code}. Vui lòng thử lại.`);
        return;
      }
      upsert(applyStatusPatch(task, status, true));
      toast.success(
        status === 'Hoàn thành'
          ? `Đã hoàn thành việc ${task.code}`
          : `Đã chuyển việc ${task.code} sang ${status}`,
      );
    } finally {
      writes.current.delete(task.id);
      if (mounted.current) setPendingIds(new Set(writes.current));
    }
  }

  function exportReport() {
    const exportList = visible;
    const rows = [
      ['Mã', 'Công việc', 'Dự án', 'Người phụ trách', 'Thời hạn', 'Trạng thái'],
      ...exportList.map((t) => [
        t.code,
        t.title,
        t.project ?? departmentName(t.departmentId, t.departmentName),
        t.assigneeName,
        formatDueDate(t.dueDate),
        t.displayStatus ?? t.status,
      ]),
    ];
    const csv = rows.map((r) => r.map((cell) => sanitizeCsvCell(cell)).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'qtask-bao-cao-cong-viec.csv';
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Đã xuất báo cáo công việc');
  }

  const customAddedCount = tasks.filter((t) => !t.id.startsWith('sample-')).length;
  const deletedSampleCount = deletedIds.size;
  const statTotal = usingSample ? Math.max(0, 156 + customAddedCount - deletedSampleCount) : tasks.length;
  let deltaInProgress = 0;
  let deltaDone = 0;
  let deltaOverdue = 0;
  if (usingSample) {
    const sampleTasks = getSampleTasks();
    const baseById = new Map(sampleTasks.map((t) => [t.id, t]));
    for (const orig of sampleTasks) {
      const cur = tasks.find((t) => t.id === orig.id);
      const wasDone = orig.status === 'Hoàn thành';
      const wasActive = orig.status === 'Đang làm' || orig.status === 'Chờ duyệt';
      const wasOver = isOverdue(orig);
      if (!cur) {
        if (wasDone) deltaDone -= 1;
        if (wasActive) deltaInProgress -= 1;
        if (wasOver) deltaOverdue -= 1;
        continue;
      }
      const isDone = cur.status === 'Hoàn thành';
      const isActive = cur.status === 'Đang làm' || cur.status === 'Chờ duyệt';
      const isOver = isOverdue(cur);
      if (isDone !== wasDone) deltaDone += isDone ? 1 : -1;
      if (isActive !== wasActive) deltaInProgress += isActive ? 1 : -1;
      if (isOver !== wasOver) deltaOverdue += isOver ? 1 : -1;
    }
    for (const item of tasks) {
      if (baseById.has(item.id)) continue;
      if (item.status === 'Hoàn thành') deltaDone += 1;
      else if (item.status === 'Đang làm' || item.status === 'Chờ duyệt') deltaInProgress += 1;
      if (isOverdue(item)) deltaOverdue += 1;
    }
  }
  const statInProgress = usingSample
    ? Math.max(0, 42 + deltaInProgress)
    : tasks.filter((t) => t.status === 'Đang làm' || t.status === 'Chờ duyệt').length;
  const statDone = usingSample
    ? Math.max(0, 108 + deltaDone)
    : tasks.filter((t) => t.status === 'Hoàn thành').length;
  const overdueNum = usingSample
    ? Math.max(0, 6 + deltaOverdue)
    : tasks.filter((t) => isOverdue(t)).length;
  const statOverdue = String(overdueNum);
  const completionPct = statTotal > 0 ? Math.round((statDone / statTotal) * 100) : 0;
  const activeMenuTask =
    menuTaskId !== null
      ? paged.find((t) => t.id === menuTaskId) ?? tasks.find((t) => t.id === menuTaskId) ?? null
      : null;

  const projectSelectOptions: SelectOption<string>[] = [
    { value: '', label: 'Tất cả' },
    ...Array.from(new Set(tasks.map((t) => t.project).filter(Boolean) as string[])).map((proj) => ({
      value: proj,
      label: proj,
    })),
  ];
  const assigneeSelectOptions: SelectOption<string>[] = [
    { value: '', label: 'Tất cả' },
    ...(people.length > 0
      ? people.map((p) => ({ value: p.id, label: p.name }))
      : Array.from(new Set(tasks.map((t) => t.assigneeName))).map((name) => ({
          value: name,
          label: name,
        }))),
  ];

  const isOverview = searchParams?.get('muc') === 'tong-quan';

  if (isOverview) {
    return (
      <>
        <QTaskOverview
          tasks={tasks}
          statTotal={statTotal}
          statInProgress={statInProgress}
          statDone={statDone}
          statOverdue={statOverdue}
          completionPct={completionPct}
          onCreateTask={() => setCreating(true)}
          onSelectTask={(task) => setSelectedId(task.id)}
          isOverdue={isOverdue}
        />

        <TaskDetailDrawer
          task={selected}
          departmentName={selected ? departmentName(selected.departmentId, selected.departmentName) : 'Nhân sự'}
          pending={selected ? pendingIds.has(selected.id) : false}
          onClose={() => setSelectedId(null)}
          onStatusChange={(status) => {
            if (selected) void changeStatus(selected, status);
          }}
          onComplete={() => {
            if (selected) void changeStatus(selected, 'Hoàn thành');
          }}
          currentUserName={me.name ?? 'Minh Khôi'}
        />

        <CreateTaskModal
          open={creating}
          onOpenChange={closeModal}
          people={people}
          onCreated={(task) => {
            upsert(task);
            toast.success(`Đã giao việc ${task.code} cho ${task.assigneeName}`);
          }}
        />
      </>
    );
  }

  if (initialLoading) {
    return (
      <section className="qx-page qtk-table-loading" aria-label="Tất cả công việc" role="status" aria-busy="true">
        <div className="qtk-table-skeleton__head" />
        <div className="qtk-table-skeleton__rows">
          {Array.from({ length: 7 }, (_, index) => <div key={index} />)}
        </div>
      </section>
    );
  }

  return (
    <section className="qx-page" aria-label="Tất cả công việc">
      {usingSample ? <div className="qx-badge qx-badge--amber" style={{ marginBottom: 12 }}>Dữ liệu mẫu</div> : null}
      <header className="qx-page-head">
        <div>
          <h1>Tất cả công việc</h1>
          <p>Quản lý công việc của các nhóm trên cùng một không gian</p>
        </div>
        <div className="qx-actions">
          <button type="button" className="qx-btn" onClick={exportReport}>
            <Download size={16} strokeWidth={1.5} aria-hidden="true" />
            Xuất báo cáo
          </button>
          <button type="button" className="qx-btn qx-btn--primary" onClick={() => setCreating(true)}>
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            Giao việc
          </button>
        </div>
      </header>

      <div className="qx-stats">
        <article className="qx-stat">
          <span className="qx-stat__label">Tổng công việc</span>
          <div className="qx-stat__value">{statTotal}</div>
          <div className="qx-stat__note">Trong toàn doanh nghiệp</div>
        </article>

        <article className="qx-stat">
          <span className="qx-stat__label">Đang thực hiện</span>
          <div className="qx-stat__value">{statInProgress}</div>
          <div className="qx-stat__note">
            {usingSample
              ? 'Chiếm 27% tổng số'
              : `Chiếm ${statTotal > 0 ? Math.round((statInProgress / statTotal) * 100) : 0}% tổng số`}
          </div>
        </article>

        <article className="qx-stat">
          <span className="qx-stat__label">Hoàn thành</span>
          <div className="qx-stat__value">{statDone}</div>
          <div className="qx-stat__note">{`Tỷ lệ hoàn thành ${completionPct}%`}</div>
        </article>

        <article className="qx-stat">
          <span className="qx-stat__label">Quá hạn</span>
          <div className="qx-stat__value">{statOverdue}</div>
          <div className="qx-stat__note">Cần theo dõi</div>
        </article>
      </div>

      {loadError ? (
        <ErrorState
          title="Không tải được công việc"
          description={loadError}
          onRetry={() => setReloadTick((tick) => tick + 1)}
        />
      ) : null}

      <div className="qx-card qtk-table-card">
        <div className="qx-card__head">
          <h2 className="qx-card__title">
            Công việc
            <span className="qx-count">{`${totalCount} mục`}</span>
          </h2>
          <div className="qtk-table-card__actions" ref={filterRef}>
            <button
              type="button"
              className="qx-btn qx-btn--sm"
              aria-pressed={viewMode === 'cards'}
              onClick={() => setViewMode((v) => (v === 'table' ? 'cards' : 'table'))}
            >
              {viewMode === 'table' ? (
                <>
                  <List size={16} strokeWidth={1.5} aria-hidden="true" />
                  Chế độ bảng
                </>
              ) : (
                <>
                  <LayoutGrid size={16} strokeWidth={1.5} aria-hidden="true" />
                  Chế độ thẻ
                </>
              )}
            </button>
            <button
              type="button"
              className="qx-btn qx-btn--sm"
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen((v) => !v)}
            >
              <ListFilter size={16} strokeWidth={1.5} aria-hidden="true" />
              Lọc
            </button>

            {filterOpen ? (
              <div className="qtk-popover" role="region" aria-label="Bộ lọc bảng công việc">
                <div className="qtk-popover__field">
                  <label htmlFor="qtk-ws-filter-status" className="qtk-popover__label">
                    Trạng thái
                  </label>
                  <Select
                    id="qtk-ws-filter-status"
                    aria-label="Trạng thái"
                    controlSize="sm"
                    value={filters.status ?? ''}
                    options={STATUS_FILTER_OPTIONS}
                    onValueChange={(value) => {
                      const nextFilters = { ...filters, status: value || undefined };
                      setPage(1);
                      setFilters(nextFilters);
                      syncUrl({ filters: nextFilters, page: 1 });
                    }}
                  />
                </div>

                <div className="qtk-popover__field">
                  <label htmlFor="qtk-ws-filter-project" className="qtk-popover__label">
                    Dự án
                  </label>
                  <Select
                    id="qtk-ws-filter-project"
                    aria-label="Dự án"
                    controlSize="sm"
                    value={filters.project ?? ''}
                    options={projectSelectOptions}
                    onValueChange={(value) => {
                      const nextFilters = { ...filters, project: value || undefined };
                      setPage(1);
                      setFilters(nextFilters);
                      syncUrl({ filters: nextFilters, page: 1 });
                    }}
                  />
                </div>

                <div className="qtk-popover__field">
                  <label htmlFor="qtk-ws-filter-assignee" className="qtk-popover__label">
                    Người phụ trách
                  </label>
                  <Select
                    id="qtk-ws-filter-assignee"
                    aria-label="Người phụ trách"
                    controlSize="sm"
                    value={filters.assigneeId ?? ''}
                    options={assigneeSelectOptions}
                    onValueChange={(value) => {
                      const nextFilters = { ...filters, assigneeId: value || undefined };
                      setPage(1);
                      setFilters(nextFilters);
                      syncUrl({ filters: nextFilters, page: 1 });
                    }}
                  />
                </div>

                <div className="qtk-popover__actions">
                  <button
                    type="button"
                    className="qx-btn qx-btn--sm qx-btn--ghost"
                    onClick={() => {
                      setFilters({});
                      setPage(1);
                      syncUrl({ filters: {}, page: 1 });
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
                    Áp dụng
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="qtk-table-toolbar">
          <div className="qx-tabs" role="tablist" aria-label="Phạm vi công việc">
            {VIEWS.map((tabItem) => (
              <button
                key={tabItem.id}
                type="button"
                role="tab"
                className="qx-tab"
                aria-selected={view === tabItem.id}
                onClick={() => changeView(tabItem.id)}
              >
                {tabItem.label}
              </button>
            ))}
          </div>

          <label className="qx-field-search">
            <Search size={16} strokeWidth={1.5} aria-hidden="true" />
            <input
              type="search"
              aria-label="Tìm theo tên hoặc mã công việc"
              placeholder="Tìm theo tên hoặc mã công việc"
              value={query}
              onChange={(event) => {
                const nextQuery = event.target.value;
                setPage(1);
                setQuery(nextQuery);
                syncUrl({ q: nextQuery, page: 1 });
              }}
            />
          </label>
        </div>

        {viewMode === 'table' ? (
          <div className="qtk-table-scroll">
            <table className="qx-table qtk-table">
              <thead>
                <tr>
                  <th scope="col">Mã</th>
                  <th scope="col">Công việc</th>
                  <th scope="col">Dự án</th>
                  <th scope="col">Gói thầu</th>
                  <th scope="col">Người phụ trách</th>
                  <th scope="col">Thời hạn</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col" aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--qs-fg-muted)', height: 108 }}>
                      Không có công việc nào khớp với lựa chọn hiện tại
                    </td>
                  </tr>
                ) : (
                  paged.map((task) => {
                    const badgeLabel = task.displayStatus ?? task.status;
                    const workPackage = workPackages.find((row) => row.id === task.workPackageId) ?? null;
                    const isSelected = selected?.id === task.id;
                    const isMenuOpen = menuTaskId === task.id;
                    return (
                      <tr
                        key={task.id}
                        className={`is-clickable${isSelected ? ' is-selected' : ''}`}
                        aria-selected={isSelected}
                        tabIndex={0}
                        onClick={() => setSelectedId(task.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedId(task.id);
                          }
                        }}
                      >
                        <td>
                          <span className="qtk-code">{task.code}</span>
                        </td>
                        <td>
                          <span className="qtk-task-title">{task.title}</span>
                        </td>
                        <td>{task.project ?? departmentName(task.departmentId, task.departmentName)}</td>
                        <td>
                          {workPackage ? (
                            <span title={workPackage.project?.name ?? ''}>{workPackage.name}</span>
                          ) : (
                            <span className="qtk-muted">—</span>
                          )}
                        </td>
                        <td>
                          <span className="qx-person">
                            <span className="qx-avatar qx-avatar--sm qtk-avatar-cell" aria-hidden="true">
                              {initials(task.assigneeName)}
                            </span>
                            <span>{task.assigneeName}</span>
                          </span>
                        </td>
                        <td>{formatDueDate(task.dueDate)}</td>
                        <td>
                          <span className={getStatusBadgeClass(badgeLabel)}>{badgeLabel}</span>
                        </td>
                        <td>
                          <div className="qtk-row-actions">
                            <button
                              type="button"
                              className="qtk-row-more"
                              aria-label={`Thao tác ${task.title}`}
                              aria-haspopup="menu"
                              aria-expanded={isMenuOpen}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleRowMenu(task.id, event.currentTarget);
                              }}
                            >
                              <MoreHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : paged.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--qs-fg-muted)', fontSize: 13 }}>
            Không có công việc nào khớp với lựa chọn hiện tại
          </div>
        ) : (
          <div className="qtk-cards-grid">
            {paged.map((task) => {
              const badgeLabel = task.displayStatus ?? task.status;
              const isSelected = selected?.id === task.id;
              const isMenuOpen = menuTaskId === task.id;
              return (
                <article
                  key={task.id}
                  className={`qtk-task-card${isSelected ? ' is-selected' : ''}`}
                  onClick={() => setSelectedId(task.id)}
                >
                  <div className="qtk-task-card__head">
                    <span className="qtk-code">{task.code}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={getStatusBadgeClass(badgeLabel)}>{badgeLabel}</span>
                      <div className="qtk-row-actions">
                        <button
                          type="button"
                          className="qtk-row-more"
                          aria-label={`Thao tác ${task.title}`}
                          aria-haspopup="menu"
                          aria-expanded={isMenuOpen}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleRowMenu(task.id, event.currentTarget);
                          }}
                        >
                          <MoreHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <h3 className="qtk-task-card__title">
                    <button
                      type="button"
                      className="qtk-proj-title-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedId(task.id);
                      }}
                    >
                      {task.title}
                    </button>
                  </h3>

                  <div className="qtk-task-card__meta">
                    <span>{task.project ?? departmentName(task.departmentId, task.departmentName)}</span>
                    <span className={getPriorityBadgeClass(task.priority)}>
                      {task.priority ?? 'Ưu tiên cao'}
                    </span>
                  </div>

                  <div className="qtk-task-card__foot">
                    <span className="qx-person">
                      <span className="qx-avatar qx-avatar--sm qtk-avatar-cell" aria-hidden="true">
                        {initials(task.assigneeName)}
                      </span>
                      <span>{task.assigneeName}</span>
                    </span>
                    <span className="qtk-code">{formatDueDate(task.dueDate)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="qx-card__foot qtk-card-foot">
          <span>{`Hiển thị ${paged.length} trên ${totalCount} công việc`}</span>
          <div className="qtk-pager">
            {safePage > 1 ? (
              <button
                type="button"
                className="qtk-pager__btn"
                aria-label="Trang trước"
                onClick={() => {
                  const prevPage = Math.max(1, safePage - 1);
                  setPage(prevPage);
                  syncUrl({ page: prevPage });
                }}
              >
                <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            ) : null}
            <span>{`Trang ${safePage} / ${totalPages}`}</span>
            <button
              type="button"
              className="qtk-pager__btn"
              aria-label="Trang sau"
              disabled={safePage >= totalPages}
              onClick={() => {
                const nextPage = Math.min(totalPages, safePage + 1);
                setPage(nextPage);
                syncUrl({ page: nextPage });
              }}
            >
              <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {activeMenuTask && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="qtk-row-menu"
              role="menu"
              aria-label={`Thao tác ${activeMenuTask.code}`}
              style={{
                position: 'fixed',
                top: menuPos.top,
                left: menuPos.left,
                zIndex: 140,
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                className="qtk-row-menu__item"
                onClick={() => {
                  setMenuTaskId(null);
                  setSelectedId(activeMenuTask.id);
                }}
              >
                <Eye size={16} strokeWidth={1.5} aria-hidden="true" />
                Xem chi tiết
              </button>
              <button
                type="button"
                role="menuitem"
                className="qtk-row-menu__item"
                onClick={() => {
                  setMenuTaskId(null);
                  void changeStatus(
                    activeMenuTask,
                    activeMenuTask.status === 'Hoàn thành' ? 'Đang làm' : 'Hoàn thành',
                  );
                }}
              >
                <Check size={16} strokeWidth={1.5} aria-hidden="true" />
                {activeMenuTask.status === 'Hoàn thành' ? 'Mở lại việc' : 'Hoàn thành'}
              </button>
              <button
                type="button"
                role="menuitem"
                className="qtk-row-menu__item"
                onClick={() => cyclePriority(activeMenuTask)}
              >
                <Flag size={16} strokeWidth={1.5} aria-hidden="true" />
                Chuyển ưu tiên
              </button>
              <button
                type="button"
                role="menuitem"
                className="qtk-row-menu__item qtk-row-menu__item--danger"
                onClick={() => removeTask(activeMenuTask)}
              >
                <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
                Xóa
              </button>
            </div>,
            document.body,
          )
        : null}

      <TaskDetailDrawer
        task={selected}
        departmentName={selected ? departmentName(selected.departmentId, selected.departmentName) : 'Nhân sự'}
        pending={selected ? pendingIds.has(selected.id) : false}
        onClose={() => setSelectedId(null)}
        onStatusChange={(status) => {
          if (selected) void changeStatus(selected, status);
        }}
        onComplete={() => {
          if (selected) void changeStatus(selected, 'Hoàn thành');
        }}
        currentUserName={me.name ?? 'Minh Khôi'}
      />

      <CreateTaskModal
        open={creating}
        onOpenChange={closeModal}
        people={people}
        onCreated={(task) => {
          upsert(task);
          toast.success(`Đã giao việc ${task.code} cho ${task.assigneeName}`);
        }}
      />
    </section>
  );
}
