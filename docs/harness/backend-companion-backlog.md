# Backend Companion Backlog — thiếu hụt API mà UI đang gánh

Sinh ra từ card `qa-hallmark-a11y-verification` (QA 8). Mỗi mục là một endpoint
hoặc hành vi backend **chưa tồn tại** mà `apps/web` đã phải lách bằng
localStorage, adapter tĩnh, polling hoặc nút giả. Mức ưu tiên theo ảnh hưởng
tới người dùng thật, không theo độ khó code.

Xác minh lần đầu ngày 2026-11-14 (trước Production Readiness) và **đã hoàn tất toàn bộ 7 mục ngày 2026-11-14** trong `qsystem-production-readiness`:

| # | Thiếu hụt trước đây | Trạng thái | Tệp / Endpoint đã triển khai | Ưu tiên |
| :-- | :--- | :--- | :--- | :-- |
| 1 | **`GET /org/tasks`** | **Đã xong** | `apps/api/src/org/org.controller.ts`, `org.service.ts` (`GET/POST/PATCH /org/tasks` có phân trang + filter + RLS) | **P1** |
| 2 | **Prisma `Task` model** | **Đã xong** | `apps/api/prisma/schema.prisma`, migration `20261114120000_production_readiness`, `tasks.adapter.ts` bỏ `localStorage` | **P1** |
| 3 | **Read-state thông báo** | **Đã xong** | Cột `Notification.readAt`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`, `notifications.adapter.ts` bỏ `localStorage` | **P1** |
| 4 | **`GET /files`** (liệt kê tệp) | **Đã xong** | `apps/api/src/storage/storage.controller.ts`, `storage.service.ts` (`listFiles` RLS-scoped), `apps/web/src/app/(workspace)/files/page.tsx` | **P2** |
| 5 | **`POST /org/users`** | **Đã xong** | `apps/api/src/org/org.service.ts` (`createUser` RLS + phân quyền), `CreateUserModal.tsx`, `QhrmDirectory.tsx` | **P2** |
| 6 | **Notification realtime transport** | **Đã xong** | `LocalSocketGateway` EventEmitter fan-out -> `GET /notifications/stream` (SSE) + reconnect fallback `startPolling` trong `notifications.adapter.ts` | **P2** |
| 7 | **`GET /registry`** | **Đã xong** | `apps/api/src/registry/registry.controller.ts` (`ENABLED_MODULES`), `AppWorkspaceShell.tsx` tải từ `/api/registry` | **P3** |

## Ghi chú triển khai đã đóng

- Đã xoá toàn bộ `localStorage` fallback cho QTask (`STORE_KEY` trong `tasks.adapter.ts`) và notification read-state (`qsystem-notifications-seen-at` trong `notifications.adapter.ts`).
- Ghi chú vận hành SSE đa instance: `GET /notifications/stream` dùng EventEmitter nội bộ; khi scale ngang nhiều pod có yêu cầu push tức thời đa node cần gắn adapter pub/sub Redis theo hướng dẫn trong `docs/ops/PRODUCTION_OPERATIONS.md`.
