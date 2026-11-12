import { Inject, Injectable } from '@nestjs/common';
import { SearchQuerySchema, type SearchQuery, type SearchResult } from '@qsystem/contracts';
import type { ScopeViewer } from '../prisma/prisma.service';

/**
 * Dev-only fallbacks. The primary path is always the environment
 * (MEILI_URL / MEILI_MASTER_KEY); these placeholders exist so `docker
 * compose` dev works out of the box and must never carry real credentials.
 */
const DEV_FALLBACKS = {
  url: 'http://localhost:17700',
  masterKey: 'change-me-32-chars-minimum-0000',
} as const;

/** DI token for the Meili config object (shared by SearchService + SyncWorker). */
export const MEILI_CONFIG = 'MEILI_CONFIG';

export interface MeiliConfig {
  url: string;
  masterKey: string;
}

/** Load Meili config from env (dev-only fallbacks visible, never prod). */
export function meiliConfigFromEnv(): MeiliConfig {
  return {
    url: process.env.MEILI_URL ?? DEV_FALLBACKS.url,
    masterKey: process.env.MEILI_MASTER_KEY ?? DEV_FALLBACKS.masterKey,
  };
}

/** Index uid per entity (spec line 27); `documents` is the one Task 7 seeds. */
export const SEARCH_INDEXES = ['leads', 'contacts', 'deals', 'posts', 'documents'] as const;
export type SearchIndexUid = (typeof SEARCH_INDEXES)[number];

/** The index synced from the `files` table; the others stay empty stubs. */
export const DOCUMENTS_INDEX: SearchIndexUid = 'documents';

/** Attributes the scope filter needs on the `documents` index. */
export const FILTERABLE_ATTRIBUTES = ['owner_id', 'department_id'] as const;

/** Document shape indexed into Meili (spec: id, title, owner_id, department_id). */
export interface DocumentRecord {
  id: string;
  title: string;
  owner_id: string;
  department_id: string | null;
}

/** Meili search-request subset this service sends. */
interface MeiliSearchRequest {
  q: string;
  limit: number;
  offset: number;
  filter?: string;
}

/** Meili search-response subset this service consumes. */
interface MeiliSearchResponse {
  hits: Array<Record<string, unknown>>;
  estimatedTotalHits: number;
  limit: number;
  offset: number;
}

interface MeiliTask {
  uid: number;
  status: 'enqueued' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  error?: { code?: string; message?: string } | null;
}

/**
 * SearchService (Task 7): the single Meilisearch REST client (plain fetch,
 * R20 — no SDK). Scope enforcement happens server-side: the query carries a
 * Meili `filter` expression built from the resolved viewer (EMPLOYEE →
 * owner_id = me, MANAGER → owner_id = me OR department_id = <managed…>,
 * DIRECTOR → no filter), so a client can never widen results by crafting the
 * request. Result shape is pinned to SearchResultSchema (@qsystem/contracts,
 * verbatim).
 *
 * Writes await the Meili task so callers observe a settled index when the
 * method resolves (bounded poll of ONE task, not a scheduler).
 */
@Injectable()
export class SearchService {
  // Explicit token — esbuild (vitest) does not emit decorator metadata.
  constructor(@Inject(MEILI_CONFIG) private readonly config: MeiliConfig) {}

  /** Scoped search over the `documents` index (contract-validated input). */
  async search(viewer: ScopeViewer, rawQuery: Record<string, unknown>): Promise<SearchResult> {
    const parsed = SearchQuerySchema.parse({
      q: rawQuery.q,
      limit: rawQuery.limit !== undefined ? Number(rawQuery.limit) : undefined,
      offset: rawQuery.offset !== undefined ? Number(rawQuery.offset) : undefined,
    });
    const filter = scopeFilterFor(viewer);
    const res = await this.post<MeiliSearchResponse>(`/indexes/${DOCUMENTS_INDEX}/search`, {
      q: parsed.q,
      limit: parsed.limit,
      offset: parsed.offset,
      ...(filter ? { filter } : {}),
    } satisfies MeiliSearchRequest);
    return {
      hits: res.hits,
      total: res.estimatedTotalHits,
      limit: parsed.limit,
      offset: parsed.offset,
    };
  }

