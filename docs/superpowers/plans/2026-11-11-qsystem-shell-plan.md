# QSystem Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng shell QSystem chạy được: monorepo web+api, auth JWT, RLS theo scope, sensors CASL, outbox T5, App Switcher.

**Architecture:** Monorepo pnpm workspaces: `apps/web` (Next.js App Router) gọi `apps/api` (NestJS modular monolith) qua `packages/contracts` typed; Postgres RLS + Prisma extension lọc scope; BullMQ workers đẩy email/Viber/socket.

**Tech Stack:** Next.js 14 App Router + Tailwind, NestJS 10 + CASL + BullMQ, Prisma 5 + PostgreSQL 16 RLS, Redis 7, MinIO, Meilisearch, Socket.IO, Nodemailer, Vitest/Jest, Playwright (e2e chọn lọc).

**Spec:** `docs/superpowers/specs/2026-11-11-qsystem-shell-design.md`

## Global Constraints

- Node >= 20 (đã có 24.19.0); package manager pnpm qua corepack.
- Mọi bảng nghiệp vụ bật RLS + có `tenant_id` nullable chừa sẵn, chưa enforce.
- Access token ngắn (15 phút), refresh xoay vòng trong httpOnly cookie; hash Argon2.
- Lỗi API chuẩn `{code, message, details}`; validate bằng Zod ở `packages/contracts`.
- BullMQ retry tối đa 3 + backoff, quá 3 vào dead-letter + cảnh báo.
- App Switcher: nút tròn 56px góc trên phải, menu 232px, hàng 48px, icon line 18px/1.5, app hiện tại nền nhạt + chấm accent 6px + `aria-current`, focus ring + reduced-motion.
- Không làm: app mobile, SSO/OTP, multi-tenant enforce, LiveKit/OpenAI thật (chỉ interface + mock).
- Commit sau mỗi task; tiếng Việt cho UI copy, tiếng Anh cho code.

## Review Focus

- Refresh token reuse (đánh cắp refresh cũ đã xoay) phải bị từ chối + thu hồi chuỗi — test ở Task 3.
- MANAGER kiêm 2 phòng (managedDepartmentIds nhiều) vẫn chỉ thấy đúng 2 phòng — test ở Task 4.
- Request không qua Prisma extension (raw query) có bypass RLS không — test ở Task 4.
- Worker chết giữa chừng: outbox row vẫn `pending`, job BullMQ retry, không mất tin — test ở Task 6.
- App Switcher với user chỉ có 1 app: menu chỉ 1 hàng, nút vẫn focus được bằng bàn phím — test ở Task 8.

---

### Task 1: Khung monorepo + infra Docker

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `apps/web/package.json`, `apps/api/package.json`, `packages/contracts/package.json`, `packages/ui/package.json`, `infra/docker-compose.yml`, `infra/.env.example`, `.gitignore` (sửa: thêm dist/.next/node_modules đã có)
- Test: `infra/docker-compose.yml` (verify bằng `docker compose config`)

**Interfaces:**
- Consumes: không (task đầu).
- Produces: workspaces `apps/*`, `packages/*`; lệnh `pnpm dev`, `pnpm build`; `infra/docker-compose.yml` chạy postgres:16, redis:7, minio, meilisearch.

- [ ] **Step 1: Viết docker-compose + workspaces skeleton**

Tạo `pnpm-workspace.yaml` (packages: `apps/*`, `packages/*`), root `package.json` (scripts `dev/build/lint/test` chạy turbo), `turbo.json` pipeline, 4 `package.json` con tối thiểu, `infra/docker-compose.yml` với 4 service (postgres 16 + volume, redis 7, minio + console, meilisearch + master key env), `infra/.env.example` (POSTGRES_PASSWORD, REDIS_URL, MINIO_KEYS, MEILI_MASTER_KEY, JWT_SECRET placeholder, SMTP_*, VIBER_*).

- [ ] **Step 2: Verify config + khởi động infra**

