# PROJECT ROADMAP AND ARCHITECTURE CONSISTENCY

## Purpose

Use the existing Part 3 database/auth/schema as the foundation. Later parts add behavior, search, intelligence, reminders, evaluation, and product polish without re-platforming the frontend or rebuilding the database.

## Canonical roadmap

```text
Parts 1-3
Existing frontend + Django + existing database/auth/schema
        |
Part 3.4
Foundation verification and hardening only
        |
Part 3.5
Transactions logic + parser/merge + personalization + onboarding
        |
Part 4
Hybrid Search + Strict Grounded RAG
        |
Part 5
Places + Reminders + Active-session Location Context
        |
Part 6
Smart Dashboard + Evaluation + Hardening + Deployment
```

## Non-negotiable implementation boundary

Do not:
- migrate frontend framework;
- create/replace databases;
- create new ownership/auth foundations;
- add tables/columns from old plans automatically;
- re-run completed Part 3 migrations.

Allowed database work:
- indexes justified by measured queries;
- query optimization;
- constraints/integrity verification already supported by the current schema;
- transaction/concurrency improvements that do not require schema redesign;
- explain/query-plan analysis.

If code expects a missing table/field, report it as a repository mismatch.

## Final product/navigation terminology

```text
Dashboard
  Overview
  Tasks
  Events
  Shopping
  Transactions
  Study

Search
Places
Settings

Logout
```

No permanent top-level `Your Space`.
`Expenses` is a filter/tab inside Transactions.

## Finance authority

Use the existing authoritative Transaction implementation for:
- balance;
- income;
- spending;
- largest expense;
- finance summaries;
- structured finance search;
- dashboard finance facts.

Rules:
- CREDIT means money in;
- DEBIT means money out;
- amount is positive;
- different currencies are never silently summed;
- calculations are deterministic;
- period boundaries use the user's timezone;
- AI never silently overwrites a confirmed transaction.

## Note analysis pipeline

```text
Raw Note
  -> deterministic pre-parser
  -> Groq structured analysis
  -> schema validation
  -> deterministic/Groq merge
  -> user review
  -> confirmed structured state
```

Explicit facts such as amount, currency, clear direction, and explicit date/time are not silently overridden by Groq.

## Search architecture

```text
POST /api/v1/search/
  -> deterministic parsing
  -> structured query or hybrid retrieval
  -> ranked results
  -> deterministic answer where possible

POST /api/v1/search/answer/
  -> reparse/retrieve current-user evidence
  -> strict context construction
  -> Groq only when synthesis is needed
  -> validate sources before display
```

Deterministic SUM/MAX/MIN/AVG/COUNT and exact filtering bypass Groq.

## Search ranking

Use:
- lexical/full-text rank;
- semantic/vector rank when existing vector support is available;
- metadata/hint rank;
- rank fusion such as RRF.

Do not add new vector tables/extensions under this plan. If vector storage is absent, report the blocker.

Use `Relevance 94`, not `94% confidence`, unless calibrated probability exists.

## Query parser

Keep deterministic parsing modular:

```text
MoneyParser
DateParser
TypeParser
StatusParser
DomainParser
AggregationParser
PhraseParser
```

When uncertain, rank broadly instead of adding an unsafe hard filter.

## Location boundary

Live GPS:
- browser memory only;
- no movement history;
- no embeddings;
- no RAG;
- no Groq;
- no analytics logs;
- no coordinates in URLs.

Saved Place metadata may be used only according to existing application data rules.

## Implementation gates

### Part 3.4
- current auth works;
- current ownership works;
- user isolation passes;
- private admin boundaries pass;
- existing migrations/schema remain untouched.

### Part 3.5
- finance calculations deterministic;
- note/transaction review logic correct;
- parser/merge rules tested;
- BYOK/trial behavior correct where already supported;
- onboarding/preferences work;
- no schema creation.

### Part 4
- structured search works;
- lexical/vector/hybrid retrieval measured where supported;
- `/search/` works without Groq;
- strict RAG validates current-user sources;
- provider failure does not break retrieval.

### Part 5
- reminders/Places use existing persistence only;
- location mode defaults OFF;
- no movement history;
- nearby Shopping works;
- GPS never reaches RAG/Groq.

### Part 6
- deterministic priority;
- grounded briefing;
- finance/search consistency;
- retrieval/RAG evaluation;
- accessibility;
- security/privacy review;
- performance review;
- production smoke tests;
- documentation consistency.
