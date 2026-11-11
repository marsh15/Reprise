import { expect, it } from 'vitest';
import { evaluateDerivedCitation as evaluate } from '../../evals/derived-citations/evaluate';
import { bind, EQUATION, example, observation } from '../fixtures/derived-citations/reviewed';

it.each([
  ['effective date', 'The price changed on 2026-11-11.'],
  ['contradictory comparison', 'Birch is cheaper than Aster.'],
  ['unavailable reference', 'Additional price evidence [9].'],
])('audit regression: escaped closing pipe cannot discard %s', (_name, prose) => {
  const result = evaluate({ ...example(), answer: `| ${EQUATION} | ${prose} \\|` });
  expect(result).toMatchObject({ outcome: 'review_required', arithmetic: 'not_checked' });
  expect(result.diagnostics.map(d => d.code)).toContain('unsupported_table_form');
});

it('audit regression: ordinary closing pipe preserves supported subtraction', () => {
  expect(evaluate({ ...example(), answer: `| Difference | ${EQUATION} |` }))
    .toMatchObject({ outcome: 'supported_bounded_calculation', arithmetic: 'checked',
      claim: { text: EQUATION, computedMinor: '1000', claimedMinor: '1000' } });
});

it('audit regression: escaped literal pipe stays inside legitimate note content', () => {
  const result = evaluate({ ...example(), answer: `| Note: Aster \\| Birch | ${EQUATION} |` });
  expect(result).toMatchObject({ outcome: 'arithmetic_checked_comparison_review', arithmetic: 'checked',
    claim: { text: EQUATION, computedMinor: '1000' } });
  expect(result.diagnostics.map(d => d.code)).toContain('unreviewed_surrounding_text');
});

it.each([
  [1, 'review_required', 'not_checked'],
  [2, 'arithmetic_checked_comparison_review', 'checked'],
  [3, 'review_required', 'not_checked'],
  [4, 'arithmetic_checked_comparison_review', 'checked'],
] as const)('audit regression: %i backslashes before an internal pipe respect parity', (count, outcome, arithmetic) => {
  const result = evaluate({ ...example(), answer: `| Note ${'\\'.repeat(count)}| ${EQUATION} |` });
  expect(result).toMatchObject({ outcome, arithmetic });
  if (arithmetic === 'checked') expect(result.claim?.text).toBe(EQUATION);
});

it.each([
  [1, 'review_required', 'not_checked'],
  [2, 'arithmetic_checked_comparison_review', 'checked'],
  [3, 'review_required', 'not_checked'],
  [4, 'arithmetic_checked_comparison_review', 'checked'],
] as const)('audit regression: %i backslashes before the terminal pipe respect parity', (count, outcome, arithmetic) => {
  const result = evaluate({ ...example(), answer: `| ${EQUATION} | Note ${'\\'.repeat(count)}|` });
  expect(result).toMatchObject({ outcome, arithmetic });
  if (arithmetic === 'checked') expect(result.claim?.text).toBe(EQUATION);
  else expect(result.diagnostics.map(d => d.code)).toContain('unsupported_table_form');
});

it.each([
  ['missing closing delimiter', `| ${EQUATION}`],
  ['escaped closing delimiter', `| ${EQUATION} \\|`],
  ['text after closing delimiter', `| ${EQUATION} | Unclosed cell`],
  ['malformed additional row', `${EQUATION}\n| Unclosed cell`],
  ['lone boundary', `${EQUATION}\n|`],
])('audit regression: malformed table requires review (%s)', (_name, answer) => {
  const result = evaluate({ ...example(), answer });
  expect(result).toMatchObject({ outcome: 'review_required', arithmetic: 'not_checked' });
  expect(result.diagnostics.map(d => d.code)).toContain('unsupported_table_form');
});

it.each([
  ['subscription', 'month', 'Calculated listed-price difference: ', 'supported_bounded_calculation'],
  ['seat', 'year', 'Calculated listed-price difference: ', 'supported_bounded_calculation'],
  ['seat', 'month', 'Calculated listed-price difference: ', 'supported_bounded_calculation'],
  ['subscription', 'year', 'Calculated listed-price difference: ', 'supported_bounded_calculation'],
  ['subscription', 'month', 'Calculated listed monthly subscription difference: ', 'review_required'],
  ['seat', 'year', 'Calculated listed monthly subscription difference: ', 'review_required'],
  ['seat', 'month', 'Calculated listed monthly subscription difference: ', 'review_required'],
  ['subscription', 'year', 'Calculated listed monthly subscription difference: ', 'review_required'],
] as const)('audit regression: /%s/%s with prefix %s yields %s', (denominator, period, prefix, outcome) => {
  // Both source text and reviewed dimensions are supplied independently of prefix recognition.
  const commitment = period === 'year' ? 'one-year commitment' : 'one-month commitment';
  const a = observation(1, `Aster Standard: USD 25 per ${denominator} per ${period}, billed ${period === 'year' ? 'annually' : 'monthly'}, ${commitment}, standard price.`);
  const b = observation(2, `Birch Standard: USD 35 per ${denominator} per ${period}, billed ${period === 'year' ? 'annually' : 'monthly'}, ${commitment}, standard price.`);
  const result = evaluate({ answer: prefix + EQUATION.replaceAll('/subscription/month', `/${denominator}/${period}`),
    observations: [a, b], bindings: [bind(a, { denominator, period, billingPeriod: period, commitment }),
      bind(b, { product: 'Birch', amount: '35', denominator, period, billingPeriod: period, commitment })] });
  expect(result.outcome).toBe(outcome);
  if (outcome === 'supported_bounded_calculation') {
    expect(result).toMatchObject({ arithmetic: 'checked', direction: 'checked',
      claim: { computedMinor: '1000', claimedMinor: '1000' } });
  } else {
    expect(result.arithmetic).toBe('not_checked');
    expect(result.diagnostics.map(d => d.code)).toContain('unsupported_claim_form');
  }
});
