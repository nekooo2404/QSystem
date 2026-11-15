import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { isAllowed, scopeFor } from '../src/prisma/prisma-scope.extension';
import { NotifyService } from '../src/notify/notify.service';
import { NotifyWorker, REAP_GRACE_MS } from '../src/notify/notify.worker';
import { LocalEmailProvider } from '../src/notify/providers/local-email.provider';
import { resetLoginLimits } from '../src/iam/login-rate-limit';

// Unique per run so repeat runs never clash with seed data or each other.
const RUN = `notify-${Date.now()}`;

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
process.env.TEST_JWT_SECRET ??= 'notify-spec-local-only-do-not-reuse';
process.env.NODE_ENV ??= 'test';

const PASSWORD = 'Correct-horse-9!';

let app!: INestApplication;
let moduleRef!: TestingModule;
let prisma!: PrismaService;
let notify!: NotifyService;
let worker!: NotifyWorker;
let email!: LocalEmailProvider;
let userA!: { id: string; email: string };
let userB!: { id: string; email: string };
let userDir!: { id: string; email: string };
let tokenA!: string;
let tokenB!: string;
let tokenDir!: string;

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
  userA = await owner.user.create({
    data: {
      email: `${RUN}-a@qsystem.local`,
      name: 'Notify User A',
      passwordHash,
      role: 'EMPLOYEE',
      tenantId: null,
    },
  });
  userB = await owner.user.create({
    data: {
      email: `${RUN}-b@qsystem.local`,
      name: 'Notify User B',
      passwordHash,
      role: 'EMPLOYEE',
      tenantId: null,
    },
  });
  userDir = await owner.user.create({
    data: {
      email: `${RUN}-dir@qsystem.local`,
      name: 'Notify Director',
      passwordHash,
      role: 'DIRECTOR',
      tenantId: null,
    },
  });

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
  notify = moduleRef.get(NotifyService, { strict: false });
  worker = moduleRef.get(NotifyWorker, { strict: false });
  // The local email provider is the module's real EMAIL adapter (logs only,
  // no SMTP); tests flip its `mode` to drive delivery vs outage.
  email = moduleRef.get(LocalEmailProvider, { strict: false });
  email.calls.length = 0;

  const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
  await resetLoginLimits(owner);
  tokenA = await loginAs(server, userA.email);
  tokenB = await loginAs(server, userB.email);
  tokenDir = await loginAs(server, userDir.email);
}, 180000);

afterAll(async () => {
  await owner.notification.deleteMany({
    where: {
      OR: [
        { recipientId: userA?.id },
        { recipientId: userB?.id },
        { recipientId: userDir?.id },
        { recipient: { startsWith: `${RUN}-` } },
      ],
    },
  });
  await owner.user.deleteMany({ where: { email: { startsWith: `${RUN}-` } } });
  await app?.close();
  await owner.$disconnect();
});

