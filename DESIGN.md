---
name: QSystem
description: Không gian làm việc hợp nhất đa phân hệ cho doanh nghiệp
colors:
  bg-base-dark: "#111317"
  bg-sidebar-dark: "#0D0F12"
  surface-1-dark: "#171A20"
  surface-2-dark: "#1E222A"
  bg-inverse-dark: "#0B0D10"
  state-hover-dark: "#1F242C"
  state-selected-dark: "#252B35"
  border-dark: "rgb(238 240 245 / 0.09)"
  border-strong-dark: "rgb(238 240 245 / 0.16)"
  fg-dark: "#EEF0F5"
  fg-secondary-dark: "#A3A9B8"
  fg-muted-dark: "#8C95AB"
  bg-base-light: "#F6F8FB"
  bg-sidebar-light: "#EEF2F6"
  surface-1-light: "#FFFFFF"
  surface-2-light: "#F1F4F8"
  bg-inverse-light: "#F1F4F8"
  state-hover-light: "#EAEFF5"
  state-selected-light: "#E1E8F0"
  border-light: "rgb(17 24 39 / 0.09)"
  border-strong-light: "rgb(17 24 39 / 0.16)"
  fg-light: "#111827"
  fg-secondary-light: "#4B5565"
  fg-muted-light: "#596377"
  brand-dark: "#618DC9"
  brand-hover-dark: "#759ED4"
  on-brand-dark: "#091423"
  brand-light: "#2C568F"
  brand-hover-light: "#234675"
  on-brand-light: "#FFFFFF"
  focus-dark: "#7BA2D6"
  focus-light: "#1F406E"
  success-dark: "#4CC38A"
  error-dark: "#F06469"
  warning-dark: "#E5A530"
  info-dark: "#6B94CC"
  success-light: "#157339"
  error-light: "#B91C1C"
  warning-light: "#A14808"
  info-light: "#2C568F"
  danger: "#B91C1C"
  danger-hover: "#991B1B"
  on-danger: "#FFFFFF"
  scrim-dark: "rgb(8 10 14 / 0.68)"
  scrim-light: "rgb(17 24 39 / 0.36)"
  shadow-floating-dark: "0 12px 32px rgb(0 0 0 / 0.40)"
  shadow-floating-light: "0 8px 24px rgb(17 24 39 / 0.08)"
  highlight-top-dark: "inset 0 1px 0 rgb(255 255 255 / 0.12)"
  highlight-top-light: "inset 0 1px 0 rgb(255 255 255 / 0.65)"
typography:
  display:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "26px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.4
  kpi:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "28px"
    fontWeight: 500
    lineHeight: 1.1
    fontVariantNumeric: "tabular-nums"
  body:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.35
  mono:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
    fontVariantNumeric: "tabular-nums"
rounded:
  keycap: "4px"
  control: "8px"
  card: "12px"
  panel: "16px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
  10: "40px"
  12: "48px"
  16: "64px"
motion:
  ease: "cubic-bezier(0.22, 1, 0.36, 1)"
  durationFast: "150ms"
  durationMenu: "180ms"
  durationOverlay: "300ms"
components:
  button-primary:
    backgroundColor: "{colors.brand-dark}"
    textColor: "{colors.on-brand-dark}"
    rounded: "{rounded.control}"
    height: "40px"
  button-primary-lg:
    backgroundColor: "{colors.brand-dark}"
    textColor: "{colors.on-brand-dark}"
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

> **Tham chiếu bố cục & Tỉ lệ Shell (Structural References):**
> - QTask (Dark mặc định): `docs/design/references/01-qtask-dark.jpg`
> - QHRM + `Ctrl+K` (Light): `docs/design/references/02-qhrm-light-cmdk.jpg`
> - Đăng nhập tập trung (Dark): `docs/design/references/03-login-dark.jpg`
> - Prototype cấu trúc DOM: `docs/design/references/qsystem-console-prototype.html`
>
> *Lưu ý kế thừa:* Các ảnh JPG và prototype lưu trữ thể hiện thế hệ màu hổ phách / giấy ấm / chữ `Inter` đã ngừng sử dụng. Chỉ kế thừa **tỉ lệ shell và bố cục** (`sidebar 240px`, `topbar 56px`, hàng bảng `44px`, hộp `Ctrl+K` `640px`, trang `/login` chia hai cột); toàn bộ bảng màu (`QTS Steel-Cobalt`), kiểu chữ (`Be Vietnam Pro` + `IBM Plex Sans` + `IBM Plex Mono`), bo góc lồng nhau (`4/8/12/16px`), công thức xúc giác `uiverse.io`/`land-book.com` và quy chuẩn `unslop` tuân thủ tuyệt đối tài liệu `DESIGN.md` này.

---

## Overview

QSystem là ứng dụng quản trị doanh nghiệp hợp nhất bốn phân hệ — **QTask** (công việc & dự án), **QHRM** (nhân sự, phòng ban, chấm công, nghỉ phép), **QCRM** (khách hàng, cơ hội bán hàng, liên hệ, báo cáo) và **QSocial** (bảng tin & trao đổi nội bộ) — trên một shell duy nhất với thanh bên `240px`, thanh trên `56px` và một hệ token `--qs-*` thống nhất.

Giao diện vận hành theo triết lý console bàn phím trước: mật độ thông tin rõ ràng, bề mặt tĩnh không đổ bóng, chỉ các tầng nổi mới có bóng đổ, hai chế độ **Graphite Dark (`#111317`, mặc định)** và **Cool-Slate Light (`#F6F8FB`)** chuyển qua `data-theme` trên `<html>` (`localStorage['qsystem-theme']`, mặc định `dark`, áp bằng script blocking trước lần vẽ đầu tiên).

