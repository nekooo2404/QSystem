# QSystem Agent Contract

This repository uses the provider-neutral Harness in `packages/harness`.
Before dispatching work, read:

- `docs/harness/README.md` (historical reference only)

Mandatory delivery order: `constitution -> specify -> plan -> implement -> tasks`.
Use the Harness commands for each stage; do not bypass a missing artifact.

Package manager rule: use `corepack pnpm` for every dependency, script, test,
build, and executable command in this repository. Do not run `npm install`,
`npm ci`, `npm run`, or commit `package-lock.json`; `pnpm-lock.yaml` is the only
dependency lockfile.

Reliability rules:

- Do not add or enable synchronous `PreToolUse`, `PostToolUse`, `Stop`,
  `StopFailure`, `SubagentStart`, `SubagentStop`, or `TeammateIdle` hooks for
  Harness control.
- Do not stop an agent because it is idle, the IDE lost focus, or a heartbeat is
  late. Cancellation requires an explicit user request.
- Treat missing or untyped evidence as a blocked gate, never as success.
- Preserve the append-only ledger so an interrupted run can resume.
- Before acting, inspect the injected shared-memory snapshot for similar tasks
  and messages addressed to your agent. Return concise typed messages for the
  next agent instead of assuming they can see your private transcript.
- Repository policy and human approval override agent output.
- Budget and context rules (context isolation, token budget, model routing,
  selective reading, lazy loading, output filtering, compaction, dedup, prompt
  caching, budget observability) are binding in `docs/harness/CONSTITUTION.md`.

Use `npm run harness -- run --agents .agent/agents.json` for a direct Coding Agent run.

Coding rule: every Coding Agent run must read the repository Markdown context,
persist session memory, and return typed evidence. The direct Codex worker in
`.agent/agents.json` is the only active runtime harness.

## UI/UX Design Standard (Cross-CLI / IDE)

Before creating, editing, or reviewing any UI/UX component or page (`packages/ui`,
`apps/web`), every CLI and IDE (`Claude Code`, `Codex`, `Gemini CLI`, `Cursor`,
`Antigravity`, `Copilot`, and Harness subagents) must read and match:

- Product & Human-First Vietnamese copy rules: `PRODUCT.md`
- Canonical tokens (`#111418` Dark / `#F4F1EA` Light / `#E8AD45` Amber), typography
  (`Inter` + `tabular-nums`), spacing, 7 core UX principles, and screen blueprints:
  `DESIGN.md`
- Visual gold-standard references (view images directly if vision-enabled, and match
  exact CSS/DOM structure without copying JPEG AI-render typos):
  - `docs/design/references/README.md`
  - `docs/design/references/01-qtask-dark.jpg` (QTask Dark default + closable inspector)
  - `docs/design/references/02-qhrm-light-cmdk.jpg` (QHRM Warm Paper Light + `Ctrl+K` 640px)
  - `docs/design/references/03-login-dark.jpg` (Focused 2-column Dark Login)
  - `docs/design/references/qsystem-console-prototype.html` (CSS/DOM prototype)
- Check `fragment-ui` MCP before adding any new UI primitive and verify rendered UI
  with Hallmark `sloplint --scope app --genre modern-minimal --render` (`0 FAIL`) +
  100%-zoom Playwright dark/light checks (`1440x900`, `1024x768`, `390x844`).
