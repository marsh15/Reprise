# Reprise evaluations — M4

The runner exercises the real application turn service, in-memory SQLite, raw recall, bounded single-tool agent, source ledger, cancellation and deterministic citation checker. Assertions never call an LLM judge. Reports and captures belong under ignored `evals/results/`.

## Evidence layers

Keep these results separate:

1. **Unit tests:** deterministic code and controlled boundary tests under `tests/unit/`.
2. **Mock integration:** scripted SDK responses plus synthetic search evidence, including actual HTTP/server/process tests. `npm run eval -- --mock` exercises the scenario harness. These passes do not establish that a model searches, resolves entities, resists injection, compares prices or reasons correctly.
3. **Live LLM with replay:** real generation against frozen inputs. `synthetic_search_live_llm`, `recorded_search_live_llm` and `mixed_search_live_llm` are distinct report categories. Checked-in cassettes are synthetic, never recorded vendor observations. No-search scenarios do not turn a recorded-search run into a mixed one.
4. **Fully live:** real LLM and Tavily. Historical scenario records remain labelled fixtures; they are not genuine user history. Capture/retrieval time remains actual, even though the scenario clock is frozen.
5. **Human review:** inspect transcripts, claims and source excerpts for semantic support and conversational quality. Every report leaves this pending. An automatic pass does not complete this review.

The targeted remediation record is [CORRECTNESS-REVIEW.md](../docs/CORRECTNESS-REVIEW.md); it separates product defects from harness defects and records every new attempt. Live OpenAI/Tavily checks have now run, including all 11 P0 scenarios with frozen synthetic evidence. Acceptance remains unmet; see [LIVE-ACCEPTANCE.md](../docs/LIVE-ACCEPTANCE.md) for actual scores, source-review failures, recorded-search limits and measurements. The [M6 checkpoint](../docs/M6-CHECKPOINT.md) records the earlier offline baseline.

## Run and reproduce

```bash
npm run typecheck
npm test
npm run build
npm run eval -- --mock
npm run eval -- --mock --only C1,C2,C3,J1,K2,K3,T1
npm run eval                         # real configured LLM + checked-in synthetic replay
npm run eval -- --only C1,D1,F1
npm run eval -- --live --only C1,D1,F1
```

The scenario clock is `2026-11-11T08:30:00Z`, Asia/Kolkata. Each scenario gets a fresh in-memory database. `--only` accepts comma-separated IDs and rejects unknown IDs. Different modes cannot be combined. Exit 0 means selected assertions passed; 1 means scenario failures; 2 means configuration/provider/cassette access blocked. An HTTP-rejected turn is **untested**, excluded from rates and model timing/cost, and stops the run. Other stream/protocol failures are failed scenarios to inspect, not silently discarded.

`--output-prefix evals/results/luna` writes `luna.json` and `luna.md`; choose a fresh prefix to retain a run. Generated filenames have unique suffixes otherwise. Reports retain the actual question, answer, recall packet, model request bodies, stream events, tool calls/results, queries, source observations, citations, warnings and failure messages. Request headers, API keys and raw provider error bodies are never captured.

Each row has an input hash and a cassette hash. The implementation hash covers server/shared code, evaluation definitions/assertions/setup, fixture and test-helper inputs, and the package/lock files. It excludes `.env` and generated results. Random database/observation IDs do not determine input hashes. The cassette hash covers its parsed frozen payload, including provenance and observation times. Model parameters and any provider routing appear in request traces. Keep the same implementation, scenario selection and capture directory for each candidate.

Research prompts specify exact queries and freshness to make replay reproducible. This measures tool use and synthesis given controlled evidence, **not unconstrained search-query quality**. D1 and the other controlled research questions now explicitly specify freshness any rather than leaving a required cassette field to model choice. F2 explicitly requests current research as well as historical abstention. These changed inputs and stricter citation checks make new results non-equivalent to the prior baseline. The original canonical cassette payloads are unchanged. A normalized `query|freshness` miss fails visibly; replay never falls back to live search. Invalid/non-normalized cassette keys fail before generation. Do not add aliases that quietly change the evidence returned.

The sequential evaluator freezes opaque UUIDs inside each isolated scenario and restores normal UUID generation afterward. This keeps record IDs in actual recall/tool messages identical between candidates. Focused tests compare complete request bodies on repeated scripted runs. The application continues to generate normal UUIDs.

## Capture actual search evidence

