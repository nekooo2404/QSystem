# QSystem Unified Console UI/UX Plan

Task ID: `qsystem-ui-ux` · Workflow: `frontend-delivery`

Kế hoạch chi tiết từng bước TDD nằm tại: `docs/superpowers/plans/2026-11-14-qsystem-ui-ux-plan.md`.

## Execution Waves & Named Ownership

1. **`ui-tokens-bugfixes`** (`frontend-engineer` -> `tester` -> `independent-reviewer`)
   - Vá lỗi `ToastRegion`, `DataTable`, `FormField`/`Input`, `Modal` stack; cập nhật `tokens.ts` & `styles.css` sang bảng màu Console Dark (`#111418`/`#191D23`) & Light Warm Paper (`#FAF8F4`/`#F4F1EA`) + Amber `#E8AD45`.
2. **`ui-console-primitives`** (`frontend-engineer` -> `tester` -> `independent-reviewer`)
   - Truy vấn `fragment-ui` MCP, cài `lucide-react` (`strokeWidth={1.5}`), dựng `UnifiedShell`, `ModuleSwitcher`, `CommandPalette`, `ResponsiveDetailDrawer`, `AttributeRowList`, `FilterPopover`, `UnderlineTabs`, `StateRegion`.
3. **`web-scaffold-theme-auth`** (`frontend-engineer` + `security-engineer` -> `tester` -> `independent-reviewer`)
   - Dựng Next.js App Router tại `apps/web`, proxy `/api/*` tới `apps/api` (`:3001`), font `Inter` (`vietnamese` + `tabular-nums`), non-FOUC theme script, `apiFetch` single-flight refresh lock, `middleware.ts`, `/login` chuẩn mẫu `03-login-dark.jpg`.
   - ⚠️ Cần user cho phép mở rộng `.claude/settings.json` sang `apps/web/**` trước khi chạy Claude worker trên wave này.
4. **`web-shell-adapters`** (`frontend-engineer` -> `tester` -> `independent-reviewer`)
   - Dựng `AppWorkspaceShell`, `SessionGuard`, và 3 typed adapters (`registry.adapter.ts`, `tasks.adapter.ts`, `notifications.adapter.ts`).
5. **`web-qtask-workspace`** (`frontend-engineer` -> `qa-browser-engineer` -> `independent-reviewer`)
   - Xây dựng `QTask` (`/`, `/tasks`, `/projects`) chuẩn mẫu `01-qtask-dark.jpg` + upload/tải đính kèm qua `/api/files/*`.
6. **`web-qhrm-search-notify-account`** (`frontend-engineer` -> `qa-browser-engineer` -> `independent-reviewer`)
   - Xây dựng `QHRM` (`/org`) + `Ctrl+K` toàn cục chuẩn mẫu `02-qhrm-light-cmdk.jpg`, `/notifications`, `/files`, `/account`, `/crm`, `/social`.
7. **`qa-hallmark-a11y-verification`** (`qa-browser-engineer` + `tester` -> `independent-reviewer` -> `ceo-integrator`)
   - Playwright zoom `100%` (`1440x900`, `1024x768`, `390x844`, Dark + Light), kiểm tra WCAG contrast & `prefers-reduced-motion`, Hallmark `sloplint --scope app --genre modern-minimal --render` (`0 FAIL`), cập nhật `docs/harness/backend-companion-backlog.md`, rồi chạy `harness tasks sync`.

## Risk Register

- **CORS & HttpOnly Refresh Cookie:** `apps/api` chưa bật CORS trong `src/main.ts` -> giải quyết bằng Next.js `/api/*` rewrite để trình duyệt gửi `refresh_token` cùng nguồn mà không phải sửa `apps/api`.
- **Single-Flight Refresh Rotation:** Nếu nhiều request trang đầu đồng loạt nhận `401` -> dùng 1 promise `refreshInFlight` duy nhất tránh trigger cơ chế thu hồi token family.
- **Claude Settings Permission Boundary:** `.claude/settings.json` hiện chỉ cấp quyền ghi `packages/ui/**` -> phải mở rộng sang `apps/web/**` trước Task 3.
- **Missing Backend List Endpoints:** `GET /org/tasks`, `GET /registry`, Socket.IO chưa có -> bọc sau typed adapters, ghi backlog backend riêng cho `backend-engineer`.

