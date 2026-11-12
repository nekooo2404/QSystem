import { Controller, Get, Inject, UnauthorizedException } from '@nestjs/common';
import { CurrentUser } from '../iam/current-user.decorator';
import type { RequestViewer } from '../iam/iam.service';
import { AbilitiesFactory } from '../org/abilities.factory';
import { PrismaService, type ScopeViewer } from '../prisma/prisma.service';

/**
 * Offline-sync read: the caller's own notifications, newest first.
 * Scope chain (identical to OrgController's pattern):
 *   @CurrentUser() → AbilitiesFactory.resolveViewer → PrismaService.forUser,
 * so both the app-layer scope (notification → recipientId = viewer.id) and the
 * SQL RLS `notifications_self` policy gate every row. No POST endpoint —
 * enqueue is service/worker-side only.
 */
@Controller('notifications')
export class NotifyController {
  constructor(
    // Explicit tokens — esbuild (vitest) does not emit decorator metadata.
    @Inject(AbilitiesFactory) private readonly abilities: AbilitiesFactory,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(@CurrentUser() user: RequestViewer | undefined): Promise<
    Array<{
      id: string;
      channel: string;
      recipient: string;
      recipientId: string | null;
      payload: unknown;
      status: string;
      attempts: number;
      createdAt: Date;
    }>
  > {
    if (!user?.id) {
      // Guard normally 401s before this point; a missing viewer is still a
      // coded 401 here (never an unscoped read).
      throw new UnauthorizedException('UNAUTHORIZED');
    }
    const viewer: ScopeViewer = await this.abilities.resolveViewer({
      id: user.id,
      role: user.role,
    });
    const rows = await this.prisma
      .forUser(viewer)
      .notification.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((row) => ({
      id: row.id,
      channel: row.channel,
      recipient: row.recipient,
      recipientId: row.recipientId,
      payload: row.payload,
      status: row.status,
      attempts: row.attempts,
      createdAt: row.createdAt,
    }));
  }
}
