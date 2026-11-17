import type { Task, TaskStatus } from '../../lib/adapters/tasks.adapter';
export {
  addLocalDaysIso,
  diffCalendarDays,
  formatDdMmYyyy,
  formatRelativeViDate,
  getLocalDateIso,
  getUserTimeZone,
  parseCalendarDateDdMmYyyy,
} from '../../lib/date';

export interface TaskComment {
  id: string;
  author: string;
  initials: string;
  time: string;
  text: string;
}

export interface TaskAttachment {
  id: string;
  name: string;
  size: string;
}

export interface TaskHistoryEntry {
  id: string;
  text: string;
  time: string;
}

export interface TaskViewItem extends Task {
  project?: string;
  priority?: 'Ưu tiên cao' | 'Trung bình' | 'Thấp';
  displayStatus?: string;
  description?: string;
  departmentName?: string;
  updatedLabel?: string;
  dueLabel?: string;
  bucket?: 'today' | 'upcoming' | 'done';
  detailAssigneeName?: string;
  detailDueDate?: string;
  detailProject?: string;
  detailDepartment?: string;
  detailStatusLabel?: string;
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  history?: TaskHistoryEntry[];
  isSample?: boolean;
}

export interface StoredTasksState {
  customAll: TaskViewItem[];
  editedAll: Record<string, TaskViewItem>;
  deletedAll: string[];
  customMine: TaskViewItem[];
  editedMine: Record<string, TaskViewItem>;
  deletedMine: string[];
}

export interface StoredTaskExtras {
  comments: Record<string, TaskComment[]>;
  attachments: Record<string, TaskAttachment[]>;
  history: Record<string, TaskHistoryEntry[]>;
}

export type StoredProjectTab = 'all' | 'active' | 'done' | 'archived';
export type StoredProjectAccent = 'amber' | 'blue' | 'green' | 'purple';

export interface StoredProjectMilestone {
  id: string;
  title: string;
  due: string;
  done: boolean;
}

export interface StoredProjectItem {
  id: string;
  name: string;
  description: string;
  accent: StoredProjectAccent;
  statusLabel: string;
  badgeVariant: 'blue' | 'amber' | 'green';
  progress: number;
  doneTasks: number;
  totalTasks: number;
  members: string[];
  category: 'active' | 'done' | 'archived';
  milestones: StoredProjectMilestone[];
}

export const TASKS_STORAGE_KEY = 'qsystem:tasks:v1';
export const TASK_EXTRAS_STORAGE_KEY = 'qsystem:task-extras:v1';
export const PROJECTS_STORAGE_KEY = 'qsystem:projects:v1';
export const WORKSPACE_STORAGE_KEY = 'qsystem:workspace:v1';

const EMPTY_TASKS_STATE: StoredTasksState = {
  customAll: [],
  editedAll: {},
  deletedAll: [],
  customMine: [],
  editedMine: {},
  deletedMine: [],
};

const EMPTY_TASK_EXTRAS: StoredTaskExtras = {
  comments: {},
  attachments: {},
  history: {},
};

export function isTestEnvironment(): boolean {
  return typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
}

export function isStrictProduction(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PUBLIC_DEMO_MODE !== 'true'
  );
}

/**
 * Local offline persistence in `localStorage` is enabled in development or explicit
 * demo mode when the backend API is unreachable — never in Vitest unit tests
 * and never in strict production deployments.
 */
export function canUseDevPersistence(): boolean {
  return !isTestEnvironment() && !isStrictProduction();
}

