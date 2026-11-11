# M5 checkpoint — Reliability, UX and product quality

Date: 11 November 2026. Repository: `marsh15/Reprise`, branch `main`. Starting state: clean `262f60b`, expected `origin` remote.

**M5 implementation and offline acceptance are complete. M2/M4 live-provider acceptance and model selection remain submission blockers. M6 has not started.** This milestone does not establish live-model correctness, conversational quality, latency, cost, or real Tavily compatibility.

## Improvements and engineering decisions

### Streaming, failures and recovery

- The existing POST/SSE contract, single agent loop, SQLite transactions and evidence ledger are unchanged. The client still validates SSE frames with the shared Zod schema, handles fragmented UTF-8/CRLF and heartbeats, and stops reading at the first terminal event.
- `chatReducer` resets the active assistant on each attempt, ignores duplicate starts, ignores events after termination, and checks the completion's assistant ID. A dropped stream marks the visible partial answer interrupted. Failed/stopped attempts remain visible and explicitly incomplete; retry creates another assistant attempt against the same saved user row.
- `Thread` retains its request guard through the authoritative transcript refresh. Previously it released that guard before the GET returned, allowing a newer turn to race a stale transcript replacement. Composer submission stays disabled during reconciliation; typing remains available. Callback ownership and mounted checks keep old work out of a newly selected conversation.
- Transcript loading now has a distinct recoverable failure state. Failed loads do not look like an empty chat and cannot accept a turn into an unknown transcript. Conversation-list loading/unavailability also differs from a genuinely empty database. The seed tip appears only after successful confirmation of empty history.
- The small session outbox now recovers unacknowledged submissions in existing conversations as well as new ones. It retains the original request UUID and text until `turn.started`. Retrying an ambiguous submission asks the server to recover/replay that identity; an acknowledged failed attempt uses `retryOfUserMessageId`. Browser storage failures do not prevent sending or navigation, although refresh recovery of an unacknowledged request needs working storage.
- Stop aborts the local request before acknowledgement and uses the existing cancellation endpoint afterward. The fallback captures the original controller, so an older failed cancellation cannot abort later work. Changing conversations aborts the outgoing stream; it does not leave background research running by design.
- Parser and transport diagnostics become concise recovery messages. A lost terminal event means completion was **not confirmed**, rather than asserting that the server failed to save. A subsequent GET proving that the active answer is complete clears the connection warning and avoids a spurious Retry. Other failed/interrupted attempts retain their warning.
- Initial transcript GETs have a 10-second client bound; post-turn reconciliation has a 5-second bound. A stalled refresh therefore releases the submission guard while preserving the visible transcript and draft. A failed refresh keeps the transcript and tells the user to reopen the conversation to retrieve saved messages, including a completed replay whose text was not streamed again. These bounds do not change research/model deadlines or add automatic model retries.

### Conversational feedback and restrained polish

- One persistent polite live region distinguishes Sending, Thinking, Researching, Writing and completion. It is outside the transcript's loading busy state; token deltas do not repeatedly announce the whole answer.
- Active research displays at most two shortened pending query labels plus a remaining count. The expanded final list retains complete queries, results, dates and failure details. Authentication/quota failures are visible in the collapsed summary, without requiring a technical trace.
- Existing no-search turns retain no research panel. Search/source counting continues to exclude observations carried from earlier answers. Parallel search durations remain elapsed time, not a sum.
- Saved messages show their dates, making older discussions easier to interpret. Pending optimistic rows do not invent a frozen-clock timestamp. Recall chips, original fixture text, source fixture flags and sidebar demo labels remain intact.
- Scrolling follows an answer while the reader is near the bottom; scrolling upward is respected. The composer grows to eight 24px lines plus padding/borders (218px), then scrolls. Enter, Shift+Enter and composition handling remain intact.
- The 260px sidebar, 768px breakpoint, 760px content limit, system fonts, neutral surfaces and green accent remain. Focus/recall colors now share that accent. Disabled buttons remain readable, navigation targets are larger, and source cards stay within the tested viewport bounds.
- The shell uses flex sizing within the dynamic viewport. The clock banner and global errors consume their actual height, replacing the fragile fixed 36px banner subtraction. The existing yellow `Test clock active: now = …` banner remains explicit when `REPRISE_NOW` is active.

