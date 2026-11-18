'use client';

import * as React from 'react';
import { Check, FileText, Paperclip, Plus, Send, X } from 'lucide-react';
import { Select, useFloatingLayer, type SelectOption } from '@qsystem/ui';
import { TASK_STATUSES, type TaskStatus } from '../../lib/adapters/tasks.adapter';
import { apiFetch } from '../../lib/api/client';

const TASK_STATUS_OPTIONS: readonly SelectOption<TaskStatus>[] = TASK_STATUSES.map((status) => ({
  value: status,
  label: status,
}));
import { addLocalDaysIso, formatDdMmYyyy, formatLocalTimeHm } from '../../lib/date';
import {
  loadTaskExtras,
  saveTaskExtras,
  type TaskAttachment,
  type TaskComment,
  type TaskHistoryEntry,
  type TaskViewItem,
} from './qtask.storage';

export type { TaskComment, TaskViewItem };

export const SAMPLE_PEOPLE = [
  { id: 'la', name: 'Lan Anh' },
  { id: 'mk', name: 'Minh Khôi' },
  { id: 'da', name: 'Đức Anh' },
  { id: 'hm', name: 'Hà My' },
];

export const SAMPLE_PROJECTS = ['QSystem Core', 'QHRM Upgrade', 'QCRM V2', 'QSocial Workspace'];

const DEFAULT_COMMENTS: TaskComment[] = [
  {
    id: 'c-1',
    author: 'Lan Anh',
    initials: 'LA',
    time: '14:30',
    text: 'Đã gửi tài liệu và cập nhật đề xuất. Nhờ anh kiểm tra trước khi duyệt nhé.',
  },
  {
    id: 'c-2',
    author: 'Minh Khôi',
    initials: 'MK',
    time: '15:12',
    text: 'Minh sẽ rà soát và phản hồi trong hôm nay.',
  },
];

