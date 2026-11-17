'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronUp,
  ListFilter,
  Plus,
} from 'lucide-react';
import { Select, toast, type SelectOption } from '@qsystem/ui';
import { listTasks, updateTaskStatus, type Task, type TaskStatus } from '../../lib/adapters/tasks.adapter';
import { apiFetch, ApiError } from '../../lib/api/client';
import { useSession } from '../../lib/auth/session-context';
import {
  addLocalDaysIso,
  diffCalendarDays,
  formatRelativeViDate,
  getLocalDateIso,
  getLocalIsoWeekday,
} from '../../lib/date';
import { humanizeApiError } from '../../lib/errors/humanize';
import { CreateTaskModal, type AssigneeOption } from './CreateTaskModal';
import {
  applyStatusPatch,
  canUseDevPersistence,
  loadStoredTasks,
  recordCreatedTaskInStorage,
  saveStoredTasks,
  type StoredTasksState,
} from './qtask.storage';
import {
  getStatusBadgeClass,
  TaskDetailDrawer,
  type TaskViewItem,
} from './TaskDetailContent';
import './qtask.css';

const MY_STATUS_FILTER_OPTIONS: readonly SelectOption<string>[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'Ưu tiên cao', label: 'Ưu tiên cao' },
  { value: 'Đang làm', label: 'Đang làm' },
  { value: 'Cần xử lý', label: 'Cần xử lý' },
  { value: 'Chờ duyệt', label: 'Chờ duyệt' },
  { value: 'Hoàn thành', label: 'Hoàn thành' },
];

function getSampleMyTasks(): TaskViewItem[] {
  const todayIso = addLocalDaysIso(0);
  const tomorrowIso = addLocalDaysIso(1);
  const yesterdayIso = addLocalDaysIso(-1);
  const plus2Iso = addLocalDaysIso(2);
  return [
    {
      id: 'my-1005',
      code: '#1005',
      title: 'Duyệt yêu cầu nghỉ phép tháng 11',
      project: 'QHRM',
      assigneeId: 'mk',
      assigneeName: 'Minh Khôi',
      dueDate: todayIso,
      dueLabel: formatRelativeViDate(todayIso),
      status: 'Đang làm',
      displayStatus: 'Ưu tiên cao',
      priority: 'Ưu tiên cao',
      bucket: 'today',
      departmentName: 'Nhân sự',
      description: 'Kiểm tra hồ sơ nghỉ phép tháng 11 và phê duyệt cho nhân sự phòng Kinh doanh.',
      updatedLabel: 'Cập nhật 1 giờ trước',
      isSample: true,
    },
    {
      id: 'my-1006',
      code: '#1006',
      title: 'Hoàn thiện giao diện báo cáo quý IV',
      project: 'QTask',
      assigneeId: 'mk',
      assigneeName: 'Minh Khôi',
      dueDate: todayIso,
      dueLabel: formatRelativeViDate(todayIso),
      status: 'Đang làm',
      displayStatus: 'Đang làm',
      priority: 'Trung bình',
      bucket: 'today',
      departmentName: 'Sản phẩm',
      description: 'Hoàn tất biểu đồ tổng hợp số liệu và kiểm tra hiển thị trên cả chế độ Sáng và Tối.',
      updatedLabel: 'Cập nhật 2 giờ trước',
      isSample: true,
    },
    {
      id: 'my-1007',
      code: '#1007',
      title: 'Kiểm tra phân quyền phòng ban',
      project: 'QSystem',
      assigneeId: 'mk',
      assigneeName: 'Minh Khôi',
      dueDate: tomorrowIso,
      dueLabel: formatRelativeViDate(tomorrowIso),
      status: 'Đang làm',
      displayStatus: 'Đang làm',
      priority: 'Trung bình',
      bucket: 'upcoming',
      departmentName: 'Kỹ thuật',
      description: 'Đối chiếu phân quyền truy cập tài liệu và công việc theo từng phòng ban.',
      updatedLabel: 'Cập nhật 3 giờ trước',
      isSample: true,
    },
    {
      id: 'my-1008',
      code: '#1008',
      title: 'Rà soát dữ liệu khách hàng',
      project: 'QCRM',
      assigneeId: 'mk',
      assigneeName: 'Minh Khôi',
      dueDate: yesterdayIso,
      dueLabel: formatRelativeViDate(yesterdayIso),
      status: 'Quá hạn',
      displayStatus: 'Cần xử lý',
      priority: 'Ưu tiên cao',
      departmentName: 'Kinh doanh',
      description: 'Làm sạch dữ liệu khách hàng doanh nghiệp và cập nhật người phụ trách chăm sóc.',
      updatedLabel: 'Cập nhật hôm qua',
      isSample: true,
    },
    {
      id: 'my-1009',
      code: '#1009',
      title: 'Chuẩn bị tài liệu họp phòng',
      project: 'Nội bộ',
      assigneeId: 'mk',
      assigneeName: 'Minh Khôi',
      dueDate: plus2Iso,
      dueLabel: formatRelativeViDate(plus2Iso),
      status: 'Chờ duyệt',
      displayStatus: 'Chờ duyệt',
      priority: 'Thấp',
      bucket: 'upcoming',
      departmentName: 'Vận hành',
      description: 'Tổng hợp biên bản cuộc họp tuần trước và lịch trình công việc tuần tới.',
      updatedLabel: 'Cập nhật 5 giờ trước',
      isSample: true,
    },
  ];
}

