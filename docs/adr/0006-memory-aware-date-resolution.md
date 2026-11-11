# Memory-aware deterministic date resolution

Status: Accepted in the master plan (D12, D15).

## Context

Last Tuesday can refer to either of two Tuesdays. Always asking interrupts conversation; always picking one may recall the wrong event.

## Decision

A pure English date resolver produces ordered candidate sets. Recall selects using topic matches in recorded history and supplies the assumption to the model. Never ask the model to perform calendar arithmetic.

## Consequences

Date behavior is table-testable, including timezone and DST boundaries. Numeric and non-English dates are outside scope. When history cannot distinguish materially different answers, clarification may still be needed. A parser that returns only one interpretation was rejected.
