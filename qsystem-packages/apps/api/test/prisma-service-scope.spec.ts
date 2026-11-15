import { describe, expect, it, vi } from 'vitest';
import { PrismaService, type ScopeViewer } from '../src/prisma/prisma.service';

// No DB: $transaction is stubbed to hand `fn` a fake tx, so we count exactly
// what one forUser() call issues (transactions, set_config, user lookups) and
// what `where` reaches the delegate.
function harness() {
  const svc = new PrismaService();
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    user: { findUnique: vi.fn().mockResolvedValue(null) },
    file: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const $transaction = vi.fn(async (fn: (t: unknown) => unknown) => fn(tx));
  (svc as unknown as { $transaction: unknown }).$transaction = $transaction;
  return { svc, tx, $transaction };
}

const mgr: ScopeViewer = { id: 'u-mgr', role: 'MANAGER', managedDepartmentIds: ['d1', 'd2'], departmentId: null };

describe('PrismaService.forUser (resolved viewer)', () => {
  it('opens one transaction, sets RLS identity, never re-queries the user', async () => {
    const { svc, tx, $transaction } = harness();
    await svc.forUser(mgr).file.findMany({ where: { key: 'k' } });
    expect($transaction).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1); // SET LOCAL / set_config still runs
    expect(tx.user.findUnique).toHaveBeenCalledTimes(0);
  });

  it('applies the scope exactly once to the WHERE clause', async () => {
    const { svc, tx } = harness();
    await svc.forUser(mgr).file.findMany({ where: { key: 'k' } });
    expect(tx.file.findMany).toHaveBeenCalledTimes(1);
    expect(tx.file.findMany.mock.calls[0][0].where).toEqual({
      AND: [
        { key: 'k' },
        { OR: [{ ownerId: 'u-mgr' }, { departmentId: { in: ['d1', 'd2'] } }] },
      ],
    });
  });
});

describe('PrismaService.runAsUser (string id)', () => {
  it('still resolves the viewer from the DB for a bare user id', async () => {
    const { svc, tx } = harness();
    await svc.runAsUser('u-1', async () => undefined);
    expect(tx.user.findUnique).toHaveBeenCalledTimes(1);
  });
});
