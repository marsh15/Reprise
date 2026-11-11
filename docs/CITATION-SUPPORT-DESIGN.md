# Citation support for derived calculations

> **Status:** Proposed for owner approval. No production implementation in this phase.
> Author: Sol 6.1 High. Runtime: Luna, unchanged. 11 November 2026.

## 1. Executive summary

Correct subtraction can fail Reprise's numerical citation checks because the result does not occur in a source. Conversely, matching two numbers cannot establish that they describe the right products, plans or pricing units. A separate issue is that a source in one table cell does not directly support a calculation in another.

Recommend a two-part contract: require both operand references on the actual derived claim, and check signed subtraction only after each operand has an explicit, independently reviewed evidence binding. Begin with an evaluation-only prototype using reviewed synthetic operand bindings. Do not auto-extract price facts from arbitrary excerpts. The current source interface cannot reliably supply those bindings automatically, so production arithmetic verification is deferred. An evaluation-only coverage diagnostic can identify missing references without claiming arithmetic support. Production presentation first needs an approved result-token exception or per-claim state design; no schema-preserving production warning path has been established. All production work needs approval.

The cost of this conservative boundary is that several mathematically correct answers remain review-required. It avoids converting a mechanical token match into a false support guarantee.

## 2. Context and scope

Read the actual matched `luna-frozen-first.json` and `sol-frozen-first.json` under ignored `evals/results/model-comparison/`, alongside [MODEL-COMPARISON.md](MODEL-COMPARISON.md), [CORRECTNESS-REVIEW.md](CORRECTNESS-REVIEW.md), [LIVE-ACCEPTANCE.md](LIVE-ACCEPTANCE.md), [DESIGN.md](../DESIGN.md), and the evaluation and citation tests. Local captures remain private and unchanged. Checked all six initial request bodies after removing only `model`, complete source arrays, input/cassette hashes and generation implementation hashes: equal in every matched pair.

Observed failures:

- Sol F2 truthfully cannot identify the discussed plans or establish whether their prices changed. The historical-baseline assertion rejects that combination. The repaired evaluation predicate accepts that wording and rejects the reviewed no-change counterexamples; full-corpus reassessment is recorded in the checkpoint.
- Luna R3 says the observations differ by $5 per month and neither source gives an effective change date. The date-uncertainty assertion misses valid wording. The uncited calculation remains a separate limitation.
- Sol R2 cites Aster $25 [2], Birch $35 [3], Cedar $25 [4] in price cells, but puts `$10/month more than Aster or Cedar` in Birch's verdict cell without references there. Arithmetic is correct; operand attachment and complete commercial comparability are not established by that cell.
- Sol R3 passes the old lexical difference exemption with `$5 difference`, although its calculation lacks direct operand citations too. The later [2] belongs to the timing caveat. This is asymmetric coverage, not evidence of superior reasoning.
- Earlier J1 seat totals and K1 price placement illustrate related limits. They do not justify implementing seat multiplication now.

Only evaluation language checks and their deterministic tests change in this phase. Historical generation scores remain historical. No new generation, model candidate, Responses migration, production checker, tool, schema, prompt or UI change is included.

## 3. Current system and responsibilities

`src/shared/research.ts` defines `SourceRecord`: `sourceId`, `searchId`, `rank`, turn-local `n`, `url`, `title`, `excerpt`, `publishedAt`, `retrievedAt`, `fixture`. There are no canonical product, plan, currency, price-unit or commitment fields. `CitationRecord` records marker, nullable source UUID, state and detail. Its states are `verified`, `unverified`, `unchecked`, `invalid`.

`createSourceRegistry` allocates one marker per immutable UUID, including different observations of the same URL. Re-registering one UUID deduplicates it. Its `CitationSource.subject` is only a title/domain heuristic; it cannot establish plan identity or multi-product attribution. The full `SourceRecord`, rather than the reduced registry projection, is necessary to inspect original identity, dates and fixture status.

`renderRecallContext` supplies UUIDs, remapped references and `historicalMarker`; historical excerpts are bounded to 600 characters. `sourceIndex` supplies exact references and historical/new roles. Search results use the same registry. Clipped evidence cannot justify omitted terms, even if some longer local text happens to contain them.

`repo.saveEvidence` stores search/source/citation rows and message `sourceRefs` atomically with the answer before terminal events. Recalled sources retain their UUIDs and dates. Deletion during generation yields an unverified, missing-source citation rather than resurrecting evidence. No migration is needed for this proposal's evaluation stage.

