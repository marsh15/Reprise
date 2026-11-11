import { expect, it } from 'vitest';
import { checkCitations } from '../../src/server/agent/citations';
const registry = new Map([[1, { sourceId: 'a', text: 'Price $90.00, 25%, 12 November 2026. 20 seats. 2026-11-12.' }], [2, { sourceId: 'b', text: 'Price €80. Published November 13, 2026.' }]]);
it.each([
  ['Costs $90 [1].', 'verified'], ['Costs 90 USD [1].', 'verified'], ['Costs $90.00 [1].', 'verified'],
  ['Costs $900 [1].', 'unverified'], ['Costs €90 [1].', 'unverified'], ['Discount 25% [1].', 'verified'],
  ['Discount 26% [1].', 'unverified'], ['At 12 Nov 2026 [1].', 'verified'], ['At November 13, 2026 [2].', 'verified'],
  ['At 2026-11-12 [1].', 'verified'], ['At 2026-11-13 [1].', 'unverified'], ['Supports 20 seats [1].', 'verified'],
  ['Supports 200 seats [1].', 'unverified'], ['Good product [1].', 'unchecked'], ['Claim [999].', 'invalid'],
  ['Costs $90 and €80 [1, 2].', 'verified'], ['| Cost | $90 [1] |\n| Other | $95 [2] |', 'unverified'],
  ['Costs $95 [1]. Good product [1].', 'unverified'], ['Good [1]. Costs $90 [1].', 'verified'],
  ['Costs $95 [1]. Costs $90 [1].', 'unverified'], ['Costs $1,000 [1].', 'unverified'],
])('%s → %s', (text, state) => {
  const checked = checkCitations(text, registry);
  expect(checked.some(c => c.state === state)).toBe(true);
});
it('supports adjacent/comma markers and missing source detail', () => {
  expect(checkCitations('Costs $90 and €80 [1][2].', registry)).toMatchObject([{ marker: 1, state: 'verified' }, { marker: 2, state: 'verified' }]);
  expect(checkCitations('No [5].', registry)).toEqual([{ marker: 5, sourceId: null, state: 'invalid', detail: 'No matching source.' }]);
});
it('does not treat numerical matching as semantic verification', () => {
  // Deliberately wrong meaning: documents the deterministic checker’s limitation.
  expect(checkCitations('The company lost $90 [1].', registry)[0].state).toBe('verified');
});
it('returns one row per marker, worst state wins, without checking marker numbers', () => {
  expect(checkCitations('Product [1]. Costs $90 [1]. Costs $99 [1].', registry)).toEqual([
    { marker: 1, sourceId: 'a', state: 'unverified', detail: 'not found in source: $99' },
  ]);
});
it('does not accept partial numerical substrings', () => {
  expect(checkCitations('Has 90 seats [1].', new Map([[1, { sourceId: 'a', text: '190 seats' }]]))[0].state).toBe('unverified');
});
it('keeps citations after punctuation with the preceding claim, including markdown sentences', () => {
  expect(checkCitations('Costs $90. [1] **Other** costs €80. [2]', registry)).toMatchObject([
    { marker: 1, state: 'verified' }, { marker: 2, state: 'verified' },
  ]);
  expect(checkCitations('Costs $900. [1] **Other** costs €80. [2]', registry)).toMatchObject([
    { marker: 1, state: 'unverified' }, { marker: 2, state: 'verified' },
  ]);
});
it('does not pool different claims when closing emphasis follows sentence punctuation', () => {
  const swapped = new Map([[1, { sourceId: 'a', text: '€80' }], [2, { sourceId: 'b', text: '$90' }]]);
  expect(checkCitations('**Costs $90.** [1] **Other costs €80.** [2]', swapped)).toMatchObject([
    { marker: 1, state: 'unverified' }, { marker: 2, state: 'unverified' },
  ]);
});
