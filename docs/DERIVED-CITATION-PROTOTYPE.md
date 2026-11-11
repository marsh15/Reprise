# Evaluation-only derived citation prototype

Date: 12 November 2026 IST. Started at clean `main`, `21ee08c`. Main agent: Sol 6.1 High. This implements only the separately approved evaluation experiment from the citation-support design and checkpoint. No production approval is inferred.

## Recommendation

**Stop at evaluation-only diagnostics (option 1).** The prototype adds useful assurance about direct references, exact arithmetic and the limits of reviewed evidence. It demonstrates no automatic semantic grounding, real-model acceptance improvement or production-ready binding producer. Manual gold authoring is the limiting input, rather than arithmetic implementation. No observed saved derived answer becomes fully supported.

Option 2, designing an independently validated automatic operand producer, is a possible separately scoped evaluation project if manual diagnostics become useful at scale. It needs owner approval, independent held-out gold, ambiguity/abstention targets and evidence that the benefit warrants the review burden. This experiment alone does not justify implementing it.

Option 3, a narrow production citation-state change, is premature. The current source interface cannot produce trusted operands, and result-token failures can still propagate to every reused marker. Any checker exception, per-claim state, prompt change, transport/persistence change or rendering change needs a concrete separate design and explicit owner approval. None is implemented here.

## Implemented scope and data contract

All new code is in `evals/derived-citations/`, `tests/unit/derived-citations*.test.ts` and `tests/fixtures/derived-citations/`. `evals/README.md` documents the optional commands. The new evaluator is not called by existing assertions or the app.

`evaluateDerivedCitation` validates a closed, evaluation-only input object:

```ts
{
  answer: string; // original raw model output, never replaced by a gold equation
  observations: Array<{
    source: SourceRecord; // exact excerpt actually supplied to this model, with this turn's n
    role: 'historical' | 'current';
    kind: 'source' | 'assistant';
  }>;
  bindings: Array<{
    reviewId: string;
    digest: string;
    reviewed: {
      observation: /* exact snapshot of one supplied observation */;
      span: { start: number; end: number; quote: string };
      product: string | null;
      plan: string | null; // explicitly named plan/offer, including standard subscription
      amount: string; // exact reviewed decimal text, not a model-authored interpretation
      currency: 'USD' | 'EUR' | 'GBP' | 'INR' | 'JPY' | 'KWD' | null;
      denominator: string | null; // all components, e.g. project/seat
      period: 'month' | 'year' | null; // quoted pricing period
      billingPeriod: 'month' | 'year' | null;
      commitment: string | null;
      offer: 'standard' | 'introductory' | null;
      ambiguities: string[];
    };
  }>;
}
```

Unknown input keys, including a separately supplied expected equation, are rejected. Gold contains evidence interpretations and operand amounts, never an expected result. Synthetic meanings were explicitly inspected separately from the answer text. This is main-agent fixture review, not independent human sign-off or source-truth verification. No automatic extraction or model-produced semantic metadata is trusted.

Publication/retrieval timestamps, UUIDs, search IDs, rank, URL, fixture provenance, roles and the exact visible excerpt are retained in each review snapshot. A canonical SHA-256 digest detects changed review fields. It is a stale-review checksum, not an authentication mechanism or proof of the review's correctness. Recomputing a digest cannot establish a truthful interpretation.

A reference resolves through the supplied observation's `n` to its exact UUID, then selects exactly one gold binding for that UUID. It never reconstructs markers from vendor order. Repeated UUIDs or markers are rejected; distinct UUIDs at one URL stay distinct. This first prototype requires distinct observations for the two operands and does not support two plans within the same UUID.

