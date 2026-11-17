'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import type { MeResponse, SocialCategory } from '@qsystem/contracts';
import {
  Bell,
  Bookmark,
  CalendarDays,
  ChevronDown,
  EyeOff,
  Heart,
  Info,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Pin,
  Plus,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { toast } from '@qsystem/ui';
import {
  addSocialComment,
  createSocialPost,
  deleteSocialPost,
  listSocialPosts,
  toggleSocialLike,
  updateSocialPost,
  type SocialPostItem,
} from '../../lib/adapters/social.adapter';
import { formatRole } from '../../lib/adapters/notifications.adapter';
import { ApiError } from '../../lib/api/client';
import { humanizeApiError } from '../../lib/errors/humanize';
import './qsocial.css';

interface FeedComment {
  id: string;
  author: string;
  time: string;
  content: string;
}

interface FeedPost {
  id: string;
  authorId?: string;
  author: string;
  meta: string;
  title?: string;
  body: string;
  category: SocialCategory;
  departmentId?: string | null;
  pinned?: boolean;
  hero?: boolean;
  attachmentName?: string;
  likes: number;
  comments: number;
  liked: boolean;
  commentItems: FeedComment[];
  createdAtMs: number;
  real: boolean;
}

const STORAGE_POSTS_KEY = 'qsystem:social:posts:v1';
const STORAGE_SAVED_KEY = 'qsystem:social:saved:v1';
const STORAGE_HIDDEN_KEY = 'qsystem:social:hidden:v1';

const isTestEnv = process.env.NODE_ENV === 'test';
const isStrictProd =
  process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_DEMO_MODE !== 'true';

const CHANNELS = [
  { id: 'all', label: 'Toàn công ty', count: 36, icon: Users },
  { id: 'ANNOUNCEMENT', label: 'Thông báo chung', count: 8, icon: Bell },
  { id: 'SHARING', label: 'Chia sẻ kinh nghiệm', count: 12, icon: MessageCircle },
  { id: 'KUDOS', label: 'Khen thưởng', count: 4, icon: Bookmark },
  { id: 'QUESTION', label: 'Hỏi đáp công việc', count: 9, icon: Info },
] as const;

const TABS = [
  { id: 'feed', label: 'Bảng tin' },
  { id: 'following', label: 'Đang theo dõi' },
  { id: 'saved', label: 'Đã lưu' },
] as const;

const AUDIENCES = [
  'Toàn công ty',
  'Khối Công nghệ',
  'Khối Nhân sự',
  'Ban điều hành',
] as const;

const NOTICES = [
  {
    id: 'notice-1',
    title: 'Lịch họp toàn công ty',
    sub: 'Thứ Sáu · 15:00',
    icon: Bell,
    category: 'ANNOUNCEMENT' as SocialCategory,
  },
  {
    id: 'notice-2',
    title: 'Cập nhật chính sách nghỉ phép',
    sub: 'Áp dụng từ tháng 12',
    icon: CalendarDays,
    category: 'ANNOUNCEMENT' as SocialCategory,
  },
] as const;

const SAMPLE_POSTS: FeedPost[] = [
  {
    id: 'sample-1',
    authorId: 'u-hr-01',
    author: 'Lan Anh',
    meta: 'Phòng Nhân sự · 2 giờ trước · Toàn công ty',
    title: 'Thông báo tiếp nhận nhân sự mới tháng 11',
    body: 'Tháng này khối Kỹ thuật và Vận hành tiếp nhận thêm 3 nhân sự mới. Các bộ phận liên quan phối hợp bàn giao tài khoản, thiết bị và tài liệu hội nhập trong tuần đầu làm việc.',
    category: 'ANNOUNCEMENT',
    departmentId: null,
    pinned: true,
    hero: true,
    likes: 24,
    comments: 8,
    liked: false,
    commentItems: [
      {
        id: 'sc-1',
        author: 'Đức Anh',
        time: '1 giờ trước',
        content: 'Phòng Kỹ thuật đã chuẩn bị xong tài khoản hệ thống và lịch hướng dẫn quy trình cho nhân sự mới.',
      },
      {
        id: 'sc-2',
        author: 'Hà My',
        time: '45 phút trước',
        content: 'Buổi gặp mặt giới thiệu nhân sự mới diễn ra vào 15:00 thứ Sáu tuần này tại phòng họp tầng 3.',
      },
    ],
    createdAtMs: Date.now() - 2 * 3_600_000,
    real: false,
  },
  {
    id: 'sample-2',
    authorId: 'u-director-01',
    author: 'Minh Khôi',
    meta: 'Ban Giám đốc · Hôm qua',
    body: 'Tổng kết sprint: các nhóm dự án đã hoàn thành đầy đủ những cột mốc bàn giao theo kế hoạch tuần qua.',
    category: 'SHARING',
    departmentId: null,
    pinned: false,
    likes: 0,
    comments: 0,
    liked: false,
    commentItems: [],
    createdAtMs: Date.now() - 24 * 3_600_000,
    real: false,
  },
];

const COLLEAGUES = [
  { name: 'Lan Anh', role: 'Nhân sự', initials: 'LA' },
  { name: 'Đức Anh', role: 'Công nghệ', initials: 'ĐA' },
  { name: 'Hà My', role: 'Kinh doanh', initials: 'HM' },
];

const FOLLOWING_AUTHORS = new Set(['Lan Anh', 'Đức Anh', 'Hà My']);

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Q';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'Vừa xong';
  if (h < 24) return `${h} giờ trước`;
  if (h < 48) return 'Hôm qua';
  return new Date(iso).toLocaleDateString('vi-VN');
}

