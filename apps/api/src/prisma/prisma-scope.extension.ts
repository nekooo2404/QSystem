import { Prisma } from '@prisma/client';

// Scope descriptor attached to the ambient request context.
// Kept minimal on purpose: role + the departments a MANAGER directly manages.
// DIRECTOR implies company scope (no department list needed); EMPLOYEE sees own rows.
export type ScopeRole = 'DIRECTOR' | 'MANAGER' | 'EMPLOYEE';

export interface ScopeViewer {
  id: string;
  role: ScopeRole;
  managedDepartmentIds: string[];
  departmentId?: string | null;
}

export const SCOPED_ACCESS_DENIED =
  'qsystem: scoped access denied (RLS)';

type ModelName =
  | 'user'
  | 'department'
  | 'approvalDelegation'
  | 'auditLog'
  | 'notification'
  | 'file';

type Where = Record<string, unknown>;
type Row = Record<string, unknown>;

function andWhere(
  existing: Where | undefined,
  scope: Where | undefined,
): Where | undefined {
  if (!scope) return existing;
  if (!existing || Object.keys(existing).length === 0) return scope;
  return { AND: [existing, scope] };
}

/**
 * Read/write scope filter per model, mirroring the SQL RLS policies in
 * prisma/migrations/02_shell_rls/migration.sql:
 * - SELF: owner/actor/recipient row belongs to the viewer
 * - DEPARTMENT: row sits in a department the viewer manages
 * - COMPANY: DIRECTOR bypass (no filter)
 * `users`/`departments` stay readable without context (login org lookup);
 * every other table denies by default when no viewer applies.
 */
export function scopeFor(model: ModelName, viewer: ScopeViewer): Where | undefined {
  if (viewer.role === 'DIRECTOR') return undefined;
  const managed = { in: viewer.managedDepartmentIds };

  switch (model) {
    case 'file':
      return viewer.role === 'MANAGER'
        ? { departmentId: managed }
        : { ownerId: viewer.id };
    case 'notification':
      return { recipientId: viewer.id };
    case 'auditLog':
      return viewer.role === 'MANAGER'
        ? {
            OR: [
              { actorId: viewer.id },
              { actor: { departmentId: managed } },
            ],
          }
        : { actorId: viewer.id };
    case 'approvalDelegation':
      return { OR: [{ fromUserId: viewer.id }, { toUserId: viewer.id }] };
    case 'user':
      return viewer.role === 'MANAGER'
        ? { OR: [{ id: viewer.id }, { departmentId: managed }] }
        : viewer.departmentId
          ? { OR: [{ id: viewer.id }, { departmentId: viewer.departmentId }] }
          : { id: viewer.id };
    case 'department':
      return viewer.role === 'MANAGER'
        ? { id: managed }
        : viewer.departmentId
          ? { id: viewer.departmentId }
          : { id: '__none__' };
  }
}

/** Row-level check used after single-row reads/writes (findUnique/update/delete). */
export function isAllowed(model: ModelName, viewer: ScopeViewer, row: Row): boolean {
  if (viewer.role === 'DIRECTOR') return true;
  const managed = viewer.managedDepartmentIds;

  switch (model) {
    case 'file':
      return viewer.role === 'MANAGER'
        ? typeof row.departmentId === 'string' && managed.includes(row.departmentId)
        : row.ownerId === viewer.id;
    case 'notification':
      return row.recipientId === viewer.id;
    case 'auditLog': {
      if (row.actorId === viewer.id) return true;
      if (viewer.role !== 'MANAGER') return false;
      const actor = row.actor as Row | undefined;
      return (
        !!actor &&
        typeof actor.departmentId === 'string' &&
        managed.includes(actor.departmentId)
      );
    }
    case 'approvalDelegation':
      return row.fromUserId === viewer.id || row.toUserId === viewer.id;
    case 'user':
      if (row.id === viewer.id) return true;
      if (typeof row.departmentId !== 'string') return false;
      return viewer.role === 'MANAGER'
        ? managed.includes(row.departmentId)
        : row.departmentId === viewer.departmentId;
    case 'department':
      return viewer.role === 'MANAGER'
        ? row.id !== undefined && managed.includes(row.id as string)
        : row.id === viewer.departmentId;
  }
}

