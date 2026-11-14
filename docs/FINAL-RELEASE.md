# Final release report — 14 November 2026

Closes the acceptance work. [`FINAL-ACCEPTANCE.md`](FINAL-ACCEPTANCE.md) remains the unaltered record of the acceptance measurements (P0 9/11, P1 9/12, live 5/7 by the original assertions). [`ACCEPTANCE-REMEDIATION.md`](ACCEPTANCE-REMEDIATION.md) is the root-cause checkpoint. This file records what shipped, what did not, and what is still imperfect. It does not restate any of those pass rates, and the offline reassessment is not a new run.

**Submission sign-off is the owner's decision.** This report is evidence for it, not the decision.

## What changed

| Area | Change |
|---|---|
| Evaluation, C1 | `uncertaintyDisclosure` also accepts the passive "is/are not established" form, but only for the change, timing, cause, date, terms, packaging, baseline, history or commitment. An unrelated "the current price is not established" stays rejected. |
| Evaluation, C3 | `originalErrorNotLaterChange` accepts "not (evidence of) a later change" only when the answer also names the historical baseline. |
| Production checker, L6 | A date directly governed by `captured` is checked against the excerpt or the cited observation's recorded retrieval time. Published, announced, effective, updated and seen dates keep needing their own support. |
| Citation warning wording, L5 | The card said "Token not found in source" while showing a page title that contained the amount. The checker reads only the excerpt, so the text is now "Not found in the cited excerpt". The state and the semantics are unchanged: the citation stays `unverified`, and a title is still not treated as verification. The client still renders previously stored `not found in source:` details. |
| Tests | 45 new regression tests (21 of the first 44 fail against the unfixed source, and the wording test fails against the old text). One existing assertion was updated for the wording. |

## What was deliberately not changed

- **No prompt change.** See "The prompt decision" below.
- **L5.** The amount was in the fresh observation's title, which the model received. A historical price falsely credited to a fresh source was not demonstrated. The proposed "current amount unavailable" instruction would have been wrong for this evidence, and the checker was not widened to titles.
- **C2** (grouped "respectively" citation): recorded as a checker limitation, with no positional inference added.
- **G1** (derived $10 difference without operand citations): kept as a real citation failure. The derived-citation prototype stays evaluation-only.
- **J2** (a demo record not labelled as demo): kept as a real model-output failure. The existing prompt rule already covers it and the evaluator was not relaxed.
- No scenario-ID special cases, no rewritten fixtures, no new tools, retries, verifier or search loops.

## The prompt decision

One small prompt clarification was authorised, to be added only if the current prompt did not already require it. It already does:

| Requirement | Existing prompt text |
|---|---|
| Publication versus retrieval date | "Distinguish: when the user asked, when you answered, when a page was published, when it was retrieved." |
| A newer retrieval does not make an old page current | "A newer retrieval date alone does not resolve a conflict or make an old publication current." |
| Qualifiers on prices | "Label discounts and introductory versus standard rates." |
| Conflicting or newer evidence | "Do not anchor … resolve conflicting newer evidence or state that the current answer is uncertain", and "disclose the disagreement with both citations". |
| Announcement is not availability | "A feature announcement is not feature availability." |
| Alternative date | "When a chosen date includes an alternative matching date, mention that alternative briefly." |

Each of the four open answer-quality cases is a single-sample failure to follow one of these rules. A sentence that restates them would lengthen every request and move every scenario's context without addressing a gap in the rules. Nothing was added.

## Review of the four answer-quality cases

Classes: (1) factual error, (2) material omission, (3) citation or provenance limit, (4) ambiguity the evidence does not resolve, (5) stylistic.

| Case | Finding | Class |
|---|---|---|
| L6, price qualifier | The HubSpot page says Starter is "normally priced at $20/month per seat" and the answer's "$7 versus $20" verdict never says the page's own normal price is $20. The answer did label the $7 as a promotion with an annual commitment, so the verdict is hedged but incomplete. | 2, medium |
| L6, "recent" | A third-party guide published 21 Oct 2025 and retrieved 14 Nov 2026 was called "a recent … breakdown". The excerpt says its prices were verified on 3 Aug 2026. No date was given in the answer. | 1 (wording), medium-low |
| L7, version conflict | The answer gives 18.6 as the current minor release from the versioning page while its other cited source, dated 12 Nov, announces 18.7. The conflict is not named. The asked attributes are right: major version 18, first release 25 Sep 2025, and 19 stated as a release candidate with general availability planned for 19 Nov. The announcement was not promoted to a release. | 2, low |
| H1, alternative date | The resolver supplied an alternative matching date (10 Nov) and the answer used only 3 Nov. The recalled content is correct and labelled demo. | 2, low |

None is a fabricated fact, a wrong-vendor citation, an invented history or an unsupported current-state claim on the asked attribute. They are disclosed here rather than corrected.

## Validation

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm test` | **748/748**, 47 files |
| `npm run build` | pass (known chunk-size warning only) |
| `npm run eval -- --mock` | **23/23** PASS |
| `npm run eval -- --mock --only R1,R2,R3` | **3/3** PASS |
| Integrated smoke | Local scratch SQLite database, local stub model server, no real provider. A same-origin streamed turn returned the stubbed answer, was persisted and appeared in the history. A cross-origin turn request got 403. A seeded conversation rendered its citation cards, and an unverified one showed "Not found in the cited excerpt: $15, 17". |

Mock passes prove the harness mechanics, not model quality. The smoke exercises the product path, not model answers.

**Live validation was not run.** There was no prompt change to validate, so a fresh attempt would only have been a reroll of a single sample. Model usage this phase: $0.00. Live Tavily searches this phase: 0. The saved live captures from the acceptance run are historical evidence, not new runs, and were not modified.

## Runtime model

`gpt-6-luna` stays. The earlier six-case comparison did not show a material correctness advantage for Sol. This is a practical choice for the take-home, not a statistical claim that Luna beats other models.

## Remaining honest limitations

1. The citation check is lexical and excerpt-only. Titles are shown with a source but not checked, grouped citations are pooled, single-digit numbers are ignored, and a matched number is not entailment. "07:17" yields a bare "17" that no excerpt contains.
2. L6 and L7 answers can omit a source's own qualifier or leave two cited versions unreconciled. The prompt asks for both, and it is a model-behaviour limit at n=1.
3. A demo observation can go unlabelled (J2, n=1).
4. A derived difference can lack operand citations (G1), and a grouped "respectively" citation is not verified per item (C2).
5. Live research depends on what the search provider returns. Pipedrive and Zoho official pricing pages were not found in the live CRM run, and the answer said so.
6. Raw answers and captures stay private (see below).

## Private review material

The human-review packet is `evals/results/acceptance-remediation/review-packet.md` in the acceptance worktree. It holds the 11 P0, 12 P1 and 7 live answers verbatim, with sources, marker associations, dates and a decision table. It is ignored by Git and is not part of the repository.
