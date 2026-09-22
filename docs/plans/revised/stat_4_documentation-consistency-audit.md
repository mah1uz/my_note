# DOCUMENTATION CONSISTENCY AUDIT

## Purpose

Keep documentation aligned with the repository that already completed database/auth work in Part 3.

Documentation must not instruct implementation agents to rebuild the database, remigrate ownership, or change frontend framework.

## Global rule

When docs disagree with the actual implemented Part 3 schema/auth foundation:
1. inspect the repository;
2. document the current implementation;
3. do not create missing historical-plan schema automatically;
4. report genuine mismatches separately.

## 1. Architecture/auth docs

Verify current docs accurately describe the existing:
- authentication/session flow;
- current-user resolution;
- owner-scoped Django API boundary;
- staff/admin separation;
- secret handling.

Remove stale descriptions of retired auth flows only when confirmed by code.

Do not redesign auth while updating documentation.

## 2. API docs

Document endpoints that actually exist.

Current logical groups may include:
- Notes/AI review;
- Transactions/finance summary;
- preferences/AI entitlement;
- search and search answer;
- Places/reminders.

Do not invent endpoints because an older plan listed them.

## 3. ERD/schema docs

Regenerate or update diagrams from the actual repository schema only.

Do not use documentation work to create or alter database tables/fields.

Historical diagrams may remain if clearly labelled historical.

## 4. AI design docs

Document actual behavior for:
- raw Note as source;
- deterministic pre-parser;
- schema validation;
- deterministic/Groq merge;
- review/confirmation;
- BYOK privacy;
- entitlement behavior if implemented;
- transaction suggestions;
- no silent overwrite of confirmed financial truth.

Do not expose sensitive AI artifacts through documentation examples copied from real users.

## 5. Finance docs

Use one authority consistently:

```text
confirmed Transaction = financial truth
NoteItem finance fields = extraction/source context
```

Document:
- CREDIT/DEBIT semantics;
- deterministic balance;
- currency separation;
- timezone-aware periods;
- user confirmation;
- search/dashboard consistency.

## 6. Search/RAG docs

Document:

```text
POST /search/
POST /search/answer/
```

where these routes are implemented.

Keep:
- deterministic parser;
- lexical/vector/hybrid retrieval as actually supported;
- owner-scoped candidates;
- deterministic analytics bypass;
- strict grounded context;
- source validation;
- abstention;
- relevance is not probability.

Do not claim vector/hybrid support if the repository does not contain it.

## 7. Location/reminder docs

Document actual web limitation:
- active-session reminders;
- Location Mode opt-in/OFF by default;
- no movement history;
- live GPS browser-only;
- GPS excluded from RAG/Groq/logging.

Do not claim native/background push if it does not exist.

## 8. Frontend docs

Describe the existing frontend stack only.

Remove framework-migration instructions from active plans.

Keep product/navigation terminology:

```text
Dashboard
Tasks
Events
Shopping
Transactions
Study
Search
Places
Settings
```

No active-doc `Your Space` architecture.

## 9. Database docs

Replace schema-creation roadmaps with optimization/verification guidance:
- query plans;
- N+1 removal;
- measured indexes on existing fields;
- ORM relation loading;
- bounded search/RAG queries;
- concurrency/integrity checks;
- user-isolation tests.

Do not list future tables/columns as implementation instructions.

## 10. Deployment docs

Use the current project's actual frontend hosting, Django backend, existing database, Supabase/Auth configuration, and environment variable names.

Do not reintroduce alternate database providers or frontend frameworks without an explicit separate architecture decision.

## 11. Files to update as implementation progresses

Update only when behavior actually changes:
- README;
- architecture;
- API;
- ERD;
- authentication;
- AI design;
- finance design;
- search/RAG;
- location/reminders;
- deployment;
- testing/evaluation;
- frontend architecture;
- motion/UX.

## Final rule

Historical plans may remain for traceability but must be clearly marked historical/superseded. Active documentation must describe the repository as it exists and must not trigger database or framework migrations that the project has already completed or rejected.