---

## Unslop Direction

- **Product:** QSystem là không gian làm việc hợp nhất cho đội ngũ vận hành doanh nghiệp Việt Nam, kết nối công việc (QTask), nhân sự & chấm công (QHRM), khách hàng & cơ hội (QCRM) và trao đổi nội bộ (QSocial) trong một console bàn phím trước.
- **Character:** Quiet, disciplined, tactile.
- **World:** Sổ cái chính xác và dụng cụ bản vẽ bằng thép — bề mặt than chì mờ (`Graphite Dark`), đường kẻ mảnh (`hairline`), trang giấy xám thép mát (`Cool-Slate Light`), và mực xanh thép QTS (`Steel-Cobalt`).
- **Moments:** (1) Thanh tìm nhanh `Ctrl+K` và `AppLauncher` nổi sắc nét trên nền làm việc dịu mắt; (2) Biểu đồ pipeline QCRM / trạng thái công việc QTask, nơi mỗi màu mang đúng một ý nghĩa vận hành rõ ràng trong khi các thẻ xung quanh giữ bề mặt tĩnh lặng.
- **Signature:** Mã định danh, số liệu `tabular-nums` và phím tắt keycap (`CV-1042`, `Ctrl K`) bằng font đơn cách, căn thẳng trên các trục dọc chung với đường kẻ mảnh `1px`.

---

## Spec Reconciliation (Hợp nhất Đặc tả)

Tài liệu `DESIGN.md` này là **nguồn chân lý thiết kế duy nhất (single authoritative spec)** cho `@qsystem/ui` và `apps/web`, thay thế hoàn toàn các đặc tả xung đột trước đây:

| Nguồn cũ / Xung đột | Quy định cũ (Đã loại bỏ) | Quy chuẩn Hợp nhất Hiện hành |
| :--- | :--- | :--- |
| `DESIGN.md` (văn bản cũ) | Hổ phách (`#E8AD45`), Warm Paper (`#FAF8F4` / `#F4F1EA`), duy nhất `Inter`, bo góc `6px/8px` | **QTS Steel-Cobalt** (`#618DC9` Dark / `#2C568F` Light), Graphite Dark (`#111317`) & Cool-Slate Light (`#F6F8FB`), 3 họ chữ (`Be Vietnam Pro` + `IBM Plex Sans` + `IBM Plex Mono`), bo góc `4/8/12/16px` |
| `PRODUCT.md` (§ Current Brand Update & Brand Commitments) | Màu cyan gắt (`#00D9FF` / `#007A99`), hổ phách, `Inter` | Sử dụng **Steel-Cobalt** (`#618DC9` / `#2C568F`) hài hòa với logo khiên QTS; **giữ nguyên** tài sản `apps/web/public/qts-logo.png` + fallback chữ `Q` và **100% quy chuẩn tiếng Việt cho người vận hành** trong `PRODUCT.md` |
| `apps/web` CSS di sản (`shell.css`, `palette.css`, `login.css`, `globals.css`) | Tiền tố `--qx-*`, tím (`--qx-purple`), `animate.css`, `backdrop-filter`, thẻ giả lập nghiêng 3D ở `/login`, 5 đường cong easing | Quy tụ toàn bộ về một hệ token `--qs-*` xuất từ `@qsystem/ui/styles.css`, một đường cong `--qs-ease`, bỏ `animate.css`, bỏ glassmorphism và bỏ màu tím trang trí |

*Tương thích chuyển tiếp:* Trong khi `apps/web` di chuyển qua các mốc M2–M6, `@qsystem/ui/styles.css` giữ alias chuyển tiếp `--qs-float-shadow: var(--qs-shadow-floating)`, `--qs-ease-out: var(--qs-ease)` và `--qs-ease-in-out: var(--qs-ease)`. Toàn bộ luật CSS nội bộ của `@qsystem/ui` dùng trực tiếp `--qs-shadow-floating` và `--qs-ease`.

---

## Colors

### Nguyên tắc Phối màu (60–30–10 & Quiet Chrome)

1. **The One-CTA Rule:** Màu thương hiệu **QTS Steel-Cobalt** (`--qs-brand`: `#618DC9` Dark / `#2C568F` Light) chỉ dùng cho dấu hiệu logo `Q`, thanh gạch chân tab đang chọn, trạng thái bật của công tắc/mục đang chọn và **duy nhất 1 nút CTA chính mỗi màn hình** (`+ Giao việc`, `+ Thêm nhân sự`, `Đăng nhập`). Các hành động còn lại dùng `secondary` hoặc `ghost`.
2. **The Neutral Selection Rule:** Hover và chọn dòng bảng, item thanh bên, item `Ctrl+K` và menu `<Select>` dùng nền trung tính `--qs-state-hover` / `--qs-state-selected`, tuyệt đối không tô màu thương hiệu lên toàn dòng.
3. **The Focus Separate Rule:** Vòng focus bàn phím dùng token riêng `--qs-focus` (`#7BA2D6` Dark / `#1F406E` Light), tách biệt với nền CTA để luôn đạt tương phản `>= 3:1` (thực tế `> 5.4:1`) trên mọi bề mặt kể cả dòng đang chọn.
4. **Module Indicator & Chart Hierarchy:** Thẻ phân hệ không dùng nền gradient hay màu tím. Biểu đồ QCRM/QTask ưu tiên `--qs-brand` cho giá trị trọng tâm kết hợp các bước xám trung tính hoặc màu ngữ nghĩa đúng ý nghĩa vận hành (không dùng thanh cầu vồng 6 màu vô nghĩa).
5. **Hairline Borders (8–10% Ink):** Viền phân tách cấu trúc là nét mảnh `1px` lấy từ màu chữ chính ở độ mờ `9%` (`--qs-border`), nâng lên `16%` (`--qs-border-strong`) khi hover ô nhập liệu và nút phụ.

