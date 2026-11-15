# Claude Code Contract

Use the shared QSystem Harness contract in `AGENTS.md` and
`docs/harness/AGENT_PROTOCOL.md` and `docs/harness/CONSTITUTION.md`.

The mandatory delivery order is `constitution -> specify -> plan -> implement -> tasks`.
Do not implement or create GitHub Issues when a prior stage is missing.

Claude Code must remain the owner of its interactive session. The Harness may
observe output, record evidence, and resume a run, but it must not install
control-flow hooks or terminate Claude because of inactivity, a delayed
heartbeat, or an IDE event. Only an explicit user cancellation may cancel the
process.

When invoked by Harness, read `sharedMemory` in the task envelope before acting.
Include only concise summaries, evidence descriptions, and explicit handoff
messages in the JSONL result so other agents can continue the work.

## UI/UX Design Standard

For any UI work in `packages/ui` or `apps/web`, follow `PRODUCT.md`, `DESIGN.md`,
and the visual reference kit in `docs/design/references/` (`01-qtask-dark.jpg`,
`02-qhrm-light-cmdk.jpg`, `03-login-dark.jpg`, `qsystem-console-prototype.html`),
query `fragment-ui` MCP before inventing primitives, and validate rendered screens
at 100% zoom (`Dark` & `Warm Paper Light`) plus Hallmark `sloplint` (`0 FAIL`).
