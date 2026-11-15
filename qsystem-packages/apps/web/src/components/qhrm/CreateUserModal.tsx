'use client';

import * as React from 'react';
import {
  Button,
  Form,
  FormField,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@qsystem/ui';
import type { MeResponse, Role } from '@qsystem/contracts';
import { ApiError, apiFetch } from '../../lib/api/client';

export interface OrgDepartmentOption {
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
}

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  me: MeResponse;
  departments: OrgDepartmentOption[];
  onCreated: (user: CreatedOrgUser) => void;
}

export function CreateUserModal({
  open,
  onOpenChange,
  me,
  departments,
  onCreated,
}: CreateUserModalProps) {
  const isManagerOnly = me.role === 'MANAGER';
  const availableDepts = isManagerOnly
    ? departments.filter((d) => me.managedDepartmentIds.includes(d.id))
    : departments;

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [role, setRole] = React.useState<Role>('EMPLOYEE');
  const [departmentId, setDepartmentId] = React.useState<string>('');
  const [errors, setErrors] = React.useState<{
    name?: string;
    email?: string;
    password?: string;
    departmentId?: string;
    form?: string;
  }>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open && isManagerOnly && availableDepts.length > 0 && !departmentId) {
      setDepartmentId(availableDepts[0].id);
    }
  }, [open, isManagerOnly, availableDepts, departmentId]);

  function close() {
    onOpenChange(false);
    setName('');
    setEmail('');
    setPassword('');
    setRole('EMPLOYEE');
    setDepartmentId('');
    setErrors({});
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = 'Vui lòng nhập họ và tên.';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = 'Vui lòng nhập địa chỉ email hợp lệ.';
    }
    if (password.length < 8) {
      nextErrors.password = 'Mật khẩu cần tối thiểu 8 ký tự.';
    }
    if (isManagerOnly && !departmentId) {
      nextErrors.departmentId = 'Vui lòng chọn phòng ban bạn quản lý.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const created = await apiFetch<CreatedOrgUser>('/api/org/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role: isManagerOnly ? 'EMPLOYEE' : role,
          departmentId: departmentId || null,
        }),
      });
      onCreated(created);
      close();
    } catch (err) {
      const msg =
        err instanceof ApiError && err.code === 'CONFLICT'
          ? 'Email này đã có trong hệ thống.'
          : 'Không thêm được nhân sự, vui lòng thử lại.';
      setErrors({ form: msg });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(next) => (next ? undefined : close())}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Thêm nhân sự mới</ModalTitle>
          <ModalDescription>Tạo tài khoản làm việc mới trong phạm vi phụ trách của bạn.</ModalDescription>
        </ModalHeader>
        <Form onSubmit={(event) => void submit(event)}>
          <FormField name="name" label="Họ tên" error={errors.name}>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ví dụ: Lê Minh Khôi"
            />
          </FormField>
          <FormField name="email" label="Email" error={errors.email}>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="khoi@qsystem.vn"
            />
          </FormField>
          <FormField name="password" label="Mật khẩu tạm" error={errors.password}>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Ít nhất 8 ký tự"
            />
          </FormField>
          <FormField name="departmentId" label="Phòng ban" error={errors.departmentId}>
            <select
              className="qs-input"
              aria-label="Phòng ban"
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
            >
              {!isManagerOnly ? <option value="">Chưa xếp phòng ban</option> : null}
              {availableDepts.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </FormField>
          {!isManagerOnly ? (
            <FormField name="role" label="Vai trò">
              <select
                className="qs-input"
                aria-label="Vai trò"
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
              >
                <option value="EMPLOYEE">Nhân viên</option>
                <option value="MANAGER">Quản lý</option>
                <option value="DIRECTOR">Giám đốc</option>
              </select>
            </FormField>
          ) : null}
          {errors.form ? (
            <p className="qs-form__error" role="alert">
              {errors.form}
            </p>
          ) : null}
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={close} disabled={saving}>
              Hủy
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Tạo nhân sự'}
            </Button>
          </ModalFooter>
        </Form>
      </ModalContent>
    </Modal>
  );
}

