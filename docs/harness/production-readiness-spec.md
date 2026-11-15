# QSystem Production Readiness Specification

Task ID: `qsystem-production-readiness`

## Outcome

Make QSystem deployable and operable as a web application with a NestJS API,
Next.js web app, PostgreSQL, S3-compatible storage, and Meilisearch. Replace
QTask's local-only persistence with tenant-scoped PostgreSQL data and close the
API gaps that currently force UI fallbacks.

## Scope

- API runtime: `dev`, `build`, `start`, health/readiness, environment validation,
  secure cookies, request IDs, structured logs, bounded request bodies, safe
  error responses, and production-safe rate limiting.
- Deployment: API and web Dockerfiles, production compose/deployment examples,
  migration deploy command, CI build/test/container/migration smoke gates,
  staging promotion and rollback documentation.
- QTask: Prisma model and migration, tenant/RLS policy, scoped list/create/
  update endpoints with pagination and filters, frontend adapter without the
  localStorage source of truth, and role/tenant tests.
- Missing API surfaces: notification read state, file listing, user creation,
  server registry, and a production notification transport boundary with polling
  fallback when a socket transport is unavailable.
- Operations: backup/restore runbook, retention/lifecycle settings, search
  rebuild procedure, observability, alerting, secret rotation, TLS/reverse
  proxy/resource/rollback documentation.

## Constraints

- Use `corepack pnpm`; keep `pnpm-lock.yaml` as the only lockfile.
- Preserve unrelated dirty worktree changes.
- Keep tenant and viewer scope enforced at storage/query boundaries; never trust
  a tenant or role supplied by the browser.
- `migrate deploy` is the only release migration command; `migrate dev` remains
  local development only.
- No production credentials in source, fixtures, logs, docs, CI output, or
  committed environment files.
- Use existing dependencies where possible; no live provider credentials are
  required for local deterministic tests.
- Browser tests must be deterministic and cover 1440x900, 1024x768, and
  390x844 in Dark and Light modes.

## Acceptance criteria

1. `apps/api` has working `dev`, `build`, `start`, `db:migrate:deploy`, and
   `db:generate` scripts; `apps/web` and `apps/api` have production Dockerfiles.
2. `/health/live` is process-only and `/health/ready` verifies required database,
   S3, and Meilisearch dependencies with bounded timeouts and safe responses.
3. Production configuration fails closed for missing secrets and never uses
   dev fallback values; cookies are HttpOnly, Secure in production, SameSite and
   path/domain are explicit; same-origin proxy remains the default browser path.
4. QTask rows persist in PostgreSQL, carry tenant and ownership/department
   scope, are protected by ORM scope plus PostgreSQL RLS, and support paginated
   filtered `GET /org/tasks`, authenticated `POST`, and scoped `PATCH`.
5. QTask web reads/writes the API and does not use localStorage as its primary
   source of truth; API failures render an explicit error state.
6. Notifications support server-side read state; files support scoped listing;
   authorized roles can create users; registry data is server-backed; notification
   transport has a production boundary and a bounded polling fallback.
7. API hardening includes request ID, structured logs, safe error mapping,
   body-size limits, shared-store rate limiting, and an explicit CSRF decision
   tested for the cookie refresh flow.
8. CI runs contracts, UI, API sequential integration tests after migrations,
   web tests/typecheck/build, Playwright responsive Dark/Light checks, container
   builds, migration smoke, and health smoke. Staging promotion and rollback are
   documented and use immutable artifacts.
9. Backup/restore, S3 lifecycle, Meilisearch rebuild, metrics/logs/traces,
   alerting, secret rotation, audit retention, TLS, reverse proxy, resource
   limits, and autoscaling guidance are committed as operator documentation.
10. Focused tests and typechecks pass for every completed phase; unresolved
    production limitations are listed explicitly and do not get marked as done.

## Non-goals

- No production deployment or external credential mutation in this task.
- No replacement of the approved QSystem visual system.
- No real email/Viber/LiveKit/OpenAI provider activation; only provider seams,
  safe adapters, and local deterministic verification.
- No removal of RLS or weakening of authorization to make tests pass.
