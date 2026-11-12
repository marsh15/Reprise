# Reprise — product design brief

> Understand what we discussed then, and what we can verify now.

This file is the product-design counterpart to the engineering `DESIGN.md`. It records who the interface is for and what it must make people feel and understand. Visual decisions live in `DESIGN-UI.md`.

## Thesis

Reprise is a research notebook that remembers. Every answer is a dated observation: what was said in an earlier conversation, and what fresh web evidence says now. The interface's job is to keep those two kinds of knowledge visibly distinct, and to be honest about how much the evidence actually proves.

Most chat products present every answer as equally current and equally certain. Reprise's interface is useful only if a reader can tell, at a glance and without reading documentation:

1. when something was said or observed,
2. whether it came from memory (an earlier conversation or an earlier observation) or from research done for this answer,
3. whether a cited number or date was mechanically found in the source, not found, not checked, or cited against a source that does not exist,
4. whether the material is labelled demo/fixture data.

## Audience

One person, on their own machine, doing recurring research: comparing vendors and prices over weeks, revisiting technical decisions, asking "what did we decide last Tuesday, and is it still true?". They read carefully, return often, and care more about being right than being fast. They are comfortable with technical detail but should never need to understand the database to read an answer.

Visitor mode: **Read** inside **Operate**. The conversation column is a reading surface; the shell around it is a tool.

## Personality

Considered, articulate, warm, precise, restrained, dependable. Quietly sophisticated. Never flashy, futuristic, playful, corporate or sterile.

The feeling we want: *this tool shows its working.* Calm when nothing is wrong; clear and specific when something is uncertain or broken.

## Design principles

1. **Time is always visible, never loud.** Every message and every observation carries its date in a consistent place. Dates are secondary in weight but precise in content. A conversation date and a source retrieval date are never confused, and a publication date is never presented as the date something became true.
2. **Provenance has a shape.** Memory and fresh research are distinguished by form (hollow versus filled mark) and by words, with colour as a third, redundant cue. The same vocabulary appears in the empty state, recall chips, research summaries and citation cards, so it is learned once.
3. **Uncertainty is designed, not apologised for.** Unverified, unchecked, invalid and unavailable evidence each have a deliberate, calm treatment. None of them looks like a rendering bug, and none of them looks as trustworthy as a successful check.
4. **A check is only a check.** "Numbers and dates found" is never styled as proof. There is no trust score, no green badge of truth, and the limitations sentence is always visible in the card.
5. **Read first, operate second.** The answer column is set for minutes of comfortable reading. Controls are precise and available, but they recede until needed.
6. **Every state tells the truth.** Loading never looks empty; a stopped answer never looks complete; a retry never erases earlier attempts; search failure never hides behind a finished spinner.

## Signature move — the dateline and provenance marks

Reprise's one recognisable idea is a **typographic dateline plus two provenance marks**:

- Each turn is set like a dated notebook entry: on wide screens the date and time sit in a narrow left margin beside the text; on narrow screens they sit on the turn's label line.
- A **filled dot** means *searched for this answer*. A **hollow ring** means *from earlier*: a recalled conversation or a preserved earlier observation. A **dashed outline** means *demo fixture*.
- Inside a citation card, multiple observations of one URL are listed on a short vertical rail of these marks, ordered by retrieval date. The rail never draws an arrow or implies that one observation proves a change.

It is subtle at rest (a margin of small dates), informative on interaction (the card's rail explains each observation) and conservative under ambiguity (a mark only ever restates data the server already provided).

## Explicit non-goals

- Not a ChatGPT/Claude clone: no centred bubble chat, no "How can I help you?" hero, no prompt-category cards.
- No new product features: no timeline view, change detection, trust score, settings backend or account system. Theme preference is local presentation state only.
- No invented relationships: the UI never links a claim to a source, or two observations to each other, beyond what the data states.
- No decoration that carries no information: no gradients, glows, sparkle/robot/orb iconography, paper textures, ambient motion or typewriter effects.
- No hiding of disclosures: fixture labels, verification limits, frozen-clock warnings, search failures and recovery messages keep their wording and stay visible without hovering.

## Product-design decisions made during the redesign

- The browser-native `window.confirm` delete dialog is replaced by an in-app confirmation inside the conversation options menu, with the same wording. Reason: it can be styled, keeps focus local, and is reachable by touch without a modal.
- The thread shows a slim context bar with the open conversation's title and demo label. Reason: on mobile the sidebar is hidden, and on desktop the reader otherwise loses the "which conversation is this?" anchor once scrolled.
- "Answer complete." remains in the live region for assistive technology but is visually hidden after completion. Reason: a permanent completion line under every answer is noise; interim states stay visible.
- A Stop the user started is shown in the warning tone; any other incomplete answer (a failure, or a dropped connection) is shown in the error tone. The wording is unchanged. Reason: stopping is a user decision, not a fault, and alarming styling would misreport it.
- When one answer recalls more than five earlier messages, the recall row shows three plus "Show N more". Reason: memory provenance should not push the answer off-screen. Every target remains one click away and the count is exact.
- Datelines show the calendar date once per day and the time on every turn. Reason: the margin should read as a notebook dateline, not a repeated stamp.
