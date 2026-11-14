# Acceptance remediation — 14 November 2026

> **Historical checkpoint.** This report records the remediation phase as it stood before integration. The owner decisions that followed, one further wording change, the final validation and the merge are in [`FINAL-RELEASE.md`](FINAL-RELEASE.md). Statements below such as "uncommitted" and "not merged" describe that moment, not the final state.

**Checkpoint, not a submission.** Nothing is committed, pushed, merged or submitted. The runtime model (`gpt-6-luna`, provisional) is unchanged. No paid model call and no Tavily search was made in this phase: every result below is **deterministic or an offline reassessment of the saved captures**, and is labelled as such.

**Headline.** The investigation changed the L5 diagnosis. The fresh Neon result [19] carried "Typical Spend **$15/Month**" in its *title*, which the model sees; only its excerpt lacked the amount. The $15 claim was therefore *supported by the fresh source*, not misattributed to it, and the proposed L5 prompt instruction would have been aimed at a failure that did not happen (and could push the model the wrong way). I did not add it. Two narrow evaluation repairs (C1, C3) and one narrow production date-role rule (`captured <date>`, L6) are implemented with tests. G1, C2, J2 and the L6 completeness/recency issues are kept as documented failures or limitations.

Original report: `docs/FINAL-ACCEPTANCE.md` (untracked in the main checkout, untouched). Human-review packet: section 11.

## 1. Verified root causes

Evidence was re-read from the ignored captures (`evals/results/final-acceptance/`), not from the summary. The eight axes you asked me to separate, per case:

| Case | 1 Factual | 2 Direct source support | 3 Temporal | 4 Citation placement | 5 Mechanical check | 6 Eval contract | 7 Missing research | 8 Provenance disclosure |
|---|---|---|---|---|---|---|---|---|
| **C1** | Correct | Every price/date from its own excerpt | Nov 9 baseline, Nov 10 effective, Nov 11 retrieval: right | Cell-local markers | 10/10 verified | **Wording gap**: "no effective change date is established", "timing and cause are not established" not recognised | None (5 independent searches) | Synthetic stated |
| **C2** | Correct | Per vendor, by position (Neon, Supabase, RDS, Railway → [1]–[4]) | Demo answer vs synthetic current: right | **Weak**: one "respectively" sentence, four markers on the whole list, no figures in it | [3] false-positive "unverified" (sentence names Neon/Supabase/Railway; RDS source registers subject "Amazon"); [1][2][4] "unchecked" | "Uncited numerical claim" fires on the recalled-answer prices of paragraph 2, which the prompt says to attribute to the past report without a citation | None | Synthetic stated |
| **C3** | Correct | [1] (3 Nov) already said 1 day, [2] agrees | Right | Fine | Verified | **Wording gap**: "appears incorrect, not evidence of a plan change" | None | Synthetic stated. Label "OBSERVED DIFFERENCE" is a misnomer (the observations agree) |
| **G1** | Correct ($90 − $80 = $10) | $90/$80 attributed to official/third-party, positional | n/a | **Gap**: grouped [1][2]; "$10" has no operand citations | Both markers "verified" (pooled); derived-number rule fires | Correct by design; kept | None | Fixtures stated |
| **J2** | Correct | Current-chat messages | 11 Nov: right | n/a | n/a | Correct; kept | None | **Missing demo label** despite "[Demo evaluation]" on every message, `origin: fixture` in the index, and an existing prompt rule |
| **L5** | Correct | $0.106 and $0.35 in the excerpt; **$15 in the title only** | Retrieved 14 Nov 07:17 UTC: right | One marker at paragraph end | Flagged: excerpt-only checker, plus "17" (the minute of "07:17") | n/a (live) | None | Does not say the $15 comes from the page title |
| **L6** | HubSpot verdict misleading (below); other rows correct | All cited figures present | **"recent" for a 389-day-old publication**; "captured Nov 9" is correct | Cell-local | **5 false positives** ("captured Nov 9") | n/a (live) | Pipedrive/Zoho official pages not found (disclosed) | Demo disclosed |

