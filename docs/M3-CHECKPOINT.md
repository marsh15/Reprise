# M3 checkpoint — Temporal memory, recall and honest abstention

Date: 11 November 2026. Starting state: clean `main` at `7094d21`, remote `https://github.com/marsh15/Reprise.git`.

**M3 implementation and deterministic verification are complete. Live-model acceptance is blocked by missing credentials. M2 live-provider acceptance and the bake-off remain outstanding; no model winner was selected. This is the M3 stopping point, not approval to start M4 or a submission-readiness claim.**

## Implemented behavior

- Pure `resolveDates(text, now, tz)` uses `TZDate` and calendar operations in the user's timezone. It returns ordered structured candidates for local days, strictly past weekdays, ambiguous last weekdays, named dates, relative ranges, weeks/months, since-ranges and last mentions. Monday starts the week; this month ends at today, last month covers the complete calendar month. Numeric dates remain unsupported. Invalid dates, incidental month words and date-looking domains are ignored.
- Recall runs before model invocation using existing SQLite local-date indexes and FTS5. It retrieves raw user messages and the latest reply attached by `reply_to`, across conversations. BM25 selects topic results, with recency ties; selected correction records are presented chronologically. Previous recommendations and assistant-only topic matches are retrievable without extraction or summaries.
- Ambiguity selection checks both candidate ranges for any turns and topic matches. A unique topic match wins; both matches choose the recent candidate and note the other. Without topic matches/terms, the latest populated candidate wins with appropriate disclosure. Empty candidates remain `chosen: null`, with explicit no-record notes. Topic matches from another day never establish the requested date.
- Current submission and its retry attempts are excluded from historical evidence. Up to 20 earlier messages, a 30-entry conversation index and history start are supplied. Pronoun references can carry terms from the preceding user message. The index is explicitly not evidence of what an answer said.
- Each recalled answer has up to six associated observations, cited first, then rank and stable original-marker order. Recent cited carry remains bounded to eight observations from the last two assistant replies. Historical excerpts are capped at 600 characters, historical assistant text at 4,000, with explicit truncation markers; original stored rows remain unchanged.
- The recall context is bounded to 24,000 characters. The implementation measures conservative marker widths with a 100-character reserve. Trimming follows the approved order: index to 10, topic turns, carried sources, per-turn observations to three, recalled assistant text to 1,500. Every trim is noted. Up to six date-matched turns per resolution are selected, with a `+N more` disclosure. Selected date-matched user text is never silently clipped or dropped.
- When protected evidence still cannot fit, the owner-approved path asks a focused clarification and bypasses the model/search. It explicitly explains that records were not included; raw storage is intact. Oversized resolution metadata is also removed from that clarification packet. Cancellation before this path emits no text.
- The static prompt requires no-record disclosure, history-start disclosure, fixture acknowledgement, chronological corrections and explicit distinction between historical and current evidence. It forbids web searches to reconstruct private conversations and forbids rechecking an unavailable historical answer. A separately named current topic can still be researched, without inventing a historical price or asserting a change.
- The exact §H.5 recheck regex adds `task_hint` only when actual turns were recalled. The only model-visible tool is still `web_search`. No embeddings, summaries, memory service, memory tool, routing model or application subagent was added.
- `RecallChip` exposes conversation title, calendar date and a demo badge. Clicking loads the referenced conversation, scrolls/focuses the original user message and highlights it for two seconds. Same-conversation jumps work, deleted targets produce an error, and recall pointers persist on the assistant row for reload.
- Explicit `seed:demo` creates CRM, Postgres, Node/Bun and weekend fixtures. Conversation origin, title, raw messages, source flag and excerpt prefix identify demo data. Relative dates use the supplied timezone and centralized clock. Duplicate seeding refuses changes; `--reset-fixtures` replaces only fixture conversations in one transaction. Live rows survive; a failure rolls the entire reset back. Fixture timestamps differ by deterministic seconds to make same-day ordering reproducible.

## Architecture and data flow

1. The turn service persists the user submission using existing idempotency/locking rules and emits `turn.started`.
2. It passes the centralized clock instant and request timezone to recall. The resolver produces candidates; repository SQL determines candidate matches, raw turns, associated evidence, recent context, index and history start.
3. Recall applies selection and budget rules, then the service emits the validated `recall` event. The runner receives one required `RecallPacket` plus `userText`, signal and emitter. There is no fallback memory/context implementation.
4. A turn-local registry registers recalled observations first, carried observations next, then current search observations. Recalled source fields contain both `historicalMarker` and current `n`. Observation UUIDs remain immutable; repeated observations are deduplicated by UUID, while a shared canonical URL deliberately shares its turn-local marker under the approved registry rule.
5. The prompt gets raw recent role messages, followed by bounded JSON inside `<context>` and the current raw user message. Angle brackets in context data are JSON-escaped without changing decoded content. Date-recalled messages are omitted from the plain recent replay to avoid duplicating their text. Compact recent-message metadata retains original dates, interrupted/failed status and per-answer source-marker associations.
6. M2's existing bounded model/search loop, reset events, evidence ledger, citation checks, cancellation and atomic final persistence run unchanged. Recall navigation and assumption metadata are appended to the existing message metadata; no schema migration is needed. Fresh-search UI counts only observations belonging to the current turn's searches.

