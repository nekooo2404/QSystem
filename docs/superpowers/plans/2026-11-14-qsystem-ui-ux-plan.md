# QSystem Unified Console UI/UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or execute task-by-task **only through QSystem Harness** (`corepack pnpm harness implement --task-id qsystem-ui-ux --workflow frontend-delivery --agents .harness/agents.json --objective "..."`). Direct unowned edits to application files (`packages/ui/src/**`, `apps/web/**`, `apps/api/**`) are prohibited by `AGENTS.md`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp `@qsystem/ui` và xây dựng toàn bộ giao diện `apps/web` (`Đăng nhập`, `UnifiedShell`, `QTask`, `QHRM`, `Ctrl+K`, `Thông báo`, `Tài liệu`, `Tài khoản`) tái tạo chính xác chuẩn thị giác từ 3 ảnh mẫu và 7 nguyên tắc UI/UX cốt lõi, nối an toàn với `apps/api` qua Next.js rewrite proxy và Typed Adapters.

**Architecture:** Dùng chung một gói `@qsystem/ui` (`packages/ui`) chuẩn hóa **Console** Dark/Light tokens, sửa 3 lỗi tồn đọng (`ToastRegion`, `DataTable`, `FormField`/`Input`), kiểm tra Fragment UI MCP trước khi thêm shell/layout primitives (`UnifiedShell`, `ModuleSwitcher`, `CommandPalette`, `ResponsiveDetailDrawer`, `AttributeRowList`, `FilterPopover`, `UnderlineTabs`, `StateRegion`). `apps/web` chạy Next.js App Router với `/api/*` rewrite về `apps/api` (`:3001`) để cookie `httpOnly` `refresh_token` hoạt động cùng nguồn, kết hợp 3 typed adapters tại `apps/web/src/lib/adapters/`.

**Tech Stack:** TypeScript (`^5.9.3`), React (`^18.3.1`), Next.js (App Router, `next/font/google` `Inter` subset `vietnamese`), `lucide-react` (`strokeWidth={1.5}`), `@qsystem/ui`, `@qsystem/contracts`, Vitest + Testing Library, Playwright (`^1.65.0`), Hallmark `sloplint`.

**Spec & Visual Models:**
- Design Spec: `docs/superpowers/specs/2026-11-14-qsystem-ui-ux-design.md`
- Design System Contract: `DESIGN.md` & `PRODUCT.md`
- Visual References: `docs/design/references/01-qtask-dark.jpg`, `docs/design/references/02-qhrm-light-cmdk.jpg`, `docs/design/references/03-login-dark.jpg`, `docs/design/references/qsystem-console-prototype.html`

## Global Constraints

- Toolchain strictly `corepack pnpm` (zero `npm install` / `npm run` / `package-lock.json`); `Kibo UI` disabled; query `fragment-ui` MCP before inventing any primitive and record reuse/no-match evidence in handoff.
- Every UI card must inspect `DESIGN.md`, `PRODUCT.md`, and `docs/design/references/*` before writing code; never copy sample JPEG typos from reference images.
- Single UI typeface: `Inter` (`400`, `500`, `600`, subset `vietnamese`) with `font-variant-numeric: tabular-nums` for `CV-xxxx`, dates, timestamps, and counts; scale `26–28px` (`<h1>`), `16–18px` (`<h2>`), `14px` (table/form), `12–13px` (meta).
- Spacing scale: `4 / 8 / 12 / 16 / 24 / 32px`; table rows `44–48px`; controls/inputs `40–44px`; radius `6px` (buttons/inputs/chips/rows) and `8px` (modals/drawers); Lucide icons `18px` (chrome) / `16px` (inline/table) with `strokeWidth={1.5}`.
- Color 60–30–10 + WCAG `>= 4.5:1` (`>= 3:1` focus ring): Dark default (`bg.base #111418`, `bg.sidebar #191D23`, `surface.1 #191D23`, `bg.inverse #0D1014`, `state.hover #222731`, `state.selected #252B36`, `border.base #30363D`, `fg.base #F3F4F6`, `fg.muted #9CA3AF`); Light Warm Paper (`bg.base #FAF8F4`, `bg.sidebar #F4F1EA`, `surface.1 #FFFFFF`, `bg.inverse #F3F0E8`, `state.hover #EFECE4`, `state.selected #E8E4DA`, `border.base #DEDAD0`, `fg.base #18181B`, `fg.muted #52525B`); Accent `#E8AD45` (ink `#201708`) ONLY for square `Q` mark and 1 primary CTA per screen; Status Red `#F85149`/`#B91C1C`, Green `#3FB950`/`#15803D`.
- Shadow separation strictly for floating layers (`CommandPalette`, `ModuleSwitcher` menu, `FilterPopover`, notification popover, overlay `ResponsiveDetailDrawer`); zero box-shadow on static tables/cards.
- Minimal bottom-underline tabs (`Tất cả · Của tôi · Quá hạn`) with zero boxed pills; `/login` omits any ledger table; `Ctrl+K` omits `1-2-3` numbers.
- 100% Human-First Vietnamese copy on all UI elements; ban `4W`, `WHO/WHAT/WHEN/WHERE`, `DIRECTOR/MANAGER/EMPLOYEE`, `PENDING/SENT/FAILED/DEAD`, `Presign`, `API_TIMEOUT`, `Audit trail`, `QT-`, `/org` route leaks, and raw MIME strings.
- Security prerequisite before Wave 2 (`apps/web`): update `.claude/settings.json` allowlist beyond `packages/ui/**` only with explicit user approval.