### Bảng Token Màu `--qs-*` & Kiểm định Tương phản WCAG 2.1 AA

Mọi cặp chữ/trạng thái bên dưới đã được kiểm định độ tương phản WCAG 2.1 (`>= 4.5:1` cho chữ thường) trên cả nền trang (`bg`), thẻ (`surface-1`), thanh bên (`bg-sidebar`) và **dòng đang chọn (`state-selected`)**. Riêng `--qs-brand` ở chế độ Dark (`#618DC9` trên `--qs-state-selected` `#252B35` đạt `4.18:1`) đạt chuẩn WCAG AA `>= 3:1` cho **chỉ báo đồ họa phi văn bản** (icon `Check`, gạch chân tab đang chọn, dấu hiệu thương hiệu); **chữ** đặt trên dòng đang chọn bắt buộc dùng `--qs-fg`, `--qs-fg-secondary` hoặc `--qs-focus` (`#7BA2D6`, `5.41:1`):

| Vai trò | Biến CSS | Dark (Mặc định) | Light (Cool-Slate) | Tỉ lệ Tương phản Đã kiểm định & Công dụng |
| :--- | :--- | :--- | :--- | :--- |
| Nền trang (60%) | `--qs-bg` | `#111317` | `#F6F8FB` | Nền chính toàn vùng nội dung |
| Thanh bên / Chrome (30%) | `--qs-bg-sidebar` | `#0D0F12` | `#EEF2F6` | Thanh điều hướng `240px`, cột phụ `/login` |
| Bề mặt cấp 1 | `--qs-surface-1` | `#171A20` | `#FFFFFF` | Thẻ, bảng, modal, drawer, menu nổi |
| Bề mặt cấp 2 | `--qs-surface-2` | `#1E222A` | `#F1F4F8` | Ô lồng cấp 2, khối phụ trong thẻ |
| Nền chìm (Input / Keycap) | `--qs-bg-inverse` | `#0B0D10` | `#F1F4F8` | Ô nhập liệu `40–44px`, ô tìm nhanh, `<kbd>` |
| Hover trung tính | `--qs-state-hover` | `#1F242C` | `#EAEFF5` | Hover dòng bảng, item thanh bên, option |
| Chọn trung tính | `--qs-state-selected` | `#252B35` | `#E1E8F0` | Mục điều hướng active, dòng chọn, `Ctrl+K` active |
| Viền cấu trúc mảnh | `--qs-border` | `rgb(238 240 245 / 0.09)` | `rgb(17 24 39 / 0.09)` | Viền `1px` thẻ, bảng, popover, modal |
| Viền nhấn tương tác | `--qs-border-strong` | `rgb(238 240 245 / 0.16)` | `rgb(17 24 39 / 0.16)` | Hover ô nhập liệu, khung công tắc tắt |
| Chữ chính | `--qs-fg` | `#EEF0F5` | `#111827` | Dark `16.31:1` bg / `12.48:1` sel; Light `16.67:1` bg / `14.36:1` sel |
| Chữ cấp 2 | `--qs-fg-secondary` | `#A3A9B8` | `#4B5565` | Dark `7.90:1` bg / `6.05:1` sel; Light `7.08:1` bg / `6.10:1` sel |
| Chữ phụ & Icon | `--qs-fg-muted` | `#8C95AB` | `#596377` | Dark `6.20:1` bg / `4.75:1` sel; Light `5.68:1` bg / `4.89:1` sel |
| Màu nhấn thương hiệu (10%) | `--qs-brand` | `#618DC9` | `#2C568F` | Dark `5.46:1` bg / `5.11:1` s1 / `4.18:1` sel (chỉ báo đồ họa `>= 3:1`, chữ dòng chọn dùng `--qs-fg` hoặc `--qs-focus` `5.41:1`); Light `6.96:1` bg / `7.41:1` s1 / `6.00:1` sel |
| Hover thương hiệu | `--qs-brand-hover` | `#759ED4` | `#234675` | Trạng thái hover của CTA chính |
| Chữ trên nền thương hiệu | `--qs-on-brand` | `#091423` | `#FFFFFF` | Dark `5.42:1` (`6.69:1` hover); Light `7.41:1` (`9.53:1` hover) |
| Vòng Focus | `--qs-focus` | `#7BA2D6` | `#1F406E` | Dark `7.07:1` bg / `5.41:1` sel; Light `9.79:1` bg / `8.43:1` sel |
| Thành công | `--qs-success` | `#4CC38A` | `#157339` | Dark `8.39:1` bg / `6.42:1` sel; Light `5.57:1` bg / `4.80:1` sel |
| Lỗi | `--qs-error` | `#F06469` | `#B91C1C` | Dark `5.96:1` bg / `4.56:1` sel; Light `6.08:1` bg / `5.24:1` sel |
| Nguy hiểm (Nền / Hover) | `--qs-danger` / `--qs-danger-hover` | `#B91C1C` / `#991B1B` | `#B91C1C` / `#991B1B` | Nền nút hành động nguy hiểm (`danger`) |
| Chữ trên nền nguy hiểm | `--qs-on-danger` | `#FFFFFF` | `#FFFFFF` | `6.47:1` trên `--qs-danger`, `8.31:1` trên `--qs-danger-hover` |
| Cảnh báo | `--qs-warning` | `#E5A530` | `#A14808` | Dark `8.64:1` bg / `6.61:1` sel; Light `5.73:1` bg / `4.93:1` sel |
| Thông tin | `--qs-info` | `#6B94CC` | `#2C568F` | Dark `5.96:1` bg / `4.56:1` sel; Light `6.96:1` bg / `6.00:1` sel |
| Màn che nền (Scrim) | `--qs-scrim` | `rgb(8 10 14 / 0.68)` | `rgb(17 24 39 / 0.36)` | Nền mờ sau Modal / Overlay Drawer / `Ctrl+K` |

