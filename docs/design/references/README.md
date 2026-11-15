# QSystem UI/UX Visual Reference Kit

Bộ tài liệu và hình ảnh này là **chuẩn mẫu duy nhất** cho mọi AI CLI/IDE (`Claude Code`, `Codex CLI`, `Gemini CLI`, `Cursor`, `Antigravity`, `GitHub Copilot`, và worker trong `packages/harness`) khi thiết kế hoặc chỉnh sửa giao diện `QSystem`.

## 1. Tài liệu & Ảnh mẫu trong thư mục này

| Tệp | Vai trò | Chế độ mặc định trong mẫu |
| :--- | :--- | :--- |
| [01-qtask-dark.jpg](./01-qtask-dark.jpg) | Mẫu bố cục `QTask` — Shell 240px, Header 56px, tab gạch chân tối giản, bảng việc rộng + Panel chi tiết đóng/mở bên phải | Dark (`#111418` / `#191D23`) |
| [02-qhrm-light-cmdk.jpg](./02-qhrm-light-cmdk.jpg) | Mẫu `QHRM` & hộp tìm nhanh `Ctrl+K` 640px — Cột phòng ban 240px + bảng nhân sự 5 cột + Command Palette không đánh số nhóm | Light Warm Paper (`#FAF8F4` / `#F4F1EA` / `#FFFFFF`) |
| [03-login-dark.jpg](./03-login-dark.jpg) | Mẫu màn hình Đăng nhập tập trung — Split 2 cột tối giản, bỏ hoàn toàn bảng phụ, chỉ 1 CTA `#E8AD45` | Dark (`#111418` / `#191D23`) |
| [qsystem-console-prototype.html](./qsystem-console-prototype.html) | Prototype HTML tương tác đã kiểm tra chuẩn CSS tokens, typography, spacing, shadow layering, `J/K`, `Ctrl+K`, toast, đóng/mở drawer & `sloplint` (`0 FAIL`) | Dark + Light toggle |

## 2. Quy tắc đọc mẫu để tái tạo chính xác 100%

- **Dùng 3 ảnh JPG (`01`, `02`, `03`) để khóa bố cục & sắc độ:** vị trí logo `Q` hổ phách + `QSystem`, tỷ lệ sidebar `240px`, độ thoáng dòng bảng `44–48px`, sự tương phản giữa bảng rộng và panel chi tiết gọn, bóng đổ **chỉ** áp dụng cho thành phần nổi (`Ctrl+K`, dropdown, popover, drawer overlay).
- **Dùng [DESIGN.md](../../../DESIGN.md) và [qsystem-console-prototype.html](./qsystem-console-prototype.html) để khóa thông số & câu chữ chuẩn:**
  - ⚠️ **Quan trọng:** Không chép lại lỗi chữ nhỏ do AI render trong ảnh JPG (như chip hay dòng chữ mờ ở nền). Mọi chuỗi tiếng Việt hiển thị trên UI phải lấy từ quy chuẩn nhân văn trong [PRODUCT.md](../../../PRODUCT.md) và [DESIGN.md](../../../DESIGN.md).
  - Font chữ UI duy nhất: `Inter` (`400, 500, 600`, subset `vietnamese`, bật `tabular-nums` cho mã việc/ngày/số lượng).
  - Màu nhấn `#E8AD45` (chữ `#201708`) chỉ xuất hiện ở logo `Q` và **duy nhất 1 nút CTA chính** trên mỗi màn hình (`+ Giao việc`, `+ Thêm nhân sự`, `Đăng nhập`).

## 3. Quy trình bắt buộc trước khi viết UI code

1. Đọc [PRODUCT.md](../../../PRODUCT.md) và [DESIGN.md](../../../DESIGN.md).
2. Mở xem trực tiếp 3 ảnh `01-qtask-dark.jpg`, `02-qhrm-light-cmdk.jpg`, `03-login-dark.jpg` (nếu model hỗ trợ đọc ảnh) và đối chiếu token/CSS trong `qsystem-console-prototype.html`.
3. Kiểm tra `fragment-ui` MCP (`mcp__fragment-ui__*` / `.cursor/mcp.json`) trước khi tạo primitive mới; tái sử dụng component từ `packages/ui`.
4. Kiểm chứng sau khi dựng giao diện ở zoom trình duyệt `100%` tại `1440x900`, `1024x768`, `390x844` trên cả hai chế độ Dark & Light, và chạy `sloplint --scope app --genre modern-minimal --render`.

