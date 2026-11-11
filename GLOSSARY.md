# Reprise glossary

| Term | Meaning |
|---|---|
| Conversation | A thread of turns, with a title |
| Turn | One user message plus the assistant reply to it |
| Observation (Source) | A web result Reprise saw: URL, title, excerpt, published date (if known), retrieved-at time |
| Evidence ledger | All searches and observations, tied to the turns that used them. Append-only. |
| Recall | Retrieving past turns and observations from Reprise's own store. Internal; *not* an agent tool. |
| Recall packet | What recall hands to the model for one turn |
| Date resolution | Turning a phrase ("last Tuesday") into concrete local date(s), with the assumption made |
| History start | The local date of the earliest stored message |
| Verified change | A change a source explicitly states and dates |
| Observed difference | A past observation differs from a current one, with no evidence of when or whether the underlying fact changed |
| Fixture | Demo data inserted by `seed:demo`, always labelled, never presented as real memory |
| Research round | One model step that issued ≥1 search |
| Search budget | The hard caps on rounds, queries and time per turn |
