# M6 checkpoint — final engineering review

Date: 11 November 2026. Started from verified `04fd8117d164a810f6ad4b40d24dfcc769da5e8b` on a clean `main`.

**Offline M6 is complete with outstanding submission blockers. Reprise is not fully verified or ready to submit.** Compatible real-model generation, actual Tavily research, human answer review, P0 live acceptance and model selection remain unestablished. No application was submitted and no video was recorded.

## Work completed and review judgment

Read the master plan (including C, D, N and R–X), M4/M5 checkpoints, all six ADRs, glossary, README, evaluation documentation, Git history and the actual request path. The settled design remains: one process, one SQLite database, deterministic recall/date context, one model and one model-visible `web_search` tool. No API migration, new feature, framework, dependency or default-model change was made.

The adversarial review examined responsibilities, cohesion, unnecessary abstractions, boundary validation, error paths, cancellation, duplicates, transactions, provenance, test meaning and dependency use. Two concrete lifecycle defects warranted correction:

1. **Source deletion during generation:** deleting the conversation owning a recalled source could cause the new answer's citation foreign key to fail, rolling back its entire answer transaction. Persistence now records an unavailable, unverified citation when that historical source has disappeared. It does not recreate deleted evidence. The stream sends the persisted evidence rather than stale in-memory references.
2. **Lost retry acknowledgement:** new retry IDs were not saved, allowing an interrupted retry to run again or a completed retry to reject recovery. Distinct retry IDs now use the existing unique `client_message_id` column on assistant attempts. Replays return that exact attempt, including an older interrupted attempt after a later success. The existing active-turn map reserves running request IDs across conversations, preventing another submission from claiming a retry ID before its attempt commits.

Three new integration cases failed against the previous behavior and passed after the fixes: source deletion and complete/interrupted retry acknowledgement loss. A follow-up independent review caught the active-ID collision window; a focused assertion covers it. Deliberately disabling that guard in the disposable clone produced the expected HTTP 200-versus-409 failures; restoring it passed. The experiment also exposed a test cleanup problem: an unexpected successful streaming response needed draining before assertions. The regression now drains it and completes prepared work before asserting, so the deliberate failure no longer hangs teardown. No assertion or product timeout was weakened.

Simplification removed the unused public `createConversation` and `touchConversation` repository exports while keeping their necessary internal helpers. The README was reduced from 129 to 87 lines and obsolete milestone/test-count claims were removed. Factory boundaries for injected LLM/search, the repository and stream reducer remain because they isolate real behavior and failure tests. No speculative loop, memory, persistence or frontend rewrite was justified. The final independent lifecycle and documentation reviews approved their inspected changes.

All ten runtime dependencies have direct imports and belong to plan §Q; dev dependencies support the existing build/types/test commands. `npm audit` and `npm audit --omit=dev` reported zero advisories at review time. No dependency or lockfile changes. Server files total 1,323 physical lines including whitespace/comments; application, script, evaluation and test code files are below 300 lines. The existing long master plan and generated-format lockfile are documentation/data, not oversized application modules. No production scenario IDs or expected fixture answers were introduced; the existing vendor-query example in the general prompt is an example, not an evaluation branch.

Main harness: Sol 6.1 High. Isolated review, documentation drafting and clean-clone tasks used catalog-confirmed Terra 6.1 with `reasoningEffort=high`. The requested Right Skill Picker routed to the engineering review workflow, with PDF and browser verification skills for their distinct checks. Parent reviewed the helper outputs and owned the implementation fixes and final acceptance decision.

## Actual lifecycle trace and invariants

The browser `research pricing` request exercised the real React → HTTP → turn service → agent → SQLite → reconciliation path with explicitly scripted providers. The C1 mock trace additionally exercised dated cross-conversation evidence: five historical observations from 9 November plus five fresh synthetic observations from 11 November, five independent searches and ten distinct observation identities. Both are offline evidence, not live research.

