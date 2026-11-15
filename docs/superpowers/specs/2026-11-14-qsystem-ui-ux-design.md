# Đặc tả Thiết kế UI/UX QSystem — Giao diện Hợp nhất

- **Ngày:** 2026-11-14
- **Trạng thái:** Đã hoàn thiện theo phản hồi thiết kế chi tiết (Chờ duyệt để lập bộ Task `writing-plans` & Harness Tasks JSON)
- **Phạm vi:** Chuẩn hóa `PRODUCT.md` & `DESIGN.md`, vá lỗi & nâng cấp `packages/ui`, xây dựng `apps/web` (`Đăng nhập`, `Shell hợp nhất`, `QTask — Công việc`, `QHRM — Nhân sự & Phòng ban`, `Tài liệu & Tìm kiếm Ctrl+K`, `Thông báo`, `Tài khoản`) khớp API sẵn có trong `apps/api`.
- **Thay thế:** Cập nhật toàn diện phần thiết kế UI trong [2026-11-11-qsystem-shell-design.md](docs/superpowers/specs/2026-11-11-qsystem-shell-design.md).

---

## 1. Tài liệu & Ảnh mẫu Chuẩn trong Repo (Cross-CLI / IDE)

Toàn bộ ảnh mẫu và prototype đã được đưa vào thư mục repo để mọi AI CLI/IDE (`Claude Code`, `Codex`, `Gemini CLI`, `Cursor`, `Antigravity`, `Copilot`, `Harness`) đọc đồng nhất:

- **Tài liệu chuẩn gốc:** [PRODUCT.md](PRODUCT.md) · [DESIGN.md](DESIGN.md) · [Hướng dẫn đọc mẫu](docs/design/references/README.md)
- **Interactive HTML Prototype (đã pass `sloplint --scope app --genre modern-minimal`: `0 FAIL, 0 REFLEX, 0 WARN`):**
  - [qsystem-console-prototype.html](docs/design/references/qsystem-console-prototype.html)
- **Visual Mockups đồng nhất thương hiệu `Q + QSystem`:**
  - `QTask` (Giao diện tối mặc định — Bảng rộng + Panel chi tiết có nút đóng, thuộc tính 1 cột nhãn-giá trị, tab gạch chân `Tất cả · Của tôi · Quá hạn`, `Trao đổi / Tệp đính kèm`): [01-qtask-dark.jpg](docs/design/references/01-qtask-dark.jpg)
  - `QHRM` (Giao diện sáng Warm Paper + `Ctrl+K` 640px nổi nhẹ, không đánh số 1-2-3): [02-qhrm-light-cmdk.jpg](docs/design/references/02-qhrm-light-cmdk.jpg)
  - `Đăng nhập` (Giao diện tối tập trung 1 điểm nhấn, bỏ bảng phụ): [03-login-dark.jpg](docs/design/references/03-login-dark.jpg)

---

## 2. Quy chuẩn Thương hiệu, 7 Nguyên lý Cốt lõi & Hệ thống Thông số (`DESIGN.md` Contract)

### 2.0 Bảy Nguyên lý Thiết kế & Kiểm duyệt Bắt buộc (Core UX Principles)
Mọi màn hình, component và task cài đặt đều phải thỏa mãn đồng thời 7 chuẩn sau:
1. **Phân cấp trực quan rõ ràng (Visual Hierarchy):** Thang kích thước rõ rệt (`26–28px` tiêu đề trang > `16–18px` tiêu đề khu vực > `14px` nội dung/bảng/biểu mẫu > `12–13px` metadata); mỗi màn hình chỉ có **duy nhất 1 nút CTA chính màu hổ phách (`+ Giao việc`, `Đăng nhập`, `+ Thêm nhân sự`)** nổi bật hơn hẳn các nút phụ (*Hoàn thành việc*, *Bộ lọc*, *Hủy*).
2. **Bố cục, Căn lề & Khoảng trắng (Alignment & Whitespace):** Tuân thủ lưới bước `4 / 8 / 12 / 16 / 24 / 32px` (trong nhóm `8–12px`, giữa nhóm `20–24px`); tiêu đề cột và dữ liệu bảng căn thẳng trục dọc; chừa khoảng trắng đủ thoáng (`24px` gutter, hàng bảng `44–48px`, không nhồi nhét card chồng lên card).
3. **Phối màu 60–30–10 & Tương phản WCAG `>= 4.5:1`:**
   - `60%` nền tổng thể (`#111418` Tối / `#FAF8F4` Sáng).
   - `30%` bề mặt cấu trúc (`#191D23` Tối / `#F4F1EA` + `#FFFFFF` Sáng), viền phân cách mảnh và trạng thái chọn trung tính.
   - `10%` điểm nhấn (`#E8AD45` CHỈ cho logo `Q` và CTA chính + xanh/đỏ trạng thái đặc biệt). Kiểm tra độ tương phản chữ/nền `>= 4.5:1` và vòng focus `>= 3:1` trên cả 2 chế độ.
