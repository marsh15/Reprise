# Built-in SQLite on Node 24 or newer

Status: Accepted in the master plan (D11).

## Context

A local single-user app needs durable transactions and keyword recall without database service setup or native addon installation.

## Decision

Use node:sqlite DatabaseSync with FTS5 on Node >=24. Probe both during preflight. Use plain SQL, WAL, foreign keys, and explicit transactions when persistence is added in M1.

## Consequences

One local file and no ORM or native npm addon. Older Node versions fail with an actionable message. Single-process writes and local-user assumptions limit scalability.
