import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CreateSocialCommentSchema,
  CreateSocialPostSchema,
  SocialFeedQuerySchema,
  UpdateSocialPostSchema,
} from '@qsystem/contracts';
import { AuditService } from '../common/audit.service';
import { PrismaService, type ScopeViewer } from '../prisma/prisma.service';

function error(code: string, message: string, status: HttpStatus, details?: unknown): HttpException {
  return new HttpException(details ? { code, message, details } : { code, message }, status);
}

const POST_INCLUDE = {
  comments: {
    orderBy: { createdAt: 'asc' as const },
  },
  likes: {
    select: { userId: true },
  },
} as const;

type HydratedPost = Prisma.SocialPostGetPayload<{ include: typeof POST_INCLUDE }>;

export interface SocialCommentDto {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorRole: 'DIRECTOR' | 'MANAGER' | 'EMPLOYEE';
  content: string;
  createdAt: string;
}

export interface SocialPostDto {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: 'DIRECTOR' | 'MANAGER' | 'EMPLOYEE';
  departmentId: string | null;
  departmentName: string | null;
  category: 'ANNOUNCEMENT' | 'SHARING' | 'KUDOS' | 'QUESTION';
  content: string;
  pinned: boolean;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  comments: SocialCommentDto[];
  createdAt: string;
  updatedAt: string;
}

