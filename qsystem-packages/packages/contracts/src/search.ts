import { z } from 'zod';

/**
 * Search query — Task 7 consumes verbatim.
 * limit/offset default (20/0); filters is an open string-keyed map.
 */
export const SearchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  filters: z.record(z.string(), z.unknown()).optional(),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

/** Search result page — Task 7 consumes verbatim. */
export const SearchResultSchema = z.object({
  hits: z.array(z.record(z.string(), z.unknown())),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;
