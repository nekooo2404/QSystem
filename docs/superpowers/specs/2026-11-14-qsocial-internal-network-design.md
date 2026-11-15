# QSocial — Mạng xã hội Nội bộ Doanh nghiệp (Facebook / Workplace Style)

**Task ID:** `qsocial-internal-network`  
**Status:** Approved Specification

## 1. Mục tiêu & Phạm vi

Biến phân hệ **QSocial** (`/social`) từ màn hình đặt chỗ thành mạng xã hội nội bộ hoàn chỉnh dành cho nhân sự doanh nghiệp trong shell hợp nhất QSystem:

- **Bảng tin nội bộ (Company & Department Feed):** Đăng bài chia sẻ thông báo, kinh nghiệm, khen thưởng đồng nghiệp, và hỏi đáp công việc.
- **Kênh chủ đề & Phòng ban:** Lọc nhanh theo `Toàn công ty`, `Thông báo chung`, `Khen thưởng đồng nghiệp`, `Chia sẻ kinh nghiệm`, `Hỏi đáp công việc`, hoặc từng phòng ban từ danh bạ tổ chức (`/org/departments`).
- **Tương tác xã hội thời gian thực theo thao tác:** Thích / Bỏ thích (`POST /social/posts/:id/like`), bình luận trực tiếp bên dưới mỗi bài viết (`POST /social/posts/:id/comments`), ghim bài viết quan trọng lên đầu bảng tin (`PATCH /social/posts/:id`), và xóa bài viết theo phân quyền (`DELETE /social/posts/:id`).
- **Cột thông tin nội bộ bên phải:** Tóm tắt bài viết đã ghim (`Tiêu điểm đã ghim`) và danh bạ đồng nghiệp đang hoạt động trong phạm vi truy cập (`Đồng nghiệp trực tuyến`).
- **Lưu trữ bền vững trên PostgreSQL + Prisma + RLS:** Không dùng `localStorage` cho dữ liệu bài viết, bình luận hoặc lượt thích; mọi truy vấn đi qua `PrismaService.withIdentity(viewer.id, ...)` để kích hoạt `SET LOCAL app.current_user_id` và chính sách Row-Level Security (RLS).

## 2. Kết quả kiểm tra Fragment UI MCP & Quyết định tái sử dụng

Trước khi tạo component mới cho QSocial, đã kiểm tra trực tiếp thư viện Fragment UI cục bộ tại `D:\Projects\fragment-ui-public`:

- Đã đọc `D:\Projects\fragment-ui-public\packages\ui\src\activity-feed.tsx` (`ActivityFeed`): đây là danh sách nhật ký chỉ đọc với chuỗi thời gian tiếng Anh cứng (`Just now`, `m ago`, `h ago`), sử dụng token `--color-*` khác hệ token `--qs-*` và không hỗ trợ khung soạn bài, bộ lọc kênh, nút thích hoặc form bình luận nội tuyến.
- Đã đọc `D:\Projects\fragment-ui-public\packages\ui\src\avatar.tsx` (`Avatar`): phụ thuộc `@radix-ui/react-avatar` không cài trong `@qsystem/ui`.
- **Quyết định tái sử dụng:** Kế thừa hoàn toàn các nguyên thủy đã kiểm chuẩn của `@qsystem/ui` (`Button`, `UnderlineTabs`, `StateRegion`, `toast`, `.qs-input`, `UnifiedShell`) và triển khai khung `QSocialWorkspace` (`apps/web/src/components/qsocial/QSocialWorkspace.tsx`) dùng avatar chữ cái đầu thuần CSS/JSX đồng bộ 100% với hệ token Console Dark / Warm Paper Light của QSystem.

## 3. Ràng buộc Thiết kế & Quy chuẩn Ngôn ngữ Tiếng Việt

Tuân thủ tuyệt đối `PRODUCT.md`, `DESIGN.md`, `impeccable/reference/craft-floor.md`, `unslop`, và `sloplint --scope app --genre modern-minimal --render`:

