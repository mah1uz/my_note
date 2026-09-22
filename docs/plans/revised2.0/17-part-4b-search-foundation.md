# My Notes — Sequential Execution Step

> Execute this file **only after all previous numbered step files have passed their acceptance gates**.
>
> Before changing code, read:
> 1. `architecture-consistency-roadmap.md`
> 2. `after_part_3_plan.md`
> 3. `future-proof-database-plan.md`
> 4. the relevant reconciled part plan
> 5. this step file
>
> Inspect the actual repository before assuming a planned model/file already exists.

# STEP 17 — PART 4B PGVECTOR + FTS + DETERMINISTIC QUERY PARSER

## Goal

Build retrieval foundations without generated RAG answers.

---

# A. pgvector

Enable extension.

Add/reuse `NoteEmbedding`:

```text
note_item OneToOne
vector(384)
model
version
content_hash
source_updated_at
timestamps
```

Model:

```text
sentence-transformers/all-MiniLM-L6-v2
```

---

# B. Embedding lifecycle

Create for confirmed searchable items.

Regenerate on meaningful searchable changes.

Exclude:
- unconfirmed;
- cancelled/archived according to policy;
- secrets;
- live GPS;
- admin logs.

Add idempotent rebuild command.

---

# C. Query parser

Reuse shared parsing primitives from Part 3.5.

Modular:

```text
money
date
type
status
domain
aggregation
phrase
```

No model intent classifier.

---

# D. Structured analytics

Use PostgreSQL/Django.

Examples:

```text
largest expense
total spending this month
income last month
unfinished tasks
events this week
```

Finance queries use `FinanceTransaction`.

---

# E. PostgreSQL FTS

Search:
- NoteItem text;
- Domain names;
- bounded source Note;
- Transaction labels.

Owner scope in DB query.

---

# Tests

Embedding:
- create/update/delete;
- hash idempotency;
- user scope.

Parser:
- money;
- dates;
- status;
- aggregation;
- quotes;
- regex DoS.

Structured:
- MAX;
- SUM;
- COUNT;
- timezone ranges.

FTS:
- exact lexical match;
- quoted phrase;
- cross-user isolation.

---

# Acceptance criteria

- [ ] embeddings correct/user scoped.
- [ ] FTS works.
- [ ] query parser deterministic.
- [ ] finance analytics use ledger.
- [ ] no Groq dependency for retrieval.
- [ ] no RAG yet.

Wait for:

`IMPLEMENT STEP 18 — HYBRID RETRIEVAL AND UNIVERSAL SEARCH`