### Dated citations and evidence context

M4 correctly identified that a URL can have multiple observations sharing one marker. The backend intentionally retains separate UUIDs/excerpts/retrieval dates, while its numerical checker combines observations under that marker. Showing only the canonical observation's date could falsely associate a claim with that date.

M5 makes a narrow presentation correction:

1. Match the card's canonical source by the citation's source UUID, not array order.
2. Show **every supplied observation for the marker**, each with publication/retrieval dates and its own demo flag. Label whether it was searched for this answer or preserved from an earlier answer.
3. For multiple observations, show short excerpt previews and explain that the marker does not identify which observation supports each claim. The verified-state explanation explicitly says meaning and the supporting date were not checked.
4. Preserve verified/unverified/unchecked/invalid distinctions, dotted unverified pills, safe external links, and unavailable-source handling. Deletion does not silently replace a missing canonical source with newer evidence.

This deliberately does not redesign marker numbering, the checker, persistence or model context. It exposes the ambiguity accurately; it does not solve per-sentence semantic or temporal attribution. Publication dates still do not establish event/effective dates. The card is a labelled group rather than an ARIA tooltip because its title is an interactive link. Excerpt previews truncate at 180 characters with an ellipsis; raw ledger evidence is unchanged.

## Accessibility and responsive verification

One isolated Terra 6.1 High task owned `Sidebar.tsx` and `sidebar-ui.test.ts`; the main implementer reviewed and integrated it, then performed browser checks. The sidebar uses one navigation tree for desktop and mobile. Its mobile dialog moves focus inside, traps Tab/Shift+Tab, makes the background inert, restores trigger focus on close and releases it on a desktop resize. Escape closes an options menu before the drawer; outside pointer/focus interaction dismisses options. The existing native destructive confirmation remains, with focus returned to New chat after a completed deletion.

Other improvements: a skip link and named main/navigation landmarks; composer instructions linked to its input; persistent live status and inline alert errors; keyboard-focusable, scrollable Markdown table regions; source-card keyboard scrolling and Escape restoration to the pill; linked source titles that remain tappable when a mobile card covers its inline marker; reduced-motion support; and touch citation targets of at least 28px, with 44px navigation/menu targets. Inline citation targets deliberately remain smaller than navigation buttons.

Actual verification used Chrome through the existing Playwright CLI. T3 preview opened, but two snapshots returned `Preview automation snapshot timed out after 15000ms.` The fallback was used after those failures. Screenshots, accessibility-tree snapshots, keyboard events, touch emulation, DOM assertions and controlled response interception were exercised. No new test framework or dependency was installed. Console diagnostics included expected failed/404 requests, the existing missing favicon, and one Fast Refresh dependency-array warning while editing an effect; a full reload removed that development warning and it did not recur in the stable-flow checks.

Performed browser checks:

- Fresh in-memory database: explanation, three example queries, honest empty navigation and labelled-demo seed tip. Existing/failed history is not asserted empty.
- Real React/Hono/SQLite/SDK fixture path: first send, streaming draft reset/research/answer, follow-up, completion, collapsed/expanded research, empty/auth/quota outcomes, invalid and unverified citations.
- Stop/Escape, drafting during a response, retained draft after Stop, incomplete outcome label, Retry without another user row, and retained previous attempt. Model 503 failure and retry are recoverable.
- Refresh after a partial delta persists interrupted text; switching during generation leaves the new chat intact. Process tests separately verify server restart/shutdown durability.
- Network loss before acknowledgement, reload recovery in both new/existing conversations, and server-accepted-but-unacknowledged replay without duplicate turns.
- Removal of an actual completion frame after server persistence: canonical reload clears the warning. Holding a canonical GET verifies the send guard; stalling it beyond the bound verifies release without draft loss. Throwing browser storage methods does not break chatting.
- Citation hover/focus/Escape, focus into a long card, return to the pill, distinct retrieval dates and historical/current labels on repeated same-URL research, and persistence after reload.
- Drawer initial focus, forward/reverse Tab wrapping, inert background, nested Escape order, focus restoration and resizing back to desktop. Native delete confirmation dismissal retains the conversation; acceptance removes it and its evidence (API subsequently returns 404).
- Seeded-memory fixture: demo chip survives reload; cross-conversation and same-conversation recall focus/highlight the original user message; highlight expires; original fixture text remains explicitly illustrative. Saved message dates are visible. A deleted recall target produces one clear loading alert and disables sending, rather than duplicate error messages.
- Chrome touch emulation (`isMobile`/`hasTouch`, coarse pointer) at 390px: drawer taps, metadata inspection, a **31.75×28px** citation target and opening the source via its linked card title passed. This directly reproduced and resolved the card-over-marker obstruction.
- Layout bounds at **1440×900, 1024×768, 768×1024, 390×844 and 320×568**: no document horizontal overflow, composer within the viewport, citation cards within horizontal bounds. At 320px, a 14-column Markdown table scrolls with the keyboard, a long URL wraps, and an eight-line composer still ends at viewport height 568. At 390px the recall flow has `scrollWidth === innerWidth === 390`, composer bottom 844.

