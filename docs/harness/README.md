# QSystem Universal Harness

QSystem Harness is a provider-neutral control plane for Claude Code, Codex,
Antigravity, Cursor, and any other agent that can expose a CLI or a passive
event hook.

Toolchain rule: use `corepack pnpm` for all repository commands. Do not use
`npm install`, `npm ci`, or `npm run`; keep only `pnpm-lock.yaml`.

## Reliability contract

- The Harness never installs or requires `PreToolUse`, `PostToolUse`, `Stop`,
  `StopFailure`, `SubagentStart`, `SubagentStop`, or `TeammateIdle` hooks to
  control an agent.
- An idle process is observed as `wait`; it is never killed because it is quiet.
- A process is cancelled only after an explicit user cancel request. A failed
  process is recorded and can be resumed from the append-only run ledger.
- Every stage is gated by direct evidence. Missing evidence blocks the next
  stage; it never becomes a guessed pass.
- Agent output is not a permission grant. Repository policy, user approval, and
  the target system remain authoritative.

## Commands

```text
corepack pnpm harness roles
corepack pnpm harness constitution
corepack pnpm harness specify --task-id notification-retry --artifact docs/specs/notification-retry.md
corepack pnpm harness plan --task-id notification-retry --objective "Build notification retry"
corepack pnpm harness implement --task-id notification-retry --objective "Build notification retry"
corepack pnpm harness tasks sync --task-id notification-retry --manifest docs/harness/tasks.example.json --repo owner/repo
corepack pnpm harness plan --objective "Build the QTask notification workflow"
corepack pnpm harness doctor --settings "$HOME/.claude/settings.json"
corepack pnpm harness run --task-id notification-retry --agents .harness/agents.json --objective "Run the approved task"
corepack pnpm harness memory search --query "notification retry"
corepack pnpm harness memory similar --task "Verify notification retry"
corepack pnpm harness memory inbox --agent qa-agent
corepack pnpm harness memory send --from backend-agent --to qa-agent --message "Retry path is ready for verification"
```

On Windows, pass the full path to the settings file. The doctor fails when
Claude settings contain control-flow hooks, enable the
`code-modernization@claude-plugins-official` plugin (it installs Stop
telemetry hooks that can interrupt a session), or disable non-streaming
fallback. If the `remember@claude-plugins-official` plugin is enabled on
Windows, `REMEMBER_CLAUDE_BIN` must point to the actual Claude binary.

The five governance commands are ordered and fail closed. `specify` requires a
completed `constitution`; `plan` requires `specify`; `implement` requires
`constitution`, `specify`, and `plan`; `tasks sync` requires implementation
evidence and creates or updates GitHub Issues by stable task key.

Every code change must use a named agent registry. `implement/run` refuses to
start without `--agents <path>` or `.harness/agents.json`; the generic
`HARNESS_AGENT_COMMAND` fallback is intentionally disabled. Code cards also
require an independent reviewer and verification evidence before merge.

The `tester` agent is a local deterministic worker. It runs
`node scripts/harness/tester.mjs`, which checks contracts, Harness, Harness
typecheck, and API tests through `corepack pnpm`. It does not call Claude,
Codex, GitHub, or remote APIs.

Prerequisite stages: on a fresh repository no governance stages are recorded
yet, so the `implement` and `tasks sync` examples above are not runnable until
their predecessors (`constitution` -> `specify` -> `plan` -> `implement` ->
`tasks`) have been completed in order. `plan --objective` without `--task-id`
prints the plan without recording any governance stage (stderr carries a
`HARNESS_GOVERNANCE_BYPASS` warning) so the example stays runnable.

For direct IDE prompts, `AGENTS.md` is the shared entrypoint, `CLAUDE.md` is the
Claude-specific entrypoint, and `.cursor/rules/qsystem-harness.mdc` is the
Cursor rule. Other IDEs should run `corepack pnpm harness context` once and use
that output as their project instruction/context. There is no universal vendor
standard that lets one file force every IDE to read another file.

`HARNESS_AGENT_COMMAND` is intentionally generic. Provider-specific flags and
credentials stay in the adapter configuration, not in the Harness core.

Copy `docs/harness/agents.example.json` to `.harness/agents.json` and adjust
commands for the host. The CLI loads this manifest; it does not silently invent
an unavailable provider. Staffing note: the company model defines nine roles
(`ceo`, `product`, `architect`, `backend`, `frontend`, `qa`, `security`,
`devops`, `reviewer`), but the example manifest staffs only `product`,
`architect`, `backend`, `qa`, `security`, `reviewer`, and `frontend`
(`frontend` via the `antigravity` and `cursor` IDE hooks); `ceo` and `devops`
are unstaffed. The `HARNESS_AGENT_COMMAND` fallback covers `product`,
`architect`, `backend`, `frontend`, `qa`, `security`, and `reviewer`.

To resume a run after a terminal, IDE, or agent process disappears, reuse the
`HARNESS_RUN_ID` printed immediately on stderr by the Harness:

```text
corepack pnpm harness run --task-id notification-retry --agents .harness/agents.json --resume <runId> --objective "The same objective"
```

Process output is kept under `.harness/processes/<runId>-<taskId>.*.log` while
the process runs. A missing heartbeat or an idle process does not trigger a
timeout or kill.

## Adapter modes

`cli` agents are spawned with a configured command and receive a task prompt on
stdin. `ide-hook` agents only report events and are never spawned or terminated
by the Harness. `remote` is reserved for a future authenticated transport and
must not be treated as implemented until its adapter is added.

The built-in workflow models a small technology company: product discovery,
architecture, implementation, verification, security review, and independent
release review. Roles are explicit and approval authority is separated from
implementation authority.

## Shared memory

Each run receives a memory snapshot containing recent records, similar completed
tasks, and direct/broadcast messages for the selected agent. A CLI agent can
return messages in its final JSONL result:

```json
{
  "status": "completed",
  "summary": "Retry policy implemented",
  "evidence": [{ "kind": "tests", "summary": "8 tests passed" }],
  "messages": [{ "to": "qa-agent", "subject": "Verification handoff", "content": "Check retry count and dead-letter behavior" }]
}
```

`messages[].to` is an exact configured `agentId`; omit it for a broadcast.

The Harness stores summaries, evidence descriptions, and typed messages in
`.harness/memory.jsonl`. Raw agent stdout is kept only in process logs and is
never copied into shared memory automatically.

## Agent company

The company structure and role-to-skill contracts live in [TEAM.md](TEAM.md)
and [team-agents.json](team-agents.json). Use these files as the source of truth
for ownership, scope, skills, and merge gates; do not create ad-hoc agent roles
in a prompt.

## UI MCP

Cursor and Claude Code use the project MCP configuration in `.cursor/mcp.json`
and `.mcp.json`. Fragment UI runs from the compatible local checkout at
`D:\Projects\fragment-ui-public\packages\mcp-server\dist\index.js`. Kibo UI is
temporarily disabled for this workspace.
Restart the AI client after changing MCP configuration.

Claude's project settings in `.claude/settings.json` allow all Playwright MCP
tools without per-call approval. This is intentionally scoped to Playwright;
global `bypassPermissions` is not enabled.
