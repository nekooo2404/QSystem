# QSystem Production Readiness — Historical Implementation Evidence

> **Evidence status (2026-11-16): superseded and not a release approval.**
> The live DB/S3/Meilisearch, Docker, and Playwright claims below were recorded
> by an earlier run and are not reproducible from the current checkout without
> its external services. The current audit-remediation run records only direct
> local evidence and keeps unavailable integration gates blocked.

For the current scope, findings, and verification state see
`docs/harness/qsystem-audit-remediation-spec.md` and
`docs/harness/qsystem-audit-remediation-tasks.json`.

**Task ID:** `qsystem-production-readiness`  
**Status:** Historical record only; live/integration evidence must be re-run for the current checkout.

## 1. Delivered Waves

### Wave 1 — Deployable Runtime, Containers, Env & Health
- Added production build, start, dev, typecheck, and migration scripts in `packages/contracts/package.json`, `packages/contracts/tsconfig.build.json`, `apps/api/package.json`, `apps/api/tsconfig.build.json`, and `apps/api/vitest.config.ts` (`fileParallelism: false` + sequential CLI runs).
- Implemented secret-file hydration (`<KEY>_FILE`) and environment-strict validation (`readSecretOrEnv`, `hydrateSecretsFromFiles`, `validateRuntimeEnv`, `isProductionLike`) in `apps/api/src/config/env.config.ts`.
- Implemented liveness and readiness probes (`GET /health/live`, `GET /health/ready`) checking PostgreSQL, S3/RustFS, and Meilisearch in `apps/api/src/health/{health.controller.ts,health.service.ts,health.module.ts}`, plus helper connectivity in `apps/api/src/storage/sigv4.ts` and `apps/api/src/search/search.service.ts`.
- Added `.dockerignore`, `apps/api/Dockerfile`, `apps/web/Dockerfile`, `infra/docker-compose.prod.yml`, `infra/.env.staging.example`, and `infra/.env.production.example` (including `COOKIE_PATH=/` for Next.js middleware `/api/*` proxy compatibility).

### Wave 2 — QTask PostgreSQL Persistence & RLS
- Updated `packages/contracts/src/{org.ts,auth.ts,index.ts}` with `TaskStatusSchema`, `TaskPrioritySchema`, `CreateTaskSchema`, `UpdateTaskSchema`, `TaskQuerySchema`, `CreateUserSchema`, and exported `Role`.
- Added Prisma migration `apps/api/prisma/migrations/20261114120000_production_readiness/migration.sql` introducing `tasks`, `task_code_seq`, `notifications.read_at`, and PostgreSQL Row-Level Security (RLS) policies scoped by tenant/department/role.
- Implemented tenant/role-scoped task listing (pagination & filters), creation, and status updates (`GET /org/tasks`, `POST /org/tasks`, `PATCH /org/tasks/:id`) in `apps/api/src/org/{org.controller.ts,org.service.ts}` and removed the `localStorage` source-of-truth fallback from `apps/web/src/lib/adapters/tasks.adapter.ts`.

### Wave 3 — Product APIs & Web Integration
- Added notification read-state persistence (`PATCH /notifications/:id/read`, `POST /notifications/read-all`) and live SSE stream (`GET /notifications/stream`) across `apps/api/src/notify/{notify.controller.ts,notify.service.ts,notify.worker.ts,providers/notification-provider.interface.ts,providers/local-socket.gateway.ts}` and `apps/web/src/lib/adapters/notifications.adapter.ts` (including polling fallback).
- Added scoped persisted file listing (`GET /files`) in `apps/api/src/storage/{storage.controller.ts,storage.service.ts}`.
- Added user provisioning (`POST /org/users`) with role/department authorization and wired `apps/web/src/components/qhrm/{QhrmDirectory.tsx,CreateUserModal.tsx}`.
- Served server-configured module registry via `GET /registry` (`apps/api/src/registry/registry.controller.ts`, `ENABLED_MODULES`) consumed by `apps/web/src/lib/adapters/registry.adapter.ts`.

### Wave 4 — API Hardening, Cookies, CSRF & Redis Rate Limiting
- Added `apps/api/src/common/http-hardening.ts` (`applyHttpHardening`) and wired it in `apps/api/src/main.ts` (`bodyParser: false` + JSON/urlencoded body size limits returning `413 PAYLOAD_TOO_LARGE` via `apps/api/src/common/exception.filter.ts`, Helmet security headers + prod/staging HSTS, `X-Request-Id` propagation, structured JSON request logging without secrets/headers, strict `CORS_ORIGINS` allowlist).
- Updated `apps/api/src/iam/iam.service.ts` for env-driven `COOKIE_SECURE`, `COOKIE_SAME_SITE`, `COOKIE_DOMAIN`, and `COOKIE_PATH` on both `cookie()` and `clearCookie()`.
- Updated `apps/api/src/iam/iam.controller.ts` with `assertSameOriginCsrf` (`403 CSRF_FORBIDDEN` on `POST /auth/refresh` and `POST /auth/logout` when Origin/Referer mismatches) and `x-test-suite-id` rate-limit key scoping under `NODE_ENV=test`.
- Implemented RESP2 Redis fixed-window Lua rate limiting (`RATE_LIMIT_STORE=redis`, `REDIS_URL`) in `apps/api/src/iam/{redis-resp.client.ts,login-rate-limit.ts}` alongside the PostgreSQL fallback.
- Added integration test suite `apps/api/test/production-readiness.spec.ts` (8 tests covering QTask RLS, `POST /org/users`, HTTP hardening/CSRF/413/cookies, Redis rate-limit client, files, registry, notifications `readAt`/SSE).

