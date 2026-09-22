# PROJECT ROADMAP & ARCHITECTURE CONSISTENCY — SOURCE OF TRUTH

## Project
AI Context-Aware Note-Taking Web Application — My Notes

## Purpose

This document resolves conflicts between the older Parts 1–6 plans and the newer
Transactions / Personalization / Onboarding plan.

For future implementation work, use the precedence below.

## Source-of-truth precedence

When two documents disagree, use this order:

1. `future-proof-database-plan.md` — reconciled edition in this plan pack
2. `part-03-5-transactions-personalization-onboarding.md`
3. `part-04-nextjs-hybrid-search-strict-rag.md`
4. `part-05-nextjs-reminders-location.md`
5. `part-06-nextjs-final-production.md`
6. `fluid-interactive-website-prompt.md`
7. older Part 1–3 plans as historical implementation records

Older `part-04-semantic-search-rag.md`, `part-05-reminders-location.md`,
and the older React-focused `part-06-final-production.md` are historical plans.
Do not use them to override the reconciled roadmap.

---

# Canonical roadmap

```text
Parts 1–3
React/Vite + Django + Notes + Groq extraction/review
        ↓
Part 3.4
PostgreSQL + UUID ownership + Supabase Auth cutover
        ↓
Part 3.5
Transactions + Personalization + AI entitlement + Onboarding
        ↓
Part 4
Vite → Next.js + Hybrid Search + Strict Grounded RAG
        ↓
Part 5
Places + Reminders + Active-session Location Context
        ↓
Part 6
Smart Dashboard + Evaluation + Hardening + Deployment
```

Part 3.5 is deliberately before Part 4. Therefore Part 3.5 must not depend on:
- Next.js
- TypeScript
- TanStack Query
- Universal Search
- pgvector
- FTS
- RAG
- Part 5 Places/reminders
- Part 6 What Matters Now implementation

It may define contracts that those later parts consume.

---

# Canonical product/navigation terminology

After Part 3.5, the final information architecture is:

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

----------------
Logout
```

There is no permanent top-level `Your Space` route after Part 3.5.

The Dashboard contains a reusable `Categorized Summary` with:
- Tasks
- Events
- Shopping
- Transactions
- Study

Part 4 may make the Dashboard group collapsible and premium, but it must preserve
this information architecture rather than restoring `Your Space`.

---

# Canonical finance model

The financial source of truth after Part 3.5 is:

```text
finance_transactions
```

A Transaction is a confirmed ledger record.

```text
direction = CREDIT | DEBIT
amount = positive NUMERIC
```

`NoteItem` remains source/context and semantic extraction data.

Existing `NoteItem.item_type = EXPENSE` may remain for backward compatibility
with Part 3 extraction, but it is not the source of truth for:
- balance
- monthly income
- monthly spending
- largest expense
- finance dashboard totals
- structured finance search

Those calculations must use `finance_transactions`.

Income is never represented as a negative expense.

User-facing finance destination:

```text
Transactions
  All
  Expenses
  Income
```

---

# Canonical transaction confirmation model

Do not store unconfirmed suggestions as ledger Transactions.

```text
Raw Note
  ↓
deterministic pre-parser
  ↓
Groq structured analysis
  ↓
validated suggestion/review state
  ↓
user confirms
  ↓
finance_transactions row
```

Therefore every row in `finance_transactions` is authoritative/confirmed.

For a Note-derived transaction:
- `note_item_id` links to source context
- one transaction maximum per NoteItem in V1
- delete source NoteItem → cascade its derived transaction

Manual Transactions:
- belong directly to AppUser
- `note_item_id = NULL`
- are confirmed immediately after valid submission

---

# Canonical transaction fields

Minimum target:

```text
finance_transactions
  id UUID PK
  user_id UUID FK -> app_users
  note_item_id UUID NULL UNIQUE when non-null
  primary_domain_id UUID NULL FK -> domains
  direction CREDIT | DEBIT
  amount NUMERIC(18,4) > 0
  currency CHAR(3)
  label VARCHAR(255)
  transaction_at TIMESTAMPTZ
  source_kind AI_NOTE | MANUAL | OPENING_BALANCE
  created_at
  updated_at
```

`primary_domain_id` is the finance reporting category.

For Note-derived transactions it may default from the confirmed NoteItem's
primary Domain, but becomes transaction-owned/editable data once confirmed.

---

# Opening-balance rule

V1 allows at most one opening-balance record per user per currency.

A positive opening balance is `CREDIT`.
A negative starting position is represented as a `DEBIT` amount.

Do not create a second hidden balance field.

Balance is always derived:

```text
opening balance
+ CREDIT
- DEBIT
```

---

# Timezone rule

All date-range calculations such as:
- this month
- last month
- today
- this week

must resolve boundaries in `AppUser.timezone`, then query PostgreSQL using
timezone-aware timestamps.

Do not use UTC calendar boundaries for a user whose timezone is not UTC.

---

# Canonical search architecture

Part 4 must separate retrieval from generated answering.

```text
POST /api/v1/search/
  -> deterministic parsing
  -> structured query or hybrid retrieval
  -> ranked results
  -> deterministic answer when possible