## Review Focus

- Input classes typing Vietnamese inside `<input>`, `<textarea>`, `<select>`, or `[contenteditable]` must never trigger global `J`/`K` row navigation or `/` focus capture; pinned to Task 1 (`table.spec.tsx`) and Task 2 (`shell-primitives.spec.tsx`).
- Resizing or switching between desktop (`>= 1280px` side-by-side) and narrower viewports (`< 1280px` overlay drawer) must close or transfer scroll-lock cleanly without stranding `document.body.style.overflow = 'hidden'` or dropping selected row focus; pinned to Task 2 (`drawer.spec.tsx`) and Task 5 (`qtask.spec.tsx`).
- Stacking two floating layers (e.g., `Modal` create-task over open `ResponsiveDetailDrawer`, or hover/focus leaving `ToastCard`) must pop only the topmost `Escape` target, avoid `pointer-events` click blocking in `#toast-region`, and avoid listener rebinding leaks; pinned to Task 1 (`toast.spec.tsx`, `modal.spec.tsx`) and Task 2 (`drawer.spec.tsx`).
- Parallel protected calls on cold reload when in-memory `accessToken` is absent (`GET /api/me`, `GET /api/org/departments`, `GET /api/notifications`) must coalesce onto ONE single-flight `POST /api/auth/refresh` request so `IamService` refresh-token rotation never flags family reuse; pinned to Task 3 (`auth-client.spec.ts`).
- API failures, stubbed task creation, or long Vietnamese strings (`"Nguyễn Minh Tuấn, Trễ hạn, Tổ chức & Nhân sự"`) must render non-ellipsis single-line primary task columns on desktop, safe wrapping in drawers, and human Vietnamese error copy without leaking backend codes; pinned to Task 4 (`adapters.spec.ts`) and Task 7 (Playwright 100%-zoom Dark + Light suite).

---

### Task 1: Fix `@qsystem/ui` Bugs, Apply Console Dark/Warm-Paper Light Tokens & Base Controls (`card: ui-tokens-bugfixes`)

**Harness Card & Ownership:** Owner `frontend-engineer` · Verification `tester` · Review `independent-reviewer` · Gate: `vitest` + `tsc --noEmit`

