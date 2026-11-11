# Reprise evaluations

This is the M3 evaluation runner. It runs the application turn service, real OpenAI SDK, bounded loop, in-memory SQLite ledger and citation checker. Pass/fail uses deterministic assertions, never an LLM judge. Generated transcripts and reports stay in ignored `evals/results/`.

```bash
npm run eval                       # real configured LLM + frozen search replay
npm run eval -- --mock             # scripted fake LLM + synthetic cassettes; harness validation only
npm run eval -- --model gpt-6-luna
npm run eval -- --model gpt-6.1-terra # incompatible: official docs require Responses tools
npm run eval -- --base-url https://openrouter.ai/api/v1 --model deepseek/deepseek-v4.1-flash --provider fireworks/us
npm run eval -- --live --only D1,F1 # actual Tavily; requires both keys
npm run eval -- --record --cassette-dir /tmp/reprise-capture --only D1
# Freeze that capture directory, review it, then replay identical files for each model:
npm run eval -- --cassette-dir /tmp/reprise-capture --only D1 --model gpt-6-luna
```

`--only` accepts comma-separated scenario IDs. Exit 0 means selected assertions passed; 1 means scenario failures; 2 means blocked configuration/provider access. An HTTP-rejected turn is **untested**, excluded from model pass rates, and stops the run to avoid repeated blocked requests. Missing credentials also produce an explicit blocked report.

D1, E1, E2, F1, I1, I2, L1, G1 and K1 cover M2. E1 starts with a frozen prior explanation to test no-search rephrasing. A1/B1/F2/H1 now exercise temporal recall and fixtures; F1 continues to test fresh-install abstention. These five M3 scenarios run in both mock and real-model modes. B2/C1/C2/C3/H2/J1 remain scenario work for M4, while ambiguity, corrections and source handling already have deterministic M3 tests. The complete P0 bake-off must be repeated after M3/M4 adds those scenarios.

The checked-in cassettes are **hand-authored synthetic fixtures**, including Node's illustrative version, injection, conflict and billing examples. They are not recorded web observations. Result excerpts and source flags label them. There are no recorded live cassettes in this checkpoint. `--record` calls actual Tavily and writes only validated, sanitized outcomes, preserving capture timestamps on replay. It requires a separate output directory so frozen inputs cannot be overwritten accidentally. Mixed captures retain per-result fixture labels and are labelled mixed.

Cassette keys are normalized query + freshness. A miss produces `cassette_miss`, never live fallback or invented evidence, and fails the scenario. Research scenarios include a fixed query in their user input so models receive reproducible excerpts despite query paraphrasing. This isolates tool use and grounded synthesis; it does **not** measure unconstrained query quality. Model prompts and production behavior contain no evaluation answers or scenario branches. SHA-256 input hashes cover each user input, prior messages, demo fixture JSON and cassette bytes. JSON reports also retain the actual recall packet for inspection.

The clock is frozen at 2026-11-11T08:30Z, Asia/Kolkata. Synthetic source retrieval times are explicitly frozen; recorded source retrieval times remain the real capture time. Each scenario uses a fresh in-memory database. `--mock` scripts define fake behavior, so their passes and artificial timings are not model evidence and have no price/latency score.

Real reports include scenario failures and transcripts, median final-answer TTFT, median total latency, aggregate token usage, model/tool call counts, invalid calls and duplicate queries. Cost estimates use usage × the exact model/provider price in `prices.json`, ignore caching discounts, and exclude search credits. Missing/incomplete usage or unconfirmed pricing yields unknown, never zero. Treat published rates as estimates of cost, not a billing receipt; recheck before another bake-off. No successful live measurements were obtained in M2.

OpenRouter evaluation requests are pinned to an explicit `/us` endpoint, with fallback disabled and `require_parameters: true`. `fireworks/us` is listed by its official endpoints API. The explicit parallel-call parameter is omitted from normal DeepSeek requests after the strict smoke probe returned 404; concurrent call generation on that endpoint remains unverified. No alternate model or geographic endpoint is substituted. OpenRouter keys are used only by evaluation/smoke scripts, not written to reports or passed to the client.

Default choice stays with the owner: highest P0 pass rate, then lower median total latency, then lower cost. No winner can be selected from the current blocked results. See [M2 checkpoint](../docs/M2-CHECKPOINT.md) and §N.4 of the [plan](../docs/PLAN.md).

M3 verification commands:

```bash
npm run eval -- --mock --only A1,B1,F1,F2,H1
npm run eval -- --only A1,B1,F1,F2,H1
npx tsx tests/helpers/memoryPreview.ts # isolated browser fixture; no real providers
```

The M3 checkpoint has 13 passing mock scenarios. `npm run eval` exits 2 with `LLM_API_KEY absent`; no live M3 score or model-honesty result is claimed. Historical fixture observations and synthetic current-search cassettes are separately timestamped and labelled. M2's live-provider acceptance and bake-off remain outstanding. See [M3 checkpoint](../docs/M3-CHECKPOINT.md).
