# OpenAI-compatible LLM boundary and model comparison

Status: Accepted in the master plan (D7).

## Context

The project needs streaming tool calls, testable orchestration, and an evidence-based balance of quality, latency, and cost.

## Decision

Use the openai SDK with configurable base URL, API key, model, and optional reasoning effort. Develop against the planned gpt-6-luna default, verify capabilities in M1, and compare models in M2 before the owner selects a winner.

## Consequences

Provider changes remain localized. OpenAI compatibility does not guarantee identical parameter support; verify official contracts and real responses. DeepSeek comparison is optional and uses OpenRouter with the planned residency constraint. No performance or model-availability result is assumed.
