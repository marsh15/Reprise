# Citation design checkpoint: 11 November 2026

**Status: evaluation corrections verified and pushed; citation support remains a proposal for owner approval. Do not submit.** Main agent: Sol 6.1 High. One independent engineering review: Opus 5.5 High, read-only, started after 23:31 IST. Runtime default: `gpt-6-luna`, unchanged. No application generation, bake-off, new runtime candidate, Responses migration, semantic verifier, submission or video in this phase.

## 1. Evaluation-contract defects corrected

The phase began at clean `main`, `94c710a`, matching `origin/main`. Read the actual matched Luna/Sol traces before drafting, then the comparison, correctness and live-acceptance reports, DESIGN, evaluation scenarios/assertions, source registry, citation checker, persistence, context rendering and relevant tests. Reconfirmed the unchanged 390-test baseline before editing.

Historical-baseline checks now accept the demonstrated inability to identify previously discussed plans or establish whether pricing changed. They also accept missing historical sources, missing historical terms, unavailable previous prices and limited past/current comparisons. Absence must attach to historical information; a generic “cannot establish that” does not pass. Missing conversation history remains separate from source evidence and pricing terms. F2 still requires independent current research, history-start disclosure and valid source support.

Change-date uncertainty now recognizes the actual Luna R3 wording, unknown effective dates, inability to date an underlying change, and equivalent evidence/observation verbs. Unrelated current-price or refund uncertainty does not qualify. The existing unsupported effective-date guard remains strict for its bounded recognized forms, even when a correct caveat is also present.

Availability checks retain announced/planned/negated shipment distinctions and reject affirmative released, shipped, eligible-customer available and generally available claims when the fixture supports only planned availability. Releasing an announcement is distinguished from releasing a feature. No general availability or negation parser was introduced.

The first draft contained substantive regressions; it was not committed. Opus exposed both invented no-change false positives and rejected truthful saved wording. Those findings were reproduced with deterministic failing tests and corrected before final verification.

## 2. Positive and negative assertions added

Added **60 deterministic cases** in one focused evaluation test file. Positive families include scoped missing historical information, passive missing-history disclosure, truthful inability to determine pricing changes, alternate change-date word order/verbs, and negated release statements. These use several wordings rather than a scenario-specific exact sentence.

Negative controls include generic uncertainty; affirmative available historical terms; current uncertainty substituted for missing history; missing sources/terms substituted for missing conversations; invented “historical pricing shows no change”; unrelated uses of “no”; known effective dates substituted for uncertainty; refund timing; affirmative release/eligible availability/general availability; invented historical discussion; absent independent research; and invented ISO/prose effective dates alongside a correct caveat. End-to-end F2/C2/R3/C1 checks reuse their actual mock service/evidence paths. Existing arithmetic, wrong-direction, currency, vendor, old-observation and citation-placement controls remain unchanged and pass.

The initial equivalent-language cases failed before correction. The 13 added Opus-review cases also failed before the review fixes; two further historical-reference regressions were discovered in expanded reassessment and failed before their fix. Final focused verification: **86/86 tests** across the new file and existing evaluation-contract/correctness integration files.

These are selected lexical discrimination controls, not proof of all possible language or semantic consistency. No second LLM judge is used by evaluations.

## 3. Exact files changed

- `evals/assertions.ts`: bounded historical absence/reference forms, passive no-record wording, change-date uncertainty helper, and release/announcement distinction.
- `evals/correctnessScenarios.ts`: R3 uses the reusable uncertainty helper. Existing ID, priority, question, script and evidence remain intact.
- `tests/unit/evaluation-language.test.ts`: 60 focused positive/negative regressions.
- `evals/README.md`: correction scope, lexical limits, offline-reassessment rules and production design boundary.
- `docs/CITATION-SUPPORT-DESIGN.md`: proposed contract, current interfaces, worked examples, alternatives, risks, sequence and Opus findings/dispositions.
- `docs/CITATION-DESIGN-CHECKPOINT.md`: this delivery record.

No production application file changed. No `src/client/**`, `PRODUCT.md`, `DESIGN-UI.md`, dependency, lockfile, model configuration, tool schema, evidence schema, source registry identity, fixture/cassette payload or frontend-worktree file changed. No merge, rebase or history rewrite occurred.

## 4. Verification results

All final commands passed:

- `npm run typecheck`.
- `npm test`: **450/450**, 38 files, 16.95 seconds. The verified 390-test baseline plus 60 new cases is retained.
- `npm run build`: passed; client JS remains **499.56 kB / 151.80 kB gzip**, with unchanged emitted JS/CSS asset names.
- `npm run eval -- --mock`: **23/23**, canonical 11 P0 and 12 P1, with an explicit ignored output prefix.
- `npm run eval -- --mock --only R1,R2,R3`: **3/3**, with a separate ignored prefix.
- Focused `npx vitest run tests/unit/evaluation-language.test.ts tests/unit/evaluation-contracts.test.ts tests/integration/correctness.test.ts`: **86/86**.
- Staged diff whitespace, approved-path and credential-pattern checks: passed.

