---
name: acceptance-criteria
description: Detailed acceptance criteria for each test spec file
metadata:
  type: reference
---

# Acceptance Criteria by Test File

## @qsystem/ui tests (104/104)
- tokens.spec.ts: token values, WCAG contrast, CSS variables, no hardcoded legacy values
- button.spec.tsx: variants, sizes, disabled/loading, focus, no scale() in CSS
- modal.spec.tsx: dialog semantics, focus trap/restore, Escape, stacked modals, close icon
- toast.spec.tsx: variants, auto-dismiss, pause on hover/focus, position CSS, close icon
- table.spec.tsx: DataTable sort, keyboard nav, J/K, row click, editable guard, aria-sort
- select.spec.tsx: custom combobox, no native select, keyboard nav, typeahead Vietnamese, modal/drawer Escape isolation, z-index layering
- shell-primitives.spec.tsx: UnderlineTabs, ModuleSwitcher, StateRegion, AttributeRowList, FilterPopover, UnifiedShell
- drawer-cmdk.spec.tsx: CommandPalette groups, hotkey, filtering, ResponsiveDetailDrawer inline/overlay

## web tests (14 spec files)
- app-shell.spec.tsx: shell modules, theme toggle, account menu, notifications, mobile drawer, WORKSPACE tag removal, toast via @qsystem/ui
- command-palette.spec.tsx: Ctrl+K, groups, unnumbered, navigation, debounce, error retry, role filtering, Lucide icons, no slop badges
- login-page.spec.tsx: Q mark/wordmark, password toggle, single Đăng nhập CTA
- account-page.spec.tsx: profile retry, password error, logout, ?muc= sync, no QTask refs
- files-page.spec.tsx: pending/failed/empty states, upload dedup
- notifications.spec.tsx: Vietnamese status labels, read-all, visibility pause, error state
- qtask.spec.tsx: QTask workspace, CreateTaskModal, ProjectsView, date handling, CSV sanitization, custom Select
- qhrm.spec.tsx: directory, attendance, leave balance, approve/reject, attendance sync
- qcrm.spec.tsx: overview/customers/opportunities/contacts/reports, custom Select, CSV export
- qsocial.spec.tsx: Vietnamese feed, no English slogans, channel filter, save/like/comment, ?muc= support, --qs-* tokens
- route-boundaries.spec.tsx: not-found, error, global-error, loading boundaries
- theme.spec.tsx: ThemeProvider light/dark persistence
- adapters.spec.ts: (need to check)

## Grep Audit (zero tolerance)
- 0 native `<select>` elements
- 0 `animate__` classes
- 0 `transition: all`
- 0 technical enums in UI: DIRECTOR, MANAGER, EMPLOYEE, 4W, PENDING, SENT
