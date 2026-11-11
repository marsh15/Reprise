# M1 checkpoint — Persistent Streaming Chat

Date: 11 November 2026. Scope: §R M1 and its §F/§G/§H/§K/§L contracts. M2 has not begun.

Implementation and local verification are complete. **Live provider acceptance remains unverified because LLM_API_KEY is absent.** This report is the owner checkpoint, not approval to start M2.

## Starting point

The checkout was clean on `main` at `9f244e3` with the requested GitHub origin. Actual M0 code was inspected before editing. Its 5 test files / 20 tests and type checking passed. Existing M0 tests and the approved master plan were preserved.

## What was implemented

- Built-in `node:sqlite`, WAL, foreign keys, a 3-second busy timeout, and atomic ordered `user_version` migrations. Migration 1 includes the complete approved schema, FTS5 triggers, ledger foreign keys, and cascade policies.
- A repository with cached prepared statements per database connection. New conversation plus first user message are atomic. Each message's `seq = MAX(seq)+1` is assigned inside `BEGIN IMMEDIATE`. UTC instant, original timezone, and local calendar date are stored together.
- Global unique `client_message_id` identity, matching-request validation, completed replay, incomplete-attempt recovery, and explicit retry of the latest eligible user message. Retries append assistant attempts without adding a user row.
- A single-process active-turn map: one turn per conversation; separate conversations run concurrently. Reservation happens synchronously before the SSE response begins. Conversation deletion rejects new work, aborts its turn, waits for persistence, then cascades.
- The real OpenAI SDK with two retries, a 60-second configured timeout, streaming usage, optional configured reasoning effort, no tools, and `tool_choice: 'none'`. The runner rejects empty, truncated, content-filtered, or unexpectedly tool-calling answers as failed.
- POST/SSE routing with started/delta/reset/completed/error contracts, 15-second heartbeat comments, request and response disconnect handling, and a shared provider abort signal. Terminal success follows the assistant transaction commit. A write failure leaves the user row and reports an internal error.
- Stop, browser disconnect, chat switching, and graceful shutdown persist accumulated text as `interrupted`. Provider errors preserve available partial text as `failed`. Locks are released in `finally`.
- Functional React sidebar, grouped local dates, new/switch/delete flows, confirmation, mobile drawer, safe markdown/GFM, growing composer, Enter/Shift+Enter/Esc controls, clock banner, error/Stopped/Retry states, and reload selection.
- A validated UTF-8 SSE parser that handles arbitrary chunk boundaries, multiline data, CRLF, heartbeats, schema failures, and premature EOF. A reducer owns the transcript. After a terminal event, the client reconciles against SQLite.
- Lost initial responses retain their request id in browser session storage. Replaying that request recovers the saved identifiers; a completed answer is loaded without another model call.

## Actual verification

M0's original 20 tests remain part of the passing suite. The final suite has **10 files / 58 tests**.

