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
const RUN = `sensors-${Date.now()}`;

// Owner-role connection: RLS-exempt bootstrap oracle used ONLY for fixtures
// and read-back verification (audit log assertion). Test traffic (supertest
// against the Nest app) connects as the restricted qsystem_app role via
// DATABASE_URL; the app itself never touches the owner.
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
process.env.TEST_JWT_SECRET ??= 'sensors-spec-local-only-do-not-reuse';
process.env.NODE_ENV ??= 'test';

const PASSWORD = 'Correct-horse-9!';

let app!: INestApplication;
let deptAId!: string;
let deptBId!: string;
let mgrAId!: string;
let dirToken!: string;
let mgrAToken!: string;
let mgrBToken!: string;
let empToken!: string;

async function loginAs(
  server: Parameters<typeof request>[0],
  email: string,
): Promise<string> {
  const res = await request(server)
    .post('/auth/login')
    .send({ email, password: PASSWORD })
    .expect(201);
  return (res.body as { accessToken: string }).accessToken as string;
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

  const passwordHash = await argon2.hash(PASSWORD);
  const deptA = await owner.department.create({
    data: { name: `${RUN}-deptA`, tenantId: null },
  });
  const deptB = await owner.department.create({
    data: { name: `${RUN}-deptB`, tenantId: null },
  });
  deptAId = deptA.id;
  deptBId = deptB.id;

  const director = await owner.user.create({
    data: {
      email: `${RUN}-dir@qsystem.local`,
      name: 'Sensors Director',
      passwordHash,
      role: 'DIRECTOR',
      tenantId: null,
    },
  });
  const mgrA = await owner.user.create({
    data: {
      email: `${RUN}-mgra@qsystem.local`,
      name: 'Sensors Manager A',
      passwordHash,
      role: 'MANAGER',
      departmentId: deptA.id,
      tenantId: null,
    },
  });
  mgrAId = mgrA.id;
  const mgrB = await owner.user.create({
    data: {
      email: `${RUN}-mgrb@qsystem.local`,
      name: 'Sensors Manager B',
      passwordHash,
      role: 'MANAGER',
      departmentId: deptB.id,
      tenantId: null,
    },
  });
  await owner.user.create({
    data: {
      email: `${RUN}-emp@qsystem.local`,
      name: 'Sensors Employee',
      passwordHash,
      role: 'EMPLOYEE',
      departmentId: deptA.id,
      reportsToId: mgrA.id,
      tenantId: null,
    },
  });
  await owner.department.update({
    where: { id: deptA.id },
    data: { managerId: mgrA.id },
  });
  await owner.department.update({
    where: { id: deptB.id },
    data: { managerId: mgrB.id },
  });
  void director;

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();

  const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
  resetLoginLimits();
  // Four logins total — under the per-IP 5/min budget (same-process Map).
  dirToken = await loginAs(server, `${RUN}-dir@qsystem.local`);
  mgrAToken = await loginAs(server, `${RUN}-mgra@qsystem.local`);
  mgrBToken = await loginAs(server, `${RUN}-mgrb@qsystem.local`);
  empToken = await loginAs(server, `${RUN}-emp@qsystem.local`);
}, 180000);

afterAll(async () => {
  await app?.close();
  await owner.$disconnect();
});

const FULL_4W = {
  what: 'Approve leave request',
  who: 'employee-1',
  when: '2026-11-12T09:00:00Z',
  where: 'Hanoi office',
};

describe('OrgModule + CASL sensors (Task 4)', () => {
  it('thiếu 1 trong 4W khi tạo TASK bị 422', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    const { where: _dropped, ...missingWhere } = FULL_4W;

    const res = await request(server)
      .post('/org/tasks')
      .set('Authorization', `Bearer ${dirToken}`)
      .send(missingWhere)
      .expect(422);
    expect((res.body as { code: string }).code).toBe('TASK_4W_INCOMPLETE');

    // Full 4W passes the sensor (stub TASK layer returns ok).
    await request(server)
      .post('/org/tasks')
      .set('Authorization', `Bearer ${dirToken}`)
      .send(FULL_4W)
      .expect(201);
  });

  it('LDP sửa TASK Luồng 2 bị 403 + có audit log', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];

    const res = await request(server)
      .patch('/org/tasks/task-luong-2')
      .set('Authorization', `Bearer ${mgrAToken}`)
      .send({ ...FULL_4W, flow: 'DIRECT' })
      .expect(403);
    expect((res.body as { code: string }).code).toBe('FLOW2_MONITOR_ONLY');

    // The block is audited: owner oracle sees a TASK row stamped by the manager.
    const audits = await owner.auditLog.findMany({
      where: { actorId: mgrAId, entity: 'TASK' },
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
    expect(audits[0]).toMatchObject({ action: 'FLOW2_BLOCKED', entityId: 'task-luong-2' });
  });

  it('response ẩn base_salary/bonus với MANAGER không quyền', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];

    const mgrRes = await request(server)
      .get('/org/users')
      .set('Authorization', `Bearer ${mgrAToken}`)
      .expect(200);
    const mgrRows = mgrRes.body as Record<string, unknown>[];
    expect(mgrRows.length).toBeGreaterThan(0);
    for (const row of mgrRows) {
      expect(row).not.toHaveProperty('base_salary');
      expect(row).not.toHaveProperty('bonus');
    }

    // DIRECTOR can read salary: stub keys stay visible.
    const dirRes = await request(server)
      .get('/org/users')
      .set('Authorization', `Bearer ${dirToken}`)
      .expect(200);
    const dirRows = dirRes.body as Record<string, unknown>[];
    expect(dirRows.length).toBeGreaterThan(0);
    for (const row of dirRows) {
      expect(row).toHaveProperty('base_salary');
      expect(row).toHaveProperty('bonus');
    }
    void mgrBToken;
    void empToken;
  });

  it('DIRECTOR sửa org OK; MANAGER sửa phòng khác bị 403', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];

    // MANAGER sees only the department they manage.
    const scoped = await request(server)
      .get('/org/departments')
      .set('Authorization', `Bearer ${mgrAToken}`)
      .expect(200);
    expect((scoped.body as { id: string }[]).map((d) => d.id)).toEqual([deptAId]);

    // DIRECTOR updates any department.
    const ok = await request(server)
      .patch(`/org/departments/${deptBId}`)
      .set('Authorization', `Bearer ${dirToken}`)
      .send({ name: `${RUN}-deptB-renamed` })
      .expect(200);
    expect((ok.body as { name: string }).name).toBe(`${RUN}-deptB-renamed`);

    // MANAGER updating a department they do not manage is 403.
    const blocked = await request(server)
      .patch(`/org/departments/${deptBId}`)
      .set('Authorization', `Bearer ${mgrAToken}`)
      .send({ name: `${RUN}-deptB-hijack` })
      .expect(403);
    expect((blocked.body as { code: string }).code).toBe('FORBIDDEN');
  });
});