*Chế độ Tương phản Cao (`tokens.highContrast` trong `packages/ui/src/tokens.ts`):* Giữ nguyên bảng màu tương phản cao (`#000000` bg / `#FFFFFF` fg `21.00:1`, `#759ED4` brand + `#091423` ink `6.69:1`) cho nhu cầu trợ năng.

---

## Typography

Sử dụng ba họ chữ tải qua `next/font/google` (`subsets: ['latin', 'vietnamese']`, `display: 'swap'`) để phân định rõ tiêu đề, giao diện vận hành và số liệu đối chiếu:

- **Tiêu đề & Thương hiệu (`--qs-font-display`):** `Be Vietnam Pro` — chỉ tải weights `400, 500, 600`.
- **Giao diện, Bảng & Biểu mẫu (`--qs-font-sans`):** `IBM Plex Sans` — chỉ tải weights `400, 500, 600`.
- **Mã định danh, Số liệu, Ngày giờ & Keycap (`--qs-font-mono`):** `IBM Plex Mono` — chỉ tải weights `400, 500`, bật `font-variant-numeric: tabular-nums`.

| Cấp chữ | Họ chữ | Kích thước / Chiều cao dòng | Weight | Tracking & Quy tắc |
| :--- | :--- | :--- | :--- | :--- |
| Hero `/login` | `Be Vietnam Pro` | `36–44px` (mobile `28–32px`) / `1.15` | `500` | `-0.025em` |
| `<h1>` Tiêu đề trang | `Be Vietnam Pro` | `26–28px` / `1.2` | `500` | `-0.02em` |
| Số liệu KPI lớn | `Be Vietnam Pro` | `28–32px` / `1.1` | `500` | `tabular-nums`, `-0.02em` |
| `<h2>` Tiêu đề panel / modal | `Be Vietnam Pro` | `16–18px` / `1.35` | `600` | `0` |
| Nội dung, Nav, Bảng, Control | `IBM Plex Sans` | `14px` / `20px` (`1.5` đoạn văn) | `400` / `500` | `0`, ô nhập mobile `<=640px` dùng `16px` chống zoom iOS |
| Nhãn phụ, Breadcrumb, Filter | `IBM Plex Sans` | `13px` / `20px` | `400` / `500` | `0` |
| Meta, Header bảng, Keycap | `IBM Plex Sans` / `Mono` | `12px` / `16px` | `500` | `letter-spacing: 0`–`0.01em`, **sentence case** |

**Quy tắc cấm tuyệt đối về Kiểu chữ:**
- **Cấm** dùng weight `700`–`900` ở mọi nơi (kể cả cấu hình `next/font/google`). Phân cấp đến từ kích thước và màu sắc (`--qs-fg` / `--qs-fg-secondary` / `--qs-fg-muted`), không phải in đậm quá mức.
- **Cấm** `text-transform: uppercase` đi kèm tracking rộng cho tiêu đề cột bảng, nhãn nhóm sidebar hoặc thẻ thống kê — mọi nhãn dùng **sentence case**.
- **Cấm** `font-style: italic` để nhấn mạnh và **cấm** `letter-spacing` âm cho chữ `< 16px` (kể cả tên thương hiệu ở sidebar).
- Tiếng Việt phải hiển thị đầy đủ dấu ở mọi cấp, kể cả `aria-label`, `placeholder` và `title`.

---

## Layout

- **Thang khoảng cách 4px (`--qs-space-*`):** `4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64px`. Trong cùng nhóm dùng `8–12px`, giữa các nhóm dùng `20–24px`, lề trang `24px` (`16px` trên `< 640px`). Nghiêm cấm các giá trị lẻ lệch lưới `4px` (`6px`, `10px`, `13px`, `14px`, `19px`, `57px`, `66px`), **trừ hai ngoại lệ hình học có chủ đích**:
  1. `width: 390px` cho panel chi tiết `ResponsiveDetailDrawer` (kế thừa tỉ lệ chuẩn từ `docs/design/references/`).
  2. `top: 6px` trên nút mở điều hướng di động `.qs-shell__nav-toggle` (`<= 640px`), nhằm căn giữa dọc chính xác nút `44px` trong topbar `56px` (`(56 - 44) / 2 = 6px`).
- **Khung Shell cố định:**
  - Sidebar trái: `240px` cố định (padding `16px 12px`; mỗi hàng điều hướng cao `36px`, khoảng cách `4px`; tiêu đề nhóm cách trên `24px`, cách dưới `8px`).
  - Topbar trên cùng: `56px` dính trên (`position: sticky; top: 0`), padding `0 24px` (`0 12px` ở mobile).
  - Vùng nội dung chính (`.qs-shell__content`): `padding: 24px`, giới hạn độ rộng tối đa `1440px`–`1536px` (`1600px` ở `>= 1920px`), `margin-inline: auto` để màn hình siêu rộng không kéo dãn quá mức.
