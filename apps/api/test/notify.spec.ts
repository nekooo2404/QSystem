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
import { NotifyService } from '../src/notify/notify.service';
import { NotifyWorker } from '../src/notify/notify.worker';
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
let tokenA!: string;
let tokenB!: string;

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
  resetLoginLimits();
  tokenA = await loginAs(server, userA.email);
  tokenB = await loginAs(server, userB.email);
}, 180000);

afterAll(async () => {
  await owner.notification.deleteMany({
    where: {
      OR: [
        { recipientId: userA?.id },
        { recipientId: userB?.id },
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
});
