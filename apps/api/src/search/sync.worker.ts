import { Inject, Injectable } from '@nestjs/common';
import { PrismaService, type ScopeViewer } from '../prisma/prisma.service';
import { SearchService } from './search.service';

/** Document shape indexed into Meili (spec: id, title, owner_id, department_id). */
interface DocumentRow {
  id: string;
  key: string;
  ownerId: string;
  departmentId: string | null;
}

/**
 * SearchSyncWorker (Task 7): keeps the Meili `documents` index in line with
 * the `files` table. Plain callable class methods only — `syncFile(id,
 * viewer)` and `syncAll(viewer)` — no timers, no intervals, no CDC (the
 * scheduling decision stays with the host process).
 *
 * RLS rationale (every read takes a viewer): the `files` policies grant rows
 * to owner / managed-department / DIRECTOR identities only — an identity-less
 * `qsystem_app` connection sees zero rows (current_setting(...) is NULL, all
 * three policies evaluate false). Adding a worker RLS policy would widen
 * scope, which the task brief forbids; changing prisma-scope.extension.ts is
 * also forbidden. So every worker read goes through
 * `PrismaService.forUser(viewer)`: the caller supplies the acting identity
 * (the uploader for `syncFile`, a DIRECTOR for a full re-index). Every read
 * is therefore identity-scoped, app-layer scoped, and RLS-checked — no new
 * policy and no scope bypass.
 *
 * Transport: shared Meili REST client (search.service.ts, plain fetch, R20
 * — no SDK). Writes await the enqueued Meili task so callers observe a
 * settled index when the method resolves.
 */
@Injectable()
export class SearchSyncWorker {
  // Explicit tokens — esbuild (vitest) does not emit decorator metadata.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SearchService) private readonly search: SearchService,
  ) {}

  /**
   * Re-index one file. The row is read through the caller's viewer scope, so
   * an out-of-scope id is simply not found (nothing indexed, no oracle).
   * Typical caller: the request path right after a file write.
   */
  async syncFile(fileId: string, viewer: ScopeViewer): Promise<void> {
    const row = await this.prisma.forUser(viewer).file.findUnique({ where: { id: fileId } });
    if (!row) return; // hidden or missing — nothing to index
    await this.search.upsertDocuments([toDocument(row)]);
  }

  /**
   * Re-index every file visible to `viewer`. A DIRECTOR viewer covers the
   * whole company (full re-index); a MANAGER/EMPLOYEE covers just their own
   * scope — intentional, since no identity can read wider than its own scope
   * under RLS.
   */
  async syncAll(viewer: ScopeViewer): Promise<void> {
    const rows = await this.prisma.forUser(viewer).file.findMany();
    await this.search.upsertDocuments(rows.map(toDocument));
  }
}

function toDocument(row: DocumentRow): {
  id: string;
  title: string;
  owner_id: string;
  department_id: string | null;
} {
  return {
    id: row.id,
    title: row.key,
    owner_id: row.ownerId,
    department_id: row.departmentId,
  };
}
