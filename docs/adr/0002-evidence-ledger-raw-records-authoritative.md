# Raw records and an evidence ledger

Status: Accepted in the master plan (D2).

## Context

Rechecking an old answer requires both the original words and the evidence available at that time. Summaries can lose those details.

## Decision

Keep timestamped raw messages and an append-only ledger of searches and source excerpts as authoritative records. Derived indexes and citation checks can be rebuilt.

## Consequences

Preserves provenance without a second extraction call. Context must be bounded as histories grow. Summaries and structured LLM fact extraction are deferred; user-requested conversation deletion remains supported.
