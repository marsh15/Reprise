# M4 checkpoint — historical rechecking and evaluation

Date: 11 November 2026. Repository: `marsh15/Reprise`, branch `main`. Verified starting HEAD: `f987e0b`; clean and synchronized with `origin/main` before editing.

**Independent M4 implementation and offline verification are complete. M4 live acceptance and the M2/M4 model bake-off remain pending. No model winner was selected, and the provisional default was not changed. M5 has not started.**

Main implementer: Sol 6.1 High. Two bounded Terra 6.1 High tasks supplied isolated follow-up/pricing scenarios, synthetic cassettes and assertion tests. The main implementer reviewed their code, integrated it, removed a fixture-only restriction from general pricing assertions, and reran the complete suite. Neither helper changed the application, prompt, agent, database or provider behavior.

## 1. Implemented functionality

- Expanded the static prompt's four evidence categories, price comparability requirements, announcement/availability distinction, source-date roles, original-error handling and per-claim recheck instructions. The model must name gaps rather than interpret failed searches as unchanged facts.
- Extended the existing deterministic recheck hint to raw answers in recent chat, as well as separately recalled turns. A recalled question without an answer does not create a supposed answer to verify. An interrupted answer can trigger rechecking but is explicitly described as an incomplete baseline.
- Completed every §N.2 scenario, preserving all 13 existing mock scenarios. Added four supplementary cases for later corrections, currency, introductory pricing and publication/rollout dates.
- Added explicit synthetic historical/current CRM and Postgres evidence, including a past answer contradicted by its own source. Vendor names and URLs identify products; all supplied values/events are labelled invented evaluation data, not vendor observations.
- Strengthened the evaluation runner: validated CLI selection, frozen independent scenario databases, implementation/input/cassette hashes, full request-body and stream-event traces, raw recall packets and evidence ledgers, separate P0/P1 planned/attempted/passed counts, source provenance, row warnings, and readable Markdown plus JSON reports.
- Added per-scenario final-answer TTFT, total latency, token usage, estimated cost, measured-cost field and exact endpoint price basis. Unknowns remain null. Mock scores/performance/cost are withheld; provider-rejected turns are untested, not scored failures or response-performance samples.
- Added `npm run eval:compare` for eligible complete replay reports from planned candidates. It rejects mismatched implementations/cassettes/selections and never changes the application model. Human qualitative review and owner approval remain pending.
- Improved cassette boundaries: reject non-normalized keys, avoid requiring a cassette for live search, retain capture dates in replay, and refuse recording into checked-in cassettes, including an equivalent symlink path.

No dependency, schema, infrastructure, UI or application orchestration changes were needed. The application still exposes only `web_search` to one model. There is no second verifier, fact table, summary, embedding/vector store, application subagent pipeline or workflow framework.

## 2. Actual execution flow and authority

1. The existing turn service persists the user request and obtains the M3 recall packet: raw original questions/answers, resolved local dates, source observations, recent messages, index metadata and explicit missing/ambiguous-history notes.
2. The context renderer detects recheck language only when a recorded answer is supplied. It adds a small hint to verify the relevant answer's checkable claims. It does not extract facts, select verdicts, force searches or decide semantic comparability.
3. The unchanged source registry registers historical and carried observations first. Every observation retains its UUID and original retrieval date. Current searches append observations; the same URL reuses a marker without overwriting old excerpts.
4. The same model receives the static prompt, raw conversation and bounded context. Identifying the intended answer, checkable claims and needed searches remains model reasoning under the existing memory/date policy. Unresolved ambiguity should produce a focused clarification.
5. Existing orchestration executes independent `web_search` calls concurrently. Limits remain three research rounds, five queries per round, ten per turn, eight-second search bounds and a 25-second research deadline. The research deadline is not an absolute end-to-end answer timeout.
6. The model compares evidence with its proper product, tier, seat count, unit, billing commitment, currency, discounts, packaging and dates, then states claim-level conclusions with current turn markers. This behavior is instructed and mock-integrated, **not yet demonstrated with a live model**.
7. The unchanged deterministic checker validates marker existence and numerical/date token presence. The existing transaction persists the answer, searches, observations and citations; streaming, reset, stop, retry and cancellation behavior remains authoritative.
8. The evaluation wrapper records requests without headers/keys, streamed events including resets, the actual recall packet, search queries and the final ledger. Its automatic assertions and provenance classification produce the report. Human semantic review is a separate step.

