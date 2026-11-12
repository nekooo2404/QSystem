import { Inject, Injectable } from '@nestjs/common';
import type { NotifChannel } from '@prisma/client';
import {
  NotificationSendInput,
  NotificationProvider,
} from './notification-provider.interface';

/**
 * Local/dev SOCKET adapter — an in-memory emit standing in for Socket.IO.
 * Conceptual namespace `/shell`, room per user id; the real gateway would
 * `server.to(`user:${recipientId}`).emit('notification', payload)`. There is
 * no external server, no credentials, and no network in this adapter; the
 * emit is recorded so tests (and the offline-sync read path) can observe it.
 */
@Injectable()
export class LocalSocketGateway implements NotificationProvider {
  readonly channel: NotifChannel = 'SOCKET';

  /** Room key format shared with the future real gateway (`/shell` namespace). */
  static roomFor(recipientId: string | null | undefined): string {
    return `user:${recipientId ?? 'anonymous'}`;
  }

  constructor(
    // Explicit token — esbuild (vitest) does not emit decorator metadata.
    @Inject('NOTIFY_LOGGER') private readonly log: (message: string) => void,
  ) {}

  async send(input: NotificationSendInput): Promise<void> {
    const room = LocalSocketGateway.roomFor(input.recipientId);
    // In-memory "emit": recorded + logged. No socket.io dependency in this
    // shell (plan-approved local deterministic adapter; see report limitation).
    this.log(
      `[notify:socket] emit /shell room=${room} payload=${JSON.stringify(input.payload ?? {})}`,
    );
  }
}