function getExtraMyTasks(): TaskViewItem[] {
  const todayIso = addLocalDaysIso(0);
  const plus3Iso = addLocalDaysIso(3);
  const plus4Iso = addLocalDaysIso(4);
  const plus5Iso = addLocalDaysIso(5);
  const minus1Iso = addLocalDaysIso(-1);
  const minus2Iso = addLocalDaysIso(-2);
  return [
    {
      id: 'my-1010',
      code: '#1010',
      title: 'Cập nhật biểu mẫu đánh giá nhân sự Q4',
      project: 'QHRM',
      assigneeId: 'mk',
      assigneeName: 'Minh Khôi',
      dueDate: todayIso,
      dueLabel: formatRelativeViDate(todayIso),
      status: 'Đang làm',
      displayStatus: 'Đang làm',
      priority: 'Trung bình',
      bucket: 'today',
      departmentName: 'Nhân sự',
      description: 'Điều chỉnh tiêu chí đánh giá định kỳ theo khung năng lực mới.',
      updatedLabel: 'Cập nhật 6 giờ trước',
      isSample: true,
    },
    {
      id: 'my-1011',
      code: '#1011',
      title: 'Đối soát báo cáo chi phí vận hành',
      project: 'QSystem',
      assigneeId: 'mk',
      assigneeName: 'Minh Khôi',
      dueDate: plus3Iso,
      dueLabel: formatRelativeViDate(plus3Iso),
      status: 'Chờ duyệt',
      displayStatus: 'Chờ duyệt',
      priority: 'Trung bình',
      bucket: 'upcoming',
      departmentName: 'Tài chính',
      description: 'Kiểm tra bảng kê chi phí hạ tầng và phần mềm trong tháng.',
      updatedLabel: 'Cập nhật hôm qua',
      isSample: true,
    },
    {
      id: 'my-1012',
      code: '#1012',
      title: 'Tổng hợp phản hồi người dùng QSocial',
      project: 'QSocial',
      assigneeId: 'mk',
      assigneeName: 'Minh Khôi',
      dueDate: plus4Iso,
      dueLabel: formatRelativeViDate(plus4Iso),
      status: 'Đang làm',
      displayStatus: 'Đang làm',
      priority: 'Thấp',
      bucket: 'upcoming',
      departmentName: 'Sản phẩm',
      description: 'Phân loại góp ý từ nhóm vận hành và gắn nhãn ưu tiên xử lý.',
      updatedLabel: 'Cập nhật hôm qua',
      isSample: true,
    },
    {
      id: 'my-1013',
      code: '#1013',
      title: 'Kiểm tra tài liệu API tích hợp CRM',
      project: 'QCRM',
      assigneeId: 'mk',
      assigneeName: 'Minh Khôi',
      dueDate: plus4Iso,
      dueLabel: formatRelativeViDate(plus4Iso),
      status: 'Đang làm',
      displayStatus: 'Đang làm',
      priority: 'Trung bình',
      bucket: 'upcoming',
      departmentName: 'Kỹ thuật',
      description: 'Xác minh schema webhook đồng bộ khách hàng mới giữa QCRM và QTask.',
      updatedLabel: 'Cập nhật 2 ngày trước',
      isSample: true,
    },
    {
      id: 'my-1014',
      code: '#1014',
      title: 'Lên lịch đào tạo quy trình bảo mật',
      project: 'Nội bộ',
      assigneeId: 'mk',
      assigneeName: 'Minh Khôi',
      dueDate: plus5Iso,
      dueLabel: formatRelativeViDate(plus5Iso),
      status: 'Đang làm',
      displayStatus: 'Đang làm',
      priority: 'Thấp',
      bucket: 'upcoming',
      departmentName: 'Vận hành',
      description: 'Mời đại diện các phòng ban tham gia buổi hướng dẫn định kỳ.',
      updatedLabel: 'Cập nhật 2 ngày trước',
      isSample: true,
    },
    {
      id: 'my-1015',
      code: '#1015',
      title: 'Chốt danh sách thiết bị làm việc mới',
      project: 'Nội bộ',
      assigneeId: 'mk',
      assigneeName: 'Minh Khôi',
      dueDate: minus1Iso,
      dueLabel: formatRelativeViDate(minus1Iso),
      status: 'Hoàn thành',
      displayStatus: 'Hoàn thành',
      priority: 'Trung bình',
      bucket: 'done',
      departmentName: 'Hành chính',
      description: 'Hoàn tất duyệt đề xuất cấp phát màn hình cho nhân sự mới.',
      updatedLabel: 'Hoàn thành tuần này',
      isSample: true,
    },
    {
      id: 'my-1016',
      code: '#1016',
      title: 'Rà soát ghi chú phát hành phiên bản 2.4',
      project: 'QSystem',
      assigneeId: 'mk',
      assigneeName: 'Minh Khôi',
      dueDate: minus2Iso,
      dueLabel: formatRelativeViDate(minus2Iso),
      status: 'Hoàn thành',
      displayStatus: 'Hoàn thành',
      priority: 'Thấp',
      bucket: 'done',
      departmentName: 'Sản phẩm',
      description: 'Kiểm tra danh sách thay đổi và phát hành thông báo nội bộ.',
      updatedLabel: 'Hoàn thành tuần này',
      isSample: true,
    },
  ];
}

