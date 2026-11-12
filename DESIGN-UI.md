# Reprise — interface design system

Visual and interaction contract for the Reprise frontend (`src/client/**`). Product intent lives in `PRODUCT.md`; the engineering architecture lives in `DESIGN.md` and is not changed by this work.

Status: **Implemented.** §0–§7 record the direction and research (Stages 1–2). §8–§10b describe what was built (Stages 2 and 4). §11 is the final contract and the Phase 8 review (Stage 5).

---

## 0. Baseline audit (commit `94c710a`)

Screens captured at 1440×900, 390×844 and 320×568 from the dev server with seeded demo data and the offline `qualityPreview` / `memoryPreview` fixtures (scripted LLM and search, no paid calls). Files: `/tmp/reprise-ui-shots/baseline/`.

| Area | Observed problem | Why it matters |
|---|---|---|
| Identity | System sans everywhere, one green, grey right-aligned user bubble, "Ask me anything." hero, boxed suggestion pills. | Reads as a generic chat template; nothing says time, memory or evidence. |
| Hierarchy | Role label, timestamp, research summary and "Answer complete." all render as 12–13px grey/green text of similar weight. "Answer complete." sits permanently under the last answer. | Metadata competes with itself; the eye has no order. |
| Evidence | Invalid `[?]` uses the same green pill as a working citation. Unverified differs only by a faint dotted underline inside the pill. Card content is an unstructured list (Preserved…/Published…/Retrieved…/Demo fixture/check text). | The most important distinctions in the product are the least visible. An invalid marker looks like a link. |
| Evidence (bug) | A citation card opened from a table cell is clipped by the table's horizontal scroll container (card cut off on the left). | Evidence becomes unreadable exactly where numbers are densest. |
| Provenance | Historical and current observations look identical; recall chips are generic rounded pills with a ↺ glyph; many recall chips wrap into several rows above the answer. | Memory vs fresh research — the product's core idea — has no visual language. |
| Typography | No distinction between reading text, UI and metadata; no tabular numerals for dates/prices; `02:00 PM` leading zeros. | Long answers are tiring; dates do not align or scan. |
| Sidebar | Titles truncate at ~150px because a hidden 44px options button always reserves space; selected highlight stops short of the row; demo previews all start with the same "[Demo conversation — ill…" text. | Wasted width; the selection looks broken; rows are hard to tell apart. |
| Delete | Native `window.confirm`. | Unstyled, modal, inconsistent with the app; cannot be captured or themed. |
| Feedback | "Answer stopped." appears in red far below the message it belongs to; Retry is a generic detached button. | The failed turn and its recovery are visually unrelated. |
| Chrome | Saturated yellow full-width clock banner, two lines on mobile. | A test-only warning dominates the composition. |
| Mobile | A large outlined "Conversations" button replaces any header; no brand, no conversation context. Send button sits beside the textarea and narrows it. | Mobile is a compressed desktop, not a designed composition. |
| Empty state | Left-aligned text in a centred column; suggestion buttons indented 4px from the text edge. | Misalignment on the first screen anyone sees. |
| Accessibility | Good bones: skip link, drawer focus trap with inert background, Escape order, live region, labelled tables. Weak: options button invisible until hover, colour/underline-only citation state, 12px hint text, errors communicated mostly by colour. | Keep the behaviour; fix the perceivability. |
| Strengths to keep | 760px reading measure, honest copy, single accent, sticky composer, recall focus/highlight, the existing focus management. | These are the foundation; the redesign must not regress them. |

---

## 1. Direction

### Directions considered

**A. Annotated edition (chosen).** The conversation is set like a carefully typeset research notebook: a warm, light paper-white ground, deep green-black ink, a text serif for the answers people read, a precise sans for everything they operate, and a narrow dateline margin. Evidence appears as marginal-note-like cards with a consistent provenance vocabulary (filled = searched now, hollow = from earlier, dashed = demo). Strength: the product's subject (dated observations) becomes the typography itself. Risk: drifting into "cream + serif + tracked mono labels", the most common AI editorial look.

**B. Archival index.** Cool grey ground, monospace-heavy metadata, index-card citations, a card-catalogue drawer for history. Strength: strong "records" association and dense evidence. Rejected: it is a costume of a tool; monospace reading text is tiring for minutes-long answers; colder than the personality calls for; and the index-card metaphor tempts ruled-paper decoration.

**C. Quiet workspace.** Neutral sans-only, dark-first, Linear-like precision. Strength: polish is easy to reach. Rejected: interchangeable with every AI tool; identity would come only from an accent colour; no expression of time.

### Self-critique of A, and the corrections built into the contract

| Risk | Correction |
|---|---|
| Generic AI editorial (cream, italic serif display, tracked uppercase mono labels, terracotta accent). | No italic display. No uppercase tracked labels except the tiny `DEMO` tag. Mono only for code, keys and the frozen-clock instant. Accent is a deep petrol green, not terracotta. Ground is a neutral warm white with a faint green cast, not cream. |
| Serif used everywhere as "editorial" decoration. | Serif is used for exactly two jobs: the reading text of assistant answers and the wordmark/empty-state statement. Headings inside answers, all UI, labels, dates and source metadata are sans. |
| Dateline margin as a decorative timeline. | The margin carries real timestamps only. No connecting vertical line through the whole thread; no nodes without data. It collapses to an inline label below ~880px column width. |
| Too many semantic hues on a "minimal" screen. | Hues appear only on evidence/state elements and are desaturated; every one is paired with a shape and a word. Large surfaces stay neutral. |
| Usability: margin dates steal width on tablets. | Container query on the thread: gutter only when the thread is ≥ 880px wide. |
| Inconsistency between components. | One radius scale (4/6/10), one hairline colour, one focus treatment, one mark component reused in five places. |

### Product character (summary)

1. **For:** one person doing recurring, comparative research who returns to earlier decisions.
2. **Feeling:** "this tool shows its working" — calm, exact, trustworthy.
3. **Personality:** considered, articulate, warm, precise, restrained.
4. **Metaphor:** an annotated research notebook — dated entries with marginal notes.
5. **Signature:** dateline margin + provenance marks (filled / hollow / dashed), with the observation rail inside citation cards.
6. **Density:** comfortable in the reading column; compact in research details and citation cards; precise, mid-density in navigation.
7. **Typography:** serif to read, sans to operate, tabular sans for time and numbers.
8. **Evidence:** provenance (when/where from) and check status (what was mechanically found) are two separate visual dimensions and are never merged into one colour or score.
9. **Interaction:** quiet at rest, specific on inspection, immediate on input; motion only to show where something came from or went.
10. **Never:** a chat-bubble clone, a dashboard, a landing page, a sci-fi console, a notebook costume (no paper grain, ruled lines, handwriting, page curls).

---

## 2. Direction contract

**THESIS.** Reprise owns *dated provenance*: every turn and every observation says when it was seen and whether it came from memory or from research done for this answer. It refuses the category default of an undated, uniformly confident bubble stream.

**OWN-WORLD.** Warm white paper ground with a faint green cast; deep green-black ink; one petrol-green accent for interaction and focus. Text serif for answers; precise sans for UI; tabular numerals for all dates, times, counts and prices. Hairline 1px borders, radii 4/6/10, almost no shadow (only floating cards and menus). Provenance marks: filled dot (searched now, slate blue), hollow ring (from earlier, plum), dashed square outline (demo, stone grey). Recognisable with all content removed: a margin of small tabular dates beside serif paragraphs, with tiny dots and rings where evidence appears.

**STORY.** The reader sees what they asked and when, reads the answer comfortably, notices at a glance whether it drew on earlier conversations (rings) or fresh searches (dots), and can open any marker to see the source, its publication and retrieval dates, and exactly what was and was not checked.

**FIRST VIEWPORT (empty state, 1440×900).** Left: 272px sidebar on a slightly deeper neutral, wordmark (serif "Reprise" + ring-and-dot mark) at top, "New conversation" button, grouped history, theme control and the on-device note at the bottom. Main: slim context bar (frozen-clock notice when active). Reading column (680px text measure) holds, vertically centred in the space above the composer: a two-line serif statement — "What we discussed then." / "What we can verify now." (second line in secondary ink) — the existing explanatory paragraph, three starting points as quiet rows each led by its provenance mark, and a one-line legend of the marks. The composer is a single raised field docked at the bottom of the column, send control inside it.

