import {
  ArgumentsHost,
  Catch,
  ExceptionFilter as NestExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

interface CodedBody {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Global error standard (Task 9): every unhandled error leaves the API as a
 * coded body `{code, message, details?}` — never Nest's default
 * `{statusCode, message}` shape and never a raw Prisma/Zod blob.
 *
 * Mapping:
 * - HttpException carrying an object body with `code` → passed through
 *   verbatim (the codebase's existing coded errors: UNAUTHORIZED 401,
 *   INVALID_BUCKET 400, CONFLICT 409, NOT_FOUND 404, ... stay byte-identical).
 * - HttpException with a string/plain body → 400 coded BAD_REQUEST.
 * - Zod (detected by name — zod is a contracts-only transitive dep, mirroring
 *   the search.controller check) → 422 VALIDATION.
 * - Prisma known request errors → P2002: 409 CONFLICT; P2025: 404 NOT_FOUND;
 *   anything else: 500 INTERNAL.
 * - Anything else → 500 INTERNAL with a generic message (no stack, no
 *   internal details leave the process).
 */
@Catch()
export class ExceptionFilter implements NestExceptionFilter {
  // Explicit token — esbuild (vitest) does not emit decorator metadata.
  constructor() {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<{
      status: (code: number) => { json: (body: unknown) => unknown };
      json: (body: unknown) => unknown;
    }>();
    const req = http.getRequest<
      { requestId?: string; method?: string; originalUrl?: string; url?: string } | undefined
    >();

    const mapped = this.map(exception);
    if (mapped.status >= 500) {
      const rawUrl = req?.originalUrl || req?.url || '';
      const pathOnly = rawUrl ? rawUrl.split('?')[0] : undefined;
      const errObj = exception instanceof Error ? exception : null;
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          type: 'unhandled_exception',
          requestId: req?.requestId ?? null,
          method: req?.method ?? null,
          path: pathOnly ?? null,
          status: mapped.status,
          errorName: errObj?.name ?? typeof exception,
          errorMessage: errObj?.message ?? String(exception),
          stack: errObj?.stack ?? null,
        }),
      );
    }
    res.status(mapped.status).json(mapped.body);
  }

  private map(exception: unknown): { status: number; body: CodedBody } {
    if (
      exception &&
      typeof exception === 'object' &&
      ((exception as { type?: unknown }).type === 'entity.too.large' ||
        (exception as { status?: unknown }).status === HttpStatus.PAYLOAD_TOO_LARGE)
    ) {
      return {
        status: HttpStatus.PAYLOAD_TOO_LARGE,
        body: { code: 'PAYLOAD_TOO_LARGE', message: 'Request payload too large' },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (payload && typeof payload === 'object' && 'code' in (payload as CodedBody)) {
        const body = payload as CodedBody;
        return {
          status,
          body: { code: body.code, message: body.message, ...(body.details !== undefined ? { details: body.details } : {}) },
        };
      }
      if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
        return {
          status,
          body: { code: 'PAYLOAD_TOO_LARGE', message: 'Request payload too large' },
        };
      }
      const validationMessages =
        payload &&
        typeof payload === 'object' &&
        Array.isArray((payload as { message?: unknown }).message)
          ? (payload as { message: unknown[] }).message
          : undefined;
      const defaultCode =
        status === HttpStatus.UNAUTHORIZED
          ? 'UNAUTHORIZED'
          : status === HttpStatus.FORBIDDEN
            ? 'FORBIDDEN'
            : status === HttpStatus.NOT_FOUND
              ? 'NOT_FOUND'
              : status === HttpStatus.TOO_MANY_REQUESTS
                ? 'RATE_LIMITED'
                : 'BAD_REQUEST';
      return {
        status,
        body: {
          code: defaultCode,
          message: validationMessages
            ? 'Validation failed'
            : typeof payload === 'string'
              ? payload
              : exception.message,
          ...(validationMessages ? { details: validationMessages } : {}),
        },
      };
    }

    if (exception instanceof Error && exception.name === 'ZodError') {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        body: { code: 'VALIDATION', message: 'validation failed' },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return { status: HttpStatus.CONFLICT, body: { code: 'CONFLICT', message: 'resource already exists' } };
      }
      if (exception.code === 'P2025') {
        return { status: HttpStatus.NOT_FOUND, body: { code: 'NOT_FOUND', message: 'NOT_FOUND' } };
      }
      return { status: HttpStatus.INTERNAL_SERVER_ERROR, body: { code: 'INTERNAL', message: 'internal error' } };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, body: { code: 'INTERNAL', message: 'internal error' } };
  }
}
