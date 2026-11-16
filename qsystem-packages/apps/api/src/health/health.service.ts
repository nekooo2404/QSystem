import { Inject, Injectable } from '@nestjs/common';
import { getRuntimeEnv, readSecretOrEnv } from '../config/env.config';
import { PrismaService } from '../prisma/prisma.service';
import { meiliConfigFromEnv } from '../search/search.service';
import { signedHeaderRequest, s3ConfigFromEnv } from '../storage/sigv4';
import { execRedisCommands } from '../iam/redis-resp.client';

export interface DependencyCheck {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface ReadinessReport {
  ok: boolean;
  status: 'ready' | 'not_ready';
  env: string;
  checks: {
    database: DependencyCheck;
    s3: DependencyCheck;
    meilisearch: DependencyCheck;
    redis?: DependencyCheck;
  };
}

const PROBE_TIMEOUT_MS = 2000;

@Injectable()
export class HealthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  live(): { ok: true; status: 'live'; env: string; uptimeSec: number } {
    return {
      ok: true,
      status: 'live',
      env: getRuntimeEnv(),
      uptimeSec: Math.round(process.uptime()),
    };
  }

  async ready(): Promise<ReadinessReport> {
    const [database, s3, meilisearch, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkS3(),
      this.checkMeilisearch(),
      this.checkRedis(),
    ]);
    const redisRequired = process.env.RATE_LIMIT_STORE?.trim().toLowerCase() === 'redis';
    const ok = database.ok && s3.ok && meilisearch.ok && (!redisRequired || redis.ok);
    return {
      ok,
      status: ok ? 'ready' : 'not_ready',
      env: getRuntimeEnv(),
      checks: { database, s3, meilisearch, ...(redisRequired ? { redis } : {}) },
    };
  }

  private async checkDatabase(): Promise<DependencyCheck> {
    const start = Date.now();
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), PROBE_TIMEOUT_MS)),
      ]);
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error && err.message === 'TIMEOUT' ? 'TIMEOUT' : 'UNAVAILABLE',
      };
    }
  }

  private async checkS3(): Promise<DependencyCheck> {
    const start = Date.now();
    try {
      const cfg = s3ConfigFromEnv();
      const bucket = readSecretOrEnv('S3_BUCKET');
      if (!bucket) return { ok: false, latencyMs: Date.now() - start, error: 'MISCONFIGURED' };
      const signed = signedHeaderRequest(cfg, 'GET', `/${bucket}`, { 'list-type': '2', 'max-keys': '1' });
      const res = await fetch(signed.url, {
        method: signed.method,
        headers: signed.headers,
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (!res.ok) return { ok: false, latencyMs: Date.now() - start, error: `HTTP_${res.status}` };
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      const code = err instanceof Error && err.message.includes('required') ? 'MISCONFIGURED' : 'UNAVAILABLE';
      return { ok: false, latencyMs: Date.now() - start, error: code };
    }
  }

  private async checkRedis(): Promise<DependencyCheck> {
    const start = Date.now();
    if (process.env.RATE_LIMIT_STORE?.trim().toLowerCase() !== 'redis') {
      return { ok: true, latencyMs: 0 };
    }
    try {
      const url = process.env.REDIS_URL?.trim();
      if (!url) return { ok: false, latencyMs: Date.now() - start, error: 'MISCONFIGURED' };
      const [pong] = await execRedisCommands(url, [['PING']], PROBE_TIMEOUT_MS);
      return pong === 'PONG'
        ? { ok: true, latencyMs: Date.now() - start }
        : { ok: false, latencyMs: Date.now() - start, error: 'INVALID_RESPONSE' };
    } catch {
      return { ok: false, latencyMs: Date.now() - start, error: 'UNAVAILABLE' };
    }
  }

  private async checkMeilisearch(): Promise<DependencyCheck> {
    const start = Date.now();
    try {
      const cfg = meiliConfigFromEnv();
      const url = `${cfg.url.replace(/\/$/, '')}/health`;
      const res = await fetch(url, {
        method: 'GET',
        headers: cfg.masterKey ? { Authorization: `Bearer ${cfg.masterKey}` } : undefined,
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (!res.ok) {
        return {
          ok: false,
          latencyMs: Date.now() - start,
          error: res.status >= 500 ? 'HTTP_5XX' : 'HTTP_ERROR',
        };
      }
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      const code = err instanceof Error && err.message.includes('required') ? 'MISCONFIGURED' : 'UNAVAILABLE';
      return { ok: false, latencyMs: Date.now() - start, error: code };
    }
  }
}
