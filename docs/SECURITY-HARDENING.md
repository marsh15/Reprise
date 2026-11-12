# Security hardening

Branch `security/reprise-hardening`, based on `82427d2` (redesign integrated). Source audit: `security-audit-skill/Reprise/run-1/REPORT.md` (outside the repo). All evidence below was produced with scratch databases, dummy keys, a fake OpenAI-compatible provider and no real OpenAI or Tavily calls.

## A. Executive summary

All four confirmed findings are fixed and re-tested against the real development server:

| Finding | Before | After |
|---|---|---|
| Cross-origin `text/plain` POST creates a conversation and runs a model turn | 200, 1 conversation, 1 model call | 403, 0 conversations, 0 model calls |
| Repeated date phrases block the event loop | `today`×1333: 7.2 s, `/api/health` stalled 6.7 s | 135 ms, `/api/health` 3 ms |
| `/__open-in-editor` reachable from any site (dev) | editor launched on the requested file | 404, editor never launched |
| `/@fs/` serves workspace files, including SQLite DBs, to other localhost origins (dev) | 200 with `Access-Control-Allow-Origin: http://localhost:3000` | 403, no CORS grant |

Of the four leads that needed validation, two are fixed (remote Markdown images, foreign Host / DNS rebinding at the server). One was hardened narrowly (fixed `/tmp` preview DB path). One remains a documented residual risk (other OS accounts on the same machine can reach the loopback API).

Remaining risk: Reprise still has no authentication. Any local process, or any other OS account on the machine, can call the API with a native HTTP client. That is a different trust boundary from browser origins and is not addressed here (section O).

## B. Threat model

- **Browser origins.** The owner's browser can be made to send requests to `127.0.0.1` by any page they open. Only the app's own origin (`http://localhost:PORT` or `http://127.0.0.1:PORT`) may mutate state or read history. Pages on other localhost ports count as other origins.
- **DNS rebinding.** A foreign hostname that resolves to `127.0.0.1` reaches the listener with its own `Host`. Only the two loopback names on the configured port are served.
- **Native local clients.** A process on the machine can send any headers, so header checks cannot restrict it. Non-browser calls are allowed by design (see G).
- **Other OS users.** Loopback is not per-user. File permissions protect the database, but the API is reachable by any local account.
- **Development server.** Vite's dev endpoints run only under `npm run dev`. They are gated by the same admission check and by Vite's own `server.fs` policy.
- **Private data.** SQLite history (`data/`, `evals/results/**/app.db`), `.env`, eval captures and transcripts.
- **Untrusted model output.** Assistant Markdown is attacker-influenceable (prompt injection through search excerpts or recalled history).

## C. Confirmed findings

**S1: cross-origin model-turn forgery.** *Root cause:* `POST /api/turns` parsed any body as JSON (`c.req.json()` ignores Content-Type) and nothing checked Origin, Fetch Metadata or Host, so a `text/plain` CORS simple request created a conversation and ran a paid model turn. *Fix:* `src/server/requestPolicy.ts` `admit()` runs in `main.ts` on every request before either Hono or Vite is called. It rejects with 403/415 before any body is read (section G). *Invariant:* a rejected request creates no conversation, no message and no model or search call. `tests/integration/security.test.ts` asserts this through a real process: 16 hostile request shapes plus an unauthorized preflight, followed by an empty conversation list and zero fake-provider requests.

**S2: temporal-parsing event-loop blocking.** *Root cause:* `resolveDates` returns one resolution per phrase occurrence. For each one, `recall` called `findTurnsByLocalDates` and `ftsTurnsOnDates`, which hydrated every turn in the range (message, reply, conversation, evidence: several synchronous SQLite queries per turn) before keeping six. The cost was occurrences × turns-in-range × queries. *Fix (algorithmic, `recall.ts`, `repo.ts`):*
1. Identical resolutions (same kind and candidates) are processed once, keeping the phrase the user typed first.
2. At most `MAX_DATE_RESOLUTIONS = 8` distinct *dated* resolutions are looked up. When more are dropped, a note is added to the packet so the model knows. A "last time we discussed X" reference does not count toward the cap: it is one bounded query, and it is never dropped.
3. Ranking uses lightweight id rows (`turnKeysByLocalDates`, `ftsTurnIdsOnDates`), and only the ≤6 attached turns are hydrated through `repo.turn`.

