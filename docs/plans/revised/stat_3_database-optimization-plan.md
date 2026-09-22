# DATABASE OPTIMIZATION AND DATA-USAGE PLAN

## Scope

The current database/schema is already implemented from Part 3. This file does not authorize database creation, replacement, schema redesign, new tables, or new columns.

If required data structures are missing, report the mismatch before implementation.

## Data rules to preserve

- Current application user is the ownership root already used by the repository.
- Every user-owned queryset is owner-scoped before serialization.
- Raw Note text remains source data.
- NoteItems are derived structure.
- Type and Domain remain separate.
- Confirmed Transactions are financial truth.
- AI artifacts/logs remain private according to current implementation.
- BYOK secrets are never persisted.
- Money uses Decimal, never float.
- Timed values are timezone-aware.
- Different currencies are not silently summed.
- Current GPS never enters stored search/RAG/Groq context.

## Finance query rules

Use the existing Transaction storage and existing relationships.

```text
balance = SUM(CREDIT) - SUM(DEBIT)
```

For running order use the repository's deterministic transaction ordering; where available prefer:

```text
transaction_at, created_at, id
```

Period filters resolve user-local boundaries before database querying.

AI must not calculate finance totals.

## Search data rules

Search may use existing:
- Note/NoteItem text;
- Domains;
- transaction labels and structured transaction fields;
- existing embedding/vector data;
- existing full-text-search support.

Owner scope must be applied in the database query before ranked results are exposed.

Do not retrieve globally and filter owners in Python.

## Optimization-only database work

Allowed after measurement:
- review `EXPLAIN`/query plans;
- add or tune indexes only when supported by real query patterns;
- tune ORM `select_related`/`prefetch_related`;
- remove N+1 queries;
- limit top-K candidate counts;
- cap RAG context sizes;
- batch safe reads/writes;
- cache process-local embedding/model resources where appropriate;
- use transactions for race-sensitive operations already supported by the schema.

Do not add speculative indexes.

## Index candidates to evaluate, not blindly create

Evaluate indexes around existing fields used by:
- owner + created date;
- item status/type/due time;
- transaction owner + date;
- transaction owner + direction/currency/domain;
- reminder enabled/scheduled fields;
- existing embedding lookup/content hash;
- lexical search columns.

Only apply an index if the field/table already exists and query-plan evidence supports it.

## Concurrency and consistency

Use existing revision/version fields if present to prevent stale AI commits.

Keep provider calls outside long database locks.

Use atomic database transactions for race-sensitive local operations already represented by current models, such as:
- confirmation workflows;
- entitlement counters;
- status changes tied to dependent updates.

Do not invent new persistence fields to solve concurrency under this plan.

## Integrity and privacy verification

Test:
- user A cannot access user B Notes/NoteItems/Transactions/Places/Reminders;
- search candidates are owner-scoped;
- RAG sources are current-user only;
- suspended/disabled accounts follow current auth policy;
- sensitive finance, note, AI, location, and key material do not leak through admin/logging surfaces;
- delete behavior matches the currently implemented schema.

## Acceptance

This optimization pass is complete when:
1. no schema rebuild was introduced;
2. no new database was introduced;
3. query hot paths are measured;
4. justified indexes/query improvements are documented;
5. finance/search outputs remain correct;
6. user isolation passes;
7. no sensitive data is exposed;
8. existing schema behavior is preserved.
