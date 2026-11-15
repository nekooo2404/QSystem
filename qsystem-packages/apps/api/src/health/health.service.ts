import { Inject, Injectable } from '@nestjs/common';
import { getRuntimeEnv } from '../config/env.config';
import { PrismaService } from '../prisma/prisma.service';
import { meiliConfigFromEnv } from '../search/search.service';
import { s3ConfigFromEnv } from '../storage/sigv4';

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
    const [database, s3, meilisearch] = await Promise.all([
      this.checkDatabase(),
      this.checkS3(),
      this.checkMeilisearch(),
    ]);
    const ok = database.ok && s3.ok && meilisearch.ok;
    return {
      ok,
      status: ok ? 'ready' : 'not_ready',
      env: getRuntimeEnv(),
      checks: { database, s3, meilisearch },
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
      const url = `${cfg.endpoint.replace(/\/$/, '')}/`;
      const res = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (res.status >= 500) {
        return { ok: false, latencyMs: Date.now() - start, error: 'HTTP_5XX' };
      }
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      const code = err instanceof Error && err.message.includes('required') ? 'MISCONFIGURED' : 'UNAVAILABLE';
      return { ok: false, latencyMs: Date.now() - start, error: code };
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
