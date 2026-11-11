import { expect, it } from 'vitest';
import { evaluateDerivedCitation as evaluate } from '../../evals/derived-citations/evaluate';
import { LIMITS } from '../../evals/derived-citations/contract';
import { bind, EQUATION, example, observation, seal } from '../fixtures/derived-citations/reviewed';

it.each([
  ['missing right marker', EQUATION.replace(' [1]', ''), 'missing_direct_reference'],
  ['missing left marker', EQUATION.replace(' [2]', ''), 'missing_direct_reference'],
  ['unknown marker', EQUATION.replace('[2]', '[9]'), 'invalid_reference'],
  ['duplicate marker', EQUATION.replace('[1]', '[2]'), 'ambiguous_evidence'],
  ['wrong signed result', EQUATION.replace('= USD 10', '= USD -10'), 'incorrect_arithmetic'],
  ['changed operand amount', EQUATION.replace('USD 35/', 'USD 36/'), 'ambiguous_evidence'],
  ['wrong vendor with same price', EQUATION.replace('Aster Standard', 'Pine Standard'), 'ambiguous_evidence'],
  ['reversed direction', EQUATION.replace('more for', 'less for'), 'incorrect_direction'],
  ['wrong direction subject', EQUATION.replace('more for Birch', 'more for Aster'), 'incorrect_direction'],
  ['adjacent table references', `| ${EQUATION.replace(/ \[\d\]/g, '')} | [2] [1] |`, 'missing_direct_reference'],
  ['later bibliography', EQUATION.replace(/ \[\d\]/g, '') + '\nSources: [2] [1]', 'missing_direct_reference'],
  ['adjacent sentence', EQUATION.replace(/ \[\d\]/g, '') + '. Sources [2] [1].', 'missing_direct_reference'],
] as const)('rejects answer mutation: %s', (_name, answer, outcome) => {
  const input = example(); const before = structuredClone(input.bindings);
  expect(evaluate({ ...input, answer }).outcome).toBe(outcome);
  expect(input.bindings).toEqual(before);
});