`citationStatements` splits independent sentences/clauses and table cells, retaining the first cell as a row-subject hint. `checkCitations` checks marker existence, numbers/date tokens, selected date roles and narrow subject mismatches. It pools tokens among markers within one statement and aggregates the worst result per marker across the answer. It does not check entailment, complete units or arithmetic. An existing unit test intentionally shows that a wrong meaning can receive `verified` when its number matches.

`evals/assertions.ts` additionally flags uncited monetary statements. Its legacy `supportedDifference` guesses two preceding single-money statements, checks a single recognized unit, currency symbol, absolute subtraction and some direction. It lacks complete unit vectors, commitment/plan binding and robust claim attachment. It remains unchanged in this phase and must not become the production implementation.

The client renders existing marker records and says numbers/dates were found while meaning was not checked. It has no per-calculation status or operand display. A new meaning for `verified` would contradict those semantics. `TurnResult`, `MessageDTO` and the SSE event union have no generic persisted per-claim warning channel. Read-only inspection of client code was necessary; no client file is edited.

## 4. Proposed contract and decisions

### Claim coverage

A derived statement must repeat both operand markers in the same claim. For the first proposed prototype, recognize only the explicit equation form below, bounded by terminal sentence punctuation or one table cell, with no marker-adjacent conjunction splitting. This is a proposed recognizer, not the existing `citationStatements` behavior. References elsewhere in the row, neighboring cells, a later disclaimer or a source list do not count. Use an explicit equation with one marker on each operand, for example:

`Calculated listed-price difference: Birch USD 35/month [3] minus Aster USD 25/month [2] = USD 10/month; commitment unspecified, so commercial comparability requires review.`

This format is a **prototype test input only, not a current model instruction**. With today's checker, its derived result makes each reused marker `unverified`; worst-state aggregation can consequently turn correctly cited operand-price cells unverified too. If both Aster and Cedar comparisons reuse their references, all three price markers can be affected. The apparent UI regression is more severe than today's uncited-calculation failure. Do not promote this format to the production prompt until an approved per-claim state or narrow result-token treatment prevents that propagation. Merely adding citations is not the arithmetic fix. A verdict comparing Birch with both Aster and Cedar must contain two separate calculations, with the correct pair for each. No `or` reference selection or neighboring-cell inference.

The existing splitter separates `[3] and`, `[3] versus`, and marker-adjacent commas/semicolons. It cannot implement this coverage contract unchanged: even a correct prose sentence may be split into an uncited derived fragment. Arbitrary prose is outside the first recognizer; do not silently inherit that splitter for equation coverage.

Each sourced price gets its own reference. A sentence with several numbers must explicitly associate each operand and reference; a trailing `[2,3]` on arbitrary prose is ambiguous. A table row's product name is a hint, not permission to override a different product named in its verdict. Multiple products, multiple prices or multiple plausible plans within one source require explicit unambiguous bindings or review.

### Smallest calculation subset

Support **signed subtraction of two exact monetary amounts with the same full pricing unit**. Define `result = left - right`; a positive result supports “left's listed amount is higher,” a negative result supports lower, and zero supports equal listed amounts. “More” or “less” must agree with both operand order and sign. An absolute difference supports only magnitude and cannot authorize a directional conclusion.

No sum, percentage, seat multiplication, exchange conversion, monthly/annual conversion, discount inference, minimum-seat pricing, taxes, usage totals, rounded estimates or chained calculations initially. R2/R3 demonstrate subtraction; no matched failure requires the other operations. A currency conversion with sourced rates remains out of scope and review-required even if the rate is cited.

### Required operand evidence

Reuse `SourceRecord` and exact quoted spans. For a future evaluation prototype only, a reviewer binds each operand to a source UUID and exact excerpt span, recording the product, plan or expressly named offer, currency, amount, pricing denominator, billing commitment and observation role supported by that span. An operand binding is an interpretation to review, not another source fact merely because a model supplied it.

The only small additional transient concept needed is an operand: `{ source: SourceRecord, quoteStart, quoteEnd, amountMinor, currency, product, plan, unit, commitment }`. This is illustrative design notation, not a new persisted or model-visible interface. Keep exact source dates/fixture flag on `source`; use integer minor units with validated range and precision. `unit` must preserve **all** denominators, such as seat + month, project + month, instance + month, or flat subscription + month. Do not reduce `/seat/month` to whichever unit a regex finds first. Currency symbols alone are ambiguous: `$` does not establish USD without explicit currency evidence. Unknown fields remain unknown.