Ordering, `date+topic`/`date` reasons and the `+N more turns` count use the same keys as before. Retrieval per message is now bounded by the cap, independent of repetition count and of how many stored turns are hydrated.

**S3: Vite editor opening.** *Root cause:* Vite mounts `launch-editor-middleware` at `/__open-in-editor` with no origin or intent check, and connect prefix-matches case-insensitively. *Fix:* `admit()` answers 404 when the request's parsed pathname starts with `/__open-in-editor` (case-insensitive), before Vite runs. Vite's router also reads the pathname of absolute-form targets (`GET http://host/__open-in-editor?file=…`), which browsers never send but a local process can. The check therefore parses those too, also matches their raw text, and rejects unparseable or non-HTTP targets with 400. The final PR review found this absolute-form bypass; it was fixed in a follow-up commit. The same guard (`createGuard`) now also fronts the three browser-fixture helpers that start their own Vite (`tests/helpers/{memory,quality,research}Preview.ts`). The independent review showed the editor still launched through them. Reprise does not need the feature. The only loss is the Vite error overlay's "open in editor" click.

**S4: Vite workspace-file disclosure.** *Root cause:* in middleware mode, Vite's default `fs.allow` is the workspace root, its deny list does not cover `data/` or `*.db`, and its default CORS allows every `localhost:*` origin. *Fix (`vite.config.ts`):*
- `server.fs.allow` is limited to absolute `src/client`, `src/shared` and `node_modules`.
- `server.fs.deny` repeats Vite's defaults (a custom list replaces them) and adds `**/data/**`, `**/evals/results/**` and the SQLite file and sidecar patterns.
- `server.cors` is `false`.

## D. Markdown-image mitigation

*Before:* react-markdown rendered `![x](https://…)` as `<img src>`, so the browser fetched attacker-chosen URLs with no user action. Exfiltration of real conversation text through a live model was **not** demonstrated (that would need a real model call).

*Now (`Message.tsx`, `thread.css`):* assistant Markdown never produces an `<img>`.
- An `http(s)` image becomes a small muted link reading "Image not loaded: alt-or-hostname". It opens only on click, with `target=_blank`, `rel="noopener noreferrer"` and `referrerPolicy="no-referrer"`, and has an accessible label.
- Any other source (`data:`, `javascript:`, `file:`, `blob:`, relative, protocol-relative, malformed, a `#citation-N` target) becomes inert text.
- An image anywhere inside a Markdown link (including inside bold or mixed with text) renders as plain "Image not loaded" text. The link keeps its own destination and its other text, so links are never nested.
- Existing link, citation, table and code behaviour is unchanged. The style uses existing tokens only.

*Browser evidence (Chrome via DevTools, real dev server):* a conversation was seeded with images in a paragraph, reference style, inside a link, in a table cell, in a blockquote, plus `exfil.invalid`, `data:`, `javascript:`, and inline-code and fenced-code variants. The local request counter that stood in for the attacker host recorded **0 requests** across:
- render
- scrolling
- keyboard focus of every placeholder
- a real pointer hover
- switching to dark theme
- switching to another conversation and back
- light theme at a narrow viewport (Chrome clamped the requested 390 px to 500 px; no horizontal overflow)
- sending a new message

Over the same steps the page held no `<img>`, no `src` attributes and no background images. Clicking a placeholder deliberately loaded the URL in a new tab with an empty `document.referrer` and `window.opener === null`. Ordinary links and the `[1]` citation pill rendered and worked. Unit coverage: `tests/unit/markdown-images.test.ts` (17 cases).

## E. Unresolved leads