**Files:**
- Modify: `packages/ui/src/tokens.ts`
- Modify: `packages/ui/src/styles.css`
- Modify: `packages/ui/src/toast.tsx`
- Modify: `packages/ui/src/table.tsx`
- Modify: `packages/ui/src/form.tsx`
- Modify: `packages/ui/src/input.tsx`
- Modify: `packages/ui/src/modal.tsx`
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/test/tokens.spec.ts`, `packages/ui/test/toast.spec.tsx`, `packages/ui/test/table.spec.tsx`, `packages/ui/test/form.spec.tsx`, `packages/ui/test/modal.spec.tsx`

**Interfaces:**
- Produces: updated `tokens` (`light`, `dark`, `highContrast`, `light.bg.sidebar '#F4F1EA'`, `dark.brand.primary '#E8AD45'`, `dark.brand.primaryInk '#201708'`); CSS variables `[data-theme="dark"]` / `[data-theme="light"]`; `DataTableProps<T>` extended with `selectedRowKey?: React.Key`, `enableJKNavigation?: boolean`; `InputProps` with `error?: boolean`, `controlSize?: 'md' | 'lg'`; `ModalProps` with topmost-stack `Escape` handling.

- [ ] **Step 1: Write failing regression tests for tokens, Toast listener/layout, DataTable J/K + child-click guard, FormField describedby merge, and stacked Escape Modal**
  - In `packages/ui/test/tokens.spec.ts`: assert `tokens.dark.bg.base === '#111418'`, `tokens.light.bg.sidebar === '#F4F1EA'`, `tokens.dark.brand.primary === '#E8AD45'`, `tokens.dark.brand.primaryInk === '#201708'`.
  - In `packages/ui/test/toast.spec.tsx`: assert dynamically updated `ToastRegion` `duration` prop governs auto-dismiss, `.qs-toast-region` renders `data-position`, and rapid focus/hover state changes do not reset remaining time to full duration.
  - In `packages/ui/test/table.spec.tsx`: assert `J`/`K` moves row focus up/down, skips navigation when target is `<input>`/`<select>`/`<textarea>`, clicking a `<button>` inside a cell does NOT fire `onRowClick`, and `selectedRowKey` sets `aria-selected="true"`.
  - In `packages/ui/test/form.spec.tsx`: assert `FormField` preserves child `aria-describedby` alongside helper/error IDs, honors explicit `child.props.id`, and applies `.qs-input` styling on `Input`.
  - In `packages/ui/test/modal.spec.tsx`: assert stacked modals close ONLY the top modal on `Escape` and restore body overflow only when the final modal closes.

- [ ] **Step 2: Run `@qsystem/ui` test suite to confirm failures (RED)**
  - Run: `corepack pnpm --filter @qsystem/ui test`
  - Expected: FAIL on new token palette, J/K + child click assertions, stacked Escape, and `aria-describedby` merge assertions.

- [ ] **Step 3: Implement tokens, CSS theme layer, and 4 component fixes**
  - Update `packages/ui/src/tokens.ts` and `packages/ui/src/styles.css` with exact `DESIGN.md` Console palette (`#111418`, `#191D23`, `#FAF8F4`, `#F4F1EA`, `#E8AD45`, `#201708`, `#F85149`, `#3FB950`), `44–48px` table rows, `40–44px` controls, `150ms` hover (`background-color, border-color, color`), `:active` `translateY(1px)`, `:focus-visible`, `.qs-toast-region { pointer-events: none }`, `.qs-toast { pointer-events: auto }`, and `@media (prefers-reduced-motion: reduce)`.
  - Update `packages/ui/src/toast.tsx`: stabilize `handleFocusOut` with `React.useCallback`, sync `ToastRegion` `duration` fallback cleanly, support variant styling.
  - Update `packages/ui/src/table.tsx`: add `selectedRowKey` + `enableJKNavigation`, guard `onRowClick` when `event.target.closest('button,a,input,select,textarea')`, guard `J`/`K` when inside editable elements.
  - Update `packages/ui/src/form.tsx` & `packages/ui/src/input.tsx`: merge existing `child.props['aria-describedby']` tokens instead of overwriting, style `.qs-input` (`40–44px`, `6px` radius).
  - Update `packages/ui/src/modal.tsx`: maintain an internal stack of open dialog refs so `Escape` closes only the topmost dialog and `overflow` restores when stack empties.

- [ ] **Step 4: Run `@qsystem/ui` tests & typecheck (GREEN)**
  - Run: `corepack pnpm --filter @qsystem/ui test && corepack pnpm --filter @qsystem/ui exec tsc --noEmit`
  - Expected: PASS (all UI spec files + zero TypeScript errors).

- [ ] **Step 5: Commit Task 1**
  - Stage `packages/ui/` changes and commit: `feat(ui): apply QSystem Console tokens and fix primitive edge cases`

---

### Task 2: Add Console Shell & Domain Layout Primitives via Fragment UI MCP (`card: ui-console-primitives`)

**Harness Card & Ownership:** Owner `frontend-engineer` · Verification `tester` · Review `independent-reviewer` · Gate: `fragment-ui` search log + `vitest` + `tsc --noEmit`

**Files:**
- Modify: `packages/ui/package.json` (add `lucide-react`)
- Create: `packages/ui/src/unified-shell.tsx`
- Create: `packages/ui/src/module-switcher.tsx`
- Create: `packages/ui/src/command-palette.tsx`
- Create: `packages/ui/src/responsive-detail-drawer.tsx`
- Create: `packages/ui/src/attribute-row-list.tsx`
- Create: `packages/ui/src/filter-popover.tsx`
- Create: `packages/ui/src/underline-tabs.tsx`
- Create: `packages/ui/src/state-region.tsx`
- Modify: `packages/ui/src/index.ts`, `packages/ui/src/styles.css`
- Test: `packages/ui/test/shell-primitives.spec.tsx`, `packages/ui/test/drawer-cmdk.spec.tsx`

