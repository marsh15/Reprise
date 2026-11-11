# M2 checkpoint — research, evidence and citations

Date: 11 November 2026. Starting commit: `f0ebb1f` on `main`.

**Implementation and deterministic verification are finished. Live acceptance and the model bake-off remain blocked. No winning model was selected. M3 has not started.** The approved Chat Completions/single-tool architecture remains in place.

## Implemented features and boundaries

- `search/tavily.ts`: plain-fetch Tavily POST adapter; Zod request/response validation; basic depth, five results, three chunks, publication-date request and freshness mapping. Eight seconds covers the original request, one retry and its 300 ms delay. Retry only network/5xx; auth/quota/malformed responses are explicit outcomes. Parent cancellation propagates. The injected function/fetch is the test seam, with no provider framework.
- `search/sanitize.ts`: control removal, whitespace collapse, delimiter neutralization, word-boundary 1,500-character excerpts, safe HTTP(S) URLs without credentials, hash/UTM removal and canonical deduplication. Titles are sanitized too. Missing/invalid publication dates stay null; retrieval time is separate.
- `agent/modelStep.ts`: real SDK streaming, indexed/interleaved tool-call accumulation, protocol checks and one declared function, `web_search`. Argument/id/name bounds contain malformed streams. Usage is counted once per request, then summed across requests; missing usage is explicitly incomplete.
- `agent/researchRound.ts` + `budget.ts`: argument validation, parallel execution, normalized duplicate guard, per-round/per-turn limits, error tool results and query ledger records. Non-cooperative replacement searches are bounded too; late results cannot mutate a completed turn.
- `agent/runTurn.ts`: at most three research steps followed by an answer-only step; absolute 25-second research deadline; cancellation; final-step text; citation checking and safe failure codes. The final answer can continue after the research deadline under the SDK's existing timeout/retry policy; 25 seconds is not a total turn deadline.
- `agent/sourceRegistry.ts`: a turn-local URL-to-number registry with immutable observation IDs. Same URL reuses its number, while every returned observation remains distinct. All excerpts supplied for a source number participate in the numerical check. The first observation is the citation's canonical source reference; the message also retains every observation-to-number association.
- `agent/citations.ts`: adjacent and comma-separated markers; source validity; money, percentages, English/ISO dates and multi-digit bare numbers; combined cited evidence per sentence/table row; worst state per marker. States are invalid, unverified, unchecked and verified. No second model or semantic verifier.
- `db/repo.ts`: writes assistant + searches + sources + citations in one synchronous SQLite transaction using M1's existing schema. Message metadata stores `{sourceId,n}` references, never duplicate source excerpts. Reads reconstruct the evidence DTO; deletion cannot resurrect an excerpt from metadata. The last two assistant turns carry up to eight cited observations without inventing new searches/retrieval times.
- `agent/prompt.ts`: static §H.6 prompt, local/UTC now, timezone, actual history start, recent conversation and carried source context. Historical citation numbers are explicitly distinguished from this turn's registry. No date parser, temporal recall, conversation index, seeding, or M3 UI was added.
- `shared/research.ts` + `shared/types.ts`: validated evidence DTOs and search/citation SSE events. Final source/citation reconciliation follows the database transaction. Existing retry/idempotency/disconnect/shutdown behavior remains authoritative.
- `ResearchStatus`, `Citation`, `citationMarkdown.ts`, `sourceLabels.ts`, `research.css`: compact live query status, expandable query/source details, safe links, fixture/date labels, keyboard/hover cards, Escape dismissal, dotted unverified pills and invalid `[?]` pills. Markdown code/links are left alone. Calendar-only publication dates cannot shift to yesterday in a negative timezone. Parallel durations are not summed as elapsed time; repeated URL observations are counted once in the source summary.
- `evals/`: v0 runner, synthetic frozen cassettes, separate recording/replay modes, actual-provider selection, US-only OpenRouter endpoint pinning, deterministic assertions, input hashes, transcripts, token/tool accounting and conservative cost estimates when usage is known. Mock mode never produces a model score.

All server SQL stays in the repository. No dependencies, infrastructure, routing models, application subagents or agent frameworks were added. Server source totals approximately 1,003 lines including schema; every added source/test file is below 300 lines.

## Agent execution, step by step

