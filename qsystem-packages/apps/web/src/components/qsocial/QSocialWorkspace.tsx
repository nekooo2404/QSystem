'use client';

import * as React from 'react';
import type { MeResponse, Role, SocialCategory } from '@qsystem/contracts';
import {
  Award,
  Building2,
  HelpCircle,
  Megaphone,
  MessageSquare,
  Pin,
  PinOff,
  Send,
  Share2,
  ThumbsUp,
  Trash2,
  Users,
} from 'lucide-react';
import { Button, StateRegion, UnderlineTabs, toast } from '@qsystem/ui';
import { formatRole } from '../../lib/adapters/notifications.adapter';
import {
  SOCIAL_CATEGORIES,
  addSocialComment,
  createSocialPost,
  deleteSocialPost,
  formatSocialCategory,
  listSocialPosts,
  toggleSocialLike,
  updateSocialPost,
  type SocialPostItem,
} from '../../lib/adapters/social.adapter';
import { apiFetch, ApiError } from '../../lib/api/client';
import { humanizeApiError } from '../../lib/errors/humanize';

interface DepartmentItem {
  id: string;
  name: string;
}

interface ColleagueItem {
  id: string;
  name: string;
  role: Role;
}

type ChannelSelection =
  | { kind: 'all' }
  | { kind: 'category'; category: SocialCategory }
  | { kind: 'department'; departmentId: string };

type ScopeTab = 'all' | 'pinned' | 'mine';

const FEED_TABS = [
  { id: 'all', label: 'Tất cả bài viết' },
  { id: 'pinned', label: 'Đã ghim' },
  { id: 'mine', label: 'Của tôi' },
] as const;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Q';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function categoryIcon(category: SocialCategory) {
  switch (category) {
    case 'ANNOUNCEMENT':
      return <Megaphone size={16} strokeWidth={1.5} aria-hidden="true" />;
    case 'KUDOS':
      return <Award size={16} strokeWidth={1.5} aria-hidden="true" />;
    case 'QUESTION':
      return <HelpCircle size={16} strokeWidth={1.5} aria-hidden="true" />;
    case 'SHARING':
    default:
      return <Share2 size={16} strokeWidth={1.5} aria-hidden="true" />;
  }
}

