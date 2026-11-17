'use client';

import * as React from 'react';
import { Calendar, Paperclip, Plus, Users, X } from 'lucide-react';
import { Select, useFloatingLayer, type SelectOption } from '@qsystem/ui';
import { createTask } from '../../lib/adapters/tasks.adapter';
import { ApiError } from '../../lib/api/client';
import { formatDdMmYyyy, getLocalDateIso } from '../../lib/date';
import { humanizeApiError } from '../../lib/errors/humanize';
import {
  canUseDevPersistence,
  parseCalendarDateDdMmYyyy,
  type TaskViewItem,
} from './qtask.storage';
import {
  SAMPLE_PEOPLE,
  SAMPLE_PROJECTS,
} from './TaskDetailContent';

type TaskPriorityOption = 'Ưu tiên cao' | 'Trung bình' | 'Thấp';

const PROJECT_OPTIONS: readonly SelectOption<string>[] = SAMPLE_PROJECTS.map((proj) => ({
  value: proj,
  label: proj,
}));

const PRIORITY_OPTIONS: readonly SelectOption<TaskPriorityOption>[] = [
  { value: 'Ưu tiên cao', label: 'Ưu tiên cao' },
  { value: 'Trung bình', label: 'Trung bình' },
  { value: 'Thấp', label: 'Thấp' },
];

export interface AssigneeOption {
  id: string;
  name: string;
}

interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: AssigneeOption[];
  /** The adapter created it; the workspace prepends it to the table. */
  onCreated: (task: TaskViewItem) => void;
}

function getDefaultTitle(): string {
  const month = Number(getLocalDateIso().split('-')[1]);
  return `Hoàn thiện báo cáo triển khai QSystem tháng ${month}`;
}

function getDefaultDue(): string {
  return formatDdMmYyyy(getLocalDateIso());
}

const VISIBILITY_OPTIONS = ['Hiển thị với nhóm', 'Công khai toàn công ty', 'Chỉ người phụ trách'] as const;