| Lead | Tested | Result | Still uncertain |
|---|---|---|---|
| DNS rebinding | Raw HTTP with foreign, malformed, trailing-dot, IPv6, wrong-port and portless Host values, dev and production | All rejected with 403 before any handler, including `/api/health` and the HTML page | No real-browser rebinding attack was staged, so browser feasibility before the fix stays unproven |
| Shared-machine history | File modes and `dscl` account list (one human account here) | New DB files are now 0600 (WAL/SHM inherit it) and new data dirs 0700. `/Users/santoshkumar` is `drwxr-x--- staff`, so a second standard account (normally in `staff`) could probably traverse it (inferred). Existing `evals/results/*/app.db` files are 0644 | Not tested with a second account. The loopback API is reachable by any local account regardless (section O) |
| Preview-helper `/tmp` symlink | Source review | Fixed path replaced with `mkdtempSync` (0700) and removed on exit. The other preview helpers use `:memory:` | Cross-account symlink exploitation was not reproduced (no second account) |
| Remote Markdown images | See D | Fixed | Live-model induction not tested |

## F. Additional hardening

- **Implemented:** private DB file and directory modes on first creation (pre-existing files and parent directories are deliberately left alone); private temp directory for the preview helper.
- **Deferred:**
  - *Framing headers* (`frame-ancestors 'none'`). Clickjacking was rejected as an independent exploit, and the forgery path that made it relevant is now closed. Some preview tools embed localhost pages, and the header could break them. Low effort if the owner wants it.
  - *Request-body byte limit.* After S1, only the owner's page or a native local client can reach `POST /api/turns`.
  - *Total stream lifetime and answer-size caps.* The provider is owner-configured, and the audit rejected the related finding.
- **Rejected:** a CSRF token or custom-header scheme. A browser cannot forge Origin or Fetch Metadata, and native clients can read any token from the page, so neither would add protection.

## G. API request policy (`admit()`, every request)

1. **Host** must be exactly `localhost:PORT` or `127.0.0.1:PORT`, case-insensitive. A bare name is accepted only when PORT is 80. Anything else, missing, or repeated → 403 `forbidden_host`. IPv6 `[::1]` is excluded because the listener binds IPv4 only. Forwarded headers are ignored.
2. `/__open-in-editor*` → 404.
3. Non-API paths go no further (pages, assets and top-level navigations from other sites still open the app).
4. **API, `OPTIONS`** → 403 with no CORS headers (no preflight is ever approved; Hono adds no CORS headers).
5. **Sec-Fetch-Site**, when present, must be `same-origin`; GET/HEAD also accept `none` (address bar). `same-site` (another localhost port) and `cross-site` → 403.
6. **Origin**, when present, must equal `http://` + the request's own Host: exact scheme, host and port. This rejects `null`, other ports, suffix tricks, scheme changes and multi-value forms.
7. **Mutations** (non-GET/HEAD) carrying a body, and every `POST /api/turns`, need media type `application/json` (parameters such as `charset` allowed) → otherwise 415.
8. **Missing Origin and missing Sec-Fetch-Site** on a mutation is treated as a non-browser client and allowed. Every browser this app supports sends Origin on cross-origin POST/DELETE, and `/api/turns` additionally needs a JSON type that a cross-origin page cannot send without a preflight, which step 4 refuses. This is a deliberate decision about native clients, not an oversight (see O).

## H. Vite development protections

`admit()` runs in the `httpServer` `request` handler before `vite.middlewares`, so Vite's routes are covered by the Host check and the editor block. The filesystem policy lives in `vite.config.ts`, which Vite loads alongside the inline `middlewareMode` options in `main.ts`. The HMR WebSocket uses the `upgrade` event, which `admit()` does not see; it remains under Vite's own protections. HMR and React Refresh were checked in a real browser: an edit to `Message.tsx` was hot-applied (`[vite] hot updated: /components/Message.tsx`). `/@vite/client`, `/@react-refresh`, `/main.tsx`, CSS and pre-bundled React all return 200.

## I. Temporal-processing fix

Before, the cost was O(occurrences × turns-in-range × hydration queries). Now:
- Repeats are free.
- At most 8 distinct dated resolutions (≤ 16 date candidates) each run one id query and one FTS id query, plus at most one "last time" topic query.
- At most 6 turns per resolution are hydrated, and turns already attached are skipped.

Measured on the real dev server with 100 seeded turns:

| Request | Before | After |
|---|---|---|
| Single-phrase baseline | 66 ms | 98 ms (run-to-run noise) |
| `today`×1333 | 7225 ms; `/api/health` 6733 ms | 135 ms; `/api/health` 3 ms |
| `this month`×727 | 4148 ms; `/api/health` 3648 ms | 125 ms; `/api/health` 2 ms |

The deterministic bound in `tests/unit/recall-bounds.test.ts` uses no timing assertions. It counts repo calls, which stay identical for 1, 10, 100 and 1333 repetitions. It also checks the 8-resolution cap and its note, that a "last time we discussed" lookup survives the cap, that the first-typed phrase is kept, long legitimate messages, yesterday and last Tuesday (ambiguous, with its assumption), and an Asia/Kolkata date boundary.

## J. Security regression coverage

| Level | File | What it proves |
|---|---|---|
| Unit | `request-policy.test.ts` | Policy matrix: host, origin, Fetch Metadata, media type and editor-route cases |
| Unit | `recall-bounds.test.ts` | Work bound and preserved recall semantics |
| Unit (SSR render) | `markdown-images.test.ts` | No `<img>`, safe hrefs, links and citations intact |
| Unit (filesystem) | `db-permissions.test.ts` | 0700 directory, 0600 DB/WAL/SHM, existing files untouched |
| Integration (real process, dev/Vite, raw HTTP) | `tests/integration/security.test.ts` | Hostile mutations leave no side effects; cross-origin DELETE and cancel refused; owner JSON, charset JSON and non-browser JSON succeed; private GETs refuse rebinding and cross-site with no CORS grant; editor never launches under 20 request shapes or 15 absolute-form, encoded and path-variant targets (spy log checked after each); `/@fs` and traversal variants serve nothing private; client and HMR runtime load |
| Browser (Chrome, real dev server) | Manual run (section D) | Zero automatic image requests; deliberate click; send, delete and cancel through the gate |
| Production mode | Raw HTTP | Gate verified (section A results) |

**Mutation check:** each protection was disabled and the tests went red, then the original was restored.

| Protection disabled | Result |
|---|---|
| Admission gate | 4 integration tests fail |
| Vite restriction | `/@fs` test fails |
| Recall dedupe | 2 work-bound tests fail |
| `last_mention` counted toward the cap | The topic-survives-cap test fails |

## K. Application compatibility

- **Covered by the existing suite (unchanged, all passing):** streaming, Stop, socket-loss abort, restart recovery and production SPA serving (`server.test.ts`, also run with `REPRISE_TEST_PRODUCTION=1`), retry, recall and citations.
- **Covered by the new browser run:** sending, deleting, conversation switching, light/dark themes and a narrow viewport.
- **Covered by mock evals:** all scenarios pass.
- **Not re-run:** the redesign's earlier 80-check browser suite.

## L. Files changed

- **Modified:** `src/client/components/Message.tsx`, `src/client/thread.css`, `src/server/db/db.ts`, `src/server/db/repo.ts`, `src/server/main.ts`, `src/server/memory/recall.ts`, `tests/helpers/previewServer.ts`, `tests/helpers/memoryPreview.ts`, `tests/helpers/qualityPreview.ts`, `tests/helpers/researchPreview.ts`, `vite.config.ts`.
- **New:** `src/server/requestPolicy.ts`, `docs/SECURITY-HARDENING.md`, `tests/integration/security.test.ts`, `tests/unit/{request-policy,recall-bounds,markdown-images,db-permissions}.test.ts`.
- **No new dependencies.** No database, `.env`, or eval capture is tracked.

## M. Verification

These were run after the last source edit (2026-11-13), in the security worktree:

| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm test` | **703/703** passed in 46 files (baseline 580; +123 new) |
| `npm run build` | built; only the pre-existing chunk-size warning |
| `npm run eval -- --mock` | **23/23** PASS |
| `npm run eval -- --mock --only R1,R2,R3` | **3/3** PASS |
| Real dev-server reproduction (final code) | S1 403, 0 conversations, 0 model calls. Rebinding 403. Editor 404 with an empty spy log. `/@fs` 403 with no ACAO. `today`×1333 took 124 ms (health 1 ms); `this month`×727 took 103 ms (health 1 ms) |
| Production-mode raw HTTP | cross-site POST 403; rebinding 403 (API and page); owner page and history 200; editor 404 |

The Chrome check (section D) and the production probe ran on the code just before the review fixes. Those fixes touched only recall de-duplication and the test-fixture helpers, not the renderer or the gate logic. The full suite and the dev-server reproduction were rerun afterwards.

## N. Independent review

**Reviewer:** a separate Claude Opus 5.5 agent (`repertoire:antagonist`, security lens). It ran in a fresh context with read-only instructions, received the audit claims but not the author's reasoning, and ran probes in its own scratch directory. It is a different instance of the same model family, not a different vendor; treat it as independent context, not an independent organisation.

| # | Finding | Evidence | Disposition |
|---|---|---|---|
| 1 (medium) | Browser-fixture helpers (`research/memory/qualityPreview.ts`) start their own Vite on port 5173 without `admit()`, so a cross-site `<img>` still launched the editor through them | Demonstrated on a replica | **Fixed:** the guard was extracted to `createGuard()` and applied to all three helpers and `main.ts` |
| 2 (medium) | Existing database files and `data/` keep their old mode (0644/0755) | Demonstrated | **Not changed (owner decision):** silently changing modes on existing user files and parent directories was deliberately avoided. Command to apply it is in section O |
| 3 (low–medium) | The date cap could drop a "last time we discussed X" lookup and disable the topic fallback (a recall regression against `82427d2`) | Demonstrated | **Fixed:** the cap applies to dated lookups only. A regression test was added and mutation-checked |
| 4 (low) | De-duplication kept the last identical phrase, not the first | Demonstrated | **Fixed:** the first phrase is kept. A test was added |

**No finding** in these areas:
- path and middleware ordering (absolute-form targets, `//api`, `/API`, `/%61pi`, `OPTIONS *`, CONNECT, 100-continue)
- duplicate headers
- the HMR WebSocket (Vite rejected a foreign Host and a cross-origin connection without a token)
- Vite `?raw`/`/@id/` variants
- Markdown fetch paths
- negative-test quality

No disagreement remains, other than finding 2, which is left for the owner.

**Final PR review** (fresh Claude Opus High agent, read-only; the requested GPT-6 Astra reviewer was unavailable because of a provider usage limit):
- One low finding, fixed: absolute-form editor requests bypassed the path check (native local clients only).
- One related renderer issue, fixed: an image nested deeper inside a link still produced nested links, and mixed link text was dropped. No image was ever fetched.
- Deduplication of differently worded phrases that resolve to the same date is intended, and the code comment now says so.
- A production deep link such as `/c/abc` answers 400/404 identically on `82427d2` and this branch. It is pre-existing and unrelated: the client has no path routes.

## O. Residual risk

- Any local process or local OS account can use the loopback API with a native client and read or write history. Fixing this needs real authentication (for example a per-launch secret in a 0600 file, or a Unix socket), which is outside this patch.
- Existing database files created before this change keep their old mode (the eval DBs here are 0644; reviewer finding 2). On a shared machine, run `chmod 700 data && chmod 600 data/reprise.db*` (and the same for `evals/results/*/app.db*`) while Reprise is stopped.
- The HMR WebSocket relies on Vite's own checks, not `admit()`.
- No real-browser DNS-rebinding run was performed. Very old browsers that send neither Origin nor Fetch Metadata on cross-origin POSTs are unsupported (step G8).
- Prompt-injected links still exist as clickable text. The mitigation removes zero-click fetches, not deliberate clicks.

## P. Readiness decision

**Ready for owner review and controlled integration.** All four confirmed findings are closed and verified on the real server, and the Markdown-image channel is closed in a real browser. The reviewer's demonstrated regressions are fixed. Nothing is committed, pushed or merged.

Open owner decisions, none of them blockers for integration:
1. Whether to tighten existing database file modes (finding 2).
2. Whether to add framing headers.
3. Whether to add real authentication if Reprise ever runs on a shared machine.