Run: `docker compose -f infra/docker-compose.yml config`
Expected: PASS, in ra 4 service hợp lệ.

Run: `docker compose -f infra/docker-compose.yml up -d && docker compose -f infra/docker-compose.yml ps`
Expected: 4 service `running/healthy`; nếu máy yếu, ít nhất postgres + redis healthy.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json apps packages infra .gitignore
git commit -m "chore: scaffold qsystem monorepo and infra compose"
```

### Task 2: Schema DB + RLS nền (Prisma)

**Files:**
- Create: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`, `apps/api/prisma/seed.ts`, `apps/api/src/prisma/prisma.service.ts`, `apps/api/src/prisma/prisma-scope.extension.ts`
- Test: `apps/api/test/rls.spec.ts` (integration, dùng 3 role)

**Interfaces:**
- Consumes: postgres từ Task 1 (`DATABASE_URL`).
- Produces: `PrismaService` (extends PrismaClient, chạy `SET LOCAL app.current_user_id` mỗi request qua middleware); extension `forUser(userId)` tự gắn filter scope; models `Department`, `User`, `ApprovalDelegation`, `AuditLog`, `Notification`, `File`; enum `Role {DIRECTOR, MANAGER, EMPLOYEE}`, `NotifChannel`, `NotifStatus`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/test/rls.spec.ts
describe('RLS scope', () => {
  it('employee chỉ thấy row của mình', async () => {
    const rows = await prismaFor(empA).someBusinessList();
    expect(rows.every(r => r.ownerId === empA.id)).toBe(true);
  });
  it('manager kiêm 2 phòng thấy đúng 2 phòng', async () => {
    const rows = await prismaFor(mgr).someBusinessList();
    expect(new Set(rows.map(r => r.departmentId))).toEqual(new Set(mgrDeptIds));
  });
  it('director thấy toàn công ty', async () => {
    expect(await prismaFor(dir).someBusinessList()).toHaveLength(ALL);
  });
  it('raw query không bypass RLS', async () => {
    await expect(prismaFor(empA).$queryRaw`SELECT ...`).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test rls.spec`
Expected: FAIL (schema/extension chưa có).

- [ ] **Step 3: Implement schema + migration + seed + extension**

`schema.prisma`: 6 models + enums theo spec mục 5; mọi bảng có `tenantId String?`; `User(role, departmentId?, reportsToId?)`, `Department(managerId?, parentId?)`. Migration SQL bật RLS + policies SELF/DEPARTMENT/COMPANY đọc `current_setting('app.current_user_id')`. Seed: 1 DIRECTOR, 1 MANAGER + 1 phòng, 2 EMPLOYEE. `PrismaService` set `SET LOCAL` từ AsyncLocalStorage; extension `forUser` gắn `where` scope.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test rls.spec`
Expected: PASS (4/4, gồm raw-query bị chặn).

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma apps/api/src/prisma apps/api/test/rls.spec.ts
git commit -m "feat(api): add shell schema with RLS and scope extension"
```

### Task 3: IamModule — auth JWT + /me

**Files:**
- Create: `apps/api/src/iam/iam.module.ts`, `iam.controller.ts`, `iam.service.ts`, `jwt-auth.guard.ts`, `current-user.decorator.ts`, `dto/login.dto.ts`
- Modify: `apps/api/src/app.module.ts` (đăng ký IamModule + guard toàn cục)
- Test: `apps/api/test/iam.spec.ts` (e2e qua supertest)

**Interfaces:**
- Consumes: `PrismaService` (Task 2); `packages/contracts` login schema (định nghĩa ở đây nếu contracts chưa có: `LoginInput {email, password}`, `MeResponse {id, email, name, role, departmentId, managedDepartmentIds}`).
- Produces: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /me`, `PATCH /me/password`; guard gắn `request.user`; refresh xoay vòng + phát hiện reuse.

- [ ] **Step 1: Write the failing test**

```ts
it('login trả access + set refresh cookie; /me trả role + managedDepartmentIds', ...);
it('refresh xoay vòng: reuse refresh cũ bị 401 + thu hồi chuỗi', ...);
it('sai mật khẩu 5 lần bị rate-limit 429', ...);
it('đổi mật khẩu với mật khẩu cũ sai bị 400', ...);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test iam.spec`
Expected: FAIL (routes chưa có).

- [ ] **Step 3: Implement `IamService` + controller + guard**

Argon2 verify; access JWT 15 phút (payload `sub, role`); refresh opaque lưu hash trong DB (bảng `RefreshToken` thêm vào schema Task 2 nếu thiếu — migration bổ sung), cookie httpOnly `Secure/SameSite=Lax`; reuse → thu hồi cả chuỗi + 401; `GET /me` tính `managedDepartmentIds` từ departments do user quản lý; rate-limit login 5/phút/IP (throttle).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test iam.spec`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/iam apps/api/src/app.module.ts apps/api/test/iam.spec.ts
git commit -m "feat(api): add JWT auth with rotation and me"
```

### Task 4: OrgModule + CASL sensors T3

**Files:**
- Create: `apps/api/src/org/org.module.ts`, `org.controller.ts`, `org.service.ts`, `abilities.factory.ts`, `sensors.interceptor.ts`, `field-filter.util.ts`
- Test: `apps/api/test/sensors.spec.ts` (unit CASL + integration interceptor)

**Interfaces:**
- Consumes: `request.user` từ guard (Task 3); `PrismaService.forUser` (Task 2).
- Produces: `AbilitiesFactory.createFor(user): Ability`; `SensorsInterceptor` (check 4W, chặn LDP sửa TASK Luồng 2 → 403 + audit, ẩn `base_salary/bonus`); CRUD `GET/POST/PATCH /org/departments`, `GET/PATCH /org/users` (DIRECTOR sửa, MANAGER xem phòng mình).

- [ ] **Step 1: Write the failing test**

```ts
it('thiếu 1 trong 4W khi tạo TASK bị 422', ...);
it('LDP sửa TASK Luồng 2 bị 403 + có audit log', ...);
it('response ẩn base_salary/bonus với MANAGER không quyền', ...);
it('DIRECTOR sửa org OK; MANAGER sửa phòng khác bị 403', ...);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test sensors.spec`
Expected: FAIL.

- [ ] **Step 3: Implement abilities + interceptor + org CRUD**

CASL: `can('manage','all')` nếu DIRECTOR; MANAGER `can(['read','update'], subject, {departmentId: {$in: managed}})`; EMPLOYEE chỉ own. Interceptor sau guard: validate 4W (what/who/when/where đủ) → 422 `TASK_4W_INCOMPLETE`; nếu `task.flow === 'DIRECT' && user.role === MANAGER && action !== 'read'` → 403 `FLOW2_MONITOR_ONLY` + audit; `field-filter` xóa lương khi `cannot('read','salary')`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test sensors.spec`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/org apps/api/test/sensors.spec.ts
git commit -m "feat(api): add org module and CASL business sensors"
```

### Task 5: packages/contracts + packages/ui

**Files:**
- Create: `packages/contracts/src/auth.ts`, `org.ts`, `notify.ts`, `search.ts`, `index.ts` (Zod + TS types + OpenAPI snippet); `packages/ui/src/Button.tsx`, `Table.tsx`, `Form.tsx`, `Modal.tsx`, `Toast.tsx`, `index.ts`
- Test: `packages/contracts/test/contract.spec.ts` (web–api DTO khớp); `packages/ui` storybook-lite render test.

**Interfaces:**
- Consumes: không (định nghĩa chuẩn cho Task 6–8 dùng).
- Produces: `LoginInput/MeResponse/ApiError/NotifyPayload/...` (Zod schemas + inferred types); UI components nhận `className` Tailwind, hỗ trợ `disabled`, focus-visible, reduced-motion.

- [ ] **Step 1: Write the failing test**

```ts
it('LoginInput từ chối email sai định dạng', ...);
it('ApiError đúng shape {code,message,details}', ...);
it('Button render disabled + focus-visible', ...);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @qsystem/contracts test && pnpm --filter @qsystem/ui test`
Expected: FAIL.

- [ ] **Step 3: Implement schemas + components**

Zod theo spec; UI: Button (primary/ghost, 40px, radius 10), Table (sticky header, zebra), Form (Field + ErrorText), Modal (focus trap, ESC đóng), Toast (Socket.IOano sau). Không màu mè, một accent token.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @qsystem/contracts test && pnpm --filter @qsystem/ui test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts packages/ui
git commit -m "feat: add shared contracts and ui kit"
```

### Task 6: NotificationModule + workers T5

**Files:**
- Create: `apps/api/src/notify/notify.module.ts`, `notify.service.ts` (outbox), `notify.worker.ts`, `providers/email.provider.ts`, `viber.provider.ts`, `socket.gateway.ts`, `video.provider.ts` (interface + mock), `ai.provider.ts` (interface + mock), `notify.controller.ts` (`GET /notifications`)
- Test: `apps/api/test/notify.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (outbox tx), BullMQ queues `notify/scheduled` (Redis Task 1), CASL read-scope.
- Produces: `NotifyService.enqueue(input)` (ghi DB + job cùng tx); workers gửi email/Viber/socket, retry 3, dead-letter; `GET /notifications?mine` cho offline sync; `VideoProvider/AiProvider` mock log.

- [ ] **Step 1: Write the failing test**

```ts
it('enqueue ghi outbox pending + job; worker gửi thành sent', ...);
it('provider lỗi 3 lần → failed + dead-letter', ...);
it('worker chết giữa chừng: tin vẫn pending, retry không mất', ...);
it('GET /notifications chỉ trả tin của mình', ...);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test notify.spec`
Expected: FAIL.

- [ ] **Step 3: Implement outbox + workers + gateway**

Outbox cùng transaction; worker `notify` gọi provider theo channel; Nodemailer SMTP env (dev: log-file); Viber REST theo `viber_user_id`, thiếu → fallback email + note; Socket gateway namespace `/shell`, room user/dept; repeatable jobs stub (thu hồi Lead, gỡ ghim, nhắc công — body rỗng có log, module sau điền).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test notify.spec`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/notify apps/api/test/notify.spec.ts
git commit -m "feat(api): add notification outbox and T5 workers"
```

### Task 7: SearchModule + StorageModule

**Files:**
- Create: `apps/api/src/search/search.module.ts`, `search.service.ts`, `search.controller.ts`, `sync.worker.ts`; `apps/api/src/storage/storage.module.ts`, `storage.service.ts`, `storage.controller.ts`
- Test: `apps/api/test/search-storage.spec.ts`

**Interfaces:**
- Consumes: Meilisearch + MinIO (Task 1), scope từ CASL (Task 4).
- Produces: `GET /search?q=&scope=` (filter dept/owner); `POST /files/presign` (PUT), `GET /files/:id` (GET có check scope); sync worker index khi DB đổi.

- [ ] **Step 1: Write the failing test**

```ts
it('search của EMPLOYEE không lọt doc phòng khác', ...);
it('presign PUT rồi GET lại đúng nội dung + sai scope bị 403', ...);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test search-storage.spec`
Expected: FAIL.

- [ ] **Step 3: Implement search + storage**

Index `leads, contacts, deals, posts, documents` (stub rỗng cho module sau, seed vài doc test); filter scope lúc query; MinIO presigned 15 phút, bucket `qsystem-docs/avatars`, metadata bảng `files`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test search-storage.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/search apps/api/src/storage apps/api/test/search-storage.spec.ts
git commit -m "feat(api): add scoped search and storage"
```

### Task 8: Web shell + App Switcher + middleware

**Files:**
- Create: `apps/web/app/(auth)/login/page.tsx`, `apps/web/app/(shell)/layout.tsx`, `page.tsx` (dashboard stub), `org/page.tsx`, `apps/web/components/AppSwitcher.tsx`, `Header.tsx`, `Sidebar.tsx`, `apps/web/middleware.ts`, `apps/web/lib/api.ts`, `apps/web/app/globals.css` (tokens)
- Test: `apps/web/test/appswitcher.spec.tsx` + Playwright `apps/web/e2e/shell.spec.ts`

**Interfaces:**
- Consumes: `packages/contracts` (Task 5), `GET /me` + module registry API (`GET /registry` — thêm stub ở OrgModule nếu thiếu: trả 4 app + scope).
- Produces: login flow cookie; shell layout sidebar/header/chuông; `AppSwitcher` đúng spec P2; middleware chặn route theo role.

- [ ] **Step 1: Write the failing test**

```ts
it('menu chỉ hiện app theo quyền; 1 app vẫn focus được', ...);
it('app hiện tại có aria-current + chấm accent', ...);
it('middleware: EMPLOYEE vào /org/admin bị redirect login/403', ...);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test`
Expected: FAIL.

- [ ] **Step 3: Implement `AppSwitcher` + shell**

`AppSwitcher`: nút tròn 56px fixed góc trên phải, hover/focus mở menu 232px, hàng 48px icon 18px/1.5, `role=menu/menuitem`, ESC đóng, click chuyển route giữ session; tokens CSS (`--qs-*` theo bản vẽ đã duyệt); middleware đọc `/me` cache, redirect theo role.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test && pnpm --filter web e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): add shell layout and app switcher"
```

### Task 9: Audit log + ExceptionFilter + CI

**Files:**
- Create: `apps/api/src/common/exception.filter.ts`, `audit.interceptor.ts`, `.github/workflows/ci.yml`
- Modify: các controller đăng ký audit (duyệt/từ chối/sửa nhạy cảm/xóa)
- Test: `apps/api/test/audit-error.spec.ts`

**Interfaces:**
- Consumes: mọi module trước.
- Produces: lỗi chuẩn `{code,message,details}`; audit row cho mọi hành động nhạy cảm; CI chạy lint/test/build 3 package.

- [ ] **Step 1: Write the failing test**

```ts
it('validation fail trả {code:VALIDATION,...} 422', ...);
it('LDP sửa FLOW2 ghi audit đủ old/new', ...);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test audit-error.spec`
Expected: FAIL.

- [ ] **Step 3: Implement filter + interceptor + CI**

`ExceptionFilter` map Zod/CASL/Prisma → code chuẩn; `AuditInterceptor` ghi actor/action/entity/old/new; CI: `pnpm lint && pnpm test && pnpm build` trên Node 20/24.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test audit-error.spec && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common .github apps/api/test/audit-error.spec.ts
git commit -m "feat: add error standard, audit trail and CI"
```

## Self-Review

1. **Spec coverage:** P1 auth/org/registry/ui/RLS-audit/T5/search — Tasks 1–9 phủ đủ; P2 AppSwitcher — Task 8; P3 sensors — Task 4; P4 RLS/Redis/MinIO/Meili — Tasks 2,6,7; P5 outbox/providers/scheduled — Task 6; P6 bảo mật/lỗi/test/mở rộng — Task 9 + rải các task. Không sót.
2. **Step scan:** mỗi step một hành động + kết quả check được; không dòng quyết-định-trống; body code chỉ ở chỗ algorithm thật (CASL rules, outbox tx, presign) — đã gọn.
3. **Type consistency:** `managedDepartmentIds` (Task 3) dùng lại ở Task 4/8; `forUser` (Task 2) dùng ở 3,4,6,7; `NotifyService.enqueue` (Task 6) khớp `NotifyPayload` (Task 5); `GET /registry` stub khai ở Task 8 dùng chung sau.
4. **Review Focus:** 5 dòng đã có test ghim đúng task sở hữu (3,4,4,6,8).
5. **Proportion:** plan ~200 dòng cho spec ~120 dòng — tương xứng, code block chỉ là test/assertion, body do implementer viết.
