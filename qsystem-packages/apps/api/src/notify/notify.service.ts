import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Notification } from '@prisma/client';
import { NotifyPayloadSchema, type NotifyPayload } from '@qsystem/contracts';
import { PrismaService, type ScopeViewer } from '../prisma/prisma.service';

/**
 * Outbox enqueue side. Validates the payload against the shared
 * `NotifyPayloadSchema` (@qsystem/contracts, shape pinned — R16) and persists
 * a single PENDING row.
 *
 * Transaction boundary note (local outbox, plan-approved): with BullMQ the
 * "same transaction boundary" would mean persisting the row AND pushing the
 * job inside one Prisma transaction. Here the persisted PENDING row IS the
 * job — enqueue is one write, and the worker polls PENDING rows. That makes
 * the persist/enqueue boundary atomic by construction (there is no second
 * system to fall out of sync), at the cost of poll latency instead of a push.
 * The NotifyWorker/NotifyService seam stays minimal so a real queue can
 * replace the poll later without touching callers.
 */
@Injectable()
export class NotifyService {
  constructor(
    // Explicit token — esbuild (vitest) does not emit decorator metadata.
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /** Validate + persist one PENDING outbox row (the enqueue write). */
  async enqueue(input: NotifyPayload): Promise<Notification> {
    const parsed = NotifyPayloadSchema.parse(input);
    // System write: runs on the unscoped qsystem_app connection, which the
    // notifications_worker RLS policy (migration 20261112090000) permits
    // exactly when no app.current_user_id identity is set — request-scoped
    // connections (forUser/runAsUser) keep the SELF/COMPANY policies only.
    return this.prisma.notification.create({
      data: {
        channel: parsed.channel,
        recipient: parsed.recipient,
        recipientId: parsed.recipientId ?? null,
        payload: (parsed.payload ?? undefined) as never,
        status: 'PENDING',
        tenantId: parsed.tenantId ?? null,
      },
    });
  }

  async listFor(viewer: ScopeViewer): Promise<Notification[]> {
    return this.prisma.forUser(viewer).notification.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async markRead(viewer: ScopeViewer, id: string): Promise<Notification> {
    const existing = await this.prisma.forUser(viewer).notification.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpException(
        { code: 'NOT_FOUND', message: 'Notification not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    return this.prisma.forUser(viewer).notification.update({
      where: { id },
      data: { readAt: existing.readAt ?? new Date() },
    });
  }

  async markAllRead(viewer: ScopeViewer): Promise<{ ok: true; count: number; readAt: string }> {
    const now = new Date();
    const res = await this.prisma.forUser(viewer).notification.updateMany({
      where: { recipientId: viewer.id, readAt: null },
      data: { readAt: now },
    });
    return { ok: true as const, count: res.count, readAt: now.toISOString() };
  }
}
