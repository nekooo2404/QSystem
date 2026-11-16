import { cachedApiFetch, invalidateApiCache, clearApiCache, type CacheOptions } from './cache';

export { cachedApiFetch, invalidateApiCache, clearApiCache };

export interface ValueSchema<T> {
  parse(data: unknown): T;
}

/**
 * Access token lives in this module's memory only — never localStorage, never
 * logged. The refresh token is an httpOnly cookie and stays invisible to JS.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  constructor(
    readonly code: string | undefined,
    readonly status: number,
    readonly details?: unknown,
  ) {
    // `message` carries the human sentence, never the raw code or a stack.
    super(code ?? 'REQUEST_FAILED');
    this.name = 'ApiError';
  }
}

/** Single-flight: concurrent 401s share one POST /auth/refresh. */
let refreshPromise: Promise<string | null> | null = null;

function refreshOnce(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          accessToken = null;
          return null;
        }
        const body = (await res.json()) as { accessToken?: string };
        accessToken = body.accessToken ?? null;
        return accessToken;
      })
      .catch(() => {
        accessToken = null;
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export interface ApiFetchInit<T> extends RequestInit {
  /** Any Zod schema (or anything with `parse`); the return type is its output. */
  schema?: ValueSchema<T>;
  /** If true, routes the request through the in-memory SWR cache and deduplicator. */
  useCache?: boolean;
  /** Custom TTL and cache options when useCache is enabled. */
  cacheOptions?: CacheOptions;
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(path, { ...init, credentials: 'include', headers });
}

const SKIP_REFRESH_PATHS = new Set(['/api/auth/refresh', '/api/auth/login', '/api/auth/logout']);

export async function apiFetch<T = unknown>(path: string, init: ApiFetchInit<T> = {}): Promise<T> {
  if (init.useCache) {
    const { useCache, cacheOptions, ...rest } = init;
    return cachedApiFetch<T>(path, rest, cacheOptions);
  }

  const { schema, useCache, cacheOptions, ...requestInit } = init;
  let res = await send(path, requestInit);

  if (res.status === 401 && !SKIP_REFRESH_PATHS.has(path)) {
    const fresh = await refreshOnce();
    if (fresh) res = await send(path, requestInit);
    else accessToken = null;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      body && typeof body.code === 'string' ? body.code : undefined,
      res.status,
      body && typeof body === 'object' && 'details' in body ? body.details : undefined,
    );
  }

  if (res.status === 204) return undefined as T;
  const data = (await res.json()) as unknown;
  return schema ? schema.parse(data) : (data as T);
}
