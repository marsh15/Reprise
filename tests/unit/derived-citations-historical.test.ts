import { expect, it } from 'vitest';
import { historicalGold } from '../../evals/derived-citations/historicalGold';
import { evaluateDerivedCitation as evaluate } from '../../evals/derived-citations/evaluate';
const r2 = 'Birch standard subscription USD 35/subscription/month [3] minus Aster standard subscription USD 25/subscription/month [2] = USD 10/subscription/month more for Birch';
const r3 = 'Aster standard $ 25/month [2] minus Aster standard $ 20/month [1] = $ 5/month';

it('R2 checks the bound listed amounts but does not invent commitment', () => {
  const input = { ...historicalGold('R2'), answer: r2 }; const before = structuredClone(input);
  expect(evaluate(input)).toMatchObject({ outcome: 'arithmetic_checked_comparison_review', arithmetic: 'checked',
    claim: { computedMinor: '1000', leftMarker: 3, rightMarker: 2 } });
  expect(evaluate(input).diagnostics.some(d => d.detail.includes('commitment'))).toBe(true);
  expect(input).toEqual(before);
});
it('R2 keeps missing direct citations a coverage failure even with a correct equation', () => {
  expect(evaluate({ ...historicalGold('R2'), answer: r2.replace(/ \[\d\]/g, '') }).outcome).toBe('missing_direct_reference');
});
it('R2 rejects unrelated historical Pine despite its equal price and marker position', () => {
  expect(evaluate({ ...historicalGold('R2'), answer: r2.replace('[2]', '[1]') }).outcome).not.toBe('supported_bounded_calculation');
});
it('R3 preserves separate UUIDs at the same URL and unknown currency/denominator', () => {
  const input = { ...historicalGold('R3'), answer: r3 };
  expect(input.observations[0].source.url).toBe(input.observations[1].source.url);
  expect(evaluate(input)).toMatchObject({ outcome: 'ambiguous_evidence', arithmetic: 'not_checked',
    claim: { leftSourceId: '00000000-0000-4000-8000-000000000012', rightSourceId: '00000000-0000-4000-8000-000000000005' } });
  const details = evaluate(input).diagnostics.map(d => d.detail).join(' ');
  expect(details).toContain('currency'); expect(details).toContain('denominator'); expect(details).toContain('commitment');
});
it('R3 cannot obtain an effective date from subtraction or later retrieval', () => {
  const input = { ...historicalGold('R3'), answer: r3 + '\nThe price changed on 2026-11-11 [2].' };
  expect(evaluate(input).outcome).not.toBe('supported_bounded_calculation');
  expect(evaluate(input).scope).toContain('no source-truth or effective-date verification');
});
it('original derived prose cannot borrow adjacent cells or later caveat citations', () => {
  for (const [id, answer] of [
    ['R2', '| Birch | $35/month, flat USD [3] | $10/month more than Aster or Cedar |'],
    ['R3', 'That is a $5 difference between observations. The current evidence supplies no effective change date [2].'],
  ] as const) {
    const result = evaluate({ ...historicalGold(id), answer });
    expect(result.outcome).toBe('review_required');
    expect(result.diagnostics.map(d => d.code)).toContain('missing_direct_reference');
    expect(result.arithmetic).toBe('not_checked');
  }
});
