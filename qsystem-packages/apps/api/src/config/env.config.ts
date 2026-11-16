import { readFileSync } from 'node:fs';

export type RuntimeEnv = 'development' | 'test' | 'staging' | 'production';

const SECRET_KEYS = [
  'DATABASE_URL',
  'RLS_OWNER_URL',
  'QSYSTEM_APP_PASSWORD',
  'JWT_SECRET',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'MEILI_MASTER_KEY',
  'REDIS_URL',
] as const;

const PLACEHOLDER_SECRETS = new Set([
  'dev-secret',
  'change-me',
  'changeme',
  'change-me-32-chars-minimum-0000',
  'rustfsadmin',
  'minioadmin',
  'dev-meili-key',
  'qsystem-dev-secret',
  'test-secret',
]);

/**
 * Read a secret from `<KEY>_FILE` (Docker/K8s secret mount) first, falling
 * back to `process.env[key]`. Returns undefined when blank or unset.
 */
export function readSecretOrEnv(key: string): string | undefined {
  const filePath = process.env[`${key}_FILE`]?.trim();
  if (filePath) {
    let raw: string;
    try {
      raw = readFileSync(filePath, 'utf8').trim();
    } catch {
      throw new Error(`env: cannot read secret file referenced by ${key}_FILE`);
    }
    if (!raw) {
      throw new Error(`env: secret file referenced by ${key}_FILE is empty`);
    }
    return raw;
  }
  const direct = process.env[key]?.trim();
  return direct && direct.length > 0 ? direct : undefined;
}

/** Populate process.env from any configured `<KEY>_FILE` secret mounts. */
export function hydrateSecretsFromFiles(keys: readonly string[] = SECRET_KEYS): void {
  for (const key of keys) {
    if (process.env[`${key}_FILE`]?.trim()) {
      process.env[key] = readSecretOrEnv(key);
    }
  }
}

export function getRuntimeEnv(): RuntimeEnv {
  const candidate = (process.env.APP_ENV || process.env.NODE_ENV || 'development').toLowerCase();
  if (candidate === 'production' || candidate === 'staging' || candidate === 'test') {
    return candidate;
  }
  if (candidate !== 'development') {
    throw new Error(`env: APP_ENV/NODE_ENV must be development, test, staging, or production; received ${candidate}`);
  }
  return 'development';
}

export function isProductionLike(): boolean {
  const env = getRuntimeEnv();
  return env === 'production' || env === 'staging';
}

function assertNonPlaceholderSecret(key: string, minLength = 1): void {
  const val = readSecretOrEnv(key);
  if (!val || val.length < minLength) {
    throw new Error(`env: ${key} is required in ${getRuntimeEnv()} mode (min length ${minLength})`);
  }
  if (isProductionLike() && PLACEHOLDER_SECRETS.has(val.toLowerCase())) {
    throw new Error(`env: ${key} must not use a development placeholder in ${getRuntimeEnv()} mode`);
  }
}

/**
 * Validate required runtime configuration and load file-mounted secrets before
 * starting Nest or accessing downstream storage/search clients.
 */
export function validateRuntimeEnv(): { env: RuntimeEnv; productionLike: boolean } {
  hydrateSecretsFromFiles();
  const env = getRuntimeEnv();
  const productionLike = isProductionLike();
  const tenancyMode = (process.env.TENANCY_MODE ?? 'single-tenant').trim().toLowerCase();
  if (tenancyMode !== 'single-tenant') {
    throw new Error('env: multi-tenant mode is not supported by this deployment; use TENANCY_MODE=single-tenant');
  }

  if (productionLike) {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      throw new Error(`env: NEXT_PUBLIC_DEMO_MODE must be false or unset in ${env} mode`);
    }
    if (process.env.COOKIE_SECURE?.trim().toLowerCase() === 'false') {
      throw new Error(`env: COOKIE_SECURE must not be false in ${env} mode`);
    }
    const sameSite = process.env.COOKIE_SAME_SITE?.trim().toLowerCase();
    if (sameSite === 'none' && process.env.COOKIE_SECURE?.trim().toLowerCase() !== 'true') {
      throw new Error('env: COOKIE_SECURE=true is required when COOKIE_SAME_SITE=none');
    }
  }

  if (productionLike) {
    assertNonPlaceholderSecret('JWT_SECRET', 32);
    assertNonPlaceholderSecret('DATABASE_URL', 10);
    for (const key of ['S3_ENDPOINT', 'S3_BUCKET'] as const) {
      if (!readSecretOrEnv(key)) {
        throw new Error(`env: ${key} is required in ${env} mode`);
      }
    }
    assertNonPlaceholderSecret('S3_ACCESS_KEY', 3);
    assertNonPlaceholderSecret('S3_SECRET_KEY', 8);
    if (!readSecretOrEnv('MEILI_URL') && !readSecretOrEnv('MEILI_HOST')) {
      throw new Error(`env: MEILI_URL is required in ${env} mode`);
    }
    assertNonPlaceholderSecret('MEILI_MASTER_KEY', 8);
  } else {
    assertNonPlaceholderSecret('JWT_SECRET', 1);
  }

  return { env, productionLike };
}

export function isPlaceholderSecret(value: string): boolean {
  return PLACEHOLDER_SECRETS.has(value.trim().toLowerCase());
}
