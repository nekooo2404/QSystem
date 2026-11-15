# QSystem Unified Console UI/UX Specify

Task ID: `qsystem-ui-ux`

## Scope

Chuẩn hóa bộ tài liệu & ảnh mẫu thiết kế (`PRODUCT.md`, `DESIGN.md`, `docs/design/references/*`), vá lỗi và mở rộng `@qsystem/ui` (`packages/ui`), và xây dựng hoàn chỉnh `apps/web` (`Đăng nhập`, `UnifiedShell` + `ModuleSwitcher`, `QTask`, `QHRM` + `Ctrl+K`, `Tài liệu`, `Thông báo`, `Tài khoản`) kết nối với `apps/api` và typed adapters, đáp ứng 7 nguyên tắc UI/UX cốt lõi và 3 ảnh mẫu chuẩn.

- **Spec đầy đủ:** `docs/superpowers/specs/2026-11-14-qsystem-ui-ux-design.md`
- **Design System & Visual Models:** `DESIGN.md`, `PRODUCT.md`, `docs/design/references/01-qtask-dark.jpg`, `docs/design/references/02-qhrm-light-cmdk.jpg`, `docs/design/references/03-login-dark.jpg`, `docs/design/references/qsystem-console-prototype.html`

## Constraints

- Toolchain bắt buộc: `corepack pnpm` (`npm` bị cấm).
- `Kibo UI` bị tắt; `frontend-engineer` bắt buộc truy vấn `fragment-ui` MCP trước khi tạo primitive mới.
- Font chữ UI duy nhất: `Inter` (`400/500/600`, subset `vietnamese`, `tabular-nums`); thang `26–28px / 16–18px / 14px / 12–13px`; lưới khoảng cách `4/8/12/16/24/32px`.
- Màu 60–30–10 + WCAG `>= 4.5:1`: Dark `#111418 / #191D23 / #30363D / #F3F4F6 / #9CA3AF`, Warm Paper Light `#FAF8F4 / #F4F1EA / #FFFFFF / #DEDAD0 / #18181B / #52525B`, nhấn `#E8AD45` (chữ `#201708`) chỉ cho logo `Q` và 1 CTA chính mỗi trang.
- Ngôn ngữ UI 100% tiếng Việt tự nhiên cho người dùng; cấm `4W`, `DIRECTOR/MANAGER/EMPLOYEE`, `PENDING/SENT/FAILED/DEAD`, `Presign`, `API_TIMEOUT`, `Audit trail`, `QT-`.

## Acceptance criteria

- `@qsystem/ui` sửa xong lỗi `ToastRegion`, `DataTable`, `FormField`/`Input`, `Modal`, cập nhật Dark + Warm Paper Light tokens, bổ sung & export đủ `UnifiedShell`, `ModuleSwitcher`, `CommandPalette`, `ResponsiveDetailDrawer`, `AttributeRowList`, `FilterPopover`, `UnderlineTabs`, `StateRegion`.
- `apps/web` hoàn thiện toàn bộ luồng `/login`, `/`, `/tasks`, `/projects`, `/org`, `/notifications`, `/files`, `/account`, `/crm`, `/social` khớp cấu trúc 3 ảnh mẫu (`01-qtask-dark.jpg`, `02-qhrm-light-cmdk.jpg`, `03-login-dark.jpg`) + rewrite proxy `/api/*` + single-flight `POST /api/auth/refresh` + 3 typed adapters.
- `sloplint --scope app --genre modern-minimal --render` đạt `0 FAIL`.
- Playwright QA ở zoom `100%` tại `1440x900`, `1024x768`, `390x844` trên cả hai chế độ Dark & Light pass không lỗi tràn ngang, đạt chuẩn WCAG contrast và `prefers-reduced-motion: reduce`.
- `contracts`, `harness`, `ui`, `web` test suites và `tsc --noEmit` đều pass; có báo cáo `independent-reviewer` và `security-engineer`.

## Non-goals

- Không sửa đổi mã backend `apps/api` hay schema database Prisma trong luồng công việc frontend này (`GET /org/tasks`, `GET /registry`, Socket.IO gateway được tách sang backlog riêng).
- Không triển khai sản phẩm lên hạ tầng production hay lưu thông tin bí mật trong mã/log.

## Dependencies & Affected Files

- Depends on: `qsystem-shell` (Tasks 1–5 backend contracts + IAM/Org/Notify/Search/Storage APIs).
- Modifies / Creates: `packages/ui/**`, `apps/web/**`, `.claude/settings.json` (khi được user cấp quyền mở rộng sang `apps/web/**`).

