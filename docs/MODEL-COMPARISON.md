# Controlled runtime model comparison — 11 November 2026

**Decision: Sol compatibility is established, but a material correctness improvement is not demonstrated. Keep Luna provisional. Submission readiness: no.** No runtime winner is approved. Paid testing stopped after the focused first attempts; no confirmation, full P0/P1 generation, or Tavily/application checks were run in this phase.

## Scope and starting evidence

Started from clean `main` at `899da85`, matching `origin/main`. Read the correctness review, live acceptance record, master plan, evaluation README, compatibility adapter, smoke, comparison, reporting and pricing implementation. The current starting baseline was 377 engineering tests, 23/23 canonical mocks, 3/3 adversarial mocks, latest focused Luna generation 2/3, and full reruns withheld after the stability gate failed. Earlier 8/11 P0 and 4/12 P1 measurements belong to an older implementation/input contract; they are not the current implementation's measured rates.

The owner authorized `gpt-6-sol` as one additional candidate, retaining the one-tool Chat Completions architecture. A later instruction authorized Terra 6.1 High subagents for isolated work. Two read-only guard/diff reviews used `codex` / `gpt-6.1-terra` / `reasoningEffort: high`; neither edited code nor called runtime/search providers. Main implementation and source inspection remained Sol 6.1 High. These engineering reviews are separate from runtime evaluation usage and are not a second application verifier.

## Official requirements and actual compatibility