**Interfaces:**
- Consumes: `Button`, `Modal`, `Input` from Task 1 (`@qsystem/ui`).
- Produces:
  - `UnifiedShell({ sidebarHeader, sidebarNav, breadcrumb, onOpenCommandPalette, topActions, children }: UnifiedShellProps)` (`240px` sidebar + `56px` fixed header; mobile sidebar drawer under `1024px`).
  - `ModuleSwitcher({ activeModuleId, modules, onSelectModule }: ModuleSwitcherProps)` (`Q + QSystem` brand row sits above switcher; floating elevation menu lists `icon`, `name`, `description`).
  - `CommandPalette({ open, onOpenChange, query, onQueryChange, groups, loading }: CommandPaletteProps)` (`640px` dialog, `h-11` search input, unnumbered groups `Đi tới` / `Chuyển ứng dụng` / `Thao tác nhanh`, keyboard Arrow/Enter/Esc + global `Ctrl+K`/`Cmd+K` hook that ignores IME composing events).
  - `ResponsiveDetailDrawer({ open, onClose, title, subtitle, mode = 'auto', children, footer }: ResponsiveDetailDrawerProps)` (side-by-side `390px` when `>= 1280px`, floating overlay drawer `< 1280px` with close `×` returning focus to selected row).
  - `UnderlineTabs({ tabs, activeId, onChange }: UnderlineTabsProps)` (minimal bottom-underline tabs, `role="tablist"`/`"tab"`, zero boxed borders).
  - `AttributeRowList({ items }: { items: Array<{ id: string; label: React.ReactNode; value: React.ReactNode }> })`, `FilterPopover`, `StateRegion` (`LoadingSkeleton`, `EmptyState`, `ErrorState`).

- [ ] **Step 1: Search `fragment-ui` MCP before authoring primitives**
  - Query `fragment-ui` (`mcp__fragment-ui__*`) for shell/sidebar, command dialog, drawer/sheet, tabs, popover, and skeleton/empty state patterns; log matched component/block names or documented no-match rationale in Harness handoff.

- [ ] **Step 2: Write failing tests for shell primitives, `Ctrl+K`, `UnderlineTabs`, and `ResponsiveDetailDrawer` resize/focus behavior (RED)**
  - In `packages/ui/test/shell-primitives.spec.tsx`: verify `UnderlineTabs` arrow-key switching (`aria-selected="true"`), `ModuleSwitcher` opens/closes with Esc, `StateRegion` renders `Skeleton` rows and `ErrorState` with accessible retry button.
  - In `packages/ui/test/drawer-cmdk.spec.tsx`: verify `Ctrl+K` opens `CommandPalette` (and ignores when `isComposing`), `CommandPalette` renders unnumbered section headers, and `ResponsiveDetailDrawer` renders inline side panel at mocked `1440px` width vs `role="dialog"` overlay at `1024px` without leaking `body.style.overflow` on unmount or resize.

- [ ] **Step 3: Run tests to confirm failure (RED)**
  - Run: `corepack pnpm --filter @qsystem/ui test`
  - Expected: FAIL (`Cannot find module '../src/unified-shell'` etc.).

- [ ] **Step 4: Install `lucide-react` in `@qsystem/ui` and implement the 8 exported primitives**
  - Run: `corepack pnpm --filter @qsystem/ui add lucide-react`
  - Implement components matching `DESIGN.md` layout tokens (`240px` sidebar, `56px` topbar, `640px` `CommandPalette`, `390px` `ResponsiveDetailDrawer`, Lucide `strokeWidth={1.5}`, zero dev jargon in default English/Vietnamese fallbacks). Export from `packages/ui/src/index.ts`.

- [ ] **Step 5: Run `@qsystem/ui` tests & typecheck (GREEN)**
  - Run: `corepack pnpm --filter @qsystem/ui test && corepack pnpm --filter @qsystem/ui exec tsc --noEmit`
  - Expected: PASS (all existing + new test files pass, zero TypeScript errors).

- [ ] **Step 6: Commit Task 2**
  - Stage `packages/ui/` & `pnpm-lock.yaml`, commit: `feat(ui): add UnifiedShell, ModuleSwitcher, CommandPalette, and ResponsiveDetailDrawer primitives`

---

### Task 3: Scaffold `apps/web`, Theme Engine, Same-Origin Proxy & Auth Session (`/login`) (`card: web-scaffold-theme-auth`)

**Harness Card & Ownership:** Owner `frontend-engineer` · Security review `security-engineer` · Verification `tester` · Review `independent-reviewer` · Prerequisite: user expands `.claude/settings.json` write scope to `apps/web/**`

**Files:**
- Create: `apps/web/next.config.mjs`, `apps/web/tsconfig.json`, `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts`
- Modify: `apps/web/package.json`
- Create: `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`, `apps/web/src/middleware.ts`
- Create: `apps/web/src/lib/theme.tsx`
- Create: `apps/web/src/lib/errors/humanize.ts`
- Create: `apps/web/src/lib/api/client.ts`
- Create: `apps/web/src/app/login/page.tsx`
- Test: `apps/web/test/auth-client.spec.ts`, `apps/web/test/login-page.spec.tsx`

