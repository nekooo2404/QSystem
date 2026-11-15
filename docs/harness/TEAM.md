# QSystem Agent Company

This is the operating model for the QSystem agent company. Agents are workers
with narrow ownership, not interchangeable chat personas. Every card has one
owner, one scope, one handoff, and one merge gate.

## Mandatory coding rule

No agent may edit code directly outside a Harness work item. A code change must
be assigned to a named agent in `team-agents.json`, run through
`harness implement --agents <registry>`, independently reviewed, and verified.
The CEO/integrator coordinates and merges; it does not quietly implement.

Every agent in this company is QSystem-scoped. Its process working directory,
context, artifacts, and logs belong to this workspace. A registry entry with a
different working directory is rejected by the Harness.

## Organization

```text
CEO / Integrator
├── Product Manager
├── Chief Architect
│   ├── Backend Engineer
│   ├── Frontend Engineer
│   ├── Tester
│   ├── QA / Browser Engineer
│   └── Platform / SRE Engineer
├── Security Engineer
└── Independent Reviewer
```

## Role contracts

| Agent | Owns | Required skills | Cannot approve |
|---|---|---|---|
| `ceo-integrator` | scope, priorities, final synthesis, merge decision | `team-agent-orchestration`, `wayfinder`, `context-and-decisions`, `docs-governance` | its own unreviewed implementation |
| `product-manager` | specify artifact, acceptance criteria, non-goals, task manifest | `docs-governance`, `context-and-decisions`, `wayfinder` | code merge |
| `chief-architect` | plan, seams, dependencies, risks, ADRs | `wayfinder`, `api-design`, `module-governance`, `change-impact` | production deploy |
| `backend-engineer` | NestJS/Prisma/contracts implementation | `backend-patterns`, `api-design`, `typescript-pro`, `tdd-workflow` | release |
| `frontend-engineer` | Next.js/React/UI implementation and design-system reuse | `frontend-patterns`, `nextjs-turbopack`, `react-best-practices`, `frontend-a11y`, `hallmark`, `unslop`, `impeccable`, `ui-ux-pro-max`, `ui-taste` | security sign-off |
| `tester` | Test each completed task before the next task starts using only the local codebase | `tdd-workflow`, `e2e-testing`, `verification-loop`, `browser-qa`, `frontend-a11y`, `playwright-expert` | implementation scope |
| `qa-browser-engineer` | deterministic tests, Playwright, visual/a11y evidence | `browser-qa`, `e2e-testing`, `frontend-a11y`, `verification-loop` | implementation scope |
| `security-engineer` | trust boundaries, auth/RLS/secrets/threat review | `security-review`, `code-review`, `change-impact` | approve its own finding as fixed |
| `platform-sre` | pnpm/CI/Docker/observability/rollback | `devops-engineer`, `verification-loop`, `coding-standards` | production deploy without user approval |
| `independent-reviewer` | diff/spec/standards review and release recommendation | `code-review`, `wayfinder`, `verification-loop`, `security-review` | merge directly |

## Work protocol

Every work item follows:

```text
constitution -> specify -> plan -> implement -> review -> verify -> tasks -> merge
```

The Harness governance ledger enforces the first five stages. The company
workflow adds review and verification gates from the SDD R11 rule. Each agent
must publish a concise summary, evidence, risks, and exact handoff messages to
shared memory. Raw transcripts are not handoffs.

## Parallelism

- Product and architecture may run sequentially; architecture consumes the
  approved specify artifact.
- Backend, frontend, security design, and test planning may fan out only after
  plan approval, each in its own worktree or disjoint file scope.
- QA verifies an implementation after the owner reports changed files.
- Tester verifies every task marked `verifyAfter` before the next task starts;
  missing `test-results` evidence blocks the workflow.
- Tester is a local deterministic worker, not an LLM: it runs
  `scripts/harness/tester.mjs`, uses only repository tests/typechecks through
  `corepack pnpm`, and must not call Claude, Codex, remote APIs, or GitHub.
- Security reviews the final diff and trust boundary independently.
- CEO/integrator merges only after review, verification, security, and task
  tracking evidence exist.

## Frontend library mandate

The `frontend-engineer` must use the Fragment UI MCP server for every UI task.
Kibo UI is temporarily disabled. Before creating a new primitive, page pattern,
or block, the agent must search Fragment UI and inspect the closest available
component, block, or pattern. Reuse is the default; local invention requires a
handoff note containing the search performed and why Fragment UI does not fit.

The frontend merge gate requires evidence of:

- Fragment UI reuse or a documented Fragment UI no-match decision.
- Correct accessibility semantics, keyboard behavior, and reduced-motion behavior.
- Browser evidence at representative responsive sizes.
- Visual review using the five assigned design skills.

## Stop conditions

An agent is blocked when required context, predecessor artifact, evidence,
credential, environment, or human approval is missing. Idle is not blocked and
is never a reason to terminate a process.
