import { Inject, Injectable } from '@nestjs/common';
import { PrismaService, type ScopeViewer } from '../prisma/prisma.service';

/**
 * Request identity as attached by JwtAuthGuard (`request.user`).
 * Task 4 consumes this plus PrismaService.forUser (Task 2, zero-bug).
 */
export interface AbilityUser {
  id: string;
  role: 'DIRECTOR' | 'MANAGER' | 'EMPLOYEE';
  managedDepartmentIds: string[];
  departmentId?: string | null;
}

interface RuleCondition {
  $in?: unknown[];
}

type Conditions = Record<string, unknown>;

interface Rule {
  action: string | string[];
  subject: string | string[];
  conditions?: Conditions;
}

/**
 * Minimal hand-rolled Ability (brief allows this when `@casl/ability` is
 * unavailable — it is not installed). Supports `manage`/`all` wildcards and
 * `{ field: { $in: [...] } }` conditions evaluated against a plain object.
 * Conditions require an object to test: a bare subject string never satisfies
 * a conditional rule (so MANAGER `cannot('read', 'salary')`).
 */
export class Ability {
  constructor(private readonly rules: Rule[]) {}

  can(action: string, subject: string, obj?: Record<string, unknown>): boolean {
    return this.rules.some((rule) => {
      const actions = Array.isArray(rule.action) ? rule.action : [rule.action];
      const subjects = Array.isArray(rule.subject) ? rule.subject : [rule.subject];
      const actionOk = actions.includes('manage') || actions.includes(action);
      const subjectOk = subjects.includes('all') || subjects.includes(subject);
      if (!actionOk || !subjectOk) return false;
      if (!rule.conditions) return true;
      if (!obj || typeof obj !== 'object') return false;
      return Object.entries(rule.conditions).every(([key, cond]) => {
        if (
          cond &&
          typeof cond === 'object' &&
          !Array.isArray(cond) &&
          '$in' in (cond as Record<string, unknown>)
        ) {
          const list = (cond as RuleCondition).$in ?? [];
          return list.includes(obj[key]);
        }
        return obj[key] === cond;
      });
    });
  }

  cannot(action: string, subject: string, obj?: Record<string, unknown>): boolean {
    return !this.can(action, subject, obj);
  }
}

@Injectable()
export class AbilitiesFactory {
  // NOTE: explicit @Inject — vitest runs through esbuild, which does not emit
  // decorator metadata, so constructor-param DI needs explicit tokens.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Pure ability construction from an already-resolved viewer. */
  createFor(user: AbilityUser): Ability {
    if (user.role === 'DIRECTOR') {
      return new Ability([{ action: 'manage', subject: 'all' }]);
    }
    if (user.role === 'MANAGER') {
      // NOTE: conditions use CASL-style `$in` (what Ability.can evaluates) —
      // never Prisma-style `in`, which falls through to strict equality and
      // would deny every conditional MANAGER rule.
      const managed = { $in: user.managedDepartmentIds };
      return new Ability([
        { action: ['read', 'update'], subject: 'Department', conditions: { id: managed } },
        { action: ['read', 'update'], subject: 'User', conditions: { departmentId: managed } },
      ]);
    }
    return new Ability([
      { action: 'read', subject: 'User', conditions: { id: user.id } },
      // Own department only — threaded from resolveViewer (the old code
      // compared the department id against the *user* id, which can never
      // match a real department).
      ...(user.departmentId
        ? [{ action: 'read', subject: 'Department', conditions: { id: user.departmentId } }]
        : []),
    ]);
  }

  /**
   * Resolve the full ScopeViewer for a guard-attached identity (loads the
   * departments the user manages — mirrors the `me()` lookup in IamService).
   * Throws 401-coded when the user no longer exists.
   */
  async resolveViewer(viewer: { id: string; role: ScopeViewer['role'] }): Promise<ScopeViewer> {
    const row = await this.prisma.withIdentity(viewer.id, (tx) =>
      tx.user.findUnique({
        where: { id: viewer.id },
        select: {
          departmentId: true,
          managedDepartments: { select: { id: true } },
        },
      }),
    );
    return {
      id: viewer.id,
      role: viewer.role,
      managedDepartmentIds: row?.managedDepartments.map((d) => d.id) ?? [],
      departmentId: row?.departmentId ?? null,
    };
  }

  /** Ability for a guard-attached identity (resolves managed departments). */
  async abilityFor(viewer: { id: string; role: ScopeViewer['role'] }): Promise<Ability> {
    const resolved = await this.resolveViewer(viewer);
    return this.createFor({
      id: resolved.id,
      role: resolved.role,
      managedDepartmentIds: resolved.managedDepartmentIds,
      departmentId: resolved.departmentId,
    });
  }
}
