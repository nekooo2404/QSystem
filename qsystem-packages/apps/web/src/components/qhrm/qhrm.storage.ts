import {
  addLocalDaysIso,
  formatDdMmYyyy,
  formatLocalTimeHm,
  getLocalDateIso,
  getUserTimeZone,
} from '../../lib/date';
import type {
  AttendanceRecord,
  AttendanceStatus,
  Department,
  LeaveBalanceSummary,
  LeaveRequest,
  LeaveType,
  OrgUser,
} from './qhrm.types';

export const ATTENDANCE_STORAGE_KEY = 'qsystem:org:attendance:v1';
export const LEAVES_STORAGE_KEY = 'qsystem:org:leaves:v1';
export const DEFAULT_ANNUAL_ENTITLEMENT = 12;

export const SHIFT_START_HM = '08:30';
export const SHIFT_END_HM = '17:30';
const SHIFT_START_MINUTES = 8 * 60 + 30;
const SHIFT_END_MINUTES = 17 * 60 + 30;
const MS_PER_DAY = 86_400_000;

export function resolveEmployeeCode(user: OrgUser, fallbackIndex = 0): string {
  if (user.employeeCode && user.employeeCode.trim()) return user.employeeCode.trim();
  const idMatch = /^u-(\d+)$/.exec(user.id);
  if (idMatch) {
    const num = Number(idMatch[1]);
    if (num > 0) return `NV-${String(num).padStart(4, '0')}`;
    return 'NV-0099';
  }
  let hash = 0;
  for (let i = 0; i < user.id.length; i += 1) {
    hash = (hash * 31 + user.id.charCodeAt(i)) % 9000;
  }
  const codeNum = 100 + ((hash + fallbackIndex) % 900);
  return `NV-${String(codeNum).padStart(4, '0')}`;
}

export function resolveDepartmentName(
  departmentId: string | null,
  departments: Department[],
): string {
  if (!departmentId) return 'Toàn công ty';
  return departments.find((d) => d.id === departmentId)?.name ?? 'Toàn công ty';
}

export function parseHmToMinutes(hm: string | null | undefined): number | null {
  if (!hm) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(hm.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function computeWorkedHours(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
): number {
  const inMin = parseHmToMinutes(checkIn);
  const outMin = parseHmToMinutes(checkOut);
  if (inMin === null || outMin === null || outMin <= inMin) return 0;
  return Math.round(((outMin - inMin) / 60) * 10) / 10;
}

export function formatWorkedHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '—';
  return `${hours.toFixed(1).replace('.', ',')} giờ`;
}

export function formatWorkedHoursSum(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0,0 giờ';
  return `${hours.toFixed(1).replace('.', ',')} giờ`;
}

export function formatDateTimeLabel(date = new Date()): string {
  const tz = getUserTimeZone();
  return `${formatLocalTimeHm(date, tz)} · ${formatDdMmYyyy(date, tz)}`;
}

function parseIsoParts(iso: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() + 1 !== month ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function countInclusiveDays(fromIso: string, toIso: string): number {
  const start = parseIsoParts(fromIso);
  const end = parseIsoParts(toIso);
  if (!start || !end) return 0;
  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);
  if (endUtc < startUtc) return 0;
  return Math.round((endUtc - startUtc) / MS_PER_DAY) + 1;
}

export function enumerateIsoDates(fromIso: string, toIso: string, maxDays = 62): string[] {
  const start = parseIsoParts(fromIso);
  const end = parseIsoParts(toIso);
  if (!start || !end) return [];
  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);
  if (endUtc < startUtc) return [];
  const total = Math.min(maxDays, Math.round((endUtc - startUtc) / MS_PER_DAY) + 1);
  const result: string[] = [];
  for (let i = 0; i < total; i += 1) {
    const dt = new Date(Date.UTC(start.year, start.month - 1, start.day + i));
    const y = String(dt.getUTCFullYear()).padStart(4, '0');
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    result.push(`${y}-${m}-${d}`);
  }
  return result;
}

export function formatLeaveDateRange(fromIso: string, toIso: string): string {
  const fromFormatted = formatDdMmYyyy(fromIso);
  const toFormatted = formatDdMmYyyy(toIso);
  return fromIso === toIso ? fromFormatted : `${fromFormatted} – ${toFormatted}`;
}

function readLocalJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeLocalJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota / private mode failures.
  }
}