Contrast calculations for the reviewed palette: body **14.86:1**, secondary **6.74:1** (sidebar **6.22:1**), citation link **7.41:1**, primary button **6.78:1**, disabled button **4.84:1**, banner **8.73:1**, errors **8.40:1**. The strengthened textarea boundary is **3.72:1**. The rendered document has `lang=en`, one main and a labelled navigation landmark.

Limitations: no Lighthouse/axe installation or score, spoken VoiceOver/NVDA session, physical iOS/Android keyboard, Safari/Firefox run, native OS high-contrast run, or actual browser-chrome 200% zoom measurement. Narrow viewport reflow and Chrome touch emulation are useful checks, not claims about every browser/assistive technology. No general WCAG certification is claimed.

## Failure-mode matrix audit (§M)

Every Eval-marked row has automated evidence; all 33 rows were reviewed. Existing handling was retained where its focused tests already covered the boundary. Model-language assertions below use scripted mocks and do **not** establish live compliance.

| Row | Handling / actual automated or browser evidence |
|---|---|
| 1 ✓ | Empty recall/history start: `memory.test.ts`, mock F1/F2; no private-history web reconstruction. |
| 2 ✓ | Date exists/topic absent: recall mismatch units, mock B2. |
| 3 ✓ | Multiple matches: recall ranking/alternative units, mock H2. |
| 4 ✓ | Several date turns: recall same-day units, mock B1. |
| 5 ✓ | Wrong past answer: `recheck.test.ts`, mock C3 and negative assertion tests. |
| 6 | Correction chronology: recall units, mock J2. |
| 7 | Context caps/clarification: `memory-context.test.ts`, recall limits and integration clarification. |
| 8 ✓ | Restart: on-disk repo/memory and actual `server.test.ts` process restart; orphan replay/retry in `turns.test.ts`. |
| 9 ✓ | Tuesday ambiguity: date/recall units, mock H1/H2. |
| 10 ✓ | User/server timezone difference: resolve/recall units and server process local-date assertion. |
| 11 | Cross-year/DST: existing 64-case date suite. |
| 12 ✓ | Missing historical snapshot: mock C2/F2 and recheck assertions. |
| 13 | Date roles: mock T1; browser cards show published and retrieved separately, including multiple observations. |
| 14 ✓ | Empty search: parser/research integration, browser empty status. |
| 15 ✓ | Timeout/5xx: Tavily timeout/network/5xx bounded-retry units, non-cooperative research integration, mock I1. Retry stays within the search time bound. |
| 16 ✓ | Quota/auth: Tavily 401/403/429/432 units, research integration, new collapsed-summary units and browser checks. |
| 17 | Malformed search: Tavily parser/research integration, mock I2. |
| 18 ✓ | Conflicting evidence: mock G1; live semantic handling still pending. |
| 19 ✓ | Prompt injection: sanitizer units, research untrusted-data integration, mock L1. |
| 20 ✓ | Invented citations: checker units and rendered `[?]` tests/browser. |
| 21 ✓ | Missing numbers: checker units, UI dotted-state/limited-verification tests, mock K cases. |
| 22 ✓ | Billing/unit confusion: mock K1/K2/K3 and pricing assertion tests; semantic equivalence remains a model task. |
| 23 | Runaway loop: research per-round/turn/deadline integration and defensive final-step tests. |
| 24 ✓ | Unnecessary searches: mock A1/E1/E2 and memory scenarios assert zero searches. |
| 25 ✓ | Model timeout/5xx: configured SDK retry/timeout units, failed/truncated model-step integration, persisted failure/retry service tests, browser 503. No real provider timeout run. |
| 26 | Refresh mid-stream: actual browser partial/refresh/reload and process socket-loss persistence. |
| 27 | Duplicate submit: repo UNIQUE and service/API duplicate/replay/conflict tests; browser lost-ack replay. |
| 28 | Second send: active-turn API 409; browser submission guards during stream and canonical GET. |
| 29 | Cancel during search: research abort integration, partial/ledger persistence, browser Stop and refresh. |
| 30 | DB write failure: forced-trigger rollback tests in repo/evidence/turns; saved user survives and can retry. |
| 31 ✓ | Invalid config: config units and real temporary-directory preflight processes (missing keys/template/valid local prerequisites). No successful live clean-clone run is claimed. |
| 32 | Ignored tool-choice/malformed JSON: research/model protocol integration; invalid tool results and defensive failure. |
| 33 ✓ | Absent memory fabrication: mock F1/F2, memory boundary/absence assertions; live honesty remains pending. |