| Boundary | Implementation and verified invariant |
|---|---|
| 1. Browser submission | `client/components/Thread.tsx`: request UUID/timezone; retain unacknowledged identity; reject a second active send. |
| 2. API validation | `shared/types.ts`, `server/app.ts`: UUIDs, trimmed 1–8,000-character text, valid IANA timezone; safe errors before mutation. |
| 3. Initial persistence | `turns/service.ts`, `db/repo.ts`: save user before generation; unique request identity and ordered conversation sequence; atomic first conversation/user creation. |
| 4. Date resolution | `time/resolve.ts`: timezone calendar arithmetic, ordered supported-English candidates, DST tests; stored local dates retain their write-time interpretation. |
| 5. Conversation recall | `memory/recall.ts`: date and FTS matches, raw user words, original answer status, topic mismatch/alternative notes and fixture labels. |
| 6. Model context | `memory/context.ts`, `agent/prompt.ts`: now/history start/index, bounded recalled evidence and 20 recent messages; protected-history overflow requests narrowing. The recall-block bound is not a cap on the entire model prompt. |
| 7. LLM request | `llm/client.ts`, `agent/modelStep.ts`: one configured model and one tool definition; streamed fragment/protocol checks. Actual provider compatibility remains blocked. |
| 8. Search calls | `agent/researchRound.ts`: validate tool name/arguments; normalize duplicate queries; parallel execution within round/query/time caps. |
| 9. Sanitization | `search/tavily.ts`, `sanitize.ts`: validate payloads, reject credential-bearing/non-HTTP(S) URLs, strip tracking/fragments, bound sanitized excerpts. Source content remains untrusted. |
| 10. Source registration | `sourceRegistry.ts`: turn-local URL markers and immutable observation UUIDs; a new observation never overwrites a historical one. |
| 11. Evidence ledger | Searches retain query/status/timing; observations retain excerpt, publication/retrieval time and fixture provenance. Accumulated evidence remains in memory until final persistence. |
| 12. Answer streaming | `modelStep.ts`: discard draft on tool calls, accumulate only current answer; SSE schema/parser handles fragmented UTF-8 and first terminal event. |
| 13. Citation checking | `citations.ts`: marker existence and recognizable numerical/date tokens across a sentence's cited excerpts; strongest failure state per marker. No semantic verification. |
| 14. Final transaction | `db/db.ts`, `repo.ts`: synchronous `BEGIN IMMEDIATE`; answer, evidence, FTS and conversation update commit/roll back together; completion follows commit. Deleted historical refs become unavailable. |
| 15. Client reconciliation | `Thread.tsx`, `state.ts`: request ownership, no late terminal mutation, authoritative GET after stream; lost retry acknowledgement recovers saved attempt. |
| 16. Later retrieval | Repository joins original source references without inventing another retrieval; recall carries original dates/IDs and current-turn markers into the next context. |

Memory and date selection are deterministic, but semantic interpretation, abstention, searching, comparison and wording remain probabilistic. The prompt distinguishes verified change, observed difference, no established change and unable to verify; code does not compute a structured price-change verdict. Like-for-like tiers, units, seats, commitments, currencies and dates must still be reviewed by a human.

Cancellation/transport failure persist interrupted attempts when the process can finish its transaction. Complete duplicates replay without another generation; conflicting IDs and simultaneous turns reject. Retry reuses the latest incomplete user row and appends an attempt. A hard crash can retain the user but lose in-flight text/evidence; orphaned users remain retryable. Generation is not distributed exactly-once. Legacy reuse of the original submission ID for an explicit retry remains compatible; browser retries use distinct IDs. Run one process per database.

## Delivered documentation

- Root [DESIGN.md](../DESIGN.md): 490 words, compact flow, consequential decisions, alternatives, limits and another-week priorities. Actual PDF rendering produced **one A4 page and one US Letter page**, 11-point body/13-point leading, 18 mm margins. The Letter rendering was rasterized and visually inspected through the final sentence. Markdown print layout can vary by renderer; no tiny body font or omitted content was used. Temporary PDFs/rendering tools stayed outside the repository and are not app dependencies.
- [README.md](../README.md): final purpose, setup, all environment settings, Node requirements, dev/production startup, tests/evals, labelled seeding, source/recall inspection, architecture and privacy/limits. The evaluation guide retains the detailed reproducibility/comparison commands.
- [Interview notes](interview-notes.md): concrete implementation references for all requested tradeoffs, reliability, evidence limits, scaling, debugging and honest AI contribution. They do not assert the owner personally authored or reviewed every module.
- [Architecture script](architecture-script.md): 149 spoken words, approximately 60 seconds, plus an explicitly labelled offline screen outline. The owner's delivery/understanding has not been tested.
- Glossary, evaluation status and master-plan status updated. The plan's speculative cheap-model/bake-off script and overstated production tracing explanation were replaced with accurate descriptions; settled architectural decisions were preserved.

