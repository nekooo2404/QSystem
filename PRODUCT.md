# PRODUCT.md — QSystem Unified Workspace

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Đội ngũ vận hành nội bộ của một doanh nghiệp Việt Nam: người giao việc và theo dõi tiến độ (giám đốc, quản lý phòng ban), người thực hiện công việc (nhân viên), và người quản trị nhân sự.

Họ làm việc liên tục trong ngày trên máy tính để bàn, xử lý khối lượng lớn công việc và dữ liệu nhân sự, và ưu tiên tốc độ thao tác bàn phím hơn thao tác chuột.

## Product Purpose

**QSystem** là không gian làm việc hợp nhất: giao việc và theo dõi tiến độ (QTask), quản lý nhân sự và phòng ban (QHRM), cùng các phân hệ mở rộng (QCRM, QSocial), trên **một thương hiệu duy nhất**, một thanh điều hướng trên cố định và một thanh bên `240px` đổi theo phân hệ đang mở.

Sản phẩm tồn tại để một người vận hành không phải mở nhiều công cụ rời rạc, và để dữ liệu công việc – nhân sự – tài liệu – thông báo nằm trong cùng một ngữ cảnh nhìn thấy được.

Thành công là khi người dùng thành thạo hoàn tất công việc mà giao diện biến mất khỏi sự chú ý: tìm đúng người, đúng việc, đúng tài liệu trong vài giây, bằng bàn phím.

## Positioning

Không phải một bộ công cụ rời được ghép lại, mà là **một shell hợp nhất**: cùng một khung điều hướng, cùng một hệ token, cùng một quy chuẩn tiếng Việt cho mọi phân hệ. Phân hệ chỉ đổi nội dung thanh bên và vùng làm việc, không đổi cách người dùng định vị.

Điểm không thể sao chép: quy chuẩn ngôn ngữ hiển thị 100% tiếng Việt cho người vận hành cuối, cấm lộ thuật ngữ kỹ thuật hay tên schema API lên màn hình.

## Operating Context

- **Thiết bị:** trình duyệt máy tính để bàn là chính; có hỗ trợ hẹp xuống 390px nhưng không phải bối cảnh chính.
- **Thao tác bàn phím là công dân hạng nhất:** `Ctrl+K` mở tìm nhanh toàn hệ thống, `J`/`K` di chuyển dòng bảng, `Esc` đóng đúng một tầng nổi trên cùng, `Enter`/`Space` kích hoạt.
- **Hai chế độ hiển thị:** Console Dark (mặc định) và Warm Paper Light; lựa chọn lưu ở `localStorage['qsystem-theme']`, áp trước lần vẽ đầu tiên để không nháy màu.
- **Ngôn ngữ:** tiếng Việt có dấu đầy đủ; font `Inter` subset `vietnamese`; chữ số dạng `tabular-nums` cho mã việc, ngày giờ và bộ đếm.
- **Ba ảnh mẫu là chuẩn thị giác bắt buộc**, đã đưa vào repo để mọi CLI/IDE đọc đồng nhất: `docs/design/references/01-qtask-dark.jpg`, `02-qhrm-light-cmdk.jpg`, `03-login-dark.jpg`, kèm prototype `qsystem-console-prototype.html`.

### Phân hệ trong bộ chuyển ứng dụng (`ModuleSwitcher`)

| Phân hệ | Mô tả ngắn | Trạng thái hiện tại |
| :--- | :--- | :--- |
| **QTask** | Giao việc & theo dõi tiến độ (`Tất cả công việc`, `Công việc của tôi`, `Dự án`) | Core Workspace (`/`, `/tasks`, `/projects`) |
| **QHRM** | Nhân sự, phòng ban & chấm công (`Danh bạ nhân sự`, `Phòng ban`, `Chấm công`) | Core Workspace (`/org`) |
| **QCRM** | Khách hàng & hợp đồng | Màn hình đặt chỗ rõ ràng (`/crm`) |
| **QSocial** | Bảng tin & trao đổi nội bộ | Core Workspace (`/social`) |

Ngoài ra hệ thống có các màn hình dùng chung: **Đăng nhập** (`/login`), **Tài liệu** (`/files`), **Thông báo** (`/notifications`), **Tài khoản & Đổi mật khẩu** (`/account`).

## Capabilities and Constraints

### Quy chuẩn Ngôn ngữ Tiếng Việt cho Người dùng (Bắt buộc 100%)

Mọi nhãn nút, tiêu đề cột, thông báo lỗi, bộ lọc và hộp thoại trên UI phải dùng tiếng Việt tự nhiên cho người vận hành cuối. **Cấm tuyệt đối** lộ thuật ngữ kỹ thuật hay tên schema API lên màn hình:

- **Công việc:** dùng `Tên công việc`, `Mã việc` (`CV-xxxx`), `Phụ trách` (họ tên đầy đủ để phân biệt người trùng tên), `Thời hạn`, `Phòng ban`, `Trạng thái` (`Đang làm`, `Chờ duyệt`, `Quá hạn`, `Hoàn thành`), `Trao đổi`, `Tệp đính kèm`.
  - **Cấm:** `4W`, `WHO/WHAT/WHEN/WHERE`, `Audit trail`, `QT-`.
- **Nhân sự & Phân quyền:** dùng `Giám đốc`, `Quản lý`, `Nhân viên`, `Quản lý trực tiếp`, `Tình trạng` (`Đang làm việc`, `Tạm nghỉ`).
  - **Cấm:** `DIRECTOR`, `MANAGER`, `EMPLOYEE`, `/org`.