1. M1's turn service saves the user message, reserves the conversation and emits `turn.started`.
2. Code assembles the last 20 messages, current time/history start, and cited observations carried from the last two replies. The static system prompt stays first.
3. The model streams text or requests one or more `web_search` calls. Code accumulates fragments by tool index, not arrival order.
4. The first tool fragment clears draft text and emits `answer.reset`. Each complete call is validated. Invalid/foreign calls receive `invalid_arguments`; duplicates receive `duplicate`; excess valid queries receive `budget_exceeded` and a skipped ledger row.
5. Accepted independent searches run concurrently. Code sanitizes results, assigns source numbers and observation IDs, emits progress, and supplies one tool-result message for each tool call.
6. The same model gets the tool transcript and may research again. Three rounds, five queries per round, ten per turn, an eight-second search timeout and the 25-second research deadline are enforced in code. On exhaustion it gets a runtime note plus `tool_choice: none`.
7. A finished answer goes through the deterministic citation checker. The complete result is committed atomically before citation/completion events. Stop/disconnect saves the current final-step partial text as interrupted; provider failures save it as failed. Retrieved observations remain attached even if the answer is interrupted. An incomplete research preamble is never saved as the final answer.

## Verification evidence

Baseline: Node 26.10.0, **10 files / 58 tests**, type check and production build passed before edits.

Final verification:

- Node 26.10.0: `npm run typecheck`, `npm test`, `npm run eval -- --mock`, and `npm run build` pass. Final suite: **20 files / 158 tests**. The last full native run is recorded in this session; representative full runs were roughly 9–10 seconds.
- Node 24.22.2: actual `node@24.22.2` execution of TypeScript, Vitest and Vite passes: **158 tests**, 9.11-second suite, production build 189 ms. Process tests launch actual Node 24 children through `process.execPath`.
- `REPRISE_TEST_PRODUCTION=1 npx vitest run tests/integration/server.test.ts`: **1 passed** after building. It uses actual server/HTTP/SDK processes with a fake provider.
- Nine **mock** scenarios pass: D1, E1, E2, F1, I1, I2, L1, G1 and K1. These use scripted model responses and synthetic search fixtures. They verify integration and assertions, not real model judgment or injection resistance.
- New tests cover response sanitization/errors/retry/deadline, 25 citation cases, URL registry observations, fragmented parallel calls, multiple rounds, query budgets, malformed/foreign/duplicate calls, failed searches, research deadline during a model request, non-cooperative/late searches, research/final-text cancellation, ignored `tool_choice`, atomic evidence rollback, carried-source timestamps/association, safe rendering, calendar dates, source counts, reducer reset behavior and cassette capture/replay.
- M0/M1 coverage remains: streaming, partial persistence, duplicate submission, cancellation, retry, conversation management, transaction rollback, FTS, process restart/disconnect and shutdown. The old no-tools assertion and exact SSE event list were updated for M2's intentional contracts.
- Browser: actual React/Hono/SQLite/SDK stack with an isolated **fake model and fake search**. Verified final draft removal, research summary and expanded sources, correct registered links, checked/unverified/invalid citations, code-span preservation, keyboard focus/tooltip/Escape, and persisted evidence after reload. At **390×844**, document scroll width equals client width (390), with no horizontal overflow; the mobile card remains accessible. No React/browser console error was observed. The initial navigation preceded server startup and showed `chrome-error://chromewebdata/`; navigation succeeded after the fixture server started. T3 collaborative preview worked; no alternate browser was needed.
- Production JS: approximately **490.86 kB / 149.11 kB gzip**, CSS 5.50 kB / 1.89 kB gzip.
- `git diff --check` and staged reviews passed. No keys, databases, browser artifacts, logs or generated evaluation results are committed. Dependency lockfile unchanged.

## Official API checks and actual live results

Checked on 11 November 2026:

- [Tavily search reference](https://docs.tavily.com/documentation/api-reference/endpoint/search): Bearer auth, basic search, five-result limit, `chunks_per_source: 3`, `include_published_date` and `time_range` are documented. Missing dates are allowed. `max_age_hours` is a cache-age setting; no unrequested freshness/effective-date claim is inferred from it.
- [OpenAI Chat Completions reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create): streaming, function tools, `tool_choice`, parallel-call flag, usage chunks and model-dependent reasoning effort. Documentation is not account-level live acceptance.
- [GPT-6 Luna model](https://developers.openai.com/api/docs/models/gpt-6-luna): Chat Completions function calling requires `reasoning_effort: none`. The small capability function applies none when unset and rejects a conflicting configured value. The model ID was not changed.
- [GPT-6.1 Terra model](https://developers.openai.com/api/docs/models/gpt-6.1-terra): tool calling requires Responses API. The current architecture rejects this pairing explicitly. No Responses migration or model substitution was made.
- [OpenRouter routing](https://openrouter.ai/docs/guides/routing/provider-selection) and [candidate endpoints](https://openrouter.ai/api/v1/models/deepseek/deepseek-v4.1-flash/endpoints): exact candidate exists; `fireworks/us` is a listed US-specific endpoint. Evaluation requests set `only`, disable fallback and require supported parameters.

Actual commands/results:

| Check | Result | What it establishes |
|---|---|---|
| `npm run smoke:llm` | SKIPPED / exit 1: `LLM_API_KEY` absent | No OpenAI live compatibility established |
| Terra smoke selection | SKIPPED / exit 1: requires Responses tool calling | Explicit documented capability mismatch, no substitution |
| DeepSeek/OpenRouter US streaming + none | HTTP 402 | Account lacks usable credits; generation untested |
| DeepSeek forced tool + continuation probe | HTTP 402 | Actual tool generation/round-trip untested |
| DeepSeek explicit parallel tool probe | HTTP 404 | No matching pinned endpoint under strict requested parameters; parallel generation unverified |
| DeepSeek reasoning and mid-system probes | HTTP 402 each | Acceptance/behavior untested |
| `npm run eval` | BLOCKED / exit 2: LLM key absent | No model scenario score |
| DeepSeek `--only D1` replay | BLOCKED / exit 2: `llm_http_402` before generation | Scenario untested, no score/latency/cost assigned |
| `--live --only D1,F1` | BLOCKED / exit 2: Tavily key absent | No live search/captures |

Normal DeepSeek/OpenRouter requests omit the explicit parallel parameter after the strict probe's 404; the smoke probe retains it to expose the mismatch. Search execution still supports concurrent calls if a compatible model emits them. Real streaming, usage, reasoning, tool choice and parallel generation acceptance remain unverified. The optional OpenRouter key was used privately from the environment and never printed or persisted.

## Model comparison and measurements

The result matrix is also recorded in §N.4 of `PLAN.md`.

| Candidate | Status | P0 pass rate | Median TTFT / total | Usage / cost per turn | Qualitative result |
|---|---|---|---|---|---|
| GPT-6 Luna | Untested: no key | Untested | Not measured | Unknown | Docs allow tools only at effort none |
| GPT-6.1 Terra | Untested; incompatible tool API | Untested | Not measured | Unknown | Requires an architectural API change, which was not authorized |
| DeepSeek V4.1 Flash, OpenRouter `fireworks/us` | Untested: 402; parallel flag 404 | Untested | Not measured | Unknown | No generated answer available for review |

Published rates are stored with official source links in `evals/prices.json`; they are not observed costs. The runner uses reported usage × the exact configured provider rate, ignores caching discounts, excludes search credits, and returns unknown if usage/pricing is missing. Mock latencies, token counts and transcripts are not presented as model measurements. **No winner/default approval is requested without comparative evidence.** Default ID remains `gpt-6-luna`, provisionally, as before M2.

## Simplification and correctness review

Main-agent review traced asynchronous calls, protocol pairing, cancellation/deadline propagation, source registration, transaction timing, deletion and citation mapping. This was a code review, not a claim of correctness from test counts alone.

Resolved findings:

- A sanitizer discarded a complete final word that fit; fixed with an adversarial boundary case.
- Same-URL observations could lose the newer supporting excerpt when carried; carry all observations associated with a cited marker, preserving their IDs/times.
- Cumulative usage chunks could be counted twice; use the last per-request totals and explicitly mark missing usage.
- A non-cooperative search could resolve after timeout; ignore late results and remove abort listeners.
- Summing parallel search durations overstated elapsed research; use the search interval span. Count canonical source numbers, not repeated URL observations.
- Date-only publication values could shift in a negative timezone; render calendar dates without shifting and retrieval instants locally.
- Incomplete/HTTP-blocked evaluations could imply zero tokens or a zero model score; unknown metrics stay null and provider-blocked cases stay untested.
- Shared source URL/date presentation removes duplicated policy; a separate behavior-preserving pass combines repeated evidence reducer setup without new abstractions. Tests passed unchanged after that reducer simplification.

## Deviations and remaining risks

- No architecture change. The newly discovered Terra mismatch and missing/insufficient provider access prevent the live bake-off. An incompatible candidate cannot be “fixed” by omitting tools or silently using another model.
- Checked-in cassettes are explicitly synthetic because no Tavily key is available. Record/replay machinery was verified with a fake search; no real recording is claimed. Fixed query wording in research eval inputs controls replay variability; this does not evaluate unconstrained query generation.
- The v0 runner covers nine M2 scenarios. Recall-dependent scenarios in §N require M3/M4 and are listed as deferred, not passes. The final complete P0 comparison must run again after those milestones.
- Additional cohesive files beyond the illustrative §Q tree: `shared/research.ts` separates evidence validation; `modelStep.ts`/`researchRound.ts` split streaming from search execution; client markdown/source-label/CSS files own rendering boundaries; `evals/cassettes.ts`/`provider.ts` isolate replay and provider pinning; focused test/browser helpers cover those boundaries. No generic framework or class hierarchy.
- Existing v1 tables were reused; number-to-observation associations use message metadata, avoiding an unnecessary migration/table.
- Citation verification only checks identity and token presence. Matching a number elsewhere in an excerpt, or in another cited excerpt in the same sentence, can pass an incorrect claim. Same-URL observations share a marker and their supplied excerpts are combined; their distinct dates remain in the ledger. It does not verify meaning, truth, effective dates, attribution, source quality, negation or comparability.
- Prompt-injection safeguards contain capabilities, not model judgment. A malicious excerpt can still influence wording or generated search queries. There is no shell, file, database or arbitrary-fetch tool; all searches still use the same validated endpoint and budgets. Real-model resistance to L1 remains pending access.
- The 25-second bound covers research; final model generation/retries can take longer. Live latency/cost targets and real provider cancellation are pending credentials/credits. Frozen test clocks make wall-clock research summaries illustrative, not performance measurements.
- M1 limits remain: one process per database, no durable in-flight draft checkpoint on SIGKILL/power loss, and no atomic database/network commit. Completed replay/DB reconciliation still handles lost terminal events.

## Acceptance gate

1. Parallel current-information research and checked citations: **passes with fake LLM/search; live pending**.
2. Small talk/rephrasing without searches: **deterministic passes; real-model behavior pending**.
3. Budgets, deadline and cancellation: **passes**.
4. Injection evaluation: **containment/mock assertions pass; real-model evaluation pending**.
5. Model comparison: **blocked results documented, no winner**.
6. M0/M1 regressions, strict typing, production build: **passes**.
7. Available live checks: **attempted, blocked as above**.

M2 is ready for checkpoint review with these explicit live gates open. Do not treat this as permission to begin M3.

## Concepts to defend to minimi

1. **Loop:** code prepares context; one model requests parallel searches; code validates/bounds them and returns numbered excerpts; the same model synthesizes; code checks and persists. Repeat only while budget remains.
2. **Bounded budget:** prevents runaway cost, repeated queries and indefinite research. Parallel work reduces waiting; caps guarantee a finite tool loop even if the model keeps asking. Final answer honesty is required when evidence is insufficient.
3. **`answer.reset`:** streamed text preceding tool calls is a draft, not an evidence-backed final answer. Clearing it in both server state and UI prevents stale text after research or Stop.
4. **Identifiers/provenance:** a citation number is local display identity; an observation UUID identifies exact historical evidence. A URL can change. Keep the excerpt and retrieval/publication dates that were actually supplied, and preserve every observation rather than replacing history with today's page.
5. **Deterministic checking:** code reproducibly identifies missing sources/numbers/dates. It is cheap and explainable, but does not understand meaning. “Verified” is always qualified as token presence.
6. **Injection:** source fields are untrusted tool data, delimiters are neutralized, HTML is not executed, and the model cannot acquire new tools. The budget bounds extra searches. These measures do not prove a model cannot be persuaded to write a wrong answer.
7. **One agent:** this job needs controlled retrieval and synthesis, not competing agents. One loop has fewer calls, lower coordination overhead, and explicit cancellation/persistence/provenance boundaries. Development helpers were limited to presentation components and sanitization test cases; there are no subagents in Reprise itself.

## Git delivery

Verified commits, in order:

- `3e43ba1` Add Tavily search integration
- `433121f` Verify citations against retrieved sources
- `a6fa8d1` Implement bounded research with durable source evidence
- `2bda456` Show research progress and citation evidence
- `e91300b` Add reproducible research evaluations and provider probes
- `04bc203` Keep source dates and counts accurate in citation cards
- `9113d75` Simplify research event state updates
- `dd8ee25` Report blocked evaluations without invented scores
- A final documentation commit records this checkpoint and the §N.4 blocked bake-off table.

Staged changes are reviewed before each commit. All commits are pushed normally to `origin/main`; published history is not rewritten. The final reply reports the documentation commit and verified push status.