**FORM.** Annotated research notebook (direction A, first of three). seed: none (unavailable) — the brief pinned the direction and the impeccable launcher could not run, so no roll was made.

**FINISH.** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance. *(Project adaptation: the design record is this file, `DESIGN-UI.md`; the engineering `DESIGN.md` is out of bounds. No rasters ship.)*

---

## 3. Layout specification

### Shell (desktop ≥ 768px)

```
┌───────────────┬──────────────────────────────────────────────────────┐
│ Sidebar 272px │ [clock notice — 32px, only when REPRISE_NOW is set]  │
│               │ Context bar 48px: conversation title · Demo tag      │
│ Reprise ◦•    ├──────────────────────────────────────────────────────┤
│ [+ New conv.] │      date   │ Reading column (text measure 680px)    │
│               │      gutter │                                        │
│ Today         │      112px  │                                        │
│  Row (sel.)   │             │                                        │
│  Row          │             │                                        │
│ Yesterday     │             │                                        │
│  …            │             │  [ composer, docked, aligned to text ] │
│ ───────────── │             │  Enter to send · Shift+Enter …         │
│ Theme ◐ · note│             │                                        │
└───────────────┴──────────────────────────────────────────────────────┘
```

- Thread content box = gutter (112px) + text (max 680px), centred in the main area. When the thread container is narrower than 880px, the gutter disappears and dates move to the turn label line. Use a CSS container query on the thread, not a viewport media query.
- The composer aligns to the **text** column (not the gutter), so the eye drops straight from the last answer into the input.
- At 1440px the content group is centred; the leftover space is calm margin, not filled with panels.
- Short viewports (≤ 640px tall): context bar 40px, composer padding reduced, clock notice single line with ellipsis on the explanatory part (the instant stays visible).

### Mobile (< 768px)

- Top bar 52px: menu button (hamburger glyph, accessible name "Conversations", keeps `aria-controls="sidebar"` / `aria-expanded`) · conversation title (or wordmark when none) · Demo tag when fixture.
- Drawer slides from the left, `min(320px, 86vw)`, backdrop `ink / 32%`; close button top-right inside the drawer (icon, accessible name "Close conversations"). Existing focus trap/inert/Escape/restore behaviour preserved.
- Gutters 16px (12px at ≤ 360px). Composer full width, safe-area bottom padding, send control inside the field.
- Citation cards become a bottom sheet anchored above the composer (full width minus 12px), max-height 60dvh, scrollable.

### Z-index layers

`base 0 · sticky 10 (context bar, composer) · popover 30 (citation card, options menu) · drawer-backdrop 40 · drawer 50 · skip-link 60`.

---

## 4. Typography direction

No remote fonts or font dependencies. Stacks resolve to high-quality system faces:

- **Reading serif** (assistant answers, wordmark, empty-state statement): `"Iowan Old Style", "Charter", "New York", ui-serif, "Sitka Text", Cambria, Georgia, serif`. Charter/Iowan have generous x-heights and sturdy serifs that stay legible at 16–17px on screen; avoid `Times`.
- **UI sans** (everything operated, labels, metadata, headings inside answers, tables): `ui-sans-serif, -apple-system, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif`. Inter/Roboto are not named (Roboto may still appear as Android's system face).
- **Mono** (code, `kbd`, the frozen-clock instant only): `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace`.
- `font-variant-numeric: tabular-nums` on datelines, research counts/durations, source dates, tables, citation numerals.

Indicative scale (Stage 2 finalises in tokens): 11.5 (tags) · 12.5 (metadata/captions) · 13.5 (UI small, research details) · 14.5 (UI base, sidebar titles, buttons) · 16 (user messages) · 17 (answer reading text; 16.5 on mobile) · 20 (answer h2) · 28–34 (empty-state statement). Answer line-height 1.62; UI 1.4; metadata 1.45. No weight below 400 for content.

User messages are **sans 16px medium (500)** on a quiet sunken block; assistant answers are **serif 17px regular**. The two voices are distinguished by typeface and surface, not by alignment or bubble shape.

---

## 5. Palette rationale (values finalised in Stage 2 with measured contrast)

Strategy: **Restrained** — warm neutrals carry 95% of the surface; one accent; semantic hues only on evidence and state elements.

| Role | Light intent | Dark intent | Notes |
|---|---|---|---|
| Canvas | warm white with faint green cast (≈ `#F7F6F2`) | deep green-charcoal (≈ `#161917`) | not cream, not pure white |
| Sidebar | one step deeper (≈ `#EFEEE8`) | one step lower (≈ `#121412`) | differentiates navigation from reading without a heavy border |
| Raised (composer, cards, menus) | `#FFFFFF` | ≈ `#1F2320` | |
| Ink | charcoal-green (≈ `#1F2622`) | warm off-white (≈ `#E6E4DD`), not pure white | |
| Accent | petrol green (≈ `#266B5B`) | lifted petrol (≈ `#6FB8A4`) | buttons, links, focus, selection |
| Current observation | slate blue | lighter slate | filled dot |
| Historical observation | plum / aubergine | dusty plum | hollow ring |
| Demo fixture | stone grey | stone grey | dashed outline + `DEMO` text |
| Unverified | measured amber/ochre | soft amber | always with dotted underline + words |
| Invalid / unavailable | terracotta | soft terracotta | `[?]`, dashed border, never link-styled |
| Error / destructive | brick red | soft red | |
| Frozen clock | amber-subtle surface | amber-subtle dark | quiet, one line |

Copper was rejected for "historical" because it sits too close to amber (unverified); plum keeps provenance and check status in separate hue families.

---

## 6. Component brief

Markup constraints from existing tests (do not break): research running markup < 450 chars and `aria-live="polite"`; collapsed summary contains auth/quota warnings before `</summary>`; `1 search`, `N source(s)`, `2.0 s` formats; citation card `role="group" aria-label="Source N details"` with exact `<strong><a href=… target="_blank" rel="noopener noreferrer">Title</a></strong>`; `[?]` text for invalid; recall `<button type="button"` with class `recall-chip` rendered before `research-status`, `recall-demo` only for fixtures; sidebar `aria-controls="sidebar"`, `aria-expanded`, `aria-label="Conversation history"`, one `<nav>`, `aria-current="page"`, `Options for {title}`, contiguous text `Demo · {preview}`, history-state copy.

- **Sidebar.** Wordmark (serif, 21px, ring-and-dot mark). "New conversation" is a full-width secondary button with a `+` glyph; keep class `new-chat` (App focuses it after deletion). Group labels 12.5px sans 600 secondary, sentence case. Rows: full-width hit area, 8px radius, title 14.5px ink one line, meta line 12.5px secondary one line; hover = sunken tint; selected = raised surface + 2px accent bar at the left edge + title weight 600 (not colour alone). Options button overlays the right edge (no reserved width): visible on hover, focus-within, selected and always on touch; title gets right padding only while it is visible. Options menu = small popover with "Delete conversation" (destructive text). Choosing it swaps the menu content to an inline confirmation: "Delete conversation and its sources? This can't be undone." + [Cancel] [Delete] (Delete in destructive style, focused first is Cancel). Escape closes and restores focus to the options button; completion keeps the existing focus-to-New-chat behaviour. Footer: theme control + "Conversations are saved on this device."
- **Context bar.** Conversation title (sans 14.5 600) + `DEMO` tag for fixture conversations; empty for a new conversation (show "New conversation" in secondary ink). Never decorative; no actions added.
- **Clock notice.** Keep exact text `Test clock active: now = {instant}` and `role="status"`. One quiet line: amber-subtle background, clock glyph, instant in mono. Not a full-saturation band.
- **Thread / Message.** Each turn = gutter dateline + body. Dateline: date (e.g. `9 Nov 2026`) over time (`10:00`), 12.5px tabular secondary, top-aligned to the label line. Label line: "You" / "Reprise" (12.5px 600 secondary). User body: sans 16/1.55 on sunken surface, radius 10, padding 12px 16px, full text width, `white-space: pre-wrap`. Assistant body: serif 17/1.62, paragraphs 0.85em apart; h1–h3 in sans 600 (20/17/15.5) with more space above than below; lists indented 1.4em with hanging markers; blockquote = 2px hairline left rule + secondary ink; inline code mono 0.86em on sunken tint; code blocks mono 13.5/1.55 on sunken surface, radius 6, horizontal scroll; tables sans 14 tabular, header 600 with bottom hairline, row hairlines, no vertical rules, scroll region keeps its focusable label; links accent with 1px underline offset 2px; long URLs wrap. Spacing: 36px between turns, 20px user → its answer.
- **Outcome line** (interrupted/failed): placed directly under the partial answer; stop-square or warning glyph + existing text; warning/error ink; the partial text keeps full contrast.
- **Turn status / recovery.** Interim statuses ("Sending…", "Thinking…", "Researching…", "Writing answer…") show as a quiet line with a static accent dot; "Answer complete." stays in the live region but is visually hidden. Thread errors render as an inline notice (left 3px error rule, glyph, text) immediately followed by the Retry button styled as a secondary button with a return glyph, grouped visually with the notice.
- **ResearchStatus.** Running: one line, 13.5px secondary, small accent spinner (static under reduced motion), "Searching · {queries}…". Done: `<details>` whose summary is a quiet row — filled slate dot, `N searches · N sources · X.X s`, warnings appended in error ink with a warning glyph, chevron that rotates. Expanded: compact ledger; each query in sans 13.5 500 with status word; sources indented under a hairline, title link (sans 14), meta line 12.5 tabular: `domain · Published … · Retrieved … · Demo`. Errors in error ink with glyph.
- **Citation marker.** Compact inline marker: sans 11.5 tabular, height 1.35em, padding 0 4px, radius 4, slight raise (`vertical-align: 0.12em`), hit area expanded to 28×28 on coarse pointers via pseudo-element. States: verified/unchecked = hairline border, secondary ink; hover/focus = accent-subtle fill. Unverified = amber-subtle fill, amber ink, dotted underline (kept). Invalid `[?]` = terracotta ink, dashed terracotta border, no fill, never underlined. Unavailable (deleted) = dashed neutral border, muted ink.
- **Citation card.** Raised surface, 1px border, radius 10, soft shadow (the only shadow family besides menus), width 320px (max 90vw), padding 14px 16px. Order: title link (sans 14.5 600, external glyph via CSS) · domain (12.5 secondary) · multi-observation note · observation rail (each row: mark + label "Searched for this answer"/"Preserved from an earlier answer" + Published / Retrieved as a 2-column tabular mini-grid + `DEMO` tag + excerpt when multiple) · divider · check line with glyph (verified: neutral check glyph, "Numbers and dates found; meaning not checked."; unchecked: dash glyph; unverified: amber warning glyph). Must not be clipped by table scroll containers: position it with `position: fixed` computed from the marker's rect on open (prefer above; flip below; clamp to the thread's horizontal bounds with 12px margin), recomputed on scroll/resize while open. Mobile: bottom sheet as above. Hover open delay ~80ms, close grace ~120ms so the pointer can travel into the card.
- **Recall chips.** Compact chips (radius 6, not pills) in a wrap row: hollow plum ring + "From {title} · {Wed, 3 Nov}" + `DEMO` tag for fixtures. Hairline plum-tinted border, plum-subtle hover fill, 32px min height (44 on coarse pointer). Navigating highlights the original user message with a plum outline + its dateline turning plum for ~2s (fades; no motion under reduced motion).
- **Empty state.** As in FIRST VIEWPORT. Starting points are borderless rows with mark + text + subtle arrow on hover; first two filled dots (they will search), third a hollow ring (it asks memory). Legend line: "● Searched for an answer   ○ From earlier conversations". `historyEmpty` tip kept.
- **Composer.** One raised field (1px strong border, radius 12, padding 10px 10px 10px 16px) containing the textarea (borderless, 16px sans, 24px line) and a 36px square send button (accent fill, arrow-up glyph, accessible name "Send") bottom-right. Busy: button becomes "Stop" (stop-square glyph + visible word, neutral-strong fill). Focus-within: border becomes accent + 1px accent inner ring (no glow). Disabled: muted fill and border, cursor default. Hint below in 12.5 secondary with `<kbd>` keys (same text content).
- **Theme control.** Three-option segmented control (Light / System / Dark) with text labels, `aria-pressed` buttons inside a labelled group, persisted to `localStorage['reprise.theme']`; inline script in `index.html` applies `data-theme` before first paint; System follows `prefers-color-scheme` live.
- **Iconography.** One small inline-SVG set, 16px box, 1.5px stroke, round caps: plus, menu, close, more (three dots), send-arrow, stop-square, chevron, external, warning, check, dash, return/retry, clock, trash. Marks (dot/ring/dashed) are separate 8–10px glyphs. No emoji, no sparkle/robot imagery.

