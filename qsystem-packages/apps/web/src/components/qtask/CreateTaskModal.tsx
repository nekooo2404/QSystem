'use client';

import * as React from 'react';
import { Button, Form, FormField, Input, Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from '@qsystem/ui';
import { createTask, type Task } from '../../lib/adapters/tasks.adapter';

export interface AssigneeOption {
  id: string;
  name: string;
}

interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: AssigneeOption[];
  /** The adapter created it; the workspace prepends it to the table. */
  onCreated: (task: Task) => void;
}

/** `dd/mm/yyyy` as the user types, stored as ISO so `new Date()` round-trips. */
function parseDateInput(raw: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : iso;
}

export function CreateTaskModal({ open, onOpenChange, people, onCreated }: CreateTaskModalProps) {
  const [title, setTitle] = React.useState('');
  const [assigneeId, setAssigneeId] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [errors, setErrors] = React.useState<{ title?: string; assignee?: string; due?: string }>({});
  const [saving, setSaving] = React.useState(false);

  function close() {
    onOpenChange(false);
    setTitle('');
    setAssigneeId('');
    setDueDate('');
    setErrors({});
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    const nextErrors: typeof errors = {};
    if (!trimmed) nextErrors.title = 'Vui lòng nhập tên công việc.';
    if (!assigneeId) nextErrors.assignee = 'Vui lòng chọn người phụ trách.';
    const iso = parseDateInput(dueDate);
    if (!iso) nextErrors.due = 'Vui lòng nhập thời hạn theo dạng ngày/tháng/năm.';
    setErrors(nextErrors);
    if (!iso || Object.keys(nextErrors).length > 0) return;

    const person = people.find((option) => option.id === assigneeId);
    setSaving(true);
    try {
      const task = await createTask({
        title: trimmed,
        assigneeId,
        assigneeName: person?.name ?? assigneeId,
        dueDate: iso,
      });
      onCreated(task);
      close();
    } catch {
      setErrors({ title: 'Không tạo được công việc, vui lòng thử lại.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(next) => (next ? undefined : close())}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Giao việc mới</ModalTitle>
          <ModalDescription>Điền đủ thông tin để người phụ trách nhận việc ngay.</ModalDescription>
        </ModalHeader>
        <Form onSubmit={(event) => void submit(event)}>
          <FormField name="title" label="Tên công việc" error={errors.title}>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ví dụ: Rà soát danh sách chi nhánh quý 4"
            />
          </FormField>
          <FormField name="assignee" label="Người phụ trách" error={errors.assignee}>
            <select
              className="qs-input"
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
            >
              <option value="">Chọn người phụ trách</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            name="due"
            label="Thời hạn"
            error={errors.due}
            helperText="Nhập theo dạng ngày/tháng/năm, ví dụ 20/11/2026."
          >
            <Input value={dueDate} onChange={(event) => setDueDate(event.target.value)} placeholder="ngày/tháng/năm" />
          </FormField>
          <ModalFooter>
            <Button variant="secondary" onClick={close}>
              Hủy
            </Button>
            <Button type="submit" loading={saving} loadingText="Đang tạo…">
              Giao việc
            </Button>
          </ModalFooter>
        </Form>
      </ModalContent>
    </Modal>
  );
}