export function loadStoredAttendance(): AttendanceRecord[] | null {
  const parsed = readLocalJson<AttendanceRecord[]>(ATTENDANCE_STORAGE_KEY);
  return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
}

export function saveStoredAttendance(records: AttendanceRecord[]): void {
  writeLocalJson(ATTENDANCE_STORAGE_KEY, records);
}

export function loadStoredLeaves(): LeaveRequest[] | null {
  const parsed = readLocalJson<LeaveRequest[]>(LEAVES_STORAGE_KEY);
  return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
}

export function saveStoredLeaves(requests: LeaveRequest[]): void {
  writeLocalJson(LEAVES_STORAGE_KEY, requests);
}

function pickApprover(user: OrgUser, users: OrgUser[]): { id: string | null; name: string } {
  if (user.reportsToId) {
    const direct = users.find((u) => u.id === user.reportsToId);
    if (direct) return { id: direct.id, name: direct.name };
  }
  const manager = users.find(
    (u) => u.id !== user.id && (u.role === 'DIRECTOR' || u.role === 'MANAGER'),
  );
  if (manager) return { id: manager.id, name: manager.name };
  const director = users.find((u) => u.role === 'DIRECTOR');
  if (director) return { id: director.id, name: director.name };
  return { id: null, name: 'Quản lý trực tiếp' };
}

export function buildSeedLeaves(
  users: OrgUser[],
  departments: Department[],
  currentUserId: string,
  isSampleMode: boolean,
  baseDate = new Date(),
): LeaveRequest[] {
  if (users.length === 0) return [];
  const todayIso = getLocalDateIso(baseDate);
  const currentUser = users.find((u) => u.id === currentUserId) ?? users[0];
  const otherUsers = users.filter((u) => u.id !== currentUser.id);
  const firstOther = otherUsers[0] ?? currentUser;
  const secondOther = otherUsers[1] ?? firstOther;
  const thirdOther = otherUsers[2] ?? secondOther;

  const list: LeaveRequest[] = [];
  let seq = 1001;

  const pushLeave = (
    user: OrgUser,
    idx: number,
    partial: Omit<
      LeaveRequest,
      | 'id'
      | 'code'
      | 'employeeId'
      | 'employeeCode'
      | 'employeeName'
      | 'employeeEmail'
      | 'departmentId'
      | 'departmentName'
      | 'approverId'
      | 'approverName'
    >,
  ) => {
    const approver = pickApprover(user, users);
    const code = `NP-${seq}`;
    seq += 1;
    list.push({
      id: `leave-seed-${code.toLowerCase()}`,
      code,
      employeeId: user.id,
      employeeCode: resolveEmployeeCode(user, idx),
      employeeName: user.name,
      employeeEmail: user.email,
      departmentId: user.departmentId,
      departmentName: resolveDepartmentName(user.departmentId, departments),
      approverId: approver.id,
      approverName: approver.name,
      ...partial,
    });
  };

  // 1. Past approved annual leave for current user (used = 2 days, does not mark today as on leave)
  const pastFrom = addLocalDaysIso(-5, baseDate);
  const pastTo = addLocalDaysIso(-4, baseDate);
  pushLeave(currentUser, users.indexOf(currentUser), {
    type: 'Phép năm',
    fromDate: pastFrom,
    toDate: pastTo,
    days: 2,
    reason: 'Nghỉ phép gia đình theo kế hoạch',
    status: 'Đã duyệt',
    createdAtLabel: `09:15 · ${formatDdMmYyyy(addLocalDaysIso(-7, baseDate))}`,
    reviewedByName: pickApprover(currentUser, users).name,
    reviewedAtLabel: `14:20 · ${formatDdMmYyyy(addLocalDaysIso(-6, baseDate))}`,
  });

  // 2. Pending annual leave request from a colleague for tomorrow..+2 days (ready for Duyệt / Từ chối)
  const tomorrowIso = addLocalDaysIso(1, baseDate);
  const twoDaysIso = addLocalDaysIso(2, baseDate);
  pushLeave(firstOther, users.indexOf(firstOther), {
    type: 'Phép năm',
    fromDate: tomorrowIso,
    toDate: twoDaysIso,
    days: 2,
    reason: 'Giải quyết việc gia đình tại quê',
    status: 'Chờ duyệt',
    createdAtLabel: `08:40 · ${formatDdMmYyyy(todayIso)}`,
  });

  // 3. Pending compensatory leave covering TODAY (approving immediately updates Today's Attendance!)
  if (secondOther.id !== currentUser.id) {
    pushLeave(secondOther, users.indexOf(secondOther), {
      type: 'Nghỉ bù',
      fromDate: todayIso,
      toDate: todayIso,
      days: 1,
      reason: 'Nghỉ bù trực triển khai hệ thống cuối tuần',
      status: 'Chờ duyệt',
      createdAtLabel: `08:05 · ${formatDdMmYyyy(todayIso)}`,
    });
  }

  // 4. Past rejected personal leave
  const rejectedIso = addLocalDaysIso(-7, baseDate);
  pushLeave(thirdOther, users.indexOf(thirdOther), {
    type: 'Việc riêng',
    fromDate: rejectedIso,
    toDate: rejectedIso,
    days: 1,
    reason: 'Xin nghỉ giải quyết thủ tục cá nhân',
    status: 'Từ chối',
    createdAtLabel: `10:30 · ${formatDdMmYyyy(addLocalDaysIso(-8, baseDate))}`,
    reviewedByName: pickApprover(thirdOther, users).name,
    reviewedAtLabel: `15:10 · ${formatDdMmYyyy(addLocalDaysIso(-8, baseDate))}`,
    rejectionReason: 'Trùng lịch bàn giao định kỳ, đề nghị sắp xếp ngày khác.',
  });

  // 5. In sample mode, sync employees currently marked 'Nghỉ phép' with approved today leave
  if (isSampleMode) {
    users.forEach((user, idx) => {
      if (user.statusLabel === 'Nghỉ phép' && user.id !== currentUser.id) {
        pushLeave(user, idx, {
          type: 'Phép năm',
          fromDate: todayIso,
          toDate: todayIso,
          days: 1,
          reason: 'Nghỉ phép đã được phê duyệt theo lịch bộ phận',
          status: 'Đã duyệt',
          createdAtLabel: `09:00 · ${formatDdMmYyyy(addLocalDaysIso(-2, baseDate))}`,
          reviewedByName: pickApprover(user, users).name,
          reviewedAtLabel: `11:30 · ${formatDdMmYyyy(addLocalDaysIso(-1, baseDate))}`,
        });
      }
    });
  }

  return list;
}