const EXTRA_MY_TASK_IDS = new Set([
  'my-1010',
  'my-1011',
  'my-1012',
  'my-1013',
  'my-1014',
  'my-1015',
  'my-1016',
]);

const WEEK_SCHEDULE_TEMPLATES = [
  { label: 'T2', title: '09:30 · Họp giao ban đầu tuần', sub: 'Phòng họp B · 6 thành viên' },
  { label: 'T3', title: '10:00 · Rà soát thiết kế QHRM', sub: 'Trực tuyến · 3 thành viên' },
  { label: 'T4', title: '14:00 · Họp đánh giá sprint', sub: 'Phòng họp A · 4 thành viên' },
  { label: 'T5', title: '15:30 · Đồng bộ tiến độ QCRM V2', sub: 'Phòng họp A · 5 thành viên' },
  { label: 'T6', title: '16:00 · Tổng kết tuần và bàn giao', sub: 'Phòng họp C · 8 thành viên' },
  { label: 'T7', title: 'Không có lịch họp cố định', sub: 'Thời gian tập trung xử lý đầu việc' },
  { label: 'CN', title: 'Cuối tuần', sub: 'Chuẩn bị kế hoạch tuần tiếp theo' },
] as const;

interface WeekDayItem {
  iso: string;
  label: string;
  day: number;
  title: string;
  sub: string;
}

function buildCurrentWeekSchedule(now = new Date()): { rangeLabel: string; days: WeekDayItem[] } {
  const isoWeekday = getLocalIsoWeekday(now);
  const mondayOffset = -(isoWeekday - 1);
  const days = WEEK_SCHEDULE_TEMPLATES.map((tpl, index) => {
    const iso = addLocalDaysIso(mondayOffset + index, now);
    const [, , dayStr] = iso.split('-');
    return {
      iso,
      label: tpl.label,
      day: Number(dayStr),
      title: tpl.title,
      sub: tpl.sub,
    };
  });
  const first = days[0]!;
  const last = days[days.length - 1]!;
  const [, firstMonth, firstDay] = first.iso.split('-');
  const [, lastMonth, lastDay] = last.iso.split('-');
  const rangeLabel =
    firstMonth === lastMonth
      ? `${firstDay} – ${lastDay}/${lastMonth}`
      : `${firstDay}/${firstMonth} – ${lastDay}/${lastMonth}`;
  return { rangeLabel, days };
}

