# Reprise

A local chat agent that treats answers as dated observations: remember the conversation, research current information, and keep the evidence.

**Current milestone: M3 implementation checkpoint.** Deterministic temporal resolution, cross-conversation recall, honest missing-history context, labelled demo fixtures, and recall navigation are implemented and locally verified. Live M3 model verification is blocked by the absent LLM key. M2 live acceptance and the bake-off remain pending; no model winner has been selected. See [M3 checkpoint](docs/M3-CHECKPOINT.md).

## Run locally

Use Node **24 or newer** and npm. With nvm: `nvm install && nvm use`.

```bash
npm install
cp .env.example .env
# Fill in LLM_API_KEY and TAVILY_API_KEY in .env using your editor.
npm run dev
```

Open http://localhost:5173. `GET /api/health` reports the configured model, search provider, clock mode, and current instant. Health confirms local server readiness; it does not check provider authentication.

If `.env` is absent, `predev` creates it from `.env.example` and reports which keys to fill in. Preflight checks Node, built-in SQLite, FTS5, and configuration without making API calls or spending credits. It checks key presence, not validity. Local tests use explicit non-secret values and a fake provider. Real chat needs a valid LLM credential. Research calls Tavily only when the model requests `web_search`.

```bash
npm run typecheck
npm test
npm run build
npm start
```

`npm start` serves the built `dist/` client and the API on the same port. Build first. Keep dev dependencies installed: the planned production entry uses `tsx`.

## Configuration

All variables are documented in [.env.example](.env.example). Shell environment values take precedence over `.env`.

- `LLM_API_KEY`: required server-side LLM credential.
- `TAVILY_API_KEY`: required server-side search credential.
- `LLM_BASE_URL`: OpenAI-compatible endpoint; default `https://api.openai.com/v1`.
- `LLM_MODEL`: `gpt-6-luna` pending the M2 model comparison; live model availability and parameters still need verification with credentials.
- `LLM_REASONING_EFFORT`: optional `none`, `low`, `medium`, or `high`. Official GPT-6 Luna Chat Completions tools require `none`, applied when unset. Conflicting values are rejected. GPT-6.1 Terra tool calling requires Responses and is incompatible with this Chat Completions architecture.
- `PORT`: defaults to `5173`; server binds to `127.0.0.1`.
- `REPRISE_DB_PATH`: defaults to `./data/reprise.db`.
- `LOG_LEVEL`: `debug`, `info`, `warn`, or `error`; default `info`.
- `REPRISE_NOW`: optional ISO timestamp with timezone, for tests/evals only. Startup warns when active. Never use for real conversations. The UI shows a warning banner.

## How startup works

`npm run dev` first runs `predev`. Once prerequisites pass, `tsx watch` runs `src/server/main.ts` and restarts it when server files change. One Node HTTP server sends `/api/*` requests through Hono's Node adapter and other requests through Vite middleware. Vite transforms React/TypeScript and provides hot updates through that same server. There is no API proxy or second application port.

Configuration is parsed once with Zod. The clock centralizes real versus frozen time. JSON logs contain operational metadata; credentials and raw conversations must never be passed to the logger.

## Project map

- `src/server/`: HTTP entry, Hono routes, SQLite migrations/repository, turn service, SDK client, streaming runner, configuration, clock, logging.
- `src/client/`: conversation sidebar, chat thread, composer, validated SSE parser, and reducer.
- `scripts/preflight.ts`: local run-contract checks.
- `tests/`: deterministic unit and integration tests; local HTTP fixtures only, no external provider calls.
- [Master plan](docs/PLAN.md), [decisions](docs/adr/), [glossary](GLOSSARY.md).

## Upcoming milestones

M3 is the current stopping point. M4 requires owner approval; it completes change/recheck evaluations. M5 reliability/UX and M6 submission documentation remain later work.

`npm run eval` runs real-model scenarios when credentials are available; see [evaluation commands and limits](evals/README.md). `npm run eval -- --mock` validates the harness with scripted answers and does not measure model quality. Final `DESIGN.md` and interview notes remain M6 deliverables.

## Demo history and recall

```bash
npm run seed:demo -- --tz Asia/Kolkata
# Replace only labelled fixture conversations; preserve live conversations:
npm run seed:demo -- --tz Asia/Kolkata --reset-fixtures
```

Seeding is explicit, never part of startup, and needs no API keys. It inserts four conversations: CRM shortlist, Postgres hosting, Node versus Bun, and weekend plans. Dates are relative to the supplied timezone and centralized clock. Fixture titles/messages/sources are labelled as illustrative demo data, not genuine user history or current prices. Repeating the command refuses duplicates unless the targeted reset flag is supplied. Do not add real history to a demo conversation if you want it preserved during fixture reset.

Before the model runs, code resolves English dates and queries stored local dates plus FTS5 keywords across conversations. It retrieves raw user messages, original assistant answers and associated observations. Recall chips link to the original message, with a demo badge for fixtures. Missing records are explicit; the prompt forbids inventing a past answer or using the web to reconstruct a private conversation. Live-model compliance still needs verification.

