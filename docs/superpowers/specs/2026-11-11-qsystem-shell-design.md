# QSystem Shell — Design Spec (Khung chung platform)

Ngày: 2026-11-11 • Trạng thái: đã duyệt thiết kế (P1–P6) • Kiến trúc: Hướng 1 monorepo modular

## 1. Bối cảnh & mục tiêu

QSystem là web app doanh nghiệp tổng hợp 4 app con độc lập: QTask, QHRM, QCRM, QSocial.
Shell là khung chung xây trước: auth, cơ cấu tổ chức, điều hướng module, design system,
scope/RLS, audit log, tầng sự kiện T5. Mỗi module sau có spec riêng, cắm vào shell qua
hợp đồng mở rộng, không build lại auth hay phân quyền nền.

Thành công khi: đăng nhập JWT chạy; sidebar + nút App Switcher tròn nổi chuyển 4 app
theo quyền; RLS lọc đúng SELF/DEPARTMENT/COMPANY; sensors CASL chặn sai quyền;
thông báo email/Viber/socket qua outbox + BullMQ không mất tin.

## 2. Phạm vi MVP (P1 — đã chốt)

Gồm:
- Auth Local JWT: access ngắn + refresh xoay vòng (httpOnly cookie), hash Argon2,
  rate-limit login, `GET /me` trả role + managedDepartmentIds.
- Org: `users` (role DIRECTOR/MANAGER/EMPLOYEE, department_id, reports_to_id),
  `departments` (manager_id, parent_id), cây tổ chức phục vụ CC LDP.
- Module registry: khai báo 4 app + scope hiển thị, ẩn app ngoài quyền.
- Design system dùng chung (packages/ui): Button, Table, Form, Modal, Toast.
- RLS + audit log nền: policy theo scope, ghi vết duyệt/từ chối/sửa nhạy cảm.
- T5 stub: BullMQ workers email (Nodemailer) / Viber REST / Socket.IO + outbox.
- Search Meilisearch có lọc scope.

Không làm ở MVP (YAGNI): app React Native (chỉ chừa API typed), SSO OAuth2/OIDC,
OTP, multi-tenant (chỉ chừa `tenant_id` nullable), LiveKit và OpenAI thật
(chỉ interface `VideoProvider`/`AiProvider` + mock log).

## 3. Frontend shell Next.js + App Switcher (P2 — đã chốt)

Cấu trúc `apps/web` (App Router + Tailwind):
- `app/(auth)/login` — form đăng nhập, lưu refresh ở cookie httpOnly phía server.
- `app/(shell)` — sidebar theo module đang mở (Dashboard, Org chart, ...),
  header có chuông Socket.IO + avatar; `middleware.ts` chặn route theo role từ `/me`.
- Nút App Switcher: tròn 56px, nổi cố định góc trên phải; hover (desktop) / chạm
  (mobile) mở menu 232px liệt kê app theo quyền (QTask, QHRM, QCRM, QSocial),
  app ngoài quyền bị ẩn; click chuyển module trong shell giữ session.
  App đang mở: nền nhạt + chấm tròn accent 6px + `aria-current` (không dùng vạch
  biên dày). Icon line 18px nét 1.5 thống nhất, hàng 48px, focus ring + reduced-motion.
- `packages/ui` dùng chung; `packages/contracts` DTO/Zod dùng chung web–api.
- Responsive web; API typed sẵn cho React Native phase sau.

## 4. Backend NestJS + Sensors T2+T3 (P3 — đã chốt)

`apps/api` modules:
- `IamModule`: login/refresh/logout, đổi mật khẩu, `JwtAuthGuard` toàn cục.
- `OrgModule`: CRUD departments/users, cây tổ chức; chỉ DIRECTOR sửa, MANAGER xem phòng mình.
- `NotificationModule`: outbox `notifications` + BullMQ workers (retry 3, dead-letter).
- `SearchModule`: `/search?q=&scope=` qua Meilisearch, lọc scope.
- `StorageModule`: presigned URL MinIO, kiểm tra scope khi đọc.

Sensors T3 (`AbilitiesFactory` + `SensorsInterceptor` sau guard):
- Dựng quyền CASL từ role + scope: EMPLOYEE ép `user_id = me`, MANAGER ép
  `department_id IN managed`, DIRECTOR full.
