# Strict one tool, recall in code

Status: Accepted in the master plan (D1).

## Context

The challenge permits one model-visible tool. Memory must be available even when the model does not request it.

## Decision

Expose only web_search to the model. Resolve dates and retrieve historical turns deterministically before model execution.

## Consequences

Avoids a recall tool call and makes memory context inspectable. Retrieval can still miss paraphrases; tests must measure those misses. Multiple memory tools were rejected.