4. **Kiểu chữ nhất quán (Single UI Typeface):** Dùng **1 font duy nhất `Inter`** (hỗ trợ đầy đủ tiếng Việt, bật `tabular-nums` cho mã việc/ngày giờ/số lượng) trên toàn bộ giao diện để đạt sự gọn gàng tối đa; tối ưu khả năng đọc từ màn hình desktop rộng tới di động (`14px` body, `line-height 1.5`, ô nhập `>= 16px` trên mobile nếu cần tránh zoom).
5. **Nhất quán xuyên suốt (Design System Consistency):** Đồng bộ `border-radius` (`6px` nút/input/chip/dòng, `8px` panel/modal), bộ icon (`Lucide 18px/16px`, stroke `1.5`), bóng đổ (chỉ áp dụng cho tầng nổi `Ctrl+K`, menu dropdown, popover, overlay drawer) và màu highlight trung tính đồng nhất ở sidebar, bảng lẫn `Ctrl+K`.
6. **Tối giản loại bỏ chi tiết thừa (Less is More):** Lược bỏ hoàn toàn khung viền lồng nhau (dùng tab gạch chân tối giản thay vì hộp viền lồng hộp cho *Tất cả / Của tôi / Quá hạn*), bỏ bảng thống kê/phụ thừa ở Đăng nhập và QTask, bỏ số thứ tự `1-2-3` trong `Ctrl+K`.
7. **Tính tương phản & Phản hồi tức thì (Tactile Feedback & Micro-interactions):** Mọi thao tác đều có phản hồi rõ ràng — hover `150ms`, nhấn `:active` (`translateY(1px)`), vòng focus rõ ràng `:focus-visible`, loading spinner trên nút khi gửi API, `Skeleton` đúng hình dáng bảng khi tải, và `Toast` xác nhận không che khuất nội dung sau khi tạo/cập nhật công việc.

### 2.1 Thống nhất thành MỘT sản phẩm (Brand & Navigation Unification)
- **Thương hiệu:** Luôn dùng chung **logo chữ `Q` màu hổ phách (`#E8AD45` chữ `#201708`) + tên `QSystem`** ở **cả trang Đăng nhập lẫn đầu thanh bên**. Không dùng icon phụ hay tên phân hệ đè lên góc thương hiệu.
- **Bộ chọn ứng dụng (`ModuleSwitcher`):** Đặt ngay dưới thương hiệu (VD: `QTask ▾`). Bấm vào mở menu liệt kê **4 phân hệ (`QTask`, `QHRM`, `QCRM`, `QSocial`)**, mỗi mục gồm *biểu tượng line 18px, tên, và 1 dòng mô tả ngắn*.
- **Thanh bên theo ngữ cảnh (`Contextual Sidebar`, rộng `240px`):** Chỉ hiện các mục thuộc phân hệ đang mở:
  - Khi ở `QTask`: *Tất cả công việc*, *Công việc của tôi*, *Dự án*.
  - Khi ở `QHRM`: *Danh bạ nhân sự*, *Phòng ban*, *Chấm công*.
  - Khi ở `QCRM` / `QSocial`: *Khách hàng*, *Hợp đồng* / *Bảng tin nội bộ* (trang đặt chỗ rõ ràng).
- **Thanh trên cố định (`Fixed Top Bar`, cao `56px`):** Giữ nguyên vị trí tại mọi phân hệ theo thứ tự:
  - Trái: Đường dẫn trang (*Breadcrumb*, VD `QTask / Tất cả công việc` hoặc `QHRM / Danh bạ nhân sự`).
  - Giữa: Ô mở tìm kiếm toàn hệ thống (`Tìm việc, nhân sự, tài liệu…` + phím tắt `Ctrl K`).
  - Phải (vị trí cố định): Nút **Sáng/Tối** · Chuông **Thông báo** (Popover + trang `/notifications`) · **Tài khoản** (Hồ sơ, đổi mật khẩu, đăng xuất, truy cập Tài liệu).

