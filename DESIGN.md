---
name: QSystem
description: Không gian làm việc hợp nhất đa phân hệ cho doanh nghiệp
colors:
  bg-base-dark: "#111418"
  bg-sidebar-dark: "#191D23"
  surface-1-dark: "#191D23"
  bg-inverse-dark: "#0D1014"
  state-hover-dark: "#222731"
  state-selected-dark: "#252B36"
  border-dark: "#30363D"
  fg-dark: "#F3F4F6"
  fg-muted-dark: "#9CA3AF"
  bg-base-light: "#FAF8F4"
  bg-sidebar-light: "#F4F1EA"
  surface-1-light: "#FFFFFF"
  bg-inverse-light: "#F3F0E8"
  state-hover-light: "#EFECE4"
  state-selected-light: "#E8E4DA"
  border-light: "#DEDAD0"
  fg-light: "#18181B"
  fg-muted-light: "#52525B"
  brand-primary: "#E8AD45"
  brand-ink: "#201708"
  focus-dark: "#E8AD45"
  focus-light: "#8A6000"
  success-dark: "#3FB950"
  error-dark: "#F85149"
  warning-dark: "#F59E0B"
  info-dark: "#5B8DB8"
  success-light: "#15803D"
  error-light: "#B91C1C"
  warning-light: "#D97706"
  info-light: "#2F6690"
typography:
  display:
    fontFamily: "Inter, sans-serif"
    fontSize: "26px"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  control: "6px"
  panel: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.brand-primary}"
    textColor: "{colors.brand-ink}"
    rounded: "{rounded.control}"
    height: "40px"
  button-primary-lg:
    backgroundColor: "{colors.brand-primary}"
    textColor: "{colors.brand-ink}"
    rounded: "{rounded.control}"
    height: "44px"
  input-default:
    backgroundColor: "{colors.bg-inverse-dark}"
    textColor: "{colors.fg-dark}"
    rounded: "{rounded.control}"
    height: "40px"
  table-row:
    height: "44px"
---

# QSystem Console Design System

> **Chuẩn mẫu trực quan bắt buộc (Visual Gold Standard):**
> - QTask (Dark mặc định): `docs/design/references/01-qtask-dark.jpg`
> - QHRM + `Ctrl+K` (Light Warm Paper): `docs/design/references/02-qhrm-light-cmdk.jpg`
> - Đăng nhập tập trung (Dark): `docs/design/references/03-login-dark.jpg`
> - Prototype CSS/DOM: `docs/design/references/qsystem-console-prototype.html`

## Overview

QSystem là web app đa phần mềm: QTask (giao việc), QHRM (nhân sự), QCRM, QSocial trên một shell hợp nhất — sidebar `240px`, topbar `56px`, một hệ token duy nhất. Người dùng chính là nhân sự nhiều phòng ban trong công ty; sản phẩm ưu tiên trải nghiệm nhanh, gọn, mượt và thao tác bàn phím. Giao diện console: mật độ dữ liệu cao, chrome tĩnh không bóng, chỉ tầng nổi có elevation. Hai chế độ: Console Dark (mặc định) và Warm Paper Light, chọn qua `data-theme` trên `<html>` bằng script blocking chống nháy (`localStorage['qsystem-theme']`, mặc định `dark`).

## Colors

**The One-CTA Rule.** Hổ phách `{colors.brand-primary}` chỉ dùng cho logo vuông `Q` và **một** nút CTA chính mỗi màn hình (`+ Giao việc`, `+ Thêm nhân sự`, `Đăng nhập`); mọi hành động khác là secondary/ghost. Chữ trên nền hổ phách luôn `{colors.brand-ink}` (tương phản > 7.5:1).

**The Neutral Selection Rule.** Hover/chọn trên sidebar, dòng bảng và Ctrl+K dùng nền trung tính `{colors.state-hover}` / `{colors.state-selected}`, không tô vàng toàn dòng.

**The Focus Separate Rule.** Vòng focus là token riêng `{colors.focus-dark}` / `{colors.focus-light}` (`#8A6000` ở Light vì hổ phách chỉ đạt 1.9:1 trên giấy ấm), luôn >= 3:1 trên cả hai chế độ.