Raw historical messages prove what was said. Their associated sources are dated observations, not proof the answer was correct then. A conversation title alone cannot establish a past answer. A source's publication date, retrieval date, announced event and effective/availability date are separate facts.

## 3. Complete scenario coverage

**23 scenarios: 11 P0 and 12 P1. All 19 original §N.2 rows are implemented.**

| ID | Priority | Coverage |
|---|---|---|
| A1 | P0 | Same-chat first question after unrelated turns; no search |
| B1 | P0 | Both original topics on the requested date; excludes another date |
| B2 | P1 | Requested topic absent on a recorded date; names actual topics |
| C1 | P0 | Five-CRM recall and historical evidence; independent searches; four change categories in the controlled fixture; no invented change date |
| C2 | P0 | Postgres recheck without historical sources; current evidence and incompatible hosting units/usage |
| C3 | P1 | Incorrect historical backup claim contradicted by its original source; correction rather than invented vendor change |
| D1 | P0 | Search for current information and numerical citations |
| E1 | P0 | No-search rephrasing with conversation continuity |
| E2 | P1 | No-search arithmetic |
| F1 | P0 | Absent historical conversation; history-start disclosure; no invented quote/search |
| F2 | P0 | Missing Postgres history plus separately grounded current research |
| G1 | P1 | Conflicting prices; disclosure and citations to both sources |
| H1 | P0 | Memory-aware Tuesday selection and stated assumption |
| H2 | P1 | Both Tuesdays recorded; newer candidate and older alternative |
| I1 | P0 | Timed-out search, bounded completion and inability disclosure |
| I2 | P1 | Malformed search result/failure disclosure |
| J1 | P1 | Follow-up CRM identity for seat comparison; billing caveat |
| J2 | P1 | Later user correction supersedes earlier choice |
| K1 | P1 | Per-seat monthly versus annual-billed price |
| K2 | P1 | Different currencies without an exchange rate; no unsupported cheapest claim |
| K3 | P1 | Per-user versus flat price, minimum seats, annual commitment and introductory versus standard rates |
| L1 | P0 | Search prompt injection; normal answer rather than injected output |
| T1 | P1 | Discussion/publication/retrieval/rollout dates; announcement does not prove availability |

Assertions are transparent lexical and ledger checks. Negative tests reject selected misleading answers; they do not establish general language understanding. C1's four specific verdict expectations apply only when fresh evidence is synthetic. A live source is not required to demonstrate the fixture's invented change. Core search/coverage/disclosure/citation assertions still apply. Production has no scenario IDs or challenge-specific branches.

## 4. Verification results and evidence categories

Baseline before edits: **270 tests / 26 files**, TypeScript and production build passed on Node 26.10.0.

| Verification | Actual result | Interpretation |
|---|---|---|
| Node 26.10.0 strict TypeScript | Passed | Compile-time correctness |
| Node 26 complete offline suite | **322 tests / 32 files passed**, 0 failures; final run about 9.79 s | 239 tests under `unit`, 83 under `integration`; controlled boundaries, not live providers |
| Node 24.22.2 strict TypeScript | Passed using actual Node 24 binary | Supported runtime compatibility |
| Node 24 complete offline suite | **322 tests / 32 files passed**, 0 failures; final run about 9.63 s | Process tests launch actual Node 24 children through `process.execPath` |
| Node 24 and 26 production builds | Passed | Client JS 493.18 kB / 149.83 kB gzip; CSS 6.00 kB / 2.02 kB gzip |
| Mock scenario suite, both runtimes | **23/23 assertions passed: 11 P0 + 12 P1** | Scripted fake LLM + synthetic search; no model score |
| Production-server integration (`REPRISE_TEST_PRODUCTION=1`) | 1 test passed after build | Actual local HTTP/SDK/SQLite/server processes, fake provider |
| Live LLM + synthetic replay | No successful generation | No model pass rate |
| Recorded search + live LLM | Not run successfully; no actual captures | Blocked prerequisites |
| Fully live C1/D1/F1 | Blocked before execution, exit 2 | Tavily credential absent |
| Human qualitative model review | Pending | No real generated answers available to review |

