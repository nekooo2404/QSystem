import { z } from 'zod';

/** Internal company social post topics stored as stable DB keys. */
export const SocialCategorySchema = z.enum(['ANNOUNCEMENT', 'SHARING', 'KUDOS', 'QUESTION']);
export type SocialCategory = z.infer<typeof SocialCategorySchema>;

export const CreateSocialPostSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  category: SocialCategorySchema.default('SHARING'),
  departmentId: z.string().min(1).nullable().optional(),
  pinned: z.boolean().optional(),
});
export type CreateSocialPostInput = z.infer<typeof CreateSocialPostSchema>;

export const UpdateSocialPostSchema = z.object({
  content: z.string().trim().min(1).max(4000).optional(),
  category: SocialCategorySchema.optional(),
  pinned: z.boolean().optional(),
});
export type UpdateSocialPostInput = z.infer<typeof UpdateSocialPostSchema>;

export const CreateSocialCommentSchema = z.object({
  content: z.string().trim().min(1).max(1000),
});
export type CreateSocialCommentInput = z.infer<typeof CreateSocialCommentSchema>;

export const SocialFeedQuerySchema = z.object({
  category: SocialCategorySchema.optional(),
  departmentId: z.string().min(1).optional(),
  authorId: z.string().min(1).optional(),
  pinnedOnly: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type SocialFeedQueryInput = z.infer<typeof SocialFeedQuerySchema>;

