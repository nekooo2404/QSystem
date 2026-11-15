'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button, DataTable, FilterPopover, ResponsiveDetailDrawer, StateRegion, UnderlineTabs, toast } from '@qsystem/ui';
import type { DataTableColumn } from '@qsystem/ui';
import { listTasks, TASK_STATUSES, updateTaskStatus, type Task, type TaskStatus } from '../../lib/adapters/tasks.adapter';
import { apiFetch } from '../../lib/api/client';
import { CreateTaskModal, type AssigneeOption } from './CreateTaskModal';
import { TaskDetailContent, TaskDetailFooter } from './TaskDetailContent';

const VIEWS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'mine', label: 'Của tôi' },
  { id: 'overdue', label: 'Quá hạn' },
] as const;

type ViewId = (typeof VIEWS)[number]['id'];

interface Department {
  id: string;
  name: string;
}

interface Filters {
  status?: string;
  departmentId?: string;
  assigneeId?: string;
}

function isOverdue(task: Task): boolean {
  if (task.status === 'Hoàn thành') return false;
  return task.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10);
}

function formatDue(due: string): string {
  const date = new Date(due);
  if (Number.isNaN(date.getTime())) return due;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export interface QTaskWorkspaceProps {
  /** Set by `/tasks` so a deep link opens the "Của tôi" view. */
  initialView?: ViewId;
}

export function QTaskWorkspace({ initialView }: QTaskWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramView = searchParams.get('view');
  const view: ViewId = VIEWS.some((entry) => entry.id === paramView) ? (paramView as ViewId) : (initialView ?? 'all');

  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [state, setState] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [people, setPeople] = React.useState<AssigneeOption[]>([]);
  const [filters, setFilters] = React.useState<Filters>({});
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [meId, setMeId] = React.useState<string | undefined>();
  const writes = React.useRef(new Set<string>());
  const [pendingIds, setPendingIds] = React.useState(new Set<string>());
  const mounted = React.useRef(true);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const load = React.useCallback(async () => {
    setState('loading');
    try {
      setTasks(await listTasks());
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  React.useEffect(() => {
    void load();
    // Directory lookups are best effort: the table only needs names.
    void apiFetch<{ id: string; name: string }[]>('/api/org/departments').then(setDepartments, () => {});
    void apiFetch<{ id: string; name: string }[]>('/api/org/users').then(setPeople, () => {});
    void apiFetch<{ id: string }>('/api/me').then((me) => setMeId(me.id), () => {});
  }, [load]);

  const departmentName = React.useCallback(
    (id?: string) => departments.find((entry) => entry.id === id)?.name ?? 'Toàn công ty',
    [departments],
  );

  const visible = tasks.filter((task) => {
    if (view === 'mine' && task.assigneeId !== meId) return false;
    if (view === 'overdue' && !isOverdue(task)) return false;
    if (filters.status && task.status !== filters.status) return false;
    if (filters.departmentId && task.departmentId !== filters.departmentId) return false;
    if (filters.assigneeId && task.assigneeId !== filters.assigneeId) return false;
    return true;
  });

  const selected = tasks.find((task) => task.id === selectedId) ?? null;

  function changeView(next: string) {
    router.replace(next === 'all' ? pathname : `${pathname}?view=${next}`, { scroll: false });
  }

  function upsert(task: Task) {
    setTasks((current) => [task, ...current.filter((entry) => entry.id !== task.id)]);
  }

  async function changeStatus(task: Task, status: TaskStatus) {
    if (writes.current.has(task.id) || task.status === status) return;
    writes.current.add(task.id);
    setPendingIds(new Set(writes.current));
    try {
      const updated = await updateTaskStatus(task.id, status);
      if (!mounted.current) return;
      upsert(updated);
      toast.success(status === 'Hoàn thành' ? `Đã hoàn thành việc ${task.code}` : `Đã chuyển việc ${task.code} sang ${status}`);
    } catch {
      if (mounted.current) toast.error('Chưa cập nhật được công việc, vui lòng thử lại.');
    } finally {
      writes.current.delete(task.id);
      if (mounted.current) setPendingIds(new Set(writes.current));
    }
  }

  const columns: DataTableColumn<Task>[] = [
    {
      id: 'code',
      header: 'Mã',
      accessor: (task) => <span className="qtk-code">{task.code}</span>,
    },
    { id: 'title', header: 'Tên công việc', accessor: (task) => task.title },
    { id: 'assignee', header: 'Phụ trách', accessor: (task) => task.assigneeName },
    { id: 'due', header: 'Thời hạn', accessor: (task) => formatDue(task.dueDate) },
    {
      id: 'status',
      header: 'Trạng thái',
      accessor: (task) => (
        <span className="qtk-badge" data-status={task.status}>
          {task.status}
        </span>
      ),
    },
  ];

  return (
    <section className="qtk">
      <header className="qtk__header">
        <h1>Công việc</h1>
        <Button onClick={() => setCreating(true)}>
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          Giao việc
        </Button>
      </header>

      <div className="qtk__toolbar">
        <UnderlineTabs aria-label="Phạm vi công việc" activeId={view} onChange={changeView} tabs={[...VIEWS]} />
        <FilterPopover>
          <FilterField
            label="Trạng thái"
            value={filters.status}
            options={TASK_STATUSES.map((status) => ({ value: status, label: status }))}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          />
          <FilterField
            label="Phòng ban"
            value={filters.departmentId}
            options={departments.map((entry) => ({ value: entry.id, label: entry.name }))}
            onChange={(value) => setFilters((current) => ({ ...current, departmentId: value }))}
          />
          <FilterField
            label="Phụ trách"
            value={filters.assigneeId}
            options={people.map((person) => ({ value: person.id, label: person.name }))}
            onChange={(value) => setFilters((current) => ({ ...current, assigneeId: value }))}
          />
        </FilterPopover>
      </div>

      <div className="qtk__body">
        <div className="qtk__table">
          <StateRegion
            state={state}
            rows={5}
            emptyTitle="Chưa có công việc nào"
            emptyDescription="Bấm “Giao việc” để tạo công việc đầu tiên."
            errorDescription="Không tải được danh sách công việc."
            onRetry={() => void load()}
          >
            <DataTable
              data={visible}
              columns={columns}
              getRowKey={(task) => task.id}
              selectedRowKey={selected?.id}
              onRowClick={(task) => setSelectedId(task.id)}
              emptyMessage="Không có công việc nào khớp với lựa chọn này."
            />
          </StateRegion>
        </div>

        <ResponsiveDetailDrawer
          open={selected !== null}
          onClose={() => setSelectedId(null)}
          subtitle={selected?.code}
          title={selected?.title ?? ''}
          footer={
            selected ? (
              <TaskDetailFooter task={selected} pending={pendingIds.has(selected.id)} onComplete={() => void changeStatus(selected, 'Hoàn thành')} />
            ) : null
          }
        >
          {selected ? (
            <TaskDetailContent task={selected} pending={pendingIds.has(selected.id)} departmentName={departmentName(selected.departmentId)} onStatusChange={(status) => void changeStatus(selected, status)} />
          ) : null}
        </ResponsiveDetailDrawer>
      </div>

      <CreateTaskModal
        open={creating}
        onOpenChange={setCreating}
        people={people}
        onCreated={(task) => {
          upsert(task);
          toast.success(`Đã giao việc ${task.code} cho ${task.assigneeName}`);
        }}
      />
    </section>
  );
}

function FilterField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  onChange: (value?: string) => void;
}) {
  return (
    <label className="qtk-filter__field">
      <span className="qtk-filter__label">{label}</span>
      <select
        className="qs-input"
        aria-label={label}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || undefined)}
      >
        <option value="">Tất cả</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
