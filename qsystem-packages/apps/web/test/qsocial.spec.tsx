import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeResponse } from '@qsystem/contracts';
import { QSocialWorkspace } from '../src/components/qsocial/QSocialWorkspace';
import type { SocialPostItem } from '../src/lib/adapters/social.adapter';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const FORBIDDEN =
  /\b(4W|WHO|PENDING|SENT|FAILED|DEAD|Presign|Audit trail|DIRECTOR|MANAGER|EMPLOYEE|ANNOUNCEMENT|SHARING|KUDOS|QUESTION)\b/;

const me = (role: MeResponse['role']): MeResponse => ({
  id: 'u-1',
  email: 'minhtuan@qsystem.vn',
  name: 'Nguyễn Minh Tuấn',
  role,
  departmentId: 'd-1',
  managedDepartmentIds: role === 'MANAGER' ? ['d-1'] : [],
});

const INITIAL_POSTS: SocialPostItem[] = [
  {
    id: 'post-1',
    authorId: 'u-0',
    authorName: 'Phạm Bảo Châu',
    authorRole: 'DIRECTOR',
    departmentId: 'd-1',
    departmentName: 'Phòng Kỹ thuật',
    category: 'ANNOUNCEMENT',
    content: 'Thông báo lịch họp giao ban đầu tuần vào 9 giờ sáng thứ Hai.',
    pinned: true,
    likeCount: 2,
    likedByMe: false,
    commentCount: 0,
    comments: [],
    createdAt: '2026-11-14T08:00:00.000Z',
    updatedAt: '2026-11-14T08:00:00.000Z',
  },
  {
    id: 'post-2',
    authorId: 'u-1',
    authorName: 'Nguyễn Minh Tuấn',
    authorRole: 'EMPLOYEE',
    departmentId: 'd-2',
    departmentName: 'Phòng Sản phẩm',
    category: 'SHARING',
    content: 'Đã cập nhật bộ tài liệu hướng dẫn quy trình phát hành mới.',
    pinned: false,
    likeCount: 0,
    likedByMe: false,
    commentCount: 0,
    comments: [],
    createdAt: '2026-11-14T09:00:00.000Z',
    updatedAt: '2026-11-14T09:00:00.000Z',
  },
];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getFeedContainer(): HTMLElement {
  const el = document.querySelector('.qso__feed');
  if (!el) throw new Error('Expected .qso__feed container in DOM');
  return el as HTMLElement;
}

let fail = false;
let store: SocialPostItem[] = [];

