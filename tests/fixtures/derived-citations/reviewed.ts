import { operandReviewDigest } from '../../../evals/derived-citations/contract';
import type { DerivedInput, Observation, OperandBinding, ReviewedOperand } from '../../../evals/derived-citations/contract';

// Synthetic evaluation gold, explicitly inspected by the implementing reviewer. No real price facts.
// These fixtures supply operands, never the expected equation/result. Hashes detect stale review data,
// not truthful sources or authenticated human approval.
export function seal(reviewed: ReviewedOperand): OperandBinding {
  return { reviewId: 'synthetic-reviewed-v1', reviewed,
    digest: operandReviewDigest(reviewed) };
}
export function observation(n: number, excerpt: string, role: Observation['role'] = 'current'): Observation {
  return { role, kind: 'source', source: { n, rank: 1,
    sourceId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    searchId: '00000000-0000-4000-8000-000000000099', url: `https://example.test/pricing/${n}`,
    title: '[Synthetic] reviewed pricing', excerpt, publishedAt: null,
    retrievedAt: '2026-11-11T08:30:00Z', fixture: true } };
}
export function bind(obs: Observation, fields: Partial<ReviewedOperand> = {}): OperandBinding {
  return seal({ observation: structuredClone(obs), span: { start: 0, end: obs.source.excerpt.length, quote: obs.source.excerpt },
    product: 'Aster', plan: 'Standard', amount: '25', currency: 'USD',
    denominator: 'subscription', period: 'month', billingPeriod: 'month', commitment: 'one-month commitment', offer: 'standard',
    ambiguities: [], ...fields });
}
export const ASTER = 'Aster Standard: USD 25 per subscription per month, billed monthly, one-month commitment, standard price.';
export const BIRCH = 'Birch Standard: USD 35 per subscription per month, billed monthly, one-month commitment, standard price.';
export const EQUATION = 'Birch Standard USD 35/subscription/month [2] minus Aster Standard USD 25/subscription/month [1] = USD 10/subscription/month more for Birch';
export function example(): DerivedInput {
  const a = observation(1, ASTER); const b = observation(2, BIRCH);
  return { answer: EQUATION, observations: [a, b], bindings: [bind(a), bind(b, { product: 'Birch', amount: '35' })] };
}
