import { Injectable, Inject, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { NotifChannel } from '@prisma/client';
import type {
  NotificationProvider,
  NotificationSendInput,
} from './notification-provider.interface';

export interface NotificationStreamEvent {
  id: string;
  channel: NotifChannel;
  status: 'SENT';
  recipient: string;
  payload: unknown;
  createdAt: string;
}

/** Local Socket.IO gateway with in-process EventEmitter fan-out for SSE streams. */
@Injectable()
export class LocalSocketGateway implements NotificationProvider {
  readonly channel = 'SOCKET' as const;
  private readonly emitter = new EventEmitter();

  constructor(
    @Optional() @Inject('NOTIFY_LOGGER') private readonly log: (m: string) => void = console.log,
  ) {
    this.emitter.setMaxListeners(100);
  }

  subscribeUser(userId: string, listener: (event: NotificationStreamEvent) => void): () => void {
    const room = `user:${userId}`;
    this.emitter.on(room, listener);
    return () => {
      this.emitter.off(room, listener);
    };
  }

  async send(n: NotificationSendInput): Promise<void> {
    const room = n.recipientId ? `user:${n.recipientId}` : 'broadcast';
    this.log(`[notify:socket] emit /shell room=${room} payload=${JSON.stringify(n.payload ?? null)}`);
    const event: NotificationStreamEvent = {
      id: n.id ?? randomUUID(),
      channel: this.channel,
      status: 'SENT',
      recipient: n.recipient,
      payload: n.payload ?? null,
      createdAt: new Date().toISOString(),
    };
    if (n.recipientId) {
      this.emitter.emit(`user:${n.recipientId}`, event);
    } else {
      this.emitter.emit('broadcast', event);
    }
  }
}
