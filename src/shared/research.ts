import { z } from 'zod';

export const searchRequestSchema = z.object({
  query: z.string().trim().min(1).max(300), freshness: z.enum(['any', 'day', 'week', 'month', 'year']),
}).strict();
export type SearchRequest = z.infer<typeof searchRequestSchema>;
export const searchResultSchema = z.object({ url: z.string(), title: z.string().nullable(), content: z.string(), publishedAt: z.string().nullable(), retrievedAt: z.iso.datetime().optional(), fixture: z.boolean().optional() });
export const searchOutcomeSchema = z.object({
  status: z.enum(['ok', 'empty', 'error', 'timeout']), results: z.array(searchResultSchema),
  durationMs: z.number().nonnegative(), error: z.string().optional(),
});
export type SearchOutcome = z.infer<typeof searchOutcomeSchema>;
export type Search = (request: SearchRequest, signal: AbortSignal) => Promise<SearchOutcome>;
export const sourceSchema = z.object({
  sourceId: z.uuid(), searchId: z.uuid(), rank: z.number().int(), n: z.number().int().positive(),
  url: z.url(), title: z.string().nullable(), excerpt: z.string(),
  publishedAt: z.string().nullable(), retrievedAt: z.string(), fixture: z.boolean(),
});
export type SourceRecord = z.infer<typeof sourceSchema>;
export const searchRecordSchema = z.object({
  id: z.uuid(), round: z.number().int(), query: z.string(), freshness: z.string(),
  startedAt: z.string(), durationMs: z.number().nonnegative(),
  status: z.enum(['ok', 'empty', 'error', 'timeout', 'skipped_budget']), error: z.string().optional(),
});
export type SearchRecord = z.infer<typeof searchRecordSchema>;
export const citationSchema = z.object({
  marker: z.number().int(), sourceId: z.string().nullable(),
  state: z.enum(['verified', 'unverified', 'unchecked', 'invalid']), detail: z.string().nullable(),
});
export type CitationRecord = z.infer<typeof citationSchema>;
export const evidenceSchema = z.object({ searches: z.array(searchRecordSchema), sources: z.array(sourceSchema), citations: z.array(citationSchema) });
export type Evidence = z.infer<typeof evidenceSchema>;
