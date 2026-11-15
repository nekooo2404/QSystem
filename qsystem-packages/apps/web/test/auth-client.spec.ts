import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, setAccessToken } from '../src/lib/api/client';
import { humanizeApiError } from '../src/lib/errors/humanize';

type Call = { url: string; init: RequestInit };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function authHeader(init?: RequestInit): string | undefined {
  return new Headers(init?.headers).get('authorization') ?? undefined;
}

describe('apiFetch single-flight refresh', () => {
  let calls: Call[];

  beforeEach(() => {
    calls = [];
    setAccessToken(null);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, init: init ?? {} });
        if (url === '/api/auth/refresh') {
          return json(201, { accessToken: 'fresh-token' });
        }
        if (authHeader(init) === 'Bearer fresh-token') {
          return json(200, { url });
        }
        return json(401, { code: 'UNAUTHORIZED', message: 'expired' });
      }),
    );
  });

  it('refreshes once for three concurrent 401s and retries all with the new token', async () => {
    const paths = ['/api/me', '/api/org/departments', '/api/notifications'];
    const results = await Promise.all(paths.map((p) => apiFetch<{ url: string }>(p)));

    const refreshCalls = calls.filter((c) => c.url === '/api/auth/refresh');
    expect(refreshCalls).toHaveLength(1);
    expect(refreshCalls[0].init.method).toBe('POST');
    expect(refreshCalls[0].init.credentials).toBe('include');

    const retries = calls.filter((c) => c.url !== '/api/auth/refresh' && authHeader(c.init) === 'Bearer fresh-token');
    expect(retries.map((c) => c.url).sort()).toEqual([...paths].sort());
    expect(results.map((r) => r.url).sort()).toEqual([...paths].sort());
  });

  it('keeps the access token in memory only (never in localStorage)', async () => {
    await apiFetch('/api/me');
    expect(window.localStorage.getItem('accessToken')).toBeNull();
    expect(JSON.stringify({ ...window.localStorage })).not.toContain('fresh-token');
  });

  it('a non-401 failure surfaces a typed ApiError carrying the raw code, not a rendered message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(429, { code: 'RATE_LIMITED', message: 'Too many login attempts' })),
    );
    const err = await apiFetch('/api/auth/login', { method: 'POST' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('RATE_LIMITED');
    expect((err as ApiError).status).toBe(429);
  });

  it('applies the optional schema to a successful body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, { id: 'u1' })));
    const out = await apiFetch<{ id: string }>('/api/me', {
      schema: { parse: (d: unknown) => d as { id: string } },
    });
    expect(out.id).toBe('u1');
  });
});

describe('humanizeApiError', () => {
  it('never leaks the raw backend code', () => {
    const msg = humanizeApiError('RATE_LIMITED', 429);
    expect(msg).not.toContain('RATE_LIMITED');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('maps the common auth and network failures into Vietnamese sentences', () => {
    for (const [code, status] of [
      ['INVALID_CREDENTIALS', 401],
      ['UNAUTHORIZED', 401],
      ['FORBIDDEN', 403],
      [undefined, undefined],
    ] as const) {
      const msg = humanizeApiError(code, status);
      expect(msg).not.toContain(code ?? 'ZZZ');
      expect(msg).toMatch(/[àáảãạăâđêôơư]/i);
    }
  });
});