export function getSampleTasks(): TaskViewItem[] {
  const historyDay = formatDdMmYyyy(addLocalDaysIso(-6));
  return [
    {
      id: 'sample-CV-1004',
      code: 'CV-1004',
      title: 'Duyệt yêu cầu nghỉ phép',
      project: 'QHRM',
      assigneeId: 'mk',
      assigneeName: 'Minh Khôi',
      dueDate: addLocalDaysIso(-5),
      status: 'Đang làm',
      displayStatus: 'Đang làm',
      priority: 'Ưu tiên cao',
      departmentName: 'Nhân sự',
      detailAssigneeName: 'Lan Anh',
      detailDueDate: addLocalDaysIso(3),
      detailProject: 'QHRM Upgrade',
      detailDepartment: 'Nhân sự',
      detailStatusLabel: 'Đang thực hiện',
      description: 'Kiểm tra hồ sơ xin nghỉ phép của nhân viên, đối chiếu chính sách và cập nhật kết quả phê duyệt.',
      updatedLabel: 'Cập nhật 2 giờ trước',
      comments: DEFAULT_COMMENTS,
      attachments: [{ id: 'a-1', name: 'Don-xin-nghi-phep-T11.pdf', size: '245 KB' }],
      history: [
        { id: 'h-1', text: 'Lan Anh đã tạo công việc', time: `${historyDay} · 09:15` },
        { id: 'h-2', text: 'Minh Khôi đã chuyển sang Đang thực hiện', time: `${historyDay} · 14:20` },
      ],
      isSample: true,
    },
    {
      id: 'sample-CV-1005',
      code: 'CV-1005',
      title: 'Thiết kế dashboard quản trị',
      project: 'QSystem',
      assigneeId: 'la',
      assigneeName: 'Lan Anh',
      dueDate: addLocalDaysIso(-1),
      status: 'Đang làm',
      displayStatus: 'Đang làm',
      priority: 'Ưu tiên cao',
      departmentName: 'Sản phẩm',
      description: 'Hoàn thiện bố cục các thẻ chỉ số và bảng điều hành tổng quan cho không gian làm việc QSystem.',
      updatedLabel: 'Cập nhật 3 giờ trước',
      isSample: true,
    },
    {
      id: 'sample-CV-1006',
      code: 'CV-1006',
      title: 'Chuẩn hóa quy trình onboarding',
      project: 'QHRM',
      assigneeId: 'da',
      assigneeName: 'Đức Anh',
      dueDate: addLocalDaysIso(0),
      status: 'Chờ duyệt',
      displayStatus: 'Chờ duyệt',
      priority: 'Trung bình',
      departmentName: 'Nhân sự',
      description: 'Tổng hợp tài liệu hướng dẫn nhân sự mới và biểu mẫu tiếp nhận công việc theo từng phòng ban.',
      updatedLabel: 'Cập nhật hôm qua',
      isSample: true,
    },
    {
      id: 'sample-CV-1007',
      code: 'CV-1007',
      title: 'Kiểm thử phân quyền nhân sự',
      project: 'QHRM',
      assigneeId: 'mk',
      assigneeName: 'Minh Khôi',
      dueDate: addLocalDaysIso(2),
      status: 'Đang làm',
      displayStatus: 'Ưu tiên',
      priority: 'Ưu tiên cao',
      departmentName: 'Kỹ thuật',
      description: 'Kiểm tra ma trận phân quyền giữa Giám đốc, Quản lý phòng ban và Nhân viên trên toàn bộ API.',
      updatedLabel: 'Cập nhật 1 giờ trước',
      isSample: true,
    },
    {
      id: 'sample-CV-1008',
      code: 'CV-1008',
      title: 'Đồng bộ dữ liệu khách hàng',
      project: 'QCRM',
      assigneeId: 'hm',
      assigneeName: 'Hà My',
      dueDate: addLocalDaysIso(3),
      status: 'Đang làm',
      displayStatus: 'Cần làm',
      priority: 'Trung bình',
      departmentName: 'Kinh doanh',
      description: 'Đối chiếu danh sách khách hàng doanh nghiệp và cập nhật đầu mối liên hệ trong QCRM.',
      updatedLabel: 'Cập nhật 4 giờ trước',
      isSample: true,
    },
    {
      id: 'sample-CV-1009',
      code: 'CV-1009',
      title: 'Cập nhật nội dung bảng tin',
      project: 'QSocial',
      assigneeId: 'la',
      assigneeName: 'Lan Anh',
      dueDate: addLocalDaysIso(4),
      status: 'Hoàn thành',
      displayStatus: 'Hoàn thành',
      priority: 'Thấp',
      departmentName: 'Truyền thông',
      description: 'Đăng tải bản tin nội bộ tuần này và ghim thông báo lịch đánh giá sprint.',
      updatedLabel: 'Hoàn thành hôm qua',
      isSample: true,
    },
  ];
}

export const SAMPLE_TASKS: TaskViewItem[] = getSampleTasks();

