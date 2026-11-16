import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const secretFile = process.env.DATABASE_URL_FILE?.trim();
if (secretFile) {
  const value = readFileSync(secretFile, 'utf8').trim();
  if (!value) throw new Error('DATABASE_URL_FILE is empty');
  process.env.DATABASE_URL = value;
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL or DATABASE_URL_FILE is required');

const result = spawnSync('corepack', ['pnpm', 'exec', 'prisma', 'migrate', 'deploy'], {
  cwd: new URL('..', import.meta.url),
  env: process.env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