Checked the actual official pages on 11 November 2026: [Sol model](https://developers.openai.com/api/docs/models/gpt-6-sol), [Luna model](https://developers.openai.com/api/docs/models/gpt-6-luna), [model guide](https://developers.openai.com/api/docs/guides/latest-model), and [pricing](https://developers.openai.com/api/docs/pricing). Sol's exact model page permits Chat Completions function calling at `reasoning_effort: none` and gives standard short-context rates of $2/M input and $10/M output tokens. Luna's model page gives $0.10/M input and $0.50/M output. The current general pricing page emphasizes newer Sol 6.1; it was not used to substitute a different model or rate.

Actual candidate: **`gpt-6-sol`**, endpoint **`https://api.openai.com/v1`**, path **`/chat/completions`**, `reasoning_effort: "none"`, `parallel_tool_calls: true`, streaming with `stream_options.include_usage: true`. No explicit service tier or temperature was added. This is not `gpt-6.1-sol`, whose tool requirements differ.

The first minimal combined probe successfully streamed one valid forced `web_search` call with numeric usage and `finish_reason: tool_calls`, but returned one call when its prompt requested two. Its local probe assertion failed and the script stopped without continuation. This was a tool-count/instruction-following observation, not an HTTP rejection or documented parameter incompatibility. It is retained as `initial-smoke`; 200 input / 25 output tokens, 2,619 ms, estimated $0.0006500. It was not relabelled as a pass or discarded.

The existing dedicated smoke separates named-function forcing from required multiple calls. Its first run after the minimal adapter change passed all five probes:

| Probe | Actual observation |
|---|---|
| Access, Chat Completions, streaming, `tool_choice: none` | Text `OK.`, no calls, final stop, numeric usage |
| Forced named `web_search` | One valid call, final `tool_calls`; empty synthetic tool result continued to text, stop and usage |
| Multiple calls, `tool_choice: required` | Two valid calls in one response; both tool results accepted; continuation completed |
| Exact compatible reasoning | `reasoning_effort: none` accepted with tools present |
| Later system note | Accepted and completed normally |

This was seven requests: 1,462 input / 187 output tokens, estimated $0.0047940. Initial request/continuation latencies were 2,310; 1,379/2,050; 1,676/1,269; 902; and 1,127 ms. No provider access/quota/unsupported-parameter error occurred. All continuations ended normally with usage. Smoke responses were capped at 256 output tokens; no length completion occurred. No fresh real Sol cancellation/recovery check was made; those application paths retain their existing deterministic coverage and the earlier Luna evidence.

## Minimal implementation and evaluation preparation

The sole production change extends Luna's exact OpenAI compatibility branch to `gpt-6-sol`, preserving `none` and rejecting low/medium/high overrides. The Terra guard, provisional default, application prompt, tools, storage, source ledger, date logic, citation checker, streaming, cancellation and recovery are unchanged. There is no Responses migration or new application abstraction/dependency.

Evaluation changes add the exact approved Sol identity and verified price entry, strengthen report completeness/evidence guards, disable evaluation-only SDK retries, and support an explicit evaluation-only output cap. The smoke now fails before later calls on a failed probe, validates numeric usage, and retains sanitized local evidence. Final ranking still requires all 23 canonical scenarios; focused subsets cannot select a winner. Complete scenario IDs/priorities, pass counts/rates, implementation/category/input/cassette hashes, request model/reasoning, identical initial messages/parameters, and invariant parameters on subsequent Sol/Luna calls are checked. Tool choice and generated continuation messages may vary with model behavior.

A fairness gap was discovered before starting Sol evaluation: randomly generated record/source IDs appeared in recall context despite being excluded from the old input hash. One Luna six-case run had already completed. It is retained as **preliminary**, not the matched baseline: 5/6 automatic (F2/C1/D1 2/3; R1/R2/R3 3/3), C1 failed `uncited numerical source claim`, 35,419 input / 1,221 output tokens, estimated $0.0041524. It used implementation `753a2b1b7cd71e0c9ce4096a93197d6c0fb4cb01652e7152080d46363738cf9a`.

The evaluator now assigns deterministic opaque UUIDs during each sequential, isolated scenario and restores normal generation in `finally`. Six repeated-request tests prove identical actual scripted requests. This process-global test mechanism is for sequential evaluation, not concurrent scenario execution. Production UUID generation is unchanged. No prompts, assertions, canonical cassette payloads or fixture facts were tuned between any generations in this phase.

## Matched inputs and reproducibility

Both final first attempts used the exact same final implementation fingerprint:

`1bfca40cc28b70f91dcd73112e2412eb1a363675426656d4d8e8504455974fe5`

This SHA-256 covers production server/shared code, evaluation definitions/assertions/setup, fixture/helper inputs and package/lock files. Documentation and ignored captures are excluded. Both reports contain this exact hash. The matched generation filenames are `luna-frozen-first` and `sol-frozen-first` under ignored `evals/results/model-comparison/`.

Both commands used `--base-url https://api.openai.com/v1 --max-completion-tokens 1536 --only F2,C1,D1,R1,R2,R3`, with the same checked-in `evals/search-cassettes` directory. The runner's actual order was F2, C1, D1, R1, R2, R3. Only `--model` and the output filename differed. Each scenario had a fresh in-memory database, clock `2026-11-11T08:30:00Z`, timezone Asia/Kolkata, identical fixture history and unchanged lexical assertions. All queries used the scenario's exact text and freshness `any`.

The offline capture audit verified identical initial request bodies after removing only `model`, identical queries, identical input/cassette hashes, and identical complete source ledgers, including excerpts and IDs. Every captured model request used the stated model, `none`, parallel calls, streaming/usage and the same 1,536-token cap. Model-generated messages/tool-call IDs can differ on continuation; supplied evidence did not. Both candidates used two requests per case, twelve total each, with no retries and no length completion.

| ID | Input SHA-256 | Parsed cassette SHA-256 |
|---|---|---|
| F2 | `1b9791cd11876ef4ab94d8ef291959e63f6e03de22702142622c7b7e07405a0e` | `fe4a83c68ab9e29382b4a88a1fb8f6194f3e5aec52f9cfc4881a4d9620989ae5` |
| C1 | `a853f3fe7732e3656377b71b2aae22485cbf2bfe32d44a3f04896ed67120ad0f` | `501df34224ea4c284fa0815d13a41d906bc7c91d6ce58b925bcdce53177bfa4c` |
| D1 | `1231a2b312016786a9ec77f70d372a9a93c1077ec47feec938329151090542ae` | `6df5531dbc58b0b0278a15345f323888dfc42ff72def0e6d1aefc6d3a79c5088` |
| R1 | `e360f77c493ca8e713a75c09ae778d783cbdb99668ae798f35746eb28634df6e` | `adcdd9ced920e5fdc68573895cefe2aa11e22f55e034c4e7bde8db2499cc426c` |
| R2 | `a794a058f9f6e048466578eb7d8b49334e94e890052168e951c210e2d92a6503` | `76c9255eb83ac14f52f16b77ea9d07ba30c1a704ebdfbdfc3c73fe92fd4f0569` |
| R3 | `9f7023cc3e85b0dda8c65c727f8b2415a0b107026de059369bd832307cbe73fb` | `3f6279d1b9d83addc4818ddf6506535a56db743216826a3371d278315841618a` |

Hashes of the actual initial request bodies, after deleting only `model` (including opaque IDs and exact parameters):

- F2: `257f740408365fb31e78a356562299937ecec86ed3be98abfa4610d549a80d95`
- C1: `3479482f51ed1f7c208ff01a97c60538cce98c0c9d5db8bdf7790940ba31f28a`
- D1: `aadfae81eb517eb544435c4446b0c620286311bdef1d825f9af9294281e3846e`
- R1: `3a4cece11c660f077fe6ce9b099c4e09eb9e56cbf8f5062731f53fd88c930301`
- R2: `2803c338433d6fdd9d764a71e42f3372959d049becfa02a09588bd1c806dbc61`
- R3: `822d8016e55eb3441fedeb1e199f4ee3f808109ef55a0e6cac530cc7e2c9beac`

These are real model generations against **synthetic** frozen search evidence. No current real vendor price/release or real private conversation is established by these inputs. D1 supplies only a synthetic Node 24 LTS assertion, not an exact patch or conflicting live official pages; R1 supplies the explicit dated authority conflict. The complete original questions, answers, requests, tool calls/results, source excerpts and citation associations remain in ignored local reports. This document curates their findings without committing private captures or databases.

## Focused first-attempt automatic results

| Scenario | Luna | Sol | Exact automatic failure |
|---|---|---|---|
| F2 | Pass | Fail | Sol: historical baseline limitation missing |
| C1 | Pass | Pass | None |
| D1 | Pass | Pass | None |
| R1 | Pass | Pass | None |
| R2 | Pass | Fail | Sol: uncited numerical source claim |
| R3 | Fail | Pass | Luna: uncited numerical source claim; missing change-date uncertainty |

Critical F2/C1/D1: **Luna 3/3; Sol 2/3**. Adversarial R1/R2/R3: **both 2/3**. Combined diagnostic counts: Luna 5/6, Sol 4/6. R1–R3 remain opt-in controls, not additions to the canonical 11-P0 denominator. These are one matched attempt per candidate, not full acceptance rates, a confidence interval, or an automatic winner ranking.

## Answer-level semantic and attribution inspection

This is main-agent inspection of actual answers, tool calls, ledger associations and excerpts. It is separate from automatic assertions and **not completed human/owner sign-off**. Scores above are unchanged by this review.

### F2 — absent baseline and independent current research

Both models searched once, disclosed missing history and its 11 November start, cited the synthetic Supabase result as [1], and withheld a real historical/current pricing conclusion. The only excerpt says an illustrative Supabase Pro price is $25 per project per month; both preserve that scope and attach [1] to it. Neither invented a prior shortlist or searched for a private conversation.

Sol explicitly says it cannot “identify the plans you discussed or establish whether their prices changed.” It later cannot “report current Postgres-hosting prices or compare them with last Tuesday.” The assertion recognizes a narrower set of baseline phrases and misses this combination. **This is a false negative, not demonstrated fabricated history or missing research.** Neither model can provide a real provider comparison from the single synthetic result; this input cannot establish unconstrained research completeness. Sol provides no material semantic gain here.

### C1 — five CRM rechecks and evidence categories

Both issued all five required independent searches in one model step and covered all five products. Actual references were historical HubSpot/Pipedrive/Zoho/Salesforce/Close [1]–[5] and their new observations [6]–[10]. Both preserved that numbering; no citation was reconstructed by unrelated product order, and no old observation was used as the current price source.

The controlling excerpts are HubSpot $24 monthly with annual terms different; Pipedrive $15→$18 effective 10 November, notice published 9 November; Zoho $14 with commitment unspecified; Salesforce $25, feature announced 10 November, availability planned 1 December for eligible accounts; Close $59 standard monthly without introductory discount and no documented prior terms. Every price/date reference in both tables maps to its intended excerpt. Both distinguish an explicit fixture change, observed differences, no established change and uncertainty, and neither turns the Salesforce announcement into shipment.

Sol's table is shorter (536 versus 629 output tokens) and more directly identifies missing historical billing terms, especially for HubSpot and Close. That is a modest clarity/comparability improvement. Luna also preserves uncertainty and correctly scopes the observations. Sol's heading about absent shipment evidence is limited to supplied demo data, not an assertion that no feature shipped anywhere. Neither response proves complete real-world vendor release research. The evidence does not show a material correctness separation.

### D1 — current information and limits of frozen evidence

Both made the exact required search and cited [1], whose excerpt explicitly identifies Node 24 LTS **inside the synthetic fixture**. Both decline to claim it verifies the real latest version. Sol: “I can’t verify the latest stable LTS version from that result.” That is honest, appropriately scoped uncertainty, not a verified exact current-release answer. Neither ran independent live research, and this cassette contains no patch version or current-authority conflict. An automatic D1 pass cannot establish that the earlier live official-source reconciliation failure is repaired by either model.

### R1 — newer authoritative evidence

Both choose Orchid 8.2 from [2], the 10 November official-style release notice explicitly superseding 7.9. Both describe [1] as the older 1 July snapshot and cite each observation correctly. Neither mistakes the older “latest” label for today's state or invents a release date. Sol is more concise (102 versus 157 tokens); semantic reasoning is equivalent in this control.

### R2 — unrelated product and coincident numerical citations

Both searched Aster, Birch and Cedar independently and correctly used **[2], [3], [4]** for $25, $35 and $25 monthly flat USD. The unrelated recalled Pine observation is [1] and also contains $25; neither model cited it as support for another vendor. All vendor-price attribution is correct.

Sol adds “$10/month more than Aster or Cedar” in Birch's verdict cell **without a reference in that cell**. The arithmetic is correct, but the claim's operand support is implicit in other cells. The existing cell-level coverage/derived-number rule flags it. **This is a citation-placement/derived-evidence-contract failure, not a wrong vendor or incorrect subtraction.** Luna avoids the extra numeric calculation and passes. Sol's unrelated historical-observation column and change verdict add length to a current-price question; it is not uniformly more natural or concise.

### R3 — observations versus effective change dates

Both cite [1] for $20 on 3 November and [2] for $25 on 11 November, two distinct observations of the same URL. Both call this an observed difference, not a supported effective date. Both calculate the correct $5 difference.

Luna's uncited calculation says “observations differ by $5 per month”; its lexical form misses the narrow derived-difference helper. Its “they don’t establish when” and “Neither source gives an effective change date” express the required uncertainty, but miss the bounded uncertainty regex. Thus the uncertainty failure is **false negative**, while the arithmetic coverage remains limited. Sol passes automatically using a recognized “$5 difference” form. Its calculation sentence still lacks its own operand references; the later [2] belongs to the change-date caveat. A pass is not proof of ideal per-claim citation placement. **Neither answer fabricates a change date, and this control does not demonstrate superior temporal reasoning by Sol.**

## Tool behavior, latency and estimated model cost

Both final runs: six completed turns, twelve model calls, twelve tool calls, twelve independent searches; no malformed calls, duplicate queries, cassette misses, provider errors, truncated answers or missing aggregate usage. Per-case searches were 1/5/1/1/3/1. No actual Tavily calls or search credits were consumed by replay. All observed source markers existed and had the intended vendor/observation association; reported invalid/unverified marker counts were both zero. Coverage failures above can coexist with those zero counts.

| ID | Luna TTFT / total ms | Sol TTFT / total ms | Input tokens, each | Output tokens Luna / Sol | Estimated USD Luna / Sol |
|---|---:|---:|---:|---:|---:|
| F2 | 3704 / 5924 | 2178 / 3401 | 4906 | 145 / 145 | 0.0005631 / 0.0112620 |
| C1 | 5607 / 13204 | 3242 / 6859 | 8746 | 629 / 536 | 0.0011891 / 0.0228520 |
| D1 | 3159 / 3870 | 2571 / 3050 | 4810 | 76 / 78 | 0.0005190 / 0.0104000 |
| R1 | 3094 / 4948 | 2275 / 3150 | 5050 | 157 / 102 | 0.0005835 / 0.0111200 |
| R2 | 3968 / 5408 | 2665 / 3887 | 5948 | 178 / 223 | 0.0006838 / 0.0141260 |
| R3 | 3427 / 4564 | 2310 / 3178 | 5681 | 115 / 124 | 0.0006256 / 0.0126020 |

Final six-case aggregates: Luna **35,141 input / 1,300 output**, median TTFT **3,565.5 ms**, median total **5,178 ms**, estimated **$0.0041641**. Sol **35,141 / 1,208**, **2,440.5 ms**, **3,289.5 ms**, estimated **$0.0823620**. Sol's observed median total is 36.5% lower and its focused total estimate 19.78× higher. Runs were serial, without simultaneous engineering tests; they are small unrandomized observations, not established latency distributions or stable speed guarantees.

Spending was gated manually by phase with bounded outputs, no retries, and usage checks before further calls. The $1 authorization is an estimated-model-usage plan, not a provider-side hard cap. No budget expansion was requested or used.

| Stage, retained local prefix | Model | Input / output tokens | Estimated model USD |
|---|---|---:|---:|
| initial-smoke | `gpt-6-sol` | 200 / 25 | 0.0006500 |
| sol-smoke | `gpt-6-sol` | 1462 / 187 | 0.0047940 |
| luna-first | `gpt-6-luna` | 35419 / 1221 | 0.0041524 |
| luna-frozen-first | `gpt-6-luna` | 35141 / 1300 | 0.0041641 |
| sol-frozen-first | `gpt-6-sol` | 35141 / 1208 | 0.0823620 |
| **All runtime stages** | | **107,363 / 3,941** | **0.0961225** |

These estimates use provider-reported token counts × verified model rates, ignoring cache discounts and search credits. **Actual billed/measured USD is unknown**, not zero. The initial combined smoke's usage is complete for its one issued request even though its tool-count assertion failed. Captures contain aggregate per-turn runtime usage; the unchanged production parser trusts the provider's numeric usage schema. Numeric aggregate counts were checked in the offline audit; this phase did not add a generic per-call usage verifier or claim a billing guarantee.

## Verification and stability

- `npm run typecheck`: passed.
- `npm test`: an earlier prepared version passed 384/384; after UUID input tests, a complete run passed 390/390. Two later concurrent full runs hit the existing process-test failure `Server startup timed out:` with empty output (389 passed / 1 failed each). The isolated process test passed. The final full serial run, `npm test -- --maxWorkers=1 --no-file-parallelism`, passed **390/390 in 37 files**, 41.24 s. The final canonical/adversarial mocks share the matched generation implementation hash. No assertion, timeout or lifecycle code was relaxed.
- `npm run build`: passed; client JS remains 499.56 kB / 151.80 kB gzip.
- Canonical `npm run eval -- --mock`: **23/23**; opt-in `--mock --only R1,R2,R3`: **3/3**. A final six-case frozen-input mock also passed 6/6. These are engineering/integration evidence, not model scores.
- The offline matched-capture audit passed exact request/input/evidence equality and numeric aggregate-count checks. The final ranking command remains ineligible for these subsets; no full-suite comparison was manufactured.

No repeated matched real-model trial was run. The preliminary Luna failures moved from C1 to R3 after evaluation IDs were frozen; these runs have different fingerprints and are not a same-input stability estimate. Prior documented instability remains relevant history, not a new measured rate. No temperature/prompt iteration, selective reroll or post-hoc score overwrite was performed here. Sol's focused output is not a stable P0 pass, even after recognizing the F2 false negative.

## Decision, remaining defects and next approval

**Material correctness improvement: not demonstrated.** Sol showed useful C1 brevity/billing caveats and lower observed latency. Both models researched the required controlled inputs, maintained correct product/observation markers, resolved the synthetic authority conflict and withheld fabricated dates. Sol did not remove per-claim/derived-number citation inconsistencies, and automatic differences partly reflect lexical coverage rather than semantic quality. Its higher cost has no demonstrated primary-criteria payoff in this sample. This is not evidence that Sol is generally worse; it is insufficient evidence to replace the provisional runtime.

**Recommendation: leave `gpt-6-luna` provisional and select no runtime winner.** No default selection is requested on these findings. No confirmation was warranted because a material correctness gain was not observed. The complete 11-P0 run, 12-P1 run and real Tavily/application checks were therefore withheld, not counted as failed or passed. Current full-suite/live quality remains unmeasured; previous live failures are not repaired merely by passing synthetic controls.

The next smallest correction to seek approval for is an evaluation-only repair of the remaining bounded baseline/uncertainty equivalences and explicit calculation-support rules, retaining fabricated-history/date, wrong-vendor and wrong-arithmetic negatives. Separately, the next application design decision is whether to require sourced claims/calculations to carry explicit ledger references before finalization and render those references deterministically. That addresses the recurring placement mechanism more directly than a model substitution. It needs a concrete scoped design and owner approval; no such behavior change was implemented here. General entailment, unknown subject aliases and noisy live-search completeness remain outside the deterministic checker's guarantees.

**Submission readiness: no.** Stable complete P0 acceptance, real P1 targets, representative live grounding and human/owner source review are unmet. This checkpoint ends the comparison; no application submission, video recording, runtime-default change, Responses migration or further paid run was initiated.