it('recognizes the actual positive subtraction, resolves UUIDs and preserves inputs', () => {
  const input = example(); const before = structuredClone(input);
  expect(evaluate(input)).toMatchObject({ outcome: 'supported_bounded_calculation', arithmetic: 'checked', direction: 'checked',
    claim: { leftMarker: 2, rightMarker: 1, leftSourceId: input.observations[1].source.sourceId,
      rightSourceId: input.observations[0].source.sourceId, computedMinor: '1000', claimedMinor: '1000' } });
  expect(input).toEqual(before);
});
it('accepts a standalone explicitly supported table cell without row inference', () => {
  expect(evaluate({ ...example(), answer: `| Difference | ${EQUATION} |` }).outcome).toBe('supported_bounded_calculation');
});
it('accepts the design prefix and Unicode subtraction', () => {
  expect(evaluate({ ...example(), answer: 'Calculated listed-price difference: ' + EQUATION.replace(' minus ', ' − ') + '.' }).outcome).toBe('supported_bounded_calculation');
});
it('checks a negative signed difference', () => {
  expect(evaluate({ ...example(), answer: 'Aster Standard USD 25/subscription/month [1] minus Birch Standard USD 35/subscription/month [2] = USD -10/subscription/month less for Aster' }))
    .toMatchObject({ outcome: 'supported_bounded_calculation', claim: { computedMinor: '-1000' } });
});
it('checks zero between independently referenced observations', () => {
  const input = example(); const c = observation(3, 'Cedar Standard: USD 25 per subscription per month, billed monthly, one-month commitment, standard price.');
  input.observations.push(c); input.bindings.push(bind(c, { product: 'Cedar' }));
  input.answer = 'Aster Standard USD 25/subscription/month [1] minus Cedar Standard USD 25/subscription/month [3] = USD 0/subscription/month equal';
  expect(evaluate(input)).toMatchObject({ outcome: 'supported_bounded_calculation', claim: { computedMinor: '0' } });
});
it.each([
  ['currency', 'EUR', 'different currencies'], ['denominator', 'seat', 'per-seat versus per-project/flat'],
  ['denominator', 'request', 'flat versus usage'], ['period', 'year', 'monthly versus annual'],
  ['commitment', 'annual commitment', 'conflicting commitments'], ['offer', 'introductory', 'introductory versus standard'],
] as const)('rejects known incompatible %s (%s): %s', (field, value, _case) => {
  const input = example(); const r = input.bindings[0].reviewed;
  // A distinct synthetic case with consistent source text and reviewed meaning.
  const replacements = { currency: ['USD', value], denominator: ['subscription', value],
    period: ['per month', `per ${value}`], commitment: ['one-month commitment', value], offer: ['standard price', `${value} price`] };
  const [before, after] = replacements[field];
  input.observations[0].source.excerpt = input.observations[0].source.excerpt.replace(before, after);
  input.bindings[0] = bind(input.observations[0], { ...r, observation: input.observations[0],
    span: { start: 0, end: input.observations[0].source.excerpt.length, quote: input.observations[0].source.excerpt }, [field]: value });
  expect(evaluate(input).outcome).toBe('incompatible_dimensions');
});
it.each(['commitment', 'billingPeriod', 'denominator', 'period', 'plan', 'offer', 'currency', 'product'] as const)('never fills unknown %s from model text', field => {
  const input = example(); input.bindings[0] = seal({ ...input.bindings[0].reviewed, [field]: null });
  expect(evaluate(input).outcome).not.toBe('supported_bounded_calculation');
});
it('checks arithmetic with two unknown commitments without asserting equivalence', () => {
  const input = example(); input.bindings = input.bindings.map(b => seal({ ...b.reviewed, commitment: null }));
  expect(evaluate(input)).toMatchObject({ outcome: 'arithmetic_checked_comparison_review', arithmetic: 'checked' });
});
it.each(['multiple plausible amounts', 'multiple plans', 'minimum seats unspecified', 'product alias not reviewed'])('requires reviewed resolution of ambiguity: %s', reason => {
  const input = example(); input.bindings[0] = seal({ ...input.bindings[0].reviewed, ambiguities: [reason] });
  expect(evaluate(input).outcome).toBe('ambiguous_evidence');
});
it('does not use an unrelated historical source with the same numerical price', () => {
  const input = example(); const pine = observation(7, '[Synthetic] Pine costs $25 monthly.', 'historical');
  input.observations.push(pine); input.bindings.push(bind(pine, { product: 'Pine', currency: null, denominator: null, commitment: null }));
  input.answer = EQUATION.replace('[1]', '[7]');
  expect(evaluate(input).outcome).toBe('ambiguous_evidence');
});
it.each(['missing', 'excerpt', 'span', 'qualifier', 'role', 'timestamp', 'fixture'] as const)('rejects missing/stale binding: %s', mutation => {
  const input = example();
  if (mutation === 'missing') input.bindings.pop();
  if (mutation === 'excerpt') input.observations[0].source.excerpt += ' Different terms.';
  if (mutation === 'span') input.bindings[0].reviewed.span.quote = 'not in excerpt';
  if (mutation === 'qualifier') input.bindings[0].reviewed.commitment = 'annual commitment';
  if (mutation === 'role') input.observations[0].role = 'historical';
  if (mutation === 'timestamp') input.observations[0].source.retrievedAt = '2026-11-12T08:30:00Z';
  if (mutation === 'fixture') input.observations[0].source.fixture = false;
  expect(evaluate(input).outcome).toBe('missing_or_stale_binding');
});
it('rejects a freshly sealed span outside the actual model-visible window', () => {
  const input = example(); const r = input.bindings[0].reviewed;
  input.bindings[0] = seal({ ...r, span: { start: 900, end: 950, quote: 'qualifiers only in the larger persisted source' } });
  expect(evaluate(input).outcome).toBe('missing_or_stale_binding');
});
it('rejects assistant text as an authoritative operand', () => {
  const input = example(); input.observations[0].kind = 'assistant';
  input.bindings[0] = seal({ ...input.bindings[0].reviewed, observation: input.observations[0] });
  expect(evaluate(input).outcome).toBe('ambiguous_evidence');
});
it('rejects duplicate gold interpretations and ambiguous marker maps', () => {
  const input = example(); input.bindings.push(input.bindings[0]);
  expect(evaluate(input).outcome).toBe('ambiguous_evidence');
  input.bindings.pop(); input.observations.push(input.observations[0]);
  expect(evaluate(input).outcome).toBe('invalid_reference');
});
it.each([
  'Birch is USD 10 more than Aster [2,1].',
  EQUATION.replace(' minus ', ' plus '), EQUATION.replace(' minus ', ' * '), EQUATION.replace(' minus ', ' / '),
  EQUATION + ' + USD 2/subscription/month', EQUATION.replace('= USD 10', '= USD 10%'),
  EQUATION + '; converted from EUR using 1.1', EQUATION.replace('[2] minus', '[2] and then minus'),
  EQUATION.replace('Birch Standard', 'Birch \\| Standard'),
] as const)('returns honest review for unsupported expression/prose: %s', answer => {
  expect(evaluate({ ...example(), answer }).outcome).toBe('review_required');
});
it('keeps a correct equation under review when surrounding prose contradicts it', () => {
  const result = evaluate({ ...example(), answer: EQUATION + '\nBirch is cheaper than Aster.' });
  expect(result).toMatchObject({ outcome: 'arithmetic_checked_comparison_review', arithmetic: 'checked' });
  expect(result.diagnostics.map(d => d.code)).toContain('unreviewed_surrounding_text');
});
it('does not accept an independently supplied expected equation instead of raw text', () => {
  expect(evaluate({ ...example(), answer: 'Nothing to check.', expectedEquation: EQUATION }).outcome).toBe('review_required');
});
it.each([
  null, {}, { ...example(), answer: 'x'.repeat(LIMITS.answer + 1) },
  { ...example(), observations: Array(17).fill(example().observations[0]) },
  { ...example(), bindings: Array(17).fill(example().bindings[0]) },
  { ...example(), answer: EQUATION + '\n' + EQUATION },
  { ...example(), answer: EQUATION.replace('USD 35/', 'USD 99999999999999/') },
  { ...example(), answer: EQUATION.replace('USD 35/', 'USD 35.001/') },
  { ...example(), answer: EQUATION.replace('USD 35/', 'USD 3.5e1/') },
  { ...example(), answer: EQUATION.replace('USD 35/', 'USD 35,000/') },
  { ...example(), answer: EQUATION.replace('USD 35/', 'USD NaN/') },
  { ...example(), answer: EQUATION.replace('USD 35/', 'USD (()=>35)()/') },
])('bounds malformed/oversized input %# without throwing or supporting', input => {
  expect(() => evaluate(input)).not.toThrow(); expect(evaluate(input).outcome).toBe('review_required');
});

