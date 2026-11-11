import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';

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

process.env.JWT_SECRET ??= 'test-only-secret-do-not-use-in-prod';
process.env.NODE_ENV ??= 'test';

const PASSWORD = 'Correct-horse-9!';
const WRONG = 'Wrong-password-0!';

let app!: INestApplication;

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

  // Fixture users with REAL Argon2 hashes (emails unique per RUN).
  const dept = await owner.department.create({
    data: { name: `${RUN}-dept`, tenantId: null },
  });
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
    expect(meRes.body.managedDepartmentIds).toContainEqual(
      expect.any(String),
    );
  });

  it('refresh xoay vòng: reuse refresh cũ bị 401 + thu hồi chuỗi', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];

    const loginRes = await request(server)
      .post('/auth/login')
      .send({ email: `${RUN}-emp@qsystem.local`, password: PASSWORD })
      .expect(201);
    const firstCookie = (
      loginRes.headers['set-cookie'] as unknown as string[]
    ).find((c) => c.startsWith('refresh_token='));
    expect(firstCookie).toBeDefined();

    // First rotation succeeds and issues a fresh cookie.
    const rotated = await request(server)
      .post('/auth/refresh')
      .set('Cookie', firstCookie as string)
      .expect(201);
    expect((rotated.body as { accessToken: string }).accessToken).toEqual(expect.any(String));

    // Reusing the old (already rotated) cookie must fail and revoke the chain.
    await request(server)
      .post('/auth/refresh')
      .set('Cookie', firstCookie as string)
      .expect(401);

    // The rotated token from the compromised chain is revoked too.
    const rotatedCookie = (
      rotated.headers['set-cookie'] as unknown as string[]
    ).find((c) => c.startsWith('refresh_token='));
    await request(server)
      .post('/auth/refresh')
      .set('Cookie', rotatedCookie as string)
      .expect(401);
  });

  it('sai mật khẩu 5 lần bị rate-limit 429', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];

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

  it('đổi mật khẩu với mật khẩu cũ sai bị 400', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];

    // NOTE: uses the manager account — the employee login above is rate-limited.
    const loginRes = await request(server)
      .post('/auth/login')
      .send({ email: `${RUN}-mgr@qsystem.local`, password: PASSWORD })
      .expect(201);

    const res = await request(server)
      .patch('/me/password')
      .set('Authorization', `Bearer ${(loginRes.body as { accessToken: string }).accessToken as string}`)
      .send({ oldPassword: WRONG, newPassword: 'Brand-new-pass-1!' })
      .expect(400);
    expect((res.body as { code: string }).code).toBe('WRONG_PASSWORD');
  });
});