**Interfaces:**
- Consumes: `@qsystem/ui` (`tokens`, `Button`, `Form`, `FormField`, `Input`, `ToastRegion`), `@qsystem/contracts` (`LoginSchema`, `MeResponseSchema`, `ApiErrorSchema`).
- Produces:
  - Next.js `/api/:path*` rewrite to `${process.env.QSYSTEM_API_URL ?? 'http://127.0.0.1:3001'}/:path*`.
  - `apiFetch<T>(path: string, init?: RequestInit & { schema?: ZodType<T> }): Promise<T>` (in-memory Bearer token, `credentials: 'include'`, **single-flight `refreshPromise` lock** retrying `POST /api/auth/refresh` once on `401`).
  - `humanizeApiError(code?: string, status?: number): string` (maps `RATE_LIMITED`, `UNAUTHORIZED`, `FORBIDDEN`, network errors into concise Vietnamese strings; strips raw codes from visible UI).
  - `ThemeProvider` + inline `<head>` non-FOUC script setting `data-theme` (`localStorage['qsystem-theme'] || 'dark'`).

- [ ] **Step 1: Write failing tests for single-flight refresh, error humanizer, and focused `/login` page (RED)**
  - In `apps/web/test/auth-client.spec.ts`: mock `fetch` returning `401` concurrently for 3 calls (`'/api/me'`, `'/api/org/departments'`, `'/api/notifications'`); assert `POST /api/auth/refresh` is invoked **exactly once** and all 3 retry with the new `accessToken`; assert `humanizeApiError('RATE_LIMITED', 429)` never exposes `'RATE_LIMITED'`.
  - In `apps/web/test/login-page.spec.tsx`: render `/login`; assert left column shows ONLY `Q` mark, `QSystem`, and *"Không gian làm việc của QSystem."* (zero status/module tables); assert `Hiện/Ẩn` toggles password `type="password"` <-> `type="text"`; assert button label is `Đăng nhập`.

- [ ] **Step 2: Run web test suite to verify failure (RED)**
  - Install minimal Next.js 15 / React 18 / Vitest deps in `apps/web` (`corepack pnpm --filter web add next react react-dom @qsystem/ui@workspace:* @qsystem/contracts@workspace:* lucide-react` and test devDependencies), then run `corepack pnpm --filter web test`.
  - Expected: FAIL (`Cannot find module '../src/lib/api/client'`).

- [ ] **Step 3: Implement `apps/web` scaffold, `apiFetch`, `middleware.ts`, `ThemeProvider`, and `/login`**
  - `apps/web/src/app/layout.tsx`: load Google `Inter` (`subsets: ['latin', 'vietnamese']`, weights `400`, `500`, `600`) via `next/font/google`, attach inline blocking theme script (`'dark'` default), mount `<ToastRegion position="bottom-right" />`.
  - `apps/web/src/middleware.ts`: guard authenticated routes (`/`, `/tasks`, `/projects`, `/org`, `/notifications`, `/files`, `/account`, `/crm`, `/social`) when `refresh_token` cookie is absent, redirecting to `/login?next=...` (with clean bypass only for `/login` and static assets).
  - `apps/web/src/app/login/page.tsx`: exact layout of `docs/design/references/03-login-dark.jpg` (`44px` inputs, `Hiện/Ẩn` button, amber `#E8AD45` `Đăng nhập` full-width button, `Cần hỗ trợ đăng nhập?` disclosure/support note, compact theme switch).

- [ ] **Step 4: Run tests & TypeScript typecheck (GREEN)**
  - Run: `corepack pnpm --filter web test && corepack pnpm --filter web exec tsc --noEmit`
  - Expected: PASS.

- [ ] **Step 5: Commit Task 3**
  - Stage `apps/web/` & `pnpm-lock.yaml`, commit: `feat(web): scaffold Next.js shell, single-flight auth client, theme script, and focused /login`

---

### Task 4: Contextual Shell Route Layout & 3 Typed Data Adapters (`card: web-shell-adapters`)

**Harness Card & Ownership:** Owner `frontend-engineer` · Verification `tester` · Review `independent-reviewer`

**Files:**
- Create: `apps/web/src/lib/adapters/registry.adapter.ts`
- Create: `apps/web/src/lib/adapters/tasks.adapter.ts`
- Create: `apps/web/src/lib/adapters/notifications.adapter.ts`
- Create: `apps/web/src/components/shell/AppWorkspaceShell.tsx`
- Create: `apps/web/src/components/shell/SessionGuard.tsx`
- Test: `apps/web/test/adapters.spec.ts`, `apps/web/test/app-shell.spec.tsx`