  /**
   * Create the five index uids (empty stubs for leads/contacts/deals/posts;
   * `documents` also gets the scope-filter attributes). Idempotent.
   */
  async ensureIndexes(): Promise<void> {
    for (const uid of SEARCH_INDEXES) {
      // A 409 (index already exists) is success for an idempotent bootstrap.
      await this.post(`/indexes`, { uid, primaryKey: 'id' }, { allowStatuses: [409] });
    }
    await this.put(`/indexes/${DOCUMENTS_INDEX}/settings/filterable-attributes`, [
      ...FILTERABLE_ATTRIBUTES,
    ]);
  }

  /** Add/replace documents in the `documents` index. */
  async upsertDocuments(docs: DocumentRecord[]): Promise<void> {
    if (docs.length === 0) return;
    await this.put(`/indexes/${DOCUMENTS_INDEX}/documents`, docs);
  }

  /** Remove specific documents from the `documents` index (cleanup helper). */
  async deleteDocuments(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.post(`/indexes/${DOCUMENTS_INDEX}/documents/delete-batch`, ids);
  }

  private async post<T = void>(
    path: string,
    body: unknown,
    options: { allowStatuses?: number[] } = {},
  ): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  private async put<T = void>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  private async request<T = void>(
    method: 'POST' | 'PUT' | 'DELETE',
    path: string,
    body: unknown,
    options: { allowStatuses?: number[] } = {},
  ): Promise<T> {
    const res = await fetch(`${this.config.url}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.masterKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok && !(options.allowStatuses ?? []).includes(res.status)) {
      throw new Error(
        `qsystem: meili ${method} ${path} failed (${res.status}): ${(await res.text()).slice(0, 200)}`,
      );
    }
    if (!res.ok) return undefined as T; // tolerated status (e.g. 409 exists)
    const payload = (await res.json()) as MeiliTask | T;
    if (isMeiliTask(payload)) await this.waitForTask(payload.uid);
    return payload as T;
  }

  /** Await one Meili task (bounded); throws on failure/cancel/timeout. */
  private async waitForTask(uid: number, timeoutMs = 10000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const res = await fetch(`${this.config.url}/tasks/${uid}`, {
        headers: { Authorization: `Bearer ${this.config.masterKey}` },
      });
      if (!res.ok) {
        throw new Error(`qsystem: meili task ${uid} lookup failed (${res.status})`);
      }
      const task = (await res.json()) as MeiliTask;
      if (task.status === 'succeeded') return;
      if (task.status === 'failed' || task.status === 'canceled') {
        throw new Error(
          `qsystem: meili task ${uid} ${task.status}: ${task.error?.message ?? task.error?.code ?? 'unknown'}`,
        );
      }
      if (Date.now() > deadline) {
        throw new Error(`qsystem: meili task ${uid} timed out (last status ${task.status})`);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

function isMeiliTask(value: unknown): value is MeiliTask {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { uid?: unknown }).uid === 'number' &&
    typeof (value as { status?: unknown }).status === 'string'
  );
}

/**
 * Meili filter expression per viewer role. Ids come from the DB-resolved
 * viewer (never user input); values are double-quoted per Meili's filter
 * syntax. The whole expression is grouped so an added clause can never
 * outrank the scope via OR precedence.
 */
export function scopeFilterFor(viewer: ScopeViewer): string | undefined {
  if (viewer.role === 'DIRECTOR') return undefined;
  if (viewer.role === 'MANAGER') {
    const clauses = [`owner_id = "${viewer.id}"`];
    for (const deptId of viewer.managedDepartmentIds) {
      clauses.push(`department_id = "${deptId}"`);
    }
    return clauses.length === 1 ? clauses[0] : `(${clauses.join(' OR ')})`;
  }
  return `owner_id = "${viewer.id}"`;
}

/** Re-export for controller wiring (schema stays verbatim from contracts). */
export type { SearchQuery, SearchResult };
