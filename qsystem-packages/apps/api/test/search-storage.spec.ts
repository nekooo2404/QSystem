import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SearchService } from '../src/search/search.service';
import { SearchSyncWorker } from '../src/search/sync.worker';
import { SearchResultSchema } from '@qsystem/contracts';
import { resetLoginLimits } from '../src/iam/login-rate-limit';
import { signedHeaderRequest, presignUrl, s3ConfigFromEnv } from '../src/storage/sigv4';
import { MAX_FILE_SIZE_BYTES, StorageService } from '../src/storage/storage.service';
import { scopeFilterFor } from '../src/search/search.service';
import type { ScopeViewer } from '../src/prisma/prisma.service';

// Unique per run so repeat runs never clash with seed data or each other
// (emails are globally unique; file keys are unique per [bucket, key]).
const RUN = `ss-${Date.now()}`;

// Owner-role connection: RLS-exempt bootstrap oracle used ONLY for fixtures
// and read-back verification. Test traffic (supertest against the Nest app)
// connects as the restricted qsystem_app role via DATABASE_URL; the app itself
// never touches the owner.
//
// RLS_OWNER_URL + QSYSTEM_APP_PASSWORD are REQUIRED (fail fast when unset —
// no localhost default, no hard-coded secrets in tracked files).
const RLS_OWNER_URL = process.env.RLS_OWNER_URL;
if (!RLS_OWNER_URL) {
  throw new Error(
    'qsystem: RLS_OWNER_URL must be set (owner DB URL for test bootstrap).',
  );
}
const owner = new PrismaClient({ datasources: { db: { url: RLS_OWNER_URL } } });

// TEST_JWT_SECRET is test-only: set locally in this spec so the app's
// fail-fast path (no hardcoded default key) still signs tokens during e2e.
process.env.TEST_JWT_SECRET ??= 'search-storage-spec-local-only-do-not-reuse';
process.env.NODE_ENV ??= 'test';

// Dev-only fallbacks for the two backing services (mirrors the services'
// own defaults; production must set the real env vars — see storage.service
// and search.service for the same fallback logic).
process.env.MEILI_URL ??= 'http://localhost:17700';
process.env.MEILI_MASTER_KEY ??= 'change-me-32-chars-minimum-0000';
process.env.S3_ENDPOINT ??= 'http://localhost:19000';
process.env.S3_ACCESS_KEY ??= 'minioadmin';
process.env.S3_SECRET_KEY ??= 'minioadmin';

const PASSWORD = 'Correct-horse-9!';

// Bucket + unique object prefix for this run (presign test uploads only
// under this prefix; bootstrap pre-creates the bucket if missing).
const BUCKET = 'qsystem-docs';
const KEY_PREFIX = `${RUN}/`;

let app!: INestApplication;
let moduleRef!: TestingModule;
let search!: SearchService;
let sync!: SearchSyncWorker;
let directorViewer!: ScopeViewer;
let userA!: { id: string; email: string; departmentId: string };
let userB!: { id: string; email: string; departmentId: string };
let userDir!: { id: string; email: string };
let tokenA!: string;
let tokenB!: string;
let tokenDir!: string;
let fileA!: { id: string; bucket: string; key: string };
let fileB!: { id: string; bucket: string; key: string };
// File rows created through the presign endpoint during the run (metadata +
// object), so afterAll can remove them from Meili/S3/DB.
const uploadedFileIds: string[] = [];

async function loginAs(
  server: Parameters<typeof request>[0],
  emailAddress: string,
): Promise<string> {
  const res = await request(server)
    .post('/auth/login')
    .send({ email: emailAddress, password: PASSWORD })
    .expect(201);
  return (res.body as { accessToken: string }).accessToken as string;
}

/**
 * GET /search as `token`. No visibility polling: every index write in this
 * suite goes through SearchService, which reads Meili's `taskUid` from the
 * enqueue response and awaits that task — including the filtered-search
 * reads below, which are immediately consistent afterwards (probed 125/125
 * rounds with zero misses after the taskUid fix).
 */
