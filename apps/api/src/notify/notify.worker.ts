import { Inject, Injectable } from '@nestjs/common';
import type { Notification } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  NotificationProvider,
  NotificationSendInput,
  NotificationSendResult,
} from './providers/notification-provider.interface';

/** Retry budget: a row is attempted at most 3 times, then dead-lettered. */
export const MAX_ATTEMPTS = 3;

/**
 * Poll-based local outbox worker (plan-approved deterministic adapter in
 * place of BullMQ/Redis, which are not installed). Each `tick()` processes
 * eligible PENDING rows once — tests call tick() directly; no timers/intervals
 * live in this class, so the scheduler decision stays with the host process.
 *
 * Per row: pick the provider matching the row's channel, try delivery.
 * - success → status SENT (attempts already incremented by the claim)
 * - failure → attempts+1; attempts reaching MAX_ATTEMPTS → status DEAD
 *   (dead-letter). A 4th tick never touches a DEAD row: the eligibility
 *   filter (status=PENDING AND attempts<MAX_ATTEMPTS) excludes it, so
 *   attempts can never exceed 3.
 *
 * Interruption safety: the claim (`attempts+1` write) is committed BEFORE the
 * provider runs. A crash mid-delivery leaves a PENDING row with attempts>0,
 * which the next tick (or the next process) picks up again from the DB —
 * no in-memory state to lose.
 */
@Injectable()
export class NotifyWorker {
  constructor(
    // Explicit tokens — esbuild (vitest) does not emit decorator metadata.
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject('NOTIFY_PROVIDERS') private readonly providers: NotificationProvider[],
  ) {}

  /** One poll pass over eligible PENDING outbox rows. */
  async tick(): Promise<void> {
    // R23: reap zombies first. A crash (or DB error) between the attempt-3
    // claim and the catch-block bookkeeping leaves PENDING rows with
    // attempts >= MAX_ATTEMPTS that the eligibility filter below can never
    // pick up — without this sweep they stay PENDING forever. Dead-lettering
    // is bookkeeping only: no provider call for reaped rows.
    await this.prisma.notification.updateMany({
      where: { status: 'PENDING', attempts: { gte: MAX_ATTEMPTS } },
      data: { status: 'DEAD' },
    });
    const rows = await this.prisma.notification.findMany({
      where: { status: 'PENDING', attempts: { lt: MAX_ATTEMPTS } },
      orderBy: { createdAt: 'asc' },
    });
    for (const row of rows) {
      await this.processRow(row);
    }
  }

  /** Claim (attempts+1) → deliver → SENT or retry/DEAD bookkeeping. */
  private async processRow(row: Notification): Promise<void> {
    const claimed = await this.prisma.notification.updateMany({
      where: { id: row.id, status: 'PENDING', attempts: row.attempts },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count === 0) {
      return; // raced with another tick — next pass re-reads fresh state
    }
    const attempts = row.attempts + 1;
    const input: NotificationSendInput = {
      recipient: row.recipient,
      recipientId: row.recipientId,
      payload: (row.payload ?? null) as Record<string, unknown> | null,
    };
    try {
      const outcome = (await this.deliver(row, input)) as NotificationSendResult | undefined;
      if (outcome?.note) {
        await this.prisma.notification.update({
          where: { id: row.id },
          data: {
            status: 'SENT',
            payload: { ...((row.payload ?? {}) as Record<string, unknown>), worker_note: outcome.note },
          },
        });
      } else {
        await this.prisma.notification.update({
          where: { id: row.id },
          data: { status: 'SENT' },
        });
      }
    } catch {
      // Delivery failed: consume one retry. Out of budget → dead-letter.
      // Best-effort (R23): a bookkeeping failure here must not swallow the
      // verdict or mask the provider error — the tick-start reaper is the
      // backstop that dead-letters this row on the next pass.
      const nextStatus = attempts >= MAX_ATTEMPTS ? 'DEAD' : 'PENDING';
      try {
        await this.prisma.notification.update({
          where: { id: row.id },
          data: { status: nextStatus },
        });
      } catch {
        // Left PENDING with attempts >= MAX — reaped to DEAD by the next tick.
      }
    }
  }

  /** Route to the provider for this row's channel. */
  private async deliver(
    row: Notification,
    input: NotificationSendInput,
  ): Promise<NotificationSendResult | undefined> {
    const provider = this.providers.find((p) => p.channel === row.channel);
    if (!provider) {
      // Unroutable channel is a permanent failure, not a retryable outage.
      throw new Error(`no provider for channel ${row.channel}`);
    }
    return (await provider.send(input)) as NotificationSendResult | undefined;
  }
}
