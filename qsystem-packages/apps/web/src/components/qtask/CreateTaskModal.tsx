'use client';

import * as React from 'react';
import { Calendar, ChevronDown, Paperclip, Plus, Users, X } from 'lucide-react';
import { useFloatingLayer } from '@qsystem/ui';
import { createTask } from '../../lib/adapters/tasks.adapter';
import { ApiError } from '../../lib/api/client';
import { humanizeApiError } from '../../lib/errors/humanize';
import {
  canUseDevPersistence,
  parseCalendarDateDdMmYyyy,
  type TaskViewItem,
} from './qtask.storage';
import {
  getPriorityBadgeClass,
  initials,
  SAMPLE_PEOPLE,
  SAMPLE_PROJECTS,
} from './TaskDetailContent';

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

const DEFAULT_TITLE = 'Hoàn thiện báo cáo triển khai QSystem tháng 11';
const DEFAULT_DUE = '20/11/2026';
const VISIBILITY_OPTIONS = ['Hiển thị với nhóm', 'Công khai toàn công ty', 'Chỉ người phụ trách'] as const;

export function CreateTaskModal({ open, onOpenChange, people, onCreated }: CreateTaskModalProps) {
  const modalRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const effectivePeople = React.useMemo(
    () => (people.length > 0 ? people : canUseDevPersistence() ? SAMPLE_PEOPLE : []),
    [people],
  );

  const [title, setTitle] = React.useState(DEFAULT_TITLE);
  const [description, setDescription] = React.useState('');
  const [assigneeId, setAssigneeId] = React.useState(effectivePeople[0]?.id ?? 'la');
  const [project, setProject] = React.useState(SAMPLE_PROJECTS[0]);
  const [dueDate, setDueDate] = React.useState(DEFAULT_DUE);
  const [priority, setPriority] = React.useState<'Ưu tiên cao' | 'Trung bình' | 'Thấp'>('Ưu tiên cao');
  const [attachmentName, setAttachmentName] = React.useState<string | null>(null);
  const [visibilityIdx, setVisibilityIdx] = React.useState(0);
  const [errors, setErrors] = React.useState<{ title?: string; assignee?: string; due?: string }>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setTitle(DEFAULT_TITLE);
    setDescription('');
    const defaultPerson =
      effectivePeople.find((p) => p.name === 'Lan Anh') ?? effectivePeople[0];
    setAssigneeId(defaultPerson?.id ?? '');
    setProject(SAMPLE_PROJECTS[0]);
    setDueDate(DEFAULT_DUE);
    setPriority('Ưu tiên cao');
    setAttachmentName(null);
    setVisibilityIdx(0);
    setErrors({});
    setSubmitError(null);
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
    if (!iso || Object.keys(nextErrors).length > 0) return;

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
          <p>Tạo và phân công công việc cho đúng người, đúng thời hạn.</p>
          <button type="button" className="qtk-modal__close" aria-label="Đóng hộp thoại" onClick={close}>
            <X size={18} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={(event) => void submit(event)} noValidate>
          <div className="qtk-modal__body">
            {submitError ? <p className="qtk-error qtk-field--full" role="alert">{submitError}</p> : null}
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
                placeholder="Ví dụ: Hoàn thiện báo cáo triển khai QSystem tháng 11"
                aria-invalid={Boolean(errors.title)}
              />
              {errors.title ? <p className="qtk-error" role="alert">{errors.title}</p> : null}
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
              <div className="qtk-select-box">
                <span className="qtk-select-box__value">
                  <span className="qx-avatar qx-avatar--sm qtk-avatar-cell" aria-hidden="true">
                    {initials(selectedPerson?.name ?? 'LA')}
                  </span>
                  <span className="qtk-select-box__name qtk-select-box__name--centered">
                    {selectedPerson?.name ?? 'Chọn người phụ trách'}
                  </span>
                </span>
                <ChevronDown size={15} strokeWidth={1.6} className="qtk-select-box__chevron" aria-hidden="true" />
                <select
                  id="qtk-create-assignee"
                  className="qtk-select-box__native"
                  aria-label="Người phụ trách"
                  value={assigneeId}
                  onChange={(event) => setAssigneeId(event.target.value)}
                >
                  <option value="">Chọn người phụ trách</option>
                  {effectivePeople.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </div>
              {errors.assignee ? <p className="qtk-error" role="alert">{errors.assignee}</p> : null}
            </div>

            <div className="qtk-field">
              <label htmlFor="qtk-create-project" className="qtk-field__label">
                Dự án
              </label>
              <div className="qtk-select-box">
                <span className="qtk-select-box__value">
                  <span className="qtk-select-box__name">{project}</span>
                </span>
                <ChevronDown size={15} strokeWidth={1.6} className="qtk-select-box__chevron" aria-hidden="true" />
                <select
                  id="qtk-create-project"
                  className="qtk-select-box__native"
                  aria-label="Dự án"
                  value={project}
                  onChange={(event) => setProject(event.target.value)}
                >
                  {SAMPLE_PROJECTS.map((proj) => (
                    <option key={proj} value={proj}>
                      {proj}
                    </option>
                  ))}
                </select>
              </div>
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
                <Calendar size={15} strokeWidth={1.6} aria-hidden="true" />
              </div>
              {errors.due ? <p className="qtk-error" role="alert">{errors.due}</p> : null}
            </div>

            <div className="qtk-field">
              <label htmlFor="qtk-create-priority" className="qtk-field__label">
                Mức độ ưu tiên
              </label>
              <div className="qtk-select-box">
                <span className="qtk-select-box__value">
                  <span className={getPriorityBadgeClass(priority)}>{priority}</span>
                </span>
                <ChevronDown size={15} strokeWidth={1.6} className="qtk-select-box__chevron" aria-hidden="true" />
                <select
                  id="qtk-create-priority"
                  className="qtk-select-box__native"
                  aria-label="Mức độ ưu tiên"
                  value={priority}
                  onChange={(event) =>
                    setPriority(event.target.value as 'Ưu tiên cao' | 'Trung bình' | 'Thấp')
                  }
                >
                  <option value="Ưu tiên cao">Ưu tiên cao</option>
                  <option value="Trung bình">Trung bình</option>
                  <option value="Thấp">Thấp</option>
                </select>
              </div>
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
                <Paperclip size={14} strokeWidth={1.6} aria-hidden="true" />
                <span>{attachmentName ?? 'Thêm tệp đính kèm'}</span>
              </button>
              <button
                type="button"
                className="qtk-extra-btn"
                data-active={visibilityIdx !== 0 ? 'true' : undefined}
                onClick={() => setVisibilityIdx((current) => (current + 1) % VISIBILITY_OPTIONS.length)}
              >
                <Users size={14} strokeWidth={1.6} aria-hidden="true" />
                <span>{VISIBILITY_OPTIONS[visibilityIdx]}</span>
              </button>
            </div>
          </div>

          <div className="qtk-modal__foot">
            <button type="button" className="qx-btn" onClick={close} disabled={saving}>
              Hủy
            </button>
            <button type="submit" className="qx-btn qx-btn--primary" disabled={saving} aria-busy={saving}>
              <Plus size={15} strokeWidth={2} aria-hidden="true" />
              {saving ? 'Đang tạo…' : 'Giao việc'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