Configure `LLM_API_KEY` for the explicit OpenAI endpoint/model, and `TAVILY_API_KEY`, privately in the local ignored `.env`. OpenRouter evaluations instead use `OPENROUTER_API_KEY` and an explicit base URL/US provider. Never put keys in shell commands, reports, Git or chat. The injected config placeholders inside the harness never authenticate a provider request; the real client and search adapter use only their intended environment credentials.

```bash
npm run smoke:llm
npm run eval -- --record --cassette-dir evals/results/capture --only C1,D1,F1
# Review and freeze the captures, then use them unchanged for every candidate:
npm run eval -- --cassette-dir evals/results/capture --only C1,D1,F1 --model gpt-6-luna
```

Recording requires a separate directory; canonical paths also reject a symlink back to checked-in cassettes. It calls real Tavily and persists sanitized outcomes with capture timestamps. Replay preserves them. Live mode needs no cassette file and writes no capture. Mixed inputs remain labelled mixed.

Several controlled tests intentionally use fictional services or injected conflicts/failures. Arbitrary live replacements may not satisfy those fixture assumptions. Review any recorded replacement and its assertions before using it as benchmark evidence; freeze both before comparing models. C1's requirements for the specific four synthetic verdicts apply only to synthetic fresh evidence; real pages are never required to demonstrate a change that did not occur. Core coverage, search, disclosure and citation checks still apply. A partial C1/D1/F1 capture is a smoke corpus, not the full acceptance suite. A full replay can use frozen synthetic controls alongside reviewed recordings, but its category is then mixed, not fully recorded-search.

## Coverage and assertion limits

All 19 §N.2 scenarios are implemented, plus J2, K2, K3 and T1: **11 P0 + 12 P1 = 23**.

| IDs | Coverage |
|---|---|
| A1, B1, B2 | Continuity; all turns on a date; topic missing on an otherwise recorded date |
| C1 | Five CRM products; original source observations; independent searches; verified change, observed difference, no established change and uncertainty in controlled evidence |
| C2 | Postgres recommendation without original sources; current units/usage; no invented baseline |
| C3 | Earlier answer contradicted by its own historical source; original error versus later change |
| D1, E1, E2 | Current information; no-search rephrasing and arithmetic |
| F1, F2 | Missing-history abstention; current research without inventing a past discussion |
| G1, H1, H2 | Conflicting sources; memory-aware Tuesday ambiguity and alternative dates |
| I1, I2 | Timed-out and malformed searches; completed response with disclosed verification limits |
| J1, J2 | Follow-up product identity for seat comparisons; later user correction |
| K1, K2, K3 | Monthly versus annual billing; currency mismatch; per-user versus flat rates, minimum seats, introductory versus standard terms |
| L1, T1 | Untrusted search injection; discussion/publication/retrieval/rollout dates and announcement versus availability |

Assertions are visible in `scenarios.ts`, `memoryScenarios.ts`, `recheckScenarios.ts`, `followupScenarios.ts`, `pricingScenarios.ts` and `assertions.ts`. They check status, search counts, recall content/date selection, names, explicit disclosures, selected misleading patterns and citation ledger states. Focused negative tests reject selected wrong answers. They do not prove every sentence, entity attribution, price normalization or source interpretation. The dated-change pattern guard is deliberately narrow (especially for date phrasing); it is not a semantic verifier. Expected fixture prices/events are not hardcoded in production.

The citation checker validates marker existence and numerical/date token presence; controlled grounding checks now also reject unverified references and uncited monetary source claims. A matching number in a different plan can still pass. New citations identify individual immutable observations; old and fresh excerpts no longer pool behind a URL marker. The checker also warns about explicit known-subject mismatches, checks table cells independently, and normalizes equivalent calendar dates with role-specific metadata support. An unsupported nonnumeric sentence may remain unchecked. Derived totals may be flagged if an excerpt lacks that computed value. Review calculations, units and supporting excerpts manually; never interpret `verified` as factual verification.

## Reports and costs

JSON is machine readable; Markdown contains a summary table, questions, transcripts, queries, citations, warnings, hashes and failure explanations. Full traces and the evidence ledger live in the companion JSON. P0/P1 rates have separate planned/attempted/passed counts; untested IDs remain explicit. Full-suite automated targets cannot be asserted from a subset, mock run or provider-blocked run. Human review and owner model approval remain separate gates even when automatic targets pass.

