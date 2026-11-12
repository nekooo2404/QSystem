import type { NotifChannel } from '@prisma/client';

/**
 * A delivery adapter for one notification channel. The outbox worker selects
 * the provider whose `channel` matches the row's channel; there is exactly one
 * provider per channel in the default module wiring.
 *
 * Implementations are local/dev-only for Task 6: no real SMTP, Viber, or
 * Socket.IO server, no credentials, no outbound network calls.
 */
export interface NotificationSendInput {
  /** Destination address/identifier as stored on the outbox row. */
  recipient: string;
  /** Recipient user id when known (drives socket rooms / viber lookup). */
  recipientId?: string | null;
  /** Row payload; providers may read it (e.g. viber user id). */
  payload?: Record<string, unknown> | null;
}

/**
 * Optional provider outcome. A plain `Promise<void>` send is the contract;
 * a provider that switched channels (VIBER → email fallback) may also return
 * a note, which the worker persists into the row payload so offline readers
 * can see why delivery took the other path.
 */
export interface NotificationSendResult {
  fellBack?: boolean;
  note?: string;
}

export interface NotificationProvider {
  /** Channel this provider delivers (EMAIL | VIBER | SOCKET). */
  readonly channel: NotifChannel;
  /**
   * Attempt delivery. Throw to signal failure — the worker counts the attempt
   * and dead-letters the row after 3 failed attempts.
   */
  send(input: NotificationSendInput): Promise<NotificationSendResult | void>;
}