/** Neutralizes spreadsheet CSV formula prefixes before RFC-4180 quoting. */
export function sanitizeCsvCell(value: unknown): string {
  const raw = String(value ?? '');
  const trimmedStart = raw.trimStart();
  const safe = /^[=+\-@\t\r]/.test(raw) || /^[=+\-@]/.test(trimmedStart) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function readJsonStorage<T>(key: string, fallback: T): T {
  if (!canUseDevPersistence() || typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key: string, value: unknown): void {
  if (!canUseDevPersistence() || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota / private mode failures gracefully.
  }
}

export function loadStoredTasks(): StoredTasksState {
  const parsed = readJsonStorage<Partial<StoredTasksState> | null>(TASKS_STORAGE_KEY, null);
  if (!parsed || typeof parsed !== 'object') return { ...EMPTY_TASKS_STATE };
  return {
    customAll: Array.isArray(parsed.customAll) ? parsed.customAll : [],
    editedAll: parsed.editedAll && typeof parsed.editedAll === 'object' ? parsed.editedAll : {},
    deletedAll: Array.isArray(parsed.deletedAll) ? parsed.deletedAll : [],
    customMine: Array.isArray(parsed.customMine) ? parsed.customMine : [],
    editedMine: parsed.editedMine && typeof parsed.editedMine === 'object' ? parsed.editedMine : {},
    deletedMine: Array.isArray(parsed.deletedMine) ? parsed.deletedMine : [],
  };
}

export function saveStoredTasks(updater: (prev: StoredTasksState) => StoredTasksState): void {
  if (!canUseDevPersistence()) return;
  const current = loadStoredTasks();
  writeJsonStorage(TASKS_STORAGE_KEY, updater(current));
}

export function recordCreatedTaskInStorage(
  task: TaskViewItem,
  scope: 'all' | 'mine' | 'both' = 'both',
): void {
  if (!canUseDevPersistence()) return;
  saveStoredTasks((prev) => {
    const nextAll =
      scope === 'all' || scope === 'both'
        ? [task, ...prev.customAll.filter((entry) => entry.id !== task.id)]
        : prev.customAll;
    const mineItem: TaskViewItem = { ...task, bucket: task.bucket ?? 'today' };
    const nextMine =
      scope === 'mine' || scope === 'both'
        ? [mineItem, ...prev.customMine.filter((entry) => entry.id !== task.id)]
        : prev.customMine;
    return {
      ...prev,
      customAll: nextAll,
      customMine: nextMine,
    };
  });
}

export function loadTaskExtras(): StoredTaskExtras {
  const parsed = readJsonStorage<Partial<StoredTaskExtras> | null>(TASK_EXTRAS_STORAGE_KEY, null);
  if (!parsed || typeof parsed !== 'object') return { ...EMPTY_TASK_EXTRAS };
  return {
    comments: parsed.comments && typeof parsed.comments === 'object' ? parsed.comments : {},
    attachments: parsed.attachments && typeof parsed.attachments === 'object' ? parsed.attachments : {},
    history: parsed.history && typeof parsed.history === 'object' ? parsed.history : {},
  };
}

export function saveTaskExtras(updater: (prev: StoredTaskExtras) => StoredTaskExtras): void {
  if (!canUseDevPersistence()) return;
  const current = loadTaskExtras();
  writeJsonStorage(TASK_EXTRAS_STORAGE_KEY, updater(current));
}

export function loadStoredProjects(): StoredProjectItem[] | null {
  const parsed = readJsonStorage<StoredProjectItem[] | null>(PROJECTS_STORAGE_KEY, null);
  return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
}

export function saveStoredProjects(projects: StoredProjectItem[]): void {
  writeJsonStorage(PROJECTS_STORAGE_KEY, projects);
}

export function loadStoredWorkspaceId(): string | null {
  if (!canUseDevPersistence() || typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveStoredWorkspaceId(id: string): void {
  if (!canUseDevPersistence() || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, id);
  } catch {
    // Ignore storage failures.
  }
}

export function applyStatusPatch(task: TaskViewItem, status: TaskStatus, isSample = task.isSample): TaskViewItem {
  return {
    ...task,
    status,
    displayStatus: status,
    detailStatusLabel: status === 'Đang làm' ? 'Đang thực hiện' : status,
    updatedLabel: 'Cập nhật vừa xong',
    ...(isSample !== undefined ? { isSample } : {}),
  };
}