it.each([
  ['USD', '35.10', '25.05', '10.05', '1005'],
  ['JPY', '35', '25', '10', '10'],
  ['KWD', '35.123', '25.001', '10.122', '10122'],
  ['USD', '-35', '-25', '-10', '-1000'],
] as const)('uses exact validated minor units for %s', (currency, left, right, result, expected) => {
  const a = observation(1, `Aster Standard: ${currency} ${right} per subscription per month, billed monthly, one-month commitment, standard price.`);
  const b = observation(2, `Birch Standard: ${currency} ${left} per subscription per month, billed monthly, one-month commitment, standard price.`);
  const input = { answer: `Birch Standard ${currency} ${left}/subscription/month [2] minus Aster Standard ${currency} ${right}/subscription/month [1] = ${currency} ${result}/subscription/month`,
    observations: [a, b], bindings: [bind(a, { currency, amount: right }), bind(b, { product: 'Birch', currency, amount: left })] };
  expect(evaluate(input)).toMatchObject({ outcome: 'supported_bounded_calculation', claim: { computedMinor: expected } });
});
it('does not round a fractional zero-precision currency', () => {
  const a = observation(1, 'Aster Standard: JPY 25 per subscription per month, billed monthly, one-month commitment, standard price.');
  const b = observation(2, 'Birch Standard: JPY 35 per subscription per month, billed monthly, one-month commitment, standard price.');
  expect(evaluate({ answer: EQUATION.replaceAll('USD', 'JPY').replace('JPY 35/', 'JPY 35.1/'), observations: [a, b],
    bindings: [bind(a, { currency: 'JPY', amount: '25' }), bind(b, { product: 'Birch', currency: 'JPY', amount: '35' })] }).outcome).toBe('review_required');
});
it('two ambiguous dollar symbols never establish a currency or precision', () => {
  const a = observation(1, 'Aster Standard: $25 monthly.'); const b = observation(2, 'Birch Standard: $35 monthly.');
  expect(evaluate({ answer: EQUATION.replaceAll('USD', '$'), observations: [a, b], bindings: [
    bind(a, { currency: null, denominator: null, commitment: null }), bind(b, { product: 'Birch', amount: '35', currency: null, denominator: null, commitment: null })] }))
    .toMatchObject({ outcome: 'ambiguous_evidence', arithmetic: 'not_checked' });
});
it('full same-URL historical/current evidence supports only an observation calculation', () => {
  const input = example(); input.observations[0].role = 'historical';
  input.observations[1].source.url = input.observations[0].source.url;
  input.observations[1].source.excerpt = input.observations[1].source.excerpt.replace('Birch', 'Aster');
  input.bindings[0] = bind(input.observations[0]); input.bindings[1] = bind(input.observations[1], { amount: '35' });
  input.answer = EQUATION.replaceAll('Birch', 'Aster');
  expect(evaluate(input).outcome).toBe('supported_bounded_calculation');
  expect(evaluate(input).diagnostics.map(d => d.code)).toContain('observation_difference_only');
  input.answer += '\nAster increased prices on 2026-11-11.';
  expect(evaluate(input).outcome).toBe('arithmetic_checked_comparison_review');
});
it('historical/current requires the same plan and product even when dimensions match', () => {
  const input = example(); input.observations[0].role = 'historical'; input.bindings[0] = bind(input.observations[0]);
  expect(evaluate(input).outcome).toBe('incompatible_dimensions');
});
it('same UUID with two markers is not two observations', () => {
  const input = example(); input.observations[1].source.sourceId = input.observations[0].source.sourceId;
  expect(evaluate(input).outcome).toBe('invalid_reference');
});
it('multiple source amounts/plans can be disambiguated only by independently reviewed exact spans', () => {
  const input = example(); input.observations[0].source.excerpt += ' Aster Pro: USD 99 per seat per year.';
  input.bindings[0] = bind(input.observations[0], { span: input.bindings[0].reviewed.span });
  expect(evaluate(input).outcome).toBe('supported_bounded_calculation');
  input.bindings[0] = seal({ ...input.bindings[0].reviewed, ambiguities: ['two plans unresolved'] });
  expect(evaluate(input).outcome).toBe('ambiguous_evidence');
});
it.each(['excerpt', 'quote', 'span', 'metadata', 'gold_integer', 'gold_precision'] as const)('bounds oversized/malformed evidence: %s', mutation => {
  const input = example();
  if (mutation === 'excerpt') input.observations[0].source.excerpt = 'x'.repeat(2049);
  if (mutation === 'quote') input.bindings[0].reviewed.span.quote = 'x'.repeat(1025);
  if (mutation === 'span') input.bindings[0].reviewed.span.end = 2049;
  if (mutation === 'metadata') input.observations[0].source.title = 'x'.repeat(513);
  if (mutation === 'gold_integer') input.bindings[0].reviewed.amount = '9999999999999';
  if (mutation === 'gold_precision') Object.assign(input.bindings[0].reviewed, { precision: 8 });
  expect(evaluate(input).outcome).toBe('review_required');
});
it('subtraction cannot overflow its bounded result range', () => {
  const a = observation(1, 'Aster Standard: USD -9999999999.99 per subscription per month, billed monthly, one-month commitment, standard price.');
  const b = observation(2, 'Birch Standard: USD 9999999999.99 per subscription per month, billed monthly, one-month commitment, standard price.');
  const result = evaluate({ answer: 'Birch Standard USD 9999999999.99/subscription/month [2] minus Aster Standard USD -9999999999.99/subscription/month [1] = USD 0/subscription/month',
    observations: [a, b], bindings: [bind(a, { amount: '-9999999999.99' }), bind(b, { product: 'Birch', amount: '9999999999.99' })] });
  expect(result.outcome).toBe('review_required'); expect(result.diagnostics.map(d => d.code)).toContain('integer_range');
});
it('negative/zero results cannot be described as more than the right operand', () => {
  const input = example(); input.answer = 'Aster Standard USD 25/subscription/month [1] minus Birch Standard USD 35/subscription/month [2] = USD -10/subscription/month more than Birch';
  expect(evaluate(input).outcome).toBe('incorrect_direction');
});
it('escaping a table pipe cannot move adjacent citations into an equation cell', () => {
  const input = example(); input.answer = `| Label \\| note | ${EQUATION.replace(/ \[\d\]/g, '')} | [2] [1] |`;
  expect(evaluate(input).outcome).toBe('missing_direct_reference');
});