- **Chiều cao điều khiển & hàng chuẩn:** `32px` (nút đóng/tiện ích nhỏ), `36px` (`sm` & hàng nav), `40px` (`md` input/select/button mặc định & header bảng), `44px` (hàng bảng dữ liệu, `lg` trên `/login`, vùng chạm tối thiểu trên mobile `<= 640px`).
- **Ngăn tràn ngang & 5 Breakpoint:** Áp dụng `overflow-x: clip` ở mức gốc; kiểm thử xuyên suốt:
  1. Mobile hẹp (`320px–640px`, mục tiêu `320x568` & `375x812`): ô nhập liệu `16px`, vùng chạm `>= 44x44px`, bảng nhiều cột chuyển thành thẻ hoặc cuộn ngang có kiểm soát không làm tràn `window.innerWidth`.
  2. Tablet (`641px–1023px`, mục tiêu `768x1024`): sidebar thu thành drawer nổi với `useFloatingLayer`.
  3. Desktop gọn (`1024px–1279px`): sidebar hiện cố định; panel chi tiết dùng overlay drawer có backdrop để không bóp cột tên việc.
  4. Desktop tiêu chuẩn (`1280px–1919px`, mục tiêu `1280x800` & `1440x900`): mở `ResponsiveDetailDrawer` song song `390px` bên phải.
  5. Màn hình siêu rộng (`>= 1920px`, mục tiêu `1920x1080`): giữ `max-width` nội dung `1440px–1600px` cân đối.

---

## Elevation & Depth

**The Floating-Only Shadow Rule:** Bảng, thẻ thống kê, khối tổng quan và sidebar/topbar tĩnh **không đổ bóng** (`box-shadow: none`); phân tách lớp bằng bước màu nền và viền mảnh `1px solid var(--qs-border)`.

Chỉ các **tầng nổi** mới dùng bóng đổ `--qs-shadow-floating` kết hợp viền mảnh `1px solid var(--qs-border)`:
- **Dark:** `0 12px 32px rgb(0 0 0 / 0.40)`
- **Light:** `0 8px 24px rgb(17 24 39 / 0.08)`
- **Viền sáng xúc giác trên cùng (Tactile Top Highlight):** `--qs-highlight-top` (`inset 0 1px 0 rgb(255 255 255 / 0.12)` Dark / `rgb(255 255 255 / 0.65)` Light) áp dụng tinh tế trên nút `primary`, `secondary`, `danger` lấy cảm hứng từ Uiverse `#minimal`.

---

## Shapes & Icons

- **Hệ thống Bo góc Lồng nhau (Nested Radii):** `inner = outer - padding >= 4px`
  - `--qs-radius-sm` / `--qs-radius-keycap`: `4px` (keycap `<kbd>`, nút đóng nhỏ, huy hiệu tối giản)
  - `--qs-radius-control`: `8px` (nút bấm, ô nhập, `<Select>` trigger, dòng tùy chọn trong menu, mục `Ctrl+K`, toast)
  - `--qs-radius-card`: `12px` (thẻ nội dung, bảng, `<Select>` menu `padding: 4px` chứa option `8px`, `ModuleSwitcher` menu, `FilterPopover`, `Drawer`)
  - `--qs-radius-panel`: `16px` (`Modal`, `CommandPalette`, thẻ form `/login`)
- **Icon (`lucide-react`):**
  - Duy nhất bộ icon `lucide-react` với `strokeWidth={1.5}` đồng nhất trên toàn ứng dụng.
  - Kích thước: `18px` cho sidebar/topbar/drawer close, `16px` cho nút, bảng, ô nhập, menu `<Select>`, nút đóng modal/toast.
  - Khung icon cố định `20x20px` với khoảng cách chữ `8px` để các cột chữ luôn thẳng hàng; màu kế thừa `--qs-fg-muted` hoặc `--qs-fg-secondary`.
  - **Cấm tuyệt đối** emoji làm icon, badge trang trí hoặc tiêu đề thẻ.

---

## Motion

- **Một đường cong chuyển động duy nhất:** `--qs-ease: cubic-bezier(0.22, 1, 0.36, 1)`.
- **Ba mốc thời gian:** `150ms` (`--qs-duration-fast` cho hover, nhấn nút, gạt công tắc, xoay chevron), `180ms` (`--qs-duration-menu` cho popover/select), `300ms` (`--qs-duration-overlay` cho modal/drawer).
- **Kỷ luật thuộc tính:** Chỉ chuyển động `background-color`, `border-color`, `color`, `opacity` và `transform`. **Cấm** `transition: all`, **cấm** `animate.css`, **cấm** animation lặp vô nghĩa và **cấm** phóng to/thu nhỏ `scale()` khi hover hay bấm nút (nhấn nút dùng `transform: translateY(1px)`).
- **Trợ năng chuyển động:** Mọi transition và animation (kể cả spinner & skeleton pulse) phải được tắt trong `@media (prefers-reduced-motion: reduce)`.

---

## Components (Công thức Uiverse `#minimal` & Land-book)

