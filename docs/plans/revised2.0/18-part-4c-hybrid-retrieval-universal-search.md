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

# STEP 18 — PART 4C HYBRID RETRIEVAL + UNIVERSAL SEARCH

## Goal

Combine semantic, lexical, and metadata ranking and expose Search Notes.

---

# Shared RetrievalService

Create one service:

```text
RetrievalService.retrieve(user, query)
```

Used later by both:
- `/search/`;
- `/search/answer/`.

Do not duplicate ranking.

---

# Candidate sources

```text
pgvector rank
PostgreSQL FTS rank
metadata/query-hint rank
structured Transaction results
```

Fuse using deterministic rank fusion such as RRF.

Do not directly add incomparable raw scores.

---

# Deterministic tie break

Example:

```text
final_rank DESC
updated_at DESC
id ASC
```

---

# Relevance display

Use:

```text
Relevance 94
```

not:
- confidence;
- probability.

Avoid `%` unless calibrated.

---

# Search endpoint

```text
POST /api/v1/search/
```

Returns:
- parsed mode;
- ranked results;
- deterministic answer if exact analytics;
- no Groq requirement.

---

# Universal Search UI

Global entry:
- Sidebar Search;
- top search bar;
- Cmd/Ctrl+K.

Desktop:
- left Search results immediately;
- right deterministic answer placeholder/area.

Generated RAG comes next step.

Mobile:
- accessible overlay/tabs.

---

# Retrieval evaluation

Create labelled query/result set.

Compare:
- vector-only;
- lexical-only;
- hybrid.

Metrics:
- Recall@K;
- MRR;
- Precision@K;
- nDCG where possible;
- latency.

Do not claim hybrid is best without measurement.

---

# Tests

- fuzzy semantic query;
- exact phrase;
- structured finance query;
- transaction manual result;
- current-user only;
- stale frontend request ignored;
- overlay close aborts where possible;
- relevance order stable;
- no provider dependency.

---

# Acceptance criteria

- [ ] one shared RetrievalService.
- [ ] hybrid ranking measured.
- [ ] Search Notes useful without Groq.
- [ ] structured deterministic answers work.
- [ ] stale responses cannot overwrite current query.
- [ ] user isolation proven.

Wait for:

`IMPLEMENT STEP 19 — STRICT GROUNDED ASK MY NOTES`
