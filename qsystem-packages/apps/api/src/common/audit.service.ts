import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditWriteInput {
  actorId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  oldData?: unknown;
  newData?: unknown;
}

/**
 * Audit service (Task 9): the single writer for `audit_logs`.
 *
 * Writes run inside `withIdentity(actorId, ...)` so the RLS INSERT policy
 * (`actor_id = current_setting('app.current_user_id')`) sees the stamped
 * actor — the authenticated actor may only append rows naming themselves.
 * Reads stay wherever the caller's scope already is (owner-oracle in tests,
 * scoped client elsewhere); this service only writes.
 */
@Injectable()
export class AuditService {
  // Explicit token — esbuild (vitest) does not emit decorator metadata.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async writeAudit(input: AuditWriteInput): Promise<void> {
    await this.prisma.withIdentity(input.actorId, async (tx) => {
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: input.action,
          entity: input.entity,
          ...(input.entityId ? { entityId: input.entityId } : {}),
          ...(input.oldData !== undefined ? { oldData: input.oldData as object } : {}),
          ...(input.newData !== undefined ? { newData: input.newData as object } : {}),
          tenantId: null,
        },
      });
    });
  }
}
