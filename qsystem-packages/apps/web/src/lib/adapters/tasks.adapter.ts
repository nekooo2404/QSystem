import { TaskPayload4WSchema, type TaskPayload4W } from '@qsystem/contracts';
import { apiFetch } from '../api/client';

export const TASK_STATUSES = ['Đang làm', 'Chờ duyệt', 'Hoàn thành', 'Quá hạn'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type TaskPriorityLabel = 'Ưu tiên cao' | 'Trung bình' | 'Thấp';

export interface Task {
  id: string;
  code: string;
  title: string;
  assigneeId?: string;
  assigneeName: string;
  dueDate: string;
  departmentId?: string;
  status: TaskStatus;
  priority?: TaskPriorityLabel;
  project?: string;
  description?: string;
}

export interface TaskInput {
  title: string;
  assigneeId?: string;
  assigneeName: string;
  dueDate: string;
  departmentId?: string;
  priority?: TaskPriorityLabel;
  project?: string;
  description?: string;
}

export interface TaskFilter {
  status?: string;
  departmentId?: string;
  assigneeId?: string;
  ownerId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

interface ApiTaskRow {
  id: string;
  code: string;
  title: string;
  assigneeId?: string | null;
  assigneeName: string;
  dueDate: string;
  departmentId?: string | null;
  status: TaskStatus;
  priority?: string | null;
  project?: string | null;
  description?: string | null;
}

interface TaskListResponse {
  items: ApiTaskRow[];
  total: number;
  page: number;
  pageSize: number;
}

function fromApiPriority(raw?: string | null): TaskPriorityLabel | undefined {
  switch (raw) {
    case 'URGENT':
    case 'HIGH':
    case 'Ưu tiên cao':
      return 'Ưu tiên cao';
    case 'NORMAL':
    case 'Trung bình':
      return 'Trung bình';
    case 'LOW':
    case 'Thấp':
      return 'Thấp';
    default:
      return undefined;
  }
}

function toApiPriority(label?: TaskPriorityLabel): 'HIGH' | 'NORMAL' | 'LOW' | undefined {
  switch (label) {
    case 'Ưu tiên cao':
      return 'HIGH';
    case 'Trung bình':
      return 'NORMAL';
    case 'Thấp':
      return 'LOW';
    default:
      return undefined;
  }
}

function normalizeTask(row: ApiTaskRow): Task {
  const priority = fromApiPriority(row.priority);
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    ...(row.assigneeId ? { assigneeId: row.assigneeId } : {}),
    assigneeName: row.assigneeName,
    dueDate: row.dueDate,
    ...(row.departmentId ? { departmentId: row.departmentId } : {}),
    status: TASK_STATUSES.includes(row.status) ? row.status : 'Đang làm',
    ...(priority ? { priority } : {}),
    ...(row.project ? { project: row.project } : {}),
    ...(row.description ? { description: row.description } : {}),
  };
}

export function toPayload(input: TaskInput, status?: TaskStatus): TaskPayload4W & Record<string, unknown> {
  return {
    what: input.title,
    who: input.assigneeId ?? input.assigneeName,
    when: input.dueDate,
    where: input.departmentId ?? input.assigneeName,
    ...(status ? { flow: 'STANDARD', action: status } : {}),
  };
}

export async function listTasks(filter?: TaskFilter): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filter?.status) params.set('status', filter.status);
  if (filter?.departmentId) params.set('departmentId', filter.departmentId);
  if (filter?.assigneeId) params.set('assigneeId', filter.assigneeId);
  if (filter?.ownerId) params.set('ownerId', filter.ownerId);
  if (filter?.q) params.set('q', filter.q);
  if (filter?.page) params.set('page', String(filter.page));
  if (filter?.pageSize) params.set('pageSize', String(filter.pageSize));
  const qs = params.toString();
  const res = await apiFetch<TaskListResponse | ApiTaskRow[]>(`/api/org/tasks${qs ? `?${qs}` : ''}`);
  const rows = Array.isArray(res) ? res : (res.items ?? []);
  return rows.map(normalizeTask);
}

export async function createTask(input: TaskInput): Promise<Task> {
  const payload = TaskPayload4WSchema.parse(toPayload(input));
  const apiPriority = toApiPriority(input.priority);
  const res = await apiFetch<{ ok: true; task: ApiTaskRow }>('/api/org/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      title: input.title,
      assigneeId: input.assigneeId,
      assigneeName: input.assigneeName,
      dueDate: input.dueDate,
      departmentId: input.departmentId ?? null,
      ...(apiPriority ? { priority: apiPriority } : {}),
      ...(input.project ? { project: input.project } : {}),
      ...(input.description ? { description: input.description } : {}),
    }),
  });
  return normalizeTask(res.task);
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  const res = await apiFetch<{ ok: true; task: ApiTaskRow }>(`/api/org/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, action: status }),
  });
  return normalizeTask(res.task);
}

export function completeTask(id: string): Promise<Task> {
  return updateTaskStatus(id, 'Hoàn thành');
}