Each scenario has final-answer TTFT, total agent latency, input/output tokens, estimated USD, measured USD and the price basis. Missing usage or an exact model/provider/base-URL rate yields **unknown**, not zero. Mock measurements are null; raw scripted stats remain only in the trace/result. Aggregate timings use completed eligible turns. Raw rejected-request duration is retained for debugging but never presented as model response performance.

Costs use provider token usage × dated rates in `prices.json`, ignore cache discounts and search credits, and are estimates, not measured bills. The current rate table is inherited from M2; no new billing measurement or pricing validation occurred in M4. `measuredUsd` remains null. No model-cost metric can be inferred from the successful mocks.

## Pending model bake-off

Keep the provisional default unchanged until owner approval. Approved comparison candidates only:

- `gpt-6-luna` at the explicit OpenAI endpoint, with `LLM_API_KEY`.
- `gpt-6-sol` at the same endpoint, additionally approved for the controlled comparison in [MODEL-COMPARISON.md](../docs/MODEL-COMPARISON.md). Both Sol and Luna require `reasoning_effort: none` for Chat Completions tools; the adapter preserves it and rejects incompatible overrides. `gpt-6.1-sol` is different and is not approved here. Verified Sol rates are $2/M input and $10/M output tokens, ignoring cache discounts.
- `gpt-6.1-terra` at OpenAI, with the same credential prerequisite. The existing Chat Completions capability guard rejects its documented Responses-only tool path. This remains an explicit mismatch, not a reason to substitute a model or migrate architecture.
- `deepseek/deepseek-v4.1-flash` at OpenRouter, pinned to `fireworks/us`, with usable `OPENROUTER_API_KEY` credits. Fallback is disabled. The inherited explicit-parallel-parameter omission remains documented in M2; generation of parallel calls is unverified.

After credentials, smoke each genuinely available candidate before spending a full-suite run. The owner can explicitly omit an unavailable candidate; document why. Do not repeat the currently blocked credit request.

```bash
npm run smoke:llm -- --model gpt-6-luna --base-url https://api.openai.com/v1
npm run smoke:llm -- --model gpt-6-sol --base-url https://api.openai.com/v1 --output-prefix evals/results/sol-smoke
npm run smoke:llm -- --model gpt-6.1-terra --base-url https://api.openai.com/v1
npm run smoke:llm -- --model deepseek/deepseek-v4.1-flash --base-url https://openrouter.ai/api/v1 --provider fireworks/us
# Use identical frozen inputs for every available compatible candidate:
npm run eval -- --model gpt-6-luna --base-url https://api.openai.com/v1 --output-prefix evals/results/luna
npm run eval -- --model deepseek/deepseek-v4.1-flash --base-url https://openrouter.ai/api/v1 --provider fireworks/us --output-prefix evals/results/deepseek
npm run eval:compare -- evals/results/luna.json evals/results/deepseek.json
npm run eval -- --live --only C1,D1,F1
```

To use reviewed recordings, add the same `--cassette-dir` to **both** full-suite replay commands. The comparison tool rejects mocked, blocked, incomplete, duplicate or unplanned candidates and different implementation/scenario/cassette hashes. It outputs ignored JSON and Markdown comparisons without changing any configuration. Do not use it on the two currently blocked reports.

The smoke script stops at its first failed probe before further calls, caps responses at 256 output tokens, and records validated token counts and estimated cost. `--output-prefix` retains sanitized requests, answers and calls privately under ignored results. Evaluation calls have no automatic retries. Pass the same explicit `--max-completion-tokens 1536` to both candidates for a budgeted comparison; this cap appears in transmitted requests and captures without changing application behavior. Track cumulative usage and reserve budget before each stage: this is not a provider-side billing cap. Missing usage remains unknown.

Final eligible comparisons require every canonical scenario exactly once with correct priority, consistent pass counts/rates, nonempty input/evidence hashes and request evidence. Sol/Luna request models and reasoning settings must match their report, their initial prompts must agree, and their initial parameters may differ only by model. Focused subsets remain ineligible for final ranking.

Choose highest P0 rate, then lower median total latency, then lower estimated cost. Missing tie-break metrics leave a tie unresolved. Report P1, TTFT, tokens, cost basis, tool reliability and citation integrity too. Human reviewers assess memory/temporal correctness, price comparability, claim support and conversational quality from full traces. No automatic LLM judge is used. Present the evidence and request owner approval of a winner; these commands never select the default.

## Debug a failure

