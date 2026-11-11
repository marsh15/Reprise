# Reprise

A local chat agent for **what we discussed then, and what we can verify now**. Reprise combines persistent conversations, deterministic dates and recall, and one bounded web-search tool. Original messages and dated source observations remain available for later rechecks.

Read [DESIGN.md](DESIGN.md) for the one-page engineering design. **Offline M6 verification is complete; submission acceptance remains blocked by live provider access.** No live-model winner, quality score or latency/cost benchmark is established. See the [M6 checkpoint](docs/M6-CHECKPOINT.md) for exact results and remaining gates.

## Run locally

Use **Node 24 or newer** and npm; Node 24 is pinned in `.nvmrc`. Node 24 and 26 are exercised in verification. With nvm, run `nvm install && nvm use`.

```bash
npm install
cp .env.example .env
# Set LLM_API_KEY and TAVILY_API_KEY privately in .env using your editor.
npm run dev
```

Open http://localhost:5173. `npm run dev` runs preflight first: it checks Node, built-in SQLite, FTS5 and configuration. If `.env` is missing it creates the template and reports missing keys. Preflight checks presence, not provider authentication. `GET /api/health` reports local server readiness, configured model and clock; it does not validate credentials.

For a production build:

```bash
npm run build
npm start
```

Keep dev dependencies installed: the server entry uses `tsx`. Run one server per database file. The server binds to `127.0.0.1`.

## Configuration

Every supported environment setting is in [.env.example](.env.example). Shell values take precedence over `.env`. Secrets are server-side; never prefix them with `VITE_` or commit them.

- **Required:** `LLM_API_KEY` for the configured model endpoint and `TAVILY_API_KEY` for search.
- **Model:** `LLM_BASE_URL` defaults to `https://api.openai.com/v1`; `LLM_MODEL` defaults provisionally to `gpt-6-luna`. `LLM_REASONING_EFFORT` is optional (`none`, `low`, `medium`, `high`). The existing compatibility guard applies `none` for Luna tools and rejects Terra's Responses-only tool pairing on this Chat Completions path. Verify actual account/model compatibility with the smoke test; endpoint compatibility alone is insufficient.
- **Local:** `PORT=5173`, `REPRISE_DB_PATH=./data/reprise.db`, `LOG_LEVEL=info` (`debug`, `warn`, `error` also supported).
- **Testing only:** `REPRISE_NOW` freezes the clock to an ISO timestamp with offset. Startup and the UI warn when active; leave it unset for real conversations.
- **Optional evaluations only:** `OPENROUTER_API_KEY`, with explicit endpoint/model/US-provider selection described in the [evaluation guide](evals/README.md).

## Use and inspect

Create or switch conversations in the sidebar. Enter sends, Shift+Enter adds a newline, and Stop or Esc interrupts. Switching conversations disconnects the current stream. Reload retrieves saved history; Retry uses the saved user message and preserves previous attempts. An unacknowledged request is temporarily retained in browser session storage for recovery. Conversation deletion removes its history and evidence after confirmation.

Expand the research summary to see queries, failures and sources. Hover or focus a citation to inspect publication/retrieval dates, historical versus current observations and fixture labels. Dotted citations indicate missing numerical/date tokens; an invalid marker has no registered source. **A numerical check is not semantic verification.** Multiple observations of one URL share a marker and do not identify the supporting date for each claim.

Recall chips open the original message. Supported English dates include `3 November`, `yesterday` and `last Tuesday`; numeric dates such as `3/11` are excluded. Date arithmetic uses the request timezone; stored local dates retain their original timezone interpretation. Ambiguity assumptions and missing-history information go to the model before it answers. A new database has no genuine past conversations.

Seed clearly labelled illustrative history without API calls:

```bash
npm run seed:demo -- --tz Asia/Kolkata
# Replace only fixture conversations; preserve other conversations:
npm run seed:demo -- --tz Asia/Kolkata --reset-fixtures
```

Seeding adds four conversations (CRM, Postgres hosting, Node/Bun and weekend plans), dated relative to the clock/timezone. It never runs automatically. Repeated seeding refuses duplicates. Reset removes entire fixture conversations, including any later messages added to them. Fixture prices are invented controls, not current vendor facts. Try “On Monday we shortlisted five CRM tools. Has pricing changed since?” and inspect the Demo recall badge; real generation/research requires working keys.

## Verify and evaluate

```bash
npm run typecheck
npm test
npm run build
npm run eval -- --mock
REPRISE_TEST_PRODUCTION=1 npx vitest run tests/integration/server.test.ts
```

Tests use deterministic and local fake boundaries without external provider calls. The mock runner exercises 23 scripted scenarios (11 P0, 12 P1); it cannot measure model reasoning or conversational quality.

With valid provider access:

```bash
npm run smoke:llm
npm run eval                         # real LLM + checked-in synthetic search replay
npm run eval -- --live --only C1,D1,F1  # real LLM + real Tavily smoke subset
```

The [evaluation guide](evals/README.md) covers full scenarios, capture/replay, compatible candidate comparisons, cost estimates and human review. Generated reports stay in ignored `evals/results/`. Exit 0 means selected automatic checks passed; 1 means a failure (or skipped smoke); 2 means evaluations were blocked. A live subset is not full P0 acceptance. Recorded-search replay requires actual reviewed captures; checked-in cassettes are synthetic. No default model changes automatically.

## Architecture and limits

One Node process serves React/Vite and the Hono API on one port. Follow `src/server/main.ts` → `app.ts` → `turns/service.ts` → `memory/recall.ts` and `agent/runTurn.ts` → `db/repo.ts`. Shared Zod contracts validate environment, HTTP, tool and streaming boundaries. SQLite stores raw messages, searches, dated observations and citations in transactions. No ORM, embedding service, router or agent framework is required.

Research is limited to three rounds, five queries per round, ten per turn, eight seconds per search and a 25-second research deadline; the final answer stream has a separate provider timeout. Change classifications and no-search decisions are prompted model behavior, not deterministic guarantees. Keyword recall can miss paraphrases; context is bounded; excerpts can omit decisive facts. Refresh interrupts rather than resumes a stream. A hard process crash can lose the in-flight answer/evidence while retaining its saved user question.

This is a single-user local app without authentication. The configured LLM receives recent messages, bounded recalled conversations, an index and source excerpts; Tavily receives search queries. History is local SQLite data, but generation sends that context to the provider. There is no telemetry. Back up the database before manual repair; corrupt/newer databases are rejected. `.env`, local data, builds and generated reports are ignored.

[Interview notes](docs/interview-notes.md), [60-second script](docs/architecture-script.md), [decisions](docs/adr/), [glossary](GLOSSARY.md), [master plan](docs/PLAN.md).
