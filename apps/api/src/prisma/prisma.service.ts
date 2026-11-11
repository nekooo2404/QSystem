import 'dotenv/config';
import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaClient } from '@prisma/client';
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
        // unique-only `where` (no AND possible) → post-check. The mutation
        // may already have applied before we throw; Postgres RLS WITH CHECK
        // is the backstop for restricted-role deployments.
        return async (args?: Record<string, unknown>) => {
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
      return (...rest: unknown[]) => invoke.apply(dTarget, rest);
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
  }) as T & ScopedClient;
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
      // SET LOCAL inside an explicit txn; raw is only used here for the
      // bootstrap — never exposed to scoped consumers.
      await (tx as PrismaClient).$executeRawUnsafe(
        `SELECT set_config('app.current_user_id', '${userId.replace(/'/g, "''")}', true)`,
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
   * Read-side scoped client for an already-known viewer (no transaction).
   * The caller runs inside `runAsUser`/request middleware that set SET LOCAL;
   * the extension pins list filters to the same scope.
   */
  forUser(viewer: ScopeViewer): ScopedClient {
    const scoped = (this as PrismaClient).$extends(withScope(viewer));
    return withoutRaw(scoped as unknown as PrismaClient);
  }
}