Final mock reports are `evals/results/citation-design/final-canonical-mock.{json,md}` and `final-adversarial-mock.{json,md}`. Both carry implementation fingerprint `a29f88a9da0c701823796c160245866bc8bc84f9fbeb6f10b3aaccd38d8c0ddb`. Documentation-only checkpoint changes do not enter that fingerprint.

Mock passes validate mechanics, not real-model acceptance. No chargeable application evaluation or live search was run. The explicitly authorized Opus engineering review is separate from application runtime generation.

## 5. Offline reassessment and changed classifications

**Operation: offline reassessment without new generation.** Scripts under ignored `evals/results/citation-design/` import assertions and inspect saved result objects. They do not call LLM/search providers, rewrite generation reports or alter source observations.

Compared final predicates with the actual `94c710a` assertion/scenario modules against all eligible saved report rows found recursively outside this phase's output directory. The complete scan covered **108 report JSON files, 1,154 nonempty saved row instances and 233 distinct `(scenario ID, exact answer text)` pairs**. Of those pairs, **204** came from non-mock reports. All row instances were checked with their own evidence; unique summaries retain the first evidence object and every report location. This explicit selection/deduplication differs from Opus's intermediate reported corpus count, so its preliminary tally is not reused as a final metric.

Relative to the baseline predicates on the same saved result objects: **zero added failures, zero pass-to-fail changes, one distinct fail-to-pass change, and three distinct answers with a removed failure**. These are diagnostics of assertion changes, not an acceptance rate. Saved answers span historical implementations, so replaying today's checks does not make them a matched current-generation benchmark.

The three affected distinct answers are:

- **Matched Sol F2**, `model-comparison/sol-frozen-first.json`: `historical baseline limitation missing` clears; the saved answer passes the corrected assertions. It already disclosed missing history, searched and cited the supplied current synthetic observation, and withheld a historical comparison.
- **Matched Luna R3**, `model-comparison/luna-frozen-first.json`: `missing change-date uncertainty` clears. `uncited numerical source claim` remains, so the answer still fails.
- **Earlier Luna C2**, `live-acceptance/luna-synthetic-accepted-candidate.json`: inability to verify whether pricing changed is now recognized. `no citations` and the recomputed uncited-money failure remain, so the answer still fails.

Sol R2 retains its uncited verdict-cell calculation failure. Sol R3 retains its existing automatic pass through the unchanged legacy difference exemption, but **its derived claim requires review under the proposed stronger attachment/operand contract**. This asymmetry must be reported in future comparison analysis, not treated as a semantic advantage.

Outputs: `offline-reassessment.json` (initial matched-pair audit), `full-corpus-reassessment.json` (final non-mock audit), and `all-saved-reassessment.json` (final complete saved-row audit). Original generation reports and scores remain historical and unchanged.

## 6. Why classifications changed and evidence integrity

Only bounded language recognition changed. No answer was regenerated, no source filled in, no citation moved and no correct calculation silently exempted. Sol F2's truthful prior-plan/pricing-change limitation and Luna R3's explicit absence of an effective date were present in the original text. The earlier C2 language likewise disclosed uncertainty but did not satisfy the old lexical form.

Reconfirmed all six matched initial request bodies after removing only `model`, input/cassette hashes, complete source ledgers and original implementation hashes: equal for every pair. Generation implementation hash remains `1bfca40cc28b70f91dcd73112e2412eb1a363675426656d4d8e8504455974fe5`.

Original full-file SHA-256 values, rechecked after the work:

- Luna frozen report: `c63f5a42b5e9ed55abca8a61ffa00bc3c5f7bc66cade936c68e6db191f6709a7`.
- Sol frozen report: `b505b9a6d6cbc48a9bbaccb8661f72de51fa00250109a82462a025a441b99b96`.

Unchanged production/fixture diffs, immutable capture hashes and existing persistence/registry tests establish this phase's preservation of source observations and markers. No acceptance scenario branches on a model or special answer string; shared concept checks handle the corrected wording families. Their lexical limitations remain explicit.

## 7. Proposed citation-support contract

See [CITATION-SUPPORT-DESIGN.md](CITATION-SUPPORT-DESIGN.md) for the reviewable proposal.

The smallest calculation subset is signed monetary subtraction, with both operand references attached to the actual recognized claim. Reuse `SourceRecord` UUIDs, exact model-visible excerpt spans, source dates and fixture status. Bind product, plan/offer, currency, complete pricing denominator/period and commitment independently; compare compatible operands and check exact minor-unit arithmetic and direction. Do not use two coincident numbers in arbitrary excerpts as proof. Unknowns require review; known incompatible units/currencies reject comparison support. No conversions, percentages, sums or seat totals initially.

The optional next experiment is an evaluation-only explicit-equation recognizer taking raw answer text and its ledger, with independently reviewed operand bindings as a gold evidence interpretation. It would measure attachment and bounded arithmetic, not claim to supply automatic semantic bindings. Prior assistant figures are not source operands; spans beyond the model-visible historical clipping window are invalid.

