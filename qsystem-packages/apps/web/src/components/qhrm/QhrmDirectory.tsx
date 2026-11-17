'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  MoreHorizontal,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { StateRegion, toast, useFloatingLayer } from '@qsystem/ui';
import type { MeResponse } from '@qsystem/contracts';
import { apiFetch, cachedApiFetch, invalidateApiCache } from '../../lib/api/client';
import { getCachedEntry } from '../../lib/api/cache';
import { formatRole } from '../../lib/adapters/notifications.adapter';
import { getLocalDateIso } from '../../lib/date';
import { CreateUserModal } from './CreateUserModal';
import { QhrmAttendance } from './QhrmAttendance';
import { QhrmLeave } from './QhrmLeave';
import { QhrmOverview } from './QhrmOverview';
import {
  buildSeedAttendance,
  buildSeedLeaves,
  computeLeaveBalances,
  computeWorkedHours,
  createLeaveRequestEntry,
  ensureAttendanceSyncedWithUsers,
  enumerateIsoDates,
  formatDateTimeLabel,
  formatWorkedHours,
  loadStoredAttendance,
  loadStoredLeaves,
  recordCheckIn,
  recordCheckOut,
  resolveEmployeeCode,
  saveStoredAttendance,
  saveStoredLeaves,
  syncApprovedLeavesToAttendance,
} from './qhrm.storage';
import type {
  AttendanceRecord,
  AttendanceStatus,
  AvatarTone,
  Department,
  DirectoryRow,
  EmploymentStatus,
  LeaveRequest,
  LeaveType,
  OrgUser,
} from './qhrm.types';
import './qhrm.css';

const PAGE_SIZE = 6;
const SAMPLE_TOTAL_USERS = 128;
const SAMPLE_ACTIVE_USERS = 121;
const SAMPLE_LEAVE_USERS = 7;

const ORG_USERS_KEY = 'qsystem:org:users:v1';
const ORG_DEPTS_KEY = 'qsystem:org:depts:v1';
const ORG_META_KEY = 'qsystem:org:meta:v1';

interface OrgMetaCache {
  extraCreatedCount: number;
  sampleActiveDelta: number;
  sampleLeaveDelta: number;
  extraDeptCounts: Record<string, number>;
}

const DEFAULT_META_CACHE: OrgMetaCache = {
  extraCreatedCount: 0,
  sampleActiveDelta: 0,
  sampleLeaveDelta: 0,
  extraDeptCounts: {},
};

function canUseOrgLocalFallback(): boolean {
  return (
    process.env.NODE_ENV === 'development' ||
    (process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && process.env.NODE_ENV !== 'test')
  );
}

function readJsonStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function persistOrgLocalState(
  departments: Department[] | null,
  users: OrgUser[] | null,
  meta: OrgMetaCache,
) {
  if (!canUseOrgLocalFallback() || typeof window === 'undefined') return;
  try {
    if (departments) window.localStorage.setItem(ORG_DEPTS_KEY, JSON.stringify(departments));
    if (users) window.localStorage.setItem(ORG_USERS_KEY, JSON.stringify(users));
    window.localStorage.setItem(ORG_META_KEY, JSON.stringify(meta));
  } catch {
    // Ignore storage quota errors
  }
}