Coordinates use JavaScript UTF-16 offsets and half-open `[start,end)` spans of the exact model-visible excerpt. The stored quote must equal that slice, with positive length and no out-of-window coordinates. All interpreted amount and qualifier meanings must have been reviewed against that span. Their semantic accuracy is a precondition supplied by gold, not an entailment proof performed by this code. A larger persisted document cannot fill gaps. Multiple amounts/plans can be handled only by an explicitly disambiguated reviewed span; unresolved ambiguity requires review. Assistant text cannot be an authoritative price operand.

Reviewed decimal operands and the actual parsed answer decimals are converted to integer minor units only after a common explicit currency and its precision are established. R3's unknown currency does not acquire an invented two-decimal minor-unit scale. All subtraction uses `bigint`; no rounding, float epsilon, expression evaluation or arbitrary JavaScript execution is involved.

## Exact recognizer contract

There must be exactly one `=` in the entire answer. The equation occupies one sentence in one line or one table cell:

```text
<Product> <Plan> <Currency> <SignedAmount>/<FullDenominator>/<Period> [n]
 minus
<Product> <Plan> <Currency> <SignedAmount>/<FullDenominator>/<Period> [m]
 = <Currency> <SignedResult>/<FullDenominator>/<Period> [optional direction]
```

The line breaks above show components only: the equation itself is on one line/in one cell. Currency and amount have one intervening space. The subtractor is `minus`, Unicode `−`, or ASCII `-`, surrounded by spaces. ` = ` has spaces. A trailing full stop is optional. The optional literal prefixes are `Calculated listed-price difference: ` and `Calculated listed monthly subscription difference: `.

Identity labels contain ASCII letters/digits/spaces/hyphens, begin with a letter, and must equal the reviewed `<product> <plan>` when those fields are known. There are no alias guesses. Units use one to four slash components of lowercase letters/digits/hyphens, including the final pricing period. Known denominator and period must match the entire operand/result unit. Cross-product operands can have different named plans; a historical/current comparison requires the same established product and plan. Known incompatible currency, complete denominator, pricing period, billing period, commitment or standard/introductory offer rejects comparison support.

Amounts have an optional leading sign, ordinary decimal notation, up to 14 integer digits lexically and up to three fractional digits. Currency precision and minor-unit range impose the tighter effective bounds. No grouping separators, exponent notation, formulas, percentages, multiplication, division, conversion or compound operation is recognized. Codes are exactly the six currencies listed above; `$` is accepted only when gold independently establishes USD. Two unknown dollar symbols never establish currency.

Each operand's marker immediately follows its full monetary unit in the equation. A grouped trailing reference, neighboring sentence, adjacent table cell, later disclaimer or bibliography cannot supply it. Missing individual markers on an otherwise recognized equation produce a direct-coverage failure. Unsupported reference forms remain review-required. No table row label supplies an operand or reference.

The supported table form has leading/trailing unescaped pipes and an entire equation in one cell, for example `| Difference | <equation> |`. Cells split only at unescaped pipes. Sentence boundaries are terminal `.`, `!` or `?` followed by whitespace, retaining decimal points and never moving references. The old citation sentence splitter is not reused. Marker-adjacent conjunction splitting is absent.

Optional direction is exactly `more for <left product>`, `less for <left product>`, `more than <right product>`, `less than <right product>`, or `equal`. Positive subtraction supports more, negative supports less, zero supports equal and neither more nor less. A wrong named subject also fails direction. This intentionally supports signed `-10 ... less`, rather than an unsigned magnitude presented as the result of a negative subtraction.

Any additional prose or nonstructural cell keeps the overall answer under review even when arithmetic passes. Only empty cells, exact `Difference`/`Calculation` labels and table separator punctuation are structural. This conservative rule catches contradictions without pretending to understand arbitrary surrounding prose. A small lexical hint flags absent direct references in selected unsupported `$5 difference`, `$10/month more` and `differ by $5` prose; it does not parse or verify that calculation.

## Diagnostic outcomes and examples

Outputs keep `arithmetic`, `direction`, parsed claim/UUIDs/computed minor units and detailed reasons separate from the overall `outcome`.