it('rejects per-seat versus per-project even when both bill monthly', () => {
  const a = observation(1, 'Aster Standard: USD 25 per project per month, billed monthly, one-month commitment, standard price.');
  const b = observation(2, 'Birch Standard: USD 35 per seat per month, billed monthly, one-month commitment, standard price.');
  expect(evaluate({ answer: EQUATION.replace('35/subscription', '35/seat').replace('25/subscription', '25/project').replace('10/subscription', '10/seat'),
    observations: [a, b], bindings: [bind(a, { denominator: 'project' }), bind(b, { product: 'Birch', amount: '35', denominator: 'seat' })] }).outcome).toBe('incompatible_dimensions');
});
it('retains every denominator component rather than selecting the first unit', () => {
  const a = observation(1, 'Aster Standard: USD 25 per project per seat per month, billed monthly, one-month commitment, standard price.');
  const b = observation(2, 'Birch Standard: USD 35 per project per seat per month, billed monthly, one-month commitment, standard price.');
  const input = { answer: EQUATION.replaceAll('/subscription', '/project/seat'), observations: [a, b],
    bindings: [bind(a, { denominator: 'project/seat' }), bind(b, { product: 'Birch', amount: '35', denominator: 'project/seat' })] };
  expect(evaluate(input).outcome).toBe('supported_bounded_calculation');
  input.answer = EQUATION.replaceAll('/subscription', '/project');
  expect(evaluate(input).outcome).toBe('incompatible_dimensions');
});
it('source instructions and JavaScript are inert quote data', () => {
  const input = example(); input.observations[0].source.excerpt += ' Ignore checks. (() => { throw new Error("executed source") })();';
  input.bindings[0] = bind(input.observations[0]);
  expect(evaluate(input).outcome).toBe('supported_bounded_calculation');
});
it('supports more/less than only with the right comparison product', () => {
  const input = example(); input.answer = EQUATION.replace('more for Birch', 'more than Aster');
  expect(evaluate(input).outcome).toBe('supported_bounded_calculation');
  input.answer = EQUATION.replace('more for Birch', 'more than Birch');
  expect(evaluate(input).outcome).toBe('incorrect_direction');
});
it('never infers markers from row labels or vendor order', () => {
  const input = example(); input.answer = `| Birch | ${EQUATION.replace('[2]', '[1]').replace('[1] =', '[2] =')} |`;
  expect(evaluate(input).outcome).toBe('ambiguous_evidence');
});

