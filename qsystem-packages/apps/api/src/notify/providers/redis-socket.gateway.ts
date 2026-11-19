import { Injectable, Inject, Optional, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import type { NotifChannel } from '@prisma/client';
import type { NotificationProvider, NotificationSendInput } from './notification-provider.interface';

export interface NotificationStreamEvent {
  id: string;
  channel: NotifChannel;
  status: 'SENT';
  recipient: string;
  recipientId?: string;
  payload: unknown;
  createdAt: string;
}

type Listener = (event: NotificationStreamEvent) => void;

const CHANNEL = 'qsystem:notifications';

/** Redis-backed notification fan-out shared by every API replica. */
@Injectable()
export class RedisSocketGateway implements NotificationProvider, OnModuleDestroy {
  readonly channel = 'SOCKET' as const;
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly publisher: Redis | null;
  private readonly subscriber: Redis | null;
  private subscribed = false;

  constructor(
    @Optional() @Inject('NOTIFY_LOGGER') private readonly log: (m: string) => void = console.log,
  ) {
    const url = process.env.REDIS_URL?.trim();
    if (!url) {
      this.publisher = null;
      this.subscriber = null;
      return;
    }
    this.publisher = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: null });
    this.subscriber = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: null });
    this.subscriber.on('message', (_channel, raw) => this.dispatch(raw));
    this.subscriber.subscribe(CHANNEL).then(() => {
      this.subscribed = true;
    }).catch((error: unknown) => {
      this.log(`[notify:redis] subscribe failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  subscribeUser(userId: string, listener: Listener): () => void {
    const current = this.listeners.get(userId) ?? new Set<Listener>();
    current.add(listener);
    this.listeners.set(userId, current);
    return () => {
      current.delete(listener);
      if (current.size === 0) this.listeners.delete(userId);
    };
  }

  async send(input: NotificationSendInput): Promise<void> {
    const event: NotificationStreamEvent = {
      id: input.id ?? randomUUID(),
      channel: this.channel,
      status: 'SENT',
      recipient: input.recipient,
      recipientId: input.recipientId ?? undefined,
      payload: input.payload ?? null,
      createdAt: new Date().toISOString(),
    };
    if (!this.publisher) {
      this.dispatch(JSON.stringify(event));
      return;
    }
    await this.publisher.publish(CHANNEL, JSON.stringify(event));
  }

  onModuleDestroy(): void {
    if (this.publisher) void this.publisher.quit();
    if (this.subscriber) void this.subscriber.quit();
    this.listeners.clear();
  }

  private dispatch(raw: string): void {
    let event: NotificationStreamEvent;
    try {
      event = JSON.parse(raw) as NotificationStreamEvent;
    } catch {
      this.log('[notify:redis] ignored malformed notification event');
      return;
    }
    if (event.recipientId) {
      for (const listener of this.listeners.get(event.recipientId) ?? []) listener(event);
      return;
    }
    for (const listeners of this.listeners.values()) {
      for (const listener of listeners) listener(event);
    }
  }
}