beforeEach(() => {
  fail = false;
  store = INITIAL_POSTS.map((post) => ({ ...post, comments: [...post.comments] }));

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (fail) return json(500, { code: 'INTERNAL', message: 'boom' });

      if (url === '/api/social/posts' && (!init?.method || init.method === 'GET')) {
        return json(200, { items: store, total: store.length, page: 1, pageSize: 20 });
      }
      if (url === '/api/social/posts' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        const created: SocialPostItem = {
          id: `post-${store.length + 1}`,
          authorId: 'u-1',
          authorName: 'Nguyễn Minh Tuấn',
          authorRole: 'DIRECTOR',
          departmentId: body.departmentId ?? null,
          departmentName: null,
          category: body.category ?? 'SHARING',
          content: body.content,
          pinned: Boolean(body.pinned),
          likeCount: 0,
          likedByMe: false,
          commentCount: 0,
          comments: [],
          createdAt: '2026-11-14T10:00:00.000Z',
          updatedAt: '2026-11-14T10:00:00.000Z',
        };
        store = [created, ...store];
        return json(201, { ok: true, post: created });
      }
      if (url.endsWith('/like') && init?.method === 'POST') {
        const postId = url.split('/')[4];
        const target = store.find((p) => p.id === postId);
        if (!target) return json(404, { code: 'NOT_FOUND', message: 'missing' });
        const liked = !target.likedByMe;
        const updated: SocialPostItem = {
          ...target,
          likedByMe: liked,
          likeCount: liked ? target.likeCount + 1 : Math.max(0, target.likeCount - 1),
        };
        store = store.map((p) => (p.id === postId ? updated : p));
        return json(200, { ok: true, liked, post: updated });
      }
      if (url.endsWith('/comments') && init?.method === 'POST') {
        const postId = url.split('/')[4];
        const body = JSON.parse(String(init.body));
        const target = store.find((p) => p.id === postId);
        if (!target) return json(404, { code: 'NOT_FOUND', message: 'missing' });
        const comment = {
          id: `c-${target.comments.length + 1}`,
          postId,
          authorId: 'u-1',
          authorName: 'Nguyễn Minh Tuấn',
          authorRole: 'DIRECTOR' as const,
          content: body.content,
          createdAt: '2026-11-14T10:05:00.000Z',
        };
        const updated: SocialPostItem = {
          ...target,
          commentCount: target.commentCount + 1,
          comments: [...target.comments, comment],
        };
        store = store.map((p) => (p.id === postId ? updated : p));
        return json(201, { ok: true, comment, post: updated });
      }
      if (url.startsWith('/api/social/posts/') && init?.method === 'PATCH') {
        const postId = url.split('/')[4];
        const body = JSON.parse(String(init.body));
        const target = store.find((p) => p.id === postId);
        if (!target) return json(404, { code: 'NOT_FOUND', message: 'missing' });
        const updated: SocialPostItem = {
          ...target,
          pinned: body.pinned ?? target.pinned,
        };
        store = store.map((p) => (p.id === postId ? updated : p));
        return json(200, { ok: true, post: updated });
      }
      if (url.startsWith('/api/social/posts/') && init?.method === 'DELETE') {
        const postId = url.split('/')[4];
        store = store.filter((p) => p.id !== postId);
        return json(200, { ok: true, id: postId });
      }
      return json(404, { code: 'NOT_FOUND', message: 'unknown route' });
    }),
  );
});

