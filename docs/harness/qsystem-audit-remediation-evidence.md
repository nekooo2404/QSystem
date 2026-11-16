# QSystem Audit Remediation Evidence

Task ID: `qsystem-audit-remediation`
Date: 2026-11-16 (Asia/Saigon)

## Direct evidence

- `corepack pnpm install --frozen-lockfile`: passed; dependencies installed from
  the existing lockfile.
- `corepack pnpm --filter @qsystem/contracts test`: passed, 9/9.
- `corepack pnpm --filter @qsystem/ui test`: passed, 79/79.
- `corepack pnpm --filter web test`: passed, 67/67.
- `corepack pnpm --filter api exec vitest run test/audit-remediation-scope.spec.ts`:
  passed, 2/2.
- `corepack pnpm --filter api typecheck`: passed.
- `corepack pnpm --filter web typecheck`: passed.
- `corepack pnpm --filter api build`: passed.
- `corepack pnpm --filter web build`: passed.
- `DATABASE_URL=postgresql://... corepack pnpm --filter api exec prisma validate`:
  passed. The URL was a validation placeholder only; no database connection was
  available or mutated by this run.
- `git diff --check`: passed.

## Blocked gates

- Harness CLI gates (`roles`, `constitution`, and therefore the named-agent
  `specify -> plan -> implement -> tasks` runtime) are blocked because this
  checkout has no `harness` package/command. The fallback spec, plan, tasks, and
  evidence artifacts are present, but this is not a Harness approval.
- API integration suites are blocked at bootstrap because `RLS_OWNER_URL` and
  PostgreSQL/S3/Meilisearch/Redis services are unavailable in the environment.
- Docker image/compose smoke and Playwright responsive render checks were not
  executed because Docker/browser service availability was not established.
- Fragment UI MCP and Hallmark sloplint were not callable from this CLI session;
  no new UI primitive was introduced.

## Remediation summary

- CRM customers/deals moved to PostgreSQL models and scoped RLS/app queries.
- Task assignment scope, DIRECT-flow policy, date validation, transitions, and
  optimistic version CAS were added.
- File display names are separated from immutable object keys; failed rename and
  delete operations remain visible to the UI.
- Notification delivery has runtime scheduling and DB leases for cross-instance
  claim safety.
- Suspended/deactivated users fail closed at login and viewer resolution.
- HR job titles persist in PostgreSQL; CRM pipeline summary reads persisted deal
  amounts/probabilities; refresh sessions retain `remember` and expose scoped
  list/revoke endpoints.
- Readiness now verifies the configured S3 bucket with a signed request and
  verifies Redis when the shared rate limiter is enabled; CI has an explicit
  release gate covering all quality jobs.
- Production migration secret hydration and readiness health checks now gate
  container health; historical implementation claims were marked superseded.
