import { CURRENCY_PRECISION, inputSchema, LIMITS, operandReviewDigest } from './contract';
import type { DerivedDiagnostic, Diagnostic, Outcome, ReviewedOperand } from './contract';

const money = String.raw`(?<currency>USD|EUR|GBP|INR|JPY|KWD|\$) (?<amount>[+-]?\d{1,14}(?:\.\d{1,3})?)(?<unit>(?:/[a-z0-9-]+){1,4})`;
const operand = new RegExp(String.raw`^(?<label>[A-Za-z][A-Za-z0-9 -]{0,159}?) ${money}(?: \[(?<marker>\d{1,3})\])?$`);
const result = new RegExp(String.raw`^${money}(?: (?:(?<direction>more|less) (?<relation>for|than) (?<subject>[A-Za-z][A-Za-z0-9 -]{0,79})|(?<equal>equal)))?$`);
type ParsedMoney = { currency: string; amount: string; unit: string; label?: string; marker?: string;
  direction?: string; relation?: string; subject?: string; equal?: string };
const match = (pattern: RegExp, text: string) => pattern.exec(text)?.groups as ParsedMoney | undefined;
const reason = (code: string, detail: string): Diagnostic => ({ code, detail });

function minorUnits(text: string, precision: number): bigint | null {
  const [integer, fraction = ''] = text.replace(/^[+-]/, '').split('.');
  if (fraction.length > precision) return null;
  const value = BigInt(integer + fraction.padEnd(precision, '0')) * (text.startsWith('-') ? -1n : 1n);
  return value > LIMITS.minor || value < -LIMITS.minor ? null : value;
}