### 2.2 Typography, Khoảng cách & Kích thước (Mốc kiểm duyệt trình duyệt 100%)
- **Font:** Duy nhất **`Inter`** (`400, 500, 600` — đã xác minh Google Fonts CSS hỗ trợ đầy đủ tập `vietnamese`, kèm bật `font-variant-numeric: tabular-nums` cho mã việc, thời gian và số lượng; kiểm tra trực quan chuỗi *"Nguyễn Minh Tuấn, Trễ hạn, Tổ chức & Nhân sự"*). Ghi nhận `font: Inter (by user request)` trong Hallmark stamp.
- **Cỡ chữ:**
  - Tiêu đề trang (`<h1>`): `26–28px` (medium `500`, tracking `-0.02em`)
  - Tiêu đề khu vực / panel (`<h2>`): `16–18px`
  - Bảng & biểu mẫu: `14px` (dữ liệu số dùng `font-variant-numeric: tabular-nums`)
  - Metadata, nhãn bộ lọc, timestamp: `12–13px`
- **Thang khoảng cách:** `4 / 8 / 12 / 16 / 24 / 32px` (trong một nhóm `8–12px`, giữa các nhóm `20–24px`).
- **Kích thước tương tác:** Hàng bảng `44–48px`, ô nhập & nút chính `40–44px`, bo góc `6–8px`.
- **Phân tầng đổ bóng:** Không đổ bóng cho card/bảng/panel tĩnh; **chỉ dùng bóng đổ rõ cho thành phần nổi** (`Ctrl+K` dialog, dropdown chuyển phân hệ, popover thông báo, ngăn chi tiết dạng overlay).

### 2.3 Bảng Màu Tối (`Dark` mặc định) & Sáng (`Light` toggle) — `tokens.ts`
Quy tắc phân vai màu nghiêm ngặt: **Vàng hổ phách (`#E8AD45`) CHỈ dùng cho biểu tượng chữ `Q` và nút hành động chính duy nhất trên trang**. Mục đang chọn trên thanh bên, bảng, và hộp `Ctrl+K` đều dùng **nền trung tính đồng nhất**. Đỏ chỉ dành cho *Quá hạn / Lỗi*, Xanh lá chỉ dành cho *Hoàn thành / Đang làm việc*.

| Vai trò Token | Giao diện Tối (Mặc định) | Giao diện Sáng (Toggle) | High Contrast | Ghi chú kiểm tra tương phản |
| :--- | :--- | :--- | :--- | :--- |
| Nền trang (`bg.base`) | `#111418` | `#FAF8F4` | `#000000` | Bề mặt nền tổng thể |
| Thanh bên (`bg.sidebar`) | `#191D23` | `#F4F1EA` *(Warm Paper)* | `#0F1115` | Thanh điều hướng 240px |
| Bề mặt bảng/card/form (`surface.1`) | `#191D23` | `#FFFFFF` | `#0F1115` | Tránh bóng đổ ở nền tĩnh |
| Vùng chìm / input (`bg.inverse`) | `#0D1014` | `#F3F0E8` | `#181B22` | Ô nhập `40–44px` |
| Trạng thái Hover / Selected trung tính | `#222731` / `#252B36` | `#EFECE4` / `#E8E4DA` | `#27272A` | Dùng chung cho bảng, thanh bên & `Ctrl+K` |
| Viền (`border.base`) | `#30363D` | `#DEDAD0` | `#71717A` | Viền mảnh `1px` |
| Chữ chính (`fg.base`) | `#F3F4F6` | `#18181B` | `#FFFFFF` | Tương phản chữ >= `12:1` |
| Chữ phụ (`fg.muted`) | `#9CA3AF` | `#52525B` | `#D4D4D8` | Mã việc, metadata (>= `4.6:1`) |
| Hổ phách chính (`brand.primary`) | `#E8AD45` | `#E8AD45` | `#F59E0B` | **Chỉ** logo `Q` + nút chính |
| Chữ trên nút hổ phách (`brand.primaryInk`) | `#201708` | `#201708` | `#000000` | Tương phản nút `> 7.5:1` cả 2 chế độ |
| Quá hạn / Lỗi (`accent.red`) | `#F85149` | `#B91C1C` | `#EF4444` | Chỉ báo trễ hạn / lỗi |
| Hoàn thành / Hoạt động (`accent.green`) | `#3FB950` | `#15803D` | `#22C55E` | Chỉ báo hoàn tất / đang làm việc |

