import 'dotenv/config';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  isAllowed,
  scopeFor,
  type ScopeViewer,
  withScope,
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

type ModelName =
  | 'user'
  | 'department'
  | 'approvalDelegation'
  | 'auditLog'
  | 'notification'
  | 'file';

const MODELS: ModelName[] = [
  'user',
  'department',
  'approvalDelegation',
  'auditLog',
  'notification',
  'file',
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
          bound({ ...(args ?? {}), where: andWhere(args?.where as Where | undefined, scopeFor(model, viewer) as Where | undefined) });
      }
      if (SINGLE_READS.has(dProp)) {
        return async (args?: Record<string, unknown>) => {
          const row = (await bound(args)) as Record<string, unknown> | null;
          if (row && !isAllowed(model, viewer, row)) {
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
            if (!pre || !isAllowed(model, viewer, pre as Record<string, unknown>)) {
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
            if (!isAllowed(model, viewer, pre as Record<string, unknown>)) {
              throw new Error(SCOPED_ACCESS_DENIED);
            }
          } else if (
            model === 'file' &&
            viewer.role === 'EMPLOYEE' &&
            args?.create &&
            typeof args.create === 'object' &&
            !Array.isArray(args.create)
          ) {
            return bound({
              ...args,
              create: { ...(args.create as Where), ownerId: viewer.id },
            });
          }
          const row = (await bound(args)) as Record<string, unknown> | null;
          if (row && !isAllowed(model, viewer, row)) throw new Error(SCOPED_ACCESS_DENIED);
          return row;
        };
      }
      if (dProp === 'create' || dProp === 'createMany') {
        return (args?: Record<string, unknown>) => {
          // EMPLOYEE uploads always belong to the uploader — never spoofable.
          if (
            model === 'file' &&
            viewer.role === 'EMPLOYEE' &&
            args?.data &&
            typeof args.data === 'object' &&
            !Array.isArray(args.data)
          ) {
            return bound({ ...args, data: { ...(args.data as Where), ownerId: viewer.id } });
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

function withoutRaw<T extends object>(client: T): T & ScopedClient {
  const refuse = () => Promise.reject(new Error(RAW_REFUSED));
  return Object.assign(client, {
    $queryRaw: refuse,
    $queryRawUnsafe: refuse,
    $executeRaw: refuse,
    $executeRawUnsafe: refuse,
    $queryRawTyped: refuse,
  }) as unknown as T & ScopedClient;
}

export class PrismaService extends PrismaClient {
  /**
   * Run `fn` with `viewer` as ambient context AND `SET LOCAL
   * app.current_user_id` active, so both the scope layer and the RLS
   * policies see the same user. Wraps everything in a transaction so
   * SET LOCAL is scoped to that transaction (pg SET LOCAL semantics).
   */
  async runAsUser<T>(userId: string, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      // SET LOCAL inside an explicit txn; parameterized via Prisma.sql —
      // no string interpolation of the user id. Raw is only used here for
      // the bootstrap — never exposed to scoped consumers.
      await (tx as PrismaClient).$executeRaw(
        Prisma.sql`SELECT set_config('app.current_user_id', ${userId}, true)`,
      );
      const viewer = await (tx as PrismaClient).user.findUnique({
        where: { id: userId },
        include: { managedDepartments: { select: { id: true } } },
      });
      const scoped: ScopeViewer = {
        id: userId,
        role: (viewer?.role ?? 'EMPLOYEE') as ScopeViewer['role'],
        managedDepartmentIds: viewer?.managedDepartments.map((d) => d.id) ?? [],
        departmentId: viewer?.departmentId ?? null,
      };
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
            if (
              op === '$queryRaw' ||
              op === '$queryRawUnsafe' ||
              op === '$executeRaw' ||
              op === '$executeRawUnsafe' ||
              op === '$queryRawTyped'
            ) {
              return refuse;
            }
            return (args?: Record<string, unknown>) =>
              self.runAsUser(viewer.id, async (tx) => {
                const delegate = (tx as unknown as Record<string, Record<string, (a: unknown) => Promise<unknown>>>)[
                  model
                ];
                if (LIST_OPS.has(op)) {
                  return delegate[op]({
                    ...(args ?? {}),
                    where: andWhere(args?.where as Where | undefined, scopeFor(model, viewer) as Where | undefined),
                  });
                }
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
      // Raw SQL entry points exist only to refuse: scoped work must go
      // through the ORM delegates above, never raw queries.
      $queryRaw: refuse,
      $queryRawUnsafe: refuse,
      $executeRaw: refuse,
      $executeRawUnsafe: refuse,
      $queryRawTyped: refuse,
    } as unknown as ScopedClient;
  }
}
