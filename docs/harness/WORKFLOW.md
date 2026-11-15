# Harness Execution Workflow

This is the operational interpretation of the SDD/superpowers artifacts in
`docs/superpowers`. It supplements the immutable constitution; it does not
replace it.

## Toolchain

Use `corepack pnpm` exclusively. The root `package.json` pins pnpm 12.6.0 and
`pnpm-lock.yaml` is the only accepted dependency lockfile. Do not use npm to
install dependencies, run scripts, or generate a second lockfile.

## Specify

Read the approved product spec and write one task artifact containing scope,
constraints, acceptance criteria, non-goals, dependencies, and affected files.
Do not infer missing requirements from a plan or from another agent's chat.

## Plan

Write the smallest implementation plan that names callers, tests, fixtures,
configuration, gates, and rollback/verification boundaries. Plan artifacts must
be tied to one `taskId`; a preview without `--task-id` is not governance state.

## Implement

- Dispatch through a named team agent using `--agents`; direct coding by an
  unregistered agent is blocked.
- Every agent process must run inside the QSystem workspace. Cross-repository
  cwd/configuration is rejected; use a separate project registry for another
  codebase.
- Every code card has one implementation owner, one independent reviewer, and
  one verification owner. Frontend cards require `frontend-engineer`; security-
  sensitive cards require `security-engineer`.
- After each task marked `verifyAfter`, the `tester` agent runs focused checks
  before the dependency graph can advance. Missing typed `test-results` blocks
  the next task.
- Follow TDD where a correct seam exists: RED evidence, implementation, GREEN evidence.
- Preserve repository policy, scope, and unrelated work; do not rewrite history
  or overwrite another agent's files.
- Run review before completion, then run a separate systematic-debugging and
  verification-before-completion pass (the SDD R11 gate).
- Record direct commands, exit codes, test counts, and unresolved limitations.
- A process interruption is resumable work, never a successful implementation.

## Tasks

Create a task manifest from the approved plan. `tasks sync` uses `gh` to create
or update GitHub Issues using stable `[QSYS:<taskId>:<subtaskId>]` keys. It is
idempotent, requires explicit repository/authentication, and runs only after
implementation evidence is recorded.

Generated reports, caches, transcripts, and `.remember` runtime logs are
evidence sources, not authority. Promote a finding into a rule only after it is
reproduced or explicitly accepted by the user/repository policy.