- `missing_direct_reference`: a parsed operand lacks its attached marker.
- `invalid_reference`: missing observation, duplicate marker map or duplicate observation UUID.
- `missing_or_stale_binding`: no exact reviewed binding, changed snapshot/checksum or invalid quote span.
- `ambiguous_evidence`: unresolved reviewed ambiguity, wrong identity/amount, duplicate operand reference, multiple bindings, assistant evidence or unknown currency precision.
- `incompatible_dimensions`: established incompatible dimensions; numerical subtraction can still be reported separately when meaningful in a common currency.
- `incorrect_arithmetic`: parsed signed result differs from exact left-minus-right.
- `incorrect_direction`: direction or its named product disagrees with the order/result sign.
- `arithmetic_checked_comparison_review`: arithmetic passes but evidence, commercial terms or surrounding claims remain unresolved.
- `supported_bounded_calculation`: complete reviewed operands, compatible dimensions, direct coverage, arithmetic and explicit direction pass.
- `review_required`: unsupported/malformed grammar, excess input or arithmetic bounds. Nothing is silently truncated or corrected.

When several problems coexist, the primary outcome follows the first blocking stage: input/ledger, grammar/coverage, operand binding/identity, currency/precision, arithmetic, direction, known incompatibility, then unresolved terms/surrounding text. Additional diagnostics and component statuses preserve available detail. An arithmetic failure takes precedence over a simultaneous directional failure; the latter remains visible in `direction`.

A complete synthetic example is Birch Standard USD 35 per subscription per month versus Aster Standard USD 25, both explicitly billed monthly with one-month commitments and standard offers. The directly cited equation computes `3500 - 2500 = 1000` and can be supported within that scope. The separate complete fixtures make their commitments explicit; they do not add those terms to R2.

Negative, zero, two-decimal USD, zero-decimal JPY and three-decimal KWD cases pass with independent expected constants. Wrong signs, swapped vendors/markers, per-seat versus per-project units and conflicting known commitments reject the relevant component. Two unknown commitments still permit arithmetic checking but cannot establish commercial equivalence.

Every result states: **listed-amount subtraction only; no source-truth or effective-date verification.** Supported does not mean equal features, equal taxes/discounts/usage totals, a purchasing recommendation, a true source, or a correct prior answer.

## Historical evaluation

The optional offline audit reads the existing `luna-frozen-first.json` and `sol-frozen-first.json`, checks all 12 row-local source observation instances against fixed reviewed synthetic snapshots, evaluates their original raw answers and writes a new ignored diagnostic file. It does not rewrite text, excerpts, markers, scores or reports. Repeated R3 observations count separately in each report. All excerpts fit the original model-visible historical window; no omitted qualifier is supplied.

- **Luna R2:** no explicit calculation equation; review-required, arithmetic not checked. Its price table contains no derived numerical subtraction claim to verify.
- **Sol R2:** its `$10/month more than Aster or Cedar` verdict cell has no direct operand references and is outside the equation grammar. Review-required with a direct-coverage diagnostic; no neighboring price cell is borrowed.
- **Luna R3:** `$5 per month` observed difference lacks direct operand references and is unsupported prose. Review-required; no monetary arithmetic certification.
- **Sol R3:** `$5 difference` lacks direct operand references. The later [2] on the date caveat cannot support it. Review-required, regardless of its unchanged legacy automatic pass.

Separate explicit-equation controls use the original R2/R3 excerpts and independent fixed bindings; these are counterfactual test answers, never repairs or new model generations. R2's `Birch 35 - Aster 25 = 10` resolves [3] and [2] to their original UUIDs and receives arithmetic-checked/comparison-review. Currency USD, flat subscription and monthly pricing are established; billing period/commitment remain unresolved. Correct arithmetic with its markers removed remains a direct-coverage failure.

