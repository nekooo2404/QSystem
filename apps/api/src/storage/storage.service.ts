import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, type ScopeViewer } from '../prisma/prisma.service';
import { presignUrl, PRESIGN_EXPIRES_SECONDS, s3ConfigFromEnv } from './sigv4';

/** Buckets permitted by the MVP spec (design doc lines 79-80). */
export const ALLOWED_BUCKETS = ['qsystem-docs', 'qsystem-avatars'] as const;
export type AllowedBucket = (typeof ALLOWED_BUCKETS)[number];

/** Coded 400 for a bucket outside the MVP allowlist. */
export class InvalidBucketError extends HttpException {
  constructor(bucket: string) {
    super(
      {
        code: 'INVALID_BUCKET',
        message: `bucket must be one of ${ALLOWED_BUCKETS.join('|')}`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

/** Coded 400 for an unusable object key (empty, whitespace, or too long). */
export class InvalidKeyError extends HttpException {
  constructor() {
    super(
      { code: 'INVALID_KEY', message: 'key must be 1-1024 chars and not blank' },
      HttpStatus.BAD_REQUEST,
    );
  }
}

/** Coded 409 for a (bucket, key) that already exists (out of the caller's scope). */
export class PresignConflictError extends HttpException {
  constructor(bucket: string, key: string) {
    super(
      {
        code: 'CONFLICT',
        message: `a file with key ${key} already exists in bucket ${bucket}`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export interface PresignInput {
  bucket: string;
  key: string;
  mimeType?: string;
  size?: number;
}

export interface PresignResult {
  fileId: string;
  bucket: string;
  key: string;
  uploadUrl: string;
  expiresInSeconds: number;
}

export interface FileDownload {
  id: string;
  bucket: string;
  key: string;
  mimeType: string | null;
  size: number | null;
  ownerId: string;
  departmentId: string | null;
  url: string;
  expiresInSeconds: number;
}

/**
 * StorageService (Task 7): file metadata rows live in the `files` table and
 * object bytes live in S3 (RustFS dev, MinIO-compatible). Every DB read/write
 * goes through `PrismaService.forUser(viewer)` so the app-layer scope
 * (file → EMPLOYEE ownerId / MANAGER managed departments / DIRECTOR bypass)
 * and the SQL RLS policies (files_self/files_department/files_company) both
 * apply. Presigned URLs are SigV4 query strings (sigv4.ts, R20 — no SDK).
 *
 * Note on scope vs. bucket: the presign endpoint authenticates the *metadata*
 * write through the scoped client; object access itself is protected by the
 * unguessable presigned URL (15-minute TTL) — the same trust model as MinIO
 * presigned URLs anywhere. Out-of-scope metadata reads return coded 404.
 */
@Injectable()
export class StorageService {
  // Explicit token — esbuild (vitest) does not emit decorator metadata.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Upsert the `files` metadata row (ownerId = viewer, departmentId =
   * viewer's department when present) and return the presigned PUT URL.
   * The upsert runs through the scoped client: for an EMPLOYEE the scoped
   * layer pins `ownerId = viewer.id` on the insert branch (never spoofable);
   * DIRECTOR/MANAGER writes follow the same rules as any scoped write.
   */
  async presignUpload(viewer: ScopeViewer, input: PresignInput): Promise<PresignResult> {
    if (!(ALLOWED_BUCKETS as readonly string[]).includes(input.bucket)) {
      throw new InvalidBucketError(input.bucket);
    }
    const key = input.key;
    // An empty key presigns the bucket root and permanently blocks it via
    // the (bucket,key) unique constraint; cap the length before any write.
    if (typeof key !== 'string' || key.trim().length === 0 || key.length > 1024) {
      throw new InvalidKeyError();
    }
    const existing = await this.prisma.forUser(viewer).file.findUnique({
      where: { bucket_key: { bucket: input.bucket, key } },
    });
    let fileId: string;
    if (existing) {
      const updated = await this.prisma.forUser(viewer).file.update({
        where: { id: existing.id },
        data: {
          mimeType: input.mimeType ?? null,
          size: input.size ?? null,
        },
      });
      fileId = updated.id;
    } else {
      try {
        const created = await this.prisma.forUser(viewer).file.create({
          data: {
            bucket: input.bucket,
            key,
            ownerId: viewer.id,
            departmentId: viewer.departmentId ?? null,
            mimeType: input.mimeType ?? null,
            size: input.size ?? null,
            tenantId: null,
          },
        });
        fileId = created.id;
      } catch (err) {
        // R26: a hidden out-of-scope row with the same (bucket, key) makes the
        // scoped pre-check miss (findUnique returns null) and the INSERT hit
        // the unique constraint → Prisma P2002. That is a name collision, not
        // a server error: coded 409 (never a raw 500, and 409-vs-201 does not
        // act as an existence oracle across scopes — any caller that cannot
        // see the row gets the same CONFLICT regardless of why).
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new PresignConflictError(input.bucket, key);
        }
        throw err;
      }
    }
    return {
      fileId,
      bucket: input.bucket,
      key,
      uploadUrl: presignUrl(s3ConfigFromEnv(), 'PUT', input.bucket, key),
      expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
    };
  }

  /**
   * Scoped read of the metadata row + presigned GET URL. Out-of-scope or
   * missing rows return `null` — the controller maps that to coded 404
   * (no existence oracle; nothing reveals whether the file exists).
   */
  async getDownload(viewer: ScopeViewer, fileId: string): Promise<FileDownload | null> {
    const row = await this.prisma.forUser(viewer).file.findUnique({ where: { id: fileId } });
    if (!row) return null;
    return {
      id: row.id,
      bucket: row.bucket,
      key: row.key,
      mimeType: row.mimeType,
      size: row.size,
      ownerId: row.ownerId,
      departmentId: row.departmentId,
      url: presignUrl(s3ConfigFromEnv(), 'GET', row.bucket, row.key),
      expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
    };
  }
}