**Interfaces:**
- Consumes: `UnifiedShell`, `ModuleSwitcher`, `CommandPalette` from Task 2; `apiFetch` & `ThemeProvider` from Task 3; `TaskPayload4WSchema`, `NotifyStatusSchema`, `MeResponse` from `@qsystem/contracts`.
- Produces:
  - `registryAdapter.listModules(): Promise<AppModuleEntry[]>` (`QTask`, `QHRM`, `QCRM`, `QSocial` with Vietnamese descriptions; attempts `GET /api/registry` cleanly and falls back to static registry on `404`).
  - `tasksAdapter`: `{ listTasks(filter), createTask(input), updateTaskStatus(id, status), completeTask(id) }` mapping Vietnamese form fields (`title`, `assigneeName`, `assigneeId`, `dueDate`, `departmentId`, `status`) to valid `TaskPayload4W` (`{ what, who, when, where }`) for `POST /api/org/tasks` & `PATCH /api/org/tasks/:id`, maintaining typed local store fallback until `GET /org/tasks` lands on `apps/api`.
  - `notificationsAdapter`: `{ list(), startPolling(onUpdate, intervalMs = 30000) }` (pauses when `document.hidden === true`) + `formatNotifyStatus(status): 'Chờ gửi' | 'Đã gửi' | 'Gửi lỗi'` and role formatter `formatRole(role): 'Giám đốc' | 'Quản lý' | 'Nhân viên'`.

- [ ] **Step 1: Write failing unit/component tests for all 3 adapters & contextual `AppWorkspaceShell` (RED)**
  - In `apps/web/test/adapters.spec.ts`: assert `tasksAdapter.createTask` validates against `TaskPayload4WSchema`, never outputs `4W`/`WHO`/`QT-` in UI DTOs (`CV-xxxx` format), and `notificationsAdapter` translates `PENDING/SENT/FAILED/DEAD` strictly to Vietnamese labels + pauses polling when `document.visibilityState === 'hidden'`.
  - In `apps/web/test/app-shell.spec.tsx`: verify switching `ModuleSwitcher` to `QHRM` swaps sidebar items from *Tất cả công việc / Công việc của tôi / Dự án* to *Danh bạ nhân sự / Phòng ban / Chấm công* while keeping Top Bar right controls (`Sáng/Tối`, `Thông báo`, `Tài khoản`) anchored in place.

- [ ] **Step 2: Run web test suite to verify failure (RED)**
  - Run: `corepack pnpm --filter web test`
  - Expected: FAIL.

- [ ] **Step 3: Implement the 3 adapters, `SessionGuard`, and `AppWorkspaceShell`**
  - Ensure all navigation routes map cleanly: `/`, `/tasks`, `/projects` (`QTask`); `/org` (`QHRM`); `/crm` (`QCRM`); `/social` (`QSocial`); `/files`, `/notifications`, `/account`.
  - Mount Top Bar notifications popover (`Chưa đọc` badge + link to `/notifications`) and Account menu (full Vietnamese role label, link to `/account`, `Đăng xuất`).

- [ ] **Step 4: Run tests & typecheck (GREEN)**
  - Run: `corepack pnpm --filter web test && corepack pnpm --filter web exec tsc --noEmit`
  - Expected: PASS.

- [ ] **Step 5: Commit Task 4**
  - Commit: `feat(web): add AppWorkspaceShell and typed registry/tasks/notifications adapters`

---

### Task 5: `QTask` Workspace (`/`, `/tasks`, `/projects`) Matching `01-qtask-dark.jpg` (`card: web-qtask-workspace`)

**Harness Card & Ownership:** Owner `frontend-engineer` · Verification `qa-browser-engineer` · Review `independent-reviewer`

**Files:**
- Create: `apps/web/src/app/(workspace)/layout.tsx`
- Create: `apps/web/src/app/(workspace)/page.tsx`
- Create: `apps/web/src/app/(workspace)/tasks/page.tsx`
- Create: `apps/web/src/app/(workspace)/projects/page.tsx`
- Create: `apps/web/src/components/qtask/QTaskWorkspace.tsx`
- Create: `apps/web/src/components/qtask/CreateTaskModal.tsx`
- Create: `apps/web/src/components/qtask/TaskDetailContent.tsx`
- Test: `apps/web/test/qtask.spec.tsx`

**Interfaces:**
- Consumes: `DataTable`, `ResponsiveDetailDrawer`, `UnderlineTabs`, `AttributeRowList`, `FilterPopover`, `Button`, `Modal`, `StateRegion`, `toast` from `@qsystem/ui`; `tasksAdapter` & `AppWorkspaceShell` from Task 4; `POST /api/files/presign` & `GET /api/files/:id`.
- Produces: complete `QTaskWorkspace` (`Tất cả · Của tôi · Quá hạn` synced with `?view=`, `Bộ lọc`, wide single-line `Tên công việc` table with `CV-xxxx`, inline `Trạng thái` change in detail panel, `Trao đổi` & `Tệp đính kèm` tabs, subdued secondary `Hoàn thành việc`, `+ Giao việc` modal).

