import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { resetLoginLimits } from '../src/iam/login-rate-limit';

// Unique per run so repeat runs never clash with seed data or each other.
const RUN = `iam-${Date.now()}`;

// Owner-role connection: RLS-exempt bootstrap oracle used ONLY for fixtures.
// Test traffic (supertest against the Nest app) connects as the restricted
// qsystem_app role via DATABASE_URL; the app itself never touches the owner.
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
// It never touches app code paths outside NODE_ENV=test.
process.env.TEST_JWT_SECRET ??= 'iam-spec-local-only-do-not-reuse';
process.env.NODE_ENV ??= 'test';

const PASSWORD = 'Correct-horse-9!';
const WRONG = 'Wrong-password-0!';

let app!: INestApplication;
let deptId!: string;

beforeAll(async () => {
  await owner.$connect();
  // Shared limiter state lives in Postgres now: isolate this file from any
  // earlier spec's logins before anything below performs one.
  await resetLoginLimits(owner);

  const appPassword = process.env.QSYSTEM_APP_PASSWORD;
  if (!appPassword) {
    throw new Error(
      'qsystem: QSYSTEM_APP_PASSWORD must be set (password for the qsystem_app test role).',
    );
  }
  await owner.$executeRawUnsafe(
    `ALTER ROLE qsystem_app WITH LOGIN PASSWORD '${appPassword.replace(/'/g, "''")}'`,
  );

  // Fixture users with REAL Argon2 hashes (emails unique per RUN).
  const dept = await owner.department.create({
    data: { name: `${RUN}-dept`, tenantId: null },
  });
  deptId = dept.id;
  const manager = await owner.user.create({
    data: {
      email: `${RUN}-mgr@qsystem.local`,
      name: 'IAM Manager',
      passwordHash: await argon2.hash(PASSWORD),
      role: 'MANAGER',
      tenantId: null,
    },
  });
  await owner.department.update({
    where: { id: dept.id },
    data: { managerId: manager.id },
  });
  await owner.user.create({
    data: {
      email: `${RUN}-emp@qsystem.local`,
      name: 'IAM Employee',
      passwordHash: await argon2.hash(PASSWORD),
      role: 'EMPLOYEE',
      departmentId: dept.id,
      reportsToId: manager.id,
      tenantId: null,
    },
  });

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
}, 180000);

afterAll(async () => {
  await app?.close();
  await owner.$disconnect();
});

function refreshCookieOf(res: { headers: Record<string, unknown> }): string {
  const cookies = res.headers['set-cookie'] as unknown as string[];
  const found = cookies.find((c) => c.startsWith('refresh_token='));
  if (!found) throw new Error('expected refresh_token cookie');
  return found;
}