Reproduce with `--only ID` using the identical cassette directory/model/options. Inspect JSON requests, recalled raw question/answer and original source timestamps, tool calls, actual queries/results, stream events and final citation associations. Classify the first failing step: recall/context, date resolution, tool decision/query, insufficient/conflicting evidence, model reasoning, citation mismatch, prompt, bad assertion/fixture, provider compatibility, or timeout/budget. Fix the narrow cause, rerun that case and relevant regressions, then simplify. A provider-blocked turn has no model-quality result.

## Focused correctness regressions

`npm run eval -- --only R1,R2,R3` uses three additional synthetic controls through the same runner/report/trace path. `--mock --only R1,R2,R3` checks their integration mechanics. They are opt-in and do not change the canonical 11-P0/12-P1 acceptance denominator. R1 supplies an old official snapshot contradicted by a newer official stable-release notice; R2 searches three products with unrelated recalled evidence and coincident price tokens; R3 keeps old and fresh observations of one URL separate. Their negative tests reject stale conclusions, reconstructed product-order references, wrong vendors with matching numbers, uncited prices and unsupported effective dates. `correctnessScenarios.ts` is an evaluation-only module to keep these diagnostic controls separate from acceptance scenarios; no application module or tool was added.

Assertion normalization handles typographic apostrophes, equivalent no-record/baseline language and bounded negative availability phrasing. Affirmative shipment, fabricated historical advice, invalid/unsupported citations and false cross-currency conclusions still fail negative controls. These checks remain transparent lexical tests; they do not certify semantics. A narrowly labelled difference can be checked arithmetically from two separately cited, single-price observations with matching units and currency; wrong arithmetic/direction and unsupported price claims still fail. Ambiguous derived-number forms remain conservatively flagged and need manual review.

## Citation-design phase: bounded language repairs

[The citation-support proposal](../docs/CITATION-SUPPORT-DESIGN.md) keeps production arithmetic verification behind owner approval. This phase changes evaluation language checks only. `limitation` now requires a named historical information gap or an explicitly limited historical comparison; generic “cannot establish that” and current-price uncertainty do not qualify. Missing conversation history (`noRecord`), missing historical sources, missing pricing terms and current research/citation requirements remain distinct checks. A missing-history disclosure does not waive F2's independent current-research requirement.

`changeDateUncertainty` recognizes unknown effective dates, “neither source establishes when the change occurred,” and negated establishment of a change date. It does not accept unrelated price/refund uncertainty. The existing effective-date negative guard still rejects selected invented dates, including observation/retrieval dates presented as change dates, even alongside a correct uncertainty caveat. Announcement/planning and negated shipment remain separate from affirmative release, eligible-customer availability and general availability. C1's synthetic planned-availability evidence cannot support those affirmative claims.

Focused deterministic tests are in `tests/unit/evaluation-language.test.ts`; they exercise the demonstrated wording families and selected adversarial controls, with F2/C2/R3/C1 integration through unchanged scenarios. The first draft introduced a no-change false positive and saved-answer regressions; the independent Opus review exposed them before commit. Scoped absence checks and retained truthful variants now have explicit regressions, and the checkpoint records the final full saved-corpus reassessment. The predicates are bounded lexical checks, not an open-ended language parser. They cannot reliably interpret arbitrary paraphrases, resolve every negation scope, identify all event dates, detect all contradictory prose or prove that an answer's historical gap matches the actual recall packet. Unrecognized forms and semantic attribution require human review. Do not expand regexes indefinitely or introduce an automatic LLM judge.

The legacy evaluation-only `supportedDifference` remains unchanged, including its limited preceding-statement inference. Do not interpret its pass as the proposed stronger calculation-support contract. In particular, same-unit token matching does not prove full denominator, plan, commitment or claim attachment. Correct but uncited derived values remain conservatively flagged in the matched Luna R3 and Sol R2 answers. The design proposes direct operand references and reviewed evidence bindings before deterministic signed subtraction. Its equation syntax is an evaluation prototype input only: using it in production today can propagate an unverified result token to all reused operand markers. Production prompting requires an approved token/state treatment first; no checker exception, extraction schema, ledger state or frontend change is implemented here.

Rechecking saved answers is **offline reassessment without new generation**, recorded separately under ignored `evals/results/citation-design/`. Original generation reports, evidence, hashes, priorities and scenario IDs remain unchanged. Revised assertion classifications are not improved real-model acceptance, new performance measurements or a runtime-model selection. Generation remains paused until the owner reviews and stabilizes this contract; the earlier bake-off commands above are reference instructions, not authorization to run them in this phase. Luna remains provisional and unchanged.