- [ ] **Step 1: Write failing tests covering QTask layout, `?view=` URL sync, inline status update, drawer close `×` full-width restoration, and Vietnamese labels (RED)**
  - In `apps/web/test/qtask.spec.tsx`: assert page has single amber CTA `+ Giao việc`; assert 3 underline tabs `Tất cả`, `Của tôi`, `Quá hạn`; assert zero duplicate `Trễ hạn` KPI box or staff count chips; assert closing detail drawer via `×` hides panel so table expands; assert changing `Trạng thái` dropdown inside panel calls `tasksAdapter.updateTaskStatus` and fires `ToastRegion` confirmation; assert zero forbidden strings (`4W`, `WHO`, `Audit trail`, `Presign`).

- [ ] **Step 2: Run web test suite to verify failure (RED)**
  - Run: `corepack pnpm --filter web test`
  - Expected: FAIL.

- [ ] **Step 3: Implement `QTaskWorkspace`, `CreateTaskModal`, `TaskDetailContent`, `/`, `/tasks`, `/projects`**
  - Wire file upload in `Tệp đính kèm` tab cleanly through `POST /api/files/presign` & link previews through `GET /api/files/:id` (showing readable Vietnamese labels like *Tài liệu PDF* instead of raw MIME types).
  - Match `docs/design/references/01-qtask-dark.jpg` proportions, borders, alignment, and column hierarchy.

- [ ] **Step 4: Run tests & typecheck (GREEN)**
  - Run: `corepack pnpm --filter web test && corepack pnpm --filter web exec tsc --noEmit`
  - Expected: PASS.

- [ ] **Step 5: Commit Task 5**
  - Commit: `feat(web): build QTask workspace and closable detail inspector`

---

### Task 6: `QHRM` (`/org`), Global `Ctrl+K` Search, `/files`, `/notifications`, `/account`, and Placeholders (`card: web-qhrm-search-notify-account`)

**Harness Card & Ownership:** Owner `frontend-engineer` · Verification `qa-browser-engineer` · Review `independent-reviewer`

**Files:**
- Create: `apps/web/src/app/(workspace)/org/page.tsx`
- Create: `apps/web/src/app/(workspace)/notifications/page.tsx`
- Create: `apps/web/src/app/(workspace)/files/page.tsx`
- Create: `apps/web/src/app/(workspace)/account/page.tsx`
- Create: `apps/web/src/app/(workspace)/crm/page.tsx`
- Create: `apps/web/src/app/(workspace)/social/page.tsx`
- Create: `apps/web/src/components/qhrm/QhrmDirectory.tsx`
- Create: `apps/web/src/components/search/GlobalCommandHost.tsx`
- Test: `apps/web/test/qhrm-pages.spec.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `notificationsAdapter`, `AppWorkspaceShell`, `CommandPalette`, `DataTable`, `Modal`, `FormField`, `@qsystem/contracts` (`CreateDepartmentSchema`, `UpdateUserSchema`, `ChangePasswordSchema`, `SearchQuerySchema`).
- Produces: `QHRM` 2-pane department filter (`Toàn công ty` + departments -> `GET /api/org/departments`, `GET /api/org/users`) + dynamic heading `Nhân sự · [Tên phòng]` + `+ Thêm nhân sự` gated to `DIRECTOR` / `MANAGER` + 5-column table (`Họ tên | Chức danh | Vai trò | Quản lý trực tiếp | Tình trạng`); global `Ctrl+K` connected to `GET /api/search`; `/notifications`; `/files`; `/account` (`PATCH /api/me/password`, `POST /api/auth/logout`); `/crm` and `/social` honest placeholder states.

- [ ] **Step 1: Write failing tests for QHRM RBAC/filtering, `Ctrl+K` search results, Vietnamese role/status formatting, and password validation (RED)**
  - In `apps/web/test/qhrm-pages.spec.tsx`: assert clicking a department in left list updates right heading to `Nhân sự · <Department>`; assert `+ Thêm nhân sự` renders for `DIRECTOR`/`MANAGER` and is omitted for `EMPLOYEE`; assert table headers are `Họ tên`, `Chức danh`, `Vai trò`, `Quản lý trực tiếp`, `Tình trạng`; assert role badges say `Giám đốc`/`Quản lý`/`Nhân viên` (never `DIRECTOR`); assert `Ctrl+K` renders unnumbered groups and debounces `GET /api/search?q=...`.

- [ ] **Step 2: Run web test suite to verify failure (RED)**
  - Run: `corepack pnpm --filter web test`
  - Expected: FAIL.

- [ ] **Step 3: Implement `QHRM`, `GlobalCommandHost`, `/notifications`, `/files`, `/account`, `/crm`, `/social`**
  - Match `docs/design/references/02-qhrm-light-cmdk.jpg` proportions cleanly (note Light Warm Paper palette & floating elevation shadow on `Ctrl+K`).

- [ ] **Step 4: Run tests & typecheck (GREEN)**
  - Run: `corepack pnpm --filter web test && corepack pnpm --filter web exec tsc --noEmit`
  - Expected: PASS.

- [ ] **Step 5: Commit Task 6**
  - Commit: `feat(web): build QHRM directory, global Ctrl+K search, notifications, files, and account pages`

---

### Task 7: Playwright 100%-Zoom Dark/Light QA, WCAG Contrast, Hallmark Render Lint & Final Harness Verification (`card: qa-hallmark-a11y-verification`)

**Harness Card & Ownership:** Owner `qa-browser-engineer` & `tester` · Review `independent-reviewer` · Final Merge Gate: `ceo-integrator`

**Files:**
- Create: `apps/web/e2e/console-ui.spec.ts`
- Create: `docs/qa/2026-11-14-ui-ux-qa-checklist.md`
- Create (optional follow-up backlog doc): `docs/harness/backend-companion-backlog.md`

**Interfaces:**
- Consumes: built `apps/web`, running/mocked API routes, `scripts/harness/tester.mjs`, Hallmark `sloplint.mjs`.
- Produces: Playwright screenshot & axe/computed-style report at **100% zoom** across `1440x900`, `1024x768`, `390x844` in **Dark (`#111418`)** & **Warm Paper Light (`#F4F1EA` / `#FAF8F4`)**, Hallmark `sloplint` `0 FAIL` report, full `tester` pass evidence, and explicit backend backlog for `GET /org/tasks`, `GET /registry`, and Socket.IO notification gateway.