| Vai trò | Dark (mặc định) | Light (Warm Paper) | Dùng |
| :--- | :--- | :--- | :--- |
| Nền trang | `#111418` | `#FAF8F4` | 60% nền tổng thể |
| Sidebar | `#191D23` | `#F4F1EA` | thanh điều hướng trái 240px |
| Surface 1 | `#191D23` | `#FFFFFF` | bảng, card, modal, panel |
| Nền chìm | `#0D1014` | `#F3F0E8` | input 40–44px |
| Hover | `#222731` | `#EFECE4` | dòng bảng, item sidebar |
| Chọn | `#252B36` | `#E8E4DA` | dòng/mục đang chọn |
| Viền | `#30363D` | `#DEDAD0` | viền cấu trúc 1px |
| Chữ chính | `#F3F4F6` | `#18181B` | >= 12:1 |
| Chữ phụ | `#9CA3AF` | `#52525B` | mã việc, nhãn, timestamp (>= 4.6:1) |
| Trạng thái | `#3FB950` / `#F85149` / `#F59E0B` / `#5B8DB8` | `#15803D` / `#B91C1C` / `#D97706` / `#2F6690` | Hoàn thành · Lỗi · Cảnh báo · Thông tin |

Phối màu 60–30–10: 60% nền trang, 30% bề mặt cấu trúc, 10% điểm nhấn. Chữ thường >= 4.5:1 (WCAG AA).

## Typography

Duy nhất font `Inter` (400/500/600), subset `vietnamese`, tải qua `next/font/google`. Số liệu (`CV-xxxx`, thời hạn, giờ, bộ đếm) bật `font-variant-numeric: tabular-nums`.

| Cấp | Giá trị |
| :--- | :--- |
| `<h1>` tiêu đề trang | 26–28px, weight 500, letter-spacing -0.02em |
| `<h2>` tiêu đề panel | 16–18px, weight 500–600 |
| Bảng & biểu mẫu | 14px, line-height 1.5 |
| Metadata, mã việc, bộ lọc, timestamp | 12–13px |

Không dùng font khác cho UI; không uppercase có tracking rộng cho nhãn; tiếng Việt phải render đủ dấu ở mọi cấp, kể cả `aria-label` và `placeholder`.

## Layout

- Thang khoảng cách: 4 / 8 / 12 / 16 / 24 / 32px. Trong nhóm 8–12px, giữa nhóm 20–24px, lề nội dung 24px.
- Sidebar cố định `240px`; topbar cố định `56px` (breadcrumb trái, nút tìm nhanh giữa, Sáng/Tối · Thông báo · Tài khoản phải).
- Hàng bảng cao 44–48px; input và nút chính cao 40–44px (`sm` 36px chỉ cho chrome nhỏ). Cột tiêu đề và dữ liệu căn cùng trục dọc.
- Panel chi tiết: song song 390px khi >= 1280px; overlay drawer có backdrop khi < 1280px. Sidebar thu thành drawer dưới 1024px.
- Responsive: desktop là chính, kiểm tra tới 390x844; không tràn ngang ở mọi breakpoint.

## Elevation & Depth

**The Floating-Only Shadow Rule.** `box-shadow` chỉ cho tầng nổi: CommandPalette (640px), menu ModuleSwitcher, FilterPopover, popover thông báo, drawer overlay, toast. Bảng, card và chrome tĩnh không bóng; phân tách bằng viền 1px và bước nền. Scrim modal: `rgb(8 10 14 / 0.68)` Dark, `rgb(24 24 27 / 0.36)` Light.

## Shapes

- Bo góc `6px` cho nút, input, chip, dòng danh sách; `8px` cho modal, drawer, panel nổi.
- Icon Lucide React: 18px ở sidebar/topbar, 16px trong bảng/nút, `strokeWidth={1.5}`; một set, một kích thước mỗi lớp.
- Tab lọc `Tất cả · Của tôi · Quá hạn` dùng underline tabs (gạch chân 2px hổ phách), không đóng hộp viền.

