# Reprise glossary

| Term | Meaning |
|---|---|
| Conversation | A thread of turns, with a title |
| Turn | One user message plus the assistant reply to it |
| Observation (Source) | A web result Reprise saw: URL, title, excerpt, published date (if known), retrieved-at time |
| Evidence ledger | Searches and observations tied to the turns that used them. New observations do not replace old ones; deleting a conversation removes its records. |
| Recall | Retrieving past turns and observations from Reprise's own store. Internal; *not* an agent tool. |
| Recall packet | What recall hands to the model for one turn |
| Date resolution | Turning a phrase ("last Tuesday") into concrete local date(s), with the assumption made |
| History start | The local date of the earliest stored message |
| Verified change | A change a source explicitly states and dates |
| Observed difference | A past observation differs from a current one, with no evidence of when or whether the underlying fact changed |
| No established change | Available evidence does not demonstrate a change; this does not prove that nothing changed |
| Unable to verify | Missing, insufficient, conflicting or unreliable evidence prevents a conclusion |
| Citation check | A mechanical check of source markers and recognizable numerical/date tokens, not proof of meaning or truth |
| Fixture | Demo data inserted by `seed:demo`, always labelled, never presented as real memory |
| Research round | One model step that issued ≥1 search |
| Search budget | The hard caps on rounds, queries and time per turn |
