'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, Plus, ShieldCheck, X } from 'lucide-react';
import { Select, useFloatingLayer, type SelectOption } from '@qsystem/ui';
import type { MeResponse, Role } from '@qsystem/contracts';
import { ApiError, apiFetch } from '../../lib/api/client';

export interface OrgDepartmentOption {
  id: string;
  name: string;
}

export interface OrgManagerOption {
  id: string;
  name: string;
}

export interface CreatedOrgUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  departmentId: string | null;
  reportsToId: string | null;
  jobTitle?: string;
  reportsToName?: string;
}

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  me: MeResponse;
  departments: OrgDepartmentOption[];
  managers?: OrgManagerOption[];
  isSampleMode?: boolean;
  onCreated: (user: CreatedOrgUser) => void;
}

function formatDepartmentOption(name: string): string {
  const trimmed = name.trim();
  if (/^(Phòng|Ban)\b/i.test(trimmed)) return trimmed;
  return `Phòng ${trimmed}`;
}

function CreateUserDialog({
  onOpenChange,
  me,
  departments,
  managers = [],
  isSampleMode = false,
  onCreated,
}: Omit<CreateUserModalProps, 'open'>) {
  const isManagerOnly = me.role === 'MANAGER';
  const availableDepts = isManagerOnly
    ? departments.filter((d) => me.managedDepartmentIds.includes(d.id))
    : departments;

  const defaultDept = React.useMemo(() => {
    if (isManagerOnly) return availableDepts[0]?.id ?? '';
    const tech = availableDepts.find((d) => /công nghệ/i.test(d.name));
    return tech?.id ?? '';
  }, [availableDepts, isManagerOnly]);

  const defaultManager = React.useMemo(() => {
    const quocHuy = managers.find((m) => /quốc huy/i.test(m.name));
    return quocHuy?.id ?? '';
  }, [managers]);

  const deptSelectOptions = React.useMemo<SelectOption<string>[]>(() => {
    const base: SelectOption<string>[] = !isManagerOnly
      ? [{ value: '', label: 'Chưa xếp phòng ban' }]
      : [];
    return [
      ...base,
      ...availableDepts.map((dept) => ({
        value: dept.id,
        label: formatDepartmentOption(dept.name),
      })),
    ];
  }, [availableDepts, isManagerOnly]);

  const roleSelectOptions = React.useMemo<SelectOption<Role>[]>(() => {
    const items: SelectOption<Role>[] = [{ value: 'EMPLOYEE', label: 'Nhân viên' }];
    if (!isManagerOnly) {
      items.push(
        { value: 'MANAGER', label: 'Quản lý' },
        { value: 'DIRECTOR', label: 'Giám đốc' },
      );
    }
    return items;
  }, [isManagerOnly]);

  const managerSelectOptions = React.useMemo<SelectOption<string>[]>(() => {
    return [
      { value: '', label: 'Chưa chỉ định' },
      ...managers.map((manager) => ({
        value: manager.id,
        label: manager.name,
      })),
    ];
  }, [managers]);

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [departmentId, setDepartmentId] = React.useState<string>(defaultDept);
  const [jobTitle, setJobTitle] = React.useState('');
  const [role, setRole] = React.useState<Role>('EMPLOYEE');
  const [reportsToId, setReportsToId] = React.useState<string>(defaultManager);
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [errors, setErrors] = React.useState<{
    name?: string;
    email?: string;
    password?: string;
    departmentId?: string;
    form?: string;
  }>({});
  const [errorAttempt, setErrorAttempt] = React.useState(0);
  const [saving, setSaving] = React.useState(false);

  const modalRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descId = React.useId();

  const close = React.useCallback(() => {
    if (saving) return;
    onOpenChange(false);
  }, [onOpenChange, saving]);

  useFloatingLayer(true, close, true, { root: modalRef });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = 'Vui lòng nhập họ và tên.';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = 'Vui lòng nhập địa chỉ email hợp lệ.';
    }
    if (password.length < 8) {
      nextErrors.password = 'Mật khẩu tạm cần tối thiểu 8 ký tự.';
    }
    if (isManagerOnly && !departmentId) {
      nextErrors.departmentId = 'Vui lòng chọn phòng ban bạn quản lý.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setErrorAttempt((count) => count + 1);
      return;
    }

    setSaving(true);
    const trimmedTitle = jobTitle.trim();
    const canLocalFallback =
      process.env.NODE_ENV === 'development' ||
      (process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && process.env.NODE_ENV !== 'test');
    try {
      const created = await apiFetch<CreatedOrgUser>('/api/org/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role: isManagerOnly ? 'EMPLOYEE' : role,
          ...(trimmedTitle ? { jobTitle: trimmedTitle } : {}),
          departmentId: departmentId || null,
          reportsToId: reportsToId || null,
        }),
      });
      const selectedManager = managers.find((m) => m.id === reportsToId);
      onCreated({
        ...created,
        departmentId: created.departmentId ?? (departmentId || null),
        reportsToId: created.reportsToId ?? (reportsToId || null),
        jobTitle: created.jobTitle ?? (trimmedTitle || undefined),
        reportsToName: selectedManager?.name,
      });
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'CONFLICT' || err.status === 409)) {
        setErrors({ form: 'Email này đã có trong hệ thống.' });
        setErrorAttempt((count) => count + 1);
        return;
      }
      if (err instanceof ApiError && err.status === 400) {
        setErrors({ form: err.message || 'Thông tin chưa hợp lệ.' });
        setErrorAttempt((count) => count + 1);
        return;
      }
      const isOfflineOrSample =
        canLocalFallback &&
        (isSampleMode ||
          !(err instanceof ApiError) ||
          err.status === 404 ||
          err.status >= 500);
      if (isOfflineOrSample) {
        const selectedManager = managers.find((m) => m.id === reportsToId);
        onCreated({
          id: `u-local-${Date.now()}`,
          name: name.trim(),
          email: email.trim(),
          role: isManagerOnly ? 'EMPLOYEE' : role,
          departmentId: departmentId || null,
          reportsToId: reportsToId || null,
          jobTitle: trimmedTitle || undefined,
          reportsToName: selectedManager?.name,
        });
        onOpenChange(false);
        return;
      }
      setErrors({ form: 'Không thêm được nhân sự, vui lòng thử lại.' });
      setErrorAttempt((count) => count + 1);
    } finally {
      setSaving(false);
    }
  }

  const content = (
    <div
      className="hr-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={modalRef}
        className="hr-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
      >
        <div className="hr-modal__head">
          <h2 id={titleId}>Thêm nhân sự mới</h2>
          <p id={descId}>Tạo hồ sơ và tài khoản làm việc cho thành viên mới</p>
          <button
            type="button"
            className="hr-modal__close"
            aria-label="Đóng hộp thoại"
            onClick={close}
            disabled={saving}
          >
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={(event) => void submit(event)} noValidate>
          <div className="hr-modal__body">
            <div className="hr-field">
              <label htmlFor="hr-user-name">Họ và tên *</label>
              <input
                id="hr-user-name"
                type="text"
                className="hr-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nguyễn Minh An"
                aria-invalid={Boolean(errors.name)}
                disabled={saving}
              />
              {errors.name ? (
                <p key={`name-err-${errorAttempt}`} className="hr-error" role="alert">
                  {errors.name}
                </p>
              ) : null}
            </div>

            <div className="hr-field">
              <label htmlFor="hr-user-email">Email công việc *</label>
              <input
                id="hr-user-email"
                type="email"
                className="hr-input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="minhan@qsystem.vn"
                aria-invalid={Boolean(errors.email)}
                disabled={saving}
              />
              {errors.email ? (
                <p key={`email-err-${errorAttempt}`} className="hr-error" role="alert">
                  {errors.email}
                </p>
              ) : null}
            </div>

            <div className="hr-field">
              <label id="hr-user-dept-label" htmlFor="hr-user-dept">
                Phòng ban
              </label>
              <Select
                id="hr-user-dept"
                aria-labelledby="hr-user-dept-label"
                value={departmentId}
                onValueChange={setDepartmentId}
                options={deptSelectOptions}
                error={Boolean(errors.departmentId)}
                disabled={saving}
                controlSize="md"
              />
              {errors.departmentId ? (
                <p key={`dept-err-${errorAttempt}`} className="hr-error" role="alert">
                  {errors.departmentId}
                </p>
              ) : null}
            </div>

            <div className="hr-field">
              <label htmlFor="hr-user-title">Chức danh</label>
              <input
                id="hr-user-title"
                type="text"
                className="hr-input"
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                placeholder="Chuyên viên kỹ thuật"
                disabled={saving}
              />
            </div>

            <div className="hr-field hr-field--gap">
              <label id="hr-user-role-label" htmlFor="hr-user-role">
                Vai trò truy cập
              </label>
              <Select
                id="hr-user-role"
                aria-labelledby="hr-user-role-label"
                value={isManagerOnly ? 'EMPLOYEE' : role}
                onValueChange={(nextRole) => setRole(nextRole as Role)}
                options={roleSelectOptions}
                disabled={saving || isManagerOnly}
                controlSize="md"
              />
            </div>

            <div className="hr-field hr-field--gap">
              <label id="hr-user-manager-label" htmlFor="hr-user-manager">
                Quản lý trực tiếp
              </label>
              <Select
                id="hr-user-manager"
                aria-labelledby="hr-user-manager-label"
                value={reportsToId}
                onValueChange={setReportsToId}
                options={managerSelectOptions}
                disabled={saving}
                controlSize="md"
              />
            </div>

            <div className="hr-field hr-field--full hr-field--gap">
              <label htmlFor="hr-user-password">Mật khẩu tạm *</label>
              <div className="hr-input-wrap">
                <input
                  id="hr-user-password"
                  type={showPassword ? 'text' : 'password'}
                  className="hr-input hr-input--pwd"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••••••"
                  aria-invalid={Boolean(errors.password)}
                  disabled={saving}
                />
                <button
                  type="button"
                  className="hr-eye"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={saving}
                >
                  {showPassword ? (
                    <EyeOff size={16} strokeWidth={1.5} aria-hidden="true" />
                  ) : (
                    <Eye size={16} strokeWidth={1.5} aria-hidden="true" />
                  )}
                </button>
              </div>
              <p className="hr-hint">
                Người dùng sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.
              </p>
              {errors.password ? (
                <p key={`pwd-err-${errorAttempt}`} className="hr-error" role="alert">
                  {errors.password}
                </p>
              ) : null}
            </div>

            <div className="hr-note">
              <ShieldCheck size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Tài khoản sẽ chỉ được cấp quyền theo vai trò và phòng ban được lựa chọn.</span>
            </div>

            {errors.form ? (
              <p key={`form-err-${errorAttempt}`} className="hr-error hr-field--full" role="alert">
                {errors.form}
              </p>
            ) : null}
          </div>

          <div className="hr-modal__foot">
            <button type="button" className="qx-btn" onClick={close} disabled={saving}>
              Hủy
            </button>
            <button type="submit" className="qx-btn qx-btn--primary" disabled={saving}>
              <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
              {saving ? 'Đang lưu…' : 'Tạo nhân sự'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}

export function CreateUserModal({
  open,
  onOpenChange,
  me,
  departments,
  managers = [],
  isSampleMode = false,
  onCreated,
}: CreateUserModalProps) {
  if (!open) return null;
  return (
    <CreateUserDialog
      onOpenChange={onOpenChange}
      me={me}
      departments={departments}
      managers={managers}
      isSampleMode={isSampleMode}
      onCreated={onCreated}
    />
  );
}