export function buildSeedAttendance(
  users: OrgUser[],
  departments: Department[],
  leaves: LeaveRequest[],
  currentUserId: string,
  baseDate = new Date(),
): AttendanceRecord[] {
  if (users.length === 0) return [];
  const todayIso = getLocalDateIso(baseDate);
  const yesterdayIso = addLocalDaysIso(-1, baseDate);
  const records: AttendanceRecord[] = [];

  const presets: Array<{ checkIn: string | null; checkOut: string | null; status: AttendanceStatus; note: string }> = [
    { checkIn: '08:18', checkOut: '17:32', status: 'Đúng giờ', note: '' },
    { checkIn: '08:25', checkOut: '17:35', status: 'Đúng giờ', note: '' },
    { checkIn: '08:47', checkOut: '17:45', status: 'Đi muộn', note: 'Kẹt xe giờ cao điểm' },
    { checkIn: '08:20', checkOut: '17:05', status: 'Về sớm', note: 'Xin về sớm khám định kỳ' },
    { checkIn: null, checkOut: null, status: 'Chưa chấm công', note: '' },
  ];

  // Today records
  users.forEach((user, idx) => {
    const code = resolveEmployeeCode(user, idx);
    const deptName = resolveDepartmentName(user.departmentId, departments);
    const isCurrent = user.id === currentUserId;

    if (isCurrent) {
      records.push({
        id: `att-${user.id}-${todayIso}`,
        employeeId: user.id,
        employeeCode: code,
        employeeName: user.name,
        employeeEmail: user.email,
        departmentId: user.departmentId,
        departmentName: deptName,
        dateIso: todayIso,
        checkIn: null,
        checkOut: null,
        workedHours: 0,
        status: 'Chưa chấm công',
        note: '',
        logs: [],
      });
      return;
    }

    const preset = presets[idx % presets.length];
    const worked = computeWorkedHours(preset.checkIn, preset.checkOut);
    const logs = [];
    if (preset.checkIn) {
      logs.push({
        id: `log-in-${user.id}-${todayIso}`,
        time: `${preset.checkIn} · ${formatDdMmYyyy(todayIso)}`,
        action: 'Chấm công vào ca',
        actor: user.name,
      });
    }
    if (preset.checkOut) {
      logs.push({
        id: `log-out-${user.id}-${todayIso}`,
        time: `${preset.checkOut} · ${formatDdMmYyyy(todayIso)}`,
        action: 'Chấm công ra ca',
        actor: user.name,
      });
    }

    records.push({
      id: `att-${user.id}-${todayIso}`,
      employeeId: user.id,
      employeeCode: code,
      employeeName: user.name,
      employeeEmail: user.email,
      departmentId: user.departmentId,
      departmentName: deptName,
      dateIso: todayIso,
      checkIn: preset.checkIn,
      checkOut: preset.checkOut,
      workedHours: worked,
      status: preset.status,
      note: preset.note,
      logs,
    });
  });

  // Yesterday records (all present except approved leaves)
  users.forEach((user, idx) => {
    const code = resolveEmployeeCode(user, idx);
    const deptName = resolveDepartmentName(user.departmentId, departments);
    const checkIn = idx % 5 === 3 ? '08:42' : '08:22';
    const checkOut = '17:34';
    const status: AttendanceStatus = checkIn > SHIFT_START_HM ? 'Đi muộn' : 'Đúng giờ';
    records.push({
      id: `att-${user.id}-${yesterdayIso}`,
      employeeId: user.id,
      employeeCode: code,
      employeeName: user.name,
      employeeEmail: user.email,
      departmentId: user.departmentId,
      departmentName: deptName,
      dateIso: yesterdayIso,
      checkIn,
      checkOut,
      workedHours: computeWorkedHours(checkIn, checkOut),
      status,
      note: status === 'Đi muộn' ? 'Vào ca muộn 12 phút' : '',
      logs: [
        {
          id: `log-in-${user.id}-${yesterdayIso}`,
          time: `${checkIn} · ${formatDdMmYyyy(yesterdayIso)}`,
          action: 'Chấm công vào ca',
          actor: user.name,
        },
        {
          id: `log-out-${user.id}-${yesterdayIso}`,
          time: `${checkOut} · ${formatDdMmYyyy(yesterdayIso)}`,
          action: 'Chấm công ra ca',
          actor: user.name,
        },
      ],
    });
  });

  return syncApprovedLeavesToAttendance(leaves, records, users, departments);
}

