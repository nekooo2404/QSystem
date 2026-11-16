# QSystem Enterprise Audit Remediation Specification

Task ID: `qsystem-audit-remediation`

## Outcome

Remove the production and security defects recorded in the 2026-11-16 audit
documents, with PostgreSQL as the source of truth, server-enforced tenant and
record scope, honest UI state, and deterministic verification evidence.

## Scope

- Persist CRM customers and deal values in PostgreSQL and enforce record scope.
- Enforce task assignment, workflow transitions, dates, optimistic concurrency,
  and DIRECT policy from persisted state.
- Replace fake account-security controls with truthful server-backed behavior.
- Make file metadata and object-storage operations consistent and observable.
- Make notification delivery schedulable, lease-safe, and idempotent across
  API replicas.
- Close the remaining IAM, audit, tenant, HR, configuration, CI, health, search,
  and responsive UI gaps identified by the audit.
- Update tests and operator evidence so claims match the checked-out code.

## Constraints

- Use `corepack pnpm` for all repository dependency, script, test, build, and
  executable commands.
- Do not introduce production credentials or weaken RLS/authorization.
- Preserve unrelated worktree changes and use forward-only migrations.
- Keep Vietnamese user-facing copy and the existing QSystem design tokens.
- Do not claim live provider, Docker, browser, or cloud verification without
  direct evidence.

## Acceptance criteria

1. CRM mutations survive service restart and are invisible outside the viewer's
   organization/owner/department scope.
2. Task assignment and status changes are validated against persisted task state,
   use stable ownership semantics, reject invalid dates/transitions, and return
   a conflict on stale versions.
3. Account security never reports an unimplemented MFA/session action as done;
   implemented controls are server-backed and tested.
4. File rename/delete/upload finalization have explicit server outcomes, object
   consistency checks, and UI error handling.
5. Notification workers have a cross-instance lease and runtime scheduler seam;
   duplicate claims are rejected by deterministic tests.
6. Production configuration, health/smoke, CI, RLS, tenant, audit, HR, search,
   and design-system claims are either fixed or explicitly exposed as unavailable
   with a failing/blocked evidence record.
7. Focused tests, typechecks, builds, and available browser checks pass; all
   unavailable environment checks remain listed as unresolved limitations.

## Non-goals

- No production deployment, cloud mutation, GitHub issue creation, or credential
  rotation.
- No replacement of the approved visual system or provider activation.
- No destructive database reset or history rewrite.