Both operands must be spans of supplied `SourceRecord.excerpt` text. A prior assistant answer proves what was said and cannot serve as a price operand, even if it contains markers. Quotes and span coordinates index the exact model-visible excerpt for this turn, after the historical 600-character bound. Reject out-of-window spans; a longer persisted source must not silently repair evidence the model never received.

Bindings must identify the relevant amount and qualifiers together. Never select a pair merely because their values yield the expected result. A binding must be invalidated if its source UUID, exact excerpt, span or interpreted qualifiers differ. A hash may detect changed fixture text but cannot prove the interpretation. The prototype's review record should retain the reviewed excerpt and interpretation beside the fixture, without copying private captures into Git.

A valid binding requires one clearly identified product and plan/offer for each operand; plan identity can be an explicitly described standard subscription when no named tier is supplied. Differing products are allowed only for an explicitly named cross-product comparison with compatible dimensions. Historical/current comparisons additionally require the same product and same plan/offer. Never infer plan equivalence from URL equality. Preserve unknown commitment; two unknown commitments are not evidence of equality. If a required identity, currency, denominator, period or commitment is ambiguous, overall support requires review. Known incompatible dimensions reject the claimed like-for-like comparison. Explicit non-comparable arithmetic may be mathematically checked, but cannot be called a supported price comparison.

A reviewer-approved binding, not lexical co-occurrence or model metadata, establishes operand meaning in the prototype. There is presently no reliable automatic production producer of these bindings. That is a deliberate implementation gate, not an unstated extraction component.

## 5. Invariants and requirements

- **INV-1:** A reference resolves through this answer's marker-to-UUID map. Preserve original URL, excerpt, publication/retrieval timestamps and fixture status. Never merge same-URL observations.
- **INV-2:** Two operand references attach to the actual claim; adjacent evidence cannot silently satisfy coverage.
- **INV-3:** Arithmetic cannot grant operand identity or compatibility. Independent binding and full dimensions must pass first.
- **INV-4:** Signed exact subtraction must match operand order, currency, denominator, period and claimed direction. Overflow or unsupported precision requires review.
- **INV-5:** Unknown terms remain unknown; no defaults for missing plan, seats, currency or commitment. Conflicting known terms cannot be normalized away.
- **INV-6:** A numerical difference establishes no effective date, cause, intervening history or guarantee that the old answer was correct.
- **INV-7:** Existing `verified` remains a token-check result. No blanket semantic-support badge or new ledger state is implied.
- **INV-8:** Raw answers and original evaluation reports remain immutable. Reassessment is separately labelled and uses no new generation.

## 6. Interfaces, identity and rendering

Evaluation-only prototype inputs would be the raw answer text, its complete `SourceRecord` ledger and independently reviewed operand bindings. The recognizer must locate the equation in that answer, extract its actual result/direction and resolve its markers to UUIDs. It must not accept a reviewer-supplied claim or equation as a substitute for the answer. The bindings form a gold evidence interpretation, not expected arithmetic output. Mutation tests must independently change answer result, direction, markers and cell placement while keeping that gold set fixed. This validates attachment and bounded arithmetic, not an automatic operand producer. Results should separate reference coverage, operand review, arithmetic and comparison eligibility. These are local diagnostic outcomes, not additions to `Evidence` or `CitationRecord`.

Markers are local references, not source identities. A historical `[8]` may become this turn's `[1]`; resolve by UUID before comparison. Same UUID can be referenced twice but does not provide two independently dated observations. Same URL with different UUIDs remains two observations. Never regenerate marker numbering from product order or URL, and never use an unrelated Pine $25 observation for Aster's $25.

For production, retain the existing raw answer and marker rendering. Server rendering of validated calculations would make references unambiguous, but currently the server has neither trusted operands nor structured claim positions. Rendering a second answer or injecting validated blocks would alter streaming and UI contracts. Defer it. Existing per-marker worst-state aggregation cannot express one successful calculation and another failed claim using the same source. A future per-claim UI needs separate approval and design; do not overload `detail` with hidden machine metadata.

## 7. Failure classification and lifecycle

Use explicit diagnostic reasons rather than a single pass:

- **Missing reference:** claim lacks one or both direct operand markers. Coverage failure even when arithmetic is right.
- **Invalid reference:** unknown marker, missing/deleted source or stale binding. Reject reference support.
- **Needs review:** ambiguous product/plan/span, unknown currency/unit/period/commitment, incomplete supplied evidence, multiple plausible operands, unsupported operation or prose outside the explicit form. Never claim supported.
- **Incompatible operands:** known currency, unit, period or offer mismatch for a claimed like-for-like comparison. Reject comparison support.
- **Arithmetic error:** wrong signed result or reversed direction with established operands. Reject calculation.
- **Arithmetic checked; comparison needs review:** exact subtraction can be computed but commercial applicability is unresolved. This is not fully supported.
- **Supported bounded calculation:** reviewed operands, direct coverage, compatible dimensions and exact signed subtraction all pass. This label applies only to that explicit calculation and its stated evidence scope, never arbitrary surrounding prose or source truth.

Contradictory surrounding prose keeps the answer under review even if its equation passes. No validator retries, extra model calls, silent corrections or invented replacement values. Missing evidence stays review-required until explicitly supplied and reviewed. Offline reassessment must re-resolve current inputs and preserve historical outputs. Production warning timing, cancellation and persistence remain unchanged during this phase. Any approved future warning must be bounded, occur after the answer, and be saved atomically; its persistence/transport/UI representation is presently unresolved, so the existing lifecycle alone does not supply an implementation; deletion must fail closed. Prototype resource limits should be small and explicit before implementation, with excess input classified review-required rather than silently truncated.

## 8. Security, privacy and operations

Source text and model output are untrusted. Exact spans are data, never instructions or authority to execute expressions. Use an allowlisted subtraction operation, integer arithmetic and bounded inputs, never expression evaluation. Keep private transcripts, database records and generated captures ignored. No network request, search, provider budget or latency increase is required for an offline arithmetic prototype. Production validation would add local work but has not been benchmarked; no latency promise is made. One-model/one-tool Chat Completions remains intact.

## 9. Worked examples and acceptance criteria

### Example 1: fully supported subtraction with explicit terms

Illustrative extension for a future synthetic test, **not an alteration of R2's evidence**:

- Source A, UUID `00000000-0000-4000-8000-000000000101`, marker [1], retrieved `2026-11-11T08:30:00Z`, publication null: “Aster Standard subscription: USD 25 per subscription per month, billed monthly, no introductory discount.”
- Source B, UUID `00000000-0000-4000-8000-000000000102`, marker [2], same retrieval instant, publication null: “Birch Standard subscription: USD 35 per subscription per month, billed monthly, no introductory discount.”

Claim: “Calculated listed monthly subscription difference: Birch Standard USD 35/subscription/month [2] minus Aster Standard USD 25/subscription/month [1] = USD 10/subscription/month more for Birch.”

Reviewed exact operand spans establish product, offer, USD, flat subscription/month and matching commitment. `3500 - 2500 = 1000` minor units; direction and coverage pass. This supports the listed base-amount difference only. It does not establish equal features or an overall purchasing recommendation. R2's actual excerpts omit billing commitment, so R2 itself remains comparison-review-required under this stricter proposal.

### Example 2: wrong or unsupported comparison

R2's actual Pine [1] is an unrelated $25 historical observation; Aster [2] is $25, Birch [3] is $35, Cedar [4] is $25. “Birch is $10 cheaper than Aster [1,3]” fails Pine/Aster identity and direction. The correct numbers do not repair either error. “Birch USD 35/seat/month minus Aster USD 25/subscription/month = USD 10/month more” has incompatible denominators. USD minus EUR is incompatible without a conversion, which is unsupported initially. A corrected [2,3] equation with missing commitment can receive arithmetic-checked but still requires comparison review.

### Example 3: observations do not establish a change date

R3 [1] is UUID `00000000-0000-4000-8000-000000000005`, `https://aster.example/pricing`, retrieved `2026-11-03T08:00:00.000Z`, excerpt giving Aster standard monthly $20 on 3 November. [2] is UUID `00000000-0000-4000-8000-000000000012`, same URL, retrieved `2026-11-11T08:30:00Z`, excerpt giving $25 on 11 November and explicitly no established effective date. Both have null publication dates and are synthetic.

