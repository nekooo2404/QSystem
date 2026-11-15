import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { isProductionLike } from '../config/env.config';

export interface HttpHardeningOptions {
  bodyLimit?: string;
  logger?: (line: string) => void;
}

export interface HardenedRequest extends Request {
  requestId?: string;
}

const REQUEST_ID_RE = /^[A-Za-z0-9._-]{1,128}$/;

export function parseCorsOrigins(raw: string | undefined = process.env.CORS_ORIGINS): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Apply baseline HTTP hardening to an Express-backed Nest application:
 * - disable X-Powered-By
 * - X-Request-Id correlation + structured JSON completion logs (never logging headers/body/secrets)
 * - Helmet-equivalent security headers (including HSTS in staging/production)
 * - JSON/urlencoded body size limits returning coded 413 PAYLOAD_TOO_LARGE
 * - Strict allowlisted CORS when CORS_ORIGINS is configured (same-origin proxy default otherwise)
 */
export function applyHttpHardening(
  app: NestExpressApplication,
  options: HttpHardeningOptions = {},
): void {
  const productionLike = isProductionLike();
  const bodyLimit = options.bodyLimit ?? (process.env.BODY_LIMIT?.trim() || '1mb');
  const writeLog = options.logger ?? ((line: string) => console.log(line));
  const shouldLogRequests = Boolean(options.logger) || process.env.NODE_ENV !== 'test' || process.env.STRUCTURED_HTTP_LOGS === 'true';

  app.disable('x-powered-by');

  const trustProxy = process.env.TRUST_PROXY?.trim();
  if (trustProxy) {
    if (trustProxy === 'true') {
      app.set('trust proxy', 1);
    } else if (/^\d+$/.test(trustProxy)) {
      app.set('trust proxy', Number(trustProxy));
    } else {
      app.set('trust proxy', trustProxy);
    }
  }

  app.use((req: HardenedRequest, res: Response, next: NextFunction) => {
    const incoming = req.headers['x-request-id'];
    const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
    const requestId =
      typeof candidate === 'string' && REQUEST_ID_RE.test(candidate.trim())
        ? candidate.trim()
        : randomUUID();
    req.requestId = requestId;

    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    if (productionLike) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    if (shouldLogRequests) {
      const startedNs = process.hrtime.bigint();
      res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startedNs) / 1_000_000;
        const rawUrl = req.originalUrl || req.url || '/';
        const pathOnly = rawUrl.split('?')[0];
        writeLog(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: res.statusCode >= 500 ? 'error' : 'info',
            type: 'http_request',
            requestId,
            method: req.method,
            path: pathOnly,
            status: res.statusCode,
            durationMs: Number(durationMs.toFixed(2)),
          }),
        );
      });
    }

    next();
  });

  app.useBodyParser('json', { limit: bodyLimit });
  app.useBodyParser('urlencoded', { extended: true, limit: bodyLimit });

  // Catch body-parser errors (413 payload too large, 400 malformed JSON)
  // before Nest route resolution so responses keep the coded error contract.
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (!err || typeof err !== 'object') {
      next(err);
      return;
    }
    const candidate = err as { type?: unknown; status?: unknown; statusCode?: unknown };
    if (candidate.type === 'entity.too.large' || candidate.status === 413 || candidate.statusCode === 413) {
      res.status(413).json({
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload too large',
      });
      return;
    }
    if (
      err instanceof SyntaxError &&
      (candidate.type === 'entity.parse.failed' || candidate.status === 400 || candidate.statusCode === 400)
    ) {
      res.status(400).json({
        code: 'BAD_REQUEST',
        message: 'Malformed JSON body',
      });
      return;
    }
    next(err);
  });

  const allowedOrigins = parseCorsOrigins();
  if (allowedOrigins.length > 0) {
    app.enableCors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
    });
  }
}

