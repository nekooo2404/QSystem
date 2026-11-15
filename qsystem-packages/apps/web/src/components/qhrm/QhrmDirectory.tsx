'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { Button, DataTable, StateRegion, toast } from '@qsystem/ui';
import type { DataTableColumn } from '@qsystem/ui';
import type { MeResponse } from '@qsystem/contracts';
import { apiFetch, ApiError } from '../../lib/api/client';
import { humanizeApiError } from '../../lib/errors/humanize';
import { formatRole } from '../../lib/adapters/notifications.adapter';
import { CreateUserModal } from './CreateUserModal';

interface Department {
  id: string;
  name: string;
}

interface OrgUser {
  id: string;
  email: string;
  name: string;
  role: MeResponse['role'];
  departmentId: string | null;
  reportsToId: string | null;
}

interface Row {
  user: OrgUser;
  managerName: string;
}

/**
 * Neither a job title nor an employment status exists in the schema
 * (schema.prisma User: email/name/role/department/reportsTo). The columns stay
 * so the layout matches the reference; the cells say so instead of inventing
 * data. Wire them up when the API grows the fields.
 */
const NO_DATA = 'Chưa có dữ liệu';
const NO_MANAGER = 'Chưa xác định';

function toRows(users: OrgUser[]): Row[] {
  const byId = new Map(users.map((user) => [user.id, user]));
  return users.map((user) => ({
    user,
    managerName: user.reportsToId ? (byId.get(user.reportsToId)?.name ?? NO_MANAGER) : NO_MANAGER,
  }));
}

export function QhrmDirectory({ me }: { me: MeResponse }) {
  const [departments, setDepartments] = React.useState<Department[] | null>(null);
  const [users, setUsers] = React.useState<OrgUser[] | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    setLoadError(null);
    Promise.all([
      apiFetch<Department[]>('/api/org/departments'),
      apiFetch<OrgUser[]>('/api/org/users'),
    ]).then(
      ([departmentList, userList]) => {
        if (!active) return;
        setDepartments(departmentList);
        setUsers(userList);
      },
      (error: unknown) => {
        if (!active) return;
        setLoadError(
          humanizeApiError(
            error instanceof ApiError ? error.code : undefined,
            error instanceof ApiError ? error.status : undefined,
          ),
        );
      },
    );
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const canManage = me.role === 'DIRECTOR' || me.role === 'MANAGER';

  if (loadError) {
    return (
      <StateRegion
        state="error"
        errorDescription={loadError}
        onRetry={() => setReloadKey((key) => key + 1)}
      />
    );
  }

  if (departments === null || users === null) {
    return (
      <div className="qs-qhrm">
        <StateRegion state="loading" rows={6} />
      </div>
    );
  }

  const rows = toRows(
    selectedId === null ? users : users.filter((user) => user.departmentId === selectedId),
  );
  const selectedName =
    selectedId === null ? 'Toàn công ty' : (departments.find((d) => d.id === selectedId)?.name ?? 'Toàn công ty');

  const columns: DataTableColumn<Row>[] = [
    {
      id: 'name',
      header: 'Họ tên',
      accessor: (row) => <span className="qs-qhrm__name">{row.user.name}</span>,
      sortable: true,
    },
    { id: 'title', header: 'Chức danh', accessor: () => <span className="qs-qhrm__empty-cell">{NO_DATA}</span> },
    {
      id: 'role',
      header: 'Vai trò',
      accessor: (row) => <span className="qs-qhrm__role">{formatRole(row.user.role)}</span>,
    },
    { id: 'manager', header: 'Quản lý trực tiếp', accessor: (row) => row.managerName },
    {
      id: 'status',
      header: 'Tình trạng',
      accessor: () => <span className="qs-qhrm__empty-cell">{NO_DATA}</span>,
    },
  ];

  function addPerson() {
    setCreating(true);
  }

  return (
    <section className="qs-qhrm" aria-label="Nhân sự">
      <div className="qs-qhrm__head">
        <h1>Nhân sự · {selectedName}</h1>
        {canManage ? (
          <Button onClick={addPerson}>
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            Thêm nhân sự
          </Button>
        ) : null}
      </div>

      <div className="qs-qhrm__body">
        <nav aria-label="Phòng ban" className="qs-qhrm__depts">
          <button
            type="button"
            className={selectedId === null ? 'qs-qhrm__dept is-active' : 'qs-qhrm__dept'}
            aria-pressed={selectedId === null}
            onClick={() => setSelectedId(null)}
          >
            <span>Toàn công ty</span>
            <span className="qs-qhrm__dept-count">{users.length}</span>
          </button>
          {departments.map((department) => (
            <button
              key={department.id}
              type="button"
              className={selectedId === department.id ? 'qs-qhrm__dept is-active' : 'qs-qhrm__dept'}
              aria-pressed={selectedId === department.id}
              onClick={() => setSelectedId(department.id)}
            >
              <span>{department.name}</span>
              <span className="qs-qhrm__dept-count">
                {users.filter((user) => user.departmentId === department.id).length}
              </span>
            </button>
          ))}
        </nav>

        <div className="qs-qhrm__table">
          <DataTable
            data={rows}
            columns={columns}
            caption={`Danh bạ nhân sự — ${selectedName}`}
            getRowKey={(row) => row.user.id}
            emptyMessage="Chưa có nhân sự nào trong phòng ban này."
          />
        </div>
      </div>

      {canManage ? (
        <CreateUserModal
          open={creating}
          onOpenChange={setCreating}
          me={me}
          departments={departments}
          onCreated={(created) => {
            setUsers((current) => [created, ...(current ?? []).filter((entry) => entry.id !== created.id)]);
            toast.success(`Đã thêm nhân sự ${created.name}`);
          }}
        />
      ) : null}
    </section>
  );
}