## Verification results

Final application/docs candidate: `5a9e3966781c460cc418c53d4245597ebab2a2e9`. Node 26.10.0 in the original checkout; actual Node 24.22.2 in the fresh clone; npm 11.19.1. Full suites ran serially. The Node 24 binary was selected through its bin directory in `PATH`; this is not a version-label simulation.

| Exact command | Node 26 | Node 24 clean clone |
|---|---|---|
| `npm run typecheck` | Passed | Passed |
| `npm test` | **339/339; 33 files; 10.10 s** | **339/339; 33 files; 9.33 s** |
| `npm run build` | Passed | Passed |
| `npm run eval -- --mock` | **23/23: 11 P0, 12 P1** | **23/23: 11 P0, 12 P1** |
| `REPRISE_TEST_PRODUCTION=1 npx vitest run tests/integration/server.test.ts` | 1/1 passed | 1/1 passed |
| `git diff --check` | Passed | Passed |

The original 336-test baseline remains, plus three meaningful lifecycle regressions; no baseline tests were removed. Client production output remains 499.56 kB JS / 151.80 kB gzip and 7.26 kB CSS / 2.37 kB gzip. These are build sizes, not provider performance. Test durations are engineering checks, not answer latency. All 23 mock rows were inspected as passes; report metrics/model acceptance remain null and human review remains pending. No mock timing/token counter is presented as a benchmark.

Browser verification used the existing `qualityPreview.ts` and `memoryPreview.ts` fixtures: real API/agent/database, scripted LLM/search. Checked streamed research, unknown markers and unsupported `$99`, dated historical/current observations, reload, Stop/partial persistence, dropped retry acknowledgement and recovery, cleared outbox, and 390 px layout without document overflow. Persisted recovery transcript was exactly user → interrupted assistant → complete assistant. Labelled Postgres recall selected 3 November; clicking its recall chip focused/highlighted the original fixture message. This supplements, rather than repeats or replaces, M5's full touch/responsive/contrast and 33-row failure-mode audit; no frontend code changed.

T3 preview snapshots timed out twice (`Preview automation snapshot timed out after 15000ms`), so browser verification used the documented Playwright fallback. The initial fixture console had only a missing favicon; the network-drop and replaced-fixture missing-conversation errors were intentional checks. An initial verification selector matched three copies of a citation card; selecting the inspected card resolved that test-script ambiguity. No product change was inferred from the failed selector. Generated screenshots, traces and scripts stayed ignored or in `/tmp`.

## Clean-clone setup

Fresh directory: `/tmp/reprise-m6-clean-j5E1cHRc`. `git clone https://github.com/marsh15/Reprise.git` succeeded at original remote `04fd811`. Before publishing, the clone fetched the committed local candidate `ffa44f6`; it later fetched/checks out final candidate `5a9e396` and reran the complete Node 24 suite above. Thus installation started from GitHub, and the final candidate was verified from committed files rather than copied working-tree edits. The clone then fetched `origin/main` at `5a9e396` after publication and verified it was identical to the tested candidate. The final checkpoint-only commit adds no application changes.

- `npm install` passed, reported zero vulnerabilities, and did not change the tracked lockfile.
- Missing `.env` plus `npm run dev` created the template, named both missing keys and exited 1. All supported config/evaluation environment names are in `.env.example`.
- Both `npm run dev` and `npm start` (after build), using explicit nonsecret placeholders, returned `/` 200 and `/api/health` 200 on isolated ports; clock/model fields were inspected. Process groups stopped and their ports closed. No external request was sent by these health checks. Valid-provider chat startup remains unverified.
- `npm run seed:demo -- --tz Asia/Kolkata` created four labelled fixture conversations, eight labelled messages and nine fixture observations. Repeating refused duplicates, exit 1; adding `--reset-fixtures` recreated four. This did not touch original local data.
- Missing-key smoke/replay/live commands behaved as documented. The Node 24 production-process test used a local fake provider to exercise real SDK streaming, disconnects, shutdown and restart persistence.
- Required source/config/lock/fixture files are tracked; DESIGN and interview/script files are present at final candidate. `.env`, `.env.local`, local SQLite data, dependencies, builds, generated evals and browser artifacts are ignored. No sensitive file is tracked.

## Provider validation and evaluation boundaries

