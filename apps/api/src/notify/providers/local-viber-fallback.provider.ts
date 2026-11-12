import { Inject, Injectable } from '@nestjs/common';
import type { NotifChannel } from '@prisma/client';
import {
  NotificationSendInput,
  NotificationSendResult,
  NotificationProvider,
} from './notification-provider.interface';

/**
 * Local/dev VIBER adapter. Real Viber delivery needs a bot token + service
 * URL; neither exists in this shell, so a recipient without a viber user id
 * falls back to email delivery. The fallback is made durable: the provider
 * returns a note that the worker persists into the row's payload, so the
 * offline sync (`GET /notifications`) shows why delivery went by email.
 *
 * A production ViberClient would implement NotificationProvider with the same
 * shape; the fallback contract (note text) stays the same.
 */
@Injectable()
export class LocalViberFallbackProvider implements NotificationProvider {
  readonly channel: NotifChannel = 'VIBER';

  constructor(
    // Explicit token — esbuild (vitest) does not emit decorator metadata.
    @Inject('NOTIFY_LOGGER') private readonly log: (message: string) => void,
  ) {}

  async send(input: NotificationSendInput): Promise<NotificationSendResult> {
    const viberId = input.payload?.['viber_user_id'];
    if (typeof viberId === 'string' && viberId.length > 0) {
      // Placeholder for a real Viber send (bot token lives in env, never in
      // source). Local/dev always takes the fallback path; kept behind a
      // payload flag so the contract is visible without credentials.
      this.log(`[notify:viber] to=${viberId} (local stub, no external call)`);
      return { fellBack: false };
    }
    this.log(
      `[notify:viber] no viber_user_id for recipient=${input.recipient} — falling back to email`,
    );
    return {
      fellBack: true,
      note: 'viber fallback: no viber_user_id in payload; delivered via email',
    };
  }
}