1. **Button (`.qs-btn`, Uiverse `#minimal` tactile):**
   - Biến thể: `primary` (`--qs-brand` + `--qs-on-brand` + `--qs-highlight-top`), `secondary` (`--qs-surface-1` + `1px solid var(--qs-border)` + `--qs-highlight-top`), `ghost`, `danger` (`--qs-danger` + `--qs-on-danger`).
   - Kích thước: `sm` (`36px`, `padding: 0 12px`), `md` (`40px`, `padding: 0 16px`), `lg` (`44px`, `padding: 0 20px`); bo góc `8px`; weight `500`.
   - Phản hồi nhấn: `:not(:disabled):active { transform: translateY(1px); }` (tuyệt đối không dùng `scale()`). Loading dùng `.qs-btn__spinner` `16px` + `aria-busy="true"`.
2. **Sliding Toggle Switch (`.qs-switch`, Uiverse `#minimal` pure CSS):**
   - Dùng cho các tùy chọn bật/tắt tại `/account` và `/notifications`.
   - Đường ray `44x24px` (`border-radius: 12px`, nền `--qs-bg-inverse` + viền `1px solid var(--qs-border-strong)` khi tắt -> `--qs-brand` khi bật), núm gạt `16x16px` (`border-radius: 8px`, dịch chuyển `translateX(20px)` trong `150ms var(--qs-ease)`), vòng `:focus-visible` `2px solid var(--qs-focus)`.
3. **Custom `<Select>` (`packages/ui/src/select.tsx`):**
   - Trigger `36/40/44px` (`padding: 0 12px` cho sm/md, `0 16px` cho lg), nền `--qs-bg-inverse`, bo góc `8px`, icon `ChevronDown` `16px` xoay `180deg` trong `150ms`.
   - Menu portal vào `document.body` với `z-index: 160` (cao hơn mọi modal/drawer nội bộ `45–100`, dưới `Ctrl+K` `200`), bo góc `12px`, `padding: 4px`, `gap: 4px`, `max-height: 280px`, bóng `--qs-shadow-floating`.
   - Mỗi tùy chọn `padding: 8px 12px`, bo góc `8px` (`12 - 4`), icon `Check` `16px` màu `--qs-brand`.
   - Tích hợp `useFloatingLayer` (cách ly `Esc` không làm đóng Modal/Popover cha) và tìm kiếm gõ nhanh chuẩn hóa dấu tiếng Việt (`typeahead`, bỏ qua IME composing và phím tổ hợp).
4. **Input & FormField (`.qs-input`, `.qs-field`):**
   - Nhãn `14px` weight `500` màu `--qs-fg-secondary`, khoảng cách `.qs-field` `8px`.
   - Ô nhập `40px` (`44px` `lg`), nền `--qs-bg-inverse`, viền `1px solid var(--qs-border)`, hover `--qs-border-strong`, focus `--qs-focus`, bo góc `8px`. Mobile `<= 640px` dùng `font-size: 16px`.
5. **Table & DataTable (`.qs-table`):**
   - Header cao `40px`, chữ `12px` **sentence case** (`text-transform: none; letter-spacing: normal;`), màu `--qs-fg-muted`, nút sắp xếp hiển thị icon `ArrowUp` / `ArrowDown` / `ArrowUpDown` `16px` `strokeWidth={1.5}` trong khi `aria-sort` đặt trên `<th>`.
   - Hàng `44px`, viền dưới `1px solid var(--qs-border)`, bật `tabular-nums`, `:focus-visible` `outline: 2px solid var(--qs-focus); outline-offset: -2px;`, điều hướng `ArrowUp/Down` + `J/K` (bỏ qua khi đang nhập liệu) và `Enter/Space`.
6. **Modal & Toast:**
   - **Modal:** Overlay `--qs-scrim` (`z-index: 50`), hộp thoại `position: relative`, `max-width: 32rem`, bo góc `16px`, `padding: 24px`, bóng `--qs-shadow-floating`, tiêu đề chừa `padding-right: 40px` (`48px` trên mobile) cho nút đóng `.qs-modal__close` (`32x32px` desktop, `44x44px` mobile) dùng icon `<X size={16} strokeWidth={1.5} />`.
   - **Toast:** Region `pointer-events: none` (`z-index: 220`, nằm trên `Ctrl+K`), thẻ `.qs-toast` `pointer-events: auto`, viền `1px solid var(--qs-border)`, bo góc `8px`, `padding: 12px`, bóng `--qs-shadow-floating` + sọc trạng thái `3px` bên trong, nút đóng `.qs-toast__close` dùng `<X size={16} strokeWidth={1.5} />`.
7. **CommandPalette (`Ctrl+K`):**
   - Overlay `z-index: 200` (trên `<Select>` `160` và Modal `50`), panel rộng `640px`, bo góc `16px`, viền `1px solid var(--qs-border)`, bóng `--qs-shadow-floating`, ô tìm `44px`, nhóm `Đi tới`, `Chuyển ứng dụng`, `Thao tác nhanh` không đánh số, dòng kết quả `40px` bo góc `8px`, bỏ qua IME composing.
8. **StateRegion:** 4 trạng thái chuẩn (`loading` với skeleton pulse `1200ms var(--qs-ease)` giảm dần độ mờ `1 -> 0.65`, `empty` hướng dẫn cụ thể, `error` kèm nút `Thử lại`, `ready`).

---

## Bảy Nguyên lý UI/UX Cốt lõi