R3's same-URL UUIDs remain separate. Its reviewed amounts are 25 and 20, whose ordinary numerical difference is 5, but explicit currency, complete denominator, billing period and commitment remain unresolved. The evaluator therefore withholds monetary arithmetic certification, even on a directly cited equation. Subtraction establishes no effective date. A separate fully specified synthetic same-product historical/current pair demonstrates that even supported observation arithmetic cannot certify an underlying price-change date; adding such prose keeps the answer under review.

Original report full-file hashes remain:

- Luna: `c63f5a42b5e9ed55abca8a61ffa00bc3c5f7bc66cade936c68e6db191f6709a7`.
- Sol: `b505b9a6d6cbc48a9bbaccb8661f72de51fa00250109a82462a025a441b99b96`.

No original Luna/Sol automatic score changes. These are four offline deterministic diagnostics, not a model-performance result or completed live P0 acceptance.

## Resource bounds

Limits use UTF-16 code units, not bytes. No input is shortened to achieve support.

- Answer: 8,192; one equation/`=`. Enough for one bounded calculation and contextual rejection controls; multiple equations require a separate future contract.
- Source observations: 16; bindings: 16. R2 needs four sources and R3 two, leaving ample small-fixture headroom without general document processing. Top-level excess counts are rejected before element validation.
- Each exact model-visible excerpt: 2,048; quote: 1,024; span coordinates within the excerpt and matching its exact slice. These fit current synthetic evidence and preserve stricter 600-character historical clipping supplied by the caller.
- Currency precision: USD/EUR/GBP/INR 2, JPY 0, KWD 3; maximum three. Unsupported currencies or excess precision require review. Reviewed decimals have at most 12 integer digits; parsed answer decimals at most 14, with both subsequently bounded in minor units.
- Operand amounts, claimed result and computed result: absolute value at most 999,999,999,999 minor units. Exact `bigint` avoids overflow; the explicit limit also rejects an oversized difference of two individually in-range signed operands.
- Labels/review IDs/semantic fields: 80; combined answer identity: 160; URL/title: 512; timestamps: 64; at most eight ambiguity notes; markers/rank: 1–999; at most four slash unit components. The schema is fixed-depth, closed and accepts plain evaluation JSON data.

These limits are fixture-oriented, not production capacity targets or a latency benchmark. Source text and answers are data, including source-embedded JavaScript/instructions.

## Tests, simplification and self-review

The first test suite had 69 cases: the empty recognizer failed 40 discriminating cases and passed 29 review-required controls. The implementation then passed all 69. Expanded controls cover the requested adversarial families, including signed/zero results, identity coincidence, unrelated historical evidence, same URL/different UUID, wrong/missing/duplicate references, neighboring cells, multiple plans/amounts, currencies/precision, ambiguous symbols, complete denominators, pricing/billing periods, unknown/conflicting commitments, introductory offers, conversions, clipping/staleness, malformed/oversized data, contradictory prose and undated observation changes.

Mutation tests change raw answer amount, result, vendor, markers, direction and attachment while retaining independent gold. Expected outcomes/results are literal reviewed constants, not calculations generated by the implementation. An implementation mutation replacing subtraction with addition caused the targeted positive test to fail (`6000` instead of `1000`); the original code was restored before final verification. No tests are disabled in the final suite.

Self-review corrected an overbroad prose coverage hint that could mistake a heading plus a cited single price for a derived claim. It also distinguishes unknown historical plan from known incompatibility. Pricing period, billing period and commitment are separate; unknown currency retains decimal evidence without inventing its minor-unit scale.

The explicit simplification pass retained two anchored money forms and one binary subtraction. Direction checking was flattened; lexical fractional precision was capped at three; no parser framework, AST, vendor alias system, semantic extractor, automatic operand selector, service, tool, dependency or integration into canonical scoring was added. Core recognizer logic stays under 150 lines. Fixed historical gold and its optional offline audit are separate from the recognizer. No consequential inconsistency in the approved design required another Opus review; this phase uses deterministic tests and self-review as requested.