- Node 26.10.0: `npm run typecheck`, `npm test`, and `npm run build` passed. The final client build is approximately 484 kB JS / 147 kB gzip.
- Node 24.22.2: type checking, all 58 tests, and build passed, including actual child-process execution on Node 24.
- Production mode: `REPRISE_TEST_PRODUCTION=1 npx vitest run tests/integration/server.test.ts` passed after build.
- A fresh local clone installed dependencies with `npm install`, then passed type checking, all tests, and build. The cold test run took 14.12 seconds; warm runs took roughly 4–6 seconds, so the plan’s under-10-second test target is not met on that cold run. No existing dependency versions changed; only the three approved direct dependencies and their transitive packages were added. Installation audit reported zero vulnerabilities.
- Repository tests verified idempotency, chronological sequence allocation, frozen UTC-to-Kolkata date rollover, limited-history ordering, FTS insert/update/delete synchronization, ledger cascade and cross-conversation citation nulling, user/assistant transaction rollback, reopen/migration behavior, corruption rejection, and rejection of asynchronous transactions.
- Lifecycle tests verified duplicate-in-flight 409, completed replay without another request, incomplete replay, orphan-user recovery, independent concurrent conversations, latest-only retries, retry context excluding earlier attempts, mismatched identity rejection, failed provider persistence, failed writes, endpoint cancellation, deletion during generation, and graceful shutdown.
- Real-process tests used the actual HTTP server, Hono adapter, OpenAI SDK, a temporary on-disk database, and a local fake provider. Cancelling the response reader aborted the upstream HTTP request and saved partial text. Two conversations survived server restart. Shutdown during streaming persisted an interrupted answer before reopening.
- Browser checks used the same real application and local fake provider: Enter-to-send, markdown, new conversation, switching, Stop with persisted `word0 `, reload persistence, refresh mid-stream, Retry with no extra user row, Esc cancellation, confirmation and deletion, local date grouping, drawer opening/closing, and a 390×844 viewport without horizontal overflow.
- A deliberately lost initial response was recovered after reload: exactly one new conversation, two messages, no leftover pending request, and the saved completed answer.
- `git diff --check` passed. All added source and test files are under 300 lines. No credentials or database fixtures are tracked.

These are **mocked provider results**, not live model results. Browser automation initially encountered T3's exact error `Preview tab ... was not found for press`; the computer-use host was also unavailable. The already-installed Playwright CLI completed the browser checks without a project dependency. Observed browser console errors were a missing favicon and the intentionally aborted recovery-test request; no React runtime exception was observed.

`npm run smoke:llm` was attempted and exited 1 with:

```
SKIPPED: LLM_API_KEY is absent. No live provider compatibility has been verified.
```

The script probes ordinary streaming with usage and `tool_choice: 'none'`, disabled `web_search` declaration with `parallel_tool_calls`, configured reasoning effort (low if unset), and a mid-conversation system message. It reports only safe error status, not provider error bodies or credentials.