Existing date-resolution coverage (64 cases), persistence/restart, FTS, raw-source provenance, recall navigation rendering, stream/cancel/retry and process guarantees remain in the passing suite. No UI files changed; this milestone did not repeat M3's browser/mobile walkthrough or claim a new live-browser result.

New checks cover recent-answer hints, missing actual answers, same-URL observations across dates, original erroneous answers, all added scenarios and selected bad outputs, price/currency/commitment caveats, temporal roles, CLI rejection, normalized cassette keys, live mode without a cassette, provider trace credential exclusion, US pinning, distinct evaluation categories, unknown costs, separate P0/P1 rates, full-suite gates and comparison input compatibility.

Generated JSON/Markdown, raw test JSON and local captures are ignored under `evals/results/`. They were not committed. The selected durable report is this checkpoint, as requested.

## 5. Actual provider checks and blocked dependencies

Only presence/configuration status was inspected; credential values were never printed, persisted in reports or committed. The existing provider key was used only for its intended provider request. Deterministic tests use explicitly local fake transports; injected harness config placeholders never authenticate live requests.

| Action | Actual result |
|---|---|
| Safe environment inspection | `LLM_API_KEY` absent; `TAVILY_API_KEY` absent; optional `OPENROUTER_API_KEY` present, initially unvalidated |
| Existing `npm run smoke:llm` | SKIPPED, exit 1: `LLM_API_KEY absent` |
| One explicit DeepSeek/OpenRouter `fireworks/us` D1 replay attempt | HTTP 402 before generation, exit 2; no search or answer; stopped without repeated requests |
| Updated `npm run eval` | BLOCKED, exit 2: `LLM_API_KEY absent`; all selected scenarios untested |
| `npm run eval -- --live --only C1,D1,F1` | BLOCKED, exit 2: `TAVILY_API_KEY absent`; no live search |
| Terra smoke selection | SKIPPED, exit 1: existing guard requires Responses API tools while Reprise uses Chat Completions; no request/model substitution |

Real streaming, tool round trips, real parallel tool generation, supported parameters, Tavily transport and an actual end-to-end research turn remain **unverified**. The deterministic SDK/stream tests do not satisfy these gates. No new external API parameters were introduced. Existing M2 provider compatibility rules and its documentation checks were preserved; they were not treated as new live verification.

Required next inputs: a valid `LLM_API_KEY` for the explicit OpenAI endpoint and compatible model; a valid `TAVILY_API_KEY`; and usable credits/provider availability for the optional OpenRouter candidate. The existing Terra tool/API mismatch requires an explicit future owner decision if it still applies; M4 does not migrate APIs to bypass it. Keys belong in the local ignored `.env`, never in chat or committed files.

## 6. Pending model comparison, latency and cost

| Planned candidate | M4 access/compatibility state | P0 / P1 | Median TTFT / total latency | Tokens / cost | Model tool reliability |
|---|---|---|---|---|---|
| `gpt-6-luna`, OpenAI | Credential absent | Untested | Not measured | Unknown | Untested |
| `gpt-6.1-terra`, OpenAI | Credential absent and existing Chat Completions tool guard rejects pairing | Untested | Not measured | Unknown | Untested |
| `deepseek/deepseek-v4.1-flash`, OpenRouter `fireworks/us` | One actual request rejected with HTTP 402 before generation | Untested | Not measured | Unknown | Untested |

No provider response-quality/performance comparison was possible. Test-suite durations above are engineering verification times, not model inference latency. Scripted token counts/timing are not measurements. No measured provider bill was obtained. Future estimates use actual usage × the exact model/provider/base-URL rate in `prices.json`; missing usage/rates stay unknown, caching discounts and search credits are excluded, and measured cost stays null. The dated rate table is inherited from M2, not newly validated pricing or a receipt.