1. **Phân cấp trực quan rõ ràng:** Tối đa 3 cấp chữ, phân biệt bằng kích thước và độ tương phản màu; **duy nhất 1 nút CTA chính Steel-Cobalt mỗi màn hình**; hành động phụ dùng `secondary`/`ghost`.
2. **Bố cục, Căn lề & Lưới 4px:** Mọi padding, gap, height nằm trên bội số `4px`; cột tiêu đề bảng và dữ liệu căn thẳng trục dọc.
3. **Phối màu 60–30–10 & Tương phản WCAG AA (`>= 4.5:1`):** 60% nền trang, 30% chrome tĩnh viền `1px`, 10% điểm nhấn Steel-Cobalt + màu ngữ nghĩa có kiểm định cả trên dòng đang chọn.
4. **Kiểu chữ ba lớp nhất quán:** `Be Vietnam Pro` (tiêu đề/KPI) + `IBM Plex Sans` (nội dung/bảng) + `IBM Plex Mono` (`tabular-nums` cho mã, số, ngày giờ, keycap); weight chỉ `400/500/600`, không chữ hoa tracking rộng.
5. **Bo góc lồng nhau & Tầng nổi tối giản:** `4/8/12/16px` tuân thủ `inner = outer - padding >= 4`; chỉ tầng nổi có `--qs-shadow-floating`; icon `lucide-react` `16/18px` `strokeWidth={1.5}`.
6. **Tối giản loại bỏ chi tiết thừa:** Tab gạch chân tối giản thay hộp viền; thẻ KPI gọn nhẹ (nhãn + con số + so sánh cụ thể, không sparkline hay icon trang trí); `Ctrl+K` không đánh số `1, 2, 3`; `/login` không gắn mockup 3D hay nền mờ ảnh.
7. **Phản hồi xúc giác & Bàn phím trước:** Chuyển tiếp từng thuộc tính bằng `--qs-ease` (`150/180/300ms`), `:active` `translateY(1px)`, `:focus-visible` rõ nét, `Esc` đóng đúng tầng trên cùng, tôn trọng `prefers-reduced-motion`.

---

## Giải phẫu Màn hình Chuẩn

### A. Shell Hợp nhất (`UnifiedShell` & `AppWorkspaceShell`)
- **Sidebar (`240px`):** Hàng thương hiệu dùng logo `apps/web/public/qts-logo.png` (kèm ô chữ `Q` nền `--qs-brand` khi ảnh lỗi) + chữ `QSystem` (không tracking âm) -> `ModuleSwitcher` (`QTask`, `QHRM`, `QCRM`, `QSocial`) -> các mục điều hướng theo phân hệ.
- **Topbar (`56px`):** Trái breadcrumb -> giữa nút mở tìm nhanh `Ctrl K` (rút gọn thành nút icon `44x44px` trên `<= 640px`) -> phải 3 tác vụ cố định: `Sáng/Tối`, `Thông báo`, `Tài khoản`.

### B. Phân hệ `QTask` (`/`, `/tasks`, `/projects`)
- **Tổng quan (`/`):** Hàng 3–4 thẻ KPI nhỏ đồng đều chiều cao (nhãn + số `tabular-nums` `28px` + so sánh rõ mốc, không icon góc/sparkline) phía trên bố cục bất đối xứng 2/3 biểu đồ chính + 1/3 danh sách việc ưu tiên/quá hạn.
- **Bảng công việc (`/tasks`):** `<h1>Công việc</h1>` + 1 nút `+ Giao việc` (`primary`); thanh underline tabs `Tất cả · Của tôi · Quá hạn` + `FilterPopover`; bảng hàng `44px`, ở mobile chuyển thẻ gọn; `ResponsiveDetailDrawer` (`390px` inline ở `>= 1280px`, overlay ở `< 1280px`) với `AttributeRowList` và nút phụ `Hoàn thành việc`.

### C. Phân hệ `QHRM` (`/org`) + `Ctrl+K`
- Danh bạ, Phòng ban, Chấm công, Nghỉ phép giữ bố cục lọc phòng ban + bảng dữ liệu sạch (`sentence case`), sửa mọi cắt xén menu thao tác dòng (`overflow`), chuẩn hóa avatar trung tính (không dùng màu cầu vồng ngẫu nhiên), giữ nguyên phân quyền `Giám đốc / Quản lý / Nhân viên` ở UI.
- `Ctrl+K`: `640px`, input `44–48px`, nhóm không đánh số, chọn trung tính.

### D. Trang Đăng nhập (`/login` — Editorial Split theo Land-book & `03-login-dark.jpg`)
- **Cột trái (`--qs-bg-sidebar`):** Phẳng, tĩnh, không ảnh nền mờ và không mockup 3D nghiêng; gồm logo QTS + `QSystem`, câu mô tả ngắn tiếng Việt tự nhiên và chỉ mục 4 phân hệ gọn nhẹ.
- **Cột phải:** Thẻ `--qs-surface-1` rộng ~`400px` (`padding: 32px`, `border-radius: 16px`, `border: 1px solid var(--qs-border)`), `<h1>Đăng nhập</h1>`, ô nhập `44px`, 1 CTA chính `Đăng nhập` toàn chiều rộng, các nút đăng nhập phụ (`secondary`), liên kết hỗ trợ và nút chuyển Sáng/Tối ở góc trên.

### E. Phân hệ `QCRM` (`/crm`)
- Thiết lập thứ bậc thị giác rõ ràng: 1 biểu đồ/funnel chính bằng `--qs-brand` kết hợp các bậc trung tính (bỏ thanh cầu vồng 6 màu vô nghĩa) đứng cạnh danh sách/bảng chi tiết khách hàng, cơ hội bán hàng, liên hệ và báo cáo; đảm bảo bảng nhiều cột đáp ứng tốt trên tablet/mobile.