describe('QSocialWorkspace', () => {
  it('hiển thị bảng tin tiếng Việt sạch và không rò rỉ nhãn kỹ thuật', async () => {
    render(<QSocialWorkspace me={me('DIRECTOR')} />);
    const articles = await screen.findAllByRole('article');
    expect(articles).toHaveLength(2);
    const feed = getFeedContainer();
    expect(
      within(feed).getByText('Thông báo lịch họp giao ban đầu tuần vào 9 giờ sáng thứ Hai.'),
    ).toBeTruthy();
    expect(
      within(feed).getByText('Đã cập nhật bộ tài liệu hướng dẫn quy trình phát hành mới.'),
    ).toBeTruthy();
    expect(FORBIDDEN.test(document.body.textContent ?? '')).toBe(false);
  });

  it('lọc bài viết theo kênh chủ đề, tab Đã lưu và chế độ xem', async () => {
    const user = userEvent.setup();
    render(<QSocialWorkspace me={me('DIRECTOR')} />);
    await screen.findAllByRole('article');
    const feed = getFeedContainer();

    const nav = screen.getByRole('navigation', { name: 'Kênh nội bộ' });
    await user.click(within(nav).getByRole('button', { name: /Chia sẻ kinh nghiệm/ }));
    expect(
      within(feed).queryByText('Thông báo lịch họp giao ban đầu tuần vào 9 giờ sáng thứ Hai.'),
    ).toBeNull();
    expect(
      within(feed).getByText('Đã cập nhật bộ tài liệu hướng dẫn quy trình phát hành mới.'),
    ).toBeTruthy();

    await user.click(within(nav).getByRole('button', { name: /Thông báo chung/ }));
    expect(
      within(feed).queryByText('Đã cập nhật bộ tài liệu hướng dẫn quy trình phát hành mới.'),
    ).toBeNull();
    expect(
      within(feed).getByText('Thông báo lịch họp giao ban đầu tuần vào 9 giờ sáng thứ Hai.'),
    ).toBeTruthy();

    await user.click(within(nav).getByRole('button', { name: /Toàn công ty/ }));
    const articles = screen.getAllByRole('article');
    await user.click(within(articles[1]!).getByRole('button', { name: 'Tùy chọn bài viết' }));
    await user.click(within(articles[1]!).getByRole('menuitem', { name: 'Lưu bài viết' }));

    await user.click(screen.getByRole('tab', { name: 'Đã lưu' }));
    expect(
      within(feed).getByText('Thông báo lịch họp giao ban đầu tuần vào 9 giờ sáng thứ Hai.'),
    ).toBeTruthy();
    expect(
      within(feed).queryByText('Đã cập nhật bộ tài liệu hướng dẫn quy trình phát hành mới.'),
    ).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Bảng tin' }));
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  it('cho phép đăng bài, thả cảm xúc và bình luận trực tiếp', async () => {
    const user = userEvent.setup();
    render(<QSocialWorkspace me={me('DIRECTOR')} />);
    await screen.findAllByRole('article');
    const feed = getFeedContainer();

    await user.type(
      screen.getByLabelText('Nội dung bài viết'),
      'Cảm ơn nhóm hạ tầng đã hỗ trợ nâng cấp hệ thống cuối tuần.',
    );
    await user.click(screen.getByRole('button', { name: /Đăng bài/ }));

    expect(
      await within(feed).findByText(
        'Cảm ơn nhóm hạ tầng đã hỗ trợ nâng cấp hệ thống cuối tuần.',
      ),
    ).toBeTruthy();

    const targetPost = screen.getAllByRole('article').find((el) => el.id === 'post-1')!;
    await user.click(within(targetPost).getByRole('button', { name: /2 lượt thích/ }));
    expect(
      await within(targetPost).findByRole('button', { name: /3 lượt thích/ }),
    ).toBeTruthy();

    await user.click(within(targetPost).getByRole('button', { name: /0 bình luận/ }));
    const commentInput = within(targetPost).getByPlaceholderText('Viết bình luận phản hồi...');
    await user.type(commentInput, 'Phòng kỹ thuật đã nắm lịch họp ạ.');
    await user.click(within(targetPost).getByRole('button', { name: 'Gửi' }));

    expect(await within(targetPost).findByText('Phòng kỹ thuật đã nắm lịch họp ạ.')).toBeTruthy();
  });

  it('ẩn nút ghim và xóa bài của người khác khi tài khoản là nhân viên', async () => {
    const user = userEvent.setup();
    render(<QSocialWorkspace me={me('EMPLOYEE')} />);
    const articles = await screen.findAllByRole('article');
    const ownPost = articles.find((el) => el.id === 'post-2')!;
    const otherPost = articles.find((el) => el.id === 'post-1')!;

    await user.click(within(otherPost).getByRole('button', { name: 'Tùy chọn bài viết' }));
    expect(within(otherPost).queryByRole('menuitem', { name: /Ghim|Bỏ ghim/ })).toBeNull();
    expect(within(otherPost).queryByRole('menuitem', { name: 'Xóa bài viết' })).toBeNull();

    await user.click(within(ownPost).getByRole('button', { name: 'Tùy chọn bài viết' }));
    expect(within(ownPost).queryByRole('menuitem', { name: /Ghim|Bỏ ghim/ })).toBeNull();
    expect(within(ownPost).getByRole('menuitem', { name: 'Xóa bài viết' })).toBeTruthy();
  });

  it('hiển thị trạng thái lỗi và thử lại thành công', async () => {
    const user = userEvent.setup();
    fail = true;
    render(<QSocialWorkspace me={me('DIRECTOR')} />);

    const retry = await screen.findByRole('button', { name: 'Thử lại' });
    fail = false;
    await user.click(retry);

    const articles = await screen.findAllByRole('article');
    expect(articles).toHaveLength(2);
  });
});
