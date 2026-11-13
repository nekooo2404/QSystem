/**
 * Search bootstrap: create the Meilisearch indexes and sync the `files`
 * table into the `documents` index. Run after deploy (or whenever the index
 * is missing/stale) — GET /search returns nothing until this has run once.
 *
 * Usage (owner DB URL required for the full re-index read):
 *   pnpm --filter api exec tsx scripts/search-bootstrap.ts
 *
 * Env: MEILI_URL, MEILI_MASTER_KEY, DATABASE_URL, RLS_OWNER_URL (falls back
 * to DATABASE_URL for the DIRECTOR read when RLS_OWNER_URL is unset).
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { SearchService, meiliConfigFromEnv } from '../src/search/search.service';
import { SearchSyncWorker } from '../src/search/sync.worker';
import { PrismaService } from '../src/prisma/prisma.service';

async function main(): Promise<void> {
  const config = meiliConfigFromEnv();
  const search = new SearchService(config);
  await search.ensureIndexes();
  // eslint-disable-next-line no-console
  console.log('qsystem: meili indexes ensured');

  const ownerUrl = process.env.RLS_OWNER_URL ?? process.env.DATABASE_URL;
  if (!ownerUrl) throw new Error('qsystem: DATABASE_URL or RLS_OWNER_URL must be set');
  const prisma = new PrismaService({ datasources: { db: { url: ownerUrl } } });

  const dirUser = await prisma.user.findFirst({ where: { role: 'DIRECTOR' }, select: { id: true } });
  if (!dirUser) throw new Error('qsystem: no DIRECTOR found — seed first');
  const worker = new SearchSyncWorker(prisma, search);
  await worker.syncAll({ id: dirUser.id, role: 'DIRECTOR', managedDepartmentIds: [], departmentId: null });
  // eslint-disable-next-line no-console
  console.log('qsystem: files synced into documents index');
  await prisma.$disconnect();
}

void main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('qsystem: search bootstrap failed', err);
  process.exit(1);
});