1. **100% tiếng Việt tự nhiên cho người vận hành cuối:**
   - Mọi vai trò và phân loại nội bộ đều được ánh xạ sang tiếng Việt trước khi hiển thị (`Giám đốc`, `Quản lý`, `Nhân viên`, `Thông báo chung`, `Khen thưởng đồng nghiệp`, `Chia sẻ kinh nghiệm`, `Hỏi đáp công việc`).
   - Cấm tuyệt đối rò rỉ chuỗi kỹ thuật (`DIRECTOR`, `MANAGER`, `EMPLOYEE`, `ANNOUNCEMENT`, `SHARING`, `KUDOS`, `QUESTION`, `4W`, `PENDING`, `SENT`, `FAILED`, `DEAD`) lên giao diện.
2. **Quy tắc Một CTA chính (One-CTA Rule):**
   - Trên toàn màn hình `/social`, **chỉ duy nhất** nút `Đăng bài` trong khung soạn thảo dùng kiểu chính `#E8AD45` (`variant="primary"`).
   - Toàn bộ nút còn lại (`Thích`, `Bình luận`, `Gửi`, `Ghim`, `Bỏ ghim`, `Xóa`, nút chọn kênh) dùng `secondary` hoặc `ghost`.
3. **Không thẻ lồng thẻ & Không bóng đổ tĩnh (No Nested Cards / No Static Shadows):**
   - Mỗi bài viết (`<article className="qsc-post">`) là một bề mặt phẳng duy nhất (`--qs-surface-1`, viền `1px solid var(--qs-border)`, bo góc `8px`).
   - Danh sách bình luận và cột thông tin bên phải chỉ tách bằng đường kẻ mảnh `1px solid var(--qs-border)`, không bọc thêm khung viền lồng nhau và không dùng emoji.
4. **Icon & Độ tương phản:**
   - Chỉ dùng `lucide-react` (`16px`, `strokeWidth={1.5}`), không dùng emoji.
   - Mọi ô nhập (`textarea`, `select`, `input`) dùng lớp `.qs-input` và có thuộc tính `disabled` khi đang gửi API; nút bấm tối thiểu `36px` chiều cao; hỗ trợ đầy đủ Dark (`#111418`) và Warm Paper Light (`#FAF8F4` / `#F4F1EA` / `#FFFFFF`) ở `1440x900`, `1024x768`, và `390x844`.

## 4. Hợp đồng API & Phân quyền (`apps/api` + `packages/contracts`)

- `GET /social/posts`: Lọc theo `category`, `departmentId`, `authorId`, `pinnedOnly`, `q`, phân trang `page`/`pageSize`; sắp xếp `pinned DESC, createdAt DESC`; đính kèm thông tin tác giả, phòng ban, bình luận (`createdAt ASC`), số lượt thích và `likedByMe`. Mọi người dùng đã đăng nhập đều xem được bảng tin nội bộ.
- `POST /social/posts`: Tạo bài viết mới; chỉ `DIRECTOR` hoặc `MANAGER` được phép đặt `pinned: true` (nếu `EMPLOYEE` đặt `pinned: true` trả về `403 FORBIDDEN`).
- `PATCH /social/posts/:id`: Chỉnh sửa nội dung/chủ đề (chỉ tác giả hoặc `DIRECTOR`) hoặc ghim/bỏ ghim (chỉ `DIRECTOR` hoặc `MANAGER`).
- `DELETE /social/posts/:id`: Chỉ tác giả bài viết hoặc `DIRECTOR` được phép xóa.
- `POST /social/posts/:id/like`: Bật/tắt lượt thích cho người dùng hiện tại (`SocialPostLike` khóa duy nhất `(postId, userId)`).
- `POST /social/posts/:id/comments`: Thêm bình luận mới gắn với `authorId = viewer.id`.

