import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Login rate limiter (Task 3), Postgres-backed so every API instance shares
 * one budget (was a per-process Map).
 *
 * - per-IP bucket: 5 attempts / 60s, every attempt consumes, never cleared
 *   early — spraying guesses across emails from one IP still trips it.
 * - per-account bucket (IP + lowercased email): 5 failures / 60s; a success
 *   clears it, so one account's failures never lock out others behind a NAT.
 *
 * Fail-open with a log on DB errors: a dead DB already breaks login itself.
 */
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class LoginRateLimiter {
  // Explicit token — esbuild (vitest) does not emit decorator metadata.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async isLimited(ip: string, accountKey: string): Promise<boolean> {
    try {
      const since = new Date(Date.now() - WINDOW_MS);
      await this.prisma.rateLimitHit.deleteMany({ where: { at: { lte: since } } });
      const [ipHits, accountHits] = await Promise.all([
        this.prisma.rateLimitHit.count({ where: { bucket: 'ip', key: ip, at: { gt: since } } }),
        this.prisma.rateLimitHit.count({ where: { bucket: 'account', key: accountKey, at: { gt: since } } }),
      ]);
      return ipHits >= MAX_ATTEMPTS || accountHits >= MAX_ATTEMPTS;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('qsystem: rate limiter unavailable; allowing attempt', err);
      return false;
    }
  }

  recordAttempt(ip: string): Promise<void> {
    return this.write(() => this.prisma.rateLimitHit.create({ data: { bucket: 'ip', key: ip } }));
  }

  recordFailure(accountKey: string): Promise<void> {
    return this.write(() => this.prisma.rateLimitHit.create({ data: { bucket: 'account', key: accountKey } }));
  }

  clearFailures(accountKey: string): Promise<void> {
    return this.write(() => this.prisma.rateLimitHit.deleteMany({ where: { bucket: 'account', key: accountKey } }));
  }

  private async write(op: () => Promise<unknown>): Promise<void> {
    try {
      await op();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('qsystem: rate limiter write failed', err);
    }
  }
}

export function loginLimitKey(ip: string, email: string): string {
  return `${ip}::${(email ?? '').toLowerCase()}`;
}

/** Test-only: wipe shared limiter state between assertions. */
export async function resetLoginLimits(prisma: { rateLimitHit: { deleteMany: () => Promise<unknown> } }): Promise<void> {
  await prisma.rateLimitHit.deleteMany();
}