English dates such as `3 November` are supported; numeric `3/11` dates are deliberately unsupported. A bare weekday means its most recent strictly past occurrence; `last Tuesday` produces two candidates, selected using topic matches and recorded conversations. Later timezone changes do not move stored local dates. Overlarge protected evidence produces a clarification rather than silently dropping user text.

## Privacy and limits

The target is single-user local use, without authentication. History stays in an ignored SQLite file under `data/`. Answer generation sends up to 20 recent messages, a bounded packet of relevant historical turns from other conversations, a conversation index and history-start information to the configured LLM provider. The browser stores the selected conversation id locally and temporarily keeps an unacknowledged request in session storage for safe recovery. Research sends queries to Tavily. The LLM also receives the cited source observations carried from the last two assistant replies (up to eight), plus new search excerpts. There is no telemetry. `.env`, databases, generated evaluation results, and dependency/build directories are ignored by Git.

## M0 verification record

Verified on 11 November 2026:

- Node 26.10.0 / npm 11.19.1: fresh dependency install, `npm run typecheck`, `npm test` (5 files, 20 tests), and `npm run build` passed.
- A fresh local Git clone passed `npm install` and `npm run dev`; HTTP page and health checks passed using non-secret test values supplied through the shell.
- Actual Node 24: preflight, server startup/health, and all 20 tests passed. Actual Node 22: preflight exited 1 with the Node upgrade instruction.
- Missing `.env` creation and missing-key failures passed subprocess integration tests. Missing `TAVILY_API_KEY` produced one actionable line and exit 1.
- Browser inspection verified the rendered Reprise placeholder and React hot reload. No browser errors were observed.
- Production smoke: page 200, HTML navigation fallback 200, missing asset 404, `.env` path 404, health 200. The override timestamp and warning were verified.
- `git diff --check` passed; ignored paths were checked. No credentials were used or committed. Real provider authentication and LLM parameters remain unverified until M1/M2.

The integration follows the official [Vite middleware/HMR configuration](https://vite.dev/config/server-options), [Hono Node adapter](https://github.com/honojs/node-server), [Node SQLite API](https://nodejs.org/api/sqlite.html), and [Node environment loading API](https://nodejs.org/api/process.html#processloadenvfilepath). Installed versions and peer requirements were checked against npm metadata.

Implementation notes: `vitest.config.ts` keeps tests at repository root independently of Vite's client root. Test files added for M0 cover its run and configuration contracts. Only dependencies currently used in M0 are installed; later §Q dependencies will be added with their features. The original master plan is preserved; this session's plain-English commit messages and authorized pushes take precedence over §X.1's older Git instructions.

## Chat behavior and verification

Enter sends, Shift+Enter adds a newline, and Stop or Esc interrupts the answer. Switching chats also disconnects the current stream and saves its partial answer. Reload restores the selected conversation. Retry reuses the latest user message and appends an assistant attempt; it does not duplicate the user row. Deleting a conversation permanently removes its messages and ledger rows after confirmation.

The server migrates the SQLite file automatically. Back it up before any manual repair; corrupt or newer databases are rejected rather than repaired. Run one Reprise server per database file: the active-turn guard belongs to one process.

```bash
# Requires real LLM credentials; exits nonzero and reports SKIPPED if absent.
npm run smoke:llm

# Optional production-process regression, after building.
REPRISE_TEST_PRODUCTION=1 npx vitest run tests/integration/server.test.ts

# Isolated browser fixture: fake provider, /tmp database, no real API calls.
npx tsx tests/helpers/previewServer.ts
```

`npm test` covers SQLite, FTS, duplicate requests, concurrent turns, cancellation, retries, failed writes, SSE parsing, real socket disconnects, and process restarts. The smoke script checks the configured provider separately; passing mock tests does not establish real model compatibility.

## Research behavior

The model sees exactly one tool: `web_search`. Code enforces three research rounds, five queries per round, ten per turn, eight seconds per search, and a 25-second research deadline. Independent calls run concurrently. After budget exhaustion the model gets one answer-only step. The deadline bounds research, not the subsequent final answer stream. Stop propagates through both search and model requests. Draft text is reset when tool calls begin; only the current answer text is persisted.

Search observations retain their sanitized excerpt, title, canonical HTTP(S) URL, provider publication date when available, retrieval time, and parent search. Citation states check source identity and numerical/date tokens. **Verified means those tokens were found; it does not verify meaning, source quality, or whether a claim is true.** Unknown markers and missing tokens remain visible. Deleting a conversation deletes its sources.

```bash
npm run eval -- --mock  # 13 scripted scenarios; validates the harness, not model quality
npm run eval           # real LLM + frozen replay; reports blocked access explicitly
```

Current live constraints: OpenAI/Tavily credentials are absent; the available OpenRouter account returned HTTP 402, and its pinned US endpoint rejected the explicit parallel-call parameter with HTTP 404. There are no measured model scores, live latency/cost measurements, or approved model winner. Never paste credentials into chat or commit them; configure local environment values privately.