Only key presence was inspected: **`LLM_API_KEY` absent; `TAVILY_API_KEY` absent; optional `OPENROUTER_API_KEY` present.** No value was printed, copied into clean-clone files, staged or placed in a report. The earlier optional-provider HTTP 402 has no evidence of resolution and was not re-probed. Terra's existing Chat Completions versus Responses tool-path guard remains; it was not bypassed or silently replaced.

| Evidence category / command | Actual M6 result |
|---|---|
| Deterministic tests | 339 passing; real local processes/SQLite/SDK with controlled boundaries included. |
| Mock integration | 23 scripted scenarios pass; no model performance/quality result. |
| Browser/process verification | Passed representative offline fixture journeys and dev/production process checks. |
| `npm run smoke:llm` | SKIPPED: `LLM_API_KEY absent`; exit 1; no compatibility established. |
| Live LLM + synthetic search: `npm run eval` | BLOCKED: `LLM_API_KEY absent`; exit 2; scenarios untested. |
| Recorded-search evaluation | Not run: no actual Tavily captures or successful real-model generation. Checked-in cassettes remain synthetic. |
| Fully live: `npm run eval -- --live --only C1,D1,F1` | BLOCKED: `TAVILY_API_KEY absent`; exit 2, before requests. This subset alone would not satisfy full P0 acceptance. |
| Manual live answer review | No real answers available; semantic support/conversational quality untested. |
| Model comparison | Not completed. Luna untested; Terra pairing guarded; optional DeepSeek/OpenRouter previous 402 unresolved. All P0/P1 rates, inference latency, usage/cost and tool reliability unknown. |

No numerical model score, live search correctness, semantic grounding, conversational quality, measured bill or default-model winner is claimed. `gpt-6-luna` remains provisional. Runtime logs cover startup/recall failures; detailed request/event traces exist in evaluation JSON rather than a production trace archive. This is an acknowledged observability limitation, not a newly added tracing system.

## Acceptance audit

“Verified offline only” means controlled code/fixture evidence, not proven model compliance. “Blocked” requires provider access or an owner decision. “Not verified” has no supporting observation. The following maps the approved C/F requirements, N evaluation gates and R/U/V/W deliverables.

| # | Requirement | Classification and evidence |
|---|---|---|
| 1 | Node startup (F12) | **Verified offline only**: clean dev/prod page/health and fake-provider process turns; real credentials unverified. |
| 2 | One model-visible web-search tool (F3) | **Verified**: one definition/validated contract; no memory/fetch tool. Actual model calling blocked. |
| 3 | Persistent conversations (F1) | **Verified offline only**: transactions, restart, CRUD/cascade tests. |
| 4 | Historical recall (F4/F6) | **Verified offline only**: SQL/FTS/raw context and browser navigation; live interpretation blocked. |
| 5 | Temporal resolution (F5) | **Verified**: deterministic English/IANA/DST/candidate rules and tests. Unsupported expressions remain out of scope. |
| 6 | Honest missing history (F6) | **Verified offline only**: explicit context/prompt and scenarios; real-model abstention unproven. |
| 7 | Evidence ledger (F7) | **Verified offline only**: original/fresh IDs/dates, atomicity, deletion behavior. Real Tavily evidence absent. |
| 8 | Citation validation (F8) | **Verified** within mechanical scope; numerical tokens/source markers, not semantic truth. |
| 9 | Search budgeting (F3) | **Verified** in controlled executions, including timeout and noncooperative fake search. Actual provider behavior blocked. |
| 10 | Streaming/cancellation (F2) | **Verified offline only**: browser, socket/SDK and persistence; real provider abort behavior untested. |
| 11 | Recovery (F2/L) | **Verified offline only**: duplicates, saved retry identity, orphaned user, partial/restart and dropped acknowledgement. No resumable stream/exactly-once claim. |
| 12 | Evaluation coverage (N) | **Verified offline only**: all 19 original rows plus four extensions; 23 mocks, no live P0 pass. |
| 13 | Clean-clone setup (F12) | **Verified offline only**: install/config/start/build/test/seed/eval paths; valid-provider behavior blocked. |
| 14 | One-page DESIGN (V) | **Verified** at stated A4/Letter print settings and visually inspected. |
| 15 | Final README | **Verified**: commands exercised; external-provider commands accurately stop as blocked. |
| 16 | Technical interview notes (U) | **Verified** artifact with implementation references; owner understanding **not verified**. |
| 17 | 60-second script (W) | **Verified** 149-word artifact/outline; actual owner delivery **not verified**. |
| 18 | Live model compatibility | **Blocked** by missing compatible account access; Terra pairing mismatch remains. |
| 19 | Live search correctness | **Blocked** by missing Tavily key and real-model integration. |
| 20 | P0 live acceptance (C/N/R) | **Blocked**; 11 P0 mock passes are not live acceptance. |
| 21 | Bake-off / explicit limitation (N.4) | **Verified documentation of limitation**; comparison itself **blocked**, no approved winner. |