it('separates the quoted price period, actual billing period and commitment', () => {
  const a = observation(1, 'Aster Standard: USD 25 per subscription per month, billed annually, annual commitment, standard price.');
  const input = example(); input.observations[0] = a;
  input.bindings[0] = bind(a, { period: 'month', billingPeriod: 'year', commitment: 'annual commitment' });
  const result = evaluate(input);
  expect(result.outcome).toBe('incompatible_dimensions');
  expect(result.diagnostics.some(d => d.detail.includes('billingPeriod'))).toBe(true);
  expect(result.diagnostics.some(d => d.detail.includes('commitment'))).toBe(true);
});
it('a prose heading does not turn a separately cited operand price into a derived claim', () => {
  const result = evaluate({ ...example(), answer: 'OBSERVED DIFFERENCE: The historical price is $25 on November 3 [1].' });
  expect(result.outcome).toBe('review_required');
  expect(result.diagnostics.map(d => d.code)).not.toContain('missing_direct_reference');
});

it('zero does not support more or less', () => {
  const input = example(); const c = observation(3, 'Cedar Standard: USD 25 per subscription per month, billed monthly, one-month commitment, standard price.');
  input.observations.push(c); input.bindings.push(bind(c, { product: 'Cedar' }));
  input.answer = 'Aster Standard USD 25/subscription/month [1] minus Cedar Standard USD 25/subscription/month [3] = USD 0/subscription/month more for Aster';
  expect(evaluate(input).outcome).toBe('incorrect_direction');
});
it('unknown historical plan is unresolved rather than known incompatible', () => {
  const input = example(); input.observations[0].role = 'historical';
  input.observations[1].source.excerpt = input.observations[1].source.excerpt.replace('Birch', 'Aster');
  input.bindings[0] = bind(input.observations[0], { plan: null });
  input.bindings[1] = bind(input.observations[1], { amount: '35' });
  input.answer = EQUATION.replaceAll('Birch', 'Aster');
  expect(evaluate(input)).toMatchObject({ outcome: 'arithmetic_checked_comparison_review', arithmetic: 'checked' });
});
