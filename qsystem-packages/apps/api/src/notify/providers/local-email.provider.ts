import { Inject, Injectable } from '@nestjs/common';
import type { NotifChannel } from '@prisma/client';
import {
  NotificationSendInput,
  NotificationProvider,
} from './notification-provider.interface';

/**
 * Local/dev EMAIL adapter. Mode "ok" logs the message (console — no SMTP, no
 * credentials, no network); mode "fail" always throws so tests can drive the
 * retry/dead-letter path deterministically without real infrastructure.
 *
 * A production provider (nodemailer or an API-based sender) would implement
 * the same NotificationProvider interface — this class is the seam.
 */
@Injectable()
export class LocalEmailProvider implements NotificationProvider {
  readonly channel: NotifChannel = 'EMAIL';

  /** Diagnostic log of every send attempt (success or failure). */
  readonly calls: Array<{ recipient: string; subject?: string }> = [];

  /** "ok" delivers (logs); "fail" simulates a provider outage. */
  mode: 'ok' | 'fail' = 'ok';

  constructor(
    // Explicit token — esbuild (vitest) does not emit decorator metadata.
    @Inject('NOTIFY_LOGGER') private readonly log: (message: string) => void,
  ) {}

  async send(input: NotificationSendInput): Promise<void> {
    const subject =
      typeof input.payload?.subject === 'string' ? input.payload.subject : undefined;
    this.calls.push({ recipient: input.recipient, subject });
    if (this.mode === 'fail') {
      throw new Error('local email provider simulated outage');
    }
    this.log(
      `[notify:email] to=${input.recipient}${subject ? ` subject=${JSON.stringify(subject)}` : ''}`,
    );
  }
}
