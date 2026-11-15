import type { Role, SocialCategory } from '@qsystem/contracts';
import { apiFetch } from '../api/client';

export interface SocialCommentItem {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  content: string;
  createdAt: string;
}

export interface SocialPostItem {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  departmentId: string | null;
  departmentName: string | null;
  category: SocialCategory;
  content: string;
  pinned: boolean;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  comments: SocialCommentItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SocialFeedFilter {
  category?: SocialCategory;
  departmentId?: string;
  authorId?: string;
  pinnedOnly?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
}

interface SocialFeedResponse {
  items: SocialPostItem[];
  total: number;
  page: number;
  pageSize: number;
}

export const SOCIAL_CATEGORIES: readonly { id: SocialCategory; label: string }[] = [
  { id: 'SHARING', label: 'Chia sẻ kinh nghiệm' },
  { id: 'ANNOUNCEMENT', label: 'Thông báo chung' },
  { id: 'KUDOS', label: 'Khen thưởng đồng nghiệp' },
  { id: 'QUESTION', label: 'Hỏi đáp công việc' },
];

const CATEGORY_LABELS: Record<SocialCategory, string> = {
  ANNOUNCEMENT: 'Thông báo chung',
  SHARING: 'Chia sẻ kinh nghiệm',
  KUDOS: 'Khen thưởng đồng nghiệp',
  QUESTION: 'Hỏi đáp công việc',
};

export function formatSocialCategory(category: SocialCategory | string): string {
  return CATEGORY_LABELS[category as SocialCategory] ?? 'Chia sẻ kinh nghiệm';
}

export async function listSocialPosts(filter?: SocialFeedFilter): Promise<SocialPostItem[]> {
  const params = new URLSearchParams();
  if (filter?.category) params.set('category', filter.category);
  if (filter?.departmentId) params.set('departmentId', filter.departmentId);
  if (filter?.authorId) params.set('authorId', filter.authorId);
  if (filter?.pinnedOnly) params.set('pinnedOnly', 'true');
  if (filter?.q) params.set('q', filter.q);
  if (filter?.page) params.set('page', String(filter.page));
  if (filter?.pageSize) params.set('pageSize', String(filter.pageSize));
  const qs = params.toString();
  const res = await apiFetch<SocialFeedResponse | SocialPostItem[]>(`/api/social/posts${qs ? `?${qs}` : ''}`);
  return Array.isArray(res) ? res : (res.items ?? []);
}

export async function createSocialPost(input: {
  content: string;
  category: SocialCategory;
  departmentId?: string | null;
  pinned?: boolean;
}): Promise<SocialPostItem> {
  const res = await apiFetch<{ ok: true; post: SocialPostItem }>('/api/social/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return res.post;
}

export async function updateSocialPost(
  id: string,
  input: { content?: string; category?: SocialCategory; pinned?: boolean },
): Promise<SocialPostItem> {
  const res = await apiFetch<{ ok: true; post: SocialPostItem }>(`/api/social/posts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return res.post;
}

export async function deleteSocialPost(id: string): Promise<void> {
  await apiFetch<{ ok: true; id: string }>(`/api/social/posts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function toggleSocialLike(id: string): Promise<{ liked: boolean; post: SocialPostItem }> {
  return apiFetch<{ ok: true; liked: boolean; post: SocialPostItem }>(
    `/api/social/posts/${encodeURIComponent(id)}/like`,
    { method: 'POST' },
  );
}

export async function addSocialComment(
  id: string,
  content: string,
): Promise<{ comment: SocialCommentItem; post: SocialPostItem }> {
  return apiFetch<{ ok: true; comment: SocialCommentItem; post: SocialPostItem }>(
    `/api/social/posts/${encodeURIComponent(id)}/comments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    },
  );
}

