import { apiFetch, type ApiFetchInit } from './client';

export interface CacheOptions {
  /** Time in ms during which cached data is considered fresh. Default: 60,000 (1 min). */
  staleTime?: number;
  /** If true, ignores cached data and forces a fresh network fetch. */
  forceRefresh?: boolean;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cacheStore = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

/**
 * Synchronously retrieves a cached entry if present in memory.
 * Useful for immediate cache-first component hydration.
 */
export function getCachedEntry<T>(key: string): T | undefined {
  const entry = cacheStore.get(key);
  return entry ? (entry.data as T) : undefined;
}

/**
 * In-memory cache with stale-while-revalidate and in-flight request deduplication.
 * Only idempotent GET requests are cached. Mutations (POST, PUT, PATCH, DELETE) bypass
 * the cache and automatically invalidate corresponding cached resources.
 */
export async function cachedApiFetch<T>(
  path: string,
  init?: ApiFetchInit<T>,
  options?: CacheOptions
): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();

  // Non-GET requests mutate data; execute directly and invalidate matching caches
  if (method !== 'GET') {
    const res = await apiFetch<T>(path, { ...init, useCache: false });
    if (path.startsWith('/api/org/users')) invalidateApiCache('/api/org/users');
    if (path.startsWith('/api/org/departments')) invalidateApiCache('/api/org/departments');
    if (path.startsWith('/api/org/crm')) invalidateApiCache('/api/org/crm');
    if (path.startsWith('/api/social')) invalidateApiCache('/api/social');
    if (path.startsWith('/api/org/tasks') || path.startsWith('/api/tasks')) {
      invalidateApiCache('/api/org/tasks');
      invalidateApiCache('/api/tasks');
    }
    if (path.startsWith('/api/notifications')) invalidateApiCache('/api/notifications');
    return res;
  }

  const cacheKey = path;
  const staleTime = options?.staleTime ?? 60_000;
  const forceRefresh = options?.forceRefresh ?? false;
  const now = Date.now();

  const cached = cacheStore.get(cacheKey) as CacheEntry<T> | undefined;

  // 1. Fresh cache hit: return immediately (0ms)
  if (!forceRefresh && cached && now - cached.timestamp < staleTime) {
    return cached.data;
  }

  // 2. In-flight request deduplication: return the shared Promise
  const existingInFlight = inFlightRequests.get(cacheKey) as Promise<T> | undefined;
  if (existingInFlight) {
    return existingInFlight;
  }

  // 3. Stale cache hit: return stale data immediately and revalidate in background
  if (!forceRefresh && cached) {
    const revalidatePromise = apiFetch<T>(path, { ...init, useCache: false })
      .then((data) => {
        cacheStore.set(cacheKey, { data, timestamp: Date.now() });
        return data;
      })
      .catch(() => {
        // Silent revalidation failure; retain cached data
        return cached.data;
      })
      .finally(() => {
        inFlightRequests.delete(cacheKey);
      });

    inFlightRequests.set(cacheKey, revalidatePromise);
    return cached.data;
  }

  // 4. Cold miss: perform network fetch and deduplicate concurrent callers
  const fetchPromise = apiFetch<T>(path, { ...init, useCache: false })
    .then((data) => {
      cacheStore.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Invalidates all cache entries matching the specified path prefix, or clears all entries if omitted.
 */
export function invalidateApiCache(pathPrefix?: string): void {
  if (!pathPrefix) {
    cacheStore.clear();
    return;
  }
  for (const key of Array.from(cacheStore.keys())) {
    if (key.startsWith(pathPrefix)) {
      cacheStore.delete(key);
    }
  }
}

/**
 * Resets the entire in-memory cache and clears all in-flight deduplication promises.
 */
export function clearApiCache(): void {
  cacheStore.clear();
  inFlightRequests.clear();
}