function useSafeRouter() {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

function useSafePathname(): string | null {
  try {
    return usePathname();
  } catch {
    return null;
  }
}

function useSafeSearchParams() {
  try {
    return useSearchParams();
  } catch {
    return null;
  }
}

const SAMPLE_DEPARTMENTS: Department[] = [
  { id: 'd-bgd', name: 'Ban Giám đốc', sampleCount: 5 },
  { id: 'd-hr', name: 'Nhân sự', sampleCount: 16 },
  { id: 'd-sales', name: 'Kinh doanh', sampleCount: 32 },
  { id: 'd-tech', name: 'Công nghệ', sampleCount: 28 },
  { id: 'd-fin', name: 'Tài chính', sampleCount: 19 },
  { id: 'd-ops', name: 'Vận hành', sampleCount: 15 },
  { id: 'd-mkt', name: 'Marketing', sampleCount: 13 },
];

const SAMPLE_USERS: OrgUser[] = [
  {
    id: 'u-1',
    name: 'Minh Khôi',
    email: 'minh.khoi@qsystem.vn',
    role: 'DIRECTOR',
    jobTitle: 'Giám đốc điều hành',
    departmentId: 'd-bgd',
    reportsToId: null,
    statusLabel: 'Đang làm',
    avatarTone: 'plum',
  },
  {
    id: 'u-2',
    name: 'Lan Anh',
    email: 'lan.anh@qsystem.vn',
    role: 'MANAGER',
    jobTitle: 'Trưởng phòng nhân sự',
    departmentId: 'd-hr',
    reportsToId: 'u-1',
    statusLabel: 'Đang làm',
    avatarTone: 'indigo',
  },
  {
    id: 'u-3',
    name: 'Đức Anh',
    email: 'duc.anh@qsystem.vn',
    role: 'EMPLOYEE',
    jobTitle: 'Chuyên viên nhân sự',
    departmentId: 'd-hr',
    reportsToId: 'u-2',
    statusLabel: 'Đang làm',
    avatarTone: 'plum',
  },
  {
    id: 'u-4',
    name: 'Hà My',
    email: 'ha.my@qsystem.vn',
    role: 'MANAGER',
    jobTitle: 'Trưởng phòng kinh doanh',
    departmentId: 'd-sales',
    reportsToId: 'u-1',
    statusLabel: 'Đang làm',
    avatarTone: 'slate',
  },
  {
    id: 'u-5',
    name: 'Bảo Trâm',
    email: 'bao.tram@qsystem.vn',
    role: 'EMPLOYEE',
    jobTitle: 'Chuyên viên kinh doanh',
    departmentId: 'd-sales',
    reportsToId: 'u-4',
    statusLabel: 'Đang làm',
    avatarTone: 'teal',
  },
  {
    id: 'u-6',
    name: 'Quốc Huy',
    email: 'quoc.huy@qsystem.vn',
    role: 'MANAGER',
    jobTitle: 'Trưởng nhóm công nghệ',
    departmentId: 'd-tech',
    reportsToId: 'u-1',
    statusLabel: 'Đang làm',
    avatarTone: 'cyan',
  },
  // Additional rows for page 2+ and per-department views
  {
    id: 'u-7',
    name: 'Thu Thảo',
    email: 'thu.thao@qsystem.vn',
    role: 'MANAGER',
    jobTitle: 'Trưởng phòng tài chính',
    departmentId: 'd-fin',
    reportsToId: 'u-1',
    statusLabel: 'Đang làm',
    avatarTone: 'indigo',
  },
  {
    id: 'u-8',
    name: 'Hoàng Nam',
    email: 'hoang.nam@qsystem.vn',
    role: 'EMPLOYEE',
    jobTitle: 'Kế toán tổng hợp',
    departmentId: 'd-fin',
    reportsToId: 'u-7',
    statusLabel: 'Đang làm',
    avatarTone: 'slate',
  },
  {
    id: 'u-9',
    name: 'Gia Bảo',
    email: 'gia.bao@qsystem.vn',
    role: 'MANAGER',
    jobTitle: 'Trưởng phòng vận hành',
    departmentId: 'd-ops',
    reportsToId: 'u-1',
    statusLabel: 'Đang làm',
    avatarTone: 'teal',
  },
  {
    id: 'u-10',
    name: 'Ngọc Diệp',
    email: 'ngoc.diep@qsystem.vn',
    role: 'EMPLOYEE',
    jobTitle: 'Điều phối vận hành',
    departmentId: 'd-ops',
    reportsToId: 'u-9',
    statusLabel: 'Nghỉ phép',
    avatarTone: 'plum',
  },
  {
    id: 'u-11',
    name: 'Thanh Tùng',
    email: 'thanh.tung@qsystem.vn',
    role: 'MANAGER',
    jobTitle: 'Trưởng phòng Marketing',
    departmentId: 'd-mkt',
    reportsToId: 'u-1',
    statusLabel: 'Đang làm',
    avatarTone: 'cyan',
  },
  {
    id: 'u-12',
    name: 'Phương Linh',
    email: 'phuong.linh@qsystem.vn',
    role: 'EMPLOYEE',
    jobTitle: 'Chuyên viên nội dung',
    departmentId: 'd-mkt',
    reportsToId: 'u-11',
    statusLabel: 'Đang làm',
    avatarTone: 'indigo',
  },
  {
    id: 'u-13',
    name: 'Tuấn Kiệt',
    email: 'tuan.kiet@qsystem.vn',
    role: 'EMPLOYEE',
    jobTitle: 'Kỹ sư hệ thống',
    departmentId: 'd-tech',
    reportsToId: 'u-6',
    statusLabel: 'Đang làm',
    avatarTone: 'teal',
  },
  {
    id: 'u-14',
    name: 'Khánh Vy',
    email: 'khanh.vy@qsystem.vn',
    role: 'EMPLOYEE',
    jobTitle: 'Kỹ sư giao diện',
    departmentId: 'd-tech',
    reportsToId: 'u-6',
    statusLabel: 'Đang làm',
    avatarTone: 'plum',
  },
  {
    id: 'u-15',
    name: 'Hải Đăng',
    email: 'hai.dang@qsystem.vn',
    role: 'DIRECTOR',
    jobTitle: 'Phó giám đốc vận hành',
    departmentId: 'd-bgd',
    reportsToId: 'u-1',
    statusLabel: 'Đang làm',
    avatarTone: 'slate',
  },
  {
    id: 'u-16',
    name: 'Thùy Linh',
    email: 'thuy.linh@qsystem.vn',
    role: 'EMPLOYEE',
    jobTitle: 'Chuyên viên tuyển dụng',
    departmentId: 'd-hr',
    reportsToId: 'u-2',
    statusLabel: 'Nghỉ phép',
    avatarTone: 'teal',
  },
  {
    id: 'u-17',
    name: 'Văn Long',
    email: 'van.long@qsystem.vn',
    role: 'EMPLOYEE',
    jobTitle: 'Chuyên viên kinh doanh',
    departmentId: 'd-sales',
    reportsToId: 'u-4',
    statusLabel: 'Nghỉ phép',
    avatarTone: 'indigo',
  },
];

const SYN_LAST = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Phan'];
const SYN_MID = ['Quang', 'Minh', 'Ngọc', 'Thùy', 'Anh', 'Gia', 'Thanh', 'Khánh', 'Hữu', 'Phương'];
const SYN_FIRST = ['Vinh', 'Hà', 'Dũng', 'Trang', 'Khoa', 'Nhi', 'Sơn', 'Châu', 'Bình', 'Tâm', 'Hưng'];
const SYN_TITLES = [
  'Chuyên viên nghiệp vụ',
  'Kỹ sư phần mềm',
  'Chuyên viên phân tích',
  'Nhân viên điều phối',
  'Chuyên viên khách hàng',
];

function buildSyntheticSampleRow(
  slotIndex: number,
  departments: Department[],
  selectedDeptId: string | null,
  allUsers: OrgUser[],
): DirectoryRow {
  const last = SYN_LAST[slotIndex % SYN_LAST.length];
  const mid = SYN_MID[Math.floor(slotIndex / SYN_LAST.length) % SYN_MID.length];
  const first = SYN_FIRST[(slotIndex * 3 + Math.floor(slotIndex / 7)) % SYN_FIRST.length];
  const codeNum = slotIndex + 1;
  const fullName = `${last} ${mid} ${first} #${codeNum}`;
  const targetDept = selectedDeptId
    ? (departments.find((d) => d.id === selectedDeptId) ?? departments[0])
    : departments[(slotIndex + 1) % Math.max(1, departments.length)];
  const deptName = targetDept?.name ?? 'Toàn công ty';
  const deptManager = allUsers.find(
    (u) => u.departmentId === targetDept?.id && (u.role === 'MANAGER' || u.role === 'DIRECTOR'),
  );
  const avatarTone = TONE_CYCLE[slotIndex % TONE_CYCLE.length];
  const jobTitle = SYN_TITLES[slotIndex % SYN_TITLES.length];
  const syntheticUser: OrgUser = {
    id: `u-syn-${codeNum}`,
    name: fullName,
    email: `nhansu.${codeNum}@qsystem.vn`,
    role: 'EMPLOYEE',
    jobTitle,
    departmentId: targetDept?.id ?? null,
    reportsToId: deptManager?.id ?? 'u-1',
    statusLabel: 'Đang làm',
    avatarTone,
  };
  return {
    user: syntheticUser,
    employeeCode: `NV-${String(codeNum + 200).padStart(4, '0')}`,
    initials: initialsOf(`${mid} ${first}`),
    avatarTone,
    jobTitle,
    departmentName: deptName,
    managerName: deptManager?.name ?? 'Minh Khôi',
    statusLabel: 'Đang làm',
  };
}

type OrgMuc = 'tong-quan' | 'phong-ban' | 'cham-cong' | 'nghi-phep';

const MUC_META: Record<
  OrgMuc,
  { heading: string; sub: string; cardPrefix: string; badge: string }
> = {
  'tong-quan': {
    heading: 'Tổng quan nhân sự',
    sub: 'Chỉ số nguồn nhân lực và cơ cấu toàn công ty',
    cardPrefix: 'Tổng quan',
    badge: 'Tổng quan QHRM',
  },
  'phong-ban': {
    heading: 'Phòng ban',
    sub: 'Cơ cấu đơn vị và phân bổ nhân sự theo từng phòng ban',
    cardPrefix: 'Phòng ban',
    badge: 'Cơ cấu đơn vị',
  },
  'cham-cong': {
    heading: 'Chấm công',
    sub: 'Tình trạng hiện diện và làm việc trong ngày hôm nay',
    cardPrefix: 'Hiện diện hôm nay',
    badge: 'Đang làm việc',
  },
  'nghi-phep': {
    heading: 'Nghỉ phép',
    sub: 'Danh sách nhân sự đang nghỉ phép trong ngày',
    cardPrefix: 'Nghỉ phép',
    badge: 'Đang nghỉ phép',
  },
};

const TONE_CYCLE: AvatarTone[] = ['plum', 'indigo', 'slate', 'teal', 'cyan'];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'QS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function toneForIndex(user: OrgUser, index: number): AvatarTone {
  return user.avatarTone ?? TONE_CYCLE[index % TONE_CYCLE.length];
}