function sortPosts(posts: SocialPostItem[]): SocialPostItem[] {
  return [...posts].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

const SYNTHETIC_DEPT_RE =
  /^(?:(?:iam|sensors|rls|pr|dbg\d*|notify|social|audit|search|storage|e2e|r\d+)[-_:\s]|phong\s+mau$)/i;
const SYNTHETIC_USER_RE =
  /^(?:(?:iam|sensors|rls|pr|dbg\d*|notify|social|audit|search|storage|e2e|r\d+)\b|(?:employee|emp|user|staff|manager|director)\s*[a-z0-9]*$)/i;

function isRealDepartment(dept: DepartmentItem): boolean {
  return !SYNTHETIC_DEPT_RE.test(dept.name.trim());
}

function isRealColleague(person: ColleagueItem): boolean {
  return !SYNTHETIC_USER_RE.test(person.name.trim());
}

export function QSocialWorkspace({ me }: { me: MeResponse }) {
  const [posts, setPosts] = React.useState<SocialPostItem[]>([]);
  const [departments, setDepartments] = React.useState<DepartmentItem[]>([]);
  const [colleagues, setColleagues] = React.useState<ColleagueItem[]>([]);
  const [state, setState] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [errorText, setErrorText] = React.useState<string>('Không tải được bảng tin nội bộ.');

  const [channel, setChannel] = React.useState<ChannelSelection>({ kind: 'all' });
  const [tab, setTab] = React.useState<ScopeTab>('all');
  const [search, setSearch] = React.useState('');

  const [draftContent, setDraftContent] = React.useState('');
  const [draftCategory, setDraftCategory] = React.useState<SocialCategory>('SHARING');
  const [draftDepartmentId, setDraftDepartmentId] = React.useState<string>('');
  const [draftPinned, setDraftPinned] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const [commentDrafts, setCommentDrafts] = React.useState<Record<string, string>>({});
  const [commentPendingId, setCommentPendingId] = React.useState<string | null>(null);
  const [likePendingId, setLikePendingId] = React.useState<string | null>(null);
  const [actionPendingId, setActionPendingId] = React.useState<string | null>(null);
  const commentInputsRef = React.useRef<Record<string, HTMLInputElement | null>>({});

  const canPin = me.role === 'DIRECTOR' || me.role === 'MANAGER';

  const loadFeed = React.useCallback(async () => {
    setState('loading');
    try {
      const feed = await listSocialPosts();
      setPosts(sortPosts(feed));
      setState('ready');
    } catch (err) {
      setErrorText(
        humanizeApiError(
          err instanceof ApiError ? err.code : undefined,
          err instanceof ApiError ? err.status : undefined,
        ),
      );
      setState('error');
    }
  }, []);

  React.useEffect(() => {
    void loadFeed();
    void apiFetch<DepartmentItem[]>('/api/org/departments').then(
      (items) => setDepartments(items.filter(isRealDepartment)),
      () => {},
    );
    void apiFetch<ColleagueItem[]>('/api/org/users').then(
      (items) => setColleagues(items.filter(isRealColleague)),
      () => {},
    );
  }, [loadFeed]);

  function replacePost(updated: SocialPostItem) {
    setPosts((current) => sortPosts([updated, ...current.filter((entry) => entry.id !== updated.id)]));
  }

  async function handlePublish(event: React.FormEvent) {
    event.preventDefault();
    const content = draftContent.trim();
    if (!content) {
      toast.error('Vui lòng nhập nội dung trước khi đăng bài');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createSocialPost({
        content,
        category: draftCategory,
        departmentId: draftDepartmentId || null,
        ...(canPin && draftPinned ? { pinned: true } : {}),
      });
      replacePost(created);
      setDraftContent('');
      setDraftPinned(false);
      toast.success('Đã đăng bài viết lên bảng tin');
    } catch (err) {
      toast.error(
        humanizeApiError(
          err instanceof ApiError ? err.code : undefined,
          err instanceof ApiError ? err.status : undefined,
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleLike(postId: string) {
    setLikePendingId(postId);
    try {
      const result = await toggleSocialLike(postId);
      replacePost(result.post);
    } catch {
      toast.error('Chưa cập nhật được lượt thích, vui lòng thử lại');
    } finally {
      setLikePendingId(null);
    }
  }

  async function handleTogglePin(post: SocialPostItem) {
    setActionPendingId(post.id);
    try {
      const updated = await updateSocialPost(post.id, { pinned: !post.pinned });
      replacePost(updated);
      toast.success(updated.pinned ? 'Đã ghim bài viết lên đầu bảng tin' : 'Đã bỏ ghim bài viết');
    } catch {
      toast.error('Không thay đổi được trạng thái ghim');
    } finally {
      setActionPendingId(null);
    }
  }

  async function handleDeletePost(postId: string) {
    setActionPendingId(postId);
    try {
      await deleteSocialPost(postId);
      setPosts((current) => current.filter((entry) => entry.id !== postId));
      toast.success('Đã xóa bài viết khỏi bảng tin');
    } catch {
      toast.error('Không xóa được bài viết');
    } finally {
      setActionPendingId(null);
    }
  }

  async function handleCommentSubmit(event: React.FormEvent, postId: string) {
    event.preventDefault();
    const text = (commentDrafts[postId] ?? '').trim();
    if (!text) return;
    setCommentPendingId(postId);
    try {
      const result = await addSocialComment(postId, text);
      replacePost(result.post);
      setCommentDrafts((current) => ({ ...current, [postId]: '' }));
    } catch {
      toast.error('Chưa gửi được bình luận, vui lòng thử lại');
    } finally {
      setCommentPendingId(null);
    }
  }

  const needle = search.trim().toLowerCase();
  const visiblePosts = posts.filter((post) => {
    if (channel.kind === 'category' && post.category !== channel.category) return false;
    if (channel.kind === 'department' && post.departmentId !== channel.departmentId) return false;
    if (tab === 'pinned' && !post.pinned) return false;
    if (tab === 'mine' && post.authorId !== me.id) return false;
    if (needle) {
      const hay = `${post.content} ${post.authorName} ${post.departmentName ?? ''}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const activeChannelLabel =
    channel.kind === 'all'
      ? 'Toàn công ty'
      : channel.kind === 'category'
        ? formatSocialCategory(channel.category)
        : (departments.find((dept) => dept.id === channel.departmentId)?.name ?? 'Phòng ban');

  const pinnedHighlights = posts.filter((post) => post.pinned).slice(0, 4);

  const directoryMap = new Map<string, ColleagueItem>();
  directoryMap.set(me.id, { id: me.id, name: me.name, role: me.role });
  for (const person of colleagues) {
    directoryMap.set(person.id, { id: person.id, name: person.name, role: person.role });
  }
  for (const post of posts) {
    if (!directoryMap.has(post.authorId)) {
      directoryMap.set(post.authorId, {
        id: post.authorId,
        name: post.authorName,
        role: post.authorRole,
      });
    }
  }
  const activeDirectory = Array.from(directoryMap.values()).slice(0, 8);

  return (
    <section className="qsc" aria-label="Bảng tin nội bộ">
      <header className="qsc__head">
        <h1>Bảng tin: {activeChannelLabel}</h1>
        <span className="qsc__count">{visiblePosts.length} bài viết</span>
      </header>

      <div className="qsc__body">
        <nav aria-label="Kênh bảng tin" className="qsc__channels">
          <div className="qsc__channel-group">
            <p className="qsc__channel-heading">Chủ đề nội bộ</p>
            <button
              type="button"
              className={channel.kind === 'all' ? 'qs-qhrm__dept is-active' : 'qs-qhrm__dept'}
              aria-pressed={channel.kind === 'all'}
              onClick={() => setChannel({ kind: 'all' })}
            >
              <span className="qsc__channel-name">
                <Users size={16} strokeWidth={1.5} aria-hidden="true" />
                <span className="qsc__channel-label">Toàn công ty</span>
              </span>
              <span className="qs-qhrm__dept-count">{posts.length}</span>
            </button>
            {SOCIAL_CATEGORIES.map((topic) => {
              const active = channel.kind === 'category' && channel.category === topic.id;
              return (
                <button
                  key={topic.id}
                  type="button"
                  className={active ? 'qs-qhrm__dept is-active' : 'qs-qhrm__dept'}
                  aria-pressed={active}
                  onClick={() => setChannel({ kind: 'category', category: topic.id })}
                >
                  <span className="qsc__channel-name">
                    {categoryIcon(topic.id)}
                    <span className="qsc__channel-label">{topic.label}</span>
                  </span>
                  <span className="qs-qhrm__dept-count">
                    {posts.filter((entry) => entry.category === topic.id).length}
                  </span>
                </button>
              );
            })}
          </div>

          {departments.length > 0 ? (
            <div className="qsc__channel-group">
              <p className="qsc__channel-heading">Kênh phòng ban</p>
              {departments.map((dept) => {
                const active = channel.kind === 'department' && channel.departmentId === dept.id;
                return (
                  <button
                    key={dept.id}
                    type="button"
                    className={active ? 'qs-qhrm__dept is-active' : 'qs-qhrm__dept'}
                    aria-pressed={active}
                    onClick={() => setChannel({ kind: 'department', departmentId: dept.id })}
                  >
                    <span className="qsc__channel-name">
                      <Building2 size={16} strokeWidth={1.5} aria-hidden="true" />
                      <span className="qsc__channel-label">{dept.name}</span>
                    </span>
                    <span className="qs-qhrm__dept-count">
                      {posts.filter((entry) => entry.departmentId === dept.id).length}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </nav>

        <div className="qsc__main">
          <form className="qsc-composer" aria-label="Đăng bài viết mới" onSubmit={handlePublish}>
            <div className="qsc-composer__head">
              <span className="qsc-avatar" aria-hidden="true">
                {initialsOf(me.name)}
              </span>
              <div className="qsc-composer__who">
                <span className="qsc-composer__name">{me.name}</span>
                <span className="qsc-composer__role">{formatRole(me.role)}</span>
              </div>
            </div>

            <textarea
              className="qs-input qsc-composer__textarea"
              aria-label="Nội dung bài viết"
              rows={3}
              disabled={submitting}
              placeholder="Chia sẻ thông báo, kinh nghiệm hoặc lời khen tới đồng nghiệp"
              value={draftContent}
              onChange={(event) => setDraftContent(event.target.value)}
            />

            <div className="qsc-composer__bar">
              <div className="qsc-composer__controls">
                <select
                  className="qs-input qsc-composer__select"
                  aria-label="Chủ đề bài viết"
                  disabled={submitting}
                  value={draftCategory}
                  onChange={(event) => setDraftCategory(event.target.value as SocialCategory)}
                >
                  {SOCIAL_CATEGORIES.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.label}
                    </option>
                  ))}
                </select>

                <select
                  className="qs-input qsc-composer__select"
                  aria-label="Kênh phòng ban"
                  disabled={submitting}
                  value={draftDepartmentId}
                  onChange={(event) => setDraftDepartmentId(event.target.value)}
                >
                  <option value="">Toàn công ty</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>

                {canPin ? (
                  <label className="qsc-pin-check">
                    <input
                      type="checkbox"
                      disabled={submitting}
                      checked={draftPinned}
                      onChange={(event) => setDraftPinned(event.target.checked)}
                    />
                    <span>Ghim đầu bảng tin</span>
                  </label>
                ) : null}
              </div>

              <Button type="submit" loading={submitting} loadingText="Đang đăng">
                <Send size={16} strokeWidth={1.5} aria-hidden="true" />
                Đăng bài
              </Button>
            </div>
          </form>

          <div className="qsc__toolbar">
            <UnderlineTabs
              aria-label="Phạm vi bảng tin"
              activeId={tab}
              onChange={(next) => setTab(next as ScopeTab)}
              tabs={[...FEED_TABS]}
            />
            <input
              type="search"
              className="qs-input qsc__search"
              aria-label="Tìm kiếm bài viết"
              placeholder="Tìm nội dung hoặc người đăng"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <StateRegion
            state={state === 'ready' && visiblePosts.length === 0 ? 'empty' : state}
            rows={4}
            emptyTitle="Chưa có bài viết nào phù hợp"
            emptyDescription="Hãy là người đầu tiên chia sẻ cập nhật mới lên bảng tin nội bộ."
            errorDescription={errorText}
            onRetry={() => void loadFeed()}
          >
            <div className="qsc-feed">
              {visiblePosts.map((post) => {
                const categoryLabel = formatSocialCategory(post.category);
                const canDelete = post.authorId === me.id || me.role === 'DIRECTOR';
                return (
                  <article
                    key={post.id}
                    className="qsc-post"
                    data-pinned={post.pinned ? 'true' : 'false'}
                  >
                    <header className="qsc-post__header">
                      <div className="qsc-post__author-row">
                        <span className="qsc-avatar" aria-hidden="true">
                          {initialsOf(post.authorName)}
                        </span>
                        <div className="qsc-post__meta">
                          <div className="qsc-post__author-line">
                            <span className="qsc-post__author">{post.authorName}</span>
                            <span className="qsc-post__role">{formatRole(post.authorRole)}</span>
                          </div>
                          <div className="qsc-post__subline">
                            <time dateTime={post.createdAt}>{formatDateTime(post.createdAt)}</time>
                            <span>{post.departmentName ?? 'Toàn công ty'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="qsc-post__badges">
                        {post.pinned ? (
                          <span className="qtk-badge">Đã ghim</span>
                        ) : null}
                        <span className="qtk-badge" data-category={categoryLabel}>
                          {categoryLabel}
                        </span>
                        {canPin ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={actionPendingId === post.id}
                            aria-label={post.pinned ? 'Bỏ ghim bài viết' : 'Ghim bài viết'}
                            onClick={() => void handleTogglePin(post)}
                          >
                            {post.pinned ? (
                              <PinOff size={16} strokeWidth={1.5} aria-hidden="true" />
                            ) : (
                              <Pin size={16} strokeWidth={1.5} aria-hidden="true" />
                            )}
                            {post.pinned ? 'Bỏ ghim' : 'Ghim'}
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={actionPendingId === post.id}
                            aria-label="Xóa bài viết"
                            onClick={() => void handleDeletePost(post.id)}
                          >
                            <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
                            Xóa
                          </Button>
                        ) : null}
                      </div>
                    </header>

                    <p className="qsc-post__content">{post.content}</p>

                    <div className="qsc-post__actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={likePendingId === post.id}
                        aria-pressed={post.likedByMe}
                        className={post.likedByMe ? 'qsc-like-btn is-liked' : 'qsc-like-btn'}
                        onClick={() => void handleToggleLike(post.id)}
                      >
                        <ThumbsUp size={16} strokeWidth={1.5} aria-hidden="true" />
                        {post.likedByMe ? 'Đã thích' : 'Thích'} ({post.likeCount})
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => commentInputsRef.current[post.id]?.focus()}
                      >
                        <MessageSquare size={16} strokeWidth={1.5} aria-hidden="true" />
                        Bình luận ({post.commentCount})
                      </Button>
                    </div>

                    <div className="qsc-comments">
                      {post.comments.length > 0 ? (
                        <ul className="qsc-comments__list" aria-label="Danh sách bình luận">
                          {post.comments.map((comment) => (
                            <li key={comment.id} className="qsc-comment">
                              <span className="qsc-avatar qsc-avatar--sm" aria-hidden="true">
                                {initialsOf(comment.authorName)}
                              </span>
                              <div className="qsc-comment__body">
                                <div className="qsc-comment__head">
                                  <span className="qsc-comment__author">{comment.authorName}</span>
                                  <span className="qsc-comment__role">{formatRole(comment.authorRole)}</span>
                                  <time className="qsc-comment__time" dateTime={comment.createdAt}>
                                    {formatDateTime(comment.createdAt)}
                                  </time>
                                </div>
                                <p className="qsc-comment__text">{comment.content}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      <form
                        className="qsc-comment-form"
                        onSubmit={(event) => void handleCommentSubmit(event, post.id)}
                      >
                        <input
                          ref={(node) => {
                            commentInputsRef.current[post.id] = node;
                          }}
                          type="text"
                          className="qs-input"
                          aria-label={`Viết bình luận cho bài viết của ${post.authorName}`}
                          disabled={commentPendingId === post.id}
                          placeholder="Viết bình luận trao đổi"
                          value={commentDrafts[post.id] ?? ''}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setCommentDrafts((current) => ({ ...current, [post.id]: nextValue }));
                          }}
                        />
                        <Button
                          type="submit"
                          variant="secondary"
                          size="md"
                          loading={commentPendingId === post.id}
                          disabled={commentPendingId === post.id || !(commentDrafts[post.id] ?? '').trim()}
                        >
                          Gửi
                        </Button>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          </StateRegion>
        </div>

        <aside className="qsc__aside" aria-label="Thông tin nội bộ">
          <div className="qsc__aside-block">
            <h2>Tiêu điểm đã ghim</h2>
            {pinnedHighlights.length === 0 ? (
              <p className="qsc__aside-empty">Chưa có bài viết nào được ghim.</p>
            ) : (
              <ul className="qsc__aside-list">
                {pinnedHighlights.map((item) => (
                  <li key={item.id} className="qsc__aside-item">
                    <span className="qsc__aside-title">{item.authorName}</span>
                    <span className="qsc__aside-snippet">{item.content}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="qsc__aside-block">
            <h2>Đồng nghiệp trực tuyến</h2>
            <ul className="qsc__aside-list">
              {activeDirectory.map((person) => (
                <li key={person.id} className="qsc__member">
                  <span className="qsc-avatar qsc-avatar--sm" aria-hidden="true">
                    {initialsOf(person.name)}
                  </span>
                  <div className="qsc__member-meta">
                    <span className="qsc__aside-title">{person.name}</span>
                    <span className="qsc__aside-sub">{formatRole(person.role)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}