export function initials(name?: string): string {
  if (!name) return 'MK';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatDueDate(due: string): string {
  return formatDdMmYyyy(due);
}

export function getStatusBadgeClass(label: string): string {
  switch (label) {
    case 'Đang làm':
    case 'Đang thực hiện':
      return 'qx-badge qx-badge--blue';
    case 'Chờ duyệt':
      return 'qx-badge qx-badge--amber';
    case 'Ưu tiên':
    case 'Ưu tiên cao':
      return 'qx-badge qx-badge--amber';
    case 'Hoàn thành':
    case 'Đã xong':
      return 'qx-badge qx-badge--green';
    case 'Quá hạn':
    case 'Cần xử lý':
      return 'qx-badge qx-badge--red';
    case 'Cần làm':
    default:
      return 'qx-badge';
  }
}

export function getPriorityBadgeClass(priority?: string): string {
  if (priority === 'Trung bình') return 'qx-badge qx-badge--blue';
  if (priority === 'Thấp') return 'qx-badge';
  return 'qx-badge qx-badge--amber';
}

const PANEL_TABS = ['trao-doi', 'tep-dinh-kem', 'lich-su'] as const;

interface TaskDetailContentProps {
  task: TaskViewItem;
  departmentName: string;
  pending: boolean;
  onStatusChange: (status: TaskStatus) => void;
  currentUserName?: string;
}

export function TaskDetailContent({
  task,
  departmentName,
  pending,
  onStatusChange,
  currentUserName = 'Minh Khôi',
}: TaskDetailContentProps) {
  const [tab, setTab] = React.useState<(typeof PANEL_TABS)[number]>('trao-doi');
  const [commentsByTask, setCommentsByTask] = React.useState<Record<string, TaskComment[]>>(() => loadTaskExtras().comments);
  const [attachmentsByTask, setAttachmentsByTask] = React.useState<Record<string, TaskAttachment[]>>(
    () => loadTaskExtras().attachments,
  );
  const [historyByTask, setHistoryByTask] = React.useState<Record<string, TaskHistoryEntry[]>>(
    () => loadTaskExtras().history,
  );
  const [draft, setDraft] = React.useState('');
  const commentInputRef = React.useRef<HTMLInputElement>(null);
  const attachInputRef = React.useRef<HTMLInputElement>(null);
  const prevStatusRef = React.useRef<{ id: string; status: TaskStatus }>({
    id: task.id,
    status: task.status,
  });

  React.useEffect(() => {
    const stored = loadTaskExtras();
    setCommentsByTask(stored.comments);
    setAttachmentsByTask(stored.attachments);
    setHistoryByTask(stored.history);
    setTab('trao-doi');
    setDraft('');
  }, [task.id]);

  React.useEffect(() => {
    if (process.env.NODE_ENV === 'test' || task.isSample || task.id.startsWith('sample-')) return;
    let active = true;
    Promise.all([
      apiFetch<Array<{ id: string; text: string; createdAt: string; author?: { name?: string } }>>(`/api/org/tasks/${task.id}/comments`),
      apiFetch<Array<{ id: string; text: string; createdAt: string; actor?: { name?: string } }>>(`/api/org/tasks/${task.id}/history`),
      apiFetch<Array<{ id: string; name: string; size: number | null; createdAt: string }>>(`/api/org/tasks/${task.id}/attachments`),
    ]).then(([commentsRows, historyRows, attachmentRows]) => {
      if (!active) return;
      const safeComments = Array.isArray(commentsRows) ? commentsRows : [];
      const safeHistory = Array.isArray(historyRows) ? historyRows : [];
      const safeAttachments = Array.isArray(attachmentRows) ? attachmentRows : [];
      setCommentsByTask((current) => ({
        ...current,
        [task.id]: safeComments.map((item) => ({
          id: item.id,
          author: item.author?.name ?? 'Người dùng',
          initials: initials(item.author?.name),
          time: formatLocalTimeHm(new Date(item.createdAt)),
          text: item.text,
        })),
      }));
      setHistoryByTask((current) => ({
        ...current,
        [task.id]: safeHistory.map((item) => ({
          id: item.id,
          text: item.text,
          time: formatLocalTimeHm(new Date(item.createdAt)),
        })),
      }));
      setAttachmentsByTask((current) => ({
        ...current,
        [task.id]: safeAttachments.map((item) => ({
          id: item.id,
          name: item.name,
          size: item.size ? `${Math.max(1, Math.round(item.size / 1024))} KB` : 'Tệp đính kèm',
        })),
      }));
    }).catch(() => {
      // Keep the existing task snapshot visible; mutation errors are surfaced
      // when the user submits a write.
    });
    return () => {
      active = false;
    };
  }, [task.id, task.isSample]);

  const assignee = task.detailAssigneeName ?? task.assigneeName;
  const due = formatDueDate(task.detailDueDate ?? task.dueDate);
  const baseAttachments = React.useMemo(() => task.attachments ?? [], [task.attachments]);
  const baseHistory = React.useMemo(
    () =>
      task.history ?? [
        { id: 'h-def-1', text: `${assignee} được phân công phụ trách`, time: due },
        { id: 'h-def-2', text: `Trạng thái hiện tại: ${task.status}`, time: task.updatedLabel ?? 'Hôm nay' },
      ],
    [task.history, task.status, task.updatedLabel, assignee, due],
  );

  React.useEffect(() => {
    const prev = prevStatusRef.current;
    if (prev.id === task.id && prev.status !== task.status) {
      const stamp = formatLocalTimeHm();
      const nextItem: TaskHistoryEntry = {
        id: `h-${Date.now()}`,
        text: `${currentUserName} đã chuyển trạng thái sang ${task.status}`,
        time: `Hôm nay · ${stamp}`,
      };
      setHistoryByTask((map) => {
        const current = map[task.id] ?? baseHistory;
        const nextList = [...current, nextItem];
        saveTaskExtras((stored) => ({
          ...stored,
          history: { ...stored.history, [task.id]: nextList },
        }));
        return { ...map, [task.id]: nextList };
      });
      if (process.env.NODE_ENV !== 'test' && !task.isSample && !task.id.startsWith('sample-')) {
        void apiFetch(`/api/org/tasks/${task.id}/history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: nextItem.text }),
        }).catch(() => {});
      }
    }
    prevStatusRef.current = { id: task.id, status: task.status };
  }, [task.id, task.status, currentUserName, baseHistory]);

  const comments = commentsByTask[task.id] ?? task.comments ?? DEFAULT_COMMENTS;
  const project = task.detailProject ?? task.project ?? 'QSystem Core';
  const dept = task.detailDepartment ?? task.departmentName ?? departmentName;
  const description =
    task.description ??
    'Kiểm tra hồ sơ xin nghỉ phép của nhân viên, đối chiếu chính sách và cập nhật kết quả phê duyệt.';
  const attachments = attachmentsByTask[task.id] ?? baseAttachments;
  const history = historyByTask[task.id] ?? baseHistory;

  function appendHistory(text: string) {
    const stamp = formatLocalTimeHm();
    const nextItem: TaskHistoryEntry = {
      id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text,
      time: `Hôm nay · ${stamp}`,
    };
    setHistoryByTask((map) => {
      const nextList = [...(map[task.id] ?? baseHistory), nextItem];
      saveTaskExtras((stored) => ({
        ...stored,
        history: { ...stored.history, [task.id]: nextList },
      }));
      return { ...map, [task.id]: nextList };
    });
  }

  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) {
      commentInputRef.current?.focus();
      return;
    }
    if (process.env.NODE_ENV !== 'test' && !task.isSample && !task.id.startsWith('sample-')) {
      try {
        await apiFetch(`/api/org/tasks/${task.id}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
      } catch {
        return;
      }
    }
    const time = formatLocalTimeHm();
    const next: TaskComment = {
      id: `c-${Date.now()}`,
      author: currentUserName,
      initials: initials(currentUserName),
      time,
      text,
    };
    const nextComments = [...comments, next];
    setCommentsByTask((prev) => ({
      ...prev,
      [task.id]: nextComments,
    }));
    saveTaskExtras((stored) => ({
      ...stored,
      comments: { ...stored.comments, [task.id]: nextComments },
    }));
    appendHistory(`${currentUserName} đã thêm bình luận mới`);
    setDraft('');
  }

  async function handleAttachFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!task.isSample && !task.id.startsWith('sample-')) {
      try {
        const key = `tasks/${task.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const presigned = await apiFetch<{ uploadUrl: string }>('/api/files/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bucket: 'qsystem-docs', key, size: file.size, mimeType: file.type || undefined }),
        });
        const uploaded = await fetch(presigned.uploadUrl, {
          method: 'PUT',
          headers: file.type ? { 'Content-Type': file.type } : undefined,
          body: file,
        });
        if (!uploaded.ok) throw new Error('FILE_UPLOAD_FAILED');
        await apiFetch(`/api/org/tasks/${task.id}/attachments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            storageKey: key,
            size: file.size,
            mimeType: file.type || undefined,
          }),
        });
      } catch {
        return;
      }
    }
    const sizeLabel =
      file.size >= 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.round(file.size / 1024))} KB`;
    const nextAttachments = [...attachments, { id: `att-${Date.now()}`, name: file.name, size: sizeLabel }];
    setAttachmentsByTask((prev) => ({
      ...prev,
      [task.id]: nextAttachments,
    }));
    saveTaskExtras((stored) => ({
      ...stored,
      attachments: { ...stored.attachments, [task.id]: nextAttachments },
    }));
    appendHistory(`${currentUserName} đã đính kèm ${file.name}`);
    event.target.value = '';
  }

  return (
    <>
      <section className="qtk-drawer__section" aria-label="Thông tin công việc">
        <h3>Thông tin công việc</h3>
        <dl className="qtk-info-list">
          <div className="qtk-info-row">
            <dt>Người phụ trách</dt>
            <dd>{assignee}</dd>
          </div>
          <div className="qtk-info-row">
            <dt>Thời hạn</dt>
            <dd>{due}</dd>
          </div>
          <div className="qtk-info-row">
            <dt>Dự án</dt>
            <dd>{project}</dd>
          </div>
          <div className="qtk-info-row">
            <dt>Phòng ban</dt>
            <dd>{dept}</dd>
          </div>
        </dl>
      </section>

      <hr className="qtk-drawer__divider" />

      <section className="qtk-drawer__section" aria-label="Mô tả">
        <h3>Mô tả</h3>
        <p className="qtk-drawer__desc">{description}</p>
      </section>

      <div className="qx-tabs qtk-drawer__tabs" role="tablist" aria-label="Nội dung chi tiết">
        <button
          type="button"
          role="tab"
          className="qx-tab"
          aria-selected={tab === 'trao-doi'}
          onClick={() => setTab('trao-doi')}
        >
          {`Trao đổi (${comments.length})`}
        </button>
        <button
          type="button"
          role="tab"
          className="qx-tab"
          aria-selected={tab === 'tep-dinh-kem'}
          onClick={() => setTab('tep-dinh-kem')}
        >
          Tệp đính kèm
        </button>
        <button
          type="button"
          role="tab"
          className="qx-tab"
          aria-selected={tab === 'lich-su'}
          onClick={() => setTab('lich-su')}
        >
          Lịch sử
        </button>
      </div>

      {tab === 'trao-doi' ? (
        <>
          <ul className="qtk-comments">
            {comments.map((comment) => (
              <li key={comment.id} className="qtk-comment">
                <span className="qx-avatar qx-avatar--sm qtk-avatar-cell" aria-hidden="true">
                  {comment.initials}
                </span>
                <div className="qtk-comment__body">
                  <div className="qtk-comment__head">
                    <span className="qtk-comment__author">{comment.author}</span>
                    <span className="qtk-comment__time">· {comment.time}</span>
                  </div>
                  <p className="qtk-comment__text">{comment.text}</p>
                </div>
              </li>
            ))}
          </ul>

          <form className="qtk-comment-form" onSubmit={submitComment}>
            <input
              ref={commentInputRef}
              type="text"
              className="qtk-input"
              aria-label="Viết bình luận"
              placeholder="Nhập nội dung bình luận"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" className="qtk-comment-send" aria-label="Gửi bình luận">
              <Send size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </form>
        </>
      ) : tab === 'tep-dinh-kem' ? (
        <div>
          <div className="qtk-attach-bar">
            <span className="qtk-drawer__empty">
              {attachments.length > 0 ? `${attachments.length} tệp đính kèm` : 'Chưa có tệp nào đính kèm'}
            </span>
            <input
              ref={attachInputRef}
              type="file"
              aria-label="Tải tệp đính kèm lên"
              hidden
              onChange={handleAttachFile}
            />
            <button
              type="button"
              className="qx-btn qx-btn--sm"
              onClick={() => attachInputRef.current?.click()}
            >
              <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
              Đính kèm tệp
            </button>
          </div>
          {attachments.length === 0 ? null : (
            <ul className="qtk-attach-list">
              {attachments.map((file) => (
                <li key={file.id} className="qtk-attach-item">
                  <span className="qx-person">
                    <Paperclip size={16} strokeWidth={1.5} aria-hidden="true" />
                    <span>{file.name}</span>
                  </span>
                  <span className="qtk-code">{file.size}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <ul className="qtk-history-list">
          {history.map((item) => (
            <li key={item.id} className="qtk-history-item">
              <span className="qx-person">
                <FileText size={16} strokeWidth={1.5} aria-hidden="true" />
                <span>{item.text}</span>
              </span>
              <span className="qtk-code">{item.time}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function TaskDetailFooter({
  task,
  onComplete,
  pending = false,
}: {
  task: TaskViewItem;
  onComplete: () => void;
  pending?: boolean;
}) {
  const done = task.status === 'Hoàn thành';
  return (
    <footer className="qtk-drawer__foot">
      <span className="qtk-drawer__updated">{task.updatedLabel ?? 'Cập nhật 2 giờ trước'}</span>
      <button
        type="button"
        className="qx-btn"
        onClick={onComplete}
        disabled={done || pending}
        aria-busy={pending}
      >
        <Check size={16} strokeWidth={1.5} aria-hidden="true" />
        {done ? 'Đã hoàn thành' : pending ? 'Đang lưu…' : 'Hoàn thành công việc'}
      </button>
    </footer>
  );
}

export interface TaskDetailDrawerProps {
  task: TaskViewItem | null;
  departmentName: string;
  pending: boolean;
  onClose: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onComplete: () => void;
  currentUserName?: string;
}

export function TaskDetailDrawer({
  task,
  departmentName,
  pending,
  onClose,
  onStatusChange,
  onComplete,
  currentUserName,
}: TaskDetailDrawerProps) {
  const drawerRef = React.useRef<HTMLElement>(null);
  useFloatingLayer(task !== null, onClose, true, { root: drawerRef, initialFocus: drawerRef });

  if (!task) return null;

  return (
    <>
      <div className="qtk-drawer-backdrop" aria-hidden="true" onClick={onClose} />
      <aside
        ref={drawerRef}
        className="qtk-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={task.title}
        tabIndex={-1}
      >
        <header className="qtk-drawer__head">
          <div className="qtk-drawer__top">
            <span className="qtk-drawer__crumb">{`QTask / ${task.code}`}</span>
            <button type="button" className="qx-icon-btn" aria-label="Đóng chi tiết" onClick={onClose}>
              <X size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
          <h2 className="qtk-drawer__title">{task.title}</h2>
          <div className="qtk-drawer__badges">
            <Select<TaskStatus>
              className="qtk-drawer__status-select"
              aria-label="Trạng thái"
              value={task.status}
              disabled={pending}
              controlSize="sm"
              options={TASK_STATUS_OPTIONS}
              onValueChange={onStatusChange}
            />
            <span className={getPriorityBadgeClass(task.priority)}>{task.priority ?? 'Ưu tiên cao'}</span>
          </div>
        </header>

        <div className="qtk-drawer__body">
          <TaskDetailContent
            task={task}
            departmentName={departmentName}
            pending={pending}
            onStatusChange={onStatusChange}
            currentUserName={currentUserName}
          />
        </div>

        <TaskDetailFooter task={task} pending={pending} onComplete={onComplete} />
      </aside>
    </>
  );
}