## Components

**Button** — primary (nền hổ phách, chữ `#201708`), secondary (viền), ghost, danger (`#B91C1C`); heights 36/40/44px; hover là bước nền, không đổi layout; `:active translateY(1px)`; `:focus-visible` outline 2px; disabled opacity 0.55; loading có spinner dot 14px + `aria-busy`.

**Input** — nền bg-inverse, viền, cao 40px (lg 44px), radius 6px; lỗi: viền error + `aria-invalid`; helper 12–13px màu phụ; error `role="alert"`.

**Table** — hàng 44px, viền dưới 1px, hover state-hover, dòng chọn state-selected + `aria-selected`; sort qua `aria-sort` trên `<th>`; bàn phím: ArrowUp/Down, J/K (opt-in, bỏ qua khi gõ trong input/select/textarea/contenteditable hoặc có modifier), Enter/Space kích hoạt; click control con không kích hoạt dòng.

**Modal** — overlay scrim + dialog `max-width 32rem`, radius 8px; stack nhiều tầng: Esc chỉ đóng tầng trên cùng, `body.overflow` chỉ khôi phục khi tầng cuối đóng; focus về trigger vừa đóng.

**Toast** — region cố định góc (6 vị trí), `pointer-events: none` ở region, `auto` ở card; card nền surface + bóng nổi + sọc trạng thái 3px bên trong; auto-dismiss pause khi hover/focus, giữ nguyên thời gian còn lại.

**CommandPalette (Ctrl+K)** — 640px, input 44px, nhóm `Đi tới / Chuyển ứng dụng / Thao tác nhanh` không đánh số; chọn/hover nền trung tính; mở bằng Ctrl+K/Cmd+K, bỏ qua IME composing, đóng bằng Esc.

**Trạng thái dữ liệu** — mọi vùng dữ liệu có 4 trạng thái: skeleton đúng hình dạng bảng (pulse 1200ms, tắt khi reduced-motion), empty có hướng dẫn, error có nút thử lại, full.

## Bảy Nguyên lý UI/UX Cốt lõi

1. **Phân cấp trực quan rõ ràng (Visual Hierarchy):**
   - `<h1>` Tiêu đề trang: `26–28px`, weight `500`, `letter-spacing: -0.02em`.
   - `<h2>` Tiêu đề panel / nhóm: `16–18px`, weight `500–600`.
   - Nội dung bảng & biểu mẫu: `14px`, `line-height: 1.5`.
   - Metadata, mã việc, bộ lọc, timestamp: `12–13px`.
   - Mỗi màn hình chỉ có **duy nhất 1 nút CTA chính màu hổ phách** (`+ Giao việc`, `+ Thêm nhân sự`, `Đăng nhập`). Các hành động còn lại (*Hoàn thành việc*, *Bộ lọc*, *Hủy*) dùng kiểu phụ hoặc ghost.
2. **Bố cục, Căn lề & Khoảng trắng (Alignment & Whitespace):**
   - Thang khoảng cách: `4 / 8 / 12 / 16 / 24 / 32px` (trong cùng nhóm `8–12px`, giữa các nhóm `20–24px`, lề nội dung `24px`).
   - Hàng bảng cao `44–48px`; ô nhập và nút chính cao `40–44px`. Cột tiêu đề và dữ liệu căn thẳng cùng một trục dọc.
3. **Phối màu 60–30–10 & Tương phản WCAG (`>= 4.5:1`):**
   - `60%` nền trang, `30%` bề mặt cấu trúc (`sidebar`, bảng, thẻ, viền mảnh `1px`), `10%` điểm nhấn (`#E8AD45` chỉ cho logo vuông `Q` và CTA chính + màu trạng thái đặc biệt).
   - Trạng thái chọn/hover trên sidebar, dòng bảng và `Ctrl+K` dùng **nền trung tính đồng nhất**, không tô vàng toàn dòng.
4. **Kiểu chữ thống nhất:**
   - Dùng **duy nhất font `Inter`** (`400, 500, 600`, subset `vietnamese`) trên toàn UI.
   - Bật `font-variant-numeric: tabular-nums` cho mã việc (`CV-xxxx`), thời hạn, giờ và bộ đếm.