- Kiểm tra đủ 4W khi tạo TASK; chặn LDP sửa TASK Luồng 2 (MONITOR_ONLY → 403 + audit);
  ẩn `base_salary`, `bonus` khỏi response khi thiếu quyền.
- Prisma extension tự gắn filter scope mọi query list.

## 5. Dữ liệu & hạ tầng T4 (P4 — đã chốt)

Bảng nền (shell sở hữu): `departments`, `users`, `approval_delegations`
(from/to/start/end/module_scope), `audit_logs` (actor/action/entity/old/new/at),
`notifications` (channel/recipient/payload/status/attempts), `files` (metadata MinIO).
Mọi bảng chừa `tenant_id` nullable, chưa enforce.

RLS Postgres: bật mọi bảng nghiệp vụ; `SET LOCAL app.current_user_id` mỗi request;
policy SELF (owner/user = me) / DEPARTMENT (dept IN phòng quản lý) / COMPANY (DIRECTOR bypass).
Prisma extension gắn filter tự động.

Redis + BullMQ: queue `notify` + queue `scheduled` (thu hồi Lead quá SLA, gỡ ghim 3 ngày,
nhắc xác nhận công); worker riêng, không block API.

MinIO bucket `qsystem-docs`, `qsystem-avatars`; presigned PUT/GET + kiểm tra scope.

Meilisearch index `leads, contacts, deals, posts, documents`; filter scope lúc search;
sync qua worker khi DB đổi.

`infra/docker-compose`: postgres, redis, minio, meilisearch cho dev.

## 6. Sự kiện & tích hợp T5 (P5 — đã chốt)

Luồng chung: API ghi DB + row outbox `pending` cùng transaction → worker BullMQ gọi
provider → `sent/failed`, retry 3 backoff, dead-letter + cảnh báo. Socket.IO namespace
`/shell`, room `user:{id}` / `dept:{id}`, events `task.assigned`, `request.decided`,
`post.announced`, `payroll.published`; offline kéo lại qua `GET /notifications`.

Providers: Nodemailer (template giao việc/CC/duyệt/payslip, SMTP env, dev log-file);
Viber REST theo `viber_user_id`, fallback email; Socket.IO realtime.

Scheduled jobs (BullMQ repeatable, có audit): thu hồi Lead SLA (QCRM), gỡ ghim 3 ngày
(QSocial), nhắc xác nhận công (QHRM). LiveKit/OpenAI chỉ interface + mock.

## 7. Bảo mật, lỗi, kiểm thử, mở rộng (P6 — đã chốt)

Bảo mật: helmet/CORS, Argon2, refresh xoay vòng, rate-limit, field-level ẩn lương,
RLS mọi query, audit mọi duyệt/từ chối/sửa nhạy cảm/xóa bài.

Lỗi: `{code, message, details}` qua ExceptionFilter; validate Zod chung ở
`packages/contracts`; outbox + dead-letter chống mất tin.

Kiểm thử: unit sensors CASL (đủ 4W, chặn Luồng 2, ẩn lương); integration RLS
(3 role × SELF/DEPARTMENT/COMPANY); API e2e (login→scope→notify); contract test
DTO web–api; CI lint/test/build.

Hợp đồng cắm module mới: 1 NestJS module + 1 nhóm route Next.js + 1 entry
module-registry + reuse scope/RLS/sensors/T5. Thứ tự spec tiếp theo: QTask → QHRM → QCRM → QSocial.

## 8. Self-review

- Placeholder: không còn TBD; LiveKit/OpenAI/tenant/mobile/SSO ghi rõ YAGNI + interface chừa sẵn.
- Nhất quán: monorepo + NestJS sensors + RLS + outbox xuyên suốt P1–P6; App Switcher
  bản chốt (chấm tròn, không vạch biên) khớp mục 3.
- Phạm vi: chỉ shell, mỗi module có spec riêng sau — đủ gọn cho một implementation plan.
- Mơ hồ đã chốt: 1 công ty, JWT local, web trước, Meilisearch ở MVP, retry 3 + dead-letter.

## 9. Bước tiếp theo

Viết implementation plan từ spec này (qua writing-plans), sau đó spec chi tiết QTask.