The numerical subtraction is 25 − 20 = 5. Repeating [2] and [1] on that claim fixes attachment only. The actual excerpts do not establish currency code, full denominator or billing commitment, so fully supported comparison still requires review. Neither a correct calculation nor the later retrieval can establish “changed on 11 November.” Even with separately clarified comparable operands, the result would remain a difference between recorded observations. An effective date requires independent explicit event evidence; publication and retrieval dates do not supply it.

Acceptance criteria for any later prototype:

- **AC-1:** Example 1 passes only when exact bindings, marker identities and signed result agree (INV-1–5).
- **AC-2:** Wrong result, reversed direction, unrelated same-price source, mismatched denominator/period/currency/commitment fail the relevant component (INV-3–5).
- **AC-3:** Neighboring-cell references never satisfy the derived cell; missing terms and multiple plausible operands require review (INV-2–5).
- **AC-4:** Same-URL historical/current UUIDs stay separate; numeric differences never yield effective dates (INV-1,6).
- **AC-5:** Old source records, marker mapping, raw output, streaming, database/UI contracts and runtime settings remain unchanged (INV-7,8).

## 10. Tests required

This phase adds language regressions, not a calculation verifier. The new deterministic tests pair accepted historical/date wording with generic-uncertainty negatives, passive no-record disclosure with evidence/terms negatives, and announced/planned/negated release with affirmative release/availability negatives. Existing scenario integration tests continue checking independent research, fabricated past answers, wrong vendors, arithmetic/direction/currency and effective-date claims.

Before implementing the prototype, add reviewed synthetic test operands and independent expected outcomes for AC-1–4. Cover exact decimals, zero and negative differences, both comparison directions, stale spans/UUIDs, duplicated references, unknown currency symbols, flat versus seat/project units, annual commitment versus monthly billing, introductory versus standard prices, minimum seats, omitted terms, multi-price/multi-product excerpts, aliases, multiple plan names, escaped table pipes, multi-number sentences, and contrary prose beside a correct equation. A later production slice additionally needs AC-5 integration tests for marker aggregation, persisted warnings, deletion, cancellation and UI wording. Do not write tests that merely repeat implementation arithmetic.

## 11. Alternatives, risks and expected benefit

Prompt-only explicit operand citations are cheap and compatible with the single tool, but prior prompt retries did not reliably repair multi-product attribution. They improve explainability, not correctness guarantees.

Deterministic post-answer coverage is a small evaluation improvement: report missing references in recognized derived claims and keep token-check limitations explicit. A production warning cannot currently be persisted and displayed without an additional interface decision. Recognition must stay bounded; arbitrary prose can evade detection. It adds no provider call, but it cannot solve unit/identity interpretation and must not declare arithmetic verified.

A transient reviewed-operand arithmetic prototype is an optional next engineering experiment, after owner review of its limited benefit. It tests the meaningful safety boundary without modifying app storage or tool schemas. Its downside is manual review and no automatic operand production. It can distinguish missing attachment, checked arithmetic and unresolved comparison terms, but **none of the observed matched derived answers reaches fully supported calculation under this conservative contract**. R2 has sufficient explicit USD/flat/monthly evidence to check a listed-amount subtraction after binding, with commitment still unknown; this does not verify comparable customer cost. R3 additionally lacks an explicit currency code/full denominator. The benefit is explainability and testing attachment, not a measured automatic acceptance gain. Treat the prototype as optional unless that diagnostic benefit warrants its manual gold-set cost.

Structured model claim/reference metadata would improve attachment and support explicit operand fields, but model-authored labels still need independent source binding. It changes output/tool/context contracts, streaming and possibly persistence. It is not the minimal approved step and is deferred.

Server-side rendering could preserve already validated UUID references and equations reliably. Without trusted operands it simply renders unverified claims more neatly. It also changes UI and evidence behavior, so defer it with structured extraction. A second LLM judge introduces latency/cost and another uncertain judgment; rejected. Expanding regex arithmetic across arbitrary prose is likewise rejected.

Expected benefits are transparent explanations, consistent cell-local coverage and deterministic rejection of wrong arithmetic once inputs are established. Residual risks include source truth, incomplete excerpts, ambiguous aliases/plans, hidden commercial terms, arbitrary prose, contradictory claims and detector false negatives. No semantic verification or improved real-model acceptance follows from this design.

## 12. Open decisions and recommended sequence