async function searchAs(
  token: string,
  query: Record<string, unknown>,
): Promise<{ hits: Array<Record<string, unknown>>; total: number; limit: number; offset: number }> {
  const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
  const res = await request(server)
    .get('/search')
    .query(query)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  return res.body as {
    hits: Array<Record<string, unknown>>;
    total: number;
    limit: number;
    offset: number;
  };
}

/** Signed PutBucket (header auth) — bootstrap only, mirrors storage sigv4 helper. */
async function ensureBucket(bucket: string): Promise<void> {
  const req = signedHeaderRequest(s3ConfigFromEnv(), 'PUT', `/${bucket}`);
  const res = await fetch(req.url, { method: req.method, headers: req.headers });
  // 409 BucketAlreadyOwnedByYou (or 200) both mean "the bucket exists for us".
  if (!res.ok && res.status !== 409) {
    throw new Error(`qsystem: ensureBucket(${bucket}) failed: ${res.status} ${await res.text()}`);
  }
}

/** Signed ListObjectsV2 + DeleteObject for every object this run uploaded. */
async function cleanupObjects(): Promise<void> {
  const cfg = s3ConfigFromEnv();
  // The signed request descriptor carries method+headers (they are part of the
  // signature) — fetching only `url` sends an anonymous request that S3 403s,
  // the key regex then matches nothing and the cleanup silently no-ops.
  const listReq = signedHeaderRequest(cfg, 'GET', `/${BUCKET}`, {
    'list-type': '2',
    prefix: KEY_PREFIX,
  });
  const list = await fetch(listReq.url, {
    method: listReq.method,
    headers: listReq.headers,
  }).then((r) => {
    if (!r.ok) throw new Error(`qsystem: cleanup list failed: ${r.status}`);
    return r.text();
  });
  const keys = [...list.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) =>
    m[1]!.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
  );
  for (const key of keys) {
    const req = signedHeaderRequest(cfg, 'DELETE', `/${BUCKET}/${key}`);
    await fetch(req.url, { method: req.method, headers: req.headers });
  }
}

