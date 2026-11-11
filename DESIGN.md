# Reprise: time, memory and evidence

Reprise is a local chat agent for past conversations and changing web information. Answers are dated observations: what was said and the evidence available then.

## Execution

```text
Browser -> validated turn -> SQLite user record -> date resolution + recall
        -> one model <-> web_search -> streamed answer -> citation checks
        -> atomic answer + evidence commit -> browser reconciles from SQLite
```

Code resolves supported English dates in the user's IANA timezone and retrieves raw turns through local-date indexes and FTS5. Topic-matching history selects ambiguous candidates with an explicit assumption. The model receives recent messages, bounded recalled turns and observations, a conversation index and history start. Missing history is explicit; the prompt forbids fabricated memories and searching for private conversations. Compliance remains probabilistic.

One model chooses searches, compares evidence and writes. Its only tool is `web_search`: concurrent queries, three rounds, five queries per round, ten per turn, eight seconds per search and a 25-second research deadline. Exhaustion permits an answer-only step; the deadline excludes that final stream. Tool calls reset drafts. Cancellation persists interrupted attempts; request identities support replay and retries reuse the user message. A transaction saves the answer and ledger before announcing completion.

## Consequential decisions

Calendar arithmetic and retrieval belong in code for reproducibility and inspection, though keyword recall can miss paraphrases. Original timestamped messages establish what was said; summaries never replace them. Fresh retrieval creates a distinct observation with its own identity, excerpt and retrieval time. Publication and effective dates remain separate facts.

Each immutable observation gets a citation marker, including repeated URLs. An explicit reference index helps the model preserve source identities. Code flags unknown markers, missing numerical/date tokens and explicit mismatches against known source subjects; table cells are checked separately. Publication/retrieval metadata supports only named date roles. These warnings do not establish meaning, source quality, arithmetic or complete attribution. The UI discloses these limits.

Change classification remains a model judgment under explicit rules: a source establishing and dating a change supports **verified change**; differing past/current observations support **observed difference**. Matching observations establish only checked attributes; missing/conflicting evidence requires uncertainty. Prices require comparable tiers, units, seats, currencies and billing commitments.

## Alternatives and limits

Routers, multi-agent pipelines and a second-model verifier add calls and failure points without demonstrated benefit here. Embeddings add retrieval machinery; summaries lose provenance. Model-native search hides evidence needed for the ledger and replay. A framework would obscure the small bounded loop; Next.js adds conventions without a needed capability. Built-in SQLite avoids a database service and native npm addon.

Accepted limits: single user/process, no authentication, English date rules, bounded keyword recall, excerpt-only evidence, no resumable streams, and possible model mistakes. Offline tests and scripted scenarios validate mechanics, not conversational quality. Live providers work, but grounding failures block P0 acceptance. Model selection remains open; the provisional model is unproven.

With another week: first resolve live failures and complete human review, then prioritize structured price observations, archived evidence and paraphrase recall.
