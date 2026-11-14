# Architecture script

## Spoken script (~60 seconds)

Minimi tests what we said then and what changed since. Reprise keeps both records.

Before the model runs, code resolves supported date phrases in the user's timezone and searches SQLite for relevant past turns and their sources. Ambiguous dates come with an explicit assumption. Raw messages remain authoritative; keyword recall can miss paraphrases.

One model has one tool, web search, in a loop bounded by rounds, queries and research time. Answers stream to the user, and searches and source observations are saved in an evidence ledger.

Code checks citation markers and whether recognizable numbers appear in the cited excerpts. That is a useful warning, not proof of meaning. A dated source can establish a price change; two observations alone establish a difference.

I skipped routers and embeddings to keep this path inspectable. Offline tests exercise these boundaries. A final one-run real-model evaluation did not pass every scenario, so the remaining limits are documented rather than hidden; the runtime model is gpt-6-luna.

## Screen outline

Use explicitly labelled offline fixtures until live verification passes; the screen must not imply real provider results. This is an outline only, not a recorded or submitted video.

1. Show a dated recall and its stated assumption; point to the raw past turn.
2. Show research progress and a citation card with historical and current observations.
3. Show an unverified citation or missing evidence, then the ledger and bounded loop.
4. Close on the offline evaluation categories and the documented live-evaluation limits (docs/FINAL-RELEASE.md).