Correct arithmetic is distinct from full commercial comparison support. No matched derived answer currently reaches fully supported status under the conservative proposed contract; some can have their listed-amount arithmetic checked while terms remain review-required. The expected benefit is explainability and reliable rejection boundaries, not a promised acceptance improvement.

## 8. Independent Opus review

One T3 task used catalog-confirmed `claudeAgent` / `claude-opus-5-5`, `effort: high`, `fastMode: false`, starting **23:31:30 IST** after the requested reset. It was read-only, used no application generation/search, edited no files and spawned no follow-up review. The main agent held code edits during it.

Prioritized findings and dispositions:

1. **High: first-draft assertion false positives and saved-answer regressions.** Reproduced and corrected scoped absence/uncertainty forms; added adversarial tests and the full saved-row audit above. No final added failures remain in that corpus.
2. **High: adding equation references poisons reused marker states today.** The derived result is missing from sources, and worst-state aggregation then makes correct operand-price citations unverified too. Design now forbids promoting its syntax to the production prompt before an approved token/state treatment.
3. **High: sentence/cell coverage was undefined against the existing splitter.** Design now restricts the prototype to an explicit equation form and says not to inherit marker-adjacent conjunction splitting.
4. **High: no observed full support with unknown commitments.** Design now states this explicitly. Opus suggested a looser supported listed-amount label; the main agent retains the owner's conservative full-support boundary while allowing a distinct arithmetic-checked result. The manually bound prototype is optional, with its limited benefit explicit.
5. **Medium-high: a prototype could merely verify reviewer-provided claims.** It must instead parse raw answer claims and resolve markers itself, with independent gold operand bindings and mutated-answer controls. Automatic binding remains an unresolved separate problem.
6. **Medium/lower: assistant text as evidence, clipping coordinates, legacy R3 asymmetry, announcement objects and overstatement.** All are clarified in the design/tests/README; ambiguous currency and unsupported language remain review-required.

The design's §14 records the findings and responses. There was no second review cycle and no implied Opus reapproval of the revised code. Opus did not independently verify deleted-source lifecycle behavior or matched-request equality; the main agent relies on existing tests and its own audit for those points.

## 9. Remaining limitations

Lexical predicates cannot establish arbitrary meaning, negation scope, all effective-date forms or absence of contradictory claims. The legacy evaluation-only `supportedDifference` remains incomplete and unchanged; it must not become the production verifier or justify a runtime winner. Model generations and original source interpretation still need human review.

The production source interface has no trusted structured price operands. Product/plan aliases, commercial terms, complete units, currency ambiguity and clipped evidence can remain unresolved. Same URL is not same observation or plan. Subtraction between observations never establishes an effective date, cause, intervening history or original-answer correctness.

Existing `verified` means token presence, with narrow subject warnings; it is not semantic support. Per-marker aggregation and the absence of a per-claim persisted warning channel remain. No automatic support producer or latency improvement has been demonstrated.

## 10. Production changes requiring approval

No production change is implemented or implicitly approved. Before a production arithmetic fix, choose between an independently validated, narrowly bounded result-token exception and a separately designed per-claim support representation. The former changes checker semantics; the latter affects transport/persistence/UI. Direct-operand prompt requirements must wait for that decision to prevent a citation-display regression.

Any operand extraction/producer, model-visible syntax or schema change, ledger/registry change, UI rendering, new tool/agent/model verifier or broader pipeline remains outside this phase. There is no established schema-preserving generic warning path for uncited claims today. Owner approval of the proposal may authorize a separately scoped evaluation prototype; it does not automatically authorize those production changes or paid generations.

## 11. Git commits and push status

- `54f869a908f165995c8862cb1cbb771783505829` — **Clarify evaluation uncertainty and citation support design**. Five reviewed files, committed after final verification. Pushed to `origin/main`; `git ls-remote` confirmed the exact SHA.
- This checkpoint is a separate documentation commit, **Record citation design checkpoint**. Its own SHA cannot be embedded in its content; the final handoff supplies its exact commit and push confirmation.

Staged paths and diffs were reviewed, whitespace checked, and credential patterns scanned. No private transcripts, generated reports/captures, local databases or keys were staged. Changes use plain-English commit subjects and append history on main. No PR was created.

## 12. Impact on future model comparison

The controlled comparison conclusion stands: Sol is compatible with the current Chat Completions architecture at reasoning `none`, was faster in six matched cases, and did not demonstrate materially better semantic correctness. Both models produced equivalent valid evidence-based answers in several cases. Some failures were lexical or derived-number coverage limitations. Neither is approved as the final winner; Luna remains the unchanged provisional default.

Corrected assertions change the future evaluation fingerprint. Review and freeze that contract before any separately authorized generation. Retain original historical scores, label reassessment separately, and report derived-support review outcomes alongside automatic results. Do not claim a new real-model acceptance improvement, full P0 coverage or semantic verification from these offline results. No new candidate or bake-off is authorized here.

## 13. Submission readiness and stop

**Not submission-ready.** Full P0 acceptance, reliable multi-product grounding, human review and owner model approval remain unmet. The scoped engineering phase is complete once this checkpoint is committed and pushed. Stop for owner review of the citation-support proposal. No application submission or video recording occurred.
