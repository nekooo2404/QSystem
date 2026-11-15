# UI Backlog — còn lại sau lượt UX 7 (trau chuốt trước QA)

Mọi mục dưới đây đã được xác minh nhưng **chưa** sửa trong card
`ux-engineering-ui-improvement`, vì nằm ngoài phạm vi P1/P2 hoặc cần dữ liệu
backend chưa tồn tại. Không mục nào là lỗi chặn QA.

## P3 — Thị giác / bố cục

| # | Vấn đề | Bằng chứng | Hướng sửa |
| :-- | :--- | :--- | :--- |
| 1 | Thanh top bar thiếu avatar + tên người dùng ở bên phải; reference `01-qtask-dark.jpg` có `Nguyễn Minh Tuấn ▾` | Ảnh `.playwright-mcp/ux7/tasks-1440-dark.png` chỉ có 3 icon | Thêm `Avatar` + tên rút gọn vào `topActions` khi `me` có mặt; cần trường ảnh đại diện trong `MeResponse` |
| 2 | Nút đổi theme ở top bar chỉ có icon, không có trạng thái đang bật ngoài `title` | `AppWorkspaceShell.tsx` | Dùng `aria-pressed` thay vì phụ thuộc `title` (screen reader đọc được) |
| 3 | Sidebar QHRM hiện `Phòng ban` / `Chấm công` trỏ tới `?muc=` chưa có màn hình | `/org?muc=phong-ban` render lại danh bạ | Làm 2 màn hình đó hoặc ẩn mục cho tới khi có |
| 4 | Bảng QHRM cột `Chức danh` / `Tình trạng` luôn là "Chưa có dữ liệu" | schema `User` thiếu 2 trường | Chờ API; đã ghi chú trong `QhrmDirectory.tsx` |
| 5 | Badge `1 chưa đọc` cạnh icon chuông làm top bar cao hơn 56px ở 1024 | Ảnh `tasks-1024-dark.png` | Đưa badge thành chấm đếm tuyệt đối thay vì chữ |
| 6 | Vùng bảng QTask dưới 1280px có thể cuộn ngang nhưng không có bóng/viền báo còn nội dung | `wrapScroll: true` ở 1280 | Thêm `mask-image` fade mép phải khi `scrollWidth > clientWidth` |

## P3 — Trạng thái & phản hồi

| # | Vấn đề | Bằng chứng | Hướng sửa |
| :-- | :--- | :--- | :--- |
| 7 | `toast` không có nút đóng dù `closeButton` được khai báo trong props | `packages/ui/src/toast.tsx` đọc `data-close-button` nhưng không render nút | Render nút `Đóng thông báo` khi prop bật; hiện chỉ tự hết hạn sau 4s |
| 8 | `/files` không có trạng thái đang tải cho danh sách (chỉ có empty) | `files/page.tsx` | Dùng `StateRegion state="loading"` trong lúc `open()`/upload chạy |
| 9 | `QTaskWorkspace` không phân biệt "lỗi tải" và "chưa có việc" khi `listTasks` rơi về localStorage rỗng | `tasks.adapter.ts` nuốt lỗi mạng | Hiện `ErrorState` khi cả API và store đều rỗng *và* lần gọi API lỗi |
| 10 | `/account` không có trạng thái lỗi khi `GET /me` thất bại (chỉ xoay loading mãi) | `account/page.tsx` | Thêm `StateRegion state="error"` + nút thử lại |
| 11 | Cột `Thời hạn` định dạng `15/11/2026`; reference dùng `15/11 14:30` (có giờ) | `formatDue()` bỏ giờ | Chỉ đổi khi backend trả `dueDate` kèm giờ; hiện là ngày thuần |

## P3 — Kỹ thuật / hệ thống

| # | Vấn đề | Bằng chứng | Hướng sửa |
| :-- | :--- | :--- | :--- |
| 12 | `apps/api` chưa có `GET /org/tasks`; QTask đọc/ghi localStorage | `tasks.adapter.ts` (đánh dấu `shortcut:`) | Làm endpoint rồi bỏ `STORE_KEY` |
| 13 | `POST /org/users` chưa có; nút `+ Thêm nhân sự` chỉ bắn toast "sẽ sớm ra mắt" | `QhrmDirectory.addPerson` | Làm endpoint tạo nhân sự |
| 14 | `/org` gọi `GET /me` lần thứ hai dù `SessionGuard` đã gọi | `org/page.tsx` | Đưa `me` vào session context khi có màn hình thứ ba cần |
| 15 | `DataTable` không hỗ trợ cột co giãn theo nội dung; mọi bảng phải tự khai `table-layout: fixed` | `globals.css` §QTask | Thêm prop `columnWidths` cho `DataTable` để khỏi hack CSS theo từng màn |
| 16 | Sloplint `REFLEX 26b` báo `account/page.tsx` "no :active/:disabled" — thực chất các control nằm trong `Button`/`Input` đã có style | `sloplint apps/web/src` | Không phải lỗi thật; thêm comment stamp hoặc tách component để lint hiểu |
