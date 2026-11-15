# QSystem Production Readiness Plan

Task ID: `qsystem-production-readiness`

## Delivery waves

1. **Runtime and platform baseline** — API scripts, environment validation,
   health/readiness, Dockerfiles, migration deploy command, CI web/API/container
   gates. Owner: platform-sre; review: independent-reviewer; verify: tester.
2. **QTask persistence and scope** — Prisma model/migration, tenant/RLS policy,
   service/controller contracts, frontend adapter migration, role/tenant tests.
   Owner: backend-engineer + frontend-engineer; security review: security-engineer.
3. **Missing product APIs** — notification read state, file list, user creation,
   registry, transport boundary/polling fallback. Owner: backend-engineer;
   frontend integration owner: frontend-engineer.
4. **API hardening** — secure cookie policy, request IDs/logging, body limits,
   shared rate limit store boundary, safe exception mapping, CSRF decision and tests.
   Owner: backend-engineer; security-engineer review.
5. **Production operations** — backups/restore, lifecycle/rebuild runbooks,
   observability/alerts, secret rotation, TLS/reverse proxy/resources/autoscale,
   staging promotion and rollback. Owner: platform-sre; review: independent-reviewer.
6. **Release verification** — deterministic unit/integration/web/Playwright
   checks, migration/health smoke, security review, release recommendation.
   Owners: tester + qa-browser-engineer; gate: ceo-integrator.

## Dependencies and rollback

- Wave 1 must land before any deploy claim.
- Wave 2 migration is additive first; rollback is a forward migration or restore
  procedure, never destructive reset.
- Frontend switches to API reads only after API list/create/update tests pass;
  keep a feature flag or explicit error state during transition.
- Each wave records exact commands, changed files, test evidence, and remaining
  demo/mock limitations in the Harness ledger.

## Required verification

- `corepack pnpm --filter api build` and `start` smoke.
- `corepack pnpm --filter web test`, `typecheck`, and `build`.
- API integration suite with `--no-file-parallelism` after `prisma migrate deploy`.
- Browser checks at 1440x900, 1024x768, 390x844 in Dark/Light and reduced motion.
- Container build and health/readiness checks with dependency failures tested.
- Independent security and release review before any publication or deployment.