False negatives are deliberate: natural prose, multiple equations, rich Markdown, aliases, unsupported currencies/units and most otherwise harmless surrounding text require review. Partial coverage hints miss other wordings. False-positive risk remains if trusted gold is semantically wrong, its reviewer omitted a qualifier/ambiguity, or upstream supplied a persisted excerpt instead of the real model-visible excerpt. The checker compares supplied snapshots and exact spans; it cannot independently establish what was actually sent or whether the source is true. Checksums do not solve that trust problem. No general contradiction or effective-date recognizer is claimed.

## Verification and preservation

All final commands passed after the last code edit:

- `npm run typecheck`: passed, no diagnostics.
- `npm test`: **554/554 tests**, **40/40 files**, 11.28 seconds; the existing 450 tests plus 104 new tests.
- `npm run build`: passed, 377 modules; unchanged `index-DwKq3Usu.css` and `index-C7gwykOT.js`, JS 499.56 kB / 151.80 kB gzip.
- `npm run eval -- --mock`: **23/23**, unchanged 11 P0 / 12 P1 canonical denominator.
- `npm run eval -- --mock --only R1,R2,R3`: **3/3**, separate opt-in denominator.
- `npx vitest run tests/unit/derived-citations*.test.ts`: **104/104**, two files; 98 general controls and six historical controls.
- `npx tsx evals/derived-citations/auditHistorical.ts`: **4/4 original answer diagnostics completed**, all 12 row-local observation instances matched the independent snapshots, and original report hashes were unchanged.
- Approved-path diff and whitespace checks: passed. No new production import/call site points to the prototype.

New mock reports are `evals/results/2026-11-11T18-39-04.152Z-mock-f2c264c6.{json,md}` and `evals/results/2026-11-11T18-39-04.030Z-mock-a84fd12d.{json,md}`. The offline audit is `evals/results/derived-citation-prototype/historical-diagnostics.json`. All are ignored, separate from old generation reports and excluded from commits. Command/mutation logs remain under `/tmp`.

`git diff --exit-code 21ee08c -- src evals/assertions.ts evals/correctnessScenarios.ts evals/scenarios.ts evals/search-cassettes package.json package-lock.json` passed. This establishes the unchanged production implementation, canonical model-input definitions and fixtures; existing registry/persistence/citation tests also passed. Source observations/citation state schemas and application behavior were not changed. No new model outputs or live acceptance result is claimed.

No production source, shared contract, client code, prompt, registry, persistence, streaming/SSE interface, schema, runtime model, tool or configuration was edited. Existing cassettes, canonical scenarios/assertions, source observations, citation states and model inputs are unchanged. No live LLM/Tavily call, model comparison generation, runtime selection, frontend-worktree access, submission or recording is part of this work.

Production still checks token presence with narrow attribution warnings and aggregates worst states per marker. The evaluation-only legacy `supportedDifference` remains unchanged. An automatic producer, calibrated independent validation, a production result-token/per-claim-state design, lifecycle/security checks and owner approval would all be prerequisites for production use. No new automatic source-verification service is justified.

## Git and stop condition

Authorized destination: `origin/main`, appending to baseline `21ee08c`. Implementation commit subject: **Add evaluation-only signed subtraction diagnostics**. Its exact SHA is recorded in the follow-up checkpoint entry and final handoff. Only new evaluation code, curated synthetic gold/tests, the evaluation README and this checkpoint are included. No generated reports, private captures, secrets or local SQLite files are committed. The independent frontend redesign worktree/branch is untouched.

Stop after this checkpoint. Keep evaluation-only diagnostics available for manual analysis. Request explicit owner approval of a separately scoped proposal before any production changes. No runtime winner is selected and Reprise is not declared submission-ready.