- [ ] **Step 1: Write Playwright e2e spec verifying 100% zoom, Dark+Light parity, keyboard flows, contrast, reduced motion, and forbidden-jargon DOM scan**
  - Assert at `1440x900` (`Dark` + `Light`), `1024x768` (`overlay` drawer), `390x844` (`mobile`):
    1. Zero horizontal document overflow (`scrollWidth <= clientWidth`).
    2. Computed `fontFamily` resolves `Inter`; `"Nguyễn Minh Tuấn, Trễ hạn, Tổ chức & Nhân sự"` shows zero fallback boxes and primary `Tên công việc` cell does not wrap vertically on desktop `1440x900`.
    3. Computed contrast >= `4.5:1` for primary/muted text (`#F3F4F6`/`#9CA3AF` on `#191D23`, `#18181B`/`#52525B` on `#FFFFFF`) and `>= 7.5:1` on amber CTA (`#201708` on `#E8AD45`).
    4. Keyboard `Ctrl+K` -> navigate -> `Esc`, and `J`/`K` + `Enter` opens drawer + `×` restores full-width table.
    5. `emulateMedia({ reducedMotion: 'reduce' })` disables motion transforms.
    6. Visible `document.body.innerText` contains none of `['4W', 'WHO', 'DIRECTOR', 'MANAGER', 'EMPLOYEE', 'PENDING', 'API_TIMEOUT', 'Presign', 'Audit trail']`.

- [ ] **Step 2: Run full Playwright, Hallmark `sloplint`, package tests, builds & `tester.mjs` (VERIFICATION)**
  - Run: `corepack pnpm --filter web build && corepack pnpm --filter web exec playwright test`
  - Run: Hallmark `sloplint --scope app --genre modern-minimal --render` against rendered app routes (`0 FAIL`).
  - Run: `corepack pnpm --filter @qsystem/contracts test && corepack pnpm --filter @qsystem/harness test && corepack pnpm --filter @qsystem/ui test && corepack pnpm --filter web test`
  - Run `tester` verification script (`node scripts/harness/tester.mjs`) and dispatch `independent-reviewer` + `security-engineer` via `corepack pnpm harness implement --task-id qsystem-ui-ux --workflow frontend-delivery --agents .harness/agents.json`.

- [ ] **Step 3: Document backend companion follow-ups & finalize task sync**
  - Write `docs/harness/backend-companion-backlog.md` for `GET /org/tasks`, `GET /registry`, and Socket.IO gateway (separate backend task cards via `backend-engineer`).
  - After all implementation evidence passes, sync GitHub Issues cleanly:
    `corepack pnpm harness tasks sync --task-id qsystem-ui-ux --manifest docs/harness/qsystem-ui-ux-tasks.json --repo <owner/repo>`

- [ ] **Step 4: Commit Task 7 QA & docs**
  - Commit: `test(web): add 100%-zoom Dark/Light Playwright QA, contrast, and Hallmark verification`