function toFeed(post: SocialPostItem): FeedPost {
  const ts = new Date(post.createdAt).getTime();
  return {
    id: post.id,
    authorId: post.authorId,
    author: post.authorName,
    meta: [post.departmentName, relativeTime(post.createdAt), post.departmentId ? null : 'Toàn công ty']
      .filter(Boolean)
      .join(' · '),
    body: post.content,
    category: post.category,
    departmentId: post.departmentId,
    pinned: post.pinned,
    hero: Boolean(post.pinned && post.category === 'ANNOUNCEMENT'),
    likes: post.likeCount,
    comments: post.commentCount,
    liked: post.likedByMe,
    commentItems: Array.isArray(post.comments)
      ? post.comments.map((c) => ({
          id: c.id,
          author: c.authorName,
          time: relativeTime(c.createdAt),
          content: c.content,
        }))
      : [],
    createdAtMs: Number.isNaN(ts) ? Date.now() : ts,
    real: true,
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function errText(err: unknown): string {
  return humanizeApiError(
    err instanceof ApiError ? err.code : undefined,
    err instanceof ApiError ? err.status : undefined,
  );
}

function readStorageJson<T>(key: string, fallback: T): T {
  if (isTestEnv || typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorageJson(key: string, value: unknown) {
  if (isTestEnv || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore storage quota errors */
  }
}

export function QSocialWorkspace({ me }: { me: MeResponse }) {
  const searchParams = useSearchParams();
  const muc = searchParams?.get('muc');

  const [persistedFeed] = React.useState<FeedPost[]>(() =>
    readStorageJson<FeedPost[]>(STORAGE_POSTS_KEY, SAMPLE_POSTS),
  );
  const [posts, setPosts] = React.useState<SocialPostItem[]>([]);
  const [localPosts, setLocalPosts] = React.useState<FeedPost[]>([]);
  const [feedError, setFeedError] = React.useState(false);
  const [channel, setChannel] = React.useState<string>('all');
  const [tab, setTab] = React.useState<(typeof TABS)[number]['id']>('feed');
  const [sortBy, setSortBy] = React.useState<'newest' | 'popular'>('newest');
  const [audienceIdx, setAudienceIdx] = React.useState(0);
  const [draft, setDraft] = React.useState('');
  const [attachment, setAttachment] = React.useState<{ name: string; sizeLabel: string } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [composerError, setComposerError] = React.useState(false);

  const [likeOverrides, setLikeOverrides] = React.useState<Record<string, { liked: boolean; likes: number }>>({});
  const [pinnedOverrides, setPinnedOverrides] = React.useState<Record<string, boolean>>({});
  const [deletedIds, setDeletedIds] = React.useState<Set<string>>(() => new Set());
  const [savedIds, setSavedIds] = React.useState<Set<string>>(
    () => new Set(readStorageJson<string[]>(STORAGE_SAVED_KEY, [])),
  );
  const [hiddenIds, setHiddenIds] = React.useState<Set<string>>(
    () => new Set(readStorageJson<string[]>(STORAGE_HIDDEN_KEY, [])),
  );
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
  const [openComments, setOpenComments] = React.useState<Set<string>>(() => new Set());
  const [extraComments, setExtraComments] = React.useState<Record<string, FeedComment[]>>({});
  const [commentDrafts, setCommentDrafts] = React.useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [authorFilter, setAuthorFilter] = React.useState<string | null>(null);
  const [activeNoticeId, setActiveNoticeId] = React.useState<string | null>(null);

  const composerRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const menuHostRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (muc === 'thong-bao') {
      setChannel('ANNOUNCEMENT');
      setTab('feed');
    } else if (muc === 'nhom') {
      setChannel('SHARING');
      setTab('feed');
    } else if (muc === 'da-luu') {
      setChannel('all');
      setTab('saved');
    }
  }, [muc]);

  const loadFeed = React.useCallback(() => {
    setFeedError(false);
    listSocialPosts().then(
      (feed) => {
        if (Array.isArray(feed)) {
          setPosts(feed);
          setFeedError(false);
        }
      },
      () => {
        if (isTestEnv || isStrictProd) {
          setFeedError(true);
        }
      },
    );
  }, []);

  React.useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  React.useEffect(() => {
    if (!openMenuId) return;
    const onDown = (event: MouseEvent) => {
      if (!menuHostRef.current?.contains(event.target as Node)) setOpenMenuId(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenuId(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenuId]);

  const audience = AUDIENCES[audienceIdx];

  const baseFeed = React.useMemo<FeedPost[]>(() => {
    const remote = posts.map(toFeed);
    const fallbackFeed = isTestEnv ? [] : persistedFeed;
    const mergedRemote = remote.length > 0 ? remote : fallbackFeed;
    const combined = [
      ...localPosts,
      ...mergedRemote.filter((item) => !localPosts.some((loc) => loc.id === item.id)),
    ];
    return combined
      .filter((post) => !deletedIds.has(post.id))
      .map((post) => {
        const ov = likeOverrides[post.id];
        const added = extraComments[post.id] ?? [];
        const pinned = post.id in pinnedOverrides ? pinnedOverrides[post.id] : post.pinned;
        return {
          ...post,
          pinned,
          liked: ov ? ov.liked : post.liked,
          likes: ov ? ov.likes : post.likes,
          comments: post.comments + added.length,
          commentItems: [...post.commentItems, ...added],
        };
      });
  }, [posts, persistedFeed, localPosts, deletedIds, likeOverrides, pinnedOverrides, extraComments]);

  React.useEffect(() => {
    writeStorageJson(STORAGE_POSTS_KEY, baseFeed);
  }, [baseFeed]);

  React.useEffect(() => {
    writeStorageJson(STORAGE_SAVED_KEY, Array.from(savedIds));
  }, [savedIds]);

  React.useEffect(() => {
    writeStorageJson(STORAGE_HIDDEN_KEY, Array.from(hiddenIds));
  }, [hiddenIds]);

  const visible = React.useMemo(() => {
    const filtered = baseFeed.filter((post) => {
      if (hiddenIds.has(post.id)) return false;
      if (channel !== 'all' && post.category !== channel) return false;
      if (tab === 'saved' && !savedIds.has(post.id)) return false;
      if (tab === 'following' && !FOLLOWING_AUTHORS.has(post.author) && post.author !== me.name) {
        return false;
      }
      if (authorFilter && post.author !== authorFilter) return false;
      return true;
    });
    return [...filtered].sort((a, b) =>
      sortBy === 'popular' ? b.likes - a.likes || b.createdAtMs - a.createdAtMs : b.createdAtMs - a.createdAtMs,
    );
  }, [baseFeed, hiddenIds, channel, tab, savedIds, authorFilter, sortBy, me.name]);

  function canPinPost(post: FeedPost): boolean {
    if (me.role === 'DIRECTOR') return true;
    if (me.role === 'MANAGER') {
      if (!post.departmentId) return true;
      return me.managedDepartmentIds.includes(post.departmentId);
    }
    return false;
  }

  function canDeletePost(post: FeedPost): boolean {
    if (me.role === 'DIRECTOR') return true;
    if (post.authorId && post.authorId === me.id) return true;
    return post.author === me.name;
  }

  function focusComposer() {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    composerRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    composerRef.current?.focus();
  }

  async function handlePublish(event: React.FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) {
      toast.error('Vui lòng nhập nội dung trước khi đăng bài');
      setComposerError(true);
      composerRef.current?.focus();
      return;
    }
    setComposerError(false);
    setSubmitting(true);
    const category: SocialCategory = channel === 'all' ? 'SHARING' : (channel as SocialCategory);
    try {
      const created = await createSocialPost({ content, category, departmentId: null });
      if (created && typeof created.id === 'string' && typeof created.content === 'string') {
        setPosts((current) => [created, ...current.filter((p) => p.id !== created.id)]);
      } else {
        throw new Error('offline-fallback');
      }
      setDraft('');
      setAttachment(null);
      toast.success('Đã đăng bài viết lên bảng tin');
    } catch (err) {
      if (isStrictProd || (err instanceof ApiError && (err.status === 401 || err.status === 403))) {
        toast.error(errText(err));
      } else {
        const local: FeedPost = {
          id: `local-${Date.now()}`,
          authorId: me.id,
          author: me.name || 'Minh Khôi',
          meta: `${formatRole(me.role)} · Vừa xong · ${audience}`,
          body: content,
          category,
          departmentId: me.departmentId,
          pinned: false,
          attachmentName: attachment ? `${attachment.name} (${attachment.sizeLabel})` : undefined,
          likes: 0,
          comments: 0,
          liked: false,
          commentItems: [],
          createdAtMs: Date.now(),
          real: true,
        };
        setLocalPosts((current) => [local, ...current]);
        setDraft('');
        setAttachment(null);
        setTab('feed');
        toast.success('Đã đăng bài viết lên bảng tin');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLike(post: FeedPost) {
    const nextLiked = !post.liked;
    const nextLikes = Math.max(0, post.likes + (nextLiked ? 1 : -1));
    setLikeOverrides((current) => ({
      ...current,
      [post.id]: { liked: nextLiked, likes: nextLikes },
    }));
    if (post.real) {
      try {
        const result = await toggleSocialLike(post.id);
        if (result?.post?.id) {
          setPosts((current) => current.map((p) => (p.id === post.id ? result.post : p)));
        }
      } catch {
        /* keep optimistic toggle when offline */
      }
    }
  }

  async function handleTogglePin(post: FeedPost) {
    const nextPinned = !post.pinned;
    setPinnedOverrides((current) => ({ ...current, [post.id]: nextPinned }));
    setOpenMenuId(null);
    if (post.real) {
      try {
        const updated = await updateSocialPost(post.id, { pinned: nextPinned });
        if (updated?.id) {
          setPosts((current) => current.map((p) => (p.id === post.id ? updated : p)));
        }
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setPinnedOverrides((current) => ({ ...current, [post.id]: Boolean(post.pinned) }));
          toast.error(errText(err));
          return;
        }
      }
    }
    toast.success(nextPinned ? 'Đã ghim bài viết lên bảng tin' : 'Đã bỏ ghim bài viết');
  }

  async function handleDeletePost(post: FeedPost) {
    setDeletedIds((current) => new Set(current).add(post.id));
    setOpenMenuId(null);
    if (post.real) {
      try {
        await deleteSocialPost(post.id);
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setDeletedIds((current) => {
            const next = new Set(current);
            next.delete(post.id);
            return next;
          });
          toast.error(errText(err));
          return;
        }
      }
    }
    toast.success('Đã xóa bài viết');
  }

  function toggleComments(postId: string) {
    setOpenComments((current) => {
      const next = new Set(current);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

  async function handleCommentSubmit(event: React.FormEvent, post: FeedPost) {
    event.preventDefault();
    const text = (commentDrafts[post.id] ?? '').trim();
    if (!text) return;

    const newComment: FeedComment = {
      id: `cmt-${Date.now()}`,
      author: me.name || 'Minh Khôi',
      time: 'Vừa xong',
      content: text,
    };
    setExtraComments((current) => ({
      ...current,
      [post.id]: [...(current[post.id] ?? []), newComment],
    }));
    setCommentDrafts((current) => ({ ...current, [post.id]: '' }));

    if (post.real) {
      try {
        const res = await addSocialComment(post.id, text);
        if (res?.post?.id) {
          setPosts((current) => current.map((p) => (p.id === post.id ? res.post : p)));
          setExtraComments((current) => {
            const copy = { ...current };
            delete copy[post.id];
            return copy;
          });
        }
      } catch {
        /* keep optimistic reply when offline */
      }
    }
  }

  function handleShare(postId: string) {
    const shareUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/social#${postId}` : `/social#${postId}`;
    try {
      void navigator.clipboard?.writeText(shareUrl);
    } catch {
      /* ignore clipboard restrictions */
    }
    setCopiedId(postId);
    toast.success('Đã sao chép liên kết bài viết');
    window.setTimeout(() => {
      setCopiedId((current) => (current === postId ? null : current));
    }, 2000);
  }

  function toggleSave(postId: string) {
    const willSave = !savedIds.has(postId);
    setSavedIds((current) => {
      const next = new Set(current);
      if (willSave) next.add(postId);
      else next.delete(postId);
      return next;
    });
    setOpenMenuId(null);
    toast.success(willSave ? 'Đã lưu bài viết vào mục Đã lưu' : 'Đã bỏ lưu bài viết');
  }

  function hidePost(postId: string) {
    setHiddenIds((current) => new Set(current).add(postId));
    setOpenMenuId(null);
    toast.info('Đã ẩn bài viết khỏi bảng tin');
  }

  function handleSelectNotice(notice: (typeof NOTICES)[number]) {
    if (activeNoticeId === notice.id) {
      setActiveNoticeId(null);
      setChannel('all');
      return;
    }
    setActiveNoticeId(notice.id);
    setChannel(notice.category);
    setTab('feed');
    setAuthorFilter(null);
    toast.info(`${notice.title} — ${notice.sub}`);
  }

  function handleSelectColleague(name: string) {
    setAuthorFilter((current) => (current === name ? null : name));
    setTab('feed');
  }

  const activeChannelLabel = CHANNELS.find((c) => c.id === channel)?.label ?? 'Toàn công ty';

  return (
    <div className="qx-page qso">
      <header className="qx-page-head">
        <div>
          <h1>Bảng tin · {activeChannelLabel}</h1>
          <p>Chia sẻ thông tin, điều phối vận hành và trao đổi nội bộ</p>
        </div>
        <button type="button" className="qx-btn" onClick={focusComposer}>
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" /> Tạo bài viết
        </button>
      </header>

      <div className="qso__grid">
        <nav className="qx-card qso__channels" aria-label="Kênh nội bộ">
          <h2 className="qso__h">Không gian nội bộ</h2>
          <p className="qso__sub">Các kênh bạn theo dõi</p>
          <ul>
            {CHANNELS.map(({ id, label, count, icon: Icon }) => (
              <li key={id}>
                <button
                  type="button"
                  className="qso__channel"
                  aria-current={channel === id ? 'true' : undefined}
                  onClick={() => {
                    setChannel(id);
                    setActiveNoticeId(null);
                  }}
                >
                  <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                  <span>{label}</span>
                  <em>{count}</em>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <section className="qso__feed" aria-label="Bảng tin">
          <form className="qx-card qso__composer" onSubmit={handlePublish}>
            <div className="qso__compose-row">
              <span className="qx-avatar qso__av" aria-hidden="true">{initialsOf(me.name)}</span>
              <label className="qso__sr" htmlFor="qso-draft">Nội dung bài viết</label>
              <input
                id="qso-draft"
                ref={composerRef}
                className="qso__input"
                placeholder="Chia sẻ thông tin, tài liệu hoặc câu hỏi công việc"
                data-error={composerError ? 'true' : undefined}
                aria-invalid={composerError ? 'true' : undefined}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (composerError) setComposerError(false);
                }}
              />
            </div>

            {attachment ? (
              <div className="qso__attach-chip">
                <Paperclip size={16} strokeWidth={1.5} aria-hidden="true" />
                <span className="qso__attach-name">
                  {attachment.name} · {attachment.sizeLabel}
                </span>
                <button
                  type="button"
                  className="qso__attach-remove"
                  aria-label="Xóa tệp đính kèm"
                  onClick={() => setAttachment(null)}
                >
                  <X size={16} strokeWidth={1.5} aria-hidden="true" />
                </button>
              </div>
            ) : null}

            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  setAttachment({ name: file.name, sizeLabel: formatFileSize(file.size) });
                }
                event.target.value = '';
              }}
            />

            <div className="qso__compose-foot">
              <button
                type="button"
                className="qso__link"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip size={16} strokeWidth={1.5} aria-hidden="true" /> Hình ảnh / Tệp
              </button>
              <button
                type="button"
                className="qso__link"
                aria-label={`Đối tượng xem: ${audience}`}
                onClick={() => setAudienceIdx((idx) => (idx + 1) % AUDIENCES.length)}
              >
                <Users size={16} strokeWidth={1.5} aria-hidden="true" /> {audience}
              </button>
              <button type="submit" className="qx-btn qx-btn--primary qso__post" disabled={submitting}>
                <Send size={16} strokeWidth={1.5} aria-hidden="true" /> {submitting ? 'Đang đăng' : 'Đăng bài'}
              </button>
            </div>
          </form>

          <div className="qso__tabbar">
            <div className="qx-tabs qso__tabs" role="tablist" aria-label="Chế độ xem bảng tin">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  className="qx-tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="qso__sort"
              onClick={() => setSortBy((s) => (s === 'newest' ? 'popular' : 'newest'))}
            >
              {sortBy === 'newest' ? 'Mới nhất' : 'Phổ biến nhất'}{' '}
              <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>

          {authorFilter ? (
            <div className="qso__filter-bar">
              <span>Đang lọc bài viết của <strong>{authorFilter}</strong></span>
              <button
                type="button"
                className="qso__filter-clear"
                onClick={() => setAuthorFilter(null)}
              >
                <X size={16} strokeWidth={1.5} aria-hidden="true" /> Bỏ lọc
              </button>
            </div>
          ) : null}

          {feedError ? (
            <div role="alert" className="qx-card qso__empty-feed">
              <span>Không thể tải bảng tin lúc này.</span>
              <button type="button" className="qx-btn qx-btn--sm" onClick={loadFeed}>
                Thử lại
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="qx-card qso__empty-feed">
              <span>
                {tab === 'saved'
                  ? 'Chưa có bài viết nào được lưu. Bấm biểu tượng tùy chọn trên bài viết để lưu lại.'
                  : 'Chưa có bài viết nào phù hợp với bộ lọc hiện tại.'}
              </span>
              <button
                type="button"
                className="qx-btn qx-btn--sm"
                onClick={() => {
                  setChannel('all');
                  setTab('feed');
                  setAuthorFilter(null);
                  setActiveNoticeId(null);
                }}
              >
                Xem tất cả bài viết
              </button>
            </div>
          ) : (
            visible.map((post) => {
              const isMenuOpen = openMenuId === post.id;
              const isCommentsOpen = openComments.has(post.id);
              const isSaved = savedIds.has(post.id);
              const showFooter = post.likes > 0 || post.comments > 0 || post.real || isCommentsOpen;
              const allowPin = canPinPost(post);
              const allowDelete = canDeletePost(post);

              return (
                <article key={post.id} id={post.id} className="qx-card qso__post-card">
                  <header className="qso__post-head">
                    <span className="qx-avatar qso__av" aria-hidden="true">{initialsOf(post.author)}</span>
                    <div className="qso__who">
                      <strong>{post.author}</strong>
                      <span>{post.meta}</span>
                    </div>
                    <div className="qso__more-wrap" ref={isMenuOpen ? menuHostRef : undefined}>
                      <button
                        type="button"
                        className="qso__more"
                        aria-label="Tùy chọn bài viết"
                        aria-haspopup="menu"
                        aria-expanded={isMenuOpen}
                        onClick={() => setOpenMenuId(isMenuOpen ? null : post.id)}
                      >
                        <MoreHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
                      </button>
                      {isMenuOpen ? (
                        <div className="qso__menu" role="menu" aria-label="Thao tác bài viết">
                          {allowPin ? (
                            <button
                              type="button"
                              role="menuitem"
                              className="qso__menu-item"
                              onClick={() => void handleTogglePin(post)}
                            >
                              <Pin size={16} strokeWidth={1.5} aria-hidden="true" />
                              {post.pinned ? 'Bỏ ghim bài viết' : 'Ghim bài viết'}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            role="menuitem"
                            className="qso__menu-item"
                            onClick={() => toggleSave(post.id)}
                          >
                            <Bookmark size={16} strokeWidth={1.5} aria-hidden="true" />
                            {isSaved ? 'Bỏ lưu bài viết' : 'Lưu bài viết'}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="qso__menu-item"
                            onClick={() => {
                              setOpenMenuId(null);
                              handleShare(post.id);
                            }}
                          >
                            <Link2 size={16} strokeWidth={1.5} aria-hidden="true" />
                            Sao chép liên kết
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="qso__menu-item"
                            onClick={() => hidePost(post.id)}
                          >
                            <EyeOff size={16} strokeWidth={1.5} aria-hidden="true" />
                            Ẩn bài viết
                          </button>
                          {allowDelete ? (
                            <button
                              type="button"
                              role="menuitem"
                              className="qso__menu-item"
                              onClick={() => void handleDeletePost(post)}
                            >
                              <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
                              Xóa bài viết
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </header>

                  {post.title ? <h3 className="qso__title">{post.title}</h3> : null}
                  <p className={post.title ? 'qso__body' : 'qso__body qso__body--plain'}>{post.body}</p>

                  {post.attachmentName ? (
                    <div className="qso__post-attachment">
                      <Paperclip size={16} strokeWidth={1.5} aria-hidden="true" />
                      <span>{post.attachmentName}</span>
                    </div>
                  ) : null}

                  {post.hero || post.pinned ? (
                    <div className="qso__hero">
                      <div className="qso__hero-head">
                        <span className="qso__hero-kicker">
                          <Pin size={16} strokeWidth={1.5} aria-hidden="true" />
                          Thông báo vận hành đã ghim
                        </span>
                        <span className="qso__hero-code">TB-Q4</span>
                      </div>
                      <strong>Lịch giao ban điều hành và rà soát chỉ tiêu tuần</strong>
                      <span className="qso__hero-desc">
                        Trưởng các bộ phận hoàn tất cập nhật tiến độ công việc trên QTask và danh sách trực ca trên QHRM trước 17:00 thứ Năm hằng tuần
                      </span>
                    </div>
                  ) : null}

                  {showFooter ? (
                    <footer className="qso__post-foot">
                      <button
                        type="button"
                        className="qso__link"
                        aria-pressed={post.liked}
                        onClick={() => void handleLike(post)}
                      >
                        <Heart size={16} strokeWidth={1.5} aria-hidden="true" fill={post.liked ? 'currentColor' : 'none'} />{' '}
                        {post.likes} lượt thích
                      </button>
                      <button
                        type="button"
                        className="qso__link"
                        aria-expanded={isCommentsOpen}
                        onClick={() => toggleComments(post.id)}
                      >
                        <MessageCircle size={16} strokeWidth={1.5} aria-hidden="true" /> {post.comments} bình luận
                      </button>
                      <button
                        type="button"
                        className="qso__link qso__share"
                        onClick={() => handleShare(post.id)}
                      >
                        {copiedId === post.id ? 'Đã sao chép' : 'Chia sẻ'}
                      </button>
                    </footer>
                  ) : null}

                  {isCommentsOpen ? (
                    <div className="qso__comments">
                      {post.commentItems.length > 0 ? (
                        <ul className="qso__comment-list">
                          {post.commentItems.map((cmt) => (
                            <li key={cmt.id} className="qso__comment-item">
                              <span className="qx-avatar qso__comment-av" aria-hidden="true">
                                {initialsOf(cmt.author)}
                              </span>
                              <div className="qso__comment-body">
                                <div className="qso__comment-head">
                                  <strong>{cmt.author}</strong>
                                  <span>{cmt.time}</span>
                                </div>
                                <p>{cmt.content}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <form className="qso__comment-form" onSubmit={(e) => void handleCommentSubmit(e, post)}>
                        <input
                          type="text"
                          className="qso__comment-input"
                          placeholder="Viết bình luận phản hồi"
                          aria-label={`Bình luận bài viết của ${post.author}`}
                          value={commentDrafts[post.id] ?? ''}
                          onChange={(e) =>
                            setCommentDrafts((current) => ({ ...current, [post.id]: e.target.value }))
                          }
                        />
                        <button
                          type="submit"
                          className="qx-btn qx-btn--sm"
                          disabled={!(commentDrafts[post.id] ?? '').trim()}
                        >
                          Gửi
                        </button>
                      </form>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </section>

        <aside className="qso__side">
          <section className="qx-card qso__box">
            <div className="qso__box-head">
              <h2 className="qso__h">Thông báo nổi bật</h2>
              <span className="qso__meta-count">{NOTICES.length} mục</span>
            </div>
            <ul className="qso__notes">
              {NOTICES.map((notice) => {
                const Icon = notice.icon;
                return (
                  <li key={notice.id}>
                    <button
                      type="button"
                      className="qso__side-btn"
                      aria-pressed={activeNoticeId === notice.id}
                      onClick={() => handleSelectNotice(notice)}
                    >
                      <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                      <span className="qso__side-text">
                        <strong>{notice.title}</strong>
                        <span>{notice.sub}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="qx-card qso__box">
            <div className="qso__box-head">
              <h2 className="qso__h">Đầu mối phòng ban</h2>
              <span className="qso__meta-count">{COLLEAGUES.length} người</span>
            </div>
            <ul className="qso__people">
              {COLLEAGUES.map((c) => (
                <li key={c.name}>
                  <button
                    type="button"
                    className="qso__side-btn qso__side-btn--center"
                    aria-pressed={authorFilter === c.name}
                    onClick={() => handleSelectColleague(c.name)}
                  >
                    <span className="qx-avatar qso__av qso__av--muted" aria-hidden="true">{c.initials}</span>
                    <span className="qso__side-text">
                      <strong>{c.name}</strong>
                      <span>{c.role}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