type MineTabId = 'all' | 'today' | 'upcoming' | 'done';

function toViewTask(task: Task): TaskViewItem {
  return {
    ...task,
    project: task.departmentId ? 'QSystem' : 'QTask',
    displayStatus: task.status,
    dueLabel: formatRelativeViDate(task.dueDate),
  };
}

function getBaseMySample(): TaskViewItem[] {
  return [...getSampleMyTasks(), ...getExtraMyTasks()];
}

function mergeMineSampleTasks(stored: StoredTasksState): TaskViewItem[] {
  const deleted = new Set(stored.deletedMine);
  const base = getBaseMySample()
    .filter((t) => !deleted.has(t.id))
    .map((t) => stored.editedMine[t.id] ?? t);
  const baseIds = new Set(base.map((t) => t.id));
  const custom = stored.customMine.filter((t) => !deleted.has(t.id) && !baseIds.has(t.id));
  return [...custom, ...base];
}

export function MyTasksView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tasks, setTasks] = React.useState<TaskViewItem[]>(() =>
    canUseDevPersistence() ? getBaseMySample() : [],
  );
  const [usingSample, setUsingSample] = React.useState(() => canUseDevPersistence());
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadTick, setReloadTick] = React.useState(0);
  const [expanded, setExpanded] = React.useState(false);
  const [tab, setTab] = React.useState<MineTabId>('all');
  const [selectedDayIso, setSelectedDayIso] = React.useState<string>(() => getLocalDateIso());
  const [calHighlight, setCalHighlight] = React.useState(false);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [people, setPeople] = React.useState<AssigneeOption[]>([]);
  const [departments, setDepartments] = React.useState<{ id: string; name: string }[]>([]);
  const { me: sessionMe } = useSession();
  const [me, setMe] = React.useState<{ id?: string; name?: string }>(() =>
    sessionMe ? { id: sessionMe.id, name: sessionMe.name } : {},
  );
  const [pendingIds, setPendingIds] = React.useState(new Set<string>());
  const calendarRef = React.useRef<HTMLDivElement>(null);
  const filterRef = React.useRef<HTMLDivElement>(null);
  const highlightTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current);
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
      const diff = diffCalendarDays(detail.dueDate);
      const item: TaskViewItem = {
        ...detail,
        dueLabel: formatRelativeViDate(detail.dueDate),
        bucket: detail.status === 'Hoàn thành' ? 'done' : diff <= 0 ? 'today' : 'upcoming',
      };
      setTasks((prev) => [item, ...prev.filter((entry) => entry.id !== detail.id)]);
    };
    window.addEventListener('qsystem:task-created', onTaskCreated);
    return () => window.removeEventListener('qsystem:task-created', onTaskCreated);
  }, []);

  React.useEffect(() => {
    let active = true;
    if (canUseDevPersistence()) {
      setTasks(mergeMineSampleTasks(loadStoredTasks()));
    }
    if (sessionMe) {
      setMe({ id: sessionMe.id, name: sessionMe.name });
    } else {
      void apiFetch<{ id: string; name: string }>('/api/me')
        .then((user) => {
          if (active) setMe(user);
        })
        .catch(() => {});
    }
    void apiFetch<{ id: string; name: string }[]>('/api/org/departments')
      .then((items) => {
        if (active && Array.isArray(items)) setDepartments(items);
      })
      .catch(() => {});
    void apiFetch<{ id: string; name: string }[]>('/api/org/users')
      .then((items) => {
        if (active && Array.isArray(items)) setPeople(items);
      })
      .catch(() => {});
    void listTasks()
      .then((rows) => {
        if (!active) return;
        setLoadError(null);
        if (rows.length > 0) {
          setTasks(rows.map(toViewTask));
          setUsingSample(false);
        } else if (!canUseDevPersistence()) {
          setTasks([]);
          setUsingSample(false);
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (!canUseDevPersistence()) {
          setLoadError(
            err instanceof ApiError ? humanizeApiError(err.code, err.status) : humanizeApiError(),
          );
          setTasks([]);
          setUsingSample(false);
        }
      });
    return () => {
      active = false;
    };
  }, [reloadTick]);

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

  const myTasks = React.useMemo(() => {
    if (usingSample || !me.id) return tasks;
    const mine = tasks.filter((t) => !t.assigneeId || t.assigneeId === me.id);
    return mine.length > 0 ? mine : tasks;
  }, [tasks, usingSample, me.id]);

  const filteredTasks = React.useMemo(() => {
    return myTasks.filter((task) => {
      if (tab === 'all' && usingSample && !expanded && !statusFilter && EXTRA_MY_TASK_IDS.has(task.id)) {
        return false;
      }
      if (tab === 'today') {
        if (task.status === 'Hoàn thành') return false;
        if (diffCalendarDays(task.dueDate) !== 0) return false;
      } else if (tab === 'upcoming') {
        if (task.status === 'Hoàn thành') return false;
        if (diffCalendarDays(task.dueDate) <= 0) return false;
      } else if (tab === 'done') {
        if (task.status !== 'Hoàn thành') return false;
      }
      if (statusFilter && (task.displayStatus ?? task.status) !== statusFilter && task.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [myTasks, tab, statusFilter, usingSample, expanded]);

  const selectedTask = myTasks.find((t) => t.id === selectedId) ?? null;

  const departmentName = React.useCallback(
    (id?: string, fallback?: string) =>
      fallback ?? departments.find((d) => d.id === id)?.name ?? 'Nhân sự',
    [departments],
  );

  function persistMinePatch(updated: TaskViewItem) {
    if (!canUseDevPersistence()) return;
    const baseSampleIds = new Set(getBaseMySample().map((item) => item.id));
    saveStoredTasks((prev) => {
      if (baseSampleIds.has(updated.id)) {
        return {
          ...prev,
          editedMine: { ...prev.editedMine, [updated.id]: updated },
        };
      }
      return {
        ...prev,
        customMine: [updated, ...prev.customMine.filter((entry) => entry.id !== updated.id)],
      };
    });
  }

  async function handleStatusChange(task: TaskViewItem, nextStatus: TaskStatus) {
    if (pendingIds.has(task.id) || task.status === nextStatus) return;
    if (task.isSample) {
      const updated = applyStatusPatch(task, nextStatus, true);
      setTasks((prev) => prev.map((item) => (item.id === task.id ? updated : item)));
      persistMinePatch(updated);
      toast.success(
        nextStatus === 'Hoàn thành'
          ? `Đã hoàn thành công việc ${task.code}`
          : `Đã chuyển ${task.code} sang ${nextStatus}`,
      );
      return;
    }

    setPendingIds((prev) => new Set(prev).add(task.id));
    try {
      const updated = task.version === undefined
        ? await updateTaskStatus(task.id, nextStatus)
        : await updateTaskStatus(task.id, nextStatus, task.version);
      setTasks((prev) =>
        prev.map((item) =>
          item.id === task.id ? { ...item, ...updated, displayStatus: updated.status } : item,
        ),
      );
      toast.success(
        nextStatus === 'Hoàn thành'
          ? `Đã hoàn thành việc ${task.code}`
          : `Đã chuyển việc ${task.code} sang ${nextStatus}`,
      );
    } catch {
      if (!canUseDevPersistence()) {
        toast.error(`Chưa cập nhật được công việc ${task.code}. Vui lòng thử lại.`);
        return;
      }
      const updated = applyStatusPatch(task, nextStatus);
      setTasks((prev) => prev.map((item) => (item.id === task.id ? updated : item)));
      persistMinePatch(updated);
      toast.success(
        nextStatus === 'Hoàn thành'
          ? `Đã hoàn thành việc ${task.code}`
          : `Đã chuyển việc ${task.code} sang ${nextStatus}`,
      );
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  }

  function closeModal(nextOpen: boolean) {
    setCreating(nextOpen);
    if (!nextOpen && searchParams.get('giao-viec') === '1') {
      router.replace(pathname, { scroll: false });
    }
  }

  const todayStr = getLocalDateIso();
  const weekSchedule = React.useMemo(() => buildCurrentWeekSchedule(), [todayStr]);
  const activeDayEvent =
    weekSchedule.days.find((d) => d.iso === selectedDayIso) ??
    weekSchedule.days.find((d) => d.iso === todayStr) ??
    weekSchedule.days[0]!;

  const baseSample = React.useMemo(() => getBaseMySample(), [todayStr]);
  const baseSampleCount = baseSample.length;
  const baseTodayOpenCount = baseSample.filter(
    (t) => t.status !== 'Hoàn thành' && diffCalendarDays(t.dueDate) === 0,
  ).length;
  const baseUpcomingOpenCount = baseSample.filter(
    (t) => t.status !== 'Hoàn thành' && diffCalendarDays(t.dueDate) > 0,
  ).length;
  const baseDoneCount = baseSample.filter((t) => t.status === 'Hoàn thành').length;

  const currentTodayOpenCount = myTasks.filter(
    (t) =>
      t.status !== 'Hoàn thành' &&
      (usingSample ? diffCalendarDays(t.dueDate) === 0 : diffCalendarDays(t.dueDate) <= 0),
  ).length;
  const currentUpcomingOpenCount = myTasks.filter(
    (t) => t.status !== 'Hoàn thành' && diffCalendarDays(t.dueDate) > 0,
  ).length;
  const currentDoneCount = myTasks.filter((t) => t.status === 'Hoàn thành').length;

  const totalCount = usingSample ? 12 + Math.max(0, tasks.length - baseSampleCount) : myTasks.length;
  const todayCount = usingSample
    ? Math.max(0, 3 + (currentTodayOpenCount - baseTodayOpenCount))
    : currentTodayOpenCount;
  const upcomingCount = usingSample
    ? Math.max(0, 8 + (currentUpcomingOpenCount - baseUpcomingOpenCount))
    : currentUpcomingOpenCount;
  const overdueCount = myTasks.filter((t) => t.status === 'Quá hạn').length;
  const doneDelta = currentDoneCount - baseDoneCount;
  const doneCount = usingSample ? Math.max(0, 8 + doneDelta) : currentDoneCount;
  const weeklyTarget = usingSample ? 11 : Math.max(0, myTasks.length);
  const weeklyDoneUnits = usingSample ? Math.min(11, Math.max(0, 8 + doneDelta)) : doneCount;
  const weeklyPct = usingSample
    ? doneDelta === 0
      ? 76
      : Math.round((weeklyDoneUnits / 11) * 100)
    : weeklyTarget === 0
      ? 0
      : Math.round((doneCount / weeklyTarget) * 100);

  return (
    <section className="qx-page" aria-label="Công việc của tôi">
      <header className="qx-page-head">
        <div>
          <h1>Công việc của tôi</h1>
          <p>Theo dõi các việc cần ưu tiên và tiến độ của bạn trong tuần này</p>
        </div>
        <div className="qx-actions">
          <button
            type="button"
            className="qx-btn"
            onClick={() => {
              calendarRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
              setSelectedDayIso(getLocalDateIso());
              setCalHighlight(true);
              if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current);
              highlightTimerRef.current = window.setTimeout(() => setCalHighlight(false), 1800);
            }}
          >
            <Calendar size={16} strokeWidth={1.5} aria-hidden="true" />
            Xem lịch
          </button>
          <button type="button" className="qx-btn qx-btn--primary" onClick={() => setCreating(true)}>
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            Tạo công việc
          </button>
        </div>
      </header>

      <div className="qx-stats">
        <article className="qx-stat">
          <span className="qx-stat__label">Được giao</span>
          <div className="qx-stat__value">{totalCount}</div>
          <div className="qx-stat__note">Tổng số công việc</div>
        </article>

        <article className="qx-stat">
          <span className="qx-stat__label">Cần làm hôm nay</span>
          <div className="qx-stat__value">{todayCount}</div>
          <div className="qx-stat__note">2 việc cần ưu tiên</div>
        </article>

        <article className="qx-stat">
          <span className="qx-stat__label">Quá hạn</span>
          <div className="qx-stat__value">{overdueCount}</div>
          <div className="qx-stat__note">Cần xử lý ngay</div>
        </article>

        <article className="qx-stat">
          <span className="qx-stat__label">Hoàn thành tuần này</span>
          <div className="qx-stat__value">{doneCount}</div>
          <div className="qx-stat__note">Tăng 18% so với tuần trước</div>
        </article>
      </div>

      {loadError ? (
        <div className="qx-alert-banner" role="alert">
          <span>{loadError}</span>
          <button type="button" className="qx-btn qx-btn--sm" onClick={() => setReloadTick((n) => n + 1)}>
            Thử lại
          </button>
        </div>
      ) : null}

      <div className="qtk-mine-grid">
        <div className="qx-card qtk-mine-card">
          <div className="qx-card__head">
            <h2 className="qx-card__title">Danh sách công việc</h2>
            <div className="qtk-toolbar-wrap" ref={filterRef}>
              <button
                type="button"
                className="qx-btn qx-btn--sm"
                aria-expanded={filterOpen}
                onClick={() => setFilterOpen((open) => !open)}
              >
                <ListFilter size={16} strokeWidth={1.5} aria-hidden="true" />
                Bộ lọc
              </button>
              {filterOpen ? (
                <div className="qtk-popover" role="region" aria-label="Bộ lọc công việc">
                  <div className="qtk-popover__field">
                    <label htmlFor="qtk-mine-status-filter" className="qtk-popover__label">
                      Trạng thái
                    </label>
                    <Select
                      id="qtk-mine-status-filter"
                      aria-label="Trạng thái"
                      controlSize="sm"
                      value={statusFilter}
                      onValueChange={setStatusFilter}
                      options={MY_STATUS_FILTER_OPTIONS}
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
          </div>

          <div className="qtk-mine-tabs">
            <div className="qx-tabs" role="tablist" aria-label="Phạm vi công việc của tôi">
              <button
                type="button"
                role="tab"
                className="qx-tab"
                aria-selected={tab === 'all'}
                onClick={() => setTab('all')}
              >
                {`Tất cả (${totalCount})`}
              </button>
              <button
                type="button"
                role="tab"
                className="qx-tab"
                aria-selected={tab === 'today'}
                onClick={() => setTab('today')}
              >
                {`Hôm nay (${todayCount})`}
              </button>
              <button
                type="button"
                role="tab"
                className="qx-tab"
                aria-selected={tab === 'upcoming'}
                onClick={() => setTab('upcoming')}
              >
                {`Sắp tới (${upcomingCount})`}
              </button>
              <button
                type="button"
                role="tab"
                className="qx-tab"
                aria-selected={tab === 'done'}
                onClick={() => setTab('done')}
              >
                {`Đã xong (${doneCount})`}
              </button>
            </div>
          </div>

          <ul className="qtk-mine-list" role="tabpanel">
            {filteredTasks.length === 0 ? (
              <li className="qtk-mine-row" style={{ cursor: 'default' }}>
                <p className="qtk-mine-meta">Không có công việc nào khớp bộ lọc hiện tại</p>
              </li>
            ) : (
              filteredTasks.map((task) => {
                const badgeText = task.displayStatus ?? task.status;
                const isDone = task.status === 'Hoàn thành';
                const isHigh = badgeText === 'Ưu tiên cao';
                return (
                  <li key={task.id} className="qtk-mine-row">
                    <button
                      type="button"
                      className="qtk-mine-check"
                      aria-label={isDone ? `Đã hoàn thành ${task.title}` : `Đánh dấu hoàn thành ${task.title}`}
                      data-done={isDone ? 'true' : 'false'}
                      data-priority={!isDone && isHigh ? 'high' : 'normal'}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleStatusChange(task, isDone ? 'Đang làm' : 'Hoàn thành');
                      }}
                    >
                      <CheckCircle2 size={16} strokeWidth={1.5} aria-hidden="true" />
                    </button>

                    <div className="qtk-mine-main">
                      <button
                        type="button"
                        className="qtk-mine-title"
                        data-done={isDone ? 'true' : 'false'}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedId(task.id);
                        }}
                      >
                        {task.title}
                      </button>
                      <p className="qtk-mine-meta">{`${task.project ?? 'QTask'} · ${task.code}`}</p>
                    </div>

                    <div className="qtk-mine-right">
                      <span className={getStatusBadgeClass(badgeText)}>{badgeText}</span>
                      <span className="qtk-mine-due">{task.dueLabel ?? formatRelativeViDate(task.dueDate)}</span>
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          <div className="qtk-mine-foot">
            <button
              type="button"
              className="qtk-mine-more"
              aria-expanded={expanded}
              onClick={() => setExpanded((prev) => !prev)}
            >
              <span>
                {expanded
                  ? `Thu gọn danh sách (${filteredTasks.length} công việc)`
                  : `Đang hiển thị ${filteredTasks.length} trong ${totalCount} công việc`}
              </span>
              {expanded ? (
                <ChevronUp size={16} strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <aside className="qtk-mine-side" aria-label="Lịch và tiến độ">
          <div
            className="qx-card qtk-side-card"
            ref={calendarRef}
            data-highlight={calHighlight ? 'true' : undefined}
          >
            <div className="qtk-side-card__head">
              <h2>Lịch tuần này</h2>
              <span className="qtk-side-card__range">{weekSchedule.rangeLabel}</span>
            </div>

            <div className="qtk-cal-strip" role="group" aria-label="Ngày trong tuần">
              {weekSchedule.days.map((day) => (
                <button
                  key={day.iso}
                  type="button"
                  className="qtk-cal-day"
                  aria-pressed={selectedDayIso === day.iso}
                  aria-current={day.iso === todayStr ? 'date' : undefined}
                  data-today={day.iso === todayStr ? 'true' : undefined}
                  onClick={() => setSelectedDayIso(day.iso)}
                >
                  <span className="qtk-cal-day__label">{day.label}</span>
                  <span className="qtk-cal-day__num">{day.day}</span>
                </button>
              ))}
            </div>

            <div className="qtk-cal-event">
              <p className="qtk-cal-event__title">{activeDayEvent.title}</p>
              <p className="qtk-cal-event__sub">{activeDayEvent.sub}</p>
            </div>
          </div>

          <div className="qx-card qtk-side-card">
            <div className="qtk-side-card__head">
              <h2>Tiến độ tuần</h2>
              <span className="qx-badge qx-badge--green qtk-progress-badge">{`${weeklyPct}%`}</span>
            </div>

            <div
              className="qtk-progress-track"
              role="progressbar"
              aria-valuenow={weeklyPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Tiến độ tuần ${weeklyPct}%`}
            >
              <div className="qtk-progress-fill" style={{ width: `${weeklyPct}%` }} />
            </div>
            <p className="qtk-progress-caption">{`${weeklyDoneUnits} / ${weeklyTarget} đầu việc đã hoàn thành`}</p>
            <p className="qtk-progress-tip">
              <span>Tiến độ xử lý đầu việc ổn định trong tuần này</span>
            </p>
          </div>
        </aside>
      </div>

      <TaskDetailDrawer
        task={selectedTask}
        departmentName={selectedTask ? departmentName(selectedTask.departmentId, selectedTask.departmentName) : 'Nhân sự'}
        pending={selectedTask ? pendingIds.has(selectedTask.id) : false}
        onClose={() => setSelectedId(null)}
        onStatusChange={(next) => {
          if (selectedTask) void handleStatusChange(selectedTask, next);
        }}
        onComplete={() => {
          if (selectedTask) void handleStatusChange(selectedTask, 'Hoàn thành');
        }}
        currentUserName={me.name ?? 'Minh Khôi'}
      />

      <CreateTaskModal
        open={creating}
        onOpenChange={closeModal}
        people={people}
        onCreated={(created) => {
          const diff = diffCalendarDays(created.dueDate);
          const item: TaskViewItem = {
            ...created,
            dueLabel: formatRelativeViDate(created.dueDate),
            bucket: created.status === 'Hoàn thành' ? 'done' : diff <= 0 ? 'today' : 'upcoming',
          };
          setTasks((prev) => [item, ...prev.filter((entry) => entry.id !== item.id)]);
          recordCreatedTaskInStorage(item, 'mine');
          toast.success(`Đã giao việc ${created.code} cho ${created.assigneeName}`);
        }}
      />
    </section>
  );
}