### 2.4 Quy tắc Ngôn ngữ cho Người dùng (Human-First UI Copy Mandate)
**Cấm tuyệt đối** hiển thị thuật ngữ lập trình hay cấu trúc API nội bộ lên UI:
- *Công việc:* dùng **Tên công việc, Mã việc (`CV-xxxx`), Phụ trách (họ tên đầy đủ để phân biệt), Thời hạn, Phòng ban, Trạng thái (`Đang làm / Chờ duyệt / Quá hạn / Hoàn thành`), Trao đổi, Tệp đính kèm** — KHÔNG dùng `4W`, `WHO/WHAT/WHEN/WHERE`, `Audit trail`, `QT-`.
- *Vai trò & Thông báo:* dùng **Giám đốc / Quản lý / Nhân viên**, **Chờ gửi / Đã gửi / Gửi lỗi**, **Tài liệu PDF / Bảng tính** — KHÔNG dùng `DIRECTOR/MANAGER/EMPLOYEE`, `PENDING/SENT/FAILED/DEAD`, `Presign`, `API_TIMEOUT`, MIME type hay đường dẫn route như `/org`.

---

## 3. Chi tiết Cấu trúc Từng Màn hình & Nâng cấp Code

### 3.1 `QTask` — Dành diện tích cho tên việc & Panel chi tiết linh hoạt (`/`, `/tasks`)
- **Đầu trang:** Trái là tiêu đề `Công việc` (`26–28px`), phải là nút chính duy nhất `+ Giao việc` (hổ phách `#E8AD45`, chữ `#201708`).
- **Thanh ngay trên bảng:**
  - Trái: Đúng 3 chế độ xem **`Tất cả · Của tôi · Quá hạn`** (đồng bộ URL query `?view=`). Không lặp chữ `Quá hạn/Trễ hạn` ở dải thống kê khác và **bỏ các con số đếm nhân sự không giúp lọc việc**.
  - Phải: Gom `Trạng thái`, `Phòng ban`, `Người phụ trách` vào 1 menu **`Bộ lọc`**.
- **Bảng công việc (`44–48px` / hàng):**
  - Cột `Tên công việc` chiếm độ rộng lớn nhất để hiển thị 1 dòng rõ ràng; `Mã` căn thẳng hàng bằng màu chữ phụ; `Phụ trách` hiển thị họ tên đầy đủ; phân cách ngang mảnh, nền trung tính nhẹ cho dòng đang chọn.
- **Panel Chi tiết công việc (Đóng/mở & Responsive):**
  - **Đóng panel (`×`):** Bảng mở toàn chiều rộng 100%.
  - **Khung nhìn rộng (`>= 1280px`):** Song song cạnh bảng (`390px`), phím `J/K` chuyển nhanh giữa các dòng.
  - **Khung nhìn hẹp (`< 1280px`):** Mở thành **ngăn trượt phủ lên bảng (`overlay drawer`)** có bóng đổ nổi, tránh bóp nghẹt tên việc trên laptop/tablet/mobile.
  - **Cấu trúc nội dung panel:** Đầu panel có mã việc nhỏ + tên việc đầy đủ + nút đóng `×`. Thuộc tính xếp thành **các dòng `nhãn bên trái – giá trị bên phải`** (`Người phụ trách`, `Thời hạn`, `Phòng ban`, `Trạng thái` cho phép **chọn đổi trực tiếp ngay tại dòng Trạng thái** — không lặp dropdown ở chỗ khác). Phía dưới tách đúng 2 tab **`Trao đổi`** (người viết, thời gian, nội dung) và **`Tệp đính kèm`**. Nút **`Hoàn thành việc`** đặt dạng nút phụ (`btn-secondary`), cấp độ hiển thị thấp hơn `+ Giao việc`.

### 3.2 `QHRM` — Quan hệ trực tiếp giữa Phòng ban & Nhân sự (`/org`) + `Ctrl+K`
- **Cột trái nhẹ (`240px`, bộ lọc phòng ban):** Mục đầu **`Toàn công ty`** kèm tổng số nhân sự, bên dưới là từng phòng ban kèm số người và trạng thái đang chọn rõ ràng.
- **Vùng chính bên phải:** Tiêu đề động **`Nhân sự · [Tên phòng ban hoặc Toàn công ty]`**, góc phải có nút chính **`+ Thêm nhân sự`** (chỉ hiển thị với Giám đốc/Quản lý). Bảng tách rõ 5 cột: **`Họ tên` | `Chức danh` | `Vai trò` | `Quản lý trực tiếp` | `Tình trạng`**.
- **Hộp tìm nhanh `Ctrl+K` (`640px`):**
  - **Bỏ số `1, 2, 3`** trước tiêu đề nhóm; chỉ giữ **`Đi tới`**, **`Chuyển ứng dụng`** (`QTask / QHRM / QCRM / QSocial` kèm icon + tên + mô tả 1 dòng), **`Thao tác nhanh`**.
  - Ô tìm kiếm rộng rãi (`h-11` / `44px`) để câu gợi ý không bị cắt; dùng **cùng kiểu nền highlight trung tính** như bảng và thanh bên; có bóng đổ rõ cho hộp nổi.

