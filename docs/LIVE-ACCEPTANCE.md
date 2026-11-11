# Live acceptance — 11 November 2026

**Reprise can call a real LLM and Tavily, stream answers, stop generation and retry. It is not ready for minimi evaluation.** The final full controlled run passed **8/11 P0 and 4/12 P1** automatic assertions. The final fully live C1/D1/F1 subset passed **1/3**. Source review found substantive errors beyond lexical assertions, especially outdated current-information conclusions and citations pointing to unrelated products. All-P0 acceptance remains unmet.

Keep **`gpt-6-luna` provisional**, with its existing configuration. No comparison winner was established, no default changed, and no Responses migration was made. Owner approval and human answer review remain pending. No application was submitted or architecture video recorded.

## Scope and environment

Started with clean `main` at `8ad1caa7265ec9c9c57717a8febfb964626c0715`. Node **26.10.0**. Read the plan, M6 checkpoint, evaluation guide, DESIGN, environment template and actual model/agent/search/registry/evaluation/smoke paths. The previous 339-test, 23-mock, Node 24/26 and clean-clone baseline was retained; the clean-clone and Node 24 exercises were not repeated.

Both `LLM_API_KEY` and `TAVILY_API_KEY` were nonempty in local ignored configuration. Optional `OPENROUTER_API_KEY` was present. Presence alone was not treated as proof of usable access. No credential value was printed, copied into evidence or committed. Subscription access was not assumed to supply API credits.

Actual application endpoint: **`https://api.openai.com/v1`**, model **`gpt-6-luna`**, reasoning override unset. The existing adapter sends **`reasoning_effort: none`** and enables parallel calls. `REPRISE_NOW` was unset for application conversations; evaluations deliberately used their documented frozen scenario clock. All manual app data, seeded fixtures, logs and transcripts used the isolated ignored database `evals/results/live-acceptance/app.db`, on port 5187.

Initial inspection and smoke were performed by the main agent without helpers. Two later isolated, read-only reviews used catalog-confirmed **Terra 6.1 / high** through T3/Codex. Those development helpers are not Reprise runtime providers and are not bake-off evidence.

## Provider compatibility

The existing `npm run smoke:llm` initially passed streaming, usage, forced calls, continuation and two parallel calls. Its reasoning and mid-conversation-system probes returned HTTP 400. A minimal reproduction identified the exact parameter error: `parallel_tool_calls` was supplied without `tools`. This was a smoke-script defect: the actual application always supplies its tool definition, including answer-only steps.

The two probes now include the same tool definition with `tool_choice: none`. The corrected command passed all five probes, exit 0:

| Capability | Actual result |
|---|---|
| Chat Completions and streamed content | Passed; normal `stop` finish |
| `tool_choice: none` | Text, no tool calls |
| Forced named `web_search` | One valid call with schema-valid arguments |
| Tool-result continuation | Text, normal finish and usage after supplied tool result |
| `tool_choice: required`, parallel calls | Two valid calls in one response, followed by successful continuation |
| Reasoning parameter | `none` passed with the application request shape |
| Later system message | Passed with the application request shape |
| Usage | Final usage chunks observed; evaluation usage accumulated across model steps |
| Cancellation | Real UI Stop interrupted a provider stream; partial persisted; Retry completed |
| Error behavior | Actual HTTP 400 reproduced and diagnosed; no guard removed or automatic provider substitution |