/**
 * Ensures every loaded directory employee has a today attendance entry and overlays
 * all approved leave requests onto matching attendance dates.
 */
export function ensureAttendanceSyncedWithUsers(
  existing: AttendanceRecord[],
  users: OrgUser[],
  departments: Department[],
  leaves: LeaveRequest[],
  baseDate = new Date(),
): AttendanceRecord[] {
  const todayIso = getLocalDateIso(baseDate);
  const byKey = new Map<string, AttendanceRecord>();
  for (const record of existing) {
    byKey.set(`${record.employeeId}::${record.dateIso}`, record);
  }

  users.forEach((user, idx) => {
    const key = `${user.id}::${todayIso}`;
    const deptName = resolveDepartmentName(user.departmentId, departments);
    const code = resolveEmployeeCode(user, idx);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, {
        id: `att-${user.id}-${todayIso}`,
        employeeId: user.id,
        employeeCode: code,
        employeeName: user.name,
        employeeEmail: user.email,
        departmentId: user.departmentId,
        departmentName: deptName,
        dateIso: todayIso,
        checkIn: null,
        checkOut: null,
        workedHours: 0,
        status: 'Chưa chấm công',
        note: '',
        logs: [],
      });
    } else {
      byKey.set(key, {
        ...prev,
        employeeCode: code,
        employeeName: user.name,
        employeeEmail: user.email,
        departmentId: user.departmentId,
        departmentName: deptName,
      });
    }
  });

  return syncApprovedLeavesToAttendance(leaves, Array.from(byKey.values()), users, departments);
}