The [evaluation README](../evals/README.md) contains runnable smoke, recording, replay, full-suite candidate and comparison commands. Use identical implementation, scenarios and frozen cassettes. Checked-in cassettes remain explicitly synthetic; a live model against them is not a recorded-search evaluation. Review actual captured replacements and fixture assumptions before freezing a recorded corpus. Fictional conflict/timeout/product controls cannot be assumed equivalent to arbitrary live pages.

The decision remains highest P0 success, then lower median total latency, then lower estimated cost. Missing tie-break data leaves a tie unresolved. Inspect P1, tools, citation integrity, memory/temporal reasoning and conversational quality manually. The comparison tool rejects mock/blocked/incomplete or mismatched reports. It never writes a default model. **A winner still requires owner approval.**

## 7. Failures investigated and fixes

- **C1/C2/C3 initial mock failures:** reproduced with `--only C1,C2,C3`; traces showed correct requested queries but `cassette_miss` tool outcomes. Cause: hand-authored fixture keys retained uppercase product names while lookup normalizes lowercase. This was test-data construction, not model reasoning. Normalized the keys, added load-time validation plus a negative boundary test, and reran the three cases: all passed. Then the entire suite passed.
- **Recent-chat recheck hint gap:** code inspection and focused regression showed a prior answer in current chat was excluded unless also separately recalled. Cause: the old hint only checked `recalledTurns.length`. Extended it to supplied raw recent answers; tests also ensure a question without an answer does not establish a baseline. Existing memory/agent regressions passed.
- **Potential live assertion distortion:** review found that requiring every source to remain fixture-labelled would reject real evidence, and requiring C1's invented category mix could pressure a live answer to invent change. Removed the general fixture-only source restriction; confined those C1 fixture expectations to synthetic fresh evidence. A negative/positive regression verifies that honest inability can pass core live checks. All synthetic regressions remain passing.
- **Provider prerequisites:** OpenAI/Tavily absence and OpenRouter HTTP 402 were configuration/access blockers, not wrong model answers. No fabricated result, retry loop, silent provider switch or default-model change was used.

There are no remaining failing offline scenarios. There are no real-model scenario passes either. Full model-specific failure diagnosis remains pending the missing dependencies; reports now expose the traces needed for it.

## 8. Simplification and deviations

An explicit simplification pass kept all production changes in the existing prompt and context renderer. Removed duplicate completion checking and the obsolete deferred-scenario export. Reused the actual turn service, recall, ledger and checker throughout evaluation; no parallel implementation of memory/research was introduced. Tiny scenario-local assertion helpers remain local where their policies differ, rather than creating a generic evaluator or semantic verifier.

New cohesive modules beyond §Q's illustrative layout are justified:

- `evals/execute.ts`: one scenario setup/execution/trace path and reproducibility fingerprints.
- `evals/report.ts`: pure metrics/provenance calculation and Markdown rendering, separately tested.
- `evals/comparison.ts` and `compare.ts`: validated report comparison and a small CLI; no application configuration mutation.
- `evals/assertions.ts`: shared recheck assertions with documented lexical limits.
- `recheckScenarios.ts`, `followupScenarios.ts`, `pricingScenarios.ts`: bounded domain fixtures instead of an oversized scenario file.
- Focused assertion/runner/provider tests and seven synthetic cassette files: reproducible coverage of the required evidence distinctions.

All added TypeScript files are below the plan's 300-line limit. No dependencies or lockfile changes. The only package change is `eval:compare`. The small §H.5 extension to current-chat answers addresses the same general recheck behavior; no router or deterministic claim-comparison subsystem was added. P0/P1 live acceptance and the planned bake-off are intentionally unfinished because access is blocked. Plain-English commits and the push follow the owner's explicit M4 instructions, overriding the older §X commit-style default.

## 9. Remaining risks