Concurrency remains local/single-user. Intentional non-goals such as multi-user coordination, database corruption repair and API rate limiting were not added. Existing transaction/cascade/source-provenance coverage remains passing.

## Tests actually run

Baseline before edits: **322 tests / 32 files**, strict TypeScript, production build and all **23 mock scenarios** passed on Node 26.10.0.

Final implementation checks:

| Check | Result |
|---|---|
| Node 26.10.0 `npm run typecheck` | Passed |
| Node 26 `npm test` | **336 tests / 33 files**, including 253 unit and 83 integration tests |
| Node 26 `npm run build` | Passed; JS 499.56 kB / 151.80 kB gzip, CSS 7.26 kB / 2.37 kB gzip |
| Node 26 `npm run eval -- --mock` | **23/23**, 11 P0 + 12 P1 |
| Node 26 production-server process regression | **1/1** after build, local fake provider |
| Actual Node 24.22.2 strict TypeScript/full suite/build/mock suite | Passed; **336/336 tests**, **23/23 mocks** |
| Node 24 production-server process regression | **1/1** after build |
| `npm run eval` (live LLM replay entry point) | **Blocked, exit 2: `LLM_API_KEY absent`**; no live generation |
| `git diff --check` | Passed |

Commands use the actual installed Node 24 binary at `/Users/santoshkumar/.npm/_npx/387698761821791d/node_modules/node/bin/node`, invoking `typescript/bin/tsc`, `vitest/vitest.mjs`, `vite/bin/vite.js`, and `--import tsx evals/run.ts --mock`. Node 24 full-suite runs used `--maxWorkers=4`; the ordinary Node 26 `npm test` command also passed. Production process checks use `REPRISE_TEST_PRODUCTION=1` with `tests/integration/server.test.ts`.

Two simultaneous full suites plus Chrome initially caused preflight/process-startup timeouts. Serial reruns passed; no product timeout or assertion was weakened to hide the resource contention. Targeted regressions were rerun after fixes. Browser-check scripts were corrected where they incorrectly assumed an empty composer enables Send, reused conversation titles, or tried sending before transcript loading finished. These were verification-script assumptions, not evidence of successful product flows until the corrected checks passed.

New automated coverage: duplicate/late/mismatched terminal events; interrupted partials; safe parser/transport messages; first-terminal SSE parsing; confirmed-persistence warning clearing; multiple dated observation rendering; auth/quota summary visibility; bounded progress text; drawer semantics and truthful loading/unavailable history. Dynamic browser behavior is documented above rather than represented by static-rendering tests as though those tested focus.

