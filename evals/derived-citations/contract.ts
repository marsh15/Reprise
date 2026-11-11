import { z } from 'zod';
import { createHash } from 'node:crypto';
import { sourceSchema } from '../../src/shared/research';

// Evaluation gold only. No production writer, automatic fact extraction, or model schema.
export const LIMITS = Object.freeze({ answer: 8192, equations: 1, sources: 16, bindings: 16,
  excerpt: 2048, quote: 1024, metadata: 512, minor: 999999999999n, precision: 3 });
export const CURRENCY_PRECISION = { USD: 2, EUR: 2, GBP: 2, INR: 2, JPY: 0, KWD: 3 } as const;
const short = z.string().min(1).max(80);
const source = sourceSchema.extend({
  n: z.number().int().min(1).max(999), rank: z.number().int().min(1).max(999),
  excerpt: z.string().max(LIMITS.excerpt), url: z.url().max(LIMITS.metadata),
  title: z.string().max(LIMITS.metadata).nullable(), publishedAt: z.string().max(64).nullable(),
  retrievedAt: z.string().max(64),
}).strict();
export const observationSchema = z.object({ source, role: z.enum(['historical', 'current']),
  kind: z.enum(['source', 'assistant']) }).strict();
export const reviewedOperandSchema = z.object({
  observation: observationSchema,
  span: z.object({ start: z.number().int().min(0).max(LIMITS.excerpt),
    end: z.number().int().min(1).max(LIMITS.excerpt), quote: z.string().min(1).max(LIMITS.quote) }).strict(),
  product: short.nullable(), plan: short.nullable(), amount: z.string().regex(/^[+-]?\d{1,12}(?:\.\d{1,3})?$/),
  currency: z.enum(['USD', 'EUR', 'GBP', 'INR', 'JPY', 'KWD']).nullable(),
  denominator: short.nullable(), period: z.enum(['month', 'year']).nullable(),
  billingPeriod: z.enum(['month', 'year']).nullable(),
  commitment: short.nullable(), offer: z.enum(['standard', 'introductory']).nullable(),
  ambiguities: z.array(short).max(8),
}).strict();
export const bindingSchema = z.object({ reviewId: short, digest: z.string().regex(/^[a-f0-9]{64}$/),
  reviewed: reviewedOperandSchema }).strict();
export const inputSchema = z.object({ answer: z.string().max(LIMITS.answer),
  observations: z.array(observationSchema).max(LIMITS.sources),
  bindings: z.array(bindingSchema).max(LIMITS.bindings) }).strict();
export type Observation = z.infer<typeof observationSchema>;
export type ReviewedOperand = z.infer<typeof reviewedOperandSchema>;
export type OperandBinding = z.infer<typeof bindingSchema>;
export type DerivedInput = z.infer<typeof inputSchema>;
export type Outcome = 'missing_direct_reference' | 'invalid_reference' | 'missing_or_stale_binding'
  | 'ambiguous_evidence' | 'incompatible_dimensions' | 'incorrect_arithmetic' | 'incorrect_direction'
  | 'arithmetic_checked_comparison_review' | 'supported_bounded_calculation' | 'review_required';
export type Diagnostic = { code: string; detail: string };
export type DerivedDiagnostic = {
  outcome: Outcome;
  arithmetic: 'not_checked' | 'checked' | 'incorrect';
  direction: 'not_stated' | 'checked' | 'incorrect' | 'not_checked';
  diagnostics: Diagnostic[];
  claim?: { text: string; leftMarker: number | null; rightMarker: number | null;
    leftSourceId?: string; rightSourceId?: string; computedMinor?: string; claimedMinor?: string };
  scope: 'Listed-amount subtraction only; no source-truth or effective-date verification.';
};

// A stale-review checksum, not authentication or a producer of trusted meanings.
export function operandReviewDigest(reviewed: ReviewedOperand): string {
  return createHash('sha256').update(JSON.stringify(reviewedOperandSchema.parse(reviewed))).digest('hex');
}