describe('NotificationModule outbox + local workers (Task 6)', () => {
  it('enqueue ghi outbox PENDING + worker tick gửi thành SENT', async () => {
    email.mode = 'ok';
    const created = await notify.enqueue({
      channel: 'EMAIL',
      recipient: `${RUN}-happy@qsystem.local`,
      recipientId: userA.id,
      payload: { subject: 'hello', body: 'outbox row' },
    });
    expect(created.status).toBe('PENDING');
    expect(created.attempts).toBe(0);
    expect(created.id).toBeTruthy();

    // Owner-oracle read-back: the PENDING row is durable before the worker runs.
    const stored = await owner.notification.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.status).toBe('PENDING');
    expect(stored.attempts).toBe(0);
    expect(stored.recipientId).toBe(userA.id);
    expect(stored.recipient).toBe(`${RUN}-happy@qsystem.local`);

    await worker.tick();

    const after = await owner.notification.findUniqueOrThrow({ where: { id: created.id } });
    expect(after.status).toBe('SENT');
    expect(after.attempts).toBe(1);
    expect(email.calls.some((c) => c.recipient === `${RUN}-happy@qsystem.local`)).toBe(true);
  });

  it('provider lỗi 3 lần → DEAD; tick thứ 4 không tăng attempts', async () => {
    email.mode = 'fail';
    const created = await notify.enqueue({
      channel: 'EMAIL',
      recipient: `${RUN}-dead@qsystem.local`,
      recipientId: userA.id,
    });

    await worker.tick();
    await worker.tick();
    const afterTwo = await owner.notification.findUniqueOrThrow({ where: { id: created.id } });
    expect(afterTwo.attempts).toBe(2);
    expect(afterTwo.status).toBe('PENDING');

    await worker.tick();
    const afterThree = await owner.notification.findUniqueOrThrow({ where: { id: created.id } });
    expect(afterThree.attempts).toBe(3);
    expect(afterThree.status).toBe('DEAD');
    expect(
      email.calls.filter((c) => c.recipient === `${RUN}-dead@qsystem.local`),
    ).toHaveLength(3);

    // Fourth tick: DEAD rows are terminal — no provider call, no attempts bump.
    await worker.tick();
    const afterFour = await owner.notification.findUniqueOrThrow({ where: { id: created.id } });
    expect(afterFour.attempts).toBe(3);
    expect(afterFour.status).toBe('DEAD');
    expect(
      email.calls.filter((c) => c.recipient === `${RUN}-dead@qsystem.local`),
    ).toHaveLength(3);

    email.mode = 'ok';
  });

  it('worker chết giữa chừng: PENDING còn nguyên, tick sau phục hồi và cộng dồn attempts', async () => {
    // "Crash" before the first tick: the enqueue write is already durable.
    email.mode = 'fail';
    const crashed = await notify.enqueue({
      channel: 'EMAIL',
      recipient: `${RUN}-crash@qsystem.local`,
      recipientId: userB.id,
    });
    const untouched = await owner.notification.findUniqueOrThrow({ where: { id: crashed.id } });
    expect(untouched.status).toBe('PENDING');
    expect(untouched.attempts).toBe(0);

    // Recovery run 1: fails at attempt 1, row stays PENDING.
    await worker.tick();
    const afterOne = await owner.notification.findUniqueOrThrow({ where: { id: crashed.id } });
    expect(afterOne.status).toBe('PENDING');
    expect(afterOne.attempts).toBe(1);

    // Recovery run 2: continues from attempts=1 (no reset, no recount).
    await worker.tick();
    const afterTwo = await owner.notification.findUniqueOrThrow({ where: { id: crashed.id } });
    expect(afterTwo.status).toBe('PENDING');
    expect(afterTwo.attempts).toBe(2);

    // Now the provider recovers: the same row completes without losing history.
    email.mode = 'ok';
    await worker.tick();
    const afterThree = await owner.notification.findUniqueOrThrow({ where: { id: crashed.id } });
    expect(afterThree.status).toBe('SENT');
    expect(afterThree.attempts).toBe(3);

    // And a row that never saw a worker at all (enqueue-only) is still picked
    // up later — nothing is lost between process restarts.
    const queued = await notify.enqueue({
      channel: 'EMAIL',
      recipient: `${RUN}-queued@qsystem.local`,
      recipientId: userB.id,
    });
    expect((await owner.notification.findUniqueOrThrow({ where: { id: queued.id } })).status).toBe(
      'PENDING',
    );
    await worker.tick();
    const queuedAfter = await owner.notification.findUniqueOrThrow({ where: { id: queued.id } });
    expect(queuedAfter.status).toBe('SENT');
    expect(queuedAfter.attempts).toBe(1);
  });

  it('GET /notifications chỉ trả tin của mình (A vs B) + VIBER fallback ghi chú vào payload', async () => {
    email.mode = 'ok';
    const forA = await notify.enqueue({
      channel: 'SOCKET',
      recipient: `${RUN}-only-a@qsystem.local`,
      recipientId: userA.id,
      payload: { text: 'for A only' },
    });
    const forB = await notify.enqueue({
      channel: 'VIBER',
      recipient: `${RUN}-only-b@qsystem.local`,
      recipientId: userB.id,
      payload: { text: 'for B only' }, // no viber user id → email fallback
    });
    await worker.tick();

    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    const resA = await request(server)
      .get('/notifications')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const rowsA = resA.body as Array<Record<string, unknown>>;
    expect(rowsA.some((r) => r.id === forA.id)).toBe(true);
    expect(rowsA.some((r) => r.id === forB.id)).toBe(false);
    expect(rowsA.every((r) => r.recipientId === userA.id)).toBe(true);

    const resB = await request(server)
      .get('/notifications')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    const rowsB = resB.body as Array<Record<string, unknown>>;
    expect(rowsB.some((r) => r.id === forB.id)).toBe(true);
    expect(rowsB.some((r) => r.id === forA.id)).toBe(false);
    expect(rowsB.every((r) => r.recipientId === userB.id)).toBe(true);

    // VIBER row: fell back to email, still delivered, note stamped in payload.
    const viberRow = await owner.notification.findUniqueOrThrow({ where: { id: forB.id } });
    expect(viberRow.status).toBe('SENT');
    expect(JSON.stringify(viberRow.payload ?? {})).toContain('viber');

    // SOCKET row: in-memory emit only, no external call, still SENT.
    const socketRow = await owner.notification.findUniqueOrThrow({ where: { id: forA.id } });
    expect(socketRow.status).toBe('SENT');
  });

  it('R17: connection có identity không bị policy worker nới rộng (B không thấy tin A ở mức SQL)', async () => {
    email.mode = 'ok';
    const onlyA = await notify.enqueue({
      channel: 'EMAIL',
      recipient: `${RUN}-rls@qsystem.local`,
      recipientId: userA.id,
    });
    await worker.tick();
    expect(
      (await owner.notification.findUniqueOrThrow({ where: { id: onlyA.id } })).status,
    ).toBe('SENT');

    // R17 negative at SQL level: the worker policy must not widen an identity
    // connection. B must NOT see A's row through the identity connection even
    // though the no-identity worker path can (control below).
    const seenByB = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT set_config('app.current_user_id', ${userB.id}, true)`,
      );
      return tx.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM notifications');
    });
    expect(seenByB.some((r) => r.id === onlyA.id)).toBe(false);

    // Control: the same worker path (no identity) DOES see the outbox — this is
    // the capability the migration grants, and it stays outside identity scope.
    const seenByWorker = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      'SELECT id FROM notifications',
    );
    expect(seenByWorker.some((r) => r.id === onlyA.id)).toBe(true);
  });

  it('R22: DIRECTOR chỉ thấy thông báo của mình (self-scope, không full-table)', async () => {
    email.mode = 'ok';
    // Employee-only payload: a private message that must never reach the DIRECTOR.
    const employeeOnly = await notify.enqueue({
      channel: 'SOCKET',
      recipient: `${RUN}-emp-private@qsystem.local`,
      recipientId: userA.id,
      payload: { secret: 'employee-private-message' },
    });
    // The DIRECTOR's own notification.
    const directorsOwn = await notify.enqueue({
      channel: 'SOCKET',
      recipient: `${RUN}-dir-own@qsystem.local`,
      recipientId: userDir.id,
      payload: { text: 'directors own message' },
    });
    await worker.tick();

    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    const resDir = await request(server)
      .get('/notifications')
      .set('Authorization', `Bearer ${tokenDir}`)
      .expect(200);
    const rowsDir = resDir.body as Array<Record<string, unknown>>;
    // Exactly the director's own rows — never the employee's payload.
    expect(rowsDir.some((r) => r.id === employeeOnly.id)).toBe(false);
    expect(rowsDir.some((r) => r.id === directorsOwn.id)).toBe(true);
    expect(
      rowsDir.filter((r) => r.recipientId === userDir.id).length,
    ).toBe(rowsDir.length);
    expect(JSON.stringify(rowsDir)).not.toContain('employee-private-message');

    // App-layer check (owner oracle): the scope filter itself is SELF-only for
    // DIRECTOR, independent of HTTP wiring.
    const dirViewer = { id: userDir.id, role: 'DIRECTOR' as const, managedDepartmentIds: [] };
    expect(scopeFor('notification', dirViewer)).toEqual({ recipientId: userDir.id });
    expect(isAllowed('notification', dirViewer, { recipientId: userA.id })).toBe(false);
    expect(isAllowed('notification', dirViewer, { recipientId: userDir.id })).toBe(true);

    const scoped = await prisma.forUser(dirViewer).notification.findMany();
    expect(scoped.some((n) => n.id === employeeOnly.id)).toBe(false);
    expect(scoped.every((n) => n.recipientId === userDir.id)).toBe(true);

    // SQL-layer check: the company policy is gone — with identity DIRECTOR the
    // employee row is invisible at raw-SQL level too.
    const seenByDir = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT set_config('app.current_user_id', ${userDir.id}, true)`,
      );
      return tx.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM notifications');
    });
    expect(seenByDir.some((r) => r.id === employeeOnly.id)).toBe(false);
  });

  it('R23: zombie PENDING attempts=3 (crash giữa attempt 3) → DEAD ở tick kế tiếp, 0 provider call', async () => {
    email.mode = 'ok';
    const callsBefore = email.calls.length;
    // Seed a crash leftover: PENDING with attempts=3 — the eligibility filter
    // (attempts < 3) excludes it from normal processing, so without the reaper
    // it would sit as a zombie forever. updatedAt is backdated past the reap
    // grace window so the reaper does not cut into a row another instance may
    // still be delivering right now.
    const zombie = await owner.notification.create({
      data: {
        channel: 'EMAIL',
        recipient: `${RUN}-zombie@qsystem.local`,
        recipientId: userB.id,
        status: 'PENDING',
        attempts: 3,
        updatedAt: new Date(Date.now() - REAP_GRACE_MS - 5_000),
      },
    });

    await worker.tick();

    const reaped = await owner.notification.findUniqueOrThrow({ where: { id: zombie.id } });
    expect(reaped.status).toBe('DEAD');
    expect(reaped.attempts).toBe(3);
    // Reaping is bookkeeping, not delivery: no provider call may happen.
    expect(email.calls.length - callsBefore).toBe(0);

    // A healthy row in the same tick still delivers — the reaper only touches
    // PENDING rows that are already out of budget.
    const healthy = await notify.enqueue({
      channel: 'EMAIL',
      recipient: `${RUN}-healthy@qsystem.local`,
      recipientId: userB.id,
    });
    await worker.tick();
    const healthyAfter = await owner.notification.findUniqueOrThrow({ where: { id: healthy.id } });
    expect(healthyAfter.status).toBe('SENT');
    expect(healthyAfter.attempts).toBe(1);
    const reapedAgain = await owner.notification.findUniqueOrThrow({ where: { id: zombie.id } });
    expect(reapedAgain.status).toBe('DEAD');
    expect(reapedAgain.attempts).toBe(3);
  });

  it('multi-instance: tick song song không gửi trùng một hàng (claim CAS)', async () => {
    email.mode = 'ok';
    const created = await notify.enqueue({
      channel: 'EMAIL',
      recipient: `${RUN}-parallel@qsystem.local`,
      recipientId: userA.id,
    });
    // Two concurrent passes (what two instances would do). The claim CAS
    // (attempts+1 guarded by status/attempts) must let exactly one delivery
    // through — no double send.
    await Promise.all([worker.tick(), worker.tick()]);

    const after = await owner.notification.findUniqueOrThrow({ where: { id: created.id } });
    expect(after.status).toBe('SENT');
    expect(after.attempts).toBe(1);
    expect(
      email.calls.filter((c) => c.recipient === `${RUN}-parallel@qsystem.local`),
    ).toHaveLength(1);
  });

  it('tick lỗi giữa chừng không khoá vĩnh viễn: tick kế tiếp vẫn chạy được', async () => {
    email.mode = 'ok';
    const created = await notify.enqueue({
      channel: 'EMAIL',
      recipient: `${RUN}-poison@qsystem.local`,
      recipientId: userA.id,
    });
    // Fault injection: the first tick dies inside runPass (the reap write),
    // exactly like a DB error mid-pass. The previous session-level advisory
    // lock was acquired and released on different pooled connections, so the
    // release returned false and the lock stayed held forever — every later
    // tick then bailed out and the outbox stalled for good.
    // Wrap the worker's prisma handle (the delegate object is shared and a
    // vi.spyOn on it would not restore reliably) with a one-shot thrower.
    const real = (worker as unknown as { prisma: PrismaClient }).prisma;
    const throwOnce = { armed: true };
    (worker as unknown as { prisma: PrismaClient }).prisma = new Proxy(real, {
      get(target, prop, receiver) {
        if (prop !== 'notification') return Reflect.get(target, prop, receiver);
        const notif = Reflect.get(target, prop, receiver) as unknown as Record<string, unknown>;
        return new Proxy(notif, {
          get(dt, dProp, dRecv) {
            if (dProp === 'updateMany' && throwOnce.armed) {
              throwOnce.armed = false;
              return () => Promise.reject(new Error('simulated mid-pass crash'));
            }
            const v = Reflect.get(dt, dProp, dRecv) as unknown;
            return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(dt) : v;
          },
        });
      },
    });

    await expect(worker.tick()).rejects.toThrow('simulated mid-pass crash');
    // The guard must be released by the finally, not held like the old lock.
    expect((worker as unknown as { running: boolean }).running).toBe(false);
    (worker as unknown as { prisma: PrismaClient }).prisma = real;

    // A later tick must run a full pass and deliver the row — never be
    // starved by a lock that outlived the failed tick.
    await worker.tick();
    const after = await owner.notification.findUniqueOrThrow({ where: { id: created.id } });
    expect(after.status).toBe('SENT');
    expect(after.attempts).toBe(1);
  });

  it('tick song song: lượt thứ hai không chạy chồng (cờ in-process)', async () => {
    email.mode = 'ok';
    const created = await notify.enqueue({
      channel: 'EMAIL',
      recipient: `${RUN}-overlap@qsystem.local`,
      recipientId: userA.id,
    });
    const enters: number[] = [];
    const real = (worker as unknown as { prisma: PrismaClient }).prisma;
    (worker as unknown as { prisma: PrismaClient }).prisma = new Proxy(real, {
      get(target, prop, receiver) {
        if (prop !== 'notification') return Reflect.get(target, prop, receiver);
        const notif = Reflect.get(target, prop, receiver) as unknown as Record<string, unknown>;
        return new Proxy(notif, {
          get(dt, dProp, dRecv) {
            const v = Reflect.get(dt, dProp, dRecv) as unknown;
            if (dProp !== 'updateMany') return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(dt) : v;
            return async (args: unknown) => {
              // Count only the reaper write — the first statement of a pass.
              if ((args as { data?: { status?: string } })?.data?.status === 'DEAD') enters.push(Date.now());
              // Hold the pass long enough for the second tick to arrive.
              await new Promise((r) => setTimeout(r, 50));
              return (v as (a: unknown) => Promise<unknown>).call(dt, args);
            };
          },
        });
      },
    });
    await Promise.all([worker.tick(), worker.tick()]);
    (worker as unknown as { prisma: PrismaClient }).prisma = real;

    // Exactly one pass ran: the overlapping tick bailed at the in-process flag.
    expect(enters).toHaveLength(1);
    const after = await owner.notification.findUniqueOrThrow({ where: { id: created.id } });
    expect(after.status).toBe('SENT');
    expect(after.attempts).toBe(1);
  });
});