Final full-suite durations were 9.41 s on Node 26 and 8.90 s on Node 24; these are test execution times, not model latency.

The new `tests/helpers/qualityPreview.ts` is a standalone, offline fixture harness for these checks: real API/agent/SQLite with scripted model/search outcomes, fresh in-memory data and an explicit clock. Launch with `node --import tsx tests/helpers/qualityPreview.ts`. The existing `memoryPreview.ts` provides labelled seed/recall checks. These are test helpers, not application modes or production features. Generated reports, interception scripts, logs and screenshots stay ignored and uncommitted.

## Significant files and simplification

- `App.tsx`, `Thread.tsx`, `state.ts`, `api.ts`: request ownership, recovery, canonical reconciliation, loading/error/clock feedback and optional storage.
- `Sidebar.tsx`, `Composer.tsx`: drawer/menu focus, accessible navigation, keyboard instructions and measured composer growth.
- `Message.tsx`, `Citation.tsx`, `ResearchStatus.tsx`: dated evidence context, visible outcome/progress, safe source interactions and accessible table scrolling.
- `styles.css`, `research.css`, `recall.css`: actual-height shell sizing, viewport bounds, focus/contrast/targets and one accent.
- Focused client/research/sidebar unit tests and `qualityPreview.ts`: bounded verification without another framework. The new helper is justified beyond §Q's illustrative layout by reproducible offline browser fault injection.

Explicit simplification review removed a duplicate citation lookup, consolidated disabled-state predicates and merged duplicate CSS overrides into their original rules. The implementation reuses the reducer, existing request ref and keyed thread lifecycle; it adds no global store, hook library, generic focus manager, design system, database migration or server refactor. Changed application files remain below 300 lines. Deleted-target handling also avoids redundant recall/loading alerts. Source excerpts are presentation previews, not another memory representation. No dependencies or lockfile changes; no LLM/Tavily parameters changed, so no new external API compatibility claim is needed.

Accessibility is functional in an agent interface: users must be able to notice work, stop it, inspect evidence, recover from failure and return to the correct question using a keyboard. This is why work went into focus and status behavior rather than extra panels, animation or settings. The existing compact design makes the architecture visible without exposing execution internals.

Requested `right-skill-picker` was not installed/found; the available accessibility and Playwright skills were used. The running main harness is GPT-6.1-sol High (also permitted by the master plan), not Sonnet; this was disclosed before implementation. The sole delegated task used the requested `gpt-6.1-terra` with `reasoningEffort=high`, checked against the T3 catalog. No provider/API migration was made to work around model availability.

## Remaining submission blockers and limitations

- Safe presence checks still report **`LLM_API_KEY` absent and `TAVILY_API_KEY` absent**. No values were printed or committed.
- The optional OpenRouter candidate's **M4 HTTP 402** remains unresolved; M5 did not repeat chargeable/provider probes or assume credits were repaired.
- The existing **Terra Chat Completions versus Responses API tool compatibility guard** remains. An explicit future owner decision is needed if that mismatch still applies.
- Real model streaming/tool generation, real Tavily research, semantic grounding, human conversational review, recorded-search evaluations, P0 live acceptance, and latency/cost bake-off remain unestablished. Mocks and browser fixtures cannot select a winner or satisfy these gates. The provisional application model was not changed.
- Same-URL observations still share a marker; the interface discloses the limitation rather than pretending to attribute each sentence to a particular date. Recall's existing lexical/context limits remain. Refresh interrupts a turn rather than resuming its SSE stream.

## Git delivery and stopping point

Implementation commit: `6e4a2eb` — Improve chat recovery and evidence clarity.

Staged diffs were reviewed before the code commit. Only application code, focused tests and the offline fixture helper were staged; no keys, `.env`, SQLite files, logs, generated evaluations, screenshots or browser artifacts. The implementation push succeeded, advancing `origin/main` from `262f60b` to `6e4a2eb`. This checkpoint/master-plan update is delivered in the following normal documentation commit; no history rewriting is used. The final response records the exact documentation HEAD, push result and clean-tree verification.

**Stop at M5. M6 requires separate owner approval. Live-provider acceptance remains a submission blocker independently of M5 completion.**