POST /api/v1/search/answer/
  -> accepts the user query, not trusted source IDs
  -> backend reparses/retrieves current-user evidence
  -> strict grounded Groq synthesis only when needed
```

Benefits:
- Search Notes renders without waiting for Groq
- provider failure does not break retrieval
- cancellation/loading is simpler
- generated answers cannot trust arbitrary client-provided source IDs

For deterministic queries such as SUM/MAX/COUNT, `/search/` should return the
answer directly and the frontend should not call Groq.

---

# Canonical relevance semantics

Hybrid search may normalize its ranking for display, but it is not probability.

Use:

```text
Relevance 94
```

not:

```text
94% confidence
```

Avoid `%` unless calibration is explicitly implemented and evaluated.

---

# Canonical query-parser structure

Do not build one giant regex module.

Use modular deterministic parsers such as:

```text
QueryParser
  MoneyParser
  DateParser
  TypeParser
  StatusParser
  DomainParser
  AggregationParser
  PhraseParser
```

and a typed intermediate representation.

The same principle applies to the Part 3.5 Note pre-parser.

---

# Canonical Next.js auth/data boundary

After Part 4 migration:

```text
Supabase JS browser session
       ↓
current access JWT
       ↓
Client Components / TanStack Query
       ↓
Django REST API
```

Use Server Components where they genuinely help with shell/static structure.

Do not force authenticated Django data fetching into Server Components if that
requires awkward browser-token forwarding.

Do not move Django business logic into Next.js route handlers.

---

# Canonical location boundary

Live GPS:
- stays in browser memory
- is never persisted as movement history
- is never embedded
- never enters RAG
- never goes to Groq
- never appears in analytics logs

Part 6 What Matters Now receives deterministic backend base ranking.

When Location Mode is active, Part 5 may expose a client-only nearby saved Place.
The frontend may apply a small, explainable shopping boost locally.

No live coordinates are required by the priority backend.

---

# Reminder limitation

V1 reminders are active-session/browser reminders.

The product must state this honestly:

> Browser reminders work while My Notes is open/active. Full background push
> while the browser is closed is not part of the V1 capstone.

Do not imply native/background scheduling that does not exist.

---

# Canonical deployment target

Current project direction:

```text
Next.js frontend  -> Vercel or comparable
Django backend    -> Render/Fly/comparable
PostgreSQL        -> Supabase PostgreSQL
Auth              -> Supabase Auth
Groq              -> backend integration / session-only BYOK
```

Google OAuth may be developed locally before deployment.
During deployment, production frontend origins and redirect URLs must be added
to Google Cloud and Supabase Auth configuration.

---

# Documents known to be historical/stale

The following ideas are historical and must not be reintroduced by later work:

- top-level `Your Space`
- `Expenses` as the authoritative financial model
- finance totals from `NoteItem.amount`
- Neon as the assumed database when Supabase PostgreSQL is already selected
- Vite environment variables in the production Next.js plan
- one combined slow search+Groq HTTP response
- Part 4.5 numbering
- Part 5/6 plans that assume the old navigation
- live GPS entering backend search/RAG
- an intent-classifier model for query routing

---

# Implementation gates

## Part 3.5 gate
Must pass before Part 4:
- Transaction ledger migrated
- finance calculations deterministic
- UserPreference additions migrated
- AI entitlement works
- onboarding works
- React/Vite regressions pass
- no Part 4 search/vector code introduced

## Part 4 gate
Must pass before Part 5:
- Next.js migration complete
- Parts 1–3.5 regressions pass
- pgvector/FTS/hybrid retrieval works
- strict RAG works
- final navigation preserved
- no Part 5 location behavior implemented

## Part 5 gate
Must pass before Part 6:
- Places/reminders user isolation
- active-session reminder runtime
- browser location mode OFF by default
- no movement history
- nearby shopping works
- live GPS does not leak into search/RAG

## Part 6 gate
Release only after:
- deterministic priority
- grounded briefing
- Transactions/finance dashboard
- retrieval/RAG evaluation
- accessibility/reduced motion
- automated release tests
- security/privacy review
- production smoke tests
- documentation consistency pass

---

# Rule for OpenCode / implementation agents

Before implementing any future part:

1. read this file;
2. read the reconciled part file;
3. inspect the actual repository;
4. treat implemented behavior as evidence, not as permission to resurrect an old plan;
5. report any mismatch before changing architecture;
6. do not silently choose between contradictory docs.