function csvEscape(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function EmployeeDetailDialog({
  row,
  canManage,
  onClose,
  onToggleStatus,
  onCopyEmail,
}: {
  row: DirectoryRow;
  canManage: boolean;
  onClose: () => void;
  onToggleStatus: (userId: string) => void;
  onCopyEmail: (email: string) => void;
}) {
  const modalRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  useFloatingLayer(true, onClose, true, { root: modalRef });

  const dialog = (
    <div
      className="hr-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="hr-modal hr-modal--detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="hr-modal__head">
          <h2 id={titleId}>Hồ sơ nhân sự</h2>
          <p>Thông tin chi tiết và trạng thái làm việc hiện tại</p>
          <button
            type="button"
            className="hr-modal__close"
            aria-label="Đóng hồ sơ nhân sự"
            onClick={onClose}
          >
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        <div className="hr-detail-body">
          <div className="hr-detail-hero">
            <span className="qx-avatar hr-avatar" aria-hidden="true">
              {row.initials}
            </span>
            <div className="hr-detail-hero__meta">
              <p className="hr-detail-hero__name">{row.user.name}</p>
              <p className="hr-detail-hero__mail">{row.user.email}</p>
            </div>
          </div>

          <dl className="hr-detail-grid">
            <div className="hr-detail-item">
              <dt>Chức danh</dt>
              <dd>{row.jobTitle}</dd>
            </div>
            <div className="hr-detail-item">
              <dt>Phòng ban</dt>
              <dd>{row.departmentName}</dd>
            </div>
            <div className="hr-detail-item">
              <dt>Quản lý trực tiếp</dt>
              <dd>{row.managerName}</dd>
            </div>
            <div className="hr-detail-item">
              <dt>Vai trò truy cập</dt>
              <dd>{formatRole(row.user.role)}</dd>
            </div>
            <div className="hr-detail-item">
              <dt>Trạng thái</dt>
              <dd>
                <span
                  className={`qx-badge ${
                    row.statusLabel === 'Đang làm'
                      ? 'qx-badge--green'
                      : row.statusLabel === 'Nghỉ phép'
                        ? 'qx-badge--amber'
                        : 'hr-badge--muted'
                  }`}
                >
                  {row.statusLabel}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        <div className="hr-modal__foot">
          <button type="button" className="qx-btn" onClick={() => onCopyEmail(row.user.email)}>
            Sao chép email
          </button>
          {canManage ? (
            <button
              type="button"
              className="qx-btn qx-btn--primary"
              onClick={() => onToggleStatus(row.user.id)}
            >
              {row.statusLabel === 'Đang làm' ? 'Chuyển sang Nghỉ phép' : 'Chuyển sang Đang làm'}
            </button>
          ) : (
            <button type="button" className="qx-btn qx-btn--primary" onClick={onClose}>
              Đóng
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(dialog, document.body);
}

export function QhrmDirectory({ me }: { me: MeResponse }) {
  const router = useSafeRouter();
  const pathname = useSafePathname();
  const searchParams = useSafeSearchParams();

  const [departments, setDepartments] = React.useState<Department[] | null>(
    () => getCachedEntry<Department[]>('/api/org/departments') ?? null,
  );
  const [users, setUsers] = React.useState<OrgUser[] | null>(
    () => getCachedEntry<OrgUser[]>('/api/org/users') ?? null,
  );
  const [isSample, setIsSample] = React.useState(() => {
    return !(getCachedEntry<Department[]>('/api/org/departments') && getCachedEntry<OrgUser[]>('/api/org/users'));
  });
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [extraCreatedCount, setExtraCreatedCount] = React.useState(0);
  const [sampleActiveDelta, setSampleActiveDelta] = React.useState(0);
  const [sampleLeaveDelta, setSampleLeaveDelta] = React.useState(0);
  const [extraDeptCounts, setExtraDeptCounts] = React.useState<Record<string, number>>({});

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [creating, setCreating] = React.useState(false);
  const [openRowMenuId, setOpenRowMenuId] = React.useState<string | null>(null);
  const [rowMenuPos, setRowMenuPos] = React.useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const [deptMenuOpen, setDeptMenuOpen] = React.useState(false);
  const [sortDeptDesc, setSortDeptDesc] = React.useState(false);
  const [addingDept, setAddingDept] = React.useState(false);
  const [newDeptName, setNewDeptName] = React.useState('');
  const [detailUserId, setDetailUserId] = React.useState<string | null>(null);
  const [leavesState, setLeavesState] = React.useState<LeaveRequest[] | null>(null);
  const [attendanceState, setAttendanceState] = React.useState<AttendanceRecord[] | null>(null);

  const canManage = me.role === 'DIRECTOR' || me.role === 'MANAGER';
  const menuContainerRef = React.useRef<HTMLDivElement>(null);
  const rowMenuRef = React.useRef<HTMLDivElement>(null);
  const newDeptInputRef = React.useRef<HTMLInputElement>(null);

  const rawMuc = searchParams?.get('muc');
  const activeMuc: OrgMuc | null =
    rawMuc === 'tong-quan' ||
    rawMuc === 'phong-ban' ||
    rawMuc === 'cham-cong' ||
    rawMuc === 'nghi-phep'
      ? rawMuc
      : null;

  React.useEffect(() => {
    setPage(1);
  }, [activeMuc]);

  React.useEffect(() => {
    if (addingDept) {
      newDeptInputRef.current?.focus();
    }
  }, [addingDept]);

  const hydrateDevFallback = React.useCallback(() => {
    const storedDepts = readJsonStorage<Department[] | null>(ORG_DEPTS_KEY, null);
    const storedUsers = readJsonStorage<OrgUser[] | null>(ORG_USERS_KEY, null);
    const storedMeta = readJsonStorage<OrgMetaCache | null>(ORG_META_KEY, null);
    const nextDepts = Array.isArray(storedDepts) && storedDepts.length > 0 ? storedDepts : SAMPLE_DEPARTMENTS;
    const nextUsers = Array.isArray(storedUsers) && storedUsers.length > 0 ? storedUsers : SAMPLE_USERS;
    const nextMeta = storedMeta ?? DEFAULT_META_CACHE;
    setDepartments(nextDepts);
    setUsers(nextUsers);
    setExtraCreatedCount(nextMeta.extraCreatedCount ?? 0);
    setSampleActiveDelta(nextMeta.sampleActiveDelta ?? 0);
    setSampleLeaveDelta(nextMeta.sampleLeaveDelta ?? 0);
    setExtraDeptCounts(nextMeta.extraDeptCounts ?? {});
    setIsSample(true);
    setLoadError(null);
    persistOrgLocalState(nextDepts, nextUsers, nextMeta);
  }, []);

  const loadDirectory = React.useCallback(() => {
    let active = true;
    const allowLocal = canUseOrgLocalFallback();
    setLoadError(null);
    Promise.all([
      cachedApiFetch<Department[]>('/api/org/departments'),
      cachedApiFetch<OrgUser[]>('/api/org/users'),
    ]).then(
      ([departmentList, userList]) => {
        if (!active) return;
        if (allowLocal && (departmentList.length === 0 || userList.length === 0)) {
          hydrateDevFallback();
          return;
        }
        setDepartments(departmentList);
        setUsers(userList);
        setIsSample(false);
        setLoadError(null);
      },
      () => {
        if (!active) return;
        if (allowLocal) {
          hydrateDevFallback();
          return;
        }
        setDepartments([]);
        setUsers([]);
        setIsSample(false);
        setLoadError('Hệ thống đang gặp sự cố, không thể tải danh bạ nhân sự. Vui lòng thử lại.');
      },
    );
    return () => {
      active = false;
    };
  }, [hydrateDevFallback]);

  React.useEffect(() => {
    return loadDirectory();
  }, [loadDirectory]);

  const usersForStore = React.useMemo<OrgUser[]>(() => {
    if (!users || users.length === 0) return [];
    if (users.some((u) => u.id === me.id)) return users;
    return [
      ...users,
      {
        id: me.id,
        email: me.email,
        name: me.name,
        role: me.role,
        departmentId: me.departmentId,
        reportsToId: null,
      },
    ];
  }, [users, me.id, me.email, me.name, me.role, me.departmentId]);

  React.useEffect(() => {
    if (!departments || usersForStore.length === 0) return;
    const storedLeaves = loadStoredLeaves();
    const nextLeaves =
      storedLeaves && storedLeaves.length > 0
        ? storedLeaves
        : buildSeedLeaves(usersForStore, departments, me.id, isSample);
    if (!storedLeaves) {
      saveStoredLeaves(nextLeaves);
    }

    const storedAttendance = loadStoredAttendance();
    const baseAttendance =
      storedAttendance && storedAttendance.length > 0
        ? storedAttendance
        : buildSeedAttendance(usersForStore, departments, nextLeaves, me.id);
    const syncedAttendance = ensureAttendanceSyncedWithUsers(
      baseAttendance,
      usersForStore,
      departments,
      nextLeaves,
    );
    if (!storedAttendance || syncedAttendance.length !== storedAttendance.length) {
      saveStoredAttendance(syncedAttendance);
    }

    setLeavesState(nextLeaves);
    setAttendanceState(syncedAttendance);
  }, [departments, usersForStore, me.id, isSample]);

  // Open CreateUserModal automatically when navigated via ?them-nhan-su=1
  const openParam = searchParams?.get('them-nhan-su') === '1';
  React.useEffect(() => {
    if (openParam && canManage) {
      setCreating(true);
    }
  }, [openParam, canManage]);

  // Close row/dept action menus on outside click, Escape, or scroll/resize
  React.useEffect(() => {
    if (!openRowMenuId && !deptMenuOpen) return;
    function onDocClick(event: MouseEvent) {
      const target = event.target as Node | null;
      if (
        !menuContainerRef.current?.contains(target) &&
        !rowMenuRef.current?.contains(target)
      ) {
        setOpenRowMenuId(null);
        setDeptMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenRowMenuId(null);
        setDeptMenuOpen(false);
      }
    }
    function onScrollOrResize() {
      setOpenRowMenuId(null);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [openRowMenuId, deptMenuOpen]);

  function handleModalOpenChange(nextOpen: boolean) {
    setCreating(nextOpen);
    if (!nextOpen && openParam && pathname && router) {
      const nextParams = new URLSearchParams(searchParams?.toString() ?? '');
      nextParams.delete('them-nhan-su');
      const qs = nextParams.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }

  if (loadError) {
    return (
      <section className="qx-page" aria-label="Danh bạ nhân sự">
        <div role="alert" className="hr-alert">
          <span>{loadError}</span>
          <button type="button" className="qx-btn qx-btn--sm" onClick={() => loadDirectory()}>
            Thử lại
          </button>
        </div>
      </section>
    );
  }

  if (departments === null || users === null) {
    return (
      <section className="qx-page" aria-label="Danh bạ nhân sự">
        <StateRegion state="loading" rows={6} />
      </section>
    );
  }

  const deptById = new Map(departments.map((d) => [d.id, d]));
  const userById = new Map(users.map((u) => [u.id, u]));

  const allRows: DirectoryRow[] = users.map((user, index) => {
    const deptName = user.departmentId
      ? (deptById.get(user.departmentId)?.name ?? 'Toàn công ty')
      : 'Toàn công ty';
    const mgrName =
      user.reportsToName ??
      (user.reportsToId ? (userById.get(user.reportsToId)?.name ?? '—') : '—');
    const resolvedTitle = user.jobTitle?.trim() || (isSample ? formatRole(user.role) : 'Chưa có dữ liệu');
    const resolvedStatus: EmploymentStatus = user.statusLabel ?? (isSample ? 'Đang làm' : 'Chưa có dữ liệu');
    return {
      user,
      employeeCode: resolveEmployeeCode(user, index),
      initials: initialsOf(user.name),
      avatarTone: toneForIndex(user, index),
      jobTitle: resolvedTitle,
      departmentName: deptName,
      managerName: mgrName,
      statusLabel: resolvedStatus,
    };
  });

  const normalizedQuery = search.trim().toLowerCase();
  const filteredRows = allRows.filter((row) => {
    if (selectedId !== null && row.user.departmentId !== selectedId) return false;
    if (activeMuc === 'nghi-phep' && row.statusLabel !== 'Nghỉ phép') return false;
    if (activeMuc === 'cham-cong' && row.statusLabel !== 'Đang làm') return false;
    if (!normalizedQuery) return true;
    return (
      row.user.name.toLowerCase().includes(normalizedQuery) ||
      row.user.email.toLowerCase().includes(normalizedQuery) ||
      row.jobTitle.toLowerCase().includes(normalizedQuery) ||
      row.departmentName.toLowerCase().includes(normalizedQuery) ||
      row.managerName.toLowerCase().includes(normalizedQuery)
    );
  });

  const selectedDept = selectedId ? deptById.get(selectedId) : undefined;
  const selectedName = selectedId === null ? 'Toàn công ty' : (selectedDept?.name ?? 'Toàn công ty');

  const departmentCountFor = (dept: Department): number => {
    if (isSample && typeof dept.sampleCount === 'number') {
      return Math.max(0, dept.sampleCount + (extraDeptCounts[dept.id] ?? 0));
    }
    return users.filter((u) => u.departmentId === dept.id).length;
  };

  const orderedDepartments = sortDeptDesc
    ? [...departments].sort((a, b) => departmentCountFor(b) - departmentCountFor(a))
    : departments;

  const totalStaffStat = isSample ? Math.max(0, SAMPLE_TOTAL_USERS + extraCreatedCount) : users.length;
  const totalDeptStat = departments.length + (isSample ? 1 : 0);
  const activeStaffStat = isSample
    ? Math.max(0, SAMPLE_ACTIVE_USERS + sampleActiveDelta)
    : users.filter((u) => u.statusLabel === 'Đang làm').length;
  const leaveCountNum = isSample
    ? Math.max(0, SAMPLE_LEAVE_USERS + sampleLeaveDelta)
    : users.filter((u) => u.statusLabel === 'Nghỉ phép').length;
  const leaveStaffStat = leaveCountNum;
  const activePctLabel =
    totalStaffStat > 0
      ? `${((activeStaffStat / totalStaffStat) * 100).toFixed(1).replace('.', ',')}% tổng nhân sự`
      : '0% tổng nhân sự';

  const footerTotalCount = (() => {
    if (normalizedQuery || activeMuc === 'nghi-phep' || activeMuc === 'cham-cong') {
      return filteredRows.length;
    }
    if (isSample) {
      if (selectedId === null) return totalStaffStat;
      return selectedDept ? departmentCountFor(selectedDept) : filteredRows.length;
    }
    return filteredRows.length;
  })();

  const totalPages = Math.max(1, Math.ceil(footerTotalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  // Slice visible rows; for sample pages beyond concrete rows, generate distinct deterministic employees.
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageRows: DirectoryRow[] = (() => {
    if (startIdx < filteredRows.length) {
      const concrete = filteredRows.slice(startIdx, startIdx + PAGE_SIZE);
      if (
        isSample &&
        concrete.length < PAGE_SIZE &&
        !normalizedQuery &&
        activeMuc !== 'nghi-phep' &&
        activeMuc !== 'cham-cong' &&
        startIdx + concrete.length < footerTotalCount
      ) {
        const needed = Math.min(PAGE_SIZE - concrete.length, footerTotalCount - (startIdx + concrete.length));
        const extra = Array.from({ length: needed }, (_, i) =>
          buildSyntheticSampleRow(startIdx + concrete.length + i, departments, selectedId, users),
        );
        return [...concrete, ...extra];
      }
      return concrete;
    }
    if (
      isSample &&
      !normalizedQuery &&
      activeMuc !== 'nghi-phep' &&
      activeMuc !== 'cham-cong' &&
      startIdx < footerTotalCount
    ) {
      const needed = Math.min(PAGE_SIZE, footerTotalCount - startIdx);
      return Array.from({ length: needed }, (_, i) =>
        buildSyntheticSampleRow(startIdx + i, departments, selectedId, users),
      );
    }
    return [];
  })();

  function selectDepartment(nextId: string | null) {
    setSelectedId(nextId);
    setPage(1);
    setOpenRowMenuId(null);
    setDeptMenuOpen(false);
  }

  function handleClearMuc() {
    if (!pathname || !router) return;
    const nextParams = new URLSearchParams(searchParams?.toString() ?? '');
    nextParams.delete('muc');
    const qs = nextParams.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  async function handleAddDepartment(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = newDeptName.trim();
    if (!trimmed) return;
    const exists = departments?.some((d) => d.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      toast.info(`Phòng ban ${trimmed} đã tồn tại.`);
      return;
    }
    const meta: OrgMetaCache = {
      extraCreatedCount,
      sampleActiveDelta,
      sampleLeaveDelta,
      extraDeptCounts,
    };
    if (!isSample) {
      try {
        const created = await apiFetch<Department>('/api/org/departments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        });
        const nextDepts = [...(departments ?? []), created];
        setDepartments(nextDepts);
        setNewDeptName('');
        setAddingDept(false);
        toast.success(`Đã thêm phòng ban ${trimmed}`);
        return;
      } catch {
        if (!canUseOrgLocalFallback()) {
          toast.error('Không thêm được phòng ban mới, vui lòng thử lại.');
          return;
        }
      }
    }
    const createdDept: Department = {
      id: `d-local-${Date.now()}`,
      name: trimmed,
      sampleCount: 0,
    };
    const nextDepts = [...(departments ?? []), createdDept];
    invalidateApiCache('/api/org/departments');
    setDepartments(nextDepts);
    persistOrgLocalState(nextDepts, users, meta);
    setNewDeptName('');
    setAddingDept(false);
    toast.success(`Đã thêm phòng ban ${trimmed}`);
  }

  function handleToggleStatus(userId: string) {
    const target = users?.find((u) => u.id === userId);
    if (!target) return;
    const currentStatus = target.statusLabel ?? 'Đang làm';
    const nextStatus: 'Đang làm' | 'Nghỉ phép' =
      currentStatus === 'Đang làm' ? 'Nghỉ phép' : 'Đang làm';

    const nextUsers = (users ?? []).map((u) =>
      u.id === userId ? { ...u, statusLabel: nextStatus } : u,
    );
    const nextActiveDelta = isSample
      ? sampleActiveDelta + (nextStatus === 'Nghỉ phép' ? -1 : 1)
      : sampleActiveDelta;
    const nextLeaveDelta = isSample
      ? sampleLeaveDelta + (nextStatus === 'Nghỉ phép' ? 1 : -1)
      : sampleLeaveDelta;

    setUsers(nextUsers);
    setSampleActiveDelta(nextActiveDelta);
    setSampleLeaveDelta(nextLeaveDelta);
    persistOrgLocalState(departments, nextUsers, {
      extraCreatedCount,
      sampleActiveDelta: nextActiveDelta,
      sampleLeaveDelta: nextLeaveDelta,
      extraDeptCounts,
    });
    setOpenRowMenuId(null);
    toast.success(`${target.name} đã chuyển sang ${nextStatus}`);
  }

  function handleDeleteUser(userId: string) {
    const target = users?.find((u) => u.id === userId);
    if (!target) return;
    const currentStatus = target.statusLabel ?? 'Đang làm';

    const nextUsers = (users ?? []).filter((u) => u.id !== userId);
    const nextExtraCount = isSample ? extraCreatedCount - 1 : extraCreatedCount;
    const nextLeaveDelta =
      isSample && currentStatus === 'Nghỉ phép' ? sampleLeaveDelta - 1 : sampleLeaveDelta;
    const nextActiveDelta =
      isSample && currentStatus !== 'Nghỉ phép' ? sampleActiveDelta - 1 : sampleActiveDelta;
    const nextDeptCounts =
      isSample && target.departmentId
        ? {
            ...extraDeptCounts,
            [target.departmentId]: (extraDeptCounts[target.departmentId] ?? 0) - 1,
          }
        : extraDeptCounts;

    setUsers(nextUsers);
    setExtraCreatedCount(nextExtraCount);
    setSampleLeaveDelta(nextLeaveDelta);
    setSampleActiveDelta(nextActiveDelta);
    setExtraDeptCounts(nextDeptCounts);
    persistOrgLocalState(departments, nextUsers, {
      extraCreatedCount: nextExtraCount,
      sampleActiveDelta: nextActiveDelta,
      sampleLeaveDelta: nextLeaveDelta,
      extraDeptCounts: nextDeptCounts,
    });
    setOpenRowMenuId(null);
    if (detailUserId === userId) setDetailUserId(null);
    toast.success(`Đã xóa ${target.name} khỏi danh sách`);
  }

  function handleExportCsv() {
    const header = ['Họ tên', 'Email', 'Chức danh', 'Phòng ban', 'Quản lý', 'Trạng thái'];
    const lines = [
      header.map(csvEscape).join(','),
      ...filteredRows.map((r) =>
        [r.user.name, r.user.email, r.jobTitle, r.departmentName, r.managerName, r.statusLabel]
          .map(csvEscape)
          .join(','),
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'danh-ba-nhan-su.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('Đã xuất danh sách nhân sự.');
  }

  function handleCopyEmail(email: string) {
    setOpenRowMenuId(null);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(email).then(
        () => toast.success(`Đã sao chép ${email}`),
        () => toast.info(email),
      );
      return;
    }
    toast.info(email);
  }

  const managerOptions = users.map((u) => ({ id: u.id, name: u.name }));
  const resolvedLeaves: LeaveRequest[] =
    leavesState ??
    (loadStoredLeaves() ?? buildSeedLeaves(usersForStore, departments, me.id, isSample));
  const resolvedAttendance: AttendanceRecord[] =
    attendanceState ??
    ensureAttendanceSyncedWithUsers(
      loadStoredAttendance() ??
        buildSeedAttendance(usersForStore, departments, resolvedLeaves, me.id),
      usersForStore,
      departments,
      resolvedLeaves,
    );
  const leaveBalances = computeLeaveBalances(usersForStore, departments, resolvedLeaves);

  const currentMeIndex = Math.max(
    0,
    usersForStore.findIndex((u) => u.id === me.id),
  );
  const currentMeUser: OrgUser = usersForStore[currentMeIndex] ?? {
    id: me.id,
    email: me.email,
    name: me.name,
    role: me.role,
    departmentId: me.departmentId,
    reportsToId: null,
  };

  function handleCheckIn() {
    const { nextRecords, updated } = recordCheckIn(
      resolvedAttendance,
      currentMeUser,
      currentMeIndex,
      departments ?? [],
    );
    setAttendanceState(nextRecords);
    saveStoredAttendance(nextRecords);
    toast.success(`Đã chấm công vào ca lúc ${updated.checkIn}`);
  }

  function handleCheckOut() {
    const { nextRecords, updated } = recordCheckOut(
      resolvedAttendance,
      currentMeUser,
      currentMeIndex,
      departments ?? [],
    );
    setAttendanceState(nextRecords);
    saveStoredAttendance(nextRecords);
    toast.success(
      `Đã chấm công ra ca lúc ${updated.checkOut} · Tổng ${formatWorkedHours(updated.workedHours)}`,
    );
  }

  function handleUpdateAttendanceRecord(
    recordId: string,
    patch: {
      checkIn: string | null;
      checkOut: string | null;
      status: AttendanceStatus;
      note: string;
    },
  ) {
    const nextRecords = resolvedAttendance.map((rec) => {
      if (rec.id !== recordId) return rec;
      const workedHours = computeWorkedHours(patch.checkIn, patch.checkOut);
      return {
        ...rec,
        checkIn: patch.checkIn,
        checkOut: patch.checkOut,
        workedHours,
        status: patch.status,
        note: patch.note,
        logs: [
          ...rec.logs,
          {
            id: `log-adj-${Date.now()}`,
            time: formatDateTimeLabel(),
            action: canManage ? 'Điều chỉnh chấm công & ghi chú' : 'Cập nhật ghi chú',
            actor: me.name,
          },
        ],
      };
    });
    setAttendanceState(nextRecords);
    saveStoredAttendance(nextRecords);
  }

  function handleCreateLeave(payload: {
    type: LeaveType;
    fromDate: string;
    toDate: string;
    days: number;
    reason: string;
    approverId: string | null;
    approverName: string;
  }) {
    const created = createLeaveRequestEntry(resolvedLeaves, {
      user: currentMeUser,
      userIndex: currentMeIndex,
      departments: departments ?? [],
      ...payload,
    });
    const nextLeaves = [created, ...resolvedLeaves];
    setLeavesState(nextLeaves);
    saveStoredLeaves(nextLeaves);
    toast.success(`Đã gửi đơn nghỉ phép ${created.code}`);
  }

  function handleApproveLeave(leaveId: string, reviewerName: string) {
    const target = resolvedLeaves.find((item) => item.id === leaveId);
    if (!target || target.status !== 'Chờ duyệt') return;
    const reviewedAtLabel = formatDateTimeLabel();
    const nextLeaves = resolvedLeaves.map((item) =>
      item.id === leaveId
        ? {
            ...item,
            status: 'Đã duyệt' as const,
            reviewedByName: reviewerName,
            reviewedAtLabel,
          }
        : item,
    );
    const nextAttendance = syncApprovedLeavesToAttendance(
      nextLeaves,
      resolvedAttendance,
      usersForStore,
      departments ?? [],
    );
    setLeavesState(nextLeaves);
    saveStoredLeaves(nextLeaves);
    setAttendanceState(nextAttendance);
    saveStoredAttendance(nextAttendance);

    const todayIso = getLocalDateIso();
    const coversToday = enumerateIsoDates(target.fromDate, target.toDate).includes(todayIso);
    if (isSample && coversToday && users) {
      const targetUser = users.find((u) => u.id === target.employeeId);
      if (targetUser && targetUser.statusLabel !== 'Nghỉ phép') {
        const nextUsers = users.map((u) =>
          u.id === target.employeeId ? { ...u, statusLabel: 'Nghỉ phép' as const } : u,
        );
        const nextActiveDelta = sampleActiveDelta - 1;
        const nextLeaveDelta = sampleLeaveDelta + 1;
        setUsers(nextUsers);
        setSampleActiveDelta(nextActiveDelta);
        setSampleLeaveDelta(nextLeaveDelta);
        persistOrgLocalState(departments, nextUsers, {
          extraCreatedCount,
          sampleActiveDelta: nextActiveDelta,
          sampleLeaveDelta: nextLeaveDelta,
          extraDeptCounts,
        });
      }
    }

    toast.success(`Đã duyệt đơn ${target.code} và cập nhật bảng chấm công`);
  }

  function handleRejectLeave(leaveId: string, reviewerName: string, reason: string) {
    const target = resolvedLeaves.find((item) => item.id === leaveId);
    if (!target || target.status !== 'Chờ duyệt') return;
    const reviewedAtLabel = formatDateTimeLabel();
    const nextLeaves = resolvedLeaves.map((item) =>
      item.id === leaveId
        ? {
            ...item,
            status: 'Từ chối' as const,
            reviewedByName: reviewerName,
            reviewedAtLabel,
            rejectionReason: reason,
          }
        : item,
    );
    setLeavesState(nextLeaves);
    saveStoredLeaves(nextLeaves);
    toast.info(`Đã từ chối đơn ${target.code}`);
  }

  const createUserModalNode = canManage ? (
    <CreateUserModal
      open={creating}
      onOpenChange={handleModalOpenChange}
      me={me}
      departments={departments}
      managers={managerOptions}
      isSampleMode={isSample}
      onCreated={(created) => {
        const createdUser: OrgUser = {
          ...created,
          statusLabel: isSample ? 'Đang làm' : undefined,
        };
        const nextUsers = [createdUser, ...(users ?? []).filter((entry) => entry.id !== created.id)];
        const nextExtraCount = isSample ? extraCreatedCount + 1 : extraCreatedCount;
        const nextActiveDelta = isSample ? sampleActiveDelta + 1 : sampleActiveDelta;
        const nextDeptCounts =
          isSample && created.departmentId
            ? {
                ...extraDeptCounts,
                [created.departmentId]: (extraDeptCounts[created.departmentId] ?? 0) + 1,
              }
            : extraDeptCounts;

        invalidateApiCache('/api/org/users');
        setUsers(nextUsers);
        setExtraCreatedCount(nextExtraCount);
        setSampleActiveDelta(nextActiveDelta);
        setExtraDeptCounts(nextDeptCounts);
        persistOrgLocalState(departments, nextUsers, {
          extraCreatedCount: nextExtraCount,
          sampleActiveDelta: nextActiveDelta,
          sampleLeaveDelta,
          extraDeptCounts: nextDeptCounts,
        });
        setPage(1);
        toast.success(`Đã thêm nhân sự ${created.name}`);
      }}
    />
  ) : null;

  if (activeMuc === 'cham-cong') {
    return (
      <QhrmAttendance
        me={me}
        users={usersForStore}
        departments={departments}
        records={resolvedAttendance}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
        onUpdateRecord={handleUpdateAttendanceRecord}
      />
    );
  }

  if (activeMuc === 'nghi-phep') {
    return (
      <QhrmLeave
        me={me}
        users={usersForStore}
        leaves={resolvedLeaves}
        balances={leaveBalances}
        isSampleMode={isSample}
        onCreateLeave={handleCreateLeave}
        onApproveLeave={handleApproveLeave}
        onRejectLeave={handleRejectLeave}
      />
    );
  }

  if (activeMuc === 'tong-quan') {
    return (
      <>
        <QhrmOverview
          totalStaffStat={totalStaffStat}
          departments={departments}
          users={users}
          attendance={resolvedAttendance}
          leaves={resolvedLeaves}
          canManage={canManage}
          isSampleMode={isSample}
          extraDeptCounts={extraDeptCounts}
          onCreateUser={() => setCreating(true)}
        />
        {createUserModalNode}
      </>
    );
  }

  const activeMeta = activeMuc ? MUC_META[activeMuc] : null;
  const pageTitle = activeMeta ? activeMeta.heading : 'Danh bạ nhân sự';
  const pageSub = activeMeta
    ? activeMeta.sub
    : 'Thông tin nhân sự và cơ cấu tổ chức trong toàn công ty';
  const cardTitle = activeMeta
    ? `${activeMeta.cardPrefix} · ${selectedName}`
    : `Nhân sự · ${selectedName}`;
  const detailRow = detailUserId ? (allRows.find((r) => r.user.id === detailUserId) ?? null) : null;
  const activeMenuRow = openRowMenuId
    ? (pageRows.find((r) => r.user.id === openRowMenuId) ?? null)
    : null;

  return (
    <section className="qx-page" aria-label={pageTitle} ref={menuContainerRef}>
      <header className="qx-page-head">
        <div>
          <h1>{pageTitle}</h1>
          <p>{pageSub}</p>
        </div>
        <div className="qx-actions">
          <button type="button" className="qx-btn" onClick={handleExportCsv}>
            <Download size={16} strokeWidth={1.5} aria-hidden="true" />
            Xuất danh sách
          </button>
          {canManage ? (
            <button
              type="button"
              className="qx-btn qx-btn--primary"
              onClick={() => setCreating(true)}
            >
              <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
              Thêm nhân sự
            </button>
          ) : null}
        </div>
      </header>

      <div className="qx-stats" aria-label="Thống kê nhân sự">
        <article className="qx-stat">
          <div className="qx-stat__label">Tổng nhân sự</div>
          <div className="qx-stat__value">
            <span className="qs-numeric">{totalStaffStat}</span>
          </div>
          <div className="qx-stat__note qs-numeric">
            Trên {totalDeptStat} phòng ban hoạt động
          </div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Phòng ban</div>
          <div className="qx-stat__value">
            <span className="qs-numeric">{totalDeptStat}</span>
          </div>
          <div className="qx-stat__note">Cơ cấu đang hoạt động</div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Đang làm việc</div>
          <div className="qx-stat__value">
            <span className="qs-numeric">{activeStaffStat}</span>
          </div>
          <div className="qx-stat__note qs-numeric">{activePctLabel}</div>
        </article>

        <article className="qx-stat">
          <div className="qx-stat__label">Đang nghỉ phép</div>
          <div className="qx-stat__value">
            <span className="qs-numeric">{leaveStaffStat}</span>
          </div>
          <div className="qx-stat__note">Trong ngày hôm nay</div>
        </article>
      </div>

      <div className="hr-body">
        <aside className="qx-card hr-depts" aria-label="Phòng ban">
          <div className="hr-depts__head">
            <h2>Phòng ban</h2>
            <button
              type="button"
              className="hr-more"
              aria-label="Tùy chọn phòng ban"
              aria-expanded={deptMenuOpen}
              aria-haspopup="menu"
              onClick={() => {
                setDeptMenuOpen((prev) => !prev);
                setOpenRowMenuId(null);
              }}
            >
              <MoreHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
            {deptMenuOpen ? (
              <div
                className="hr-row-menu hr-row-menu--dept"
                role="menu"
                aria-label="Tùy chọn phòng ban"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="hr-row-menu__item"
                  onClick={() => selectDepartment(null)}
                >
                  Xem toàn công ty
                </button>
                {canManage ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="hr-row-menu__item"
                    onClick={() => {
                      setDeptMenuOpen(false);
                      setAddingDept(true);
                    }}
                  >
                    Thêm phòng ban mới
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  className="hr-row-menu__item"
                  onClick={() => {
                    setSortDeptDesc((prev) => !prev);
                    setDeptMenuOpen(false);
                  }}
                >
                  {sortDeptDesc ? 'Thứ tự mặc định' : 'Sắp xếp theo số lượng'}
                </button>
              </div>
            ) : null}
          </div>

          {addingDept ? (
            <form className="hr-dept-add" onSubmit={handleAddDepartment}>
              <input
                ref={newDeptInputRef}
                type="text"
                className="hr-dept-add__input"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                placeholder="Tên phòng ban mới"
                aria-label="Tên phòng ban mới"
              />
              <div className="hr-dept-add__actions">
                <button
                  type="button"
                  className="qx-btn qx-btn--sm"
                  onClick={() => {
                    setAddingDept(false);
                    setNewDeptName('');
                  }}
                >
                  Hủy
                </button>
                <button type="submit" className="qx-btn qx-btn--sm qx-btn--primary">
                  Thêm
                </button>
              </div>
            </form>
          ) : null}

          <ul className="hr-dept-list">
            <li>
              <button
                type="button"
                className="hr-dept"
                aria-pressed={selectedId === null}
                onClick={() => selectDepartment(null)}
              >
                <span className="hr-dept__name">Toàn công ty</span>
                <span className="hr-dept__count">{totalStaffStat}</span>
              </button>
            </li>
            {orderedDepartments.map((department) => (
              <li key={department.id}>
                <button
                  type="button"
                  className="hr-dept"
                  aria-pressed={selectedId === department.id}
                  onClick={() => selectDepartment(department.id)}
                >
                  <span className="hr-dept__name">{department.name}</span>
                  <span className="hr-dept__count">{departmentCountFor(department)}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="qx-card hr-list">
          <div className="qx-card__head">
            <div className="hr-head-meta">
              <h2 className="qx-card__title">{cardTitle}</h2>
              {activeMeta ? (
                <span className="hr-context-pill">
                  <span>{activeMeta.badge}</span>
                  <button
                    type="button"
                    className="hr-context-reset"
                    onClick={handleClearMuc}
                  >
                    Xem tất cả
                  </button>
                </span>
              ) : null}
            </div>
            <label className="qx-field-search">
              <Search size={16} strokeWidth={1.5} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Tìm nhân sự"
                aria-label="Tìm nhân sự"
              />
            </label>
          </div>

          <div className="hr-table-wrap">
            {pageRows.length === 0 ? (
              <div className="hr-empty">Không tìm thấy nhân sự phù hợp</div>
            ) : (
              <table className="qx-table" aria-label={`Danh sách nhân sự — ${selectedName}`}>
                <thead>
                  <tr>
                    <th scope="col">Nhân sự</th>
                    <th scope="col">Chức danh</th>
                    <th scope="col">Phòng ban</th>
                    <th scope="col">Quản lý</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col" aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr key={row.user.id}>
                      <td>
                        <div className="hr-person">
                          <span className="qx-avatar hr-avatar" aria-hidden="true">
                            {row.initials}
                          </span>
                          <span className="hr-person__text">
                            <span className="hr-person__name">{row.user.name}</span>
                            <span className="hr-person__mail">{row.user.email}</span>
                          </span>
                        </div>
                      </td>
                      <td>{row.jobTitle}</td>
                      <td>{row.departmentName}</td>
                      <td>{row.managerName}</td>
                      <td>
                        <span
                          className={`qx-badge ${
                            row.statusLabel === 'Đang làm'
                              ? 'qx-badge--green'
                              : row.statusLabel === 'Nghỉ phép'
                                ? 'qx-badge--amber'
                                : 'hr-badge--muted'
                          }`}
                        >
                          {row.statusLabel}
                        </span>
                      </td>
                      <td className="hr-row-actions">
                        <button
                          type="button"
                          className="hr-row-more"
                          aria-label={`Thao tác với ${row.user.name}`}
                          aria-expanded={openRowMenuId === row.user.id}
                          aria-haspopup="menu"
                          onClick={(event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            const vh = typeof window !== 'undefined' ? window.innerHeight || 768 : 768;
                            const vw = typeof window !== 'undefined' ? window.innerWidth || 1024 : 1024;
                            const menuW = 200;
                            const menuH = canManage ? 156 : 84;
                            const flipUp = vh - rect.bottom < menuH + 8 && rect.top > menuH + 8;
                            const top = flipUp
                              ? Math.max(8, Math.round(rect.top - menuH - 4))
                              : Math.round(rect.bottom + 4);
                            const left = Math.max(
                              8,
                              Math.min(Math.round(rect.right - menuW), vw - menuW - 8),
                            );
                            setRowMenuPos({ top, left });
                            setDeptMenuOpen(false);
                            setOpenRowMenuId((prev) => (prev === row.user.id ? null : row.user.id));
                          }}
                        >
                          <MoreHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="qx-card__foot hr-foot">
            <span>
              Hiển thị <span className="qs-numeric">{pageRows.length}</span> trên{' '}
              <span className="qs-numeric">{footerTotalCount}</span> nhân sự
            </span>
            <div className="hr-pager" aria-label="Phân trang danh bạ">
              {safePage > 1 ? (
                <button
                  type="button"
                  className="hr-pager__btn"
                  aria-label="Trang trước"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
                </button>
              ) : null}
              <span className="qs-numeric">
                {safePage} / {totalPages}
              </span>
              {safePage < totalPages ? (
                <button
                  type="button"
                  className="hr-pager__btn"
                  aria-label="Trang sau"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {activeMenuRow && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={rowMenuRef}
              className="hr-row-menu hr-row-menu--portal"
              role="menu"
              aria-label={`Thao tác ${activeMenuRow.user.name}`}
              style={{
                position: 'fixed',
                top: rowMenuPos.top,
                left: rowMenuPos.left,
                zIndex: 140,
              }}
            >
              <button
                type="button"
                role="menuitem"
                className="hr-row-menu__item"
                onClick={() => {
                  setOpenRowMenuId(null);
                  setDetailUserId(activeMenuRow.user.id);
                }}
              >
                Xem hồ sơ chi tiết
              </button>
              <button
                type="button"
                role="menuitem"
                className="hr-row-menu__item"
                onClick={() => handleCopyEmail(activeMenuRow.user.email)}
              >
                Sao chép email
              </button>
              {canManage ? (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="hr-row-menu__item"
                    onClick={() => handleToggleStatus(activeMenuRow.user.id)}
                  >
                    {activeMenuRow.statusLabel === 'Đang làm'
                      ? 'Chuyển sang Nghỉ phép'
                      : 'Chuyển sang Đang làm'}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="hr-row-menu__item hr-row-menu__item--danger"
                    onClick={() => handleDeleteUser(activeMenuRow.user.id)}
                  >
                    Xóa khỏi danh sách
                  </button>
                </>
              ) : null}
            </div>,
            document.body,
          )
        : null}

      {detailRow ? (
        <EmployeeDetailDialog
          row={detailRow}
          canManage={canManage}
          onClose={() => setDetailUserId(null)}
          onToggleStatus={handleToggleStatus}
          onCopyEmail={handleCopyEmail}
        />
      ) : null}

      {createUserModalNode}
    </section>
  );
}
