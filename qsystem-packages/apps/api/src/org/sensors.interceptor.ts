import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { from, mergeMap, type Observable } from 'rxjs';
import { TaskPayload4WSchema } from '@qsystem/contracts';
import { AbilitiesFactory } from './abilities.factory';
import { filterSalaryList } from './field-filter.util';
import { PrismaService } from '../prisma/prisma.service';

function error(code: string, message: string, status: HttpStatus): HttpException {
  return new HttpException({ code, message }, status);
}

// 4W payload fields — validated at the generic payload layer (stub; no TASK
// table exists yet per Ruling R6, the real entity belongs to the QTask spec).
const FOUR_W = ['what', 'who', 'when', 'where'] as const;

@Injectable()
export class SensorsInterceptor implements NestInterceptor {
  // NOTE: explicit @Inject — vitest runs through esbuild, which does not emit
  // decorator metadata, so constructor-param DI needs explicit tokens.
  constructor(
    @Inject(AbilitiesFactory) private readonly abilities: AbilitiesFactory,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<{
      user?: { id: string; role: 'DIRECTOR' | 'MANAGER' | 'EMPLOYEE' };
      body?: Record<string, unknown>;
      method: string;
      path: string;
    }>();
    const viewer = req.user;

    // Express routes both /org/tasks and /org/tasks/ to the same handler;
    // exact string compares missed the trailing-slash form, which bypassed
    // every guard below. Normalise before matching.
    const cleanPath = req.path.replace(/\/+$/, '') || '/';

    // 4W guard on TASK mutation endpoints (stub layer — a real TASK table does
    // not exist yet). Schema parse (not a blank/undefined spot-check) so any
    // malformed 4W payload is rejected the same way at both paths.
    if (cleanPath === '/org/tasks' && req.method === 'POST') {
      const parsed = TaskPayload4WSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        const missing = FOUR_W.filter(
          (key) => (req.body ?? {})[key] === undefined || (req.body ?? {})[key] === '',
        );
        throw error(
          'TASK_4W_INCOMPLETE',
          `TASK payload incomplete: missing ${missing.length > 0 ? missing.join(', ') : 'valid what/who/when/where'}`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    // LDP guard: a MANAGER touching a DIRECT-flow TASK is monitor-only —
    // block the write, stamp an audit row, 403 coded. `action: 'read'` is NOT
    // an exemption: PATCH is a write regardless of the body's label.
    if (cleanPath.startsWith('/org/tasks/') && req.method === 'PATCH') {
      const body = (req.body ?? {}) as { flow?: unknown; action?: unknown };
      if (viewer?.role === 'MANAGER' && body.flow === 'DIRECT') {
        const entityId = cleanPath.split('/').pop() ?? 'unknown';
        await this.prisma.withIdentity(viewer.id, (tx) =>
          tx.auditLog.create({
            data: {
              actorId: viewer.id,
              action: 'FLOW2_BLOCKED',
              entity: 'TASK',
              entityId,
              tenantId: null,
            },
          }),
        );
        throw error(
          'FLOW2_MONITOR_ONLY',
          'LDP monitors direct-flow TASKs; modification is blocked',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    return next.handle().pipe(
      // mergeMap + from: the salary lookup is async — plain map would emit a
      // Promise object into the JSON response instead of the filtered rows.
      mergeMap((data) => {
        if (viewer && req.method === 'GET' && cleanPath === '/org/users') {
          // Salary visibility depends on the role alone: DIRECTOR has
          // manage/all, MANAGER and EMPLOYEE have no salary rule. Building the
          // ability from `req.user` avoids a third user query per request.
          const ability = this.abilities.createFor({
            id: viewer.id,
            role: viewer.role,
            managedDepartmentIds: [],
          });
          return from(
            Promise.resolve(
              filterSalaryList(
                (data ?? []) as Record<string, unknown>[],
                ability.can('read', 'salary'),
              ),
            ),
          );
        }
        return from(Promise.resolve(data));
      }),
    );
  }
}
