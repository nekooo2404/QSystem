# QSystem Enterprise Audit Remediation Plan

Task ID: `qsystem-audit-remediation`

## Workstreams

1. **Data and authorization**: CRM persistence/scope, task ownership and
   lifecycle, tenant context, RLS, HR employment fields, dynamic CRM metrics.
2. **Security and reliability**: truthful account controls, session lifecycle,
   atomic audit/outbox, notification leases/scheduler, upload finalization.
3. **Platform and operations**: migration secret hydration, strict config/CSP,
   health and smoke gates, CI dependencies, operator evidence.
4. **Web experience**: API-backed projects and task interactions, server-side
   task paging/search, file mutation errors, scoped search/cache, token and
   navigation consistency.

## Order and dependencies

- Add additive Prisma schema/migrations and contracts first.
- Implement backend scope/policy and focused tests before web adapters.
- Wire runtime worker and platform gates after storage/auth contracts exist.
- Update web states and responsive tests after API behavior is stable.
- Run independent review and deterministic verification before publishing the
  task manifest. Docker/cloud checks remain environment-dependent.

## Risks and rollback

- CRM/task schema changes are additive; rollback is a forward migration or
  restore, never `migrate reset`.
- Strict security behavior may expose existing fixture assumptions; update
  fixtures to use explicit test configuration rather than weakening production.
- Object moves can orphan bytes; preserve immutable keys and use tombstone/outbox
  cleanup until provider verification succeeds.
- Multi-tenant changes must fail closed when tenant context is absent.

## Verification plan

- Focused API unit/integration tests for each authorization and state transition.
- Contracts/UI tests and API/web typechecks/builds through `corepack pnpm`.
- Deterministic Harness tester when the missing CLI/runtime is restored.
- Playwright Dark/Light checks at 1440x900, 1024x768, and 390x844 when the
  browser environment is available.
- Review the final diff for secret leakage, RLS bypasses, and audit claims.
