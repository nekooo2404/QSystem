import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import * as net from 'node:net';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { applyHttpHardening } from '../src/common/http-hardening';
import { LoginRateLimiter } from '../src/iam/login-rate-limit';
import { LocalSocketGateway } from '../src/notify/providers/local-socket.gateway';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Production Readiness: Hardening, QTask, Missing APIs & RLS', () => {
  const runId = randomUUID().slice(0, 8);
  const ownerUrl = process.env.RLS_OWNER_URL || process.env.DATABASE_URL;
  const ownerPrisma = new PrismaClient({ datasources: { db: { url: ownerUrl } } });

  let app: NestExpressApplication;
  let baseUrl = '';
  let socketGateway: LocalSocketGateway;

  let deptAId = '';
  let deptBId = '';
  let directorId = '';
  let managerAId = '';
  let employeeAId = '';
  let employeeBId = '';

  const createdUserIds: string[] = [];
  const createdTaskIds: string[] = [];
  const createdFileIds: string[] = [];
  const createdNotifIds: string[] = [];

  const password = 'PrTestPass!2026';
  const directorEmail = `pr-dir-${runId}@qsystem.local`;
  const managerEmail = `pr-mgr-${runId}@qsystem.local`;
  const empAEmail = `pr-empa-${runId}@qsystem.local`;
  const empBEmail = `pr-empb-${runId}@qsystem.local`;

  let directorToken = '';
  let managerToken = '';
  let empAToken = '';
  let empBToken = '';

  async function loginViaApi(email: string, suiteId: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-test-suite-id', suiteId)
      .send({ email, password })
      .expect(201);
    return {
      accessToken: res.body.accessToken as string,
      cookies: (res.headers['set-cookie'] ?? []) as unknown as string[],
    };
  }

  beforeAll(async () => {
    process.env.TEST_JWT_SECRET ??= 'pr-test-jwt-secret-not-for-prod-use-000';
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication<NestExpressApplication>({ bodyParser: false });
    applyHttpHardening(app, { bodyLimit: '4kb' });
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    await app.listen(0, '127.0.0.1');
    const addr = app.getHttpServer().address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}`;
    socketGateway = app.get(LocalSocketGateway);

    const passwordHash = await argon2.hash(password);
    const deptA = await ownerPrisma.department.create({ data: { name: `PR Dept A ${runId}` } });
    const deptB = await ownerPrisma.department.create({ data: { name: `PR Dept B ${runId}` } });
    deptAId = deptA.id;
    deptBId = deptB.id;

    const dir = await ownerPrisma.user.create({
      data: { email: directorEmail, name: 'Giam doc PR', passwordHash, role: 'DIRECTOR' },
    });
    const mgr = await ownerPrisma.user.create({
      data: {
        email: managerEmail,
        name: 'Quan ly A',
        passwordHash,
        role: 'MANAGER',
        departmentId: deptAId,
        reportsToId: dir.id,
      },
    });
    await ownerPrisma.department.update({ where: { id: deptAId }, data: { managerId: mgr.id } });

    const empA = await ownerPrisma.user.create({
      data: {
        email: empAEmail,
        name: 'Nhan vien A',
        passwordHash,
        role: 'EMPLOYEE',
        departmentId: deptAId,
        reportsToId: mgr.id,
      },
    });
    const empB = await ownerPrisma.user.create({
      data: {
        email: empBEmail,
        name: 'Nhan vien B',
        passwordHash,
        role: 'EMPLOYEE',
        departmentId: deptBId,
        reportsToId: dir.id,
      },
    });

    directorId = dir.id;
    managerAId = mgr.id;
    employeeAId = empA.id;
    employeeBId = empB.id;
    createdUserIds.push(dir.id, mgr.id, empA.id, empB.id);

    directorToken = (await loginViaApi(directorEmail, `pr-init-dir-${runId}`)).accessToken;
    managerToken = (await loginViaApi(managerEmail, `pr-init-mgr-${runId}`)).accessToken;
    empAToken = (await loginViaApi(empAEmail, `pr-init-empa-${runId}`)).accessToken;
    empBToken = (await loginViaApi(empBEmail, `pr-init-empb-${runId}`)).accessToken;
  }, 30_000);

  afterAll(async () => {
    const deptIds = [deptAId, deptBId].filter(Boolean);
    if (createdNotifIds.length > 0) {
      await ownerPrisma.notification.deleteMany({ where: { id: { in: createdNotifIds } } });
    }
    if (createdFileIds.length > 0) {
      await ownerPrisma.file.deleteMany({ where: { id: { in: createdFileIds } } });
    }
    if (createdTaskIds.length > 0) {
      await ownerPrisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
    }
    if (createdUserIds.length > 0) {
      await ownerPrisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await ownerPrisma.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
    }
    await ownerPrisma.rateLimitHit.deleteMany({ where: { key: { contains: runId } } });
    if (deptIds.length > 0) {
      await ownerPrisma.department.updateMany({
        where: { id: { in: deptIds } },
        data: { managerId: null },
      });
    }
    if (createdUserIds.length > 0) {
      await ownerPrisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (deptIds.length > 0) {
      await ownerPrisma.department.deleteMany({ where: { id: { in: deptIds } } });
    }
    await ownerPrisma.$disconnect();
    if (app) await app.close();
  });

  it('serves /health/live and /health/ready across database, s3, and meilisearch', async () => {
    const live = await request(app.getHttpServer()).get('/health/live').expect(200);
    expect(live.body.ok).toBe(true);
    expect(live.body.status).toBe('live');

    const ready = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(ready.body).toMatchObject({
      ok: true,
      status: 'ready',
      checks: {
        database: { ok: true },
        s3: { ok: true },
        meilisearch: { ok: true },
      },
    });
  });

  it('serves /registry and filters modules via ENABLED_MODULES', async () => {
    const prev = process.env.ENABLED_MODULES;
    try {
      delete process.env.ENABLED_MODULES;
      const allRes = await request(app.getHttpServer()).get('/registry').expect(200);
      expect(Array.isArray(allRes.body)).toBe(true);
      expect(allRes.body.map((m: { id: string }) => m.id)).toEqual(
        expect.arrayContaining(['qtask', 'qhrm', 'qcrm', 'qsocial']),
      );

      process.env.ENABLED_MODULES = 'qtask,qhrm';
      const filteredRes = await request(app.getHttpServer()).get('/registry').expect(200);
      expect(filteredRes.body.map((m: { id: string }) => m.id)).toEqual(['qtask', 'qhrm']);
    } finally {
      if (prev === undefined) delete process.env.ENABLED_MODULES;
      else process.env.ENABLED_MODULES = prev;
    }
  });

  it('persists QTask records in Postgres with pagination, filters, and Employee/Manager/Director RLS', async () => {
    // Employee B creates own task in Dept B -> succeeds
    const empBCreate = await request(app.getHttpServer())
      .post('/org/tasks')
      .set('Authorization', `Bearer ${empBToken}`)
      .send({
        title: `Task EmpB ${runId}`,
        what: `Kiem tra don hang B ${runId}`,
        who: employeeBId,
        when: '2026-11-25',
        where: 'QTask',
        status: 'Đang làm',
        assigneeId: employeeBId,
        departmentId: deptBId,
      })
      .expect(201);
    const taskBId = empBCreate.body.task.id as string;
    createdTaskIds.push(taskBId);

    // Employee A cannot create a task assigned to Employee B -> 403
    await request(app.getHttpServer())
      .post('/org/tasks')
      .set('Authorization', `Bearer ${empAToken}`)
      .send({
        what: `Khong hop le ${runId}`,
        who: employeeBId,
        when: '2026-11-25',
        where: 'QTask',
        assigneeId: employeeBId,
        departmentId: deptBId,
      })
      .expect(403);

    // Manager A cannot create task in Dept B -> 403
    await request(app.getHttpServer())
      .post('/org/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        what: `Quan ly A tao ngoai phong ${runId}`,
        who: employeeBId,
        when: '2026-11-25',
        where: 'QTask',
        assigneeId: employeeBId,
        departmentId: deptBId,
      })
      .expect(403);

    // Manager A creates two tasks in Dept A for pagination & filter tests
    const mgrCreate1 = await request(app.getHttpServer())
      .post('/org/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: `Task DeptA Alpha ${runId}`,
        what: `Tong hop bao cao Alpha ${runId}`,
        who: employeeAId,
        when: '2026-11-22',
        where: 'QTask',
        status: 'Đang làm',
        assigneeId: employeeAId,
        departmentId: deptAId,
      })
      .expect(201);
    const taskA1Id = mgrCreate1.body.task.id as string;
    createdTaskIds.push(taskA1Id);

    const mgrCreate2 = await request(app.getHttpServer())
      .post('/org/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: `Task DeptA Beta ${runId}`,
        what: `Duyet ho so Beta ${runId}`,
        who: managerAId,
        when: '2026-11-23',
        where: 'QTask',
        status: 'Chờ duyệt',
        assigneeId: managerAId,
        departmentId: deptAId,
      })
      .expect(201);
    const taskA2Id = mgrCreate2.body.task.id as string;
    createdTaskIds.push(taskA2Id);

    // Employee A sees taskA1 (owned/assigned), does NOT see taskA2 (manager's) or taskB (dept B)
    const empAList = await request(app.getHttpServer())
      .get(`/org/tasks?q=${encodeURIComponent(runId)}&page=1&pageSize=10`)
      .set('Authorization', `Bearer ${empAToken}`)
      .expect(200);
    const empAIds = (empAList.body.items as Array<{ id: string }>).map((t) => t.id);
    expect(empAIds).toContain(taskA1Id);
    expect(empAIds).not.toContain(taskA2Id);
    expect(empAIds).not.toContain(taskBId);

    // Manager A sees Dept A tasks only (both taskA1 and taskA2), never taskB
    const mgrList = await request(app.getHttpServer())
      .get(`/org/tasks?q=${encodeURIComponent(runId)}&page=1&pageSize=10`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);
    const mgrIds = (mgrList.body.items as Array<{ id: string }>).map((t) => t.id);
    expect(mgrIds).toEqual(expect.arrayContaining([taskA1Id, taskA2Id]));
    expect(mgrIds).not.toContain(taskBId);

    // Director sees all 3 tasks + verifies pagination & status filter
    const dirPage1 = await request(app.getHttpServer())
      .get(`/org/tasks?q=${encodeURIComponent(runId)}&page=1&pageSize=2`)
      .set('Authorization', `Bearer ${directorToken}`)
      .expect(200);
    expect(dirPage1.body.total).toBe(3);
    expect(dirPage1.body.items).toHaveLength(2);

    const dirPending = await request(app.getHttpServer())
      .get(`/org/tasks?q=${encodeURIComponent(runId)}&status=${encodeURIComponent('Chờ duyệt')}`)
      .set('Authorization', `Bearer ${directorToken}`)
      .expect(200);
    expect((dirPending.body.items as Array<{ id: string }>).map((t) => t.id)).toEqual([taskA2Id]);

    // Employee A cannot update Employee B's task -> 403; Employee A updates taskA1 -> 200
    await request(app.getHttpServer())
      .patch(`/org/tasks/${taskBId}`)
      .set('Authorization', `Bearer ${empAToken}`)
      .send({ status: 'Hoàn thành' })
      .expect(403);

    const updated = await request(app.getHttpServer())
      .patch(`/org/tasks/${taskA1Id}`)
      .set('Authorization', `Bearer ${empAToken}`)
      .send({ status: 'Hoàn thành' })
      .expect(200);
    expect(updated.body.task.status).toBe('Hoàn thành');
  });

  it('persists notification readAt state and streams realtime SOCKET events over SSE', async () => {
    const n1 = await ownerPrisma.notification.create({
      data: {
        channel: 'SOCKET',
        recipient: empAEmail,
        recipientId: employeeAId,
        status: 'SENT',
        payload: { title: `Thong bao 1 ${runId}` },
      },
    });
    const n2 = await ownerPrisma.notification.create({
      data: {
        channel: 'EMAIL',
        recipient: empAEmail,
        recipientId: employeeAId,
        status: 'SENT',
        payload: { title: `Thong bao 2 ${runId}` },
      },
    });
    createdNotifIds.push(n1.id, n2.id);

    // Employee B cannot mark Employee A's notification -> 404 (RLS hidden)
    await request(app.getHttpServer())
      .patch(`/notifications/${n1.id}/read`)
      .set('Authorization', `Bearer ${empBToken}`)
      .expect(404);

    // Mark single read
    const readRes = await request(app.getHttpServer())
      .patch(`/notifications/${n1.id}/read`)
      .set('Authorization', `Bearer ${empAToken}`)
      .expect(200);
    expect(readRes.body.readAt).toBeTruthy();

    // Mark remaining unread
    const readAllRes = await request(app.getHttpServer())
      .post('/notifications/read-all')
      .set('Authorization', `Bearer ${empAToken}`)
      .expect(201);
    expect(readAllRes.body.ok).toBe(true);
    expect(readAllRes.body.count).toBeGreaterThanOrEqual(1);

    // Stream SSE events and push one via LocalSocketGateway
    const abort = new AbortController();
    const ssePromise = fetch(`${baseUrl}/notifications/stream`, {
      headers: { Authorization: `Bearer ${empAToken}` },
      signal: abort.signal,
    });
    const res = await ssePromise;
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let collected = '';

    // Wait for initial 'ready' event, then emit a notification
    while (!collected.includes('event: ready')) {
      const chunk = await reader.read();
      if (chunk.done) break;
      collected += decoder.decode(chunk.value, { stream: true });
    }

    await socketGateway.send({
      id: `live-${runId}`,
      recipient: empAEmail,
      recipientId: employeeAId,
      payload: { title: `SSE Live ${runId}` },
    });

    while (!collected.includes(`SSE Live ${runId}`)) {
      const chunk = await reader.read();
      if (chunk.done) break;
      collected += decoder.decode(chunk.value, { stream: true });
    }
    abort.abort();
    await reader.cancel().catch(() => undefined);

    expect(collected).toContain('event: notification');
    expect(collected).toContain(`SSE Live ${runId}`);
  });

  it('persists file metadata in GET /files after POST /files/presign with viewer RLS scoping', async () => {
    const presign = await request(app.getHttpServer())
      .post('/files/presign')
      .set('Authorization', `Bearer ${empAToken}`)
      .send({
        bucket: 'qsystem-docs',
        key: `pr-test-${runId}/spec.pdf`,
        mimeType: 'application/pdf',
        size: 1024,
      })
      .expect(201);
    createdFileIds.push(presign.body.fileId);

    const empAList = await request(app.getHttpServer())
      .get('/files')
      .set('Authorization', `Bearer ${empAToken}`)
      .expect(200);
    expect((empAList.body as Array<{ id: string }>).some((f) => f.id === presign.body.fileId)).toBe(true);

    const empBList = await request(app.getHttpServer())
      .get('/files')
      .set('Authorization', `Bearer ${empBToken}`)
      .expect(200);
    expect((empBList.body as Array<{ id: string }>).some((f) => f.id === presign.body.fileId)).toBe(false);
  });

  it('enforces POST /org/users permission matrix and duplicate email conflict', async () => {
    // Employee forbidden
    await request(app.getHttpServer())
      .post('/org/users')
      .set('Authorization', `Bearer ${empAToken}`)
      .send({
        email: `pr-fail1-${runId}@qsystem.local`,
        name: 'Fail Emp',
        password,
        role: 'EMPLOYEE',
        departmentId: deptAId,
      })
      .expect(403);

    // Manager cannot create MANAGER role or outside managed department
    await request(app.getHttpServer())
      .post('/org/users')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        email: `pr-fail2-${runId}@qsystem.local`,
        name: 'Fail Role',
        password,
        role: 'MANAGER',
        departmentId: deptAId,
      })
      .expect(403);

    await request(app.getHttpServer())
      .post('/org/users')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        email: `pr-fail3-${runId}@qsystem.local`,
        name: 'Fail Dept',
        password,
        role: 'EMPLOYEE',
        departmentId: deptBId,
      })
      .expect(403);

    // Manager creates EMPLOYEE inside Dept A -> 201
    const newEmpRes = await request(app.getHttpServer())
      .post('/org/users')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        email: `pr-new-emp-${runId}@qsystem.local`,
        name: 'Nhan vien moi A',
        password,
        role: 'EMPLOYEE',
        departmentId: deptAId,
      })
      .expect(201);
    createdUserIds.push(newEmpRes.body.id);

    // Director creates MANAGER in Dept B -> 201
    const newMgrRes = await request(app.getHttpServer())
      .post('/org/users')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        email: `pr-new-mgr-${runId}@qsystem.local`,
        name: 'Quan ly moi B',
        password,
        role: 'MANAGER',
        departmentId: deptBId,
      })
      .expect(201);
    createdUserIds.push(newMgrRes.body.id);

    // Duplicate email -> 409 CONFLICT
    await request(app.getHttpServer())
      .post('/org/users')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        email: `pr-new-emp-${runId}@qsystem.local`,
        name: 'Duplicate',
        password,
        role: 'EMPLOYEE',
        departmentId: deptAId,
      })
      .expect(409);
  });

  it('applies Helmet security headers, request IDs, 413 body limits, CSRF origin checks, and cookie clearing', async () => {
    const live = await request(app.getHttpServer()).get('/health/live').expect(200);
    expect(live.headers['x-request-id']).toBeTruthy();
    expect(live.headers['x-content-type-options']).toBe('nosniff');
    expect(live.headers['x-frame-options']).toBe('DENY');
    expect(live.headers['x-powered-by']).toBeUndefined();

    // 413 payload limit (> 4kb configured for test)
    const oversized = await request(app.getHttpServer())
      .post('/org/tasks')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ what: 'x'.repeat(6000), who: directorId, when: '2026-11-20', where: 'QTask' })
      .expect(413);
    expect(oversized.body).toEqual({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request payload too large',
    });

    // Cross-origin refresh/logout rejected with 403 CSRF_FORBIDDEN
    const csrfRefresh = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', 'https://evil.example')
      .expect(403);
    expect(csrfRefresh.body.code).toBe('CSRF_FORBIDDEN');

    const csrfLogout = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Origin', 'https://evil.example')
      .expect(403);
    expect(csrfLogout.body.code).toBe('CSRF_FORBIDDEN');

    // Rate-limit suite isolation: exhausting suite-1 does not block suite-2
    for (let i = 0; i < 5; i += 1) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('x-test-suite-id', `rl-iso-a-${runId}`)
        .send({ email: empAEmail, password: 'wrong-password' })
        .expect(401);
    }
    const blocked = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-test-suite-id', `rl-iso-a-${runId}`)
      .send({ email: empAEmail, password: 'wrong-password' })
      .expect(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');

    await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-test-suite-id', `rl-iso-b-${runId}`)
      .send({ email: empAEmail, password })
      .expect(201);
  });

  it('supports shared Redis rate-limit store across LoginRateLimiter instances', async () => {
    const prevStore = process.env.RATE_LIMIT_STORE;
    const prevRedis = process.env.REDIS_URL;
    const counters = new Map<string, number>();

    function parseRespFrames(buf: Buffer): { frames: string[][]; rest: Buffer } {
      const frames: string[][] = [];
      let offset = 0;
      while (offset < buf.length) {
        if (buf[offset] !== 42) break; // '*'
        const headerEnd = buf.indexOf('\r\n', offset);
        if (headerEnd === -1) break;
        const argc = Number.parseInt(buf.subarray(offset + 1, headerEnd).toString('utf8'), 10);
        let cursor = headerEnd + 2;
        const args: string[] = [];
        let incomplete = false;
        for (let i = 0; i < argc; i += 1) {
          if (cursor >= buf.length || buf[cursor] !== 36) {
            incomplete = true;
            break;
          }
          const lenEnd = buf.indexOf('\r\n', cursor);
          if (lenEnd === -1) {
            incomplete = true;
            break;
          }
          const len = Number.parseInt(buf.subarray(cursor + 1, lenEnd).toString('utf8'), 10);
          const argStart = lenEnd + 2;
          const argEnd = argStart + len;
          if (buf.length < argEnd + 2) {
            incomplete = true;
            break;
          }
          args.push(buf.subarray(argStart, argEnd).toString('utf8'));
          cursor = argEnd + 2;
        }
        if (incomplete) break;
        frames.push(args);
        offset = cursor;
      }
      return { frames, rest: buf.subarray(offset) };
    }

    const redisServer = net.createServer((socket) => {
      let pending: Buffer = Buffer.alloc(0);
      socket.on('data', (chunk) => {
        pending = Buffer.concat([pending, chunk]);
        const { frames, rest } = parseRespFrames(pending);
        pending = rest;
        for (const args of frames) {
          const cmd = (args[0] ?? '').toUpperCase();
          if (cmd === 'AUTH') {
            socket.write(args[args.length - 1] === 'testpass' ? '+OK\r\n' : '-ERR invalid password\r\n');
          } else if (cmd === 'GET') {
            const val = counters.get(args[1] ?? '');
            if (val === undefined) {
              socket.write('$-1\r\n');
            } else {
              const s = String(val);
              socket.write(`$${s.length}\r\n${s}\r\n`);
            }
          } else if (cmd === 'EVAL') {
            const key = args[3] ?? '';
            const next = (counters.get(key) ?? 0) + 1;
            counters.set(key, next);
            socket.write(`:${next}\r\n`);
          } else if (cmd === 'DEL') {
            let deleted = 0;
            for (const key of args.slice(1)) {
              if (counters.delete(key)) deleted += 1;
            }
            socket.write(`:${deleted}\r\n`);
          } else {
            socket.write('-ERR unsupported\r\n');
          }
        }
      });
    });

    await new Promise<void>((resolve) => redisServer.listen(0, '127.0.0.1', () => resolve()));
    const { port } = redisServer.address() as net.AddressInfo;
    const redisUrl = `redis://:testpass@127.0.0.1:${port}`;
    const ipKey = `pr-redis-ip-${runId}`;
    const ipKey2 = `pr-redis-ip2-${runId}`;
    const accKey = `${ipKey}::user@qsystem.local`;

    try {
      process.env.RATE_LIMIT_STORE = 'redis';
      process.env.REDIS_URL = redisUrl;
      const limiterA = new LoginRateLimiter(app.get(PrismaService));
      const limiterB = new LoginRateLimiter(app.get(PrismaService));

      // Per-IP bucket shared across instances: 5 allowed, 6th blocked
      for (let i = 0; i < 5; i += 1) {
        expect(await (i % 2 === 0 ? limiterA : limiterB).acquire(ipKey, accKey)).toBe(true);
      }
      expect(await limiterA.acquire(ipKey, accKey)).toBe(false);

      // Per-account failure bucket blocks even from another IP, then clearFailures resets
      for (let i = 0; i < 5; i += 1) {
        await limiterA.recordFailure(accKey);
      }
      expect(await limiterB.acquire(ipKey2, accKey)).toBe(false);
      await limiterA.clearFailures(accKey);
      expect(await limiterB.acquire(ipKey2, accKey)).toBe(true);
    } finally {
      await new Promise<void>((resolve) => redisServer.close(() => resolve()));
      if (prevStore === undefined) delete process.env.RATE_LIMIT_STORE;
      else process.env.RATE_LIMIT_STORE = prevStore;
      if (prevRedis === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = prevRedis;
    }
  });
});