### Wave 5 & 6 — Playwright E2E, CI/CD & Production Operations
- Added Playwright responsive Dark/Light E2E suite `apps/web/e2e/console-ui.spec.ts`, deterministic DB seeding `apps/api/scripts/seed-e2e.ts`, `apps/web/playwright.config.ts`, and orchestrator `scripts/ops/run-playwright-e2e.mjs` covering `1440x900`, `1024x768`, and `390x844` across `/login`, `/`, `/org`, `Ctrl+K`, `/files`, and `/notifications`.
- Updated `.github/workflows/ci.yml` with `contracts`, `harness`, `ui`, sequential `api` (PostgreSQL + RustFS/S3 + Meilisearch + Redis + `prisma migrate deploy`), `web`, `playwright`, `containers`, `deploy-staging`, and `deploy-production` jobs.
- Published `docs/ops/PRODUCTION_OPERATIONS.md` (PostgreSQL backup/PITR/restore & forward-only rollback, S3 versioning/lifecycle/replication, Meilisearch shadow-index alias swap, metrics/structured logs/alerts, secret rotation & `audit_logs` retention, TLS/reverse proxy/autoscaling, staging promotion & rollback) and `scripts/ops/smoke-check.mjs`.
- Closed `docs/harness/backend-companion-backlog.md` and defined `docs/harness/production-readiness-tasks.json`.

## 2. Verification Results (Directly Observed)

| Check Command | Outcome | Details |
|---|---|---|
| `corepack pnpm --filter api typecheck` | Passed | Exited 0 after final edits |
| `corepack pnpm --filter api build` | Passed | `@qsystem/contracts build` + `tsc -p tsconfig.build.json` exited 0 |
| `corepack pnpm --filter api test` | Passed | 8 test files, 73/73 tests passed (`--no-file-parallelism`) |
| `corepack pnpm --filter web test` | Passed | 9 test files, 48/48 tests passed |
| `corepack pnpm --filter web exec tsc --noEmit` | Passed | Exited 0 |
| `corepack pnpm --filter web build` | Passed | Next.js production build exited 0 (14/14 routes) |
| `node scripts/ops/run-playwright-e2e.mjs` | Passed | 2/2 Chromium E2E tests passed (`9.2s`) across `1440x900`, `1024x768`, `390x844` Dark/Light |
| `node scripts/ops/smoke-check.mjs --api http://127.0.0.1:3019` | Passed | Returned `{"ok":true,"api":"http://127.0.0.1:3019","web":null,"modules":["qtask","qhrm","qcrm","qsocial"]}` against compiled `apps/api/dist/main.js` |
| `node scripts/harness/tester.mjs` (`qsystem-production-readiness`) | Passed | `@qsystem/contracts` (1 file / 8 tests), `@qsystem/harness` (9 files / 30 tests + tsc), `@qsystem/ui` (9 files / 78 tests + tsc), and `api` sequential suite all passed |

## 3. Operational Prerequisites & Unexecuted Checks
- **Docker Container Builds Locally:** `docker build` (`apps/api/Dockerfile`, `apps/web/Dockerfile`) and `infra/docker-compose.prod.yml` were not executed locally because the local Docker Desktop daemon pipe was unavailable; CI workflow `.github/workflows/ci.yml` executes container builds and smoke verification in the `containers` job.
- **Cloud Secret Manager & Deploy Hooks:** `deploy-staging` and `deploy-production` in `.github/workflows/ci.yml` require repository secrets, container registry push credentials, cluster deployment steps (Kubernetes/ECS/Compose), and mounted secret files (`*_FILE`) provisioned per `docs/ops/PRODUCTION_OPERATIONS.md`.
- **Multi-Replica SSE Fan-out:** Current SSE stream (`LocalSocketGateway`) uses an in-process `EventEmitter` with a UI polling fallback (`apps/web/src/lib/adapters/notifications.adapter.ts`); cross-pod push delivery across multiple API replicas will require attaching a shared pub/sub broker (e.g., Redis pub/sub over `REDIS_URL`).
