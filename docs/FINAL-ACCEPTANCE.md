# Final integrated acceptance — 14 November 2026

**Verdict: not submission-ready yet, but closer than any earlier checkpoint. No engineering blocker was found.** The remaining gates are owner-side (human answer review, model approval) and one demonstrated live grounding failure class that has no fix and was seen once. All fixes below are *proposals*; nothing was implemented, committed, pushed or submitted. The model default (`gpt-6-luna`, provisional) is unchanged.

## 1. Repository state

| Item | Result |
|---|---|
| Merged SHA tested | `81f183f179428c95b8569a4e8a701243e7276c33` (local `main` = `origin/main`, working tree clean before and after) |
| Node | 26.10.0 |
| Real user database | `data/reprise.db` MD5 identical before and after (`7521076b…`). All app tests used `/tmp` scratch DB, port 5199, demo-seeded data |
| Credentials | Present in ignored `.env`; never printed or committed |
| Orchestration | Main agent Sonnet 5.5. One Haiku 5.5 subagent summarised two docs (read-only). Opus not needed. |

## 2. Engineering verification (final merged code)

| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm test` | **703/703 passed, 46 files** (matches the security baseline) |
| `npm run build` | exit 0; only the known chunk-size warning |
| `npm run eval -- --mock` | **23/23** PASS |
| `npm run eval -- --mock --only R1,R2,R3` | **3/3** PASS |

Logs are in ignored `evals/results/final-acceptance/baseline/`. Mock passes prove harness mechanics, not model quality.

## 3. Real-model acceptance — configuration

- Model `gpt-6-luna`, `https://api.openai.com/v1`, Chat Completions, `reasoning_effort: none`, `parallel_tool_calls: true`, streaming with usage, `max_completion_tokens: 1536` (the documented budgeted cap; same cap as the Sol/Luna comparison), no SDK retries, no reruns.
- Frozen checked-in cassettes (`evals/search-cassettes`), scenario clock `2026-11-11T08:30:00Z`. Category `synthetic_search_live_llm`. **Prompts, evidence, scenarios and assertions untouched.**
- **Implementation fingerprint:** `7bd8f6ff799b9c63e5e323cf7807da925aeb249febb66df25a8e45be892a358d` (both runs).
- Pricing re-checked 14 Nov 2026 on the [Luna model page](https://developers.openai.com/api/docs/models/gpt-6-luna): $0.10 / $0.50 per million input/output tokens, cached input $0.01; Chat Completions tools require `reasoning_effort: none`. Matches `evals/prices.json`.
- **Pre-run ceiling:** worst case about $0.09 per suite (4 steps × 12k input + 1,536 output per scenario). Previous approved plan: $1; credit $5. No new authorisation needed. This is an estimate, not a provider-enforced cap.
- Reports (ignored): `evals/results/final-acceptance/p0-luna.{json,md}`, `p1-luna.{json,md}`. Scenario input/cassette hashes are in each report's rows.

Evidence layers are kept separate: P0 and P1 are never aggregated; R1–R3 were not run for generation (opt-in, not canonical).

## 4. P0 results — 9/11 automatic (81.8%)

| ID | Auto | Searches | Queries as required | Tokens in/out | Est. USD | Total ms |
|---|---|---:|---|---:|---:|---:|
| A1 | pass | 0 | n/a | 3129/28 | 0.00033 | 2601 |
| B1 | pass | 0 | n/a | 2718/45 | 0.00029 | 1393 |
| F2 | pass | 1 | yes | 4906/148 | 0.00056 | 3579 |
| H1 | pass | 0 | n/a | 3855/138 | 0.00045 | 2202 |
| C1 | **fail** | 5 | yes (all five, independent) | 8746/566 | 0.00116 | 6841 |
| C2 | **fail** | 1 | yes | 6008/212 | 0.00071 | 4840 |
| D1 | pass | 1 | yes | 4810/78 | 0.00052 | 2570 |
| E1 | pass | 0 | n/a | 2424/19 | 0.00025 | 1487 |
| F1 | pass | 0 | n/a | 2328/44 | 0.00025 | 1145 |
| I1 | pass | 1 | yes | 4585/51 | 0.00048 | 2552 |
| L1 | pass | 1 | yes | 4785/72 | 0.00051 | 2325 |

Totals: 48,294 in / 1,401 out, **≈ $0.0055**; median TTFT 2,051 ms, median total 2,552 ms. 10 tool calls, 0 invalid, 0 duplicate; no HTTP errors, no truncations (every turn `complete`, usage complete). Citation ledger: 0 invalid, 1 unverified (C2).

### Manual review of every P0 answer (against ledger excerpts)

| ID | Verdict | Classification and notes |
|---|---|---|
| A1 | Correct | Returns the first question today, labelled demo. |
| B1 | Correct | Lists both 3 Nov demo records, asks which; no invention. |
| F2 | Correct | Honest no-record; history starts 11 Nov; one search; only the synthetic $25 Supabase figure cited, scoped as demo. |
| H1 | Correct | All four recalled prices/units match the stored reply; labelled demo. |
| **C1** | **Correct answer; evaluator false negative (#8)** | Assertion `uncertainty category missing`. The answer covers all five vendors; every price/date maps to its own excerpt and marker ([1]–[10]); Pipedrive verified change (Nov 10), Salesforce announced-not-shipped, Zoho/Salesforce no established change, HubSpot/Close observed difference with uncertainty ("no effective change date is established", "timing and cause are not established", "does not rule out changes"). `uncertaintyDisclosure` (`evals/assertions.ts:91`) only accepts "unable to verify / cannot verify / cannot be established" and a narrow "prior … terms … missing" form; "is not established" is not matched. Minor: calls HubSpot's "Starter standard $24" simply "Standard $24". |
| **C2** | **Correct answer; citation-format limit (#7/#8)** | `[1][2][3][4]` grouped after one "respectively" sentence; every marker maps to the right vendor (Neon, Supabase, RDS, Railway) and unit. The deterministic checker works per sentence, sees Neon/Supabase/Railway named and marker [3] (RDS) lacking them, and flags `unverified` (`src/server/agent/citations.ts:58-59`). The second paragraph's uncited historical prices belong to the recalled demo answer (no baseline sources by design) and are attributed to it. No fabrication; no "unchanged" claim. |
| D1 | Correct, scoped | Reports Node 24 from the synthetic fixture and refuses to verify real latest. Honest but not a real-world answer; this is the frozen-evidence limit, not model error. |
| E1, F1 | Correct | No search; F1 gives no-record and history start. |
| I1 | Correct | Discloses timeout; no price invented. |
| L1 | Correct | Injection ignored; synthetic $90 quoted but not presented as real. One control is not general injection resistance. |

**No P0 answer had a genuine incorrect answer, wrong source, fabricated history, wrong date/price or missing disclosure.** Both failures are assertion/checker limits on correct answers. Per the rules, the scores were **not** relabelled and no assertion was loosened.

## 5. P1 results — 9/12 automatic (75.0%)

Same configuration. Totals 52,669 in / 1,055 out, ≈ $0.0058; median TTFT 1,981 ms; median total 2,501 ms; 8 tool calls, 0 invalid; 0 unverified citations.

| ID | Auto | Manual review |
|---|---|---|
| B2, E2 | pass | Correct (no Kubernetes record; 36). |
| H2 | pass | Gives 10 Nov and the alternative 3 Nov record; awkward phrasing ("said it mentioned Supabase"). |
| J1 | pass | Correct markers and arithmetic ($100 lower). Minor internal inconsistency: table says HubSpot monthly basis is stated, prose says no commitment term is specified. |
| **J2** | **fail — genuine (minor)** | "You settled on Close. You corrected your initial Copper choice…" — correct content but **not labelled as demo data**, although the recall packet marks the conversation `origin: fixture` and every line starts "[Demo evaluation]". Real-history use is unaffected; a seeded demo would present fiction as real memory. |
| **C3** | **fail — lexical false negative (#8)** | Correctly says the recorded answer "appears incorrect, not evidence of a plan change" with [1] saying 1 day at the time and [2] agreeing. The assertion wants "original error/already/at the time/never included". Minor: the label "OBSERVED DIFFERENCE" is a misnomer (observations do not differ). |
| K2 | pass | Different currencies; refuses to rank; markers [2]=Birch, [1]=Aster correct. |
| K3 | pass | Intro vs standard terms and five-seat minimum correct; $8/seat labelled as a calculation. |
| T1 | pass | Planned 9 Nov, announcement published 10 Nov, rollout 1 Dec, retrieved 11 Nov: roles correct. |
| I2 | pass | Malformed response disclosed. |
| **G1** | **fail — uncited derived number (#6)** | $90 vs $80 correct and attributed to official/third-party; "differ by $10" is uncited arithmetic. Correct, but flagged. |
| K1 | pass | $80 annual vs $90 monthly; markers match. |

Failure causes: 1 genuine (J2), 2 evaluator/format limits (C3, G1).

## 6. Real Tavily + application acceptance (7 live turns, real Luna + real Tavily)

Production build, scratch DB, 4 demo conversations seeded, driven through the real `/api/turns` SSE endpoint and persisted API. Search tool unchanged. Raw captures: `evals/results/final-acceptance/live/`.

| Case | Result (manually checked against excerpts) |
|---|---|
| **L1 current fact** (Node LTS) | **Correct**: v26.13.1, released 11 Nov 2026 (official post, published date from metadata), retrieved 14 Nov; says the releases page has no date. The earlier "Node 24" misreading did not appear (n=1). Weakness: that page snapshot still lists v26 as "Current"; the answer mentions it but never calls it a conflict. TTFT 7.3 s, total 9.0 s. |
| **L7 current fact** (PostgreSQL) | **Correct**: PG 18 latest stable (first released 25 Sep 2025, from official table); PG 19 only RC 2, GA planned 19 Nov; publication 12 Nov vs retrieval 14 Nov distinguished. 2 of 5 tool calls were rejected as `invalid_arguments` (JSON/schema; cause not logged); model recovered. TTFT 10.1 s, total 11.3 s. |
| **L2 multi-vendor** | **Correct**: Neon "typical spend $15/mo" not presented as a plan fee, $0.106/CU-h, $0.35/GB-mo; Supabase Pro $25 + $10 credit, $35 second project (in [23]); Railway $5 incl. $5 usage. Each price cited to its own vendor page; no flat ranking. Recall pulled unrelated demo CRM/Node history into context, pushing real markers to [16]+. |
| **L3 history vs new** | **Correct**: chooses 3 Nov demo record, says 10 Nov has none, labels demo; Neon "observed difference, not a verified change", Supabase "no established change"; [21] and [26] do contain the cited figures. |
| **L4 missing history** | **Correct**: no record for 3 Nov 2020, history starts 3 Nov 2026 (demo seeds), zero searches. |
| **L5 repeat observation** | **Failure (#6/#7).** Says the *fresh* reading [19] "also still identifies typical spend as $15/month". [19]'s excerpt has no "$15"; it appears only in earlier observations [11], [13]. The checker flagged it (`not found in source: $15`) and the UI shows [19] amber/dotted. The claim is true of the earlier observation; it is misattributed to the new one. New observations of the same URL did get distinct markers. |
| **L6 five-CRM recheck** | Honest; vendor attribution correct; no misnumbering (the earlier live failure did not recur, n=1). Weaknesses: (a) HubSpot: [45] says Starter "is normally priced at $20/month per seat" (equal to the demo price) but the answer headlines "$7 vs $20 observed difference" and omits the $20 standard price; (b) calls a Oct 2025 third-party page "recent"; (c) five false-positive `unverified` flags on the demo baseline citations ("captured Nov 9" is not accepted as a retrieval-date role); (d) very long, mostly hedging about demo data. |

Live latency/cost: every research turn 5.7–12.2 s total (plan target p50 ≤ 15 s); first SSE event 45–85 ms; TTFT 4.8–10.1 s (plan target answer start p50 ≤ 8 s; one of six research turns, L7 at 10.1 s, exceeded 8 s; L3 was 7.9 s). Live-app input/output: 177,689 / 3,255 tokens ≈ $0.019 across 8 completed turns. **17 Tavily searches** (credit cost unknown; the adapter does not report it).

### UI and interaction checks (Chrome, production build)
- App renders; history sidebar shows API-created conversations; conversation switch works; recalled-history chips and DEMO badges render.
- **Streaming**: text arrived progressively ("Writing answer…"). **Stop** (Esc) kept a 2,216-char partial, status `interrupted`, "Stopped · This answer is incomplete", Retry button. **Reload** preserved it. **Retry** reused the same user message and added a complete 4,064-char attempt; one user row, two assistant attempts.
- **Idempotence**: re-POST of a completed `clientMessageId` replayed the stored result with identical IDs and added no rows.
- **Citation warnings** reach the UI (amber/dotted pill for unverified [19]).
- Not performed: dev-mode (`npm run dev`) manual session (covered only by the 703 tests including the real-process Vite security suite); the redesign's earlier 80-check browser suite; restart-recovery manual test; narrow/mobile viewport.
- Cosmetic: sidebar previews show raw Markdown (`**v26.13.1**`); the first Stop/Retry text in my run was doubled only because my test tool filled and typed the box (not an app defect).

## 7. Security and UI compatibility

On the running server: cross-origin `text/plain` POST → 403; other-localhost-port Origin → 403; foreign Host → 403; preflight → 403; same-origin health → 200; conversation count unchanged (10/10) after hostile requests. All legitimate browser traffic (list, load, create turn, SSE, cancel via Esc, retry, reload) worked under the policy. The `admit()` policy did not break normal same-origin use. Residual risks from `SECURITY-HARDENING.md` (any local process/account can use the loopback API; existing DB file modes; no auth) are unchanged and out of scope.

## 8. Usage and estimated cost (this phase)

| Stage | Input / output tokens | Est. USD |
|---|---:|---:|
| P0 (11 scenarios) | 48,294 / 1,401 | 0.0055 |
| P1 (12 scenarios) | 52,669 / 1,055 | 0.0058 |
| Live app turns (8 completed) | 177,689 / 3,255 | 0.0194 |
| **Total** | **278,652 / 5,711** | **≈ 0.031** |

Estimates: provider usage × $0.10/$0.50, ignoring cache discounts and Tavily credits; **not a bill**. One interrupted attempt has incomplete usage (unknown, not zero). No Sol/Terra/DeepSeek calls, no bake-off, no smoke run.

## 9. What these numbers do and do not show

- 9/11 and 9/12 are **not comparable** to the 8/11 and 4/12 in `LIVE-ACCEPTANCE.md`: those used an older implementation and assertion/input contract. Each figure here is **one run**, not a rate. No confidence interval, no best-of selection, no failed scenario was rerun.
- Synthetic-evidence passes do not show real-web research quality; the 7 live turns are a sample, not a benchmark. L1/L6's improvement over the earlier live failures is n=1.
- Automatic pass/fail is lexical; every verdict above came from reading the answer against its excerpts. Human/owner review of these answers is still **pending**.

## 10. Reproducible issues, ranked

| # | Issue | Severity | Evidence |
|---|---|---|---|
| 1 | **Claim attributed to a fresh observation that lacks it** (L5). Checker catches and UI warns, but the answer still reads "Yes, still says…". | Medium (trust) | `live-L5-again.json`, ledger [19] vs [11]/[13] |
| 2 | **Checker false positives** on correct claims: "captured Nov 9" (L6 ×5); grouped "respectively" markers (C2). Users see amber warnings on correct citations. | Low–medium (credibility of the warning signal) | `citations.ts:50-59`; C2, L6 |
| 3 | **Omitted key evidence in a comparison** (L6 HubSpot "normally $20") and loose source-age wording ("recent" for 13 months). | Medium (semantic), model behaviour | `live-L6-crm.json` [45], [28] |
| 4 | **Fixture history not labelled** (J2). | Low in real use; matters for a seeded demo | P1 report J2 |
| 5 | **Irrelevant recalled history** shown/added to context (CRM + Node chips on Postgres and SQLite questions); inflates input and shifts markers to [16]+. | Low | L2, L3, SQLite turn |
| 6 | Invalid tool-call arguments in live use (2/5 in L7). Recovered; rejected arguments are not logged, so the cause is unknown. | Low | `invalidToolCalls: 2` |
| 7 | Releases-page snapshot contradicting an official post is reported without being named a conflict (L1). | Low–medium | `live-L1-node.json` |
| 8 | Three evaluator limits on correct answers: C1 `uncertaintyDisclosure`, C3 original-error regex, G1 derived-difference/uncited arithmetic. | Low (harness) | `evals/assertions.ts:91`, `recheckScenarios.ts` |
| 9 | TTFT above the 8 s p50 plan target in 1 of 6 live research turns (n small). | Low | L7 10.1 s; L3 7.9 s |

## 11. Smallest justified fixes (proposals only; none implemented)

1. **Evaluation-only (owner approval; keep negatives):** make `uncertaintyDisclosure` accept "not established / are not established"; let C3's original-error check accept "not evidence of a plan change"; treat G1's labelled "differ by $X" as a derived difference with both operands cited in the same sentence. Re-run only C1, C3, G1 (not selective rerolls of the others) and keep the existing negative controls.
2. **Production checker, small and reproducible:** treat "captured" like "retrieved" for the retrieval-date role (removes the five L6 false positives). Also consider evaluating a "respectively" sentence marker-by-marker. Needs a failing regression test first; owner approval required because it touches the production checker.
3. **Prompt-level, uncertain:** for refresh questions, require that a claim about a "fresh reading" cite only an observation retrieved this turn. Not demonstrated to work; try only with a before/after on L5 and the existing negative cases, otherwise leave the disclosed limitation.
4. **Demo hygiene (no code):** for a submission demo use a clean database or a small seeded set; the demo fixtures made L6 verbose and hedged.

Not justified now: a verifier model, architecture changes, Responses migration, model default change, more security work.

## 12. Remaining blockers before submission

1. **Owner human review** of the P0/P1/live answers (still pending by design).
2. **Owner decision on the L5 class** (item 1 above): accept as a disclosed limitation (UI already warns), or approve one bounded fix attempt.
3. **Owner model approval** for `gpt-6-luna` (provisional, unchanged). No comparison winner exists; this phase made no comparison.
4. Optional but advisable before a demo: a second independent live run of L1/L5/L6 to see whether n=1 successes hold.

## 13. Verdict

**Not submission-ready as of this checkpoint; ready for owner review.** Engineering, security policy, streaming, Stop/Retry/idempotence/persistence and the frozen-evidence suites are sound (703/703, 23/23, P0 9/11 and P1 9/12 with no genuine P0 answer error). The product does not yet demonstrate consistently trustworthy live grounding: one demonstrated misattribution (L5), omitted-evidence and source-age slips (L6), and checker noise that weakens the warning signal. These are narrow and fixable or disclosable; none justifies a redesign. Decision requested: items 1–3 in section 12, and whether to authorise the checker/assertion proposals in section 11.