beforeAll(async () => {
  await owner.$connect();

  const appPassword = process.env.QSYSTEM_APP_PASSWORD;
  if (!appPassword) {
    throw new Error(
      'qsystem: QSYSTEM_APP_PASSWORD must be set (password for the qsystem_app test role).',
    );
  }
  await owner.$executeRawUnsafe(
    `ALTER ROLE qsystem_app WITH LOGIN PASSWORD '${appPassword.replace(/'/g, "''")}'`,
  );

  // Departments: A (user A's own) and B (user B's) — distinct so the
  // EMPLOYEE scope filter and the department filter can both discriminate.
  const deptA = await owner.department.create({ data: { name: `${RUN}-deptA`, tenantId: null } });
  const deptB = await owner.department.create({ data: { name: `${RUN}-deptB`, tenantId: null } });

  const passwordHash = await argon2.hash(PASSWORD);
  const a = await owner.user.create({
    data: {
      email: `${RUN}-a@qsystem.local`,
      name: 'Search User A',
      passwordHash,
      role: 'EMPLOYEE',
      departmentId: deptA.id,
      tenantId: null,
    },
  });
  const b = await owner.user.create({
    data: {
      email: `${RUN}-b@qsystem.local`,
      name: 'Search User B',
      passwordHash,
      role: 'EMPLOYEE',
      departmentId: deptB.id,
      tenantId: null,
    },
  });
  const dir = await owner.user.create({
    data: {
      email: `${RUN}-dir@qsystem.local`,
      name: 'Search Director',
      passwordHash,
      role: 'DIRECTOR',
      tenantId: null,
    },
  });
  userA = { id: a.id, email: a.email, departmentId: deptA.id };
  userB = { id: b.id, email: b.email, departmentId: deptB.id };
  userDir = { id: dir.id, email: dir.email };

  // File rows seeded under each owner's identity (RLS WITH CHECK applies).
  // Keyword "needle" is unique per run so the Meili search only matches these.
  fileA = await owner.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_user_id', '${a.id}', true)`,
    );
    return tx.file.create({
      data: {
        bucket: BUCKET,
        key: `${KEY_PREFIX}file-a.txt`,
        ownerId: a.id,
        departmentId: deptA.id,
        tenantId: null,
      },
    });
  });
  fileB = await owner.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_user_id', '${b.id}', true)`,
    );
    return tx.file.create({
      data: {
        bucket: BUCKET,
        key: `${KEY_PREFIX}file-b.txt`,
        ownerId: b.id,
        departmentId: deptB.id,
        tenantId: null,
      },
    });
  });

  // The services under test must be reachable — fail fast with a clear
  // message instead of hanging or producing confusing per-test errors.
  const meiliHealth = await fetch(`${process.env.MEILI_URL}/health`);
  if (!meiliHealth.ok) throw new Error('qsystem: Meilisearch is not healthy (MEILI_URL).');
  const s3Health = await fetch(`${process.env.S3_ENDPOINT}/minio/health/live`);
  if (!s3Health.ok) throw new Error('qsystem: S3 (RustFS) is not healthy (S3_ENDPOINT).');
  // Pre-create the shared dev bucket if missing (signed PutBucket).
  await ensureBucket(BUCKET);

  moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();

  search = moduleRef.get(SearchService, { strict: false });
  sync = moduleRef.get(SearchSyncWorker, { strict: false });
  // A DIRECTOR viewer sees the whole company, so syncAll here is a full
  // re-index across both departments (the worker's broader path).
  directorViewer = {
    id: userDir.id,
    role: 'DIRECTOR',
    managedDepartmentIds: [],
  };

  // Fresh index state for this run: create indexes + filterable attributes,
  // then index the file rows through the real worker (not a direct upsert).
  await search.ensureIndexes();
  await sync.syncAll(directorViewer);

  const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
  await resetLoginLimits(owner);
  tokenA = await loginAs(server, userA.email);
  tokenB = await loginAs(server, userB.email);
  tokenDir = await loginAs(server, userDir.email);
}, 180000);

afterAll(async () => {
  // Meili: remove this run's documents (the two fixture files indexed in
  // beforeAll plus any created via the presign endpoint). Best-effort: a
  // down Meili must not mask verdicts.
  try {
    const ids = [
      ...(fileA ? [fileA.id] : []),
      ...(fileB ? [fileB.id] : []),
      ...uploadedFileIds,
    ];
    if (search && ids.length > 0) {
      await search.deleteDocuments(ids);
    }
  } catch {
    // best-effort
  }
  // S3: delete uploaded objects, then leave the bucket in place (shared dev
  // bucket; only this run's prefix is removed).
  try {
    await cleanupObjects();
  } catch {
    // same best-effort rule
  }
  // DB: files (FK cascade from users also covers them, but delete explicitly
  // for clarity), departments, users.
  await owner.file.deleteMany({
    where: {
      OR: [
        { ownerId: userA?.id },
        { ownerId: userB?.id },
        ...(uploadedFileIds.length > 0 ? [{ id: { in: uploadedFileIds } }] : []),
      ],
    },
  });
  await owner.user.deleteMany({ where: { email: { startsWith: `${RUN}-` } } });
  await owner.department.deleteMany({ where: { name: { startsWith: `${RUN}-` } } });
  await app?.close();
  await owner.$disconnect();
});