All SQL remains in `db/repo.ts`. `agent/*` does not import the database. The model never executes recall or calendar calculations.

## Significant files

- `src/server/time/resolve.ts`: pure calendar resolution.
- `src/server/memory/recall.ts`, `stopwords.ts`, `context.ts`: deterministic selection, keyword policy, rendering and budget.
- `src/server/db/repo.ts`: date/FTS/source/index queries, atomic fixture inserts and persisted recall pointers.
- `src/shared/memory.ts`, `types.ts`: packet types and validated SSE/navigation contracts.
- `src/server/turns/service.ts`, `agent/runTurn.ts`, `prompt.ts`, `sourceRegistry.ts`: integration and provenance.
- `scripts/seed-demo.ts`, `scripts/fixtures/demo.json`: explicit reproducible demo history.
- `src/client/components/RecallChip.tsx`, `Message.tsx`, `Thread.tsx`, `ResearchStatus.tsx`, `App.tsx`, `state.ts`, `recall.css`: presentation and navigation.
- `evals/memoryScenarios.ts`, `run.ts`, `scenarios.ts`, `search-cassettes/F2.json`: M3 scenario setup, recall assertions and labelled synthetic current evidence.
- `tests/unit/{resolve,recall,memory-context,recall-ui}.test.ts`, `tests/integration/{memory,seed}.test.ts`: primary new verification.

## Exact verification and results

Baseline Node 26.10.0: `npm run typecheck && npm test && npm run build` passed **20 files / 158 tests** before implementation.

Final native commands:

```bash
npm run typecheck
npm test
npm run build
npm run eval -- --mock
npm run eval -- --mock --only A1,B1,F1,F2,H1
npm run eval
REPRISE_TEST_PRODUCTION=1 npx vitest run tests/integration/server.test.ts
```

- Type checking: passed, strict TypeScript.
- `npm test`: **26 files / 270 tests passed**, including **64 date-resolution cases**. The final native run took 10.00 seconds; runs during development ranged roughly 9–19 seconds. The plan's under-10-second target is not consistently met on this host.
- Production build: passed; approximately **493.18 kB JS / 149.83 kB gzip**, **6.00 kB CSS / 2.02 kB gzip**.
- All **13 mock scenarios passed**: A1, B1, F1, F2, H1, D1, E1, E2, I1, I2, L1, G1, K1. The five-scenario M3-only command also passed. Mock scripts exercise real service/SDK/context/search-replay/persistence integration; their language is scripted and is not live-model proof.
- `npm run eval`: **exit 2, `BLOCKED: LLM_API_KEY absent`**. No generated answer, live model score, latency/cost score or live honesty result is claimed. Safe presence-only checks also confirmed the Tavily key is absent. No unrelated M2 provider probes/bake-off were repeated.
- Production-process regression: **1 passed**, using actual HTTP/server/SDK subprocesses with a local fake provider. The application restarts and existing conversations persist. Additional on-disk reopen tests verify M3 recall pointers, historical observations and FTS recall survive a restart.

Actual Node **24.22.2** verification uses the installed binary (not Node 26 pretending to be Node 24):

```bash
NODE24=/Users/santoshkumar/.npm/_npx/387698761821791d/node_modules/node/bin/node
"$NODE24" node_modules/typescript/bin/tsc --noEmit
"$NODE24" node_modules/vitest/vitest.mjs run
"$NODE24" node_modules/vite/bin/vite.js build
REPRISE_TEST_PRODUCTION=1 "$NODE24" node_modules/vitest/vitest.mjs run tests/integration/server.test.ts
```

Type checking, the complete suite, build and production-process check pass on Node 24. The final Node 24 full suite passed 26 files / 270 tests in 15.86 seconds, and the production-process check passed in 3.44 seconds.

Additional checks:

- `npm install date-fns @date-fns/tz`: only approved §Q dependencies added; audit reported zero vulnerabilities. Installed versions are date-fns 4.4.0 and @date-fns/tz 1.5.0. Constructor/timezone semantics were checked against the [official TZDate documentation](https://github.com/date-fns/tz). No new LLM/search API parameters were introduced.
- `npx vitest run tests/unit/resolve.test.ts tests/integration/memory.test.ts`: passed targeted calendar/cancellation verification. Full suites include all later tests.
- `seed:demo` is executed by isolated child-process tests against temporary files without API credentials: four labelled conversations, duplicate refusal, targeted reset, safe reopen and cross-month/year relative dates. No normal-startup seed occurs and no real local database was seeded or reset.
- Browser fixture: `node --import tsx tests/helpers/memoryPreview.ts`. Actual React/Hono/SQLite/SDK with fake model/search. Verified demo chips, recall before answer, persistent chips after reload, cross- and same-conversation jumps, matching focused/highlighted user message, highlight removal, deleted-target error, source rendering and a **390 × 844** layout with `scrollWidth === clientWidth === 390`.
- Repeated browser research with remembered sources reports **1 search · 1 source**, excluding historical observations from the fresh-search count. The browser helper reuses an existing marker when the same current URL was already recalled; integration tests independently verify actual registry behavior.
- T3 preview initially navigated before fixture startup; retry succeeded. Later repeated snapshots failed with `Preview snapshot failed: Preview automation snapshot timed out after 15000ms.` The installed Playwright CLI completed the remaining checks. Expected console errors were the absent favicon and deliberately stale/deleted conversation requests; no React runtime exception was observed.
- `git diff --check` passed. All added/modified source and test files are below 300 lines. Only the centralized clock reads real time in server source. No credentials, SQLite files, generated reports or browser artifacts are tracked.

## M3 evaluation outcomes

| Scenario | Deterministic evidence | Live model |
|---|---|---|
| A1 | Same-chat first-topic recall includes Neon; scripted answer makes zero searches | Blocked |
| B1 | Both 3 November turns selected, 4 November excluded; scripted answer names both; zero searches | Blocked |
| F1 | No historical turns; explicit no-record dates and history start; scripted honest reply; zero searches | Blocked |
| F2 | No past Tuesday record or historical baseline; synthetic current pricing is separately retrieved/cited | Blocked |
| H1 | Postgres topic selects 3 November over 10 November; assumption and fixture labels supplied and acknowledged by script | Blocked |

Unit/integration tests also cover both Tuesday topic matches, neither topic match, no topic terms, both empty, multiple conversations/day, date/topic mismatch, source priority/caps, chronological corrections, latest reply attempts, failed memory queries, all trimming stages, protected overflow and early cancellation. Existing M0–M2 search, budget, injection-containment, citations, retry, stream, disconnect and persistence tests remain green.

## Review, simplification and deviations

Main-agent review traced candidate selection, time boundaries, FTS pairing/ranking, provenance, context sizing, partial responses, deletion and the streaming lifecycle. Terra 6.1 Medium was used only for the independent date test table, fixture JSON and recall UI, with exact file ownership. All changes were reviewed; no helper owned recall, SQL, prompt, calendar algorithm or agent integration.

Resolved review findings:

- Corrected the plan's DST example with owner approval: New York at `2026-11-02T03:30Z` is still 1 November, so yesterday is **31 October**.
- Recorded owner rulings for unmatched-topic candidate fallback and protected-evidence overflow directly in the plan.
- Prevented the current user request from establishing its own supposed historical memory; excluded prior retry attempts from that request's history.
- Avoided interpreting an index title or a different date's topic match as an original answer.
- Preserved observation UUIDs/times and explicit historical-to-current marker mapping. Deduplicated the same observation entering through recall and carry.
- Added recent interrupted/failed status and source-reference annotations; raw message content remains authoritative and is supplied once.
- Fixed fresh-search summary counts so recalled sources are not presented as newly retrieved. This narrowly corrects an M2 presentation assumption directly exposed by M3; no unrelated M2 work was added.
- Made fixture order stable across resets, bounded excessive resolution metadata, rejected date-like domains and honored cancellation before clarification.
- Simplified the runner to one required packet contract, removed redundant context arguments/fallbacks and the one-line renderer wrapper, and removed an unused source-query option. Function-specific date-fns imports avoid loading the whole barrel in every child process.
- Adjusted only subprocess-test timeout budgets after cold concurrent startup exceeded the old five-second timeout; no application deadline was relaxed.

The approved architecture is unchanged. No database migration or infrastructure was added. Additional cohesive files beyond the illustrative §Q list are justified: `memory/context.ts` shares one serialization/budget policy without a memory→agent dependency; `shared/memory.ts` separates memory contracts from research contracts; `evals/memoryScenarios.ts` isolates scenario setup; focused test/browser helpers provide repeatable verification. The renderer is re-exported as `buildContextBlock` by the prompt module.

## Remaining risks and outstanding M2 items

1. Model compliance is probabilistic. Supplying no fabricated records and strict prompt rules is not a proof that a live model never fabricates language or over-searches. Live F1/F2/H1 and the complete acceptance suite remain necessary. Mock passes are not a substitute.
2. Keyword/Porter FTS has paraphrase gaps and broad OR-term matches. It does not establish semantic equivalence. Dates, raw records and mismatch notes constrain interpretation; embeddings/summaries were deliberately not introduced.
3. The 24k cap covers the recall context block, not the separate latest-20-message replay, current raw user text or later bounded search transcript. Long recent turns can still make a large provider input.
4. Same canonical URL deliberately shares one turn-local marker across observations. Every UUID/excerpt/retrieval time remains in the ledger; the citation's canonical observation/card can be the earlier observation. This inherited M2 behavior is not proof of which dated observation supports a semantic claim. Numerical checks still verify token presence, not meaning, truth or comparability.
5. History start includes fixtures when fixtures are present. Origin labels and prompt rules require that disclosure; fixture dates never establish genuine user history. Reset removes whole fixture conversations, including later additions to them, so real work should use a live conversation.
6. English pattern recognition is intentionally narrow; numeric dates and semantic calendar interpretation are outside scope. Broad historical ranges can scan many local records before packet trimming; this is a single-user local design.
7. M1/M2 operational limits remain: one process per database, hard termination can lose in-flight text, and a SQLite commit cannot be atomic with network delivery. Replay/reconciliation and graceful cancellation remain intact.
8. M2 live acceptance and model bake-off are still pending. OpenAI/Tavily credentials remain absent here. The earlier OpenRouter 402/parallel-parameter mismatch and Terra Chat Completions incompatibility remain documented in M2. No new winner was selected; the provisional application model setting is unchanged.

## Git delivery

Plain-English commits, no rewritten history:

- `ff1bb8f` Resolve calendar references in the user's timezone
- `91f615c` Recall timestamped conversations and their historical evidence
- `93c5f26` Add explicitly labelled demo history with targeted reset
- `cae7fd2` Show recalled conversations and jump to original messages
- `290a3b8` Evaluate temporal recall and missing historical evidence
- `052409b` Keep recalled evidence bounded and fixture ordering reproducible
- `c42ae61` Use one recall packet contract throughout the agent
- `b29c6bc` Reject date-like domains and preserve early cancellation
- `9ca942f` Keep recent answer status and source provenance explicit

All nine listed code commits were successfully pushed normally to `origin/main` (starting at `7094d21`, through `9ca942f`). This checkpoint and setup/evaluation documentation are delivered in the final documentation commit and normal push. The final response records its exact HEAD, push result and clean-tree verification; it is authoritative for post-documentation Git status.

## Concepts and teach-back

1. **Concrete dates:** from Wednesday 11 November, strictly previous Tuesday is 10 November; subtract seven calendar days for the second candidate, 3 November. The timezone determines today before arithmetic begins.
2. **Memory selection:** query both candidates with topic terms. Postgres only on 3 November selects that candidate and names 10 November as the alternative. Both topic matches select 10 November and note 3 November. If answers are equally plausible and differ, the model should ask the focused clarification described by the policy. No records means no selected date.
3. **FTS5:** tokenize and remove date/meta/stop words, keep at most eight terms and form quoted OR terms. FTS5's Porter index matches raw user/assistant text. SQL materializes BM25 hits, maps them to the user turn, takes the best hit and returns the paired original reply. Dates can restrict those hits.
4. **Raw authority:** storage records exactly what was asked/answered and when. A later correction is another chronological record. A summary or extracted fact could erase qualifications or corrections; it never replaces these rows.
5. **Historical sources:** recall follows each answer's source references into the ledger, keeping exact observation IDs and retrieval times. The turn registry renumbers them for this response; current searches append fresh observations. Historical/current labels prevent treating a stored excerpt as a fresh lookup.
6. **False-memory control:** code cannot retrieve an absent row, excludes the current assertion from history, reports missing matches and supplies history start. The prompt forbids inventing the missing answer. Live-model honesty must still be tested; architecture limits evidence invention, it does not guarantee every generated sentence.
7. **No embeddings/summaries:** the target references use dates and named entities. Indexed calendar dates plus FTS are inspectable and reproducible. Fuzzy retrieval would add false-match risks and another dependency; summaries would lose original evidence. Revisit only after measured paraphrase failures, starting with the plan's proposed synonym expansion.

Teach-back: trace a last-Tuesday query from the clock to `reply_to` and source UUIDs; explain both-match versus empty-match behavior; distinguish a conversation title from an original answer; explain what happens when six protected user messages exceed the cap; and describe what mock tests cannot prove about a live model.

**Stop at M3. M4 requires explicit owner approval.**