---

## 7. Reference study

Inspected 12 November 2026 with headless Chrome at 1440×900 (screenshots kept outside the repo in `/tmp/reprise-ui-refs/`). The UIZZE free catalogue was queried first (`ui-radar`); it returned only 256×256 app icons for these products, so it could not answer the questions and the study used the live public products instead.

| # | Product / page (URL) | Observed pattern | Why it works | Where it fits Reprise | Adaptation | Do not copy |
|---|---|---|---|---|---|---|
| 1 | Wikipedia article with Reference Previews — `en.wikipedia.org/wiki/PostgreSQL` | Hovering a bracketed superscript marker opens a small card anchored to the marker with the citation text, an external-link glyph and a settings gear; surrounding text does not move. Markers stack as `[18][19][20]`. | The evidence is one gesture away and never reflows the paragraph. | Citation card. | Keep anchoring and zero layout shift; make the marker a real target (28px on touch) instead of a tiny superscript; add dates and check status. | Blue link palette, the gear, superscript sizing. |
| 2 | Wikipedia revision history — `…/index.php?title=PostgreSQL&action=history` | Each row is keyed by its timestamp (`16:42, 11 November 2026`) as the primary link; size deltas use colour **and** a sign (`+8`, `−28`). | Time is the index of the record; colour is never the only signal. | Datelines; check status. | Dates lead each turn in their own column; every status colour gets a glyph and words. | Parenthesis-link density. |
| 3 | Linear "Now / Changelog" — `linear.app/changelog` (light and dark) | A left column carries the entry date with a small dot on a thin vertical line; the entry title and body sit in a separate column. | Dates are scannable without competing with headings. | Dateline margin. | Keep the separate date column; drop the continuous line (nodes without data would be decoration in a chat). | The orange dot + continuous rail, display-size titles, dark-first stance. |
| 4 | Linear Docs — `linear.app/docs` | Sidebar groups use small grey sentence-case labels; items are one line, ~33px pitch; secondary links sit in a footer separated by a hairline. | Navigation stays precise and light. | Sidebar. | Sentence-case group labels, single-line titles with a quiet meta line, footer for theme + local-storage note. | Icon on every row, card grid. |
| 5 | Perplexity web app, signed out — `perplexity.ai` (light and dark) | The composer is one bordered object with its controls (attach, mode, model, voice, send) inside the field; above it, a centred "What do you want to know?" heading and two suggestion cards. | One object reads as "type here"; controls do not float. | Composer. | Send/Stop inside the field. | The centred question hero and suggestion cards (the category default), the "Ask anything" placeholder. |
| 6 | Notion Help Center — `notion.com/help/guides/publish-notion-pages-to-the-web` | Long-form column ~800px; sections separated by hairlines rather than cards; UI terms set as small bordered inline tokens. | Hairlines give structure without boxes; tokens make UI words scannable. | Answer typography; `kbd`/tags. | Hairline section rules inside answers, bordered `kbd` in the composer hint. | Blue CTA, emoji feedback buttons. |

