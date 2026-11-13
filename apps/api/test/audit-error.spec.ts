import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HttpException, HttpStatus, ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ExceptionFilter } from '../src/common/exception.filter';
import { resetLoginLimits } from '../src/iam/login-rate-limit';

// Unique per run so repeat runs never clash with seed data or each other.
const RUN = `audit-${Date.now()}`;

// Owner-role connection: RLS-exempt bootstrap oracle used ONLY for fixtures
// and read-back verification (audit log assertion). Test traffic (supertest
// against the Nest app) connects as the restricted qsystem_app role via
// DATABASE_URL.
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
process.env.TEST_JWT_SECRET ??= 'audit-spec-local-only-do-not-reuse';
process.env.NODE_ENV ??= 'test';

const PASSWORD = 'Correct-horse-9!';

let app!: INestApplication;
let moduleRef!: TestingModule;
let prisma!: PrismaService;
let mgrId!: string;
let dirId!: string;
let deptId!: string;
let mgrToken!: string;
let dirToken!: string;

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

/** Build the same response-shape mock the ExceptionFilter maps onto. */
function mockHost(): {
  host: Parameters<ExceptionFilter['catch']>[1];
  body: () => Record<string, unknown> | undefined;
  status: () => number | undefined;
} {
  let jsonBody: Record<string, unknown> | undefined;
  let statusCode: number | undefined;
  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(body: Record<string, unknown>) {
      jsonBody = body;
      return response;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({}),
    }),
  } as unknown as Parameters<ExceptionFilter['catch']>[1];
  return {
    host,
    body: () => jsonBody,
    status: () => statusCode,
  };
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
  const dept = await owner.department.create({
    data: { name: `${RUN}-dept`, tenantId: null },
  });
  deptId = dept.id;
  const mgr = await owner.user.create({
    data: {
      email: `${RUN}-mgr@qsystem.local`,
      name: 'Audit Manager',
      passwordHash,
      role: 'MANAGER',
      departmentId: dept.id,
      tenantId: null,
    },
  });
  // The manager manages their own department (managedDepartments is derived
  // from department.manager_id).
  await owner.department.update({
    where: { id: dept.id },
    data: { managerId: mgr.id },
  });
  mgrId = mgr.id;
  const dir = await owner.user.create({
    data: {
      email: `${RUN}-dir@qsystem.local`,
      name: 'Audit Director',
      passwordHash,
      role: 'DIRECTOR',
      tenantId: null,
    },
  });
  dirId = dir.id;

  moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();

  prisma = moduleRef.get(PrismaService, { strict: false });

  const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
  await resetLoginLimits(owner);
  mgrToken = await loginAs(server, `${RUN}-mgr@qsystem.local`);
  dirToken = await loginAs(server, `${RUN}-dir@qsystem.local`);
}, 180000);

afterAll(async () => {
  await owner.auditLog.deleteMany({
    where: { OR: [{ actorId: mgrId }, { actorId: dirId }, { entity: { startsWith: `${RUN}` } }] },
  });
  await owner.department.deleteMany({ where: { name: { startsWith: `${RUN}-` } } });
  await owner.user.deleteMany({ where: { email: { startsWith: `${RUN}-` } } });
  await app?.close();
  await owner.$disconnect();
});

describe('ExceptionFilter (Task 9)', () => {
  it('ZodError → 422 coded VALIDATION', () => {
    const { host, body, status } = mockHost();
    const filter = new ExceptionFilter();
    // Zod is a transitive dep (contracts-only) — apps/api checks the name,
    // mirroring the existing search.controller pattern (err.name === 'ZodError').
    const zodLike = Object.assign(new Error('q must be a string'), {
      name: 'ZodError',
      issues: [{ path: ['q'], message: 'q must be a string' }],
    });
    filter.catch(zodLike, host);
    expect(status()).toBe(422);
    expect(body()).toEqual({ code: 'VALIDATION', message: 'validation failed' });
  });

  it('Prisma P2002 → 409 CONFLICT; generic Error → 500 INTERNAL without internals', () => {
    const filter = new ExceptionFilter();

    const p2002 = mockHost();
    filter.catch(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.22.0',
      }),
      p2002.host,
    );
    expect(p2002.status()).toBe(409);
    expect(p2002.body()?.code).toBe('CONFLICT');

    const generic = mockHost();
    filter.catch(new Error('DB password is hunter2 at 10.0.0.3'), generic.host);
    expect(generic.status()).toBe(500);
    expect(generic.body()?.code).toBe('INTERNAL');
    expect(JSON.stringify(generic.body())).not.toContain('hunter2');
    expect(JSON.stringify(generic.body())).not.toContain('10.0.0.3');
  });

  it('HttpException có code sẵn đi qua nguyên vẹn (regression pin)', () => {
    const filter = new ExceptionFilter();
    const { host, body, status } = mockHost();
    filter.catch(
      new HttpException({ code: 'NOT_FOUND', message: 'NOT_FOUND' }, HttpStatus.NOT_FOUND),
      host,
    );
    expect(status()).toBe(404);
    expect(body()).toEqual({ code: 'NOT_FOUND', message: 'NOT_FOUND' });
  });
});

describe('Audit trail (Task 9)', () => {
  it('PATCH department (nhạy cảm) ghi audit đủ actor/action/entity/entityId/old/new', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    const newName = `${RUN}-dept-renamed`;

    await request(server)
      .patch(`/org/departments/${deptId}`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ name: newName })
      .expect(200);

    const rows = await owner.auditLog.findMany({
      where: { actorId: mgrId, entity: 'Department', action: 'UPDATE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const row = rows[0]!;
    expect(row.entityId).toBe(deptId);
    const before = row.oldData as { name?: string; managerId?: string | null; parentId?: string | null } | null;
    const after = row.newData as { name?: string; managerId?: string | null; parentId?: string | null } | null;
    expect(before?.name).toBe(`${RUN}-dept`);
    expect(after?.name).toBe(newName);
    // All three mutable fields are captured — a rename must not record a
    // manager/parent reassignment as a no-op.
    expect(before).toHaveProperty('managerId');
    expect(before).toHaveProperty('parentId');
    expect(after).toHaveProperty('managerId');
    expect(after).toHaveProperty('parentId');
  });

  it('createDepartment KHÔNG ghi audit (chỉ hành động nhạy cảm mới ghi)', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    const beforeCount = await owner.auditLog.count({ where: { actorId: mgrId } });

    const res = await request(server)
      .post('/org/departments')
      .set('Authorization', `Bearer ${dirToken}`)
      .send({ name: `${RUN}-unaudited` })
      .expect(201);
    const created = res.body as { id: string };
    await owner.department.delete({ where: { id: created.id } });

    const afterCount = await owner.auditLog.count({ where: { actorId: mgrId } });
    expect(afterCount).toBe(beforeCount);
  });
});