describe('IamModule (Task 3)', () => {
  it('login trả access + set refresh cookie; /me trả role + managedDepartmentIds', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];

    const loginRes = await request(server)
      .post('/auth/login')
      .send({ email: `${RUN}-mgr@qsystem.local`, password: PASSWORD })
      .expect(201);

    expect((loginRes.body as { accessToken: string }).accessToken).toEqual(expect.any(String));
    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    expect(cookies.join(';')).toMatch(/refresh_token=/);

    const meRes = await request(server)
      .get('/me')
      .set('Authorization', `Bearer ${(loginRes.body as { accessToken: string }).accessToken as string}`)
      .expect(200);

    expect(meRes.body as Record<string, unknown>).toMatchObject({ role: 'MANAGER' });
    // Exact-dept assertion: the manager manages exactly this run's dept.
    expect(meRes.body.managedDepartmentIds).toEqual([deptId]);
  });

  it('refresh xoay vòng: reuse refresh cũ bị 401 REFRESH_REUSED + thu hồi chuỗi', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];

    const loginRes = await request(server)
      .post('/auth/login')
      .send({ email: `${RUN}-emp@qsystem.local`, password: PASSWORD })
      .expect(201);
    const firstCookie = refreshCookieOf(loginRes);

    // First rotation succeeds and issues a fresh cookie.
    const rotated = await request(server)
      .post('/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(201);
    expect((rotated.body as { accessToken: string }).accessToken).toEqual(expect.any(String));

    // Reusing the old (already rotated) cookie must fail with REFRESH_REUSED
    // and revoke the whole chain.
    const reuse = await request(server)
      .post('/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(401);
    expect((reuse.body as { code: string }).code).toBe('REFRESH_REUSED');

    // The rotated token from the compromised chain is revoked too.
    const rotatedCookie = refreshCookieOf(rotated);
    const afterReuse = await request(server)
      .post('/auth/refresh')
      .set('Cookie', rotatedCookie)
      .expect(401);
    expect((afterReuse.body as { code: string }).code).toBe('REFRESH_REUSED');
  });

  it('refresh song song cùng cookie: đúng 1 thành công, không tạo token mồ côi', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    const user = await owner.user.findUniqueOrThrow({ where: { email: `${RUN}-emp@qsystem.local` } });
    const before = new Set(
      (await owner.refreshToken.findMany({ where: { userId: user.id }, select: { id: true } })).map((t) => t.id),
    );

    const loginRes = await request(server)
      .post('/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(201);
    const cookie = refreshCookieOf(loginRes);

    const results = await Promise.all([
      request(server).post('/auth/refresh').set('Cookie', cookie),
      request(server).post('/auth/refresh').set('Cookie', cookie),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 401]);
    const loser = results.find((r) => r.status === 401);
    expect((loser?.body as { code?: string } | undefined)?.code).toBe('REFRESH_REUSED');

    // Only the login token + ONE successor may exist. A losing concurrent
    // rotation must roll back its fresh token instead of leaving it unlinked.
    const added = (
      await owner.refreshToken.findMany({
        where: { userId: user.id },
        select: { id: true, replacedById: true },
      })
    ).filter((t) => !before.has(t.id));
    expect(added).toHaveLength(2);
    const oldRow = added.find((t) => t.replacedById);
    // The successor still exists as a row (no orphan, no overwrite). Whether
    // it is later revoked is timing-dependent: a loser that reads the row only
    // after the winner commits sees a spent token and takes the ordinary
    // reuse-detection path (pre-existing behaviour), so don't assert on it.
    expect(added.some((t) => t.id === oldRow?.replacedById)).toBe(true);
  });

  it('rate-limit: request song song cùng account không vượt quá 5 lần thử', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    await resetLoginLimits(owner);
    const email = `${RUN}-race@qsystem.local`;

    const statuses = await Promise.all(
      Array.from({ length: 8 }, () =>
        request(server)
          .post('/auth/login')
          .send({ email, password: WRONG })
          .then((r) => r.status),
      ),
    );
    // The security property: at most 5 password checks for one account, no
    // matter how many requests arrive at once (argon2 runs after this gate).
    expect(statuses.filter((s) => s === 401).length).toBeLessThanOrEqual(5);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(3);
    expect(statuses).toHaveLength(8);
    // One slot per allowed request under the per-key lock: never 8 rows.
    const account = await owner.rateLimitHit.count({ where: { bucket: 'account' } });
    expect(account).toBeLessThanOrEqual(5);
    await resetLoginLimits(owner);
  });

  it('rate-limit cleanup chỉ xoá hit hết hạn của đúng (bucket,key)', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    await resetLoginLimits(owner);
    // Stale row of an unrelated bucket/key pair: a login must not touch it.
    const foreign = await owner.rateLimitHit.create({
      data: { bucket: 'account', key: 'other-ip::other@qsystem.local', at: new Date(Date.now() - 120_000) },
    });

    await request(server)
      .post('/auth/login')
      .send({ email: `${RUN}-cleanup@qsystem.local`, password: WRONG })
      .expect(401);

    expect(await owner.rateLimitHit.findUnique({ where: { id: foreign.id } })).not.toBeNull();
    await resetLoginLimits(owner);
  });

  it('expired token trả 401 INVALID_CREDENTIALS, không thu hồi chuỗi', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];

    const loginRes = await request(server)
      .post('/auth/login')
      .send({ email: `${RUN}-mgr@qsystem.local`, password: PASSWORD })
      .expect(201);
    const liveCookie = refreshCookieOf(loginRes);

    // Expire the live token directly (owner oracle): set expires_at in the past.
    const raw = liveCookie.split(';')[0].split('=')[1];
    const { createHash } = await import('node:crypto');
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    await owner.$executeRawUnsafe(
      `UPDATE refresh_tokens SET expires_at = now() - interval '1 second' WHERE token_hash = '${tokenHash}'`,
    );

    // Presenting the merely-expired token is a plain 401, no chain revocation.
    const expired = await request(server)
      .post('/auth/refresh')
      .set('Cookie', liveCookie)
      .expect(401);
    expect((expired.body as { code: string }).code).toBe('INVALID_CREDENTIALS');

    // A sibling session of the same user still refreshes (chain intact).
    const login2 = await request(server)
      .post('/auth/login')
      .send({ email: `${RUN}-mgr@qsystem.local`, password: PASSWORD })
      .expect(201);
    await request(server)
      .post('/auth/refresh')
      .set('Cookie', refreshCookieOf(login2))
      .expect(201);
  });

  it('logout thu hồi refresh, idempotent, cookie bị xóa', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];

    const loginRes = await request(server)
      .post('/auth/login')
      .send({ email: `${RUN}-emp@qsystem.local`, password: PASSWORD })
      .expect(201);
    const cookie = refreshCookieOf(loginRes);

    // Logout revokes the token and clears the cookie.
    const out = await request(server)
      .post('/auth/logout')
      .set('Cookie', cookie)
      .expect(200);
    const cleared = (out.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cleared).toMatch(/refresh_token=/);

    // The logged-out token no longer refreshes.
    const afterLogout = await request(server)
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .expect(401);
    expect((afterLogout.body as { code: string }).code).toBe('REFRESH_REUSED');

    // Second logout with no cookie is still 200 (idempotent).
    await request(server).post('/auth/logout').expect(200);
  });

  it('sai mật khẩu 5 lần bị rate-limit 429 (per-account)', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    await resetLoginLimits(owner);

    for (let i = 0; i < 5; i++) {
      await request(server)
        .post('/auth/login')
        .send({ email: `${RUN}-emp@qsystem.local`, password: WRONG })
        .expect(401);
    }
    const limited = await request(server)
      .post('/auth/login')
      .send({ email: `${RUN}-emp@qsystem.local`, password: WRONG })
      .expect(429);
    expect((limited.body as { code: string }).code).toBe('RATE_LIMITED');
  });

  it('spray nhiều email từ 1 IP bị chặn per-IP 429', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    await resetLoginLimits(owner);

    // 5 attempts across DIFFERENT emails from this test process: the strict
    // per-IP bucket counts every attempt, so the 6th (any email) is 429.
    for (let i = 0; i < 5; i++) {
      await request(server)
        .post('/auth/login')
        .send({ email: `${RUN}-spray-${i}@qsystem.local`, password: WRONG });
    }
    const limited = await request(server)
      .post('/auth/login')
      .send({ email: `${RUN}-emp@qsystem.local`, password: PASSWORD })
      .expect(429);
    expect((limited.body as { code: string }).code).toBe('RATE_LIMITED');
    await resetLoginLimits(owner);
  });

  it('đổi mật khẩu với mật khẩu cũ sai bị 400; đổi đúng đá mọi session', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    await resetLoginLimits(owner);

    const loginRes = await request(server)
      .post('/auth/login')
      .send({ email: `${RUN}-mgr@qsystem.local`, password: PASSWORD })
      .expect(201);
    const access = (loginRes.body as { accessToken: string }).accessToken as string;
    const cookie = refreshCookieOf(loginRes);

    const res = await request(server)
      .patch('/me/password')
      .set('Authorization', `Bearer ${access}`)
      .send({ oldPassword: WRONG, newPassword: 'Brand-new-pass-1!' })
      .expect(400);
    expect((res.body as { code: string }).code).toBe('WRONG_PASSWORD');

    // Correct change revokes every live session: old refresh is dead.
    const login2 = await request(server)
      .post('/auth/login')
      .send({ email: `${RUN}-mgr@qsystem.local`, password: PASSWORD })
      .expect(201);
    const access2 = (login2.body as { accessToken: string }).accessToken as string;
    const cookie2 = refreshCookieOf(login2);

    await request(server)
      .patch('/me/password')
      .set('Authorization', `Bearer ${access2}`)
      .send({ oldPassword: PASSWORD, newPassword: 'Brand-new-pass-2!' })
      .expect(200);

    await request(server)
      .post('/auth/refresh')
      .set('Cookie', cookie2)
      .expect(401);

    // Restore the known password for later tests in this file order.
    const login3 = await request(server)
      .post('/auth/login')
      .send({ email: `${RUN}-mgr@qsystem.local`, password: 'Brand-new-pass-2!' })
      .expect(201);
    const access3 = (login3.body as { accessToken: string }).accessToken as string;
    await request(server)
      .patch('/me/password')
      .set('Authorization', `Bearer ${access3}`)
      .send({ oldPassword: 'Brand-new-pass-2!', newPassword: PASSWORD })
      .expect(200);
    void cookie;
  });
});
