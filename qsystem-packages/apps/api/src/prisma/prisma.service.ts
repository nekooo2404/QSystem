import 'dotenv/config';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  isAllowed,
  scopeFor,
  type ScopeViewer,
} from './prisma-scope.extension';

/**
 * Request-scoped Prisma access with two cooperating layers:
 * 1. `runAsUser`/`forUser` both consult the AsyncLocalStorage ambient
 *    context and issue `SET LOCAL app.current_user_id` inside each
 *    transaction — Postgres RLS policies (migrations/*_shell_rls) keyed on
 *    `current_setting('app.current_user_id', true)` enforce scope at the SQL
 *    level, including RLS WITH CHECK on writes.
 * 2. List queries additionally carry app-level `where` filters mirroring the
 *    same SELF/DEPARTMENT/COMPANY rules (defense in depth; the interface
 *    Task 4/6/7 consume via `forUser`).
 *
 * IMPORTANT: scoped clients deliberately do NOT expose $queryRaw/$executeRaw —
 * any raw SQL path would bypass the extension layer, so `forUser`/`runAsUser`
 * throw on raw queries (RED test #4). RLS remains as the backstop for
 * direct SQL.
 */
export type { ScopeViewer };

const store = new AsyncLocalStorage<ScopeViewer | undefined>();

export function currentViewer(): ScopeViewer | undefined {
  return store.getStore();
}

export type ScopedClient = Omit<
  PrismaClient,
  '$queryRaw' | '$queryRawUnsafe' | '$executeRaw' | '$executeRawUnsafe' | '$queryRawTyped' | '$transaction'
> & {
  // Raw SQL is refused on scoped clients — never let raw queries bypass scope.
  $queryRaw: () => Promise<never>;
  $queryRawUnsafe: () => Promise<never>;
  $executeRaw: () => Promise<never>;
  $executeRawUnsafe: () => Promise<never>;
};

const RAW_REFUSED =
  'qsystem: raw queries are disabled on scoped clients (use ORM methods) — request scoped via PrismaService.forUser';

export const SCOPED_ACCESS_DENIED = 'qsystem: scoped access denied (RLS)';

type BaseModelName =
  | 'user'
  | 'department'
  | 'approvalDelegation'
  | 'auditLog'
  | 'notification'
  | 'file'
  | 'task';

type ModelName =
  | BaseModelName
  | 'socialPost'
  | 'socialComment'
  | 'socialPostLike'
  | 'refreshToken';

const BASE_MODELS = new Set<string>([
  'user',
  'department',
  'approvalDelegation',
  'auditLog',
  'notification',
  'file',
  'task',
]);

const MODELS: ModelName[] = [
  'user',
  'department',
  'approvalDelegation',
  'auditLog',
  'notification',
  'file',
  'task',
  'socialPost',
  'socialComment',
  'socialPostLike',
  'refreshToken',
];

const LIST_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

const SINGLE_READS = new Set(['findUnique', 'findUniqueOrThrow']);
const SINGLE_WRITES = new Set(['update', 'delete', 'upsert']);

type Where = Record<string, unknown>;

function andWhere(existing: Where | undefined, scope: Where | undefined): Where | undefined {
  if (!scope) return existing;
  if (!existing || Object.keys(existing).length === 0) return scope;
  return { AND: [existing, scope] };
}

/** Load the full ScopeViewer for a bare user id (the DB is the truth source). */
async function resolveViewer(tx: PrismaClient, userId: string): Promise<ScopeViewer> {
  const viewer = await tx.user.findUnique({
    where: { id: userId },
    include: { managedDepartments: { select: { id: true } } },
  });
  return {
    id: userId,
    role: (viewer?.role ?? 'EMPLOYEE') as ScopeViewer['role'],
    managedDepartmentIds: viewer?.managedDepartments.map((d) => d.id) ?? [],
    departmentId: viewer?.departmentId ?? null,
  };
}