5. **Nhất quán thành phần & Phân tầng bóng đổ:**
   - Bo góc `6px` cho nút/input/chip/dòng danh sách; `8px` cho modal/drawer/panel.
   - Icon thống nhất: **Lucide React** (`18px` sidebar/topbar, `16px` trong bảng/nút, `strokeWidth={1.5}`).
   - **Không dùng `box-shadow` cho bảng hoặc thẻ tĩnh**; chỉ đổ bóng cho tầng nổi (`Ctrl+K`, dropdown `ModuleSwitcher`, `FilterPopover`, popover thông báo, drawer dạng overlay).
6. **Tối giản loại bỏ chi tiết thừa (Less is More):**
   - Tab lọc `Tất cả · Của tôi · Quá hạn` dùng **minimal bottom-underline tabs** (không đóng hộp viền lồng khung).
   - Trang `/login` bỏ bảng phân hệ/thống kê phụ; trang `QTask` bỏ chỉ số lặp `Trễ hạn` và số đếm nhân sự thừa; hộp `Ctrl+K` bỏ đánh số `1, 2, 3`.
7. **Phản hồi tức thì & Thân thiện (Tactile Feedback):**
   - Hover chuyển mượt `150ms` (`background-color`, `border-color`, `color` — không dùng `transition-all`).
   - Nhấn nút có `:active { transform: translateY(1px); }`, bàn phím có `:focus-visible` rõ (`>= 3:1`), tôn trọng `prefers-reduced-motion: reduce`.
   - Có spinner khi nút đang gửi API, `LoadingSkeleton` đúng hình dáng bảng, `EmptyState` / `ErrorState` rõ cách khắc phục, và `ToastRegion` xác nhận không che nội dung.

---

## Giải phẫu 4 Màn hình Chuẩn (Khớp ảnh mẫu)

### A. Shell Hợp nhất (`UnifiedShell`)
- **Sidebar (`240px`):**
  1. Brand Row trên cùng: Biểu tượng vuông bo góc `6px` nền `#E8AD45` chứa chữ `Q` đậm `#201708` + chữ `QSystem`.
  2. `ModuleSwitcher` ngay dưới (VD: `QTask ▾`): menu nổi liệt kê `QTask`, `QHRM`, `QCRM`, `QSocial` (icon + tên + 1 dòng mô tả).
  3. Mục điều hướng ngữ cảnh: chỉ hiển thị mục thuộc phân hệ đang mở.
- **Top Bar cố định (`56px`):** Trái là Breadcrumb (`QTask / Tất cả công việc`) · Giữa là nút mở tìm nhanh (`Tìm việc, nhân sự, tài liệu…` + badge `Ctrl K`) · Phải cố định 3 nút: `Sáng/Tối`, `Thông báo`, `Tài khoản`.

### B. Màn hình 1 — `QTask` ([01-qtask-dark.jpg](docs/design/references/01-qtask-dark.jpg))
- **Header:** Trái `Công việc` (`26–28px`), phải duy nhất nút `+ Giao việc` (`#E8AD45`).
- **Thanh lọc:** Trái 3 underline tabs `Tất cả · Của tôi · Quá hạn` (sync `?view=`), phải nút `Bộ lọc` mở `FilterPopover` (`Trạng thái`, `Phòng ban`, `Phụ trách`).
- **Bảng chính:** Cột `Tên công việc` rộng nhất (1 dòng không bọc chữ), `Mã` (`CV-xxxx`), `Phụ trách` (họ tên đầy đủ), `Thời hạn`, `Trạng thái`. Hỗ trợ phím `J/K` và `Enter/Space`.
- **Panel chi tiết (`ResponsiveDetailDrawer`):**
  - `>= 1280px`: mở song song `390px` bên phải; bấm `×` đóng panel để bảng mở `100%` chiều rộng.
  - `< 1280px`: chuyển sang **overlay drawer** có backdrop & bóng đổ nổi để không bóp cột tên việc.
  - Nội dung panel: mã việc + tiêu đề + nút `×` · danh sách thuộc tính 1 cột `nhãn trái – giá trị phải` không kẻ khung (`Phụ trách`, `Thời hạn`, `Phòng ban`, `Trạng thái` chọn đổi trực tiếp inline) · 2 tab gạch chân `Trao đổi` / `Tệp đính kèm` · nút phụ `Hoàn thành việc` (`secondary`, không cướp trọng tâm của `+ Giao việc`).

