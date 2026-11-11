/**
 * In-memory login rate limiter (Task 3).
 *
 * Two buckets, checked together on every POST /auth/login:
 * - per-IP bucket: 5 attempts / 60s, EVERY attempt consumes (success or
 *   failure, never cleared early). This is the brief's 5/min/IP rule: an
 *   attacker spraying guesses across many emails from one IP still trips it.
 * - per-account bucket (IP + lowercased email): 5 failures / 60s; only
 *   failures consume and a success clears the key, so one account's failures
 *   never lock out other users behind the same NAT.
 *
 * Single-process Map, replaceable with a shared store (Redis) when the API
 * runs multi-instance — documented per plan.
 */

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

const ipAttempts = new Map<string, number[]>();
const accountFailures = new Map<string, number[]>();

let lastSweep = 0;

function prune(map: Map<string, number[]>, now: number): void {
  for (const [key, hits] of map) {
    const fresh = hits.filter((t) => t > now - WINDOW_MS);
    if (fresh.length > 0) map.set(key, fresh);
    else map.delete(key);
  }
}

function maybeSweep(now: number): void {
  // Opportunistic TTL cleanup: a full sweep runs at most once per window, so
  // idle keys cannot leak memory while the hot path stays O(bucket size).
  if (now - lastSweep < WINDOW_MS) return;
  lastSweep = now;
  prune(ipAttempts, now);
  prune(accountFailures, now);
}

function recent(map: Map<string, number[]>, key: string, now: number): number[] {
  const hits = (map.get(key) ?? []).filter((t) => t > now - WINDOW_MS);
  map.set(key, hits);
  return hits;
}

export function loginLimitKey(ip: string, email: string): string {
  return `${ip}::${(email ?? '').toLowerCase()}`;
}

export function isLoginLimited(ip: string, accountKey: string): boolean {
  const now = Date.now();
  maybeSweep(now);
  return (
    recent(ipAttempts, ip, now).length >= MAX_ATTEMPTS ||
    recent(accountFailures, accountKey, now).length >= MAX_ATTEMPTS
  );
}

/** Every login attempt consumes IP budget — call BEFORE delegating to login. */
export function recordLoginAttempt(ip: string): void {
  ipAttempts.set(ip, [...(ipAttempts.get(ip) ?? []), Date.now()]);
}

/** Only failures consume the per-account budget. */
export function recordLoginFailure(accountKey: string): void {
  accountFailures.set(accountKey, [...(accountFailures.get(accountKey) ?? []), Date.now()]);
}

/** A success clears the per-account budget (the IP budget is never cleared early). */
export function clearLoginFailures(accountKey: string): void {
  accountFailures.delete(accountKey);
}

/** Test-only: isolate rate-limit assertions from each other (same-process Map). */
export function resetLoginLimits(): void {
  ipAttempts.clear();
  accountFailures.clear();
  lastSweep = 0;
}