function resolvedScopeFor(model: ModelName, viewer: ScopeViewer): Where | undefined {
  if (BASE_MODELS.has(model)) {
    return scopeFor(model as BaseModelName, viewer) as Where | undefined;
  }
  if (model === 'refreshToken') {
    return { userId: viewer.id };
  }
  if (viewer.role === 'DIRECTOR') return undefined;
  if (model === 'socialPost') {
    return viewer.role === 'MANAGER'
      ? {
          OR: [
            { authorId: viewer.id },
            { departmentId: null },
            { departmentId: { in: viewer.managedDepartmentIds } },
          ],
        }
      : {
          OR: [
            { authorId: viewer.id },
            { departmentId: null },
            ...(viewer.departmentId ? [{ departmentId: viewer.departmentId }] : []),
          ],
        };
  }
  const postScope = resolvedScopeFor('socialPost', viewer);
  if (model === 'socialComment') {
    return { OR: [{ authorId: viewer.id }, { post: postScope }] };
  }
  if (model === 'socialPostLike') {
    return { OR: [{ userId: viewer.id }, { post: postScope }] };
  }
  return undefined;
}

function resolvedIsAllowed(
  model: ModelName,
  viewer: ScopeViewer,
  row: Record<string, unknown>,
  op: 'read' | 'write',
): boolean {
  if (BASE_MODELS.has(model)) {
    return isAllowed(model as BaseModelName, viewer, row);
  }
  if (model === 'refreshToken') {
    return row.userId === viewer.id;
  }
  if (viewer.role === 'DIRECTOR') return true;
  if (model === 'socialPost') {
    if (op === 'write') {
      if (row.authorId === viewer.id) return true;
      return (
        viewer.role === 'MANAGER' &&
        typeof row.departmentId === 'string' &&
        viewer.managedDepartmentIds.includes(row.departmentId)
      );
    }
    if (row.authorId === viewer.id || row.departmentId === null) return true;
    if (viewer.role === 'MANAGER') {
      return (
        typeof row.departmentId === 'string' &&
        viewer.managedDepartmentIds.includes(row.departmentId)
      );
    }
    return Boolean(viewer.departmentId) && row.departmentId === viewer.departmentId;
  }
  if (model === 'socialComment') {
    if (op === 'write') return row.authorId === viewer.id;
    if (row.authorId === viewer.id) return true;
    const post = row.post as Record<string, unknown> | undefined;
    return !post || resolvedIsAllowed('socialPost', viewer, post, 'read');
  }
  if (model === 'socialPostLike') {
    if (op === 'write') return row.userId === viewer.id;
    if (row.userId === viewer.id) return true;
    const post = row.post as Record<string, unknown> | undefined;
    return !post || resolvedIsAllowed('socialPost', viewer, post, 'read');
  }
  return false;
}

function pinScopedCreateData(model: ModelName, viewer: ScopeViewer, data: Where): Where {
  if ((model === 'file' || model === 'task') && viewer.role === 'EMPLOYEE') {
    return { ...data, ownerId: viewer.id };
  }
  if ((model === 'socialPost' || model === 'socialComment') && viewer.role === 'EMPLOYEE') {
    return { ...data, authorId: viewer.id };
  }
  if (model === 'refreshToken' || (model === 'socialPostLike' && viewer.role !== 'DIRECTOR')) {
    return { ...data, userId: viewer.id };
  }
  return data;
}

/**
 * Generic scope wrapper around any Prisma model delegate (base or
 * interactive-transaction client — Prisma 5 tx clients lack `$extends`,
 * so scoping is applied here explicitly instead of via client extensions).
 */