1. **Complete this phase:** bounded evaluation assertion corrections, regression tests, this proposal, one read-only Opus review, verification and checkpoint. Freeze original traces and retain Luna. Done only when checkpoint records actual results.
2. **Owner decision, blocking production work:** approve the evaluation-only reviewed-operand subtraction prototype as a separately scoped follow-up, or retain manual calculation review. Select explicit size/precision limits there; no automatic generation is required.
3. **Blocking production decision:** explicit operand references currently propagate a missing derived-token result to every reused marker. Before changing production prompts or checks, approve either a narrowly scoped result-token exemption after independently validated operands and arithmetic, or a separate per-claim diagnostic/state representation. Neither option is implemented or implicitly approved. The latter changes transport/persistence/UI contracts; the former changes checker semantics and needs strict false-positive tests. A coverage-only patch that leaves this propagation intact is not a recommended production fix.
4. **Later decision:** if automatic supported calculations are still needed, establish and test a trusted operand-binding producer first. One money token, currency code and period alone do not establish plan, complete units and commercial qualifiers. A future limited producer could be evaluated against independent gold bindings, but that experiment is not this phase and cannot be assumed successful. Any extraction, model-visible syntax, checker exception, storage or UI change needs explicit approval.

The present lack of a production operand-binding producer blocks automatic production arithmetic support, not this design's delivery. This proposal intentionally chooses an honest review result over a permissive numeric exemption.

## 13. Out of scope

Runtime model selection, new generation/bake-offs, broad prompt tuning, Responses API, new tools/agents/verifiers, evidence/database/registry changes, frontend rendering, the separate frontend worktree, submission and video recording.

## 14. Independent review and dispositions

One bounded read-only review ran through T3 as `claudeAgent` / `claude-opus-5-5`, `effort: high`, `fastMode: false`, beginning 23:31:30 IST on 11 November after the requested reset. Opus inspected actual matched traces, code, tests and rendering; it made no edits or provider generation calls. It endorsed the core production deferral, unchanged Luna and no semantic-verifier claim, but found blocking issues in the first draft. No second review round was requested.

Prioritized findings and main-agent responses:

1. **High: assertion false positives and regressions (B1/B2).** The first draft's co-occurring “historical + evidence + no” words could accept invented no-change claims, while its narrower verbs rejected truthful saved answers. Replaced co-occurrence with scoped absence forms, added adversarial F2/C2 tests and retained demonstrated change/date/referent variants. Expanded offline reassessment beyond the matched pair; exact corpus selection and final counts are in the checkpoint. The review's intermediate tally is not the final result.
2. **High: marker-state propagation and undefined coverage unit (D1/D2).** Explicit equations poison reused marker states under today's token checker. The old splitter also separates marker-adjacent conjunctions. The format is now a prototype input only; the proposed recognizer accepts only the explicit equation form within one cell/sentence boundary. Production prompting waits for an approved state/token treatment.
3. **High: no observed fully supported example (D3).** Opus proposed allowing a supported listed-amount label despite unknown commitment. We retain the owner's conservative separation: arithmetic may be checked, but full comparison support remains review-required. The proposal now explicitly states that no matched derived answer reaches fully supported status, and makes the manually bound prototype optional. This is an explainability experiment, not an automatic acceptance fix.
4. **Medium-high: testing reviewer inputs against themselves (D4).** The proposed prototype now consumes the raw answer and ledger, recognizes the actual equation and resolves its references automatically. Reviewed bindings are independent operand evidence; mutation tests target actual answer arithmetic, direction and placement. An automatic operand producer remains a separate unproven problem; one-number excerpts are insufficient.
5. **Medium: historical text/spans and asymmetric legacy passes (M1–M3).** Earlier assistant figures are not source operands. Coordinates index exact bounded model-visible excerpts; omitted terms are unavailable. The checkpoint separately flags Sol R3's legacy exemption as review-required even though its automatic pass remains unchanged.
6. **Lower: announcement objects and documentation (B3/M4/L1).** Added a bounded distinction between releasing an announcement and releasing a feature, preserving affirmative feature-release negatives. Kept ambiguous `$` currencies under review; no same-symbol conversion assumption. Clarified evidence claims and reduced promises about the prototype. The invariant/test lists remain because they define approval gates, not a new production taxonomy.

Opus did not independently check source-deletion behavior or matched-request equality. Those claims rest on existing integration tests and the main-agent read-only audit, respectively. Residual lexical paraphrase/negation limits, per-marker aggregation and incomplete commercial evidence remain explicit.