F9 change/recheck policy is implemented and **verified offline only**, not a deterministic semantic guarantee. F10 labelled explicit seeding and F11 clock warnings/banner are **verified offline only** in processes/browser/tests. Public repository visibility was read as `PUBLIC`. Performance/cost/conversation-quality targets are **not verified**. Owner teach-back and video delivery are **not verified**. Auth/multi-user, embeddings, summaries, extra model tools, structured price extraction, page crawling, resumable streams and automatic video/application submission remain **deliberately out of scope** under §S and the current instructions.

## Before submitting to minimi

1. Privately configure valid `LLM_API_KEY` and `TAVILY_API_KEY` in ignored `.env` (or the shell); leave `REPRISE_NOW` unset for real conversations. Keep the provisional default unless you explicitly approve a change. Do not paste keys into chat or Git.
2. Run `npm run smoke:llm`. Verify actual streaming, tool-call continuation, usage, parallel calls and compatible parameters. If the chosen account/model is unavailable, report that result; explicitly decide how to handle the Terra mismatch or unavailable candidates rather than substituting one silently.
3. Start the app with an isolated review database. Exercise real cited research, historical recall, a current temporal recheck, a no-search conversational turn, and Stop/recovery. Inspect source excerpts, dates, units and each conclusion manually. Neither the scripted browser fixture nor the compatibility smoke establishes actual Tavily correctness.
4. Run the full `npm run eval` with the real compatible model and frozen synthetic inputs, then applicable real Tavily smoke/live scenarios. Record actual outputs and review every P0 answer for recall, temporal honesty, grounding and conversational quality. Automatic lexical checks alone do not close this gate.
5. Follow [evals/README.md](../evals/README.md) to record/review real search cassettes in a separate directory and compare genuinely accessible approved candidates on identical frozen inputs. Use P0 success, then median latency, then estimated cost from real usage; retain unknowns. If only one compatible model is accessible, validate it thoroughly and explicitly report that no comparative bake-off occurred. Owner approval is required before changing the default.
6. Update this checkpoint with actual live results and unresolved failures. Practice the [file walkthrough](interview-notes.md#concise-file-walkthrough) and script in your own words. Record and submit the video/application yourself only after the critical acceptance gates are satisfied.

## Short technical walkthrough

Open `main.ts` and `app.ts` to show one-process startup and validated routes. Follow `turns/service.ts` for save-before-generation, replay and abort ownership. Show `time/resolve.ts` and `memory/recall.ts` selecting supported dates and retrieving original messages; a title is only an index hint. Follow `runTurn.ts` → `modelStep.ts` → `researchRound.ts` for one tool, draft reset, parallel work and hard research limits. Show observation identity in `sourceRegistry.ts`, the deliberately narrow checker in `citations.ts`, then `repo.ts`'s atomic save. End with `Thread.tsx`'s canonical reconciliation and the evaluation JSON: scripted execution is inspectable, while real language quality remains a separate unpassed gate.

## Git delivery

Reviewed normal commits, preserving public history:

- `ffa44f6` — Preserve answers across deletion and retry recovery.
- `72a1467` — Keep unused repository helpers private.
- `dd7b46b` — Keep recovery regressions safe on failure.
- `5a9e396` — Finalize architecture and setup documentation (also drains unexpected regression-test responses).

The implementation/documentation candidate was pushed normally to `origin/main`; no force push or history rewrite was used. Staged diffs and configured-secret-value scans were reviewed before commits; no credentials, `.env`, SQLite data, raw reports, logs, temporary rendering code or browser artifacts were staged. This final checkpoint is delivered by a following normal documentation commit; its exact final HEAD/push/clean-tree result is reported in the final response. No further implementation milestone is started.