function scopedDelegate<T extends object>(delegate: T, model: ModelName, viewer: ScopeViewer): T {
  return new Proxy(delegate, {
    get(dTarget, dProp, _dReceiver) {
      const value = Reflect.get(dTarget as object, dProp as string | symbol) as unknown;
      if (typeof value !== 'function' || typeof dProp !== 'string') return value;
      const invoke = value as (args?: unknown) => Promise<unknown>;
      const bound = (args?: Record<string, unknown>) =>
        invoke.call(dTarget, args);

      if (LIST_OPS.has(dProp)) {
        return (args?: Record<string, unknown>) =>
          bound({ ...(args ?? {}), where: andWhere(args?.where as Where | undefined, resolvedScopeFor(model, viewer)) });
      }
      if (SINGLE_READS.has(dProp)) {
        return async (args?: Record<string, unknown>) => {
          const row = (await bound(args)) as Record<string, unknown> | null;
          if (row && !resolvedIsAllowed(model, viewer, row, 'read')) {
            if (dProp.endsWith('OrThrow')) throw new Error(SCOPED_ACCESS_DENIED);
            return null;
          }
          return row;
        };
      }
      if (SINGLE_WRITES.has(dProp)) {
        // Pre-check BEFORE mutating: re-read the row via its unique `where`
        // and run isAllowed. A hidden-or-missing row is denied outright (no
        // existence oracle; nothing is applied when out of scope). Postgres
        // RLS WITH CHECK stays as the SQL-level backstop.
        return async (args?: Record<string, unknown>) => {
          if (dProp === 'update' || dProp === 'delete') {
            // Pre-image read through the UNSCOPED delegate, then isAllowed —
            // throws before anything is applied.
            const finder = (
              dTarget as unknown as { findUnique: (a: unknown) => Promise<unknown> }
            ).findUnique;
            const pre = await finder.call(dTarget, { where: args?.where });
            if (!pre || !resolvedIsAllowed(model, viewer, pre as Record<string, unknown>, 'write')) {
              throw new Error(SCOPED_ACCESS_DENIED);
            }
            return bound(args);
          }
          // dProp === 'upsert': pre-check BEFORE mutating. The upsert `where`
          // is always unique, so findUnique on it is the right pre-image probe.
          // Existing-but-out-of-scope row → throw, nothing applied. No
          // pre-image → insert path: pin owner exactly like `create`, then run.
          const finder = (
            dTarget as unknown as { findUnique: (a: unknown) => Promise<unknown> }
          ).findUnique;
          const pre = await finder.call(dTarget, { where: args?.where });
          if (pre) {
            if (!resolvedIsAllowed(model, viewer, pre as Record<string, unknown>, 'write')) {
              throw new Error(SCOPED_ACCESS_DENIED);
            }
          } else if (args?.create && typeof args.create === 'object' && !Array.isArray(args.create)) {
            return bound({
              ...args,
              create: pinScopedCreateData(model, viewer, args.create as Where),
            });
          }
          const row = (await bound(args)) as Record<string, unknown> | null;
          if (row && !resolvedIsAllowed(model, viewer, row, 'write')) throw new Error(SCOPED_ACCESS_DENIED);
          return row;
        };
      }
      if (dProp === 'create' || dProp === 'createMany') {
        return (args?: Record<string, unknown>) => {
          // Non-privileged actors cannot spoof owner/author/user fields.
          if (args?.data && typeof args.data === 'object' && !Array.isArray(args.data)) {
            return bound({ ...args, data: pinScopedCreateData(model, viewer, args.data as Where) });
          }
          return bound(args);
        };
      }
      return (...rest: unknown[]) => (invoke as (...a: unknown[]) => unknown).apply(dTarget, rest);
    },
  });
}

/**
 * Wrap a transaction client: scope every model delegate, refuse raw SQL.
 * `allowRaw` stays true only for the internal SET LOCAL bootstrap query.
 */
function scopedTx(tx: PrismaClient, viewer: ScopeViewer): PrismaClient {
  const refuse = () => Promise.reject(new Error(RAW_REFUSED));
  return new Proxy(tx, {
    get(tTarget, tProp, _tReceiver) {
      if (
        tProp === '$queryRaw' ||
        tProp === '$queryRawUnsafe' ||
        tProp === '$executeRaw' ||
        tProp === '$executeRawUnsafe' ||
        tProp === '$queryRawTyped'
      ) {
        return refuse;
      }
      const value = Reflect.get(tTarget as object, tProp as string | symbol) as unknown;
      if (
        typeof tProp === 'string' &&
        (MODELS as string[]).includes(tProp) &&
        value &&
        typeof value === 'object'
      ) {
        return scopedDelegate(value as object, tProp as ModelName, viewer);
      }
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(tTarget) : value;
    },
  });
}

export class PrismaService extends PrismaClient implements OnModuleDestroy {
  /**
   * Run `fn` with `viewer` as ambient context AND `SET LOCAL
   * app.current_user_id` active, so both the scope layer and the RLS
   * policies see the same user. Wraps everything in a transaction so
   * SET LOCAL is scoped to that transaction (pg SET LOCAL semantics).
   *
   * Pass the ScopeViewer when the caller already has it (forUser, services) —
   * that skips the user lookup. A bare id keeps the old behaviour and loads
   * the viewer from the DB.
   */
  async runAsUser<T>(viewer: ScopeViewer | string, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    const userId = typeof viewer === 'string' ? viewer : viewer.id;
    return this.$transaction(async (tx) => {
      // SET LOCAL inside an explicit txn; parameterized via Prisma.sql —
      // no string interpolation of the user id. Raw is only used here for
      // the bootstrap — never exposed to scoped consumers.
      await (tx as PrismaClient).$executeRaw(
        Prisma.sql`SELECT set_config('app.current_user_id', ${userId}, true)`,
      );
      const scoped = typeof viewer === 'string' ? await resolveViewer(tx as PrismaClient, viewer) : viewer;
      return store.run(scoped, () => fn(scopedTx(tx as PrismaClient, scoped)));
    });
  }

