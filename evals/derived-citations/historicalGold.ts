import { operandReviewDigest } from './contract';
import type { DerivedInput, Observation, ReviewedOperand } from './contract';

// Curated SYNTHETIC R2/R3 observations, manually reviewed against the original frozen
// reports and cassettes. Not a binding producer: meanings below are literal gold data.
// Missing commercial details intentionally remain null. No original source is repaired.
function source(id: string, search: string, n: number, vendor: string, excerpt: string, historical = false): Observation {
  return { kind: 'source', role: historical ? 'historical' : 'current', source: {
    sourceId: `00000000-0000-4000-8000-${id}`, searchId: `00000000-0000-4000-8000-${search}`,
    n, rank: 1, url: `https://${vendor.toLowerCase()}.example/pricing`,
    title: `[${historical ? 'Demo' : 'Synthetic'}] ${vendor} pricing`, excerpt, publishedAt: null,
    retrievedAt: historical ? '2026-11-03T08:00:00.000Z' : '2026-11-11T08:30:00Z', fixture: true,
  } };
}
const pine = source('000000000005', '000000000004', 1, 'Pine', '[Synthetic] Pine costs $25 monthly.', true);
const aster = source('000000000014', '000000000011', 2, 'Aster', '[Synthetic evaluation evidence] Aster standard subscription costs $25 monthly, flat USD.');
const birch = source('000000000015', '000000000012', 3, 'Birch', '[Synthetic evaluation evidence] Birch standard subscription costs $35 monthly, flat USD.');
const cedar = source('000000000016', '000000000013', 4, 'Cedar', '[Synthetic evaluation evidence] Cedar standard subscription costs $25 monthly, flat USD.');
const previous = source('000000000005', '000000000004', 1, 'Aster', '[Synthetic] Aster standard monthly price $20 on 2026-11-03.', true);
const current = source('000000000012', '000000000011', 2, 'Aster', '[Synthetic evaluation evidence] Aster standard monthly price $25 on 2026-11-11. No historical price or effective change date is established.');

function reviewed(observation: Observation, fields: Pick<ReviewedOperand, 'product' | 'plan' | 'amount' | 'currency' | 'denominator' | 'offer'>): ReviewedOperand {
  return { observation, span: { start: 0, end: observation.source.excerpt.length, quote: observation.source.excerpt },
    period: 'month', billingPeriod: null, commitment: null, ambiguities: [], ...fields };
}
const gold = {
  R2: [
    reviewed(pine, { product: 'Pine', plan: null, amount: '25', currency: null, denominator: null, offer: null }),
    reviewed(aster, { product: 'Aster', plan: 'standard subscription', amount: '25', currency: 'USD', denominator: 'subscription', offer: 'standard' }),
    reviewed(birch, { product: 'Birch', plan: 'standard subscription', amount: '35', currency: 'USD', denominator: 'subscription', offer: 'standard' }),
    reviewed(cedar, { product: 'Cedar', plan: 'standard subscription', amount: '25', currency: 'USD', denominator: 'subscription', offer: 'standard' }),
  ],
  R3: [
    reviewed(previous, { product: 'Aster', plan: 'standard', amount: '20', currency: null, denominator: null, offer: 'standard' }),
    reviewed(current, { product: 'Aster', plan: 'standard', amount: '25', currency: null, denominator: null, offer: 'standard' }),
  ],
};
export function historicalGold(id: 'R2' | 'R3'): Omit<DerivedInput, 'answer'> {
  // Clone the fixed review records, not the caller's source text or model-authored meanings.
  const operands = structuredClone(gold[id]);
  return { observations: operands.map(r => r.observation), bindings: operands.map(reviewed => ({
    reviewId: `original-synthetic-${id}-v1`, reviewed, digest: operandReviewDigest(reviewed),
  })) };
}