The parameters and cancellation interface were checked against the official [Chat Completions reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) and [OpenAI Node SDK](https://github.com/openai/openai-node). Documentation supports these interfaces; it does not establish acceptance by the configured model/account. No speculative capability map was added without a demonstrated provider incompatibility.

## Explicit simplification and review

A five-axis self-review covered correctness, readability, module boundaries, security, and performance. It was not an independent-model review.

Resolved findings:

- Read message rows in one query instead of fetching ids and performing one extra query per row; share one row mapper.
- Remove a redundant SDK chunk cast and unused repository transaction export.
- Exclude prior attempts at the current answer from retry context.
- Block new requests while a conversation is being deleted.
- Preserve request identity when the first response is lost; recover incomplete attempts without a new provider call.
- Reject a duplicate id paired with another retry target.
- Make shutdown idempotent across signals and validate the production build before opening SQLite.
- Make the mobile backdrop's clickable area match its visible area.
- Replace a flaky 2.5-second test startup poll with the server's listening event and an 8-second bound. One full-suite run exposed this timeout; the corrected harness and subsequent suites passed.

Mutation check: deliberately inverting the latest-user retry guard made the cancellation/retry integration test fail. The mutation was restored, and the suite passed. This establishes that the test exercises the guard rather than merely mirroring successful output.

## Implementation choices and deviations

The settled architecture is unchanged. No additional infrastructure or dependencies outside §Q were introduced. `openai`, `react-markdown`, and `remark-gfm` are the only new direct dependencies.

- Use `schema.ts`, as listed in §Q, for the ordered SQL migration array. Full ledger tables exist; M2 ledger writing/search behavior does not.
- The SDK and repository use small factories rather than import-time singletons, keeping env loading in the entry point and each test database's prepared statements isolated. There is no provider wrapper class or hierarchy.
- M1's shared SSE union contains only events implemented in M1; recall/search/citation events enter with their owning milestones. `seq` and `replyTo` are exposed to support deterministic UI ordering and Retry.
- The plan specifies completed and running duplicates but leaves failed/interrupted/orphan duplicates unspecified. These replay identifiers plus a terminal error without generating another answer. The explicit Retry action starts the next attempt.
- The empty-state copy and example chips describe available chat behavior. They do not advertise unimplemented search, recall, or `seed:demo`.
- Additional files outside the illustrative §Q list: `scripts/smoke-llm.ts` provides the required repeatable parameter probe; `tests/helpers/fakeProvider.ts` and `previewServer.ts` provide isolated socket/browser verification; `docs/M1-CHECKPOINT.md` records this checkpoint. New test files cover the corresponding M1 boundaries.
- Plain-English commit messages and this task's authorized push follow the current user instruction, overriding the plan's older commit/push wording.

## Commits

- `76af398` — Persist conversations and ordered messages in SQLite
- `d11622c` — Stream model responses and persist cancelled turns
- `6630eb4` — Add the persistent chat interface and recovery checks
- `0e9c93b` — Simplify message reads and remove redundant types
- `691f769` — Harden shutdown and request recovery after review
- The final documentation commit records this report and updates setup/verification instructions.

## Remaining risks and checkpoint gate

1. **Live-provider verification is open.** Supply valid credentials privately through local `.env` configuration, then run `npm run smoke:llm` and a real chat/Stop check. Actual `gpt-6-luna` availability, accepted effort values, usage behavior, and provider latency/cost are unverified.
2. **Hard termination cannot save in-memory text.** SIGINT/SIGTERM and browser disconnects preserve partial text; SIGKILL, power loss, or a crash can leave only the already-committed user row. The UI exposes Retry. Continuous draft checkpoints and resumable streams are outside the approved design.
3. **One process per database.** SQLite protects writes and sequence allocation, but the active-turn map coordinates one server process. Multi-process turn coordination is not supported.
4. **SQLite commit and network delivery cannot be atomic together.** A commit can succeed while its terminal SSE event is lost. Replay and DB reconciliation handle that case without another user message or generation.
5. **No live research or temporal recall yet.** There is no search adapter, tool loop, recall resolver, seeding, bake-off, or evaluation scenario runner. Those belong to M2/M3 onward.

## Concepts the owner should understand

**SSE versus WebSockets.** This request needs one upload followed by server-to-browser events. POST/fetch carries the body and reads the SSE response. WebSockets would add a bidirectional connection protocol without a current requirement. A transport disconnect aborts this turn; reconnecting does not resume generation.

**Transactions.** `BEGIN IMMEDIATE` reserves SQLite's writer before reading `MAX(seq)`. User insertion and assistant-result insertion each commit completely or roll back. New conversation creation is bundled with its first user message to avoid empty artifacts on failure. Never await network calls inside these synchronous transactions.

**Ordering versus time.** Sequence numbers define transcript order even when clocks tie or are frozen. UTC records the instant. `local_date` plus `tz` records the calendar day the user experienced then; future timezone changes cannot move that historical message to another day.

**Idempotency versus retry.** A client id names one user submission. Repeating it retrieves the same identity, rejects overlapping execution, or replays a saved outcome. Retry is an explicit new assistant attempt tied to the same latest eligible user row. It preserves failed/interrupted attempts rather than editing history.

**Cancellation propagation.** Stop, disconnect, or shutdown aborts one shared signal through the SDK to the provider request. Accumulated text is returned as interrupted, persisted, and only then reported as terminal. A dropped browser cannot receive that terminal event, so reload reads the database.

**Module boundaries.** The repository owns SQL; the turn service owns identity/locks/persistence; the runner owns model streaming; Hono owns HTTP/SSE; the reducer owns transient display state. Neither React nor the model decides database ordering or completion durability.

Teach-back before M2 approval: explain how a lost completion event avoids a duplicate answer, how Stop reaches the provider, why a power loss differs from Stop, and why a frozen clock cannot break message ordering. **Stop here until the owner approves M2.**