describe('SearchModule + StorageModule (Task 7)', () => {
  it('search của EMPLOYEE không lọt doc phòng khác; DIRECTOR thấy cả hai', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];

    // EMPLOYEE A: only their own document.
    const resA = await request(server)
      .get('/search')
      .query({ q: KEY_PREFIX })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const bodyA = resA.body as Record<string, unknown>;
    // Shape pinned by contracts (verbatim): hits/total/limit/offset.
    expect(() => SearchResultSchema.parse(bodyA)).not.toThrow();
    const hitsA = bodyA.hits as Array<Record<string, unknown>>;
    expect(hitsA).toHaveLength(1);
    expect(hitsA[0]!.id).toBe(fileA.id);
    expect(hitsA.some((h) => h.id === fileB.id)).toBe(false);

    // DIRECTOR: no scope filter → both documents.
    const resDir = await request(server)
      .get('/search')
      .query({ q: KEY_PREFIX })
      .set('Authorization', `Bearer ${tokenDir}`)
      .expect(200);
    const hitsDir = (resDir.body as { hits: Array<Record<string, unknown>> }).hits;
    expect(hitsDir).toHaveLength(2);
    expect(new Set(hitsDir.map((h) => h.id))).toEqual(new Set([fileA.id, fileB.id]));
    expect(hitsDir.every((h) => typeof h.title === 'string')).toBe(true);
    expect(hitsDir.every((h) => typeof h.owner_id === 'string')).toBe(true);
  });

  it('Meili filter hoạt động: total/limit/offset hợp lệ khi limit < tổng hits', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    // 2 hits exist for the DIRECTOR; limit=1 must paginate (offset skips 1).
    const res1 = await request(server)
      .get('/search')
      .query({ q: KEY_PREFIX, limit: 1 })
      .set('Authorization', `Bearer ${tokenDir}`)
      .expect(200);
    const page1 = res1.body as { hits: unknown[]; total: number; limit: number; offset: number };
    expect(page1.hits).toHaveLength(1);
    expect(page1.limit).toBe(1);
    expect(page1.offset).toBe(0);
    expect(page1.total).toBe(2);

    const res2 = await request(server)
      .get('/search')
      .query({ q: KEY_PREFIX, limit: 1, offset: 1 })
      .set('Authorization', `Bearer ${tokenDir}`)
      .expect(200);
    const page2 = res2.body as { hits: unknown[]; total: number; limit: number; offset: number };
    expect(page2.hits).toHaveLength(1);
    expect(page2.limit).toBe(1);
    expect(page2.offset).toBe(1);
    expect(page2.total).toBe(2);
    // Pages are disjoint.
    const ids1 = (res1.body as { hits: Array<{ id: string }> }).hits.map((h) => h.id);
    const ids2 = (res2.body as { hits: Array<{ id: string }> }).hits.map((h) => h.id);
    expect(ids1[0]).not.toBe(ids2[0]);
  });

  it('presign PUT rồi GET lại đúng nội dung (byte-for-byte)', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    const payload = `presign-roundtrip-${RUN}-éü-中文`;
    const key = `${KEY_PREFIX}roundtrip.txt`;

    const res = await request(server)
      .post('/files/presign')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ bucket: BUCKET, key, mimeType: 'text/plain', size: Buffer.byteLength(payload) })
      .expect(201);
    const body = res.body as { fileId: string; uploadUrl: string; bucket: string; key: string };
    expect(body.fileId).toBeTruthy();
    expect(body.bucket).toBe(BUCKET);
    expect(body.key).toBe(key);
    expect(body.uploadUrl).toContain('X-Amz-Signature');
    uploadedFileIds.push(body.fileId);

    // Real PUT to the presigned URL (fetch to localhost:19000) — no auth
    // headers of our own; the signature in the query string is the auth.
    const put = await fetch(body.uploadUrl, { method: 'PUT', body: payload });
    expect(put.status).toBe(200);

    // GET /files/:id as the owner → presigned GET URL.
    const getRes = await request(server)
      .get(`/files/${body.fileId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const getBody = getRes.body as { id: string; bucket: string; key: string; url: string };
    expect(getBody.id).toBe(body.fileId);
    expect(getBody.url).toContain('X-Amz-Signature');

    // Fetch the presigned GET and compare byte-for-byte.
    const fetched = await fetch(getBody.url);
    expect(fetched.status).toBe(200);
    expect(await fetched.text()).toBe(payload);

    // The write-path indexing flow: syncFile(fileId, viewer) must surface the
    // new file in search for its owner. The service awaits the Meili task, so
    // the follow-up search observes it immediately.
    const viewerA = { id: userA.id, role: 'EMPLOYEE' as const, managedDepartmentIds: [] };
    const presignedFileId = body.fileId;
    await sync.syncFile(presignedFileId, viewerA);
    const found = await searchAs(tokenA, { q: key });
    expect(found.hits.some((h) => h.id === presignedFileId)).toBe(true);
  });

  it('presign keys với ký tự đặc biệt (# ? %25) vẫn PUT/GET đúng nội dung', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    // Fix I2: `#`, `?`, and a literal `%` in a key used to make the sent path
    // diverge from the signed canonical path (WHATWG URL swallowed `#`/`?`
    // and left `%` raw) → S3 403. The presigned URL path must be
    // byte-identical to the canonical path for every key.
    const cases: Array<{ key: string; payload: string }> = [
      { key: `${KEY_PREFIX}ha#sh.txt`, payload: `hash-payload-${RUN}` },
      { key: `${KEY_PREFIX}que?ry.txt`, payload: `query-payload-${RUN}` },
      { key: `${KEY_PREFIX}50%25.txt`, payload: `percent-payload-${RUN}` },
    ];
    for (const { key, payload } of cases) {
      const res = await request(server)
        .post('/files/presign')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ bucket: BUCKET, key, mimeType: 'text/plain' })
        .expect(201);
      const body = res.body as { fileId: string; uploadUrl: string };
      uploadedFileIds.push(body.fileId);

      // The sent path (before the query string) must equal the RFC3986-encoded
      // canonical form of the raw key — no raw `#`, `?`, or `%` survives.
      const sentPath = new URL(body.uploadUrl).pathname;
      expect(sentPath).not.toMatch(/[?#%](?![0-9A-Fa-f]{2})/); // no bare %/#/?
      expect(sentPath).not.toContain('#');
      expect(sentPath).not.toContain('?');
      expect(decodeURIComponent(sentPath)).toBe(`/${BUCKET}/${key}`);

      const put = await fetch(body.uploadUrl, { method: 'PUT', body: payload });
      expect(put.status).toBe(200);

      const getRes = await request(server)
        .get(`/files/${body.fileId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      const getBody = getRes.body as { url: string };
      const fetched = await fetch(getBody.url);
      expect(fetched.status).toBe(200);
      expect(await fetched.text()).toBe(payload);
    }
  });

  it('presign key rỗng hoặc quá dài → coded 400 INVALID_KEY, không tạo row', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    const countBefore = await owner.file.count({ where: { bucket: BUCKET } });

    for (const key of ['', '   ', 'x'.repeat(1025)]) {
      const res = await request(server)
        .post('/files/presign')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ bucket: BUCKET, key, mimeType: 'text/plain' })
        .expect(400);
      expect((res.body as { code: string }).code).toBe('INVALID_KEY');
    }

    // No metadata row was created by any rejected request.
    expect(await owner.file.count({ where: { bucket: BUCKET } })).toBe(countBefore);
  });

  it('presign trùng (bucket,key) với row ẩn của user khác → coded 409 (không 500)', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    // fileA exists under user A (hidden from EMPLOYEE B by scope). B presigns
    // the same (bucket, key): the scoped pre-check misses, the INSERT hits the
    // unique constraint → must surface as coded 409 CONFLICT (R26), never a
    // raw 500 and never a 201 (no second row either way).
    const res = await request(server)
      .post('/files/presign')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ bucket: BUCKET, key: fileA.key, mimeType: 'text/plain' })
      .expect(409);
    expect(res.body).toEqual({
      code: 'CONFLICT',
      message: `a file with key ${fileA.key} already exists in bucket ${BUCKET}`,
    });
  });
  it('sai scope bị 404 coded (không lộ existence); DIRECTOR vẫn thấy', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];

    // B (EMPLOYEE, other department) asks for A's file → coded 404, no leak.
    const resB = await request(server)
      .get(`/files/${fileA.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
    expect(resB.body).toEqual({ code: 'NOT_FOUND', message: 'NOT_FOUND' });

    // A (owner) still sees it; DIRECTOR sees it too.
    const resA = await request(server)
      .get(`/files/${fileA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect((resA.body as { id: string }).id).toBe(fileA.id);

    const resDir = await request(server)
      .get(`/files/${fileA.id}`)
      .set('Authorization', `Bearer ${tokenDir}`)
      .expect(200);
    expect((resDir.body as { id: string }).id).toBe(fileA.id);

    // Unknown id → same coded 404 (no existence oracle either way).
    const resMissing = await request(server)
      .get('/files/ss-nonexistent-file-id')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
    expect(resMissing.body).toEqual({ code: 'NOT_FOUND', message: 'NOT_FOUND' });
  });
});

describe('Finding #9: SigV4 path canonicalisation + presignUpload input validation', () => {
  const cfg = s3ConfigFromEnv();

  it('signedHeaderRequest và presignUrl gửi cùng một path với key có # ? %', () => {
    for (const key of ['r/ha#sh.txt', 'r/que?ry.txt', 'r/50%.txt', 'r/50%25.txt']) {
      const presigned = new URL(presignUrl(cfg, 'DELETE', 'qsystem-docs', key));
      const signed = new URL(signedHeaderRequest(cfg, 'DELETE', `/qsystem-docs/${key}`).url);
      expect(signed.pathname).toBe(presigned.pathname);
      expect(signed.hash).toBe('');
      expect(signed.search).toBe('');
    }
  });

  const svc = new StorageService({} as never);
  const viewer: ScopeViewer = { id: 'u', role: 'EMPLOYEE', managedDepartmentIds: [] };

  it('key chứa . / .. hoặc bắt đầu bằng / → INVALID_KEY (không chạm DB)', async () => {
    for (const key of ['../x', '../other-bucket/x', 'a/../b', './x', 'a/./b', 'a/..', '/abs']) {
      await expect(svc.presignUpload(viewer, { bucket: BUCKET, key })).rejects.toMatchObject({
        response: { code: 'INVALID_KEY' },
      });
    }
  });

  it('size âm / vượt INT4 / không nguyên → INVALID_SIZE', async () => {
    for (const size of [-1, 3_000_000_000, 2_147_483_648, 1.5, Number.NaN]) {
      await expect(
        svc.presignUpload(viewer, { bucket: BUCKET, key: 'ok.txt', size }),
      ).rejects.toMatchObject({ response: { code: 'INVALID_SIZE' } });
    }
  });

  it('key/size hợp lệ không bị chặn bởi validation (đi tới DB)', async () => {
    const reachedDb = new StorageService({
      forUser: () => ({
        file: { findUnique: async () => null, create: async () => ({ id: 'f1' }) },
      }),
    } as never);
    for (const size of [0, MAX_FILE_SIZE_BYTES, undefined]) {
      const r = await reachedDb.presignUpload(viewer, { bucket: BUCKET, key: 'a..b/ok.txt', size });
      expect(r.fileId).toBe('f1');
    }
  });
});

describe('Finding #16: scopeFilterFor escapes quote and backslash', () => {
  it('escapes ids in every value injected into the filter', () => {
    const bs = String.fromCharCode(92); // backslash
    const evil = `x" OR owner_id != "y${bs}`;
    const escaped = `x${bs}" OR owner_id != ${bs}"y${bs}${bs}`;
    expect(
      scopeFilterFor({ id: evil, role: 'EMPLOYEE', managedDepartmentIds: [] }),
    ).toBe(`owner_id = "${escaped}"`);
    expect(
      scopeFilterFor({ id: evil, role: 'MANAGER', managedDepartmentIds: [evil, 'd2'] }),
    ).toBe(
      `(owner_id = "${escaped}" OR department_id = "${escaped}" OR department_id = "d2")`,
    );
  });
});