**Not observed (stated rather than invented):** Perplexity's answer page and citation hover (would require submitting an automated query to their service); Claude's conversation view (requires sign-in; public share links were not browsed because current reporting shows they are used for malvertising); Arc (a desktop app — its website shows only marketing). Their help centres were read, but neither has screenshots of the answer/citation UI; they only state that answers carry numbered citations linking to sources.

**Adopt.** (1) Evidence anchored to its marker, one gesture away, with zero reflow (Wikipedia). (2) Time as a separate typographic column that indexes the record (Linear changelog, Wikipedia history). (3) The composer as one object with its controls inside it (Perplexity).

**Reject.** (1) The centred question hero with suggestion cards. (2) A continuous decorative timeline rail with a dot for every entry. (3) Tiny superscript citation targets and colour-only status signals.

**Original decision.** Provenance marks — filled (searched for this answer), hollow (from earlier), dashed (demo) — are kept separate from check status (found / not found / not checked / no source), and the same vocabulary runs from the empty state through recall chips, research summaries and citation cards.

## 8. Tokens *(Stage 2 — as built)*

Single source of truth: `src/client/tokens.css`. No other stylesheet contains a colour literal, a raw z-index or a font stack; the only hex values outside it are the two `theme-color` metas in `src/client/index.html` (a meta tag cannot read CSS variables; `theme.ts` rewrites them for an explicit Light/Dark choice). Stylesheets are linked from `index.html` in cascade order: `tokens.css`, `base.css` (reset, buttons, marks, utilities), `shell.css` (sidebar, drawer, top/context bars, notices, composer), `thread.css` (reading column, dateline gutter, messages, prose, empty state), `evidence.css` (research status, recall chips, citation markers and card).