export function syncApprovedLeavesToAttendance(
  leaves: LeaveRequest[],
  attendance: AttendanceRecord[],
  users: OrgUser[],
  departments: Department[],
): AttendanceRecord[] {
  const byKey = new Map<string, AttendanceRecord>();
  for (const record of attendance) {
    byKey.set(`${record.employeeId}::${record.dateIso}`, record);
  }

  const userIndexMap = new Map(users.map((u, idx) => [u.id, { user: u, idx }]));

  for (const leave of leaves) {
    if (leave.status !== 'Đã duyệt') continue;
    const dates = enumerateIsoDates(leave.fromDate, leave.toDate);
    const matched = userIndexMap.get(leave.employeeId);
    const employeeCode = matched
      ? resolveEmployeeCode(matched.user, matched.idx)
      : leave.employeeCode;
    const departmentName = matched
      ? resolveDepartmentName(matched.user.departmentId, departments)
      : leave.departmentName;

    for (const dateIso of dates) {
      const key = `${leave.employeeId}::${dateIso}`;
      const existing = byKey.get(key);
      const leaveNote = `Nghỉ phép (${leave.type} · ${leave.code})`;
      byKey.set(key, {
        id: existing?.id ?? `att-${leave.employeeId}-${dateIso}`,
        employeeId: leave.employeeId,
        employeeCode,
        employeeName: matched?.user.name ?? leave.employeeName,
        employeeEmail: matched?.user.email ?? leave.employeeEmail,
        departmentId: matched?.user.departmentId ?? leave.departmentId,
        departmentName,
        dateIso,
        checkIn: null,
        checkOut: null,
        workedHours: 0,
        status: 'Nghỉ phép',
        note: leaveNote,
        logs: [
          ...(existing?.logs ?? []).filter((l) => !l.id.startsWith(`log-leave-${leave.id}`)),
          {
            id: `log-leave-${leave.id}-${dateIso}`,
            time: leave.reviewedAtLabel ?? leave.createdAtLabel,
            action: `Đồng bộ đơn ${leave.code} (${leave.type})`,
            actor: leave.reviewedByName ?? leave.approverName,
          },
        ],
      });
    }
  }

  return Array.from(byKey.values()).sort((a, b) => {
    if (a.dateIso !== b.dateIso) return b.dateIso.localeCompare(a.dateIso);
    return a.employeeCode.localeCompare(b.employeeCode);
  });
}

export function deriveAttendanceStatus(
  checkIn: string | null,
  checkOut: string | null,
): AttendanceStatus {
  if (!checkIn) return 'Chưa chấm công';
  const inMin = parseHmToMinutes(checkIn);
  const outMin = parseHmToMinutes(checkOut);
  if (inMin !== null && inMin > SHIFT_START_MINUTES) return 'Đi muộn';
  if (outMin !== null && outMin < SHIFT_END_MINUTES) return 'Về sớm';
  return 'Đúng giờ';
}

export function recordCheckIn(
  records: AttendanceRecord[],
  user: OrgUser,
  userIndex: number,
  departments: Department[],
  now = new Date(),
): { nextRecords: AttendanceRecord[]; updated: AttendanceRecord } {
  const tz = getUserTimeZone();
  const dateIso = getLocalDateIso(now, tz);
  const checkInHm = formatLocalTimeHm(now, tz);
  const timestamp = `${checkInHm} · ${formatDdMmYyyy(now, tz)}`;
  const existing = records.find((r) => r.employeeId === user.id && r.dateIso === dateIso);
  const status = deriveAttendanceStatus(checkInHm, existing?.checkOut ?? null);
  const updated: AttendanceRecord = {
    id: existing?.id ?? `att-${user.id}-${dateIso}`,
    employeeId: user.id,
    employeeCode: resolveEmployeeCode(user, userIndex),
    employeeName: user.name,
    employeeEmail: user.email,
    departmentId: user.departmentId,
    departmentName: resolveDepartmentName(user.departmentId, departments),
    dateIso,
    checkIn: checkInHm,
    checkOut: existing?.checkOut ?? null,
    workedHours: computeWorkedHours(checkInHm, existing?.checkOut ?? null),
    status,
    note: existing?.note ?? '',
    logs: [
      ...(existing?.logs ?? []),
      {
        id: `log-in-${Date.now()}`,
        time: timestamp,
        action: 'Chấm công vào ca',
        actor: user.name,
      },
    ],
  };

  const exists = records.some((r) => r.employeeId === user.id && r.dateIso === dateIso);
  const nextRecords = exists
    ? records.map((r) => (r.employeeId === user.id && r.dateIso === dateIso ? updated : r))
    : [updated, ...records];
  return { nextRecords, updated };
}