### C1 — historical uncertainty
Saved answer is correct. The assertion accepted only "unable to verify / cannot verify / cannot be established" and a narrow "prior … terms … missing" form. The answer used the passive "is/are not established", bound to the change date, timing, cause and prior terms.

### C2 — grouped "respectively"
**Classification: evaluation/checker limitation on a semantically correct answer, plus a minor claim-local-placement weakness. Not a source error.** The mapping is unambiguous to a human reader (four names, four markers, same order) but not mechanically separable: the markers attach to the whole list, and the sentence contains no figure for any marker to support. Unchecked is not wrong, and the one flag ([3]) is a vendor-alias gap ("RDS" is not a registered subject; the source's is "Amazon"). I did not touch the checker (section 3).

### C3 — assertion
Rejected truthful wording: *"the answer appears incorrect, not evidence of a plan change"* with [1] saying 1 day on 3 Nov. It distinguishes an original error from a later change; the regex wanted "original error/already/at the time/never included".

### G1 — kept
Arithmetic is correct. The citation contract is not met: "differ by $10" cites neither operand. Source values appearing elsewhere in the answer do not satisfy that. The derived-citation prototype stays evaluation-only.

### J2 — kept
The model-visible evidence is unambiguous: all four chat messages begin "[Demo evaluation]" and the conversation index entry has `origin: "fixture"`. The system prompt already says "Turns marked origin="fixture" and messages labelled demo are demo data … If you use them, say they are demo data." The model did not comply (n=1). The rule exists and covers the case, so I did **not** add a clarification: it would lengthen the prompt, move every scenario's context, and rest on one miss of an explicit instruction.

### L5 — the key finding
Reconstructed from `live-L5-again.json` and the tool-result format in `researchRound.ts` (tool results include `title`, `published`, `retrieved`, `excerpt`).

- Fresh search `850c38af-4f20-4b51-b61f-f3eef9fa07a2` (one query, 2.2 s, status ok) returned [18] (`www.neon.com/pricing`) and [19] (`neon.com/pricing`) with identical excerpts, retrieved `2026-11-14T07:17:15.888Z`.
- The model cited **[19]**. Its **title** is "Neon Pricing: Free Plan With 100 Projects, Typical Spend $15/Month". Its excerpt (1,315 chars, not clipped at the amount; Tavily returned a different passage) contains `$0.106 per CU-hour` and `$0.35 per GB-month` and **no "$15"**.
- The earlier observations [11] and [13] (same pricing page, retrieved 07:16:35 and 07:16:24 in earlier turns) carry "Typical spend: $15 /mo" in the **excerpt**.
- Historical and current observations have distinct UUIDs and dates (section 10). Nothing in the ledger was merged or mis-dated.
- The checker verifies only excerpt tokens, so it reported "not found in source: 17, $15". The "$15" is the title/excerpt gap; the "17" is the minute in "07:17 UTC".

So the *model's sentence is true of the fresh result*. What is imperfect: it does not say the figure comes from the page title, and "still says" glosses that the fresh excerpt does not repeat it. The UI warning was accurate to the checker's contract (excerpt only) but not evidence of a wrong source. **The failure class you described, a historical amount credited to a fresh result that lacks it, was not demonstrated.** It remains possible, so I note it as undemonstrated rather than refuted.

Why not the preferred prompt instruction: its second clause ("state that current support is unavailable") would tell the model to disclaim a figure the fresh source does support through its title. I could not construct the required negative controls (historical-only amount, fresh source omitting the price, overlapping vendors, …) from a real instance, and none of that is deterministically testable without a model call that has nothing demonstrated to fix. No provider retries, second verifier or loop changes were added.

### L6 — three separate issues
- **(a) Missing commercial qualification — answer-completeness defect, in the supplied evidence.** [45] (`d76c8ab5-7074-421d-bbca-676578e8ee79`): "Starter is normally priced at $20/month per seat, but for a limited time … $7/mo … annual commitment … $10/month … month-to-month." The answer headlines "$7 versus $20 … observed difference" and mentions the promotion, commitment and $10, but never states that the page's own normal price is $20, equal to the demo $20. Not fixed (no authorised change); documented.
- **(b) "recent" — incorrect recency wording.** [28] was published 2025-10-21 and retrieved 2026-11-14: 389 days. Its body says "verified on August 3, 2026" (103 days). The answer gave neither date. I added no global definition of "recent"; the right fix is to state dates, which is model behaviour. Not fixed; documented.
- **(c) "captured Nov 9" — checker false positives.** Sources [1]–[5] have `retrievedAt = 2026-11-09T10:00:00.000+05:30`. "Captured Nov 9" is the observation's recorded retrieval time. Fixed narrowly (section 2).

## 2. Changes made (at the time of this checkpoint: uncommitted, in the acceptance worktree)

| File | Change |
|---|---|
| `evals/assertions.ts` | `uncertaintyDisclosure`: adds the passive "is/are not established" form **only** when its subject is the change/difference/increase, timing, cause, date, terms, packaging, baseline, history or commitment, plus "no … date/timing/cause is established". Unrelated ("The current price is not established"), affirmative and "No change is established" (a separate C1 category) are rejected. New `originalErrorNotLaterChange`: accepts "not (evidence of) a (later) plan/vendor change" **only if** the text also names the historical baseline (historical/earlier/stored/recorded/original … observation/source/evidence/terms/page/documentation). |
| `evals/recheckScenarios.ts` | C3's original-error check also accepts `originalErrorNotLaterChange`. Every other C3 requirement and negative is untouched. |
| `src/server/agent/citations.ts` | **Production, narrow.** A date directly governed by `captured` / `captured on` (ISO, `D Month [YYYY]`, `Month D[, YYYY]`) is checked against excerpt tokens **or the cited observation's `retrievedAt`**. It is removed from the ordinary required-token list, so a second date in the same sentence still needs its own support, and no other date role changes. |
| `tests/unit/acceptance-grounding.test.ts` | 44 new tests (section 4). |

No change to `prompt.ts`, the model, tool, agent loop, source identity, database, cassettes, scenario facts or dependencies.

**New implementation fingerprint:** `a9afb0123da80df2e7c7e121362ae19d7409cb32fe4f7e1722b74c3ac76398d7` (was `7bd8f6ff799b9c63e5e323cf7807da925aeb249febb66df25a8e45be892a358d`). Any new real-model run is therefore a different implementation from the acceptance run; the saved answers were produced by the old one.

## 3. Changes deliberately rejected

| Proposal | Decision and reason |
|---|---|
| L5 prompt instruction (historical amount must not be attributed to a fresh source) | **Rejected.** Premise not borne out (title supported the claim); the "current support unavailable" clause is wrong for title-supported figures; no demonstrated instance to test against. |
| Count the source **title** as citation evidence, or say "excerpt" in the warning text | **Not done.** Outside the authorised budget and an owner decision on what the checker verifies. Recommended as a follow-up (section 14). |
| "respectively" inference | **Rejected.** Name-list parsing plus positional alignment is not exceptionally small, and with no figures in the sentence it would only verify names, not the claim. C2 stays failed. |
| G1: arithmetic exemption, "differ by $X" rule, derived-citation promotion | **Rejected**, as instructed. G1 stays failed. |
| J2 prompt clarification; weaker demo-label assertion | **Rejected** (section 1). |
| Global definition of "recent"; prompt line about list vs promotional price (L6 a/b) | **Rejected**: no authorised change and no product requirement. |
| Equating "captured" with published/announced/effective/updated/seen | **Rejected.** Only the retrieval role, only for a directly following date. |
| Time-of-day support ("07:17") in the checker | **Not done**: unauthorised; the L5 "17" remains. |
| Generic "not established" in `uncertaintyDisclosure` | **Rejected**: would erase the distinction between uncertainty about history and an unrelated unknown. |
| Fixing the existing C3 flaw that "not an original error" still matches `original error` | **Not done**; reported (section 9). |
| Fresh model comparison / new runtime / retries / extra research loops | **Not done.** |

## 4. Test results

Run in the worktree after the last edit (logs in `evals/results/acceptance-remediation/`, ignored):

| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm test` | **747/747 passed, 47 files** (703 baseline + 44 new) |
| `npm run build` | exit 0 (known chunk-size warning only) |
| `npm run eval -- --mock` | **23/23 PASS** |
| `npm run eval -- --mock --only R1,R2,R3` | **3/3 PASS** |

Red check: with the three source files stashed, **21 of the 44 new tests fail** (all the positive and helper tests); the negative controls that were already rejected stay rejected. Mock passes prove harness mechanics, not model quality.

New tests: (C1) 6 positives, 7 negatives, the saved Luna answer passes while removing its uncertainty wording or its "Observed difference" label fails the relevant category, a fabricated dated change and a shipped announcement still fail. (C3) 3 positives, 5 negatives (current-only, affirmative, contradictory, bare "incorrect"), the saved answer passes while dropping the historical anchor, the correction or adding a vendor-change claim still fails. (`captured`) 5 positives; negatives for a different day, a different year, the publication date, a wrong price, a second unsupported date, a wrong source, a different source's retrieval date, no retrieval time recorded, "captured the market on Nov 9"; `announced/effective/updated/published/changed/seen` stay unverified; explicit "Retrieved" and "Published" roles unchanged.

## 5. Original versus new classifications (offline reassessment, not new generation)

Same saved answers, current assertions/checker (`evals/results/acceptance-remediation/offline-reassessment.json`; reproducible with `reassess.ts` in that folder). **The 9/11, 9/12 and 5/7 figures are not restated.**

| Case | Original | Reassessed | Why |
|---|---|---|---|
| C1 | fail | **pass** | corrected uncertainty wording |
| C3 | fail | **pass** | corrected original-error wording |
| C2 | fail (2 reasons) | fail (unchanged) | limitations kept |
| G1 | fail | fail (unchanged) | kept by design |
| J2 | fail | fail (unchanged) | genuine miss |
| LIVE L6 | 5 unverified warnings | **0 warnings** | `captured <date>` role |
| LIVE L5 | 1 unverified | 1 unverified (unchanged) | title/minute gap kept |
| all other P0/P1 rows and LIVE L1–L4, L7 | | no state change | |

Counting the reassessment as a rate would be circular. What changed is the *classification of two correct answers and five correct citations*, not the model.

## 6. Fresh model results
**None run.** No prompt change was justified, so nothing needed a new generation. The planning limits (≤ $0.10 model, ≤ 10 Tavily searches) were not touched: **$0.00 and 0 searches this phase.**

## 7. Fresh live Tavily findings
**None run** (same reason). All L5/L6 findings are from the saved real-Tavily captures of 14 Nov 2026 07:15–07:19 UTC. Optional follow-up in section 14.

## 8. Remaining genuine correctness failures

| Case | Failure | Severity |
|---|---|---|
| J2 | Demo record not labelled as demo | Low in real use; visible in a seeded demo |
| G1 | Derived "$10" difference uncited (arithmetic correct) | Low (provenance contract) |
| L6 (a) | HubSpot normal price $20 omitted from a "$7 vs $20 difference" verdict | Medium (semantic) |
| L6 (b) | "recent" for a 389-day-old publication; no dates given | Medium–low |
| L5 | $15 supported only by page title; not disclosed as such | Low |
| L7 | 18.6 "current minor" from one cited source vs 18.7 announced in another cited source; conflict unnamed | Low (asked attributes correct) |
| L1 (live) | Releases-page "Current" vs official LTS post not named as a conflict | Low |
| C3 | Verdict label "OBSERVED DIFFERENCE" where observations agree | Low |
| H1 / J1 | Omitted alternative date (H1); table-vs-prose commitment inconsistency (J1) | Low |
| L7 (tool) | 2 of 5 tool calls rejected as invalid arguments, cause not logged | Low |

No fabricated history, wrong date/price, injection hijack or unsafe behaviour was found in any of the 30 cases.

## 9. Remaining lexical checker limitations
1. **Excerpt-only.** Titles are model-visible and shown with sources but are not checked (L5).
2. **Time of day.** "07:17 UTC" yields a bare "17" token that no excerpt contains (L5).
3. **Grouped citations are pooled.** Tokens are matched against the union of all markers in a sentence, so a swapped group (e.g. "$90, $80 [2][1]") still verifies (G1, K1, C2); `captured` follows the same union rule.
4. **Marker placement.** A cell whose markers sit only on its last sentence leaves the earlier sentences unchecked (L2 Railway "$5/month": [18][19] "unchecked").
5. **Vendor aliases.** Only a title word matching the host label is a "subject" (Amazon, not RDS).
6. **Single-digit numbers** are ignored; numerical match is not entailment.
7. **Eval-only:** "uncited numerical claim" cannot tell recalled-answer figures from source figures (C2); derived-number handling differs by scenario (G1 applies it, J1 does not).
8. **Eval-only, pre-existing:** C3's `original error` alternative still matches a negated "not an original error", so a contradictory answer can pass that sub-check. Strengthening it would only reject more; left for owner approval.

## 10. Exact source attribution

**L5** (`live-L5-again.json`, conversation `ff043f94-e61a-4296-adc9-d1aa5b6b2b42`, asked ~07:17 UTC 14 Nov)

| Marker | Source UUID | Search UUID | Retrieved | Role | "$15" |
|---|---|---|---|---|---|
| [19] **cited** | `0ad2b425-f319-443c-938d-24420fa866cf` | `850c38af-…` (this turn) | 2026-11-14T07:17:15.888Z | fresh | **title only** |
| [18] | `1c36494e-d428-4364-a94c-4ada12cdc65a` | `850c38af-…` | 2026-11-14T07:17:15.888Z | fresh (www host, same excerpt) | title only |
| [13] | `b4fd5d48-6488-4d63-bd2c-46130f4ccb02` | `ac5c4272-…` | 2026-11-14T07:16:24.763Z | earlier turn | excerpt ("Typical spend: $15 /mo") and title |
| [11] | `a8a4eed6-4148-481f-8a8d-19cb89b87b0e` | `3b2fb675-…` | 2026-11-14T07:16:35.275Z | earlier turn | excerpt and title |

**L6** (`live-L6-crm.json`; search UUIDs `36054e35…` Pipedrive, `5a3fa3d0…` Zoho, `aa356f7c…` Close, `abc65321…` Salesforce, `fbc3fca3…` HubSpot)

| Marker | Source UUID | Published | Retrieved | Role |
|---|---|---|---|---|
| [1] HubSpot demo | `26065fd1-cfde-43c1-a492-82f421cc94b2` | — | 2026-11-09T10:00:00.000+05:30 | synthetic baseline; "captured Nov 9" = this retrieval time |
| [2] Pipedrive demo | `fbd2e1f6-2383-4ff3-9c1e-f13c1531b6f3` | — | same | synthetic baseline |
| [3] Zoho demo | `9a661144-2b74-48d7-8fc2-a54b2d743273` | — | same | synthetic baseline |
| [4] Salesforce demo | `4ae1703f-ea1a-4d60-bf97-c654c06a5b34` | — | same | synthetic baseline |
| [5] Close demo | `670332df-cedc-4cf1-aa7f-1614264e3e0c` | — | same | synthetic baseline |
| [45] HubSpot Starter page | `d76c8ab5-7074-421d-bbca-676578e8ee79` | Mon, 16 Jul 2018 (metadata) | 2026-11-14T07:19:05.248Z | real; contains "normally priced at $20/month per seat" |
| [44] HubSpot pricing | `05134b2e-0070-49d6-b1b5-cf80c2adc270` | Thu, 02 Apr 2026 | 2026-11-14T07:19:05.247Z | real; "Starter $7/mo/seat" |
| [28] Pipedrive guide (third party) | `576d58b5-bf40-488f-abf2-48579d7a9d48` | Tue, 21 Oct 2025 | 2026-11-14T07:19:04.451Z | real; the "recent" source (389 days) |

The remaining L6 markers ([23][24][31][36]) and all excerpts are in the packet.

## 11. Human-review packet
`evals/results/acceptance-remediation/review-packet.md` in the acceptance worktree (ignored by Git, kept private; ~116 KB). It contains **all 11 P0, 12 P1 and 7 live raw answers verbatim**, the original and reassessed automatic result, per-case manual judgment, marker → source UUID / search UUID / published / retrieved / fresh-or-historical / synthetic-or-real, verbatim cited excerpts, search queries and the disagreement list. Uncited live excerpts: `appendix/LIVE-L*-uncited-sources.md`. Raw captures are named in each header and were not modified or moved. My tallies: 18 OK, 10 OK-caveat, 2 DEFECT (J2, L6), i.e. reviewer's sign-off aid, not pass rates. Where I differ from the earlier report: H1, L5, L7 (and L6's split).

## 12. Files changed
```
 evals/assertions.ts                      (+14/-1)
 evals/recheckScenarios.ts                (+2/-2)
 src/server/agent/citations.ts            (+9/-3)
 tests/unit/acceptance-grounding.test.ts  (new, 44 tests)
 docs/ACCEPTANCE-REMEDIATION.md           (new, this report)
```
Ignored/not for Git: `evals/results/acceptance-remediation/` (logs, mock reports, offline reassessment, packet, generator scripts). A `node_modules` symlink to the main checkout's dependencies exists in the worktree and is excluded via `.git/info/exclude`.

## 13. Git worktree and branch status
- Acceptance worktree, branch `fix/acceptance-grounding`, based on `81f183f179428c95b8569a4e8a701243e7276c33` (verified = `main`). Four files uncommitted (three modified, one new test) plus this report.
- Main checkout: untouched; still on `main` with only `docs/FINAL-ACCEPTANCE.md` untracked. `data/reprise.db` not touched. Old frontend/security worktrees untouched.
- `docs/FINAL-ACCEPTANCE.md` is **not** in the worktree. Carry it onto the branch yourself if both reports should ship together.
- Not committed, pushed, merged or submitted.

## 14. Recommended submission-readiness decision

**Ready for your sign-off, with limitations stated; not yet signed off.** Engineering gates are green (747 tests, 23/23 and 3/3 mock, typecheck, build). No P0 or live answer contained a fabricated fact, wrong price/date, hijacked instruction or unsafe behaviour, and the two evaluation misses and the five L6 warnings were verified as errors of the *checks*, not the answers. The remaining defects are small, model-behavioural and disclosed (section 8).

On Luna, as you framed it: **L5 is resolved as an explicitly limited, understood case** (supported by the fresh title; warning explained by the excerpt-only checker), and the other live discrepancies are understood (L6 a/b are real and unfixed; L6 c fixed; L7/L1 conflicts unnamed). Cost and latency evidence is unchanged from the acceptance run. I would approve Luna as the provisional model on that basis; I have not made that decision for you.

Decisions I need from you:
1. **Accept the L5 re-diagnosis**, and say whether to (a) leave the excerpt-only checker and document it (my recommendation for the take-home), or (b) approve a small follow-up so the warning says "not found in the cited excerpt (title only)" rather than "not found in source".
2. **L6 a/b:** accept as a disclosed model limitation, or approve one prompt sentence (state source dates when age matters; report a vendor's own normal price beside a promotion). I would only add it with a before/after on L6 and the existing negatives.
3. **Optional independent live check** (L1, L5, L6; n=1 so far): about nine live searches and ~$0.02, within the planning limits; needs your go-ahead.
4. **Merge path:** review the diff and packet, then tell me whether to commit on `fix/acceptance-grounding`. For a demo, use a clean or small seeded database: the demo fixtures made L6 verbose and hedged.