**Notation and structure.** Hex (the project's existing notation), semantic tokens only (`--color-canvas`, `--color-text-secondary`, `--color-current-ink` …). There is no separate primitive hue ramp tier: two hand-tuned themes repoint the same semantic names, and a ramp nothing imports would be dead weight. Names describe a job (`--color-nav-selected`), never a hue or a component.

**Theme mechanism (one).** `:root` = light; `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` = System in dark; `:root[data-theme="dark"]` = explicit dark; `:root[data-theme="light"]` pins `color-scheme: light`. `color-scheme` is set per theme so native inputs, scrollbars and form controls follow. The dark declaration list exists twice (CSS cannot share it between the two selectors); the two copies were checked to be identical (59 tokens). System = no attribute, so OS changes apply live with no JavaScript. An inline script in `index.html` sets `data-theme` before first paint from `localStorage['reprise.theme']` (try/catch); `theme.ts` owns the control, cross-tab sync and the `theme-color` metas.

### Surfaces, text, borders, accent

| Role | Token | Light | Dark |
|---|---|---|---|
| Canvas | `--color-canvas` | `#f7f6f2` | `#161917` |
| Sidebar | `--color-sidebar` | `#efeee8` | `#121412` |
| Raised (composer, cards, menus, selected nav) | `--color-raised`, `--color-nav-selected` | `#ffffff` | `#1f2320` |
| Sunken (user message, code, hover) | `--color-sunken` | `#ecebe4` | `#0f110f` |
| Overlay backdrop | `--color-overlay` | ink 32 % | black 55 % |
| Text / secondary / muted / disabled | `--color-text`, `-secondary`, `-muted`, `-disabled` | `#1b231f` `#46514b` `#56605a` `#8c938e` | `#e6e4dd` `#b4b9b2` `#9aa19a` `#5c625d` |
| Borders: hairline / strong (inputs) / divider | `--color-border`, `-strong`, `--color-divider` | `#dad8cf` `#7e847b` `#e3e1d9` | `#2c312d` `#7b837b` `#262b27` |
| Accent / hover / pressed / subtle / on-accent | `--color-accent`, `-hover`, `-pressed`, `-subtle`, `--color-on-accent` | `#22695a` `#1b5649` `#144538` `#e1eee9` `#ffffff` | `#6fb8a4` `#86c7b5` `#9ad2c2` `#1e3029` `#0f1d18` |
| Focus ring / selection | `--color-focus`, `--color-selection` | `#22695a` / `#c6e0d6` | `#7fc4b0` / `#264236` |
| Stop button (neutral solid) | `--color-neutral-solid`, `-hover`, `--color-on-neutral-solid` | `#46514b` `#3a453f` `#ffffff` | `#b4b9b2` `#c3c8c1` `#0f110f` |

Stage 4 lowered the chroma of the dark error and unverified fills (`#341f1e` to `#2b2120`, `#332a14` to `#2e2916`) so recovery notices are quieter in dark; every pair below was re-measured afterwards.

Disabled text is exempt from contrast requirements (WCAG 1.4.3) and is paired with a visibly different fill and `cursor: default`.

### Semantic roles (ink on subtle, plus border/mark where a shape depends on it)

| Role | Ink | Subtle | Border / mark | Dark ink / subtle / border-mark |
|---|---|---|---|---|
| Current observation (filled dot, slate blue) | `#2b5683` | `#e5ecf4` | border `#a9bfd8` (decorative), mark `#3a6ea5` | `#9dbfe6` `#1c2733` `#3c5470` / `#7fa9d8` |
| Historical observation (hollow ring, plum) | `#74386c` | `#f3e8f1` | border `#cfaeca` (decorative), mark `#7a3e72` | `#d2a9cc` `#2d2030` `#5b4260` / `#c08fba` |
| Demo fixture (dashed, stone) | `#575b54` | `#e9e8e2` | dashed border `#858880` | `#aeb1a8` `#232622` `#7f837b` |
| Research in progress | = accent | | | = accent |
| Verified / check found (restrained) | `#365a4c` | `#e4ede8` | | `#a5cdbb` `#1d2a24` |
| Unverified (amber) = warning | `#744d00` | `#f7ebc6` | dotted/state border `#a57610` | `#e3bc6a` `#2e2916` `#a38340` |
| Invalid / unavailable (terracotta) | `#9a4420` | `#f8e7dc` | dashed border `#b3603c` | `#e79c79` `#34231b` `#b07458` |
| Success | `#2a6a3b` | `#e2f0e5` | | `#8ccb9a` `#1c2c21` |
| Error | `#a02727` | `#f9e4e1` | border `#b65c56` | `#ee9a94` `#2b2120` `#b06b66` |
| Destructive (solid + on) | solid `#a02727` / hover `#8a1f1f` / on `#ffffff` | | | `#e58b84` `#ee9a94` / on `#1f0e0d` |
| Frozen-clock notice | `#5a4100` | `#f4e8c1` | | `#e6cb86` `#2c2512` |

Hue separation (OKLCH hue of the light inks, computed): accent 176, success 150, slate blue 251, plum 332, amber 76, terracotta 42, brick red 26. Terracotta and brick red are 16 degrees apart, so they are additionally separated by lightness/chroma and by shape (dashed `[?]` marker border versus left rule + warning glyph); success is 26 degrees from the accent; the success tokens are defined as the brief required but no current screen renders them. Plum is far from amber, so provenance and check status never share a hue family.

### Measured contrast (computed from `tokens.css` itself with the WCAG 2.x relative-luminance formula; worst case across the listed backgrounds)

| Pair | Target | Light | Dark | Measured on |
|---|---|---|---|---|
| Body text | 7:1 | 13.45  | 12.51  | canvas, sidebar, raised, sunken |
| Secondary text | 4.5:1 | 6.92  | 7.97  | canvas, sidebar, raised, sunken |
| Muted text | 4.5:1 | 5.46  | 6.02  | canvas, sidebar, raised, sunken |
| Accent text/link | 4.5:1 | 5.58  | 6.87  | canvas, sidebar, raised |
| Accent on accent-subtle | 4.5:1 | 5.44  | 6.01  | accent-subtle |
| On-accent (Send) | 4.5:1 | 6.49  | 7.50  | accent, accent-hover, accent-pressed |
| On neutral solid (Stop) | 4.5:1 | 8.27  | 9.50  | neutral-solid, neutral-solid-hover |
| On destructive (Delete) | 4.5:1 | 7.46  | 7.42  | destructive-solid, destructive-solid-hover |
| Focus ring (non-text) | 3:1 | 5.58  | 7.90  | canvas, sidebar, raised |
| Input border (non-text) | 3:1 | 3.30  | 4.07  | canvas, sidebar, raised |
| Current ink on subtle | 4.5:1 | 6.39  | 7.95  | current-subtle, canvas, raised |
| Current mark (non-text) | 3:1 | 4.91  | 6.49  | canvas, raised |
| Historical ink on subtle | 4.5:1 | 6.98  | 7.56  | historical-subtle, canvas, raised |
| Historical mark (non-text) | 3:1 | 7.04  | 5.97  | canvas, raised |
| Demo ink on subtle | 4.5:1 | 5.65  | 7.04  | demo-subtle, canvas, raised |
| Demo dashed border (non-text) | 3:1 | 3.33  | 4.12  | canvas, raised |
| Verified ink on subtle | 4.5:1 | 6.45  | 8.55  | verified-subtle, canvas, raised |
| Unverified ink on subtle | 4.5:1 | 6.30  | 8.07  | unverified-subtle, canvas, raised |
| Unverified border (non-text) | 3:1 | 3.74  | 4.45  | canvas, raised |
| Invalid ink on subtle | 4.5:1 | 5.42  | 6.72  | invalid-subtle, canvas, raised |
| Invalid dashed border (non-text) | 3:1 | 4.17  | 4.16  | canvas, raised |
| Success ink on subtle | 4.5:1 | 5.53  | 7.77  | success-subtle, canvas, raised |
| Error ink on subtle | 4.5:1 | 6.12  | 7.22  | error-subtle, canvas, raised, sunken |
| Error border (non-text) | 3:1 | 4.17  | 3.90  | canvas, raised |
| Frozen-clock ink on subtle | 4.5:1 | 7.83  | 9.60  | clock-subtle |
| Text on selection | 7:1 | 11.50  | 8.62  | selection |

Every row meets its target in both themes (no failures). Body text is 12.5:1 or better everywhere (target 7:1); the lowest secondary-text pair is 6.92:1 (light, on the sunken user-message surface); non-text boundaries and the focus ring are at least 3.30:1. State-carrying shapes (dashed invalid/unavailable marker borders, the DEMO tag outline, the unverified border, the error rule) were raised to at least 3:1 so they stay perceivable without the text. Decorative hairlines (`--color-border`, `--color-divider`, the current/historical chip borders) are intentionally below 3:1: they never carry meaning alone, since every one is paired with a mark, a glyph and words.

### Type, space, shape, motion, layout, layers

- **Families** exactly as section 4 (`--font-serif`, `--font-sans`, `--font-mono`).
- **Scale (rem, so browser font-size preferences apply):** `--text-2xs` 11.5 · `-xs` 12.5 · `-sm` 13.5 · `-base` 14.5 · `-table` 14 · `-md` 16 · `-read-sm` 16.5 (phones) · `-read` 17 · `-h1/-h2/-h3` 20/17/15.5 · `-wordmark` 21 · `-display` clamp 24–34 (24 only on the narrowest phones). Leading: read 1.62, user 1.55, UI 1.4, meta 1.45, code 1.55, display 1.18. Weights 400/500/600.
- **Spacing** (4px base): 2 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 36 · 40 · 48 (`--space-0-5` … `--space-12`).
- **Radius:** 4 / 6 / 10 / 12 (`--radius-xs/sm/md/lg`), `--radius-full`; borders 1px, accent 2px, notice rule 3px.
- **Elevation:** only `--shadow-popover` (citation card, options menu) and `--shadow-drawer`; both soft (10 % ink light, 40–50 % black dark, which reads as the same quiet lift on the darker ground).
- **Motion:** fast 100ms, base 160ms, slow 220ms, drawer 240ms; `--ease-out` cubic-bezier(.2,.7,.2,1), `--ease-in-out`, `--ease-standard`. One `prefers-reduced-motion` reset (`animation/transition: none !important`) is the only `!important` in the client.
- **Focus:** `--focus-width` 2px, `--focus-offset` 2px, colour `--color-focus`.
- **Layout:** sidebar `clamp(272px, 17rem, 40vw)` (272 at default size, grows with the user's font size), gutter 112, measure 680, composer max height 218, context bar 48 (40 on short viewports), mobile top bar 52, drawer `min(320px, 86vw)`, touch target 44, citation marker hit area 28, card width 320.
- **Layers:** base 0 · sticky 10 · popover 30 · drawer-backdrop 40 · drawer 50 · skip-link 60 (the `sticky` layer is defined but unused: the context bar and composer are flex siblings of the scroll region, not positioned).

### Implementation notes that differ from the Stage 1 text (flagged)

1. **Thread container is `.chat`, not `.thread`.** `container-type: inline-size` applies layout containment, which makes the container the containing block for `position: fixed` descendants. The citation card must be fixed (so table overflow cannot clip it) and sits inside the scroller, so the container query lives on the `main.chat` wrapper (the pane that also holds the context bar and composer). The card's coordinates are translated by the measured origin of the fixed containing block (`floating.ts`), so placement stays correct if that ancestry changes.
2. **Sidebar rows use the 6px radius**, not 8px, to stay on the 4/6/10/12 scale.
3. **Dateline text is locale formatted** (`Nov 9, 2026` / `10:00 AM` in en-US) rather than the literal `9 Nov 2026` / `10:00`; the recall chip keeps its `Wed, Nov 11` form because an existing test asserts `Nov 3`.
4. **Composer textarea starts at one row** (baseline: two) so the 36px send button sits on the same line; it still auto-grows to 218px.
5. **Empty-state scroll guard.** The existing scroll-to-bottom effect in `Thread.tsx` now skips the empty thread (`state.messages.length` is required). Without it, a 320x568 viewport opened scrolled past the heading. Follow behaviour for any thread with messages is unchanged.

## 9. Motion *(Stage 4 — as built)*

**Principle.** Motion shows where something came from or went, or confirms an input. It never decorates, never runs on streamed text, and never delays an action. Everything below is CSS (no animation library): `transform`/`opacity` except one sanctioned height transition. Reduced motion is handled once in `base.css` (`animation: none; transition: none` for every element) plus two explicit opt-outs listed in the table.

**Tokens (extend section 8).** Durations: fast 100ms (press, hover, popover exit), base 160ms (popover enter, small fades, selection), slow 220ms (details ledger), drawer 240ms, highlight-out 700ms. Curves: `--ease-out` cubic-bezier(.23, 1, .32, 1) for entering/exiting; `--ease-drawer` cubic-bezier(.32, .72, 0, 1) for the panel; `--ease-in-out` cubic-bezier(.77, 0, .175, 1) is defined for on-screen movement but no component currently uses it; `--ease-standard` = `ease` for hover/colour; `--press-scale` 0.96.

| # | User action | Purpose | Animated property | Duration token | Easing token | Reduced motion | Interruption |
|---|---|---|---|---|---|---|---|
| 1 | Press a button, chip, icon button, menu item | Feedback: the interface heard the press | `transform: scale(.96)` | fast (100ms) | ease-out | no scale; the colour change remains | CSS transition: releasing early retargets from the current scale |
| 2 | Hover or focus a control | Feedback / affordance | `background-color`, `border-color`, `color` | fast (100ms) | ease | unchanged (instant) | transition |
| 3 | Hover on touch | none | gated behind `@media (hover: hover)`: no sticky hover after a tap | n/a | n/a | n/a | n/a |
| 4 | Select a conversation in the sidebar | State indication: which row is open | row `background-color`/`border-color`; accent bar `opacity` + `transform: scaleY(.4 to 1)` | fast / base | ease / ease-out | instant | transition: clicking another row retargets both |
| 5 | Open or close the drawer (mobile) | Spatial consistency: it slides from and back to the left edge | `transform: translateX` on the panel; `opacity` on the backdrop (kept mounted so it also fades out) | drawer (240ms); backdrop base (160ms) | ease-drawer; ease-out | instant open/close | transitions: a second toggle mid-slide reverses from the current position |
| 6 | Open the options menu | Preventing a jarring change | `opacity` (animation) | fast (100ms) | ease-out | none | one-shot; closing is instant |
| 7 | Hover or focus a citation marker | State indication: the card is attached to this marker | card `opacity` (position is fixed in JS, so no transform) | enter base (160ms); exit fast (100ms) | ease-out | none | transition: leaving before it finishes fades from the current opacity; leaving faster than entering keeps the paragraph uncluttered |
| 8 | Expand/collapse the research ledger | Spatial consistency: the rows come from the summary | `::details-content` `block-size` (the one height transition; user-triggered, never during streaming) + chevron `transform: rotate(180deg)` | slow (220ms); chevron base (160ms) | ease-out | none (explicit opt-out for the pseudo-element) | transition: re-clicking mid-way reverses; browsers without `::details-content` open instantly |
| 9 | Research starts | State indication: a search is running | `opacity` fade-in of the running line; spinner `transform: rotate` (only continuous motion; ends when research ends) | base (160ms); spinner 0.8s linear | ease-out; linear | line instant; spinner static | one-shot; spinner removed when research finishes |
| 10 | Recall chip navigates to the earlier message | Spatial consistency: where the jump landed | `outline-color` on the user message and `color` on its dateline | in: base (160ms), hold 2s (existing timer), out: highlight-out (700ms) | in: ease-out; out: ease | highlight appears and disappears instantly (the 2s hold is unchanged) | transition: a second navigation re-runs from the current colour |
| 11 | An error or recovery notice appears | State indication: something needs attention (rare) | `opacity` + `translateY(4px to 0)` | base (160ms) | ease-out | none | one-shot keyframes on mount (rare, so restart-on-retrigger is harmless) |

**Deliberately not animated.**
- **Message appearance and sending.** A user turn is re-keyed from `pending` to the server id, which would replay an entrance. It is also the highest-frequency event in the app.
- **Streaming answer text.** No typewriter and no per-token work. The live region text only changes on state transitions.
- **Stop/Send swap and the options-to-confirm swap.** Instant state changes read more clearly than a crossfade.
- **Theme switching.** No global colour transition: it would repaint every surface late and make the change feel sluggish; the instant change is the feedback.
- **Keyboard actions** (Enter to send, Escape to stop or close): no motion.
- **Scroll-follow**: unchanged and instant.

**Verification (Chromium, offline fixtures).** Computed values sampled at +70ms and at rest: the drawer panel moves -320px to -36px (70ms) to 0px, closing 0 to -263px (70ms) to -320px, and the backdrop opacity follows. The ledger `block-size` transition is 0.22s with the pseudo-element opted out under `reduce`. The citation card transition is 0.1s closed and 0.16s open, and 0s under `reduce`. A pressed `.btn` computes to `matrix(0.96, ...)`, and `none` under `reduce`. The spinner's `animation-name` is `spin`, and `none` under `reduce`. The recall highlight outline reads transparent, then plum 160ms after the click, then fades with alpha 0.62 / 0.12 / 0 at 150 / 400 / 1200ms after the class is removed. Not done: a perceptual feel-check at slowed playback on a real device; the timings follow the guide ranges but were judged from computed values and screenshots, not by hand on a phone.

**Polish pass (concentric radii, hit areas, states).** Composer field radius 12 with 6px padding gives a 6px send/stop radius (concentric); the field is 48px tall. Options menu radius 10 with 4px padding gives 6px items; the segmented theme control radius 6 with 2px padding gives 4px segments. Hover is gated to `(hover: hover)` everywhere, and every control has hover (pointer only), `:active`, focus-visible and, where meaningful, disabled and selected states. The row options button has a 40px hit area on desktop (pseudo-element) and 44px on coarse pointers; citation markers have a 28px hit area on coarse pointers; theme segments are 32px tall (44 on coarse). Text wrapping: `balance` on headings and the empty-state statement, `pretty` on paragraphs, list items, the empty-state lede and the sidebar note. Tabular numerals on datelines, counts, dates and table cells.

## 10. Accessibility record *(Stage 4 — as built)*

Audited in headless Chromium against the dev server and the offline fixtures (scripts in `/tmp/reprise-ui-shots/`, not in the repository). WCAG 2.2 criteria are cited by number.

### Checks and results

| Area | Check (how) | Result |
|---|---|---|
| Keyboard | Tab walk from a fresh load, light and dark (32 stops in an open conversation) | Logical order: skip link, wordmark, New conversation, each row and its options button, theme control, research summary, each citation marker then its card then the card link, composer. No positive tabindex. |
| Skip link | Tab once, Enter | First stop, visible, moves focus to `#chat` (2.4.1). |
| Focus visible | Computed outline (or composer-field ring) at every stop, both themes | 0 stops without a ring (2.4.7). Ring colour is `--color-focus` at 5.58:1 or better against canvas, sidebar and raised (1.4.11). |
| Focus clipped | Geometric check of every ring against every scroll/overflow ancestor (desktop, empty, mobile, open drawer) | 0 clipped rings. |
| Focus restoration | Scripted: drawer (Escape order, restore to the menu button), options menu (Escape and Cancel restore to the options button), delete (focus to New conversation), citation Escape (stays on the marker), recall navigation (focus on the earlier user message with a visible cue) | All pass. |
| Modal behaviour | Drawer open: `aria-modal="true"` only then, background `inert`, Tab trapped, no trap when closed | Pass. Closed drawer is `visibility: hidden`, so it is out of the tab order and the accessibility tree. |
| Focus not obscured | Mobile bottom sheet over a focused marker | **Found and fixed** (see below). |
| Composer | Name, linked hint, Enter, Shift+Enter, IME Enter (`isComposing`), Escape to stop | Textarea named "Message", `aria-describedby` points at the hint. Shift+Enter inserts a newline; Enter during composition does not send; Escape stops a running answer. |
| Announcements | MutationObserver on `.turn-status` through a stopped answer; on the research line through a full research turn | Status text changes only on state transitions ("Sending", "Thinking", "Writing answer", cleared). Not per streamed token. The research line announces once. "Answer complete." is in the live region, visually hidden. |
| Errors | `role="alert"` notices | Present; text unchanged ("Answer stopped." etc.). |
| Names and landmarks | Chromium accessibility tree (CDP) on desktop empty, desktop conversation, mobile | 0 unnamed interactive elements. Landmarks: banner (mobile top bar), complementary "Conversations", navigation "Conversation history", main "Conversation". Exactly one `h1` per view: the empty-state statement, the context-bar title (desktop) or the top-bar title (mobile). |
| Automated | Lighthouse accessibility (navigation mode, empty state) | 100 on desktop and 100 on mobile. Lighthouse covers only the initial state, so conversation states were covered by the scripted checks above. |
| Contrast, rendered | Every visible text node: colour against its composited background, light and dark, six screens (empty, seeded, ledger open, citation card open, quota + recall + warning, delete confirm) | 0 failures (1.4.3). Lowest measured: 5.44:1 light (citation card), 6.01:1 dark. Token-level table in section 8. |
| Non-text contrast | Focus ring, input border, marks, state-carrying dashed/dotted shapes | Each at least 3:1 (section 8). |
| Colour independence | Every state pairs colour with a shape or words: filled dot / hollow ring / dashed DEMO tag; unverified = dotted underline + amber; invalid = `[?]` + dashed border; failures = glyph + words; selected row = accent bar + border + weight; theme option = border + weight (1.4.1) | Pass by construction; forced-colors run below confirms the shapes survive without colour. |
| Target size | Mobile controls, rendered size plus pseudo-element hit areas | Everything is at least 24px (2.5.8). 44px for navigation, menu and composer buttons on coarse pointers. Citation markers are inline (exempt) and get a 28px hit area on coarse pointers. Desktop options button 32px with a 40px hit area. |
| Zoom / reflow | 720x450 at deviceScaleFactor 2 (200% browser zoom); root font-size 200% at 1440 and at 390; 320x568; 768x600 | No document-level horizontal overflow in any (1.4.4, 1.4.10). Composer reachable in all. **Fixes below.** |
| Text spacing | line-height 1.5, letter-spacing .12em, word-spacing .16em, paragraph spacing 2em at 320 and 1440 (1.4.12) | No overflow or clipping that hides text. |
| Reduced motion | `prefers-reduced-motion: reduce` computed values: drawer, ledger, card, press scale, spinner, highlight | All transitions and animations are 0s/none; the spinner is static (2.3.3 is AAA; honoured anyway). Cross-checked in section 9. |
| Forced colours | `forced-colors: active`, light and dark base | **Found and fixed** (see below). Dashed borders, the dotted underline, glyphs and words survive on their own. |
| Dark theme | Contrast run on the same six screens; screenshots | Pass. |

### Findings and fixes

| Severity | Finding | Criterion | Fix | Re-verified |
|---|---|---|---|---|
| HIGH | On a phone the bottom sheet could cover the very marker holding focus. | 2.4.11 Focus Not Obscured | `Citation.tsx`: scroll the marker clear of the sheet; if the thread cannot scroll, rest the sheet at the top. | Focused markers 1, 3, 5 with the thread scrolled to the end: no overlap; for marker 5 the sheet moved to the top. |
| HIGH | In forced-colours mode the selected sidebar row lost its accent bar (background is forced to Canvas), unselected rows gained a visible border (transparent borders are forced visible), so selection was carried only by font weight. The pressed theme option had the same problem; the spinner arc and status dot collapsed; the `outline: transparent` user bubble became a permanent heavy outline, hiding the recall highlight. | 1.4.1, 1.4.11 | Last block of `evidence.css`: system-colour overrides (Canvas / Highlight / CanvasText / GrayText) for the row, bar, theme option, spinner, status dot, marks and the bubble outline. | Screenshots and computed styles under emulated forced colours. |
| MEDIUM | At 200% font the sidebar controls overflowed or wrapped badly, icons stayed 16px beside doubled text, the top and context bars (fixed height) and the textarea (24px line-height) did not follow the text, and the clock instant overflowed a 390px screen. | 1.4.4, 1.4.10 | Sidebar width `clamp(272px, 17rem, 40vw)`; theme control wraps; icons in rem; bars use `min-height`; textarea `line-height: 1.5`; clock instant wraps as a last resort instead of overflowing (the disclosure is never truncated). | Overflow probe: `scrollWidth` equals viewport width at 390 and 1440. |
| MEDIUM | On mobile a conversation view had no `h1` (the context bar is hidden there). | 1.3.1 (heading structure, advisory) | The top-bar title is an `h1`; the context bar is hidden at that width so there is never more than one. Full titles also carry a `title` tooltip where they truncate. | Accessibility tree at 390px. |
| LOW | Drawer wordmark link was 21px tall. | 2.5.8 | `min-height: 32px`. | Measured 32px. |
| LOW | Hover styles stuck after a tap on touch screens. | 1.4.13-adjacent usability | All hover rules gated behind `@media (hover: hover)`. | Source check. |

### Known remaining and not performed

- Hovering one marker while another has keyboard focus shows two cards at once (as in the baseline); they are both dismissible and neither covers its own marker.
- The citation marker's accessible name ("Source 1") does not contain its visible text ("[1]"); the digit is shared, the brackets are punctuation (2.5.3, borderline). Kept because the label text is asserted by tests and read well.
- **Not performed:** real screen readers (VoiceOver, NVDA, JAWS, TalkBack); real Windows High Contrast themes and real forced-colour palettes (only Chromium's emulation); real touch devices; voice-control testing; colour-vision-deficiency simulation (colour independence was reasoned from the design and checked by the shape cues in screenshots, not simulated); axe-core (not installed, no dependencies may be added; Lighthouse's axe-based audit was used instead).

## 10b. Break-ui findings *(Stage 4)*

Method: a single synthetic worst-case dataset, served by `page.route` from `/tmp/reprise-ui-shots/break/` (never written to the repository, every payload validated against the `src/shared` schemas), mixing every catalogue row. Where the backend sets a limit it was used as the realistic bound: titles about 61 characters, previews 100, up to ten recalled turns, 8000-character messages, 300-character search queries. Longer values (150-character titles, 300 conversations) were also used and are labelled as beyond the backend limits.

Dataset: 300 conversations (empty title, one letter, 150-character title, long URL as a title, Arabic, Japanese, Vietnamese, emoji, HTML-like and template-like punctuation, diacritics); a thread with a 2,850-character user message with a 326-character unbroken URL and Arabic and CJK paragraphs, a 10-column table with a long note column, a very long single-line SQL statement, nested lists, a broken markdown image, a 70-character unbroken word; 14 sources with a 190-character title, null titles and dates, an excerpt of 400 characters, demo flags and two dated observations of one URL; verified, unverified, unchecked, invalid and unresolvable markers, ten markers in a row; six searches covering ok, empty, quota, timeout and skipped; twelve recall chips; interrupted and failed turns; 1-character and emoji-only messages.

Matrix: 1440, 1024, 768, 390, 320 wide, light and dark. Every combination asserted no document-level horizontal overflow (`scrollWidth <= viewport width`), no off-screen elements outside scroll containers, every one of 25 citation cards inside the viewport and not covering its own marker, the options menu inside the viewport on the first and the last of 300 rows, an 8,000-character draft capped at 218px with the composer still in view, and no console or page errors.

### Breaks found and fixed

| # | Break | Worst-case value | Fix | Re-verified |
|---|---|---|---|---|
| 1 | A wide Markdown table with one long-text column laid out at a squeezed width: cells became slivers and some rows were hundreds of pixels tall. | An 8-row table whose Notes cell holds a 90-character sentence | `thread.css`: `table { width: max-content; min-width: 100% }`, `td { max-width: 24rem }`; the region scrolls horizontally. | Screenshot at 1440 and 390: compact rows. |
| 2 | RTL text had no bidi isolation: Arabic sidebar titles truncated at the wrong end and sat left-aligned, and a pure Arabic paragraph in an English answer aligned left. | Arabic title; Arabic paragraph; mixed Arabic, CJK and emoji paragraph | `unicode-bidi: plaintext` on sidebar titles and previews, the context and top-bar titles, recall titles, ledger queries, answer blocks, the user bubble and the composer; `text-align: start` replaces `left`. | Sidebar and recall screenshots: Arabic aligns right and truncates on its logical end; Latin-first paragraphs stay LTR. |
| 3 | Up to ten recall chips (backend: six date turns plus four topic turns) pushed the answer far down the page, especially on mobile. | 12 chips with long titles | `RecallChip.tsx`: `RecallRow` collapses lists longer than five to three chips plus a "Show N more" toggle (`aria-expanded`); five or fewer are unchanged. Test-asserted chip markup untouched. | 390px screenshot: three chips and "Show 9 more". |
| 4 | An empty title produced a blank sidebar row, an unnamed row button and "Options for " with no title. | `title: ""` | Fallback "Untitled conversation" in the row, the options and delete names, and both title bars (`Sidebar.tsx`, `Thread.tsx`, `App.tsx`). | Accessibility tree: "Options for Untitled conversation". |
| 5 | On coarse pointers the options button's extra 4px hit-area pseudo-element made the history list scroll horizontally by 3px. | Any list on a phone | Coarse pointer: `::after { inset: 0 }`; list `overflow-x: hidden`. | Overflow audit: no spill on the list. |
| 6 | At 200% font the clock instant overflowed a 390px screen. | Test clock banner | `overflow-wrap: anywhere` on the instant (still unbroken unless it cannot fit; never truncated). | Probe: `scrollWidth` equals viewport width. |

### Held up (no change needed)

- Rapid switching among eight conversations with responses arriving out of order (odd rows deliberately 700ms late): the thread, title and selected row always matched the last click; no errors. Mobile drawer open/switch/reopen loops ended closed and not inert.
- OS theme change (System mode) while the drawer, an options menu with its delete confirmation, or a citation card was open: all stayed open and placed. An explicit theme change inside the drawer kept it open. Draft survives theme change (section 8 checks).
- All 25 citation cards (verified, unverified, unchecked, invalid, unresolvable, multi-observation, long title, null date) stayed inside the viewport at all five widths and both themes, never covered their marker.
- Options menu inside the viewport on rows 1 and 300 at every width; flips above near the bottom.
- Unbroken URLs, a 70-character word, long inline code and a long SQL line: wrap or scroll inside their own block with no page overflow.
- Emoji-only and one-character messages and conversations; CJK, Vietnamese diacritics, accents; HTML-like and template-like strings render as text.
- A broken Markdown image degrades to its alt text.
- An 8,000-character draft caps at 218px and scrolls inside the field.
- 200% font with the worst-case data at 1440 and 390: no document overflow.

### Fragile or out of scope (not fixed)

- **List size.** All rows are rendered (no virtualisation, by existing design). Measured here: 300 rows first row at about 0.9s with a 139ms worst long task; 1,000 rows 192ms; 3,000 rows 350ms. Fine at realistic sizes; would want paging or virtualising at several thousand.
- **Titles longer than the backend produces** (about 61 characters) are ellipsised in the sidebar with no tooltip; the full title is in the context and top bars (as a tooltip) and in the first message.
- **Remote Markdown images.** The renderer allows `https:` image URLs, which makes the browser fetch from a third-party host. That is a privacy and security decision in the Markdown pipeline, outside this redesign; flagged for the engineering owner.
- **Cards.** Hover plus focus on different markers can show two cards (see section 10).

## 11. Final design contract, do-not-use patterns and trade-offs *(Stage 5 — Phase 8 review of the built UI)*

This section closes the design system so that another engineer can extend the interface without inventing styles. The values live in §8 (tokens), §9 (motion) and §10 (accessibility). These are the rules for using them.

### Rules for extending the interface

- **Product character and signature.** Annotated research notebook (§1–§2). The one signature is the dateline margin plus the three provenance marks: filled = searched for this answer, hollow = from earlier, dashed = demo. A new feature reuses these marks only when the data states that provenance. It never introduces a fourth mark or reuses one for another meaning.
- **Typography.** Serif is used only for assistant answer text, the wordmark and the empty-state statement. Everything operated or scanned is sans, and every date, time, count, price and table cell uses tabular numerals. Mono is used only for code, `kbd` and the frozen-clock instant. Use the type scale in §8; no new sizes.
- **Spacing.**
  - 4px base scale only.
  - Use more space above a heading than below it.
  - 36px between turns and 20px from a user turn to its answer.
  - Groups that belong together (outcome line, notice, Retry) sit 8–12px apart.
  - Content and metadata never touch: at least 4px.
- **Surfaces and elevation.**
  - Canvas carries reading. The sidebar is one step deeper. Raised white (dark: lifted charcoal) is for things you type into or that float. Sunken is for user turns, code and hover.
  - Only floating layers (citation card, options menu, drawer) get a shadow, from the two shadow tokens.
  - Separate regions with 1px hairlines, never with nested cards.
  - Radii are 4/6/10/12, and an inner radius equals the outer radius minus the padding.
- **Component hierarchy.** Shell (sidebar, then context bar plus notices, then thread, then composer) → turn (dateline, label, body) → evidence (recall row, research summary/ledger, inline markers, citation card). Evidence elements sit inside the turn they belong to and never float free of it, except the citation card while it is open.
- **Evidence and status presentation.** Provenance (where an observation came from) and check status (what was mechanically found) are separate dimensions with separate hue families: blue/plum/stone for provenance; neutral/amber/terracotta for check status. Every status pairs colour with a shape (dotted underline, dashed border, glyph) and words. The limitation sentences in the card are always visible. Nothing is styled as proof: there is no green "verified" badge and no score.
- **Responsive rules.**
  - The gutter appears only when the `.chat` container is at least 880px wide; below that, datelines are inline.
  - Below 768px: top bar plus drawer, and the citation card becomes a bottom sheet that never covers its marker.
  - No disclosure, error or status text may be truncated. It wraps.
  - At 320px with 200% text, nothing scrolls horizontally at document level.
- **Accessibility requirements.**
  - Every control has a visible focus-visible state in both themes and in forced colours.
  - Touch targets: 44px for navigation and composer controls, 28px minimum for inline markers.
  - Live regions announce state transitions only, never streamed text.
  - Focus traps exist only in the mobile drawer.
  - Reduced motion removes movement but keeps every state change visible.

### Do-not-use patterns (rejected during design and review)

- Chat bubbles aligned left and right; a centred "How can I help?" hero; prompt-category cards.
- Gradients, glows, glassmorphism, ambient or decorative motion, typewriter text, bouncing dots, staggered list entrances.
- Sparkle, robot, orb or magic-wand imagery; emoji as interface icons; mixed icon styles. Use one inline-SVG set (16px box, 1.5px stroke).
- Uppercase tracked labels (the only exception is the tiny `DEMO` tag), italic display serif, paper or notebook textures, ruled lines.
- A continuous timeline rail through the thread, with nodes that carry no data. Arrows, directional connectors or "from → to" styling between observations, because they imply a change the data does not prove. (The card's short, non-directional grouping line that joins the observations of one URL is allowed. It says only "these are observations of the same source".)
- A single colour or score that merges provenance and check status. Green "verified" badges.
- Colour-only status. Truncated warnings. Hiding disclosures behind hover alone. (The card also opens on focus and tap, and the limitation text never needs a hover to be found.)
- New look presets, new hues outside the token table, raw colour literals or z-index values outside `tokens.css`.

### Known trade-offs

- **Test-locked markup.** Citation markers keep the bracketed `[N]` text and `aria-label="Source N…"`. The recall chip date keeps the `Wed, Nov 3` form. The sidebar preview keeps the literal `Demo · {preview}` text, so the demo cue in rows is a word rather than the dashed tag.
- **Locale dates.** Datelines are locale-formatted (en-US shows `Nov 9, 2026`). This is correct for users but differs from the editorial `9 Nov` style in the Stage 1 sketch.
- **Repeated recall chips** are shown, not deduplicated, because each is a distinct navigation target. More than five are collapsed behind "Show N more", which is an honest count with no chip lost.
- **The research summary mark is a filled dot whenever a search ran**, even if every search failed, because the mark records provenance, not success. Failure is carried by the warning glyph and words in the same row.
- **Stop versus failure tone.** The warning tone is used only for a Stop the user started. A dropped connection that also leaves an `interrupted` reply stays in the error tone.
- **No virtualised history list.** 300 rows perform well; very large histories (thousands of rows) would need it.
- **System fonts only.** No font dependency was permitted, so the serif renders as Iowan/Charter on Apple platforms and Cambria/Georgia elsewhere. The character survives the fallbacks, but the exact texture varies by OS.
- **Outside this redesign's scope.** The Markdown renderer allows remote `https` images (a privacy decision for the engineering owners).

### Phase 8 review verdict (Opus, read-only, on the Stage 4 build)

Reviewed against §2 and the anti-slop checklist across `/tmp/reprise-ui-shots/stage4/` (all states in both themes, plus 92 worst-case, zoom and forced-colours captures).

- **Identity.** Recognisable with the name hidden: serif answers beside a margin of tabular dates, small dots and rings at evidence. No generic assistant styling, no arbitrary gradients or glows, no oversized rounded cards, no emoji or decorative icons. One accent, consistent radii, and shadows only on floating layers.
- **Evidence.** Invalid, unverified, unchecked and unavailable are each distinct by colour, shape and words. Historical and current observations are distinct in cards. The table-cell clipping bug is gone.
- **Consequential issues found, assigned to Stage 6:**
  1. **Two citation cards can be open at once** (one on hover, one on focus) and overlap each other (`worst-case/forced-light-conversation.png`). Required: only one card is visible at a time, and the most recently activated marker wins.
     Corrected in Stage 6: a small module-level claim/yield coordinator in `src/client/components/Citation.tsx`; whichever marker is hovered or focused last claims, and every other marker dismisses its own card without moving focus (Escape, focus restoration, aria wiring and positioning unchanged).
  2. **Inconsistent time format.** The research ledger shows `02:00 PM` (2-digit hour) while datelines and cards show `2:00 PM`. Required: use the same numeric-hour format everywhere.
     Corrected in Stage 6: `src/client/components/ResearchStatus.tsx` now formats the retrieved time with `hour: 'numeric'`, matching datelines and cards (`sourceDateLabel` unchanged).

No other material issue found. With these two corrected, the design is approved for final verification.
