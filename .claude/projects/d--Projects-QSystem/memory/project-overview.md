---
name: project-overview
description: QSystem monorepo redesign project overview and acceptance criteria
metadata:
  type: project
---

# QSystem Redesign Project

## Monorepo Structure
- `@qsystem/ui` (packages/ui) - UI component library with tokens, styles.css, components
- `web` (apps/web) - Next.js 15 application with App Router

## Acceptance Gates (from pasted_content / DESIGN.md)
1. `corepack pnpm --filter @qsystem/ui typecheck & test` → Exit 0 (104/104 tests pass)
2. `corepack pnpm --filter web typecheck & test` → Exit 0 (14 spec files pass)
3. `corepack pnpm --filter web build` → Exit 0 (14/14 routes build clean)
4. Grep Audit: 0 `<select>` native, 0 `animate__`, 0 `transition: all`, 0 enum kỹ thuật lộ ra UI (DIRECTOR, MANAGER, EMPLOYEE, 4W, PENDING, SENT)
5. Playwright Responsive & Visual Gate: scrollWidth <= innerWidth, 0 console/runtime errors, screenshots pass unslop standard across 10 routes × 6 viewports × 2 themes

## Worker Plan (M2-M7)
- M2A: Root & Fonts + Global Shell & AppLauncher & Ctrl+K
- M2B: Login Editorial Split + account/files/notifications pages
- M3: QTask redesign (dates, tabs, drawer, Select)
- M4: QHRM redesign (attendance, leave, directory, avatar, columns)
- M5: QCRM redesign (funnel, columns, overflow, CSV sanitization)
- M6: QSocial redesign (banner gradient removal, grid, icons)
- M7: Verifier - typecheck, test, build, Playwright E2E

## Key Design Tokens
- `--qs-*` prefix for all CSS variables (replacing `--qx-*`)
- Graphite Dark (#111317 default) & Cool-Slate Light (#F6F8FB)
- QTS Steel-Cobalt brand (#618DC9 dark / #2C568F light)
- 4px spacing scale, nested radii (4/8/12/16px)
- Single easing curve `--qs-ease`
- Lucide icons strokeWidth={1.5}, no emoji, weight 400/500/600 only

## Git Status
Branch: main, 55 files modified, several new files added (not yet committed)
