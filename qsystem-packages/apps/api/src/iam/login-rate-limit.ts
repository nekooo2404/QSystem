import { Inject, Injectable } from '@nestjs/common';
import { readSecretOrEnv } from '../config/env.config';
import { PrismaService } from '../prisma/prisma.service';
import { execRedisCommands } from './redis-resp.client';

/**
 * Login rate limiter (Task 3), shared across API instances via PostgreSQL
 * (default) or Redis (RATE_LIMIT_STORE=redis + REDIS_URL).
 *
 * - per-IP bucket: 5 attempts / 60s, every attempt consumes, never cleared
 *   early — spraying guesses across emails from one IP still trips it.
 * - per-account bucket (IP + lowercased email): 5 failures / 60s; a success
 *   clears it, so one account's failures never lock out others behind a NAT.
 */
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;
const IP_BUCKET = 'ip';
const ACCOUNT_BUCKET = 'account';
const REDIS_FIXED_WINDOW_LUA =
  "local c = redis.call('INCR', KEYS[1]); if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; return c";

@Injectable()
export class LoginRateLimiter {
  // Explicit token — esbuild (vitest) does not emit decorator metadata.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private redisUrl(): string | undefined {
    if (process.env.RATE_LIMIT_STORE?.trim().toLowerCase() !== 'redis') return undefined;
    return readSecretOrEnv('REDIS_URL');
  }

  /**
   * Decide and count one attempt atomically. Counting alone could not: 50
   * parallel requests all saw zero committed hits before any of them wrote,
   * so all 50 reached argon2. Advisory locks serialize attempts on the same
   * keys until commit, so at most MAX_ATTEMPTS password checks run per window.
   */
  async acquire(ip: string, accountKey: string): Promise<boolean> {
    const redisUrl = this.redisUrl();
    if (redisUrl) {
      return this.acquireRedis(redisUrl, ip, accountKey);
    }
    try {
      const since = new Date(Date.now() - WINDOW_MS);
      return await this.prisma.$transaction(async (tx) => {
        // Sorted so two keys always lock in the same order (no deadlock).
        for (const lockKey of [`ip:${ip}`, `account:${accountKey}`].sort()) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
        }
        // Prune only expired hits for the keys in hand, so the
        // (bucket, key, at) index serves this delete instead of a full scan.
        await tx.rateLimitHit.deleteMany({
          where: {
            bucket: { in: [IP_BUCKET, ACCOUNT_BUCKET] },
            key: { in: [ip, accountKey] },
            at: { lte: since },
          },
        });
        const [ipHits, accountHits] = await Promise.all([
          tx.rateLimitHit.count({ where: { bucket: IP_BUCKET, key: ip, at: { gt: since } } }),
          tx.rateLimitHit.count({ where: { bucket: ACCOUNT_BUCKET, key: accountKey, at: { gt: since } } }),
        ]);
        if (ipHits >= MAX_ATTEMPTS || accountHits >= MAX_ATTEMPTS) return false;
        await tx.rateLimitHit.create({ data: { bucket: IP_BUCKET, key: ip } });
        return true;
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('qsystem: rate limiter unavailable; rejecting attempt', err);
      return false;
    }
  }

  recordFailure(accountKey: string): Promise<void> {
    const redisUrl = this.redisUrl();
    if (redisUrl) {
      return this.write(() =>
        execRedisCommands(redisUrl, [
          ['EVAL', REDIS_FIXED_WINDOW_LUA, '1', `rl:acc:${accountKey}`, String(WINDOW_MS)],
        ]),
      );
    }
    return this.write(() => this.prisma.rateLimitHit.create({ data: { bucket: ACCOUNT_BUCKET, key: accountKey } }));
  }

  clearFailures(accountKey: string): Promise<void> {
    const redisUrl = this.redisUrl();
    if (redisUrl) {
      return this.write(() => execRedisCommands(redisUrl, [['DEL', `rl:acc:${accountKey}`]]));
    }
    return this.write(() => this.prisma.rateLimitHit.deleteMany({ where: { bucket: ACCOUNT_BUCKET, key: accountKey } }));
  }

  private async acquireRedis(redisUrl: string, ip: string, accountKey: string): Promise<boolean> {
    try {
      const [accRaw] = await execRedisCommands(redisUrl, [['GET', `rl:acc:${accountKey}`]]);
      const accCount = accRaw === null ? 0 : Number(accRaw);
      if (Number.isFinite(accCount) && accCount >= MAX_ATTEMPTS) {
        return false;
      }
      const [ipCount] = await execRedisCommands(redisUrl, [
        ['EVAL', REDIS_FIXED_WINDOW_LUA, '1', `rl:ip:${ip}`, String(WINDOW_MS)],
      ]);
      return Number(ipCount) <= MAX_ATTEMPTS;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('qsystem: redis rate limiter unavailable', err);
      return false;
    }
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