interface QueryHookArgs {
  args: { where?: Where; data?: unknown } & Record<string, unknown>;
  query: (args: unknown) => Promise<unknown>;
}

function denyIfOutOfScope(model: ModelName, viewer: ScopeViewer, row: unknown): unknown {
  if (row && typeof row === 'object' && !isAllowed(model, viewer, row as Row)) {
    throw new Error(SCOPED_ACCESS_DENIED);
  }
  return row;
}

/**
 * Prisma client extension enforcing scope on every ORM operation.
 * Raw queries ($queryRaw/$executeRaw) are NOT intercepted here — the scoped
 * client wrapper (PrismaService.forUser) refuses them outright so raw SQL can
 * never bypass scope; Postgres RLS policies remain as defense-in-depth for
 * direct SQL connections (see migrations/02_shell_rls).
 */
export function withScope(viewer: ScopeViewer) {
  const LIST_OPS = [
    'findMany',
    'findFirst',
    'findFirstOrThrow',
    'count',
    'aggregate',
    'groupBy',
  ];
  const SINGLE_READS = ['findUnique', 'findUniqueOrThrow'];
  const SINGLE_WRITES = ['update', 'delete', 'upsert'];
  const MODELS: ModelName[] = [
    'user',
    'department',
    'approvalDelegation',
    'auditLog',
    'notification',
    'file',
  ];

  const hooksFor = (model: ModelName): Record<string, (hook: QueryHookArgs) => Promise<unknown>> => {
    const hooks: Record<string, (hook: QueryHookArgs) => Promise<unknown>> = {};

    for (const op of LIST_OPS) {
      hooks[op] = async ({ args, query }) =>
        query({ ...(args ?? {}), where: andWhere(args?.where, scopeFor(model, viewer)) });
    }
    // updateMany/deleteMany accept filter `where` — same treatment.
    for (const op of ['updateMany', 'deleteMany']) {
      hooks[op] = async ({ args, query }) =>
        query({ ...(args ?? {}), where: andWhere(args?.where, scopeFor(model, viewer)) });
    }
    for (const op of SINGLE_READS) {
      hooks[op] = async ({ args, query }) => {
        const row = await query(args);
        if (row && !isAllowed(model, viewer, row as Row)) {
          if (op.endsWith('OrThrow')) throw new Error(SCOPED_ACCESS_DENIED);
          return null;
        }
        return row;
      };
    }
    // update/delete/upsert take unique-only `where` (no AND possible) → post-check.
    // Known limitation: the mutation may already have applied before we throw;
    // Postgres RLS WITH CHECK is the backstop for restricted-role deployments.
    for (const op of SINGLE_WRITES) {
      hooks[op] = async ({ args, query }) =>
        denyIfOutOfScope(model, viewer, await query(args));
    }
    hooks.create = async ({ args, query }) => {
      // EMPLOYEE uploads always belong to the uploader — never spoofable.
      if (
        model === 'file' &&
        viewer.role === 'EMPLOYEE' &&
        args?.data &&
        typeof args.data === 'object' &&
        !Array.isArray(args.data)
      ) {
        return query({
          ...args,
          data: { ...(args.data as Where), ownerId: viewer.id },
        });
      }
      return query(args);
    };
    return hooks;
  };

  return Prisma.defineExtension((client) =>
    client.$extends({
      query: {
        user: hooksFor('user'),
        department: hooksFor('department'),
        approvalDelegation: hooksFor('approvalDelegation'),
        auditLog: hooksFor('auditLog'),
        notification: hooksFor('notification'),
        file: hooksFor('file'),
      },
    }),
  );
}