### C. Màn hình 2 — `QHRM` + `Ctrl+K` ([02-qhrm-light-cmdk.jpg](docs/design/references/02-qhrm-light-cmdk.jpg))
- **QHRM (`/org`):**
  - Cột lọc phòng ban bên trái (`240px`): mục đầu `Toàn công ty` + tổng nhân sự, các phòng ban bên dưới kèm số người.
  - Vùng chính bên phải: tiêu đề động `Nhân sự · [Tên phòng]` + nút `+ Thêm nhân sự` (chỉ hiện với Giám đốc/Quản lý) + bảng 5 cột rõ ràng: `Họ tên | Chức danh | Vai trò | Quản lý trực tiếp | Tình trạng`.
- **Hộp tìm nhanh `Ctrl+K` (`CommandPalette`):**
  - Rộng `640px`, bóng đổ tầng nổi, input `h-11` (`44px`) đủ dài không cắt placeholder.
  - **Không đánh số `1, 2, 3`**: nhóm `Đi tới`, `Chuyển ứng dụng`, `Thao tác nhanh`, dùng đúng nền chọn trung tính của hệ thống.

### D. Màn hình 3 — Đăng nhập (`/login`, [03-login-dark.jpg](docs/design/references/03-login-dark.jpg))
- Split 2 cột desktop:
  - Cột trái tối giản: Logo `Q` hổ phách + `QSystem` + một câu duy nhất *"Không gian làm việc của QSystem."* (không vẽ bảng phụ).
  - Cột phải: Thẻ form `380–420px`, input `44px`, nút `Hiện/Ẩn` mật khẩu, nút `#E8AD45` `Đăng nhập` toàn chiều rộng, liên kết `Cần hỗ trợ đăng nhập?` phía dưới và nút đổi Sáng/Tối gọn ở góc.

---

## Cổng Kiểm duyệt Tự động trước khi Hoàn tất UI Card

1. **Fragment UI MCP:** Luôn truy vấn Fragment UI trước khi tự tạo component mới và ghi rõ quyết định tái sử dụng hoặc lý do không khớp.
2. **Hallmark Lint:** Chạy `sloplint --scope app --genre modern-minimal --render` phải đạt `0 FAIL`.
3. **Playwright 100% Zoom QA:** Kiểm tra cả Dark (`#111418`) và Light (`#F4F1EA`/`#FFFFFF`) ở `1440x900`, `1024x768`, `390x844` với chuỗi tiếng Việt mẫu *"Nguyễn Minh Tuấn, Trễ hạn, Tổ chức & Nhân sự"*.

---

## Do's and Don'ts

- DO giữ bảng token §Colors cho cả hai chế độ; không hardcode hex ngoài token.
- DO một CTA hổ phách mỗi màn hình; secondary/ghost cho phần còn lại.
- DO transition từng thuộc tính (`background-color`, `border-color`, `color`) 150ms; tôn trọng `prefers-reduced-motion: reduce`.
- DO tiếng Việt tự nhiên 100% cho người vận hành; cấm lộ `4W`, `PENDING/SENT/FAILED/DEAD`, `DIRECTOR/MANAGER/EMPLOYEE`, `Presign`, raw MIME, `/org` lên màn hình.
- DON'T dùng `transition: all`, bóng đổ cho bảng/card tĩnh, gradient chữ, glow, emoji làm icon, gradient tím–xanh.
- DON'T đóng hộp tab lọc, đánh số 1-2-3 trong Ctrl+K, thêm bảng thống kê phụ vào `/login`.
- DON'T bẻ chữ ký prop hay đổi tên export của `@qsystem/ui`; chỉ mở rộng opt-in.