export function evaluateDerivedCitation(raw: unknown): DerivedDiagnostic {
  const output: DerivedDiagnostic = { outcome: 'review_required', arithmetic: 'not_checked', direction: 'not_checked',
    diagnostics: [], scope: 'Listed-amount subtraction only; no source-truth or effective-date verification.' };
  const finish = (outcome: Outcome, code: string, detail: string) => {
    output.outcome = outcome; output.diagnostics.push(reason(code, detail)); return output;
  };
  // Bound top-level arrays before schema validation visits their elements. Never truncate.
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    if ((typeof r.answer === 'string' && r.answer.length > LIMITS.answer)
      || (Array.isArray(r.observations) && r.observations.length > LIMITS.sources)
      || (Array.isArray(r.bindings) && r.bindings.length > LIMITS.bindings))
      return finish('review_required', 'resource_limit', 'Answer, source or binding count exceeds the prototype limits.');
  }
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return finish('review_required', 'invalid_input', 'Malformed or out-of-bounds evaluation input; no evidence was truncated.');
  const { answer, observations, bindings } = parsed.data;
  if (new Set(observations.map(o => o.source.n)).size !== observations.length
    || new Set(observations.map(o => o.source.sourceId)).size !== observations.length)
    return finish('invalid_reference', 'ambiguous_ledger', 'Markers and observation UUIDs must each be unique in the supplied ledger.');

  // A line or an unescaped table cell is the outer boundary. Decimal points stay intact.
  // Terminal sentence punctuation followed by whitespace is a boundary; markers never move.
  const cells = answer.split(/\r?\n/).flatMap(line => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) return [trimmed];
    if (!trimmed.endsWith('|')) return [trimmed];
    return trimmed.split(/(?<!\\)\|/).slice(1, -1).map(c => c.trim());
  }).flatMap(cell => cell.split(/(?<=[.!?])\s+/)).filter(Boolean);
  const equationCells = cells.filter(cell => cell.includes('='));
  if (equationCells.length !== LIMITS.equations || (answer.match(/=/g)?.length ?? 0) !== LIMITS.equations) {
    // Coverage hints for unsupported prose are diagnostics only, never reconstructed claims.
    for (const cell of cells) {
      if (/(?:\$\s*[+-]?\d+(?:\.\d+)?(?:\/[a-z/]+| per month| per year)?\s+(?:difference|more|less)\b|\bdiffer by \$\s*\d)/i.test(cell)
        && (cell.match(/\[\d{1,3}\]/g)?.length ?? 0) < 2)
        output.diagnostics.push(reason('missing_direct_reference', 'An unsupported derived prose/cell claim lacks two direct operand references.'));
    }
    return finish('review_required', 'unsupported_claim_form', 'Require exactly one explicit signed subtraction equation in one claim boundary. Prose is not reconstructed.');
  }
  const claimText = equationCells[0];
  const equation = claimText.replace(/\.$/, '').replace(/^Calculated listed-price difference: /, '')
    .replace(/^Calculated listed monthly subscription difference: /, '');
  const [expression, total] = equation.split(' = ');
  const parts = expression?.split(/ (?:minus|−|-) /) ?? [];
  const left = parts.length === 2 ? match(operand, parts[0]) : undefined;
  const right = parts.length === 2 ? match(operand, parts[1]) : undefined;
  const claimed = total ? match(result, total) : undefined;
  if (!left || !right || !claimed) return finish('review_required', 'unsupported_claim_form', 'Only named monetary operands with slash units, optional individual markers, subtraction and a signed monetary result are recognized.');
  output.claim = { text: claimText, leftMarker: left.marker ? Number(left.marker) : null, rightMarker: right.marker ? Number(right.marker) : null };
  if (!left.marker || !right.marker) return finish('missing_direct_reference', 'missing_direct_reference', 'Each operand needs its own marker immediately after its monetary amount and complete unit in this claim.');
  const operands = [left, right];
  const sources = operands.map(p => observations.find(o => o.source.n === Number(p.marker)));
  if (!sources[0] || !sources[1]) return finish('invalid_reference', 'unavailable_reference', 'An operand marker does not resolve to an observation in the supplied model-visible ledger.');
  output.claim.leftSourceId = sources[0].source.sourceId; output.claim.rightSourceId = sources[1].source.sourceId;
  if (sources[0].source.sourceId === sources[1].source.sourceId)
    return finish('ambiguous_evidence', 'duplicate_operand_observation', 'This prototype requires two distinct independently bound observations; a repeated marker/UUID cannot supply both operands.');
  const evidence: ReviewedOperand[] = [];
  for (const [i, obs] of [sources[0], sources[1]].entries()) {
    const selected = bindings.filter(b => b.reviewed.observation.source.sourceId === obs.source.sourceId);
    if (!selected.length) return finish('missing_or_stale_binding', 'missing_binding', `Operand ${i + 1} has no reviewed evidence binding for its exact UUID.`);
    if (selected.length !== 1) return finish('ambiguous_evidence', 'multiple_bindings', `Operand ${i + 1} has multiple plausible reviewed bindings; no value-based selection is allowed.`);
    const b = selected[0]; const r = b.reviewed; const span = r.span;
    if (b.digest !== operandReviewDigest(r) || JSON.stringify(r.observation) !== JSON.stringify(obs)
      || span.end <= span.start || span.end > obs.source.excerpt.length
      || obs.source.excerpt.slice(span.start, span.end) !== span.quote)
      return finish('missing_or_stale_binding', 'stale_binding', `Operand ${i + 1}: review checksum, observation snapshot or exact model-visible quote span no longer agrees.`);
    if (obs.kind !== 'source' || r.ambiguities.length)
      return finish('ambiguous_evidence', 'ambiguous_operand', `Operand ${i + 1}: ${obs.kind === 'assistant' ? 'assistant text is not authoritative price evidence' : r.ambiguities.join('; ')}.`);
    if (r.product && r.plan && operands[i].label !== `${r.product} ${r.plan}`)
      return finish('ambiguous_evidence', 'identity_mismatch', `Operand ${i + 1} names ${operands[i].label}; its reviewed source binds ${r.product} ${r.plan}. Equal numbers do not repair identity.`);
    evidence.push(r);
  }
  const [a, b] = evidence;
  const incompatible: string[] = [];
  const unresolved: string[] = [];
  for (const field of ['product', 'plan', 'currency', 'denominator', 'period', 'billingPeriod', 'commitment', 'offer'] as const) {
    if (a[field] === null || b[field] === null) unresolved.push(`Unknown ${field}; no equality or model-authored meaning is assumed.`);
  }
  for (const field of ['currency', 'denominator', 'period', 'billingPeriod', 'commitment', 'offer'] as const) {
    if (a[field] !== null && b[field] !== null && a[field] !== b[field]) incompatible.push(`Reviewed ${field} differs between operands.`);
  }
  if (a.observation.role !== b.observation.role
    && ((a.product && b.product && a.product !== b.product) || (a.plan && b.plan && a.plan !== b.plan)))
    incompatible.push('Historical/current comparison requires the same established product and plan/offer.');
  for (const [i, r] of evidence.entries()) {
    const p = operands[i];
    if (r.currency && p.currency !== r.currency && !(p.currency === '$' && r.currency === 'USD')) incompatible.push(`Operand ${i + 1} currency disagrees with reviewed evidence.`);
    if (r.denominator && r.period && p.unit !== `/${r.denominator}/${r.period}`) incompatible.push(`Operand ${i + 1} unit disagrees with the full reviewed denominator/period.`);
  }
  if (a.currency && claimed.currency !== a.currency && !(claimed.currency === '$' && a.currency === 'USD')) incompatible.push('Result currency disagrees with the left operand; conversions are unsupported.');
  if (a.denominator && a.period && claimed.unit !== `/${a.denominator}/${a.period}`) incompatible.push('Result unit disagrees with the left operand; conversions are unsupported.');
  output.diagnostics.push(...incompatible.map(d => reason('incompatible_dimensions', d)), ...unresolved.map(d => reason('unresolved_evidence', d)));
  if (a.observation.role !== b.observation.role) output.diagnostics.push(reason('observation_difference_only', 'An observation difference cannot establish an effective date, cause or correctness of a prior answer.'));
  if (!a.currency || !b.currency || a.currency !== b.currency) {
    return finish(incompatible.length ? 'incompatible_dimensions' : 'ambiguous_evidence', 'currency_precision_unavailable', 'Monetary arithmetic requires an established common currency with validated precision; ambiguous dollar symbols do not establish it.');
  }
  const precision = CURRENCY_PRECISION[a.currency];
  const amounts = [left, right, claimed].map(p => minorUnits(p.amount, precision));
  const goldAmounts = evidence.map(r => minorUnits(r.amount, precision));
  if ([...amounts, ...goldAmounts].some(v => v === null)) return finish('review_required', 'monetary_bounds', 'An amount exceeds the integer range or currency precision. No rounding, floating point or conversion is used.');
  if (amounts[0] !== goldAmounts[0] || amounts[1] !== goldAmounts[1])
    return finish('ambiguous_evidence', 'operand_amount_mismatch', 'Actual answer operand amounts disagree with independent reviewed amounts.');
  const computed = amounts[0]! - amounts[1]!;
  if (computed > LIMITS.minor || computed < -LIMITS.minor) return finish('review_required', 'integer_range', 'Signed subtraction result exceeds the supported integer range.');
  output.claim.computedMinor = String(computed); output.claim.claimedMinor = String(amounts[2]);
  output.arithmetic = computed === amounts[2] ? 'checked' : 'incorrect';
  output.direction = claimed.direction || claimed.equal ? 'checked' : 'not_stated';
  if (claimed.equal && computed !== 0n) output.direction = 'incorrect';
  if (claimed.direction) {
    const target = claimed.relation === 'than' ? b.product : a.product;
    if (claimed.subject !== target || (claimed.direction === 'more' ? computed <= 0n : computed >= 0n)) output.direction = 'incorrect';
  }
  if (output.arithmetic === 'incorrect') return finish('incorrect_arithmetic', 'incorrect_arithmetic', `Claimed ${amounts[2]} minor units; actual signed left minus right is ${computed}.`);
  if (output.direction === 'incorrect') return finish('incorrect_direction', 'incorrect_direction', 'Directional wording, named subject or equality disagrees with the operand order and signed result.');
  if (incompatible.length) return finish('incompatible_dimensions', 'comparison_rejected', 'Numerical subtraction was checked; known incompatible terms reject comparison support.');
  const otherText = cells.filter(c => c !== claimText && !/^(?:Difference|Calculation|[-: ]+)$/.test(c));
  if (otherText.length) {
    unresolved.push('Surrounding prose and other cells have not been semantically reviewed.');
    output.diagnostics.push(reason('unreviewed_surrounding_text', 'Any surrounding prose, including a contradiction or change-date claim, keeps the answer under review.'));
  }
  if (unresolved.length) return finish('arithmetic_checked_comparison_review', 'comparison_requires_review', 'Exact arithmetic checked; commercial comparison or surrounding claims remain unresolved.');
  return finish('supported_bounded_calculation', 'bounded_support', 'Direct references, reviewed exact operands, compatible commercial dimensions, signed arithmetic and any explicit direction agree. Support is conditional on reviewed evidence, not independently established source truth.');
}
