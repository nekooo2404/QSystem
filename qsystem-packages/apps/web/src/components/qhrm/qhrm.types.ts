import type { MeResponse } from '@qsystem/contracts';

export interface Department {
  id: string;
  name: string;
  sampleCount?: number;
}

export type AvatarTone = 'plum' | 'indigo' | 'slate' | 'teal' | 'cyan';
export type EmploymentStatus = 'Đang làm' | 'Nghỉ phép' | 'Chưa có dữ liệu';

export interface OrgUser {
  id: string;
  email: string;
  name: string;
  role: MeResponse['role'];
  departmentId: string | null;
  reportsToId: string | null;
  jobTitle?: string;
  statusLabel?: 'Đang làm' | 'Nghỉ phép';
  avatarTone?: AvatarTone;
  reportsToName?: string;
  employeeCode?: string;
}

export interface DirectoryRow {
  user: OrgUser;
  employeeCode: string;
  initials: string;
  avatarTone: AvatarTone;
  jobTitle: string;
  departmentName: string;
  managerName: string;
  statusLabel: EmploymentStatus;
}

export type AttendanceStatus =
  | 'Đúng giờ'
  | 'Đi muộn'
  | 'Về sớm'
  | 'Nghỉ phép'
  | 'Chưa chấm công';

export interface AttendanceLogEntry {
  id: string;
  time: string;
  action: string;
  actor: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  employeeEmail: string;
  departmentId: string | null;
  departmentName: string;
  dateIso: string;
  checkIn: string | null;
  checkOut: string | null;
  workedHours: number;
  status: AttendanceStatus;
  note: string;
  logs: AttendanceLogEntry[];
}

export type LeaveType = 'Phép năm' | 'Nghỉ ốm' | 'Việc riêng' | 'Nghỉ bù';
export type LeaveStatus = 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối';

export interface LeaveRequest {
  id: string;
  code: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  employeeEmail: string;
  departmentId: string | null;
  departmentName: string;
  type: LeaveType;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  approverId: string | null;
  approverName: string;
  createdAtLabel: string;
  reviewedByName?: string;
  reviewedAtLabel?: string;
  rejectionReason?: string;
}

export interface LeaveBalanceSummary {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentId: string | null;
  departmentName: string;
  entitledDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
}
