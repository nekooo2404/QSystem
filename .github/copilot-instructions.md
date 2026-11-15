# QSystem Copilot & IDE Instructions

Read `AGENTS.md`, `PRODUCT.md`, and `DESIGN.md` before proposing or editing code.

- Package manager: always `corepack pnpm` (never `npm`).
- Governance order: `constitution -> specify -> plan -> implement -> tasks`; dispatch code edits through named agents in `docs/harness/team-agents.json` using `corepack pnpm harness implement --agents ...`.
- UI/UX work (`packages/ui`, `apps/web`) must visually and structurally match `DESIGN.md`, `PRODUCT.md`, and `docs/design/references/` (`01-qtask-dark.jpg`, `02-qhrm-light-cmdk.jpg`, `03-login-dark.jpg`, `qsystem-console-prototype.html`).

