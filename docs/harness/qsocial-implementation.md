# QSocial Internal Network Implementation (`qsocial-internal-network`)

## Scope & Architecture

QSocial (`/social`) was upgraded from a static shell placeholder into a persistent internal company social network backed by PostgreSQL + Prisma + RLS (`apps/api`), Zod contracts (`packages/contracts`), and a 3-column Facebook-style workspace (`apps/web`).

### Contracts & Database (`packages/contracts`, `apps/api`)
- **`packages/contracts/src/social.ts`**: Shared Zod schemas for feed channels (`ANNOUNCEMENT`, `SHARING`, `KUDOS`, `QUESTION`), post CRUD payloads, like toggles, and inline comments.
- **`apps/api/prisma/schema.prisma`**: Added `SocialPost`, `SocialComment`, and `SocialPostLike` models storing `authorName`, `authorRole`, and `departmentName` snapshots for feed rendering without cross-RLS joins.
- **`apps/api/prisma/migrations/20261114233000_qsocial_feed/migration.sql`**: Idempotent DDL with `NO FORCE ROW LEVEL SECURITY`, tenant/department RLS policies, and `SECURITY DEFINER` helper `app_department_name(p_dept_id TEXT)` granted to `qsystem_app`.
- **`apps/api/src/social/social.controller.ts`, `social.service.ts`, `social.module.ts`**: Exposed `GET /social/posts`, `POST /social/posts`, `PATCH /social/posts/:id`, `DELETE /social/posts/:id`, `POST /social/posts/:id/like`, and `POST /social/posts/:id/comments` with author / `MANAGER` / `DIRECTOR` authorization rules.
- **`apps/api/scripts/seed-e2e.ts` & `apps/api/test/social.spec.ts`**: Seeded internal company feed posts/comments for local/E2E runs and added Vitest integration coverage for filters and role permissions.

### Web UI & Responsive Dark/Light Layout (`apps/web`, `packages/ui`, `PRODUCT.md`)
- **`apps/web/src/lib/adapters/social.adapter.ts`**: Typed frontend adapter connected to `/api/social/*`.
- **`apps/web/src/components/qsocial/QSocialWorkspace.tsx` & `apps/web/src/app/(workspace)/social/page.tsx`**: Implemented left channel/filter rail (filtering synthetic automated-test departments/users and truncating channel labels via `.qsc__channel-label`), central composer + feed (`Đăng bài`, topic selector, pin/delete controls, reaction toggle, inline comments), and right quick-stats / contributors rail using natural Vietnamese copy and a single amber CTA (`Đăng bài`).
- **`packages/ui/src/styles.css` & `apps/web/src/app/globals.css`**: Added responsive `@media (max-width: 1024px)` mobile sidebar drawer CSS rule, responsive `.qsc*` layout, `.qs-qhrm__dept` `nowrap` + full-width truncation, elevation-only `.qs-account__menu`, `4px` micro-radius compact icon controls, contrast-safe `--qs-focus` highlights, and mobile single-column stacking rules.
- **`PRODUCT.md`**: Promoted QSocial (`/social`) to `Core Workspace`.
- **`apps/web/test/qsocial.spec.tsx` & `apps/web/e2e/console-ui.spec.ts`**: Added component unit tests and Playwright E2E checks across `1440x900`, `1024x768`, and `390x844` Dark/Light viewports (including clicking the theme toggle button matching `/Chuyển (?:sang )?giao diện/i`).

## Verification Evidence

### Executed After Final QSocial UI / `sloplint --render` Hardening Edits
1. **Hallmark `sloplint --render` (`HALLMARK_PUPPETEER` enabled across QSocial TSX, CSS & authenticated `/social` Dark/Light DOM snapshots)**:
   - `render tier: 10 screenshots` (`1280x800`, `1440x900`, `1920x1080` folds; `1440` and `375` full pages for both Dark and Light).
   - `sloplint: clean. 0 FAIL, 0 REFLEX, 0 WARN across 6 file(s).`
   - Visual inspection of `1440x900` (Dark/Light) and `375` confirmed no floating count badges, no mobile `375px` sidebar/topbar overflow, and clean `Phòng Điều hành` channel alignment.
2. **UI & Web tests, typecheck & production build (`corepack pnpm --filter @qsystem/ui test`, `corepack pnpm --filter web test`, `tsc --noEmit`, `corepack pnpm --filter web build`)**:
   - `@qsystem/ui`: `9 passed (9)` test files, `78 passed (78)` tests.
   - `apps/web`: `10 passed (10)` test files, `53 passed (53)` tests (including `test/qsocial.spec.tsx` `5/5`); `tsc --noEmit` exited `0`.
   - `next build`: exited `0`, generating `14/14` routes including `/social` (`7.04 kB`).

### Prior Baseline Verification (Before CSS / Channel Filter Polish)
3. **API typecheck & Vitest sequential suite (`corepack pnpm --filter api typecheck && corepack pnpm --filter api test`)**:
   - `9 passed (9)` test files, `75 passed (75)` tests (including `test/social.spec.ts` `2/2`).
4. **Harness repository verifier (`scripts/harness/tester.mjs` for `qsocial-internal-network`)**:
   - `contracts`: `1 passed (1)` file, `9 passed (9)` tests; `harness`: `9 passed (9)` files, `30 passed (30)` tests + typecheck; `ui`: `9 passed (9)` files, `78 passed (78)` tests + typecheck; `api`: passed.
5. **Playwright E2E (`E2E_API_PORT=3011 node d:\Projects\QSystem\scripts\ops\run-playwright-e2e.mjs`)**:
   - `2 passed (14.2s)` across `1440x900`, `1024x768`, `390x844` Dark & Light (`/login`, QTask, QHRM, Ctrl+K, `/files`, `/notifications`, `/social`).
6. **Live smoke check (`node d:\Projects\QSystem\scripts\ops\smoke-check.mjs --api http://127.0.0.1:3001 --web http://localhost:3000`)**:
   - `{"ok":true,"api":"http://127.0.0.1:3001","web":"http://localhost:3000","modules":["qtask","qhrm","qcrm","qsocial"]}`.

