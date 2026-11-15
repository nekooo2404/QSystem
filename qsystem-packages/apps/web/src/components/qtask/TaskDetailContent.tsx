'use client';

import * as React from 'react';
import { AttributeRowList, Button, UnderlineTabs } from '@qsystem/ui';
import { TASK_STATUSES, type Task, type TaskStatus } from '../../lib/adapters/tasks.adapter';

const PANEL_TABS = ['trao-doi', 'tep-dinh-kem'] as const;

interface ThreadEntry {
  id: string;
  author: string;
  body: string;
}

interface TaskDetailContentProps {
  task: Task;
  departmentName: string;
  pending: boolean;
  onStatusChange: (status: TaskStatus) => void;
}

function formatDue(due: string): string {
  const date = new Date(due);
  if (Number.isNaN(date.getTime())) return due;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function TaskDetailContent({ task, departmentName, onStatusChange, pending }: TaskDetailContentProps) {
  const [tab, setTab] = React.useState<(typeof PANEL_TABS)[number]>('trao-doi');
  // shortcut: the API has neither a comments nor a files table yet, so the
  // panel explains the empty state instead of pretending to store anything.
  const [thread] = React.useState<ThreadEntry[]>([]);

  return (
    <>
      <AttributeRowList
        items={[
          { id: 'assignee', label: 'Phụ trách', value: task.assigneeName },
          { id: 'due', label: 'Thời hạn', value: formatDue(task.dueDate) },
          { id: 'department', label: 'Phòng ban', value: departmentName },
          {
            id: 'status',
            label: 'Trạng thái',
            value: (
              <select
                className="qs-input qtk-status-select"
                aria-label="Trạng thái"
                value={task.status}
                disabled={pending}
                aria-busy={pending}
                onChange={(event) => onStatusChange(event.target.value as TaskStatus)}
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            ),
          },
        ]}
      />

      <div className="qtk-panel__tabs">
        <UnderlineTabs
          aria-label="Nội dung chi tiết"
          activeId={tab}
          onChange={(id) => setTab(id as (typeof PANEL_TABS)[number])}
          tabs={[
            { id: 'trao-doi', label: 'Trao đổi' },
            { id: 'tep-dinh-kem', label: 'Tệp đính kèm' },
          ]}
        />
      </div>

      {tab === 'trao-doi' ? (
        thread.length === 0 ? (
          <p className="qtk-panel__note">Chưa có trao đổi nào. Mọi ý kiến về việc này sẽ hiện ở đây.</p>
        ) : null
      ) : (
        <p className="qtk-panel__note">Chưa có tệp nào đính kèm vào việc này.</p>
      )}
    </>
  );
}

/** The drawer footer: secondary on purpose, `+ Giao việc` stays the amber CTA. */
export function TaskDetailFooter({ task, onComplete, pending = false }: { task: Task; onComplete: () => void; pending?: boolean }) {
  const done = task.status === 'Hoàn thành';
  return (
    <Button variant="secondary" onClick={onComplete} disabled={done || pending} loading={pending} loadingText="Đang lưu…" className="qtk-panel__complete">
      {done ? 'Đã hoàn thành' : 'Hoàn thành việc'}
    </Button>
  );
}
