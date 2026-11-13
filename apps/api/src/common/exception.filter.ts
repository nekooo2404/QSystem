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
    const res = host.switchToHttp().getResponse<{
      status: (code: number) => { json: (body: unknown) => unknown };
      json: (body: unknown) => unknown;
    }>();

    const mapped = this.map(exception);
    res.status(mapped.status).json(mapped.body);
  }

  private map(exception: unknown): { status: number; body: CodedBody } {
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
      return {
        status,
        body: {
          code: 'BAD_REQUEST',
          message: typeof payload === 'string' ? payload : exception.message,
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
