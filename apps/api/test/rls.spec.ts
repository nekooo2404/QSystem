import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaService, type ScopeViewer } from '../src/prisma/prisma.service';

// Unique per run so repeat runs never clash with seed data or each other.
const RUN = `rls-${Date.now()}`;

const prisma = new PrismaService();
const prismaFor = (viewer: ScopeViewer) => prisma.forUser(viewer);

// Owner-role connection: RLS-exempt bootstrap oracle used ONLY for fixtures
// and read-back verification. Migrations/seeds stay owner per the same rule;
// all behavior under test runs through the restricted qsystem_app connection.
const OWNER_URL = "postgresql://qsystem:postgres@localhost:55433/qsystem?schema=public";
const owner = new PrismaClient({ datasources: { db: { url: process.env.RLS_OWNER_URL ?? OWNER_URL } } });

let empA!: { id: string };
let mgr!: ScopeViewer;
let mgrDeptIds!: string[];
let dir!: ScopeViewer;
let ALL!: number;

beforeAll(async () => {
  await prisma.$connect();
  await owner.$connect();

  // Departments: D1 + D2 managed by mgr, D3 unmanaged (outside mgr scope).
  const d1 = await owner.department.create({ data: { name: `${RUN}-d1`, tenantId: null } });
  const d2 = await owner.department.create({ data: { name: `${RUN}-d2`, tenantId: null } });
  const d3 = await owner.department.create({ data: { name: `${RUN}-d3`, tenantId: null } });

  const director = await owner.user.create({
    data: { email: `${RUN}-dir@qsystem.local`, name: 'Director', passwordHash: 'seed', role: 'DIRECTOR', tenantId: null },
  });
  const manager = await owner.user.create({
    data: { email: `${RUN}-mgr@qsystem.local`, name: 'Manager', passwordHash: 'seed', role: 'MANAGER', tenantId: null },
  });
  const a = await owner.user.create({
    data: {
      email: `${RUN}-empa@qsystem.local`, name: 'Emp A', passwordHash: 'seed', role: 'EMPLOYEE',
      departmentId: d1.id, reportsToId: manager.id, tenantId: null,
    },
  });
  const b = await owner.user.create({
    data: {
      email: `${RUN}-empb@qsystem.local`, name: 'Emp B', passwordHash: 'seed', role: 'EMPLOYEE',
      departmentId: d2.id, reportsToId: manager.id, tenantId: null,
    },
  });
  const c = await owner.user.create({
    data: { email: `${RUN}-empc@qsystem.local`, name: 'Emp C', passwordHash: 'seed', role: 'EMPLOYEE', departmentId: d3.id, tenantId: null },
  });

  // Manager owns D1 + D2 (two departments).
  await owner.department.update({ where: { id: d1.id }, data: { managerId: manager.id } });
  await owner.department.update({ where: { id: d2.id }, data: { managerId: manager.id } });

  empA = { id: a.id };
  mgr = { id: manager.id, role: 'MANAGER', managedDepartmentIds: [d1.id, d2.id] };
  mgrDeptIds = [d1.id, d2.id];
  dir = { id: director.id, role: 'DIRECTOR', managedDepartmentIds: [] };

  // Business rows (generic per Ruling R6 — File carries ownerId + departmentId scope columns).
  // Each insert runs under its owner's request context so RLS WITH CHECK applies.
  const files = [
    { ownerId: a.id, departmentId: d1.id, key: `${RUN}/f1.txt` },
    { ownerId: b.id, departmentId: d2.id, key: `${RUN}/f2.txt` },
    { ownerId: c.id, departmentId: d3.id, key: `${RUN}/f3.txt` },
    { ownerId: manager.id, departmentId: d1.id, key: `${RUN}/f4.txt` },
  ];
  for (const f of files) {
    await prisma.runAsUser(f.ownerId, (tx) =>
      tx.file.create({ data: { ...f, bucket: 'qsystem-docs', tenantId: null } }),
    );
  }
  ALL = files.length;
}, 120000);

afterAll(async () => {
  await prisma.$disconnect();
  await owner.$disconnect();
});

describe('RLS scope', () => {
  it('employee chỉ thấy row của mình', async () => {
    const rows = await prismaFor({ id: empA.id, role: 'EMPLOYEE', managedDepartmentIds: [] }).file.findMany();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.ownerId === empA.id)).toBe(true);
  });

  it('manager kiêm 2 phòng thấy đúng 2 phòng', async () => {
    const rows = await prismaFor(mgr).file.findMany({ where: { key: { startsWith: RUN } } });
    expect(new Set(rows.map((r) => r.departmentId))).toEqual(new Set(mgrDeptIds));
    expect(rows).toHaveLength(3);
  });

  it('director thấy toàn công ty', async () => {
    const rows = await prismaFor(dir).file.findMany({ where: { key: { startsWith: RUN } } });
    expect(rows).toHaveLength(ALL);
  });

  it('raw query không bypass RLS', async () => {
    await expect(
      (prismaFor({ id: empA.id, role: 'EMPLOYEE', managedDepartmentIds: [] }) as unknown as PrismaClient).$queryRawUnsafe('SELECT * FROM files'),
    ).rejects.toThrow();
  });

  it('EMPLOYEE update row người khác bị chặn, dữ liệu giữ nguyên', async () => {
    const victim = await owner.file.findFirstOrThrow({ where: { key: `${RUN}/f2.txt` } });
    const before = victim.key;
    await expect(
      prisma.runAsUser(empA.id, (tx) =>
        tx.file.update({ where: { id: victim.id }, data: { key: `${RUN}/hijacked.txt` } }),
      ),
    ).rejects.toThrow(/scoped access denied/i);
    const after = await owner.file.findUniqueOrThrow({ where: { id: victim.id } });
    expect(after.key).toBe(before);
  });

  it('RLS chặn read/write trực tiếp bằng SQL dưới quyền qsystem_app', async () => {
    // Same restricted role, pure SQL level (interactive transaction with
    // SET LOCAL, no app-layer filters): employee A must see ONLY their own
    // files row, and a cross-owner UPDATE must be denied by RLS.
    const victim = await owner.file.findFirstOrThrow({ where: { key: `${RUN}/f2.txt` } });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.current_user_id', '${empA.id}', true)`,
      );
      const visible = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM files`,
      );
      expect(visible.map((r) => r.id)).toEqual([expect.any(String)]);
      expect(visible).toHaveLength(1);
      // RLS USING fails on the foreign row: UPDATE touches 0 rows instead of
      // erroring — the write is denied all the same. Assert count 0.
      const touched = await tx.$executeRawUnsafe(`UPDATE files SET key = '${RUN}/sql-hijack.txt' WHERE id = '${victim.id}'`);
      expect(Number(touched)).toBe(0);
    });
    // Owner-role read-back (RLS-exempt owner is the test oracle): untouched.
    const after = await owner.file.findUniqueOrThrow({ where: { id: victim.id } });
    expect(after.key).toBe(`${RUN}/f2.txt`);
  });
});