### F. Phân hệ `QSocial` (`/social`)
- Lưới 3 cột desktop (`220px / 1fr / 280px`) thu gọn tuần tự trên tablet/mobile; thay thẻ hero gradient + chữ tiếng Anh khẩu hiệu bằng thẻ ghim thông báo `--qs-surface-1` (`border-radius: 12px`, `border: 1px solid var(--qs-border)`, vạch nhấn trái `3px solid var(--qs-brand)`), giữ toàn bộ tương tác đăng bài/bình luận bằng tiếng Việt tự nhiên.

### G. Các Trang Dùng chung (`/account`, `/files`, `/notifications`)
- Sử dụng đồng bộ `--qs-*`, công tắc gạt `.qs-switch`, `Modal` / `useFloatingLayer` của `@qsystem/ui`, không hardcode chuỗi đếm giả, và bọc hàng tiêu đề/nội dung gọn trên `320px`.

---

## Quy chuẩn Tiếng Việt cho Người vận hành (Kế thừa `PRODUCT.md`)

Mọi nhãn nút, tiêu đề cột, thông báo lỗi, bộ lọc và hộp thoại trên UI phải dùng tiếng Việt tự nhiên cho người vận hành cuối. **Cấm tuyệt đối** lộ thuật ngữ kỹ thuật hay tên schema API lên màn hình:

- **Công việc:** dùng `Tên công việc`, `Mã việc` (`CV-xxxx`), `Phụ trách` (họ tên đầy đủ để phân biệt người trùng tên), `Thời hạn`, `Phòng ban`, `Trạng thái` (`Đang làm`, `Chờ duyệt`, `Quá hạn`, `Hoàn thành`), `Trao đổi`, `Tệp đính kèm`.
  - **Cấm:** `4W`, `WHO/WHAT/WHEN/WHERE`, `Audit trail`, `QT-`.
- **Nhân sự & Phân quyền:** dùng `Giám đốc`, `Quản lý`, `Nhân viên`, `Quản lý trực tiếp`, `Tình trạng` (`Đang làm việc`, `Tạm nghỉ`).
  - **Cấm:** `DIRECTOR`, `MANAGER`, `EMPLOYEE`, `/org`.
- **Thông báo & Tài liệu & Lỗi API:** dùng `Chờ gửi`, `Đã gửi`, `Gửi lỗi`, `Tài liệu PDF`, `Bảng tính`, thông điệp lỗi dễ hiểu kèm hướng xử lý.
  - **Cấm:** `PENDING`, `SENT`, `FAILED`, `DEAD`, `Presign`, `API_TIMEOUT`, raw MIME types.
- **Kỷ luật câu chữ `unslop`:** Không dùng dấu chấm than (`!` / `!!`), không tiêu đề chào hỏi (`"Chào mừng trở lại"`, `"Xin chào..."`), không dấu chấm cuối ở nhãn ngắn/tiêu đề/nút, không tuyên bố chưa kiểm chứng.

---

## Cổng Kiểm duyệt `unslop` & Responsive QA

Trước khi xác nhận hoàn tất giao diện ở bất kỳ mốc nào:

1. **Checklist `unslop` (17/17 mục):** Lưới `4px` nhất quán; 3 vai trò chữ + 1 accent Steel-Cobalt; không gradient/glow/blob/màu tím; không emoji; duy nhất `lucide-react` `16/18px` `strokeWidth={1.5}`; weight `400–600` (không `700+`), sentence case ở mọi nhãn/cột; `tabular-nums` cho mọi mã/số; bo góc lồng nhau hợp lệ; 1 đường cong `--qs-ease`; trạng thái hover/active/focus-visible/disabled/loading/error đầy đủ.
2. **Typecheck & Unit Test:** `corepack pnpm --filter @qsystem/ui test`, `corepack pnpm --filter @qsystem/ui typecheck`, `corepack pnpm --filter web typecheck`, `corepack pnpm --filter web test` đều phải thoát với mã `0`.
3. **Playwright 6-Viewport & Dual-Theme QA:** Kiểm tra cả Dark (`#111317`) và Light (`#F6F8FB`) ở `320x568`, `375x812`, `768x1024`, `1280x800`, `1440x900`, `1920x1080` với dữ liệu tiếng Việt đầy dấu: `scrollWidth <= innerWidth`, không lỗi console/runtime, không phần tử che khuất hay cắt xén.

---

## Do's and Don'ts

- **DO** dùng duy nhất hệ token `--qs-*` trong `@qsystem/ui/styles.css` và `tokens.ts` cho cả hai chế độ; không hardcode hex ngoài token.
- **DO** đặt duy nhất 1 CTA chính Steel-Cobalt mỗi màn hình; dùng `secondary`/`ghost` cho các hành động còn lại.
- **DO** chuyển tiếp từng thuộc tính bằng `var(--qs-ease)` (`150ms / 180ms / 300ms`) và tôn trọng `prefers-reduced-motion: reduce`.
- **DO** giữ 100% tiếng Việt tự nhiên cho người vận hành; bảo toàn toàn bộ route, query param, `localStorage` và chữ ký export của `@qsystem/ui`.
- **DON'T** dùng `transition: all`, `animate.css`, `backdrop-filter` glass card, `scale()` phóng to/thu nhỏ, bóng đổ cho bảng/card tĩnh, gradient màu hoặc màu tím trang trí.
- **DON'T** dùng font weight `700`–`900`, uppercase tracking rộng, emoji, dấu chấm than `!`, đóng hộp tab lọc, đánh số `1-2-3` trong `Ctrl+K`, hay gắn mockup 3D/thống kê phụ vào `/login`.
- **DON'T** quay lại bảng màu hổ phách, giấy ấm hoặc bộ biến `--qx-*` đã loại bỏ.