export function CreateTaskModal({ open, onOpenChange, people, onCreated }: CreateTaskModalProps) {
  const modalRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const effectivePeople = React.useMemo(
    () => (people.length > 0 ? people : canUseDevPersistence() ? SAMPLE_PEOPLE : []),
    [people],
  );

  const [title, setTitle] = React.useState(() => getDefaultTitle());
  const [description, setDescription] = React.useState('');
  const [assigneeId, setAssigneeId] = React.useState(effectivePeople[0]?.id ?? 'la');
  const [project, setProject] = React.useState(SAMPLE_PROJECTS[0]);
  const [dueDate, setDueDate] = React.useState(() => getDefaultDue());
  const [priority, setPriority] = React.useState<'Ưu tiên cao' | 'Trung bình' | 'Thấp'>('Ưu tiên cao');
  const [attachmentName, setAttachmentName] = React.useState<string | null>(null);
  const [visibilityIdx, setVisibilityIdx] = React.useState(0);
  const [errors, setErrors] = React.useState<{ title?: string; assignee?: string; due?: string }>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [errorAttempt, setErrorAttempt] = React.useState(0);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setTitle(getDefaultTitle());
    setDescription('');
    const defaultPerson =
      effectivePeople.find((p) => p.name === 'Lan Anh') ?? effectivePeople[0];
    setAssigneeId(defaultPerson?.id ?? '');
    setProject(SAMPLE_PROJECTS[0]);
    setDueDate(getDefaultDue());
    setPriority('Ưu tiên cao');
    setAttachmentName(null);
    setVisibilityIdx(0);
    setErrors({});
    setSubmitError(null);
    setErrorAttempt(0);
  }, [open, effectivePeople]);

  const close = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  useFloatingLayer(open, close, true, { root: modalRef, initialFocus: modalRef });

  if (!open) return null;

  const selectedPerson = effectivePeople.find((option) => option.id === assigneeId);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    const nextErrors: typeof errors = {};
    if (!trimmed) nextErrors.title = 'Vui lòng nhập tên công việc.';
    if (!assigneeId) nextErrors.assignee = 'Vui lòng chọn người phụ trách.';
    const iso = parseCalendarDateDdMmYyyy(dueDate);
    if (!iso) nextErrors.due = 'Ngày hạn chót không hợp lệ.';
    setErrors(nextErrors);
    setSubmitError(null);
    if (!iso || Object.keys(nextErrors).length > 0) {
      setErrorAttempt((count) => count + 1);
      return;
    }

    setSaving(true);
    const resolvedDesc =
      description.trim() ||
      'Hoàn thiện nội dung báo cáo, rà soát hạng mục đã hoàn thành và tổng hợp các vấn đề cần xử lý.';
    try {
      const created = await createTask({
        title: trimmed,
        assigneeId,
        assigneeName: selectedPerson?.name ?? assigneeId,
        dueDate: iso,
        project,
        priority,
        description: resolvedDesc,
      });
      onCreated({
        ...created,
        project,
        priority,
        description: resolvedDesc,
        displayStatus: created.status,
        attachments: attachmentName ? [{ id: `att-${Date.now()}`, name: attachmentName, size: '128 KB' }] : [],
        updatedLabel: 'Vừa tạo',
      });
      close();
    } catch (err) {
      if (!canUseDevPersistence()) {
        setSubmitError(
          err instanceof ApiError ? humanizeApiError(err.code, err.status) : humanizeApiError(),
        );
        setErrorAttempt((count) => count + 1);
        return;
      }
      const localTask: TaskViewItem = {
        id: `local-${Date.now()}`,
        code: `CV-${1010 + Math.floor(Math.random() * 90)}`,
        title: trimmed,
        assigneeId,
        assigneeName: selectedPerson?.name ?? assigneeId,
        dueDate: iso,
        status: 'Đang làm',
        displayStatus: 'Đang làm',
        project,
        priority,
        description: resolvedDesc,
        attachments: attachmentName ? [{ id: `att-${Date.now()}`, name: attachmentName, size: '128 KB' }] : [],
        updatedLabel: 'Vừa tạo',
        isSample: true,
      };
      onCreated(localTask);
      close();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="qtk-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={modalRef}
        className="qtk-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qtk-create-title"
        tabIndex={-1}
      >
        <div className="qtk-modal__head">
          <h2 id="qtk-create-title">Giao việc mới</h2>
          <p>Tạo và phân công công việc cho đúng người, đúng thời hạn</p>
          <button type="button" className="qtk-modal__close" aria-label="Đóng hộp thoại" onClick={close}>
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={(event) => void submit(event)} noValidate>
          <div className="qtk-modal__body">
            {submitError ? (
              <p
                key={`submit-err-${errorAttempt}`}
                className="qtk-error qtk-field--full"
                role="alert"
              >
                {submitError}
              </p>
            ) : null}
            <div className="qtk-field qtk-field--full">
              <label htmlFor="qtk-create-name" className="qtk-field__label">
                Tên công việc <span className="qtk-field__req" aria-hidden="true">*</span>
              </label>
              <input
                id="qtk-create-name"
                type="text"
                className="qtk-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={`Ví dụ: ${getDefaultTitle()}`}
                aria-invalid={Boolean(errors.title)}
              />
              {errors.title ? (
                <p
                  key={`title-err-${errorAttempt}`}
                  className="qtk-error"
                  role="alert"
                >
                  {errors.title}
                </p>
              ) : null}
            </div>

            <div className="qtk-field qtk-field--full">
              <label htmlFor="qtk-create-desc" className="qtk-field__label">
                Mô tả công việc
              </label>
              <textarea
                id="qtk-create-desc"
                className="qtk-textarea"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Hoàn thiện nội dung báo cáo, rà soát hạng mục đã hoàn thành và tổng hợp các vấn đề cần xử lý."
              />
            </div>

            <div className="qtk-field">
              <label htmlFor="qtk-create-assignee" className="qtk-field__label">
                Người phụ trách <span className="qtk-field__req" aria-hidden="true">*</span>
              </label>
              <Select
                id="qtk-create-assignee"
                aria-label="Người phụ trách"
                value={assigneeId}
                onValueChange={setAssigneeId}
                options={effectivePeople.map((person) => ({
                  value: person.id,
                  label: person.name,
                }))}
                placeholder="Chọn người phụ trách"
                controlSize="md"
                error={Boolean(errors.assignee)}
              />
              {errors.assignee ? (
                <p
                  key={`assignee-err-${errorAttempt}`}
                  className="qtk-error"
                  role="alert"
                >
                  {errors.assignee}
                </p>
              ) : null}
            </div>

            <div className="qtk-field">
              <label htmlFor="qtk-create-project" className="qtk-field__label">
                Dự án
              </label>
              <Select
                id="qtk-create-project"
                aria-label="Dự án"
                value={project}
                onValueChange={setProject}
                options={PROJECT_OPTIONS}
                controlSize="md"
              />
            </div>

            <div className="qtk-field">
              <label htmlFor="qtk-create-due" className="qtk-field__label">
                Ngày đến hạn
              </label>
              <div className="qtk-input-icon-wrap">
                <input
                  id="qtk-create-due"
                  type="text"
                  className="qtk-input"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  placeholder="dd/mm/yyyy"
                  aria-invalid={Boolean(errors.due)}
                />
                <Calendar size={16} strokeWidth={1.5} aria-hidden="true" />
              </div>
              {errors.due ? (
                <p
                  key={`due-err-${errorAttempt}`}
                  className="qtk-error"
                  role="alert"
                >
                  {errors.due}
                </p>
              ) : null}
            </div>

            <div className="qtk-field">
              <label htmlFor="qtk-create-priority" className="qtk-field__label">
                Mức độ ưu tiên
              </label>
              <Select<TaskPriorityOption>
                id="qtk-create-priority"
                aria-label="Mức độ ưu tiên"
                value={priority}
                onValueChange={setPriority}
                options={PRIORITY_OPTIONS}
                controlSize="md"
              />
            </div>

            <div className="qtk-modal__extras">
              <input
                ref={fileInputRef}
                type="file"
                aria-label="Chọn tệp đính kèm"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) setAttachmentName(file.name);
                }}
              />
              <button
                type="button"
                className="qtk-extra-btn"
                data-active={attachmentName ? 'true' : undefined}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip size={16} strokeWidth={1.5} aria-hidden="true" />
                <span>{attachmentName ?? 'Thêm tệp đính kèm'}</span>
              </button>
              <button
                type="button"
                className="qtk-extra-btn"
                data-active={visibilityIdx !== 0 ? 'true' : undefined}
                onClick={() => setVisibilityIdx((current) => (current + 1) % VISIBILITY_OPTIONS.length)}
              >
                <Users size={16} strokeWidth={1.5} aria-hidden="true" />
                <span>{VISIBILITY_OPTIONS[visibilityIdx]}</span>
              </button>
            </div>
          </div>

          <div className="qtk-modal__foot">
            <button type="button" className="qx-btn" onClick={close} disabled={saving}>
              Hủy
            </button>
            <button type="submit" className="qx-btn qx-btn--primary" disabled={saving} aria-busy={saving}>
              <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
              {saving ? 'Đang tạo…' : 'Giao việc'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