function formatPost(row: HydratedPost, viewerId: string): SocialPostDto {
  return {
    id: row.id,
    authorId: row.authorId,
    authorName: row.authorName,
    authorRole: row.authorRole,
    departmentId: row.departmentId,
    departmentName: row.departmentName ?? null,
    category: (row.category as SocialPostDto['category']) ?? 'SHARING',
    content: row.content,
    pinned: row.pinned,
    likeCount: row.likes.length,
    likedByMe: row.likes.some((like) => like.userId === viewerId),
    commentCount: row.comments.length,
    comments: row.comments.map((comment) => ({
      id: comment.id,
      postId: comment.postId,
      authorId: comment.authorId,
      authorName: comment.authorName,
      authorRole: comment.authorRole,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class SocialService {
  // Explicit @Inject tokens — Vitest compiles via esbuild without decorator metadata.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listPosts(viewer: ScopeViewer, rawQuery: Record<string, unknown>) {
    const parsed = SocialFeedQuerySchema.safeParse(rawQuery ?? {});
    if (!parsed.success) {
      throw error('INVALID_INPUT', 'Invalid social feed query', HttpStatus.BAD_REQUEST, parsed.error.issues);
    }
    const { category, departmentId, authorId, pinnedOnly, q, page, pageSize } = parsed.data;
    const trimmedQ = q?.trim();

    const where: Prisma.SocialPostWhereInput = {
      ...(category ? { category } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(authorId ? { authorId } : {}),
      ...(pinnedOnly ? { pinned: true } : {}),
      ...(trimmedQ
        ? {
            OR: [
              { content: { contains: trimmedQ, mode: 'insensitive' } },
              { authorName: { contains: trimmedQ, mode: 'insensitive' } },
              { departmentName: { contains: trimmedQ, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.withIdentity(viewer.id, async (tx) => {
      const rows = await tx.socialPost.findMany({
        where,
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: POST_INCLUDE,
      });
      const total = await tx.socialPost.count({ where });
      return {
        items: rows.map((row) => formatPost(row, viewer.id)),
        total,
        page,
        pageSize,
      };
    });
  }

  async createPost(viewer: ScopeViewer, raw: unknown) {
    const parsed = CreateSocialPostSchema.safeParse(raw ?? {});
    if (!parsed.success) {
      throw error('INVALID_INPUT', 'Invalid social post payload', HttpStatus.BAD_REQUEST, parsed.error.issues);
    }
    const body = parsed.data;
    if (body.pinned === true && viewer.role === 'EMPLOYEE') {
      throw error('FORBIDDEN', 'Only DIRECTOR or MANAGER may pin posts', HttpStatus.FORBIDDEN);
    }

    try {
      const created = await this.prisma.withIdentity(viewer.id, async (tx) => {
        const author = await tx.user.findUnique({
          where: { id: viewer.id },
          select: { name: true, role: true },
        });
        if (!author) {
          throw error('UNAUTHORIZED', 'Unknown author', HttpStatus.UNAUTHORIZED);
        }

        let departmentName: string | null = null;
        if (body.departmentId) {
          const rows = await tx.$queryRaw<Array<{ name: string | null }>>`
            SELECT app_department_name(${body.departmentId}) AS name
          `;
          departmentName = rows[0]?.name ?? null;
          if (!departmentName) {
            throw error('BAD_REQUEST', 'Unknown departmentId', HttpStatus.BAD_REQUEST);
          }
        }

        return tx.socialPost.create({
          data: {
            authorId: viewer.id,
            authorName: author.name,
            authorRole: author.role,
            departmentId: body.departmentId ?? null,
            departmentName,
            category: body.category,
            content: body.content,
            pinned: body.pinned ?? false,
            tenantId: null,
          },
          include: POST_INCLUDE,
        });
      });
      return { ok: true as const, post: formatPost(created, viewer.id) };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw error('BAD_REQUEST', 'Unknown departmentId', HttpStatus.BAD_REQUEST);
      }
      throw err;
    }
  }

  async updatePost(viewer: ScopeViewer, id: string, raw: unknown) {
    const parsed = UpdateSocialPostSchema.safeParse(raw ?? {});
    if (!parsed.success) {
      throw error('INVALID_INPUT', 'Invalid social post update payload', HttpStatus.BAD_REQUEST, parsed.error.issues);
    }
    const body = parsed.data;

    const existing = await this.prisma.withIdentity(viewer.id, (tx) =>
      tx.socialPost.findUnique({ where: { id } }),
    );
    if (!existing) {
      throw error('NOT_FOUND', 'Post not found', HttpStatus.NOT_FOUND);
    }

    if (body.pinned !== undefined && viewer.role === 'EMPLOYEE') {
      throw error('FORBIDDEN', 'Only DIRECTOR or MANAGER may pin posts', HttpStatus.FORBIDDEN);
    }
    if (
      (body.content !== undefined || body.category !== undefined) &&
      existing.authorId !== viewer.id &&
      viewer.role !== 'DIRECTOR'
    ) {
      throw error('FORBIDDEN', 'Only the post author or DIRECTOR may edit content', HttpStatus.FORBIDDEN);
    }

    const updated = await this.prisma.withIdentity(viewer.id, (tx) =>
      tx.socialPost.update({
        where: { id },
        data: {
          ...(body.content !== undefined ? { content: body.content } : {}),
          ...(body.category !== undefined ? { category: body.category } : {}),
          ...(body.pinned !== undefined ? { pinned: body.pinned } : {}),
        },
        include: POST_INCLUDE,
      }),
    );

    if (body.pinned !== undefined && body.pinned !== existing.pinned) {
      try {
        await this.audit.writeAudit({
          actorId: viewer.id,
          action: body.pinned ? 'PIN' : 'UNPIN',
          entity: 'SocialPost',
          entityId: id,
          oldData: { pinned: existing.pinned },
          newData: { pinned: updated.pinned },
        });
      } catch (auditErr) {
        // eslint-disable-next-line no-console
        console.error('qsystem: audit write failed for social post pin', id, auditErr);
      }
    }

    return { ok: true as const, post: formatPost(updated, viewer.id) };
  }

  async deletePost(viewer: ScopeViewer, id: string) {
    const existing = await this.prisma.withIdentity(viewer.id, (tx) =>
      tx.socialPost.findUnique({ where: { id } }),
    );
    if (!existing) {
      throw error('NOT_FOUND', 'Post not found', HttpStatus.NOT_FOUND);
    }
    if (existing.authorId !== viewer.id && viewer.role !== 'DIRECTOR') {
      throw error('FORBIDDEN', 'Only the post author or DIRECTOR may delete this post', HttpStatus.FORBIDDEN);
    }

    await this.prisma.withIdentity(viewer.id, (tx) => tx.socialPost.delete({ where: { id } }));

    try {
      await this.audit.writeAudit({
        actorId: viewer.id,
        action: 'DELETE',
        entity: 'SocialPost',
        entityId: id,
        oldData: { authorId: existing.authorId, category: existing.category },
      });
    } catch (auditErr) {
      // eslint-disable-next-line no-console
      console.error('qsystem: audit write failed for social post delete', id, auditErr);
    }

    return { ok: true as const, id };
  }

  async toggleLike(viewer: ScopeViewer, postId: string) {
    return this.prisma.withIdentity(viewer.id, async (tx) => {
      const exists = await tx.socialPost.findUnique({
        where: { id: postId },
        select: { id: true },
      });
      if (!exists) {
        throw error('NOT_FOUND', 'Post not found', HttpStatus.NOT_FOUND);
      }

      const key = { postId, userId: viewer.id };
      const existingLike = await tx.socialPostLike.findUnique({ where: { postId_userId: key } });
      let liked = false;
      if (existingLike) {
        await tx.socialPostLike.delete({ where: { postId_userId: key } });
        liked = false;
      } else {
        await tx.socialPostLike.create({ data: { postId, userId: viewer.id } });
        liked = true;
      }

      const hydrated = await tx.socialPost.findUniqueOrThrow({
        where: { id: postId },
        include: POST_INCLUDE,
      });
      return { ok: true as const, liked, post: formatPost(hydrated, viewer.id) };
    });
  }

  async addComment(viewer: ScopeViewer, postId: string, raw: unknown) {
    const parsed = CreateSocialCommentSchema.safeParse(raw ?? {});
    if (!parsed.success) {
      throw error('INVALID_INPUT', 'Invalid comment payload', HttpStatus.BAD_REQUEST, parsed.error.issues);
    }
    const body = parsed.data;

    return this.prisma.withIdentity(viewer.id, async (tx) => {
      const exists = await tx.socialPost.findUnique({
        where: { id: postId },
        select: { id: true },
      });
      if (!exists) {
        throw error('NOT_FOUND', 'Post not found', HttpStatus.NOT_FOUND);
      }

      const author = await tx.user.findUnique({
        where: { id: viewer.id },
        select: { name: true, role: true },
      });
      if (!author) {
        throw error('UNAUTHORIZED', 'Unknown author', HttpStatus.UNAUTHORIZED);
      }

      const created = await tx.socialComment.create({
        data: {
          postId,
          authorId: viewer.id,
          authorName: author.name,
          authorRole: author.role,
          content: body.content,
          tenantId: null,
        },
      });

      const hydrated = await tx.socialPost.findUniqueOrThrow({
        where: { id: postId },
        include: POST_INCLUDE,
      });

      return {
        ok: true as const,
        comment: {
          id: created.id,
          postId: created.postId,
          authorId: created.authorId,
          authorName: created.authorName,
          authorRole: created.authorRole,
          content: created.content,
          createdAt: created.createdAt.toISOString(),
        },
        post: formatPost(hydrated, viewer.id),
      };
    });
  }
}