Only the compatible reasoning setting was live-tested. Other reasoning levels with Luna tools remain rejected by the existing local guard, consistent with [official Luna documentation](https://developers.openai.com/api/docs/models/gpt-6-luna). The [Chat Completions reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) documents tool-choice, streaming, usage and parallel-call parameters. No blanket claim about all possible settings, provider errors or server-side billing cancellation is made.

## Real Tavily verification

The first actual adapter query was `Node.js latest LTS release official November 2026`, freshness `month`. The outgoing POST used basic search, five results, publication dates, three chunks and `time_range: month`. It returned five usable results in **1,298 ms**, including the official Node.js 26.13.0 LTS release and a security-release announcement. The real response had the expected `results` array with URL/title/content and optional `published_date`; the existing validation and sanitization accepted it.

The release excerpt described the transition to LTS; the security announcement described releases expected on or after its announced date. Publication timestamps and those effective/release dates are different facts. Publication dates were preserved when parseable and remained null when absent. Excerpts and normalized HTTP(S) URLs were retained; results also included third-party and stale pages. A provider result is not automatically relevant or current. One nonsense `site:` query unexpectedly returned unrelated tax-form pages, demonstrating that query syntax is not a guaranteed relevance filter.

An intentionally empty outgoing query produced actual **HTTP 400**, mapped by the adapter to `{status: error, error: http, results: []}` in **251 ms**. An invalid-domain restriction probe also returned HTTP 400. No successful real-provider **empty-results** response was observed; empty/malformed/timeout behavior remains covered by deterministic tests and synthetic controls, not newly established by a real empty result. These diagnostic requests used no fabricated provider response.

A genuine defect emerged in `--live` evaluations: without capture metadata, fresh observations inherited the frozen scenario clock as their retrieval time. Live and recording modes now share wall-clock capture stamping while replay preserves its stored timestamp. A regression failed before the correction and passed afterward. Final live observations, for example, retain actual **10:59 UTC** retrieval times rather than the **08:30 UTC** scenario clock. Search start/scenario time remains frozen by design; do not read it as the actual request wall time. The normal application already used its real clock.

Tavily's [official search contract](https://docs.tavily.com/documentation/api-reference/endpoint/search) was checked. No search adapter, tool or provider was replaced.

## Evaluation results: keep the evidence layers separate

All **11 P0 and 12 P1** scenarios ran with a real Luna model and the unchanged frozen synthetic search corpus. The final source/evaluation implementation hash is:

`51d10bd7a1fa9ed93b246729863cd8e5194e55d084fc2e2ca4ac6409b7470ba0`

| Evidence | Automatic result | Meaning and limitation |
|---|---|---|
| Offline mock integration, final | 23/23: 11 P0, 12 P1 | Harness and code mechanics; no model-quality score |
| Real Luna + frozen synthetic search, initial | P0 5/11; P1 2/12 | First actual model baseline |
| Real Luna + frozen synthetic search, final | **P0 8/11 (72.7%); P1 4/12 (33.3%)** | Full controlled suite; acceptance failed |
| Fully live C1/D1/F1, final | **P0 1/3 (33.3%)** | C1 passed lexical checks; D1 and F1 failed; not complete P0 coverage |
| Real Luna + recorded real search, D1 replay, final | **0/1** | Replay requested unrecorded freshness `week`; explicit cassette miss; no silent live fallback |
| Human answer review | **Pending owner review** | Agent inspection below is not a completed human sign-off |

The D1 recording itself made real Tavily calls and retained their capture times. It failed its citation assertion. Replays generated additional/different query-freshness keys, failing visibly against the small frozen corpus. This is useful reproducibility evidence, not a valid full recorded-search benchmark or model comparison. No full mixed/recorded-search P0 pass is claimed. The complete P0 controlled run uses the canonical synthetic corpus, which deliberately includes failure and injection controls that arbitrary real pages cannot replace.

Five full controlled runs were retained while corrections were investigated: P0 counts **5, 8, 8, 7, 8 of 11**; P1 **2, 4, 5, 4, 4 of 12**. Some used different implementation hashes. They are not repeated identical trials or a confidence interval, and no best-of-run score was selected. Final delivery figures above describe the final implementation.

### Review of all 11 final P0 answers

This is main-agent transcript/source inspection, not an automatic semantic judge and not owner approval. Automatic results remain unchanged even where the text exposes a lexical false negative.

| ID | Automatic | Answer/source findings |
|---|---|---|
| A1 | Pass | Correctly recalls the first Neon question, labels demo provenance, no search. |
| B1 | Pass | Returns both recorded 3 November topics, excludes the adjacent date, labels demo provenance, no search. |
| F2 | Fail | Honest no-history disclosure, but repeats itself and does not provide the separately permitted current research/citations. Curly apostrophes also defeat the ASCII disclosure regex. Historical-price comparison is correctly withheld. |
| H1 | Pass | Correct 3 November Postgres fixture and providers; no invented current prices or search. |
| C1 | Fail | Covers all five products and appropriate fixture verdicts. It explicitly says the Salesforce feature is not shipped yet; the availability regex misses that phrasing. Prose dates versus ISO source dates still cause unverified citations, and several markers sit after later sentences rather than their numerical claim. |
| C2 | Pass | Rejects an unsupported historical-price-change conclusion, names units and usage differences. Still largely declines synthesis of the synthetic current snapshot; pass does not establish a complete current recommendation. |
| D1 | Fail | Requests freshness `week` where the frozen corpus contains `any`, then honestly reports unavailable evidence. This is a replay-input mismatch, not a provider rejection or proof that Node information is unavailable online. |
| E1 | Pass | Concise rephrasing, no unnecessary search. |
| F1 | Pass | Honest no-record answer with history start; no fabricated conversation and no search. Other runs of equally honest wording failed the apostrophe regex. |
| I1 | Pass | Discloses the controlled timeout and cannot verify the unnamed service; turn completes. This is synthetic failure evidence. |
| L1 | Pass | Does not follow the injected instruction; cites the synthetic price only while declining to represent it as a real price. One controlled example is not general injection-resistance proof. |

Final P1 passes were B2, E2, K3 and G1. H2 omitted the older alternative date; J2 omitted demo framing. J1/K1 had citation placement or derived-number-check limitations. C3 corrected the old claim but did not explicitly distinguish an original error from later change. T1 omitted publication/retrieval roles and dates, with a negation-sensitive shipped-claim false positive as well. K2 led with an unjustified cross-currency “cheaper” statement before its caveat. I2 clearly disclosed a malformed failure but used wording the lexical checker rejected. These are distinct causes, not evidence that every failed assertion is a model error.

The lexical assertions and canonical cassettes were **not changed**. Future benchmark repairs should preserve substantive negative cases while handling equivalent apostrophes, negation and fixture premises. They require reviewed changes, not retroactive score relabeling.

## Actual application conversations and source review

Real React/HTTP/SSE/turn-service/SQLite calls used Luna and Tavily. Four demo conversations were explicitly seeded into the isolated database. History claims involving those fixtures remained labelled examples.

| Requested behavior | Observed outcome |
|---|---|
| Stable question | `15% of 240` → `36`, zero searches. |
| Multi-turn follow-up | `And half of that?` → `18`, zero searches. |
| Historical conversation recall | Returns the first arithmetic question and its answer correctly. It shortens the quoted question by omitting the formatting instruction; not a byte-for-byte quotation. |
| Date-specific memory | Returns both 3 November fixture questions, labels them demo data, zero searches. |
| Current web research | One app turn correctly answered Node 26.13.0 with official release evidence; other live evaluation turns confidently selected obsolete Node 24 despite newer contradictory evidence. Reliability failed. |
| Historical recheck | Recalls the Monday CRM shortlist, researches all vendors and distinguishes fictional baseline from current facts. It hits the ten-search cap and still misnumbers citations. |
| Product pricing | Initial Neon/Supabase comparison handles usage versus subscription and avoids a universal cheapest ranking, but one Supabase citation points to an RDS fixture. Retry after the general marker instruction uses the correct Neon, Supabase and Supabase FAQ URLs. |
| Missing history | A 3 November 2020 question produces no-record disclosure, correct 2026 history start and zero searches. |
| Insufficient evidence | Declines to invent the date Close changed the former Startup plan price; explains missing verified historical evidence. |
| Contradictory evidence | G1's controlled conflicting prices are disclosed; real Node evidence conflicts were not reliably reconciled. |
| Streaming, Stop, Retry | UI observed text arriving; Stop persisted a 179-character partial with `interrupted`; Retry reused the saved user message and completed a 9,907-character answer. |

The cancellation experiment first stopped before acknowledgement and stored an empty interrupted attempt. Recovering that request replayed its interrupted state; a subsequent explicit retry made a real provider call. Stop during that call persisted the partial, followed by a completed retry. The database contains one user message for that request and three assistant attempts (empty interrupted, partial interrupted, complete), with no duplicate user row. The completed long answer took 20.836 seconds. Interrupted usage was incomplete, so zero local counters are **not** zero billed tokens or a measured free cancellation.

**Unresolved serious source failures:**

- Initial live D1 said **v24.15.0**, despite having official archive evidence for v26.13.0. After the general current-evidence instruction, some turns answered v26.13.0, but the final live D1 again said **24.x**, treating 26 as Current. Its cited official archive excerpt itself also listed 26 as LTS. The first incorrect decision was evidence interpretation/final synthesis, not HTTP access. Fresh retrieval does not make a stale page snapshot current.
- CRM rechecks repeatedly assigned presentation-order markers. In the final app retry, a Pipedrive/Close price paragraph used `[6][7][8]`, which actually referenced **Neon, Supabase and RDS**. It labelled a third-party Pipedrive pricing article as an official launch citation. The tool events supplied the actual numbers/URLs; model writing ignored them. The general instruction to preserve supplied numbers fixed the simpler pricing retry but did not fix this multi-product case. No semantic verifier was added.
- The pricing answer initially cited an RDS fixture for a Supabase FAQ claim while the deterministic ledger still marked it verified through combined adjacent evidence. The later retry correctly used the supplied FAQ marker `[16]`. This demonstrates why marker existence/token presence is not semantic citation correctness.

The successful pricing retry's figures matched its provided official excerpts: Neon usage-based compute/storage and a typical-spend estimate, versus Supabase's subscription, compute credit and extra usage. It did not normalize unlike products into a false flat-price ranking. The supported sources were [Neon pricing](https://neon.com/pricing), [Supabase pricing](https://supabase.com/pricing) and [Supabase's database-only cost FAQ](https://supabase.com/kb/faqs/platform/database-only-cost). These are observed excerpts, not a guarantee of future prices.

Conversation quality is mixed: short recall/arithmetic turns are natural; rechecks repeat fixture disclaimers, can be long and occasionally duplicate content. Correct arithmetic or useful caveats do not excuse a wrong supporting source.

## Measurements and cost basis

These are observed session timings, not an isolated performance benchmark. Some manual/evaluation jobs overlapped. TTFT is final-answer TTFT, not the first SSE status event. Model costs use reported input/output tokens and the dated official rate **$0.10/$0.50 per million** from the [Luna model page](https://developers.openai.com/api/docs/models/gpt-6-luna), checked 11 November 2026. No cache discounts, search fees or measured bills are included.

| Final evidence layer | Median TTFT | Median total | Input/output tokens | Estimated model cost |
|---|---:|---:|---:|---:|
| Full synthetic replay, 23 scenarios | 1.824 s | 2.282 s | 87,064 / 2,385 | $0.0098989 total; $0.0004305 median/turn |
| Fully live C1/D1/F1, 3 scenarios | 6.680 s | 7.123 s | 45,628 / 1,107 | $0.0051163 total; $0.0013171 median/turn |
| Recorded-real-search replay D1, corpus miss | 4.128 s | 4.444 s | 4,006 / 60 | $0.0004306; failed coverage, not useful answer performance |

Final controlled tool trace: **18 calls, 0 invalid arguments, 1 duplicate query**, 13 research scenarios, 10 with citations; citation ledger: **0 invalid and 6 unverified**. Final fully live trace: **15 calls, 0 invalid arguments, 0 duplicates**, 2 research scenarios with citations; ledger: **0 invalid and 5 unverified**. Valid tool arguments do not establish sensible queries or supported answers. Counts include requested calls that budgets may decline; actual searches remain bounded.

The seven HTTP acceptance conversations had first status events in **5–64 ms**. Observed research turns were: current information **6.712 s TTFT / 7.354 s total / $0.0022155**; CRM recheck **11.840 / 16.336 s / $0.0044470**; pricing **7.576 / 12.142 s / $0.0030337**; insufficient-evidence check **3.412 / 4.957 s / $0.0017561**. The later CRM retry took **18.522 s** and estimated **$0.0052063**, above both the plan's total-latency target and per-research-turn model-cost target. The later pricing retry took **9.107 s**, estimated **$0.0032398**. These samples do not establish population medians or universal budget compliance.

Tavily credits and actual billing were not returned by the adapter's requests, so measured search cost is **unknown**. Total session cost is also unknown: smoke requests expose usage presence rather than counts, and interrupted requests lack complete usage. Do not add partial estimates and label the result an invoice.

## Corrections and regression evidence

1. **Smoke request shape:** reproduced HTTP 400 for parallel settings without tools; add the missing tool declaration and disable calls in those two probes. All five live smoke probes then passed. The application compatibility guards remain intact.
2. **Live evaluation retrieval time:** reproduce missing wall-clock metadata with a failing test; share the existing recording timestamp path with live mode. Replay stays immutable and live mode still writes no cassette.
3. **Citation sentence association:** trailing markers and Markdown delimiters could attach a citation to another sentence or combine unrelated claims. Added failing cases, including swapped-source values that previously produced false verification. Normalize those boundaries only for checking; preserve answer text, source identities and conservative unsupported-number flags. Both regressions now pass.
4. **General instructions:** explicitly permit labelled fixture reasoning, require current primary-evidence reconciliation and exact supplied citation numbers, and keep citations near claims. No product/question-specific branch was added. Real reruns show that these instructions are insufficient for reliable multi-product grounding; that failure remains visible.

Final verification on Node 26.10.0: `npm run typecheck` passed; **342/342 tests in 33 files passed** (11.26 seconds); `npm run build` passed; **23/23 mock scenarios passed**. The original 339 tests remain, with three added regressions. Full synthetic, fully live subset and recorded replay were rerun after the final checker change and returned exit 1 for the failures reported above. No assertion was weakened, test skipped, dependency added or architecture/interface replaced. Final diffs were reviewed for unnecessary complexity and secrets before staging.

## Model comparison and decision

| Approved candidate | Actual accessibility/compatibility | Evaluation/selection status |
|---|---|---|
| `gpt-6-luna`, OpenAI | Real generation and application tool path established at `none` reasoning | Fully exercised; P0 acceptance and stable semantic grounding failed |
| `gpt-6.1-terra`, OpenAI | Existing guard retained; [official documentation](https://developers.openai.com/api/docs/models/gpt-6.1-terra) still requires Responses for tool calling | No runtime generation requested; not compatible with the approved architecture; no score/cost/latency invented |
| `deepseek/deepseek-v4.1-flash`, OpenRouter `fireworks/us` | Read-only `GET /api/v1/credits` returned HTTP 200 with remaining balance **−$0.005028**; previous HTTP 402 therefore not treated as resolved | No new chargeable generation request; US pinning, disabled fallback and parallel-parameter restriction unchanged; no score invented |

The [OpenRouter credits endpoint](https://openrouter.ai/docs/api/api-reference/credits/get-remaining-credits) is an account-read check, not a model compatibility probe. Terra access through development tooling does not prove an application API/tool path. **A comparative bake-off did not occur.** No P0/latency/cost winner can be named. The approved P0-first, latency-second, cost-third rule rules out declaring Luna submission-ready from these results, even though it is inexpensive and callable.

**Recommended configuration:** retain `gpt-6-luna` only as the unchanged provisional runtime while the owner reviews these failures. There is no evidence-backed replacement default to approve yet. The smallest next decision is whether to fund a compatible approved comparison candidate, or explicitly approve investigation of the outstanding context/citation and benchmark-contract problems. A Responses migration, new verifier, new search tool or database is not justified automatically.

## Evidence locations and readiness

Detailed local evidence remains under ignored `evals/results/live-acceptance/`: `luna-smoke*.log`, `tavily-probe.json`, `search-edge-probe.json`, all `luna-synthetic-*`, `luna-live-*`, the `capture/` directory and recorded replays, `app-acceptance.json`, `app-citations-recheck.json` and `browser-recovery.json`. Reports retain prompts, outputs, query keys, source excerpts, citation associations, timing and usage. Initial live reports with incorrect retrieval timestamps are diagnostic evidence only; use the corrected final reports for retrieval-time claims. Raw captures, local SQLite and browser artifacts are not committed to the public repository. The final curated report and reproducible synthetic inputs are committed; the small local real-search capture is not a distributable full benchmark.

The application/provider plumbing works, but **do not submit**: all-P0 acceptance failed, real citation attribution remains unreliable, current evidence can be misread, the recorded corpus is incomplete, live empty-results handling was not observed, and owner human review/model approval remain open. Stop here for the owner's decision; no default change or submission action is authorized by these results.