- **Thông báo & Tài liệu & Lỗi API:** dùng `Chờ gửi`, `Đã gửi`, `Gửi lỗi`, `Tài liệu PDF`, `Bảng tính`, thông điệp lỗi dễ hiểu kèm hướng xử lý.
  - **Cấm:** `PENDING`, `SENT`, `FAILED`, `DEAD`, `Presign`, `API_TIMEOUT`, raw MIME types.

### Điểm nối API & Typed Adapters (`apps/api` ↔ `apps/web`)

Frontend giao tiếp qua proxy cùng nguồn hoặc `credentials: 'include'` + làm mới phiên đơn luồng (`POST /auth/refresh`) với backend NestJS tại `apps/api`:

- **Đã có sẵn ở `apps/api`:**
  - IAM: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /me`, `PATCH /me/password`
  - Tổ chức & Công việc: `GET /org/departments`, `POST /org/departments`, `PATCH /org/departments/:id`, `GET /org/users`, `PATCH /org/users/:id`, `POST /org/tasks`, `PATCH /org/tasks/:id`
  - Tìm kiếm, Tài liệu & Thông báo: `GET /search`, `POST /files/presign`, `GET /files/:id`, `GET /notifications`
- **Các khoảng trống cần Typed Adapters ở `apps/web/src/lib/adapters/`** (không thay đổi hành vi backend ngoài phạm vi):
  1. `registry.adapter.ts`: cung cấp danh sách phân hệ (`QTask`, `QHRM`, `QCRM`, `QSocial`) cho tới khi `GET /registry` sẵn sàng.
  2. `tasks.adapter.ts`: ánh xạ dữ liệu tiếng Việt sang `TaskPayload4W` (`what`, `who`, `when`, `where`) cho `POST/PATCH /org/tasks` và giữ adapter danh sách tới khi backend bổ sung `GET /org/tasks`.
  3. `notifications.adapter.ts`: đồng bộ `GET /notifications` theo chu kỳ khi tab đang mở (polling an toàn) tới khi có Socket.IO gateway và chuẩn hóa trạng thái sang tiếng Việt.

Danh sách thiếu hụt API đã xác minh nằm ở `docs/harness/backend-companion-backlog.md`.

## Brand Commitments

- **Tên:** `QSystem` — một thương hiệu duy nhất cho mọi phân hệ.
- **Dấu hiệu nhận diện:** ô vuông bo góc `6px` nền hổ phách `#E8AD45` chứa chữ `Q` đậm `#201708`, đặt cạnh chữ `QSystem`. Dùng ở cả trang Đăng nhập lẫn đầu thanh bên; không dùng icon phụ hay tên phân hệ đè lên góc thương hiệu.
- **Màu nhấn:** `#E8AD45` **chỉ** cho logo `Q` và **một** nút CTA chính mỗi màn hình.
- **Kiểu chữ:** duy nhất `Inter` (400/500/600, subset `vietnamese`).
- **Giọng điệu:** tiếng Việt tự nhiên, câu hoàn chỉnh, không viết tắt kỹ thuật, không emoji trên UI.

## Evidence on Hand

- **Ảnh mẫu thị giác (chuẩn bắt buộc):** `docs/design/references/01-qtask-dark.jpg` (QTask Dark), `02-qhrm-light-cmdk.jpg` (QHRM Warm Paper Light + `Ctrl+K`), `03-login-dark.jpg` (Đăng nhập Dark).
- **Prototype CSS/DOM tham chiếu:** `docs/design/references/qsystem-console-prototype.html` — đã qua `sloplint --scope app --genre modern-minimal` với `0 FAIL`.
- **Hướng dẫn đọc mẫu:** `docs/design/references/README.md`.
- **Hợp đồng thiết kế:** `DESIGN.md` (7 nguyên lý + bảng token + blueprint 4 màn hình).
- **Không có sẵn:** ảnh chụp sản phẩm thật, testimonial, số liệu kinh doanh, logo vector gốc. Không được bịa các nội dung này.

## Product Principles

1. **Một shell, nhiều phân hệ.** Cùng khung điều hướng và cùng hệ token ở mọi nơi; chỉ nội dung thanh bên và vùng làm việc thay đổi theo phân hệ.
2. **Bàn phím trước, chuột sau.** Người thành thạo phải hoàn tất tác vụ chính mà không cần rời bàn phím.
3. **Tiếng Việt cho người dùng, không phải cho lập trình viên.** Mọi thuật ngữ kỹ thuật ở tầng API đều phải được dịch trước khi hiển thị.
4. **Tối giản có kỷ luật.** Một CTA chính mỗi màn hình; tab gạch chân thay hộp viền lồng khung; bóng đổ chỉ cho tầng nổi.
5. **Mật độ dữ liệu cao nhưng dễ đọc.** Hàng bảng `44–48px`, chữ số `tabular-nums`, cột căn cùng trục dọc.

## Accessibility & Inclusion

- Tuân thủ WCAG 2.1 AA: chữ thường `>= 4.5:1`, chữ lớn và vòng focus `>= 3:1`. Vòng focus dùng token `--qs-focus` (`#E8AD45` ở Dark, `#8a6000` ở Light) để đạt ngưỡng trên cả hai chế độ.
- Mọi control phải có đủ trạng thái: default, hover, focus-visible, active, disabled, loading, error.
- Tôn trọng `prefers-reduced-motion: reduce` — tắt transition và animation.
- Điều hướng bàn phím đầy đủ: `Tab` tới mọi control, `Esc` đóng đúng một tầng, `J`/`K` trong bảng, `Ctrl+K` trừ khi con trỏ đang ở ô nhập.
- Tiếng Việt phải render đúng dấu ở mọi nơi, kể cả trong `aria-label`, `title` và `placeholder`.