export function recordCheckOut(
  records: AttendanceRecord[],
  user: OrgUser,
  userIndex: number,
  departments: Department[],
  now = new Date(),
): { nextRecords: AttendanceRecord[]; updated: AttendanceRecord } {
  const tz = getUserTimeZone();
  const dateIso = getLocalDateIso(now, tz);
  const checkOutHm = formatLocalTimeHm(now, tz);
  const timestamp = `${checkOutHm} · ${formatDdMmYyyy(now, tz)}`;
  const existing = records.find((r) => r.employeeId === user.id && r.dateIso === dateIso);
  const checkIn = existing?.checkIn ?? checkOutHm;
  const workedHours = computeWorkedHours(checkIn, checkOutHm);
  const status = deriveAttendanceStatus(checkIn, checkOutHm);

  const updated: AttendanceRecord = {
    id: existing?.id ?? `att-${user.id}-${dateIso}`,
    employeeId: user.id,
    employeeCode: resolveEmployeeCode(user, userIndex),
    employeeName: user.name,
    employeeEmail: user.email,
    departmentId: user.departmentId,
    departmentName: resolveDepartmentName(user.departmentId, departments),
    dateIso,
    checkIn,
    checkOut: checkOutHm,
    workedHours,
    status,
    note: existing?.note ?? '',
    logs: [
      ...(existing?.logs ?? []),
      {
        id: `log-out-${Date.now()}`,
        time: timestamp,
        action: 'Chấm công ra ca',
        actor: user.name,
      },
    ],
  };

  const exists = records.some((r) => r.employeeId === user.id && r.dateIso === dateIso);
  const nextRecords = exists
    ? records.map((r) => (r.employeeId === user.id && r.dateIso === dateIso ? updated : r))
    : [updated, ...records];
  return { nextRecords, updated };
}

export function computeLeaveBalances(
  users: OrgUser[],
  departments: Department[],
  leaves: LeaveRequest[],
): LeaveBalanceSummary[] {
  return users.map((user, idx) => {
    const userLeaves = leaves.filter((l) => l.employeeId === user.id && l.type === 'Phép năm');
    const usedDays = userLeaves
      .filter((l) => l.status === 'Đã duyệt')
      .reduce((acc, item) => acc + item.days, 0);
    const pendingDays = userLeaves
      .filter((l) => l.status === 'Chờ duyệt')
      .reduce((acc, item) => acc + item.days, 0);
    const entitledDays = DEFAULT_ANNUAL_ENTITLEMENT;
    const remainingDays = Math.max(0, entitledDays - usedDays - pendingDays);

    return {
      employeeId: user.id,
      employeeCode: resolveEmployeeCode(user, idx),
      employeeName: user.name,
      departmentId: user.departmentId,
      departmentName: resolveDepartmentName(user.departmentId, departments),
      entitledDays,
      usedDays,
      pendingDays,
      remainingDays,
    };
  });
}

export function nextLeaveRequestCode(leaves: LeaveRequest[]): string {
  let maxNum = 1000;
  for (const item of leaves) {
    const match = /^NP-(\d+)$/.exec(item.code);
    if (match) {
      const parsed = Number(match[1]);
      if (parsed > maxNum) maxNum = parsed;
    }
  }
  return `NP-${maxNum + 1}`;
}

export function createLeaveRequestEntry(
  existing: LeaveRequest[],
  params: {
    user: OrgUser;
    userIndex: number;
    departments: Department[];
    type: LeaveType;
    fromDate: string;
    toDate: string;
    days: number;
    reason: string;
    approverId: string | null;
    approverName: string;
  },
  now = new Date(),
): LeaveRequest {
  const code = nextLeaveRequestCode(existing);
  return {
    id: `leave-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    code,
    employeeId: params.user.id,
    employeeCode: resolveEmployeeCode(params.user, params.userIndex),
    employeeName: params.user.name,
    employeeEmail: params.user.email,
    departmentId: params.user.departmentId,
    departmentName: resolveDepartmentName(params.user.departmentId, params.departments),
    type: params.type,
    fromDate: params.fromDate,
    toDate: params.toDate,
    days: params.days,
    reason: params.reason.trim(),
    status: 'Chờ duyệt',
    approverId: params.approverId,
    approverName: params.approverName,
    createdAtLabel: formatDateTimeLabel(now),
  };
}
