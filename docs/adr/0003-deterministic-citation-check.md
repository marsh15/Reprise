# Deterministic citation checking

Status: Accepted in the master plan (D8).

## Context

A model can invent citations or attach real citations to unsupported numbers. A second model agreeing is not proof.

## Decision

Check source identifiers and the presence of cited numbers and dates in retrieved excerpts using code. Mark invalid, unverified, verified, or unchecked references visibly.

## Consequences

Fast and reproducible without another model call. This checks token presence, not semantic entailment or source quality; a number elsewhere in an excerpt can pass.