  /**
   * Scoped client for an already-known viewer. Every model operation runs
   * inside its own transaction with `SET LOCAL app.current_user_id`, so the
   * Postgres RLS policies always see the request identity (the client holds
   * a pool, and SET LOCAL is transaction-scoped — there is no safe
   * session-level alternative). The scope layer pins the same SELF/
   * DEPARTMENT/COMPANY filters on top.
   *
   * Raw SQL stays refused on the returned client (test #4); the sql-level
   * negative test pins RLS directly via interactive transactions.
   */
  forUser(viewer: ScopeViewer): ScopedClient {
    const self = this;
    const refuse = () => Promise.reject(new Error(RAW_REFUSED));
    const ops = (model: ModelName) =>
      new Proxy(
        {},
        {
          get(_oTarget, op) {
            if (typeof op !== 'string') return undefined;
            // Scope is applied once, by the scoped delegate inside runAsUser;
            // the already-resolved viewer skips the second user lookup.
            return (args?: Record<string, unknown>) =>
              self.runAsUser(viewer, async (tx) => {
                const delegate = (tx as unknown as Record<string, Record<string, (a: unknown) => Promise<unknown>>>)[
                  model
                ];
                return delegate[op](args);
              });
          },
        },
      );
    return {
      user: ops('user'),
      department: ops('department'),
      approvalDelegation: ops('approvalDelegation'),
      auditLog: ops('auditLog'),
      notification: ops('notification'),
      file: ops('file'),
      task: ops('task'),
      socialPost: ops('socialPost'),
      socialComment: ops('socialComment'),
      socialPostLike: ops('socialPostLike'),
      refreshToken: ops('refreshToken'),
      // Raw SQL entry points exist only to refuse: scoped work must go
      // through the ORM delegates above, never raw queries.
      $queryRaw: refuse,
      $queryRawUnsafe: refuse,
      $executeRaw: refuse,
      $executeRawUnsafe: refuse,
      $queryRawTyped: refuse,
    } as unknown as ScopedClient;
  }

  /**
   * Run `fn` with `SET LOCAL app.current_user_id` active WITHOUT app-layer
   * scope filters — for identity-owned writes where withScope would add
   * filters the schema has no columns for (e.g. refresh_tokens). Postgres RLS
   * policies still enforce the self/company boundary at the SQL level, and
   * pre-identity reads go through SECURITY DEFINER functions only.
   */
  async withIdentity<T>(userId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT set_config('app.current_user_id', ${userId}, true)`,
      );
      return fn(tx);
    });
  }

  /** Pre-identity lookup via SECURITY DEFINER — never queries users directly. */
  async lookupIdentity(email: string): Promise<{ id: string; password_hash: string; role: string; department_id: string | null }[]> {
    return this.$queryRaw<{ id: string; password_hash: string; role: string; department_id: string | null }[]>`
      SELECT * FROM auth_user_lookup(${email})
    `;
  }

  /** Pre-identity refresh-token lookup via DEFINER — never queries table directly. */
  async lookupRefresh(tokenHash: string): Promise<{ id: string; user_id: string; expires_at: Date | string; revoked_at: Date | string | null; replaced_by_id: string | null }[]> {
    return this.$queryRaw<{ id: string; user_id: string; expires_at: Date | string; revoked_at: Date | string | null; replaced_by_id: string | null }[]>`
      SELECT * FROM auth_refresh_lookup(${tokenHash})
    `;
  }

  /** Allocate a sequential human-readable task code (CV-1001...). */
  async nextTaskCode(): Promise<string> {
    const rows = await this.$queryRaw<Array<{ code: bigint | number }>>`
      SELECT nextval('task_code_seq') AS code
    `;
    return `CV-${rows[0].code}`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