### 3.3 Đăng nhập (`/login`) — Một điểm tập trung
- Bố cục 2 cột trên desktop:
  - **Cột trái:** Chỉ hiển thị **Logo `Q` hổ phách + `QSystem`** và một câu ngắn *"Không gian làm việc của QSystem."* — **bỏ hoàn toàn bảng Phân hệ sẵn sàng** chiếm chỗ.
  - **Cột phải:** Form rộng `380–420px`, ô nhập cao `44px`, nhãn rõ ràng, nút **`Hiện/Ẩn`** mật khẩu, nút chính **`Đăng nhập`** toàn chiều ngang, bên dưới đặt liên kết hỗ trợ (`Cần hỗ trợ đăng nhập?`) thay cho câu giải thích phân quyền. Công tắc Sáng/Tối gọn ở góc thẻ.

### 3.4 Phạm vi Nâng cấp `packages/ui` & Typed Adapters `apps/web`
- **Vá 3 lỗi tồn đọng trong `packages/ui`:**
  1. `ToastRegion` ([toast.tsx](packages/ui/src/toast.tsx)): tách timer theo `toast.id`, bổ sung vị trí `data-position` trong [styles.css](packages/ui/src/styles.css).
  2. `DataTable` ([table.tsx](packages/ui/src/table.tsx)): kẹp `activeRowIndex` khi số dòng co lại; hỗ trợ hàng `44–48px` và phím `J/K`.
  3. `FormField` ([form.tsx](packages/ui/src/form.tsx)): đồng bộ `child.props.id` với `<label htmlFor>`.
- **Thêm linh kiện chuẩn (kiểm tra Fragment UI MCP trước khi code):** `UnifiedShell` (`240px` sidebar + `56px` fixed header), `ModuleSwitcher`, `CommandPalette` (`640px`), `ResponsiveDetailDrawer` (side-by-side `>= 1280px` / overlay `< 1280px` / closable), `AttributeRowList`, `FilterPopover`, `StateRegion` (`LoadingSkeleton`, `EmptyState`, `ErrorState`). Icon set thống nhất: **Lucide React (`18px` / `16px`, `strokeWidth={1.5}`)**.
- **3 Typed Adapters tại `apps/web/src/lib/adapters/`:** `registry.adapter.ts` (đợi `GET /registry`), `tasks.adapter.ts` (ánh xạ `TaskPayload4W` + `POST/PATCH /org/tasks`, giữ adapter tới khi có `GET /org/tasks`), `notifications.adapter.ts` (polling `GET /notifications` khi tab active, chuẩn hóa trạng thái tiếng Việt).

---

## 4. Cổng Nghiệm thu Khi Đưa Vào Thực thi (`Harness Verification`)

Mọi card công việc triển khai qua `corepack pnpm harness implement --agents ...` bắt buộc vượt qua:
1. **Fragment UI MCP reuse evidence** + chuẩn copy 100% tiếng Việt tự nhiên (zero dev terms).
2. **Hallmark Floor (`sloplint --scope app --genre modern-minimal --render`):** `0 FAIL`.
3. **Browser & Zoom 100% QA (`qa-browser-engineer` Playwright):**
   - Kiểm tra trực tiếp trên trình duyệt ở **zoom 100%** với chuỗi tiếng Việt (`Nguyễn Minh Tuấn, Trễ hạn, Tổ chức & Nhân sự`) tại `1440x900` (panel song song), `1024x768` (panel overlay phủ lên bảng), `390x844` (mobile), ở **cả Giao diện Tối (`#111418`) lẫn Giao diện Sáng (Warm Paper `#F4F1EA` + `#FFFFFF`)**.
   - Xác minh contrast vòng focus, chữ phụ trên nền `#191D23` / `#FFFFFF`, `prefers-reduced-motion: reduce`, và điều hướng bàn phím (`Ctrl+K`, `J/K`, `Esc`).
4. **Unit & Integration Tests (`tester`) + Independent Review (`independent-reviewer`):** toàn bộ suite `packages/ui` & `apps/web` pass không skip.
