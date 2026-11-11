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

    // 4W guard on TASK mutation endpoints (stub layer — a real TASK table does
    // not exist yet). Missing any of what/who/when/where → 422 coded.
    if (req.path === '/org/tasks' && req.method === 'POST') {
      const body = req.body ?? {};
      const missing = FOUR_W.filter((key) => body[key] === undefined || body[key] === '');
      if (missing.length > 0) {
        throw error(
          'TASK_4W_INCOMPLETE',
          `TASK payload incomplete: missing ${missing.join(', ')}`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    // LDP guard: a MANAGER touching a DIRECT-flow TASK is monitor-only —
    // block the write, stamp an audit row, 403 coded.
    if (req.path.startsWith('/org/tasks/') && req.method === 'PATCH') {
      const body = (req.body ?? {}) as { flow?: unknown; action?: unknown };
      if (viewer?.role === 'MANAGER' && body.flow === 'DIRECT' && body.action !== 'read') {
        const entityId = req.path.split('/').pop() ?? 'unknown';
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
        if (viewer && req.method === 'GET' && req.path === '/org/users') {
          return from(
            this.abilities.abilityFor(viewer).then((ability) =>
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