1. Actual model compliance, search decisions/query quality, correct conversation interpretation, arithmetic normalization, injection resistance and semantic citation support remain probabilistic and unmeasured. Static prompt changes need real-model evaluation.
2. Number/date presence does not verify full meaning. The same URL intentionally shares a citation marker across dated observations; the canonical card may point to the older observation. UUIDs/excerpts/timestamps remain in the ledger, but the checker does not determine which observation supports a sentence.
3. Automatic assertions are narrow. A misleading response can satisfy lexical checks; derived totals can be numerically unverified even when computed correctly. Human review is necessary.
4. Exact-query cassettes trade search-query freedom for controlled comparability. Synthetic vendor facts are not real product knowledge. Actual captures can invalidate fixture-specific expectations and must be reviewed before a benchmark.
5. Frozen historical scenarios combined with actual capture dates create an explicit temporal gap. Publication dates do not automatically establish effective dates. Historical source absence prevents establishing a change even if current information is available.
6. Inherited M3 keyword-recall/paraphrase limitations, context bounds and operational risks remain as documented in M3. No broad architectural changes were made to address hypothetical failures.
7. Provider options, account availability, current pricing and the Terra API mismatch still need account-level live checks before a credible bake-off. No architecture change or alternate candidate is preapproved here.

## 10. Concepts and technical explanations

**Verified change versus observed difference.** An explicit vendor notice saying the same tier's price moved from one amount to another, effective on a stated date, establishes that change within its scope. An old stored $20 observation and a current $24 page, without such a notice, establish only differing observations. They do not prove when the price changed, or that the old observation was correct. The C1 numbers/events are synthetic illustrations of this distinction.

**No established change versus unable to verify.** Matching checked observations or no historical baseline do not demonstrate a change; neither proves nothing changed between dates. A missing/failed search, unavailable applicable terms or unresolved conflict means the specific claim could not be verified. The answer should name the limitation rather than declare the product unchanged.

**Historical evidence provenance.** Original raw questions/answers remain authoritative about what was said. Original source UUIDs and retrieval dates are preserved; fresh retrieval creates another observation. Fixture flags and historical/current labels keep invented demo history separate from genuine observations. A publication date cannot substitute for the day the user asked or a price took effect.

**Changed pricing.** Identify the exact product/tier and check seats, per-user/flat units, monthly/annual charges and commitments, currency, discounts, introductory/standard terms, packaging and dates. Annual monthly equivalents are not monthly contracts; a workspace charge is not a per-project charge. State missing terms and assumptions instead of manufacturing equivalence or a change date. A recommendation also depends on workload/features, not just its smallest visible number.

**Deterministic checks.** A $30 token appearing under another tier can validate a numerically similar but false sentence. Marker validity and token matching are useful mechanical checks, not semantic truth. Reprise did not add a second LLM or claim a full factual verifier.

**Why cassettes.** Freeze the exact evidence so candidate models face the same inputs despite changing web results, search ranking and network availability. Preserve capture dates and distinguish actual recordings from authored controls. This improves reproducibility while leaving unconstrained query quality and current-world truth as separate questions.

**What mocks cannot prove.** Scripts select the expected calls and final words themselves. They test orchestration, persistence, source numbering, boundaries and assertions, but cannot prove that a live model chooses the correct conversation/tool, handles injection, compares products or grounds its own sentences correctly.

**Model selection.** Run actual compatible candidates against identical inputs, publish real P0/P1, tool/citation and performance results with unknowns intact, review semantics/conversation quality, apply P0 → latency → cost, and obtain owner approval. There is no evidence-based winner yet.

## 11. Git delivery and stop condition

Verified code commits, both pushed normally to `origin/main`:

- `3f11ca6` — Improve historical answer verification
- `f7fffa4` — Complete reproducible historical recheck evaluations

The normal push advanced `origin/main` from `f987e0b` through `f7fffa4`; the tree was clean and synchronized before adding this checkpoint and its master-plan note. Staged diffs were reviewed, `git diff --check` passed, and a private configured-value scan found no credentials in staged content. No `.env`, database, generated report, capture, browser artifact or dependency cache was staged. No history was rewritten.

This checkpoint and the plan status are delivered in the following documentation commit. The final response records that exact HEAD, successful push and final clean-tree verification, as with earlier milestones.

**Stop at M4's blocked live acceptance gate.** Provide valid provider access and decide how to handle the unavailable/incompatible candidates before the live bake-off. Do not infer acceptance from the 23 mock passes. Do not start M5 without explicit owner approval.
