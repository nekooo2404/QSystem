import { createHash, createHmac } from 'node:crypto';

/**
 * Minimal SigV4 (AWS Signature Version 4) helpers for S3 presigned URLs and
 * signed header requests — R20: no AWS SDK is installed, so this module
 * implements query-string presigning with node:crypto only (canonical
 * request → string-to-sign → HMAC-SHA256 chain).
 *
 * Scope (deliberately small):
 * - path-style URLs (/{bucket}/{key}) against S3_ENDPOINT (RustFS dev,
 *   MinIO-compatible) — not virtual-host style
 * - UNSIGNED-PAYLOAD (presign PUT/GET never hashes the body)
 * - X-Amz-Expires=900 (15 minutes, spec 79-80)
 * - region/service pinned to us-east-1/s3 (RustFS/MinIO default)
 *
 * Canonical query encoding follows SigV4 rules: URI-encode every key/value
 * (RFC 3986, uppercase percent-hex), then lexicographic sort.
 */
const ALGORITHM = 'AWS4-HMAC-SHA256';
const DEFAULT_REGION = 'us-east-1';
const SERVICE = 's3';
const SIGNED_SUFFIX = 'aws4_request';

/** Presigned URL lifetime: 15 minutes, per spec line 79-80. */
export const PRESIGN_EXPIRES_SECONDS = 900;

/**
 * Dev-only fallbacks. The primary path is always the environment; these
 * placeholders exist so `docker compose` dev works out of the box. They must
 * never be used as production credentials.
 */
const DEV_FALLBACKS = {
  endpoint: 'http://localhost:19000',
  accessKeyId: 'minioadmin',
  secretAccessKey: 'minioadmin',
} as const;

export interface SigV4Config {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

import { isProductionLike, readSecretOrEnv } from '../config/env.config';

/** Load S3 credentials/endpoint from env (dev-only fallbacks, never prod). */
export function s3ConfigFromEnv(): SigV4Config {
  const endpoint = readSecretOrEnv('S3_ENDPOINT');
  const accessKeyId = readSecretOrEnv('S3_ACCESS_KEY');
  const secretAccessKey = readSecretOrEnv('S3_SECRET_KEY');
  if (isProductionLike() && (!endpoint || !accessKeyId || !secretAccessKey)) {
    throw new Error('env: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY are required in staging/production');
  }
  return {
    endpoint: endpoint ?? DEV_FALLBACKS.endpoint,
    accessKeyId: accessKeyId ?? DEV_FALLBACKS.accessKeyId,
    secretAccessKey: secretAccessKey ?? DEV_FALLBACKS.secretAccessKey,
    region: readSecretOrEnv('S3_REGION') ?? DEFAULT_REGION,
  };
}

/** RFC 3986 encode with uppercase percent-hex (SigV4 canonical form). */
function amzEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Hash a payload (or canonical request) as lowercase hex SHA-256. */
function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

/** Canonical path-style URI: each segment encoded, slashes preserved. */
function canonicalUri(path: string): string {
  return path
    .split('/')
    .map((segment) => (segment ? amzEncode(segment) : ''))
    .join('/');
}

function amzDateParts(now: Date): { amzDate: string; dateStamp: string } {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

function scopeOf(dateStamp: string, region: string): string {
  return `${dateStamp}/${region}/${SERVICE}/${SIGNED_SUFFIX}`;
}

/** Signing key chain: kDate → kRegion → kService → kSigning. */
function signingKey(secret: string, dateStamp: string, region: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, SIGNED_SUFFIX);
}

function canonicalQueryString(params: URLSearchParams): string {
  return [...params.entries()]
    .map(([k, v]) => [amzEncode(k), amzEncode(v)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

/**
 * Build a presigned URL for `method` on `/{bucket}/{key}` (path-style).
 * Query-string signing: all X-Amz-* params live in the URL, UNSIGNED-PAYLOAD.
 */
export function presignUrl(
  config: SigV4Config,
  method: 'GET' | 'PUT' | 'DELETE' | 'HEAD',
  bucket: string,
  key: string,
  expiresSeconds: number = PRESIGN_EXPIRES_SECONDS,
): string {
  const endpoint = new URL(config.endpoint);
  const path = `/${bucket}${key ? `/${key}` : ''}`;
  // The SENT path must be byte-identical to the canonical path: percent-encode
  // the raw path segment-wise FIRST (so `#`, `?`, `%` in a key cannot be
  // swallowed by WHATWG URL parsing and `%` is never left raw), then build the
  // URL from the already-encoded string (WHATWG URL does not re-encode
  // percent-triplets it parses from a string, and assignment back to
  // `url.pathname` would normalize them — string concat is the only exact way).
  const canonicalPath = canonicalUri(path);
  const url = new URL(`${endpoint.origin}${canonicalPath}`);
  const { amzDate, dateStamp } = amzDateParts(new Date());
  const scope = scopeOf(dateStamp, config.region);

  url.searchParams.set('X-Amz-Algorithm', ALGORITHM);
  url.searchParams.set('X-Amz-Credential', `${config.accessKeyId}/${scope}`);
  url.searchParams.set('X-Amz-Date', amzDate);
  url.searchParams.set('X-Amz-Expires', String(expiresSeconds));
  url.searchParams.set('X-Amz-SignedHeaders', 'host');

  const canonicalRequest = [
    method,
    canonicalPath,
    canonicalQueryString(url.searchParams),
    `host:${endpoint.host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const signature = createHmac('sha256', signingKey(config.secretAccessKey, dateStamp, config.region))
    .update(stringToSign, 'utf8')
    .digest('hex');

  url.searchParams.set('X-Amz-Signature', signature);
  return url.toString();
}

/**
 * Signed header request descriptor for admin-style operations (PutBucket,
 * ListObjectsV2, DeleteObject) used by test bootstrap. Returns the method,
 * absolute URL and the exact headers to send (they are part of the signature).
 * Body-less requests only: x-amz-content-sha256 is the empty-payload hash.
 */
export function signedHeaderRequest(
  config: SigV4Config,
  method: 'GET' | 'PUT' | 'DELETE' | 'HEAD',
  path: string,
  extraQuery: Record<string, string> = {},
): { method: string; url: string; headers: Record<string, string> } {
  const endpoint = new URL(config.endpoint);
  // Build the canonical path from the raw `path` argument (percent-encode each
  // segment, preserve slashes). Do NOT read `url.pathname` back — WHATWG URL
  // already percent-encodes it, which would double-encode `%` → `%25`.
  const canonicalPath = canonicalUri(path);
  // The SENT path must equal the canonical path: build from the already-encoded
  // form so `#`/`?`/`%` in `path` cannot be reinterpreted by WHATWG URL parsing.
  const url = new URL(`${endpoint.origin}${canonicalPath}`);
  for (const [k, v] of Object.entries(extraQuery)) url.searchParams.set(k, v);

  const { amzDate, dateStamp } = amzDateParts(new Date());
  const scope = scopeOf(dateStamp, config.region);
  const payloadHash = sha256Hex('');
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    method,
    canonicalPath,
    canonicalQueryString(url.searchParams),
    `host:${endpoint.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const signature = createHmac('sha256', signingKey(config.secretAccessKey, dateStamp, config.region))
    .update(stringToSign, 'utf8')
    .digest('hex');

  return {
    method,
    url: url.toString(),
    headers: {
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization:
        `${ALGORITHM} Credential=${config.accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}
